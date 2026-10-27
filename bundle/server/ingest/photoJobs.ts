// Background photo reading. The parent's upload is saved straight away (status 'reading') and answered at once with
// "Thanks, we're reading your photo"; the vision model reads it here, in the background, and the result is written to the
// photo's record (item_photos.status / read_error / read_result), which the Gear Locker polls.
//
// Busy free AI service: every read already waits several minutes inside see() (adapters/llm.ts). If it is STILL busy,
// the job goes back in the queue after a longer pause (BUSY_REQUEUE_MS) before it ever gives up.
//
// The picture: held in this process's memory only while it is being read, and for KEEP_FOR_RETRY_MS after a failure so
// the "Try again" button works without a new photo. Then the bytes are wiped. They are never written to disk or the database
// (gear keeps only the small thumbnail; receipts keep the cleaned receipt picture, as before).
import {
  NO_MODEL_MESSAGE, PHOTO_FAILED_MESSAGE, cleanReceiptImage, cleanThumbnail, readPhoto, validatePhoto,
  type PhotoDeps, type PhotoInput, type PhotoKind, type PhotoRecord, type PhotoResult, type PhotoStatus,
} from './photo';

export const READING_MESSAGE = "Thanks! We're reading your photo. It will appear in your Gear Locker when it's done. You can close this.";
export const STILL_BUSY_MESSAGE = "The photo reader is busy. We'll keep trying, so you don't need to do anything.";
export const INTERRUPTED_MESSAGE = 'This photo was interrupted before it was read. Please take it again.';
export const RETAKE_MESSAGE = 'Please take the photo again.';

/** Extra waits before reading again when the AI service was still busy after a whole read's patience. */
export const BUSY_REQUEUE_MS = [30_000, 60_000, 120_000];
/** How long a failed photo's bytes stay in memory for the "Try again" button. */
export const KEEP_FOR_RETRY_MS = 30 * 60 * 1000;
/** A 'reading' record with no job in this process for this long was cut off (for example the server restarted). */
export const STALE_READING_MS = 15 * 60 * 1000;

/** What the client sees for one photo. Product facts only: no hashes, no read text, no model names. */
export interface PhotoStatusView {
  photoId: number;
  kind: PhotoKind;
  status: PhotoStatus;
  message: string | null;
  thumbnail: string | null;
  /** The reading (items with their recall checks) once status is 'done'. */
  result?: unknown;
  /** True when "Try again" can re-read the same photo (its bytes are still held); false means take a new photo. */
  canRetry: boolean;
}

export interface PhotoJobDeps {
  makeDeps: () => PhotoDeps;
  /** Turns a finished reading into the parent-safe result (recall checks, money-back check). */
  describe: (out: Extract<PhotoResult, { status: 'ok' }>, job: { familyId: string; kind: PhotoKind }) => Promise<Record<string, unknown>>;
  /** Photos read at the same time (the free service allows few). Default 2. */
  concurrency?: number;
  requeueMs?: number[];
  keepForRetryMs?: number;
  /** Test hooks. */
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => void;
}

interface Job {
  photoId: number; familyId: string; kind: PhotoKind; mimeType: string; bytes: Buffer; thumbnail?: string;
  requeues: number; running: boolean; wipeAt?: number;
}

const BUSY_REASONS = new Set(['busy', 'timeout', 'deadline', 'server', 'connect']);

export function createPhotoJobs(j: PhotoJobDeps) {
  const held = new Map<number, Job>();
  const queue: Job[] = [];
  const finished = new Map<number, PhotoStatusView & { familyId: string }>();
  let running = 0;
  let waiters: (() => void)[] = [];
  const now = j.now ?? Date.now;
  const timer = j.setTimer ?? ((fn: () => void, ms: number) => { const t = setTimeout(fn, ms); t.unref?.(); });
  const store = () => j.makeDeps().store;
  const concurrency = j.concurrency ?? 2;
  const requeueMs = j.requeueMs ?? BUSY_REQUEUE_MS;
  const keepMs = j.keepForRetryMs ?? KEEP_FOR_RETRY_MS;
  const delayed = new Set<number>();

  const wipe = (job: Job) => { job.bytes.fill(0); held.delete(job.photoId); };
  const keepForRetry = (job: Job) => {
    job.wipeAt = now() + keepMs;
    timer(() => { const h = held.get(job.photoId); if (h && !h.running && h.wipeAt && now() >= h.wipeAt) wipe(h); }, keepMs);
  };
  const settleIdle = () => {
    if (running === 0 && queue.length === 0 && delayed.size === 0) { const w = waiters; waiters = []; w.forEach((f) => f()); }
  };

  function pump() {
    while (running < concurrency && queue.length) {
      const job = queue.shift()!;
      running++;
      job.running = true;
      void run(job).catch(() => undefined).finally(() => { job.running = false; running--; pump(); settleIdle(); });
    }
    settleIdle();
  }

  async function finish(job: Job, status: PhotoStatus, message: string | null, keep: boolean) {
    await store().updatePhoto(job.photoId, { status, readError: message });
    if (keep) keepForRetry(job); else wipe(job);
  }

  async function run(job: Job): Promise<void> {
    const d = j.makeDeps();
    let out: PhotoResult;
    try {
      out = await readPhoto({ familyId: job.familyId, kind: job.kind, mimeType: job.mimeType, bytes: job.bytes, thumbnail: job.thumbnail, photoId: job.photoId, keepBytes: true }, d);
    } catch {
      return finish(job, 'failed', PHOTO_FAILED_MESSAGE, true);
    }
    if (out.status === 'ok') {
      const result = await j.describe(out, job);
      if (out.stored === 0) {
        // Already in the locker from an earlier photo: show the result once, but keep no second record.
        finished.set(job.photoId, { familyId: job.familyId, photoId: job.photoId, kind: job.kind, status: 'done', message: null, thumbnail: out.thumbnail, result: { ...result, already: true }, canRetry: false });
        await d.store.deletePhoto(job.photoId);
      } else {
        await d.store.updatePhoto(job.photoId, { status: 'done', readError: null, readResult: result });
      }
      wipe(job);
      return;
    }
    if (out.status === 'unavailable' && out.reason && BUSY_REASONS.has(out.reason) && job.requeues < requeueMs.length) {
      const wait = requeueMs[job.requeues++];
      await d.store.updatePhoto(job.photoId, { status: 'reading', readError: STILL_BUSY_MESSAGE });
      delayed.add(job.photoId);
      timer(() => { delayed.delete(job.photoId); if (held.has(job.photoId)) { queue.push(job); pump(); } else settleIdle(); }, wait);
      return;
    }
    if (out.status === 'needs_clearer_photo') return finish(job, 'needs_clearer_photo', out.message || NO_MODEL_MESSAGE, false);
    if (out.status === 'rejected') return finish(job, 'rejected', out.message, false);
    // 'failed' (garbled answers every time), 'unavailable' (still busy after every retry, or not set up), 'invalid'.
    return finish(job, 'failed', out.message, out.status !== 'invalid');
  }

  function view(p: PhotoRecord): PhotoStatusView {
    let status = (p.status ?? 'done') as PhotoStatus;
    let message = p.readError ?? null;
    const job = held.get(p.id);
    const stamp = p.updatedAt ?? p.createdAt;
    const age = stamp ? now() - new Date(stamp).getTime() : 0;
    if (status === 'reading' && !job && age > STALE_READING_MS) {
      status = 'failed'; message = INTERRUPTED_MESSAGE;
      void store().updatePhoto(p.id, { status, readError: message }).catch(() => undefined);
    }
    return {
      photoId: p.id, kind: p.kind === 'receipt' ? 'receipt' : 'item', status, message, thumbnail: p.thumbnail ?? null,
      ...(status === 'done' && p.readResult ? { result: p.readResult } : {}),
      canRetry: !!job && !job.running && status !== 'reading',
    };
  }

  return {
    /** Saves the photo record at once (status 'reading') and queues the read. Returns its id, or a plain reason it was refused. */
    async start(input: PhotoInput): Promise<{ ok: true; photoId: number } | { ok: false; message: string }> {
      const bad = validatePhoto(input);
      if (bad) { input.bytes.fill(0); return { ok: false, message: bad }; }
      const photoId = await store().savePhoto({
        familyId: input.familyId, kind: input.kind === 'receipt' ? 'receipt' : 'gear',
        thumbnail: cleanThumbnail(input.thumbnail), receiptImage: cleanReceiptImage(input), status: 'reading',
      });
      const job: Job = { photoId, familyId: input.familyId, kind: input.kind, mimeType: input.mimeType, bytes: input.bytes, thumbnail: input.thumbnail, requeues: 0, running: false };
      held.set(photoId, job);
      queue.push(job);
      pump();
      return { ok: true, photoId };
    },

    /** One photo's state for its family, or null when there is no such photo for this family. */
    async status(familyId: string, photoId: number): Promise<PhotoStatusView | null> {
      const f = finished.get(photoId);
      if (f) { if (f.familyId !== familyId) return null; const { familyId: _f, ...v } = f; return v; }
      const p = await store().getPhoto(photoId);
      return p && p.familyId === familyId ? view(p) : null;
    },

    /** The family's photos that are not done: still reading, or stopped with a message (newest first). */
    async pending(familyId: string): Promise<PhotoStatusView[]> {
      const photos = await store().listPhotos(familyId);
      return photos.filter((p) => (p.status ?? 'done') !== 'done').map(view);
    },

    /** "Try again" on a stopped photo: re-reads the same bytes if still held, else says to take a new photo. */
    async retry(familyId: string, photoId: number): Promise<'requeued' | 'gone' | 'not_found'> {
      const p = await store().getPhoto(photoId);
      if (!p || p.familyId !== familyId) return 'not_found';
      const job = held.get(photoId);
      if (!job || job.running || queue.includes(job) || delayed.has(photoId)) {
        if (job && (job.running || queue.includes(job) || delayed.has(photoId))) return 'requeued';
        return 'gone';
      }
      job.requeues = 0; job.wipeAt = undefined;
      await store().updatePhoto(photoId, { status: 'reading', readError: null });
      queue.push(job);
      pump();
      return 'requeued';
    },

    /** Removes a stopped photo (the "Remove" button). Never removes a done photo's items: "Forget my items" does that. */
    async dismiss(familyId: string, photoId: number): Promise<boolean> {
      const p = await store().getPhoto(photoId);
      if (!p || p.familyId !== familyId || (p.status ?? 'done') === 'done') return false;
      const job = held.get(photoId);
      if (job?.running) return false;
      if (job) { const i = queue.indexOf(job); if (i >= 0) queue.splice(i, 1); wipe(job); }
      await store().deletePhoto(photoId);
      return true;
    },

    /** Tests and the proof script: resolves once nothing is queued, waiting or running. */
    idle(): Promise<void> {
      return new Promise((r) => { waiters.push(r); settleIdle(); });
    },
  };
}

export type PhotoJobs = ReturnType<typeof createPhotoJobs>;

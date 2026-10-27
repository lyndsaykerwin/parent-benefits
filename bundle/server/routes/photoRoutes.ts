// Photo intake routes. The photo arrives as base64 inside a small JSON body, is read in memory and never saved.
//   POST /api/photo/start   (or /api/photo/read with background: true) { familyId, kind, mimeType, imageBase64, thumbnail? } -> 202 { photoId, status: 'reading', message } (read in the background)
//   GET  /api/photo/status/:photoId?familyId=                                            -> { photoId, status, message, thumbnail, result?, canRetry }
//   GET  /api/families/:familyId/photos                                                  -> { photos } still reading, or stopped with a message
//   POST /api/photo/retry   { familyId, photoId }  /  POST /api/photo/dismiss { familyId, photoId }
//   GET  /api/photo/examples/:name                                                       -> the made-up example label pictures
//   POST /api/photo/read    { familyId, kind: 'item' | 'receipt', mimeType, imageBase64, thumbnail? }  -> reading result + recall check (waits; kept for scripts)
//   POST /api/photo/forget  { familyId }                                                    -> { deleted }  (items AND saved photos)
//   GET  /api/families/:familyId/gear                                                       -> the Gear Locker { items, receipts }
import crypto from 'node:crypto';
import path from 'node:path';
import express, { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { TraceLogger } from '../agents/trace';
import { createGenerator, isLiveModel, UnavailableGenerator } from '../adapters/llm';
import {
  MAX_PHOTO_BYTES, defaultVisionCacheDir, forgetItems, getSharedPhotoStore, readPhoto,
  type PhotoDeps, type PhotoKind, type PhotoResult, type PhotoStore, type ReadItem,
} from '../ingest/photo';
import { createPhotoJobs, READING_MESSAGE, RETAKE_MESSAGE, type PhotoJobDeps } from '../ingest/photoJobs';
import { checkCarSeat, checkItemRecall, isCarSeat, moneyBackFor, registrationUrl, type RecallResult, type SqlRunner } from '../ingest/gearRecall';
import { makeZetarisClient } from '../bundleDeps';
import { resolveToday } from '../demoDate';

export interface PhotoApiDeps {
  /** Fresh dependencies for one photo (model, store, trace, saved answers). Tests inject fakes. */
  makeDeps: () => PhotoDeps;
  /** Photos one visitor may send per 15 minutes (default 30). Tests lower it. */
  limit?: number;
  /** Where the CPSC recall list is asked (Zetaris). Null or missing: only car seats (NHTSA's own file) can be checked. Tests inject fakes. */
  recallRunner?: () => SqlRunner | null;
  /** The date a check is stamped with ("as of ..."). Tests pin it. */
  now?: () => Date;
  /** Writes "what Bundle remembers" for a family (a piece of gear it saved). Optional: the app wires it to Meterless memory. */
  rememberGear?: (familyId: string, text: string) => void;
  /** Deletes the gear entries written by `rememberGear` for a family ("Forget my items"). */
  forgetGear?: (familyId: string) => void;
  /** Background-reading options (tests shorten the waits). */
  jobs?: Partial<Omit<PhotoJobDeps, 'makeDeps' | 'describe'>>;
}

/** The made-up example labels shown in the scan sheet (data/sample/photos). Only these names are served. */
export const EXAMPLE_PHOTOS: Record<string, string> = {
  'car-seat': 'item-example-car-seat-label.png',
  stroller: 'item-example-stroller-label.png',
};

const defaultStore = (): PhotoStore => getSharedPhotoStore();

/** Zetaris for the CPSC check: live only, and only when its settings are present. Practice mode never calls out. */
function defaultRecallRunner(): SqlRunner | null {
  if (process.env.SAMPLE_MODE === 'true') return null;
  if (['ZETARIS_BASE_URL', 'ZETARIS_ORG_ID', 'ZETARIS_API_KEY'].some((k) => !process.env[k])) return null;
  return makeZetarisClient(false);
}

export function createDefaultPhotoDeps(): PhotoApiDeps {
  return {
    recallRunner: defaultRecallRunner,
    makeDeps: () => {
      const sampleMode = process.env.SAMPLE_MODE === 'true' && !isLiveModel();
      return {
        gen: sampleMode ? new UnavailableGenerator('SAMPLE_MODE is on (offline)') : createGenerator(),
        store: defaultStore(),
        sampleMode,
        cacheDir: defaultVisionCacheDir(),
        trace: new TraceLogger(`photo_${crypto.randomBytes(6).toString('hex')}`),
        env: process.env,
      };
    },
  };
}

const KINDS: PhotoKind[] = ['item', 'receipt'];
const FAMILY_ID = /^[A-Za-z0-9_-]{1,40}$/;
/** The date a check is stamped with. A sample family is always checked as of the demo date, the same date the banner shows. */
const checkDate = (api: PhotoApiDeps, familyId: string): string => api.now ? api.now().toISOString().slice(0, 10) : resolveToday(familyId).today;
const regLink = (brand: string | null | undefined) => { const u = registrationUrl(brand); return u ? { registerUrl: u } : {}; };

/** One item as the parent sees it: the product facts plus its recall check (and, on a receipt, the money-back check). */
async function describeItem(i: ReadItem, kind: PhotoKind, today: string, z: SqlRunner | null): Promise<Record<string, unknown>> {
  const recall: RecallResult = await checkItemRecall({ productName: i.productName, brand: i.brand, modelNumber: i.modelNumber, upc: i.upc, lotCode: i.lotCode, manufacturedOn: i.manufacturedOn }, today, z);
  return {
    productName: i.productName, brand: i.brand, modelNumber: i.modelNumber, lotCode: i.lotCode, manufacturedOn: i.manufacturedOn,
    upc: i.upc, sizeText: i.sizeText, store: i.store, purchasedOn: i.purchasedOn,
    priceCents: i.priceCents, quantity: i.quantity,
    recall,
    ...(kind === 'receipt' ? moneyBackFor(i.productName) : {}),
  };
}
// base64 is about a third bigger than the picture it carries.
const JSON_LIMIT = `${Math.ceil((MAX_PHOTO_BYTES * 4) / 3 / 1024 / 1024) + 1}mb`;

type UploadParse = { input: { familyId: string; kind: PhotoKind; mimeType: string; bytes: Buffer; thumbnail?: string } } | { error: string; code: number };
function parseUpload(body: unknown): UploadParse {
  const { familyId, kind, mimeType, imageBase64, thumbnail } = (body ?? {}) as Record<string, unknown>;
  if (typeof familyId !== 'string' || !FAMILY_ID.test(familyId)) return { error: 'familyId is required.', code: 400 };
  if (typeof kind !== 'string' || !KINDS.includes(kind as PhotoKind)) return { error: "kind must be 'item' or 'receipt'.", code: 400 };
  if (typeof mimeType !== 'string' || typeof imageBase64 !== 'string' || !imageBase64) return { error: 'mimeType and imageBase64 are required.', code: 400 };
  const bytes = Buffer.from(imageBase64, 'base64');
  if (bytes.length > MAX_PHOTO_BYTES) return { error: 'That photo is too big. Please send one under 5 MB.', code: 413 };
  return { input: { familyId, kind: kind as PhotoKind, mimeType, bytes, thumbnail: typeof thumbnail === 'string' ? thumbnail : undefined } };
}

export function createPhotoRouter(api: PhotoApiDeps = createDefaultPhotoDeps()): Router {
  const router = Router();

  /** A finished reading as the parent sees it: product facts plus the recall check (and, for a receipt, the money-back check). */
  const describe = async (out: Extract<PhotoResult, { status: 'ok' }>, job: { familyId: string; kind: PhotoKind }): Promise<Record<string, unknown>> => {
    const today = checkDate(api, job.familyId);
    const z = api.recallRunner ? api.recallRunner() : null;
    const items = await Promise.all(out.items.map((i) => describeItem(i, job.kind, today, z)));
    // Gear (not receipts) is written into Bundle's memory for this family, so the Account tab can show it.
    if (job.kind === 'item') for (const i of out.items) { try { if (i.productName) api.rememberGear?.(job.familyId, `Has: ${i.productName}`); } catch { /* memory is a bonus, never a blocker */ } }
    // Parent-safe: product facts only (no hashes, no model details, no read text).
    return {
      status: 'ok', kind: job.kind, rounds: out.rounds, stored: out.stored, sample: out.sample, photoId: out.photoId, thumbnail: out.thumbnail,
      store: out.items[0]?.store ?? null, purchasedOn: out.items[0]?.purchasedOn ?? null, items,
    };
  };
  const jobs = createPhotoJobs({ makeDeps: api.makeDeps, describe, ...(api.jobs ?? {}) });

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: api.limit ?? 30, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many photos from this connection. Please try again in a few minutes.' },
  });
  const json = express.json({ limit: JSON_LIMIT });

  router.post('/api/photo/read', limiter, json, async (req: Request, res: Response) => {
    // { background: true }: the app's scan sheet. Saved and answered at once (202), read in the background.
    if ((req.body as Record<string, unknown> | undefined)?.background === true) return startInBackground(req, res);
    const { familyId, kind, mimeType, imageBase64, thumbnail } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof familyId !== 'string' || !FAMILY_ID.test(familyId)) return res.status(400).json({ error: 'familyId is required.' });
    if (typeof kind !== 'string' || !KINDS.includes(kind as PhotoKind)) return res.status(400).json({ error: "kind must be 'item' or 'receipt'." });
    if (typeof mimeType !== 'string' || typeof imageBase64 !== 'string' || !imageBase64) return res.status(400).json({ error: 'mimeType and imageBase64 are required.' });
    const bytes = Buffer.from(imageBase64, 'base64');
    if (bytes.length > MAX_PHOTO_BYTES) return res.status(413).json({ error: 'That photo is too big. Please send one under 5 MB.' });
    try {
      const out = await readPhoto({ familyId, kind: kind as PhotoKind, mimeType, bytes, thumbnail: typeof thumbnail === 'string' ? thumbnail : undefined }, api.makeDeps());
      if (out.status === 'invalid') return res.status(400).json({ status: out.status, error: out.message });
      if (out.status !== 'ok') return res.json({ status: out.status, message: out.message });
      return res.json(await describe(out, { familyId, kind: kind as PhotoKind }));
    } catch {
      return res.status(500).json({ error: 'Could not read that photo. Please try again.' });
    }
  });

  /** Upload: saved at once and answered at once ("we're reading your photo"); the reading happens in the background. */
  async function startInBackground(req: Request, res: Response) {
    const parsed = parseUpload(req.body);
    if ('error' in parsed) return res.status(parsed.code).json({ error: parsed.error });
    try {
      const out = await jobs.start(parsed.input);
      if (!out.ok) return res.status(400).json({ status: 'invalid', error: out.message });
      return res.status(202).json({ status: 'reading', photoId: out.photoId, kind: parsed.input.kind, message: READING_MESSAGE });
    } catch {
      return res.status(500).json({ error: 'Could not save that photo. Please try again.' });
    }
  }
  router.post('/api/photo/start', limiter, json, startInBackground);

  router.get('/api/photo/status/:photoId', async (req: Request, res: Response) => {
    const familyId = String(req.query.familyId ?? '');
    const photoId = Number(req.params.photoId);
    if (!FAMILY_ID.test(familyId) || !Number.isInteger(photoId) || photoId < 1) return res.status(400).json({ error: 'familyId and photoId are required.' });
    try {
      const v = await jobs.status(familyId, photoId);
      return v ? res.json(v) : res.status(404).json({ error: 'That photo is not here any more.' });
    } catch {
      return res.status(500).json({ error: 'Could not check that photo. Please try again.' });
    }
  });

  router.get('/api/families/:familyId/photos', async (req: Request, res: Response) => {
    const familyId = req.params.familyId;
    if (!FAMILY_ID.test(familyId)) return res.status(400).json({ error: 'familyId is required.' });
    try { return res.json({ photos: await jobs.pending(familyId) }); } catch { return res.status(500).json({ error: 'Could not check your photos. Please try again.' }); }
  });

  router.post('/api/photo/retry', limiter, json, async (req: Request, res: Response) => {
    const { familyId, photoId } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof familyId !== 'string' || !FAMILY_ID.test(familyId) || !Number.isInteger(photoId)) return res.status(400).json({ error: 'familyId and photoId are required.' });
    try {
      const out = await jobs.retry(familyId, photoId as number);
      if (out === 'not_found') return res.status(404).json({ error: 'That photo is not here any more.' });
      if (out === 'gone') return res.status(410).json({ status: 'gone', message: RETAKE_MESSAGE });
      return res.status(202).json({ status: 'reading', photoId, message: READING_MESSAGE });
    } catch {
      return res.status(500).json({ error: 'Could not try that photo again. Please try again.' });
    }
  });

  router.post('/api/photo/dismiss', json, async (req: Request, res: Response) => {
    const { familyId, photoId } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof familyId !== 'string' || !FAMILY_ID.test(familyId) || !Number.isInteger(photoId)) return res.status(400).json({ error: 'familyId and photoId are required.' });
    try { return res.json({ removed: await jobs.dismiss(familyId, photoId as number) }); } catch { return res.status(500).json({ error: 'Could not remove that photo. Please try again.' }); }
  });

  router.get('/api/photo/examples/:name', (req: Request, res: Response) => {
    const file = EXAMPLE_PHOTOS[String(req.params.name).replace(/\.png$/, '')];
    if (!file) return res.status(404).end();
    res.setHeader('cache-control', 'public, max-age=3600');
    return res.sendFile(path.resolve(process.cwd(), 'data/sample/photos', file), (err) => { if (err && !res.headersSent) res.status(404).end(); });
  });

  /** The Gear Locker: gear items and receipts saved for this family, each with its small picture. */
  router.get('/api/families/:familyId/gear', async (req: Request, res: Response) => {
    const familyId = req.params.familyId;
    if (!FAMILY_ID.test(familyId)) return res.status(400).json({ error: 'familyId is required.' });
    try {
      const store = api.makeDeps().store;
      const [rows, photos] = await Promise.all([store.listItems(familyId), store.listPhotos(familyId)]);
      const today = checkDate(api, familyId);
      const photoOf = new Map(photos.map((p) => [p.id, p]));
      const gear = rows.filter((r) => r.source === 'photo_item' || r.source === 'barcode').map((r) => {
        const thumb = r.photoId != null ? photoOf.get(r.photoId)?.thumbnail ?? null : null;
        const item = { productName: r.productName, brand: r.brand ?? null, modelNumber: r.modelNumber ?? null, upc: r.upc ?? null, lotCode: r.lotCode ?? null, manufacturedOn: r.manufacturedOn ?? null };
        // Car seats are checked against NHTSA's local file every time the locker opens; other gear shows no recall line here.
        const recall = isCarSeat(item) ? { ...checkCarSeat(item, today), ...regLink(r.brand) } : null;
        return { id: r.id ?? null, photoId: r.photoId ?? null, thumbnail: thumb, ...item, source: r.source, recall };
      });
      // Receipts still being read (or stopped) are shown by the photo status list, not here.
      const receipts = photos.filter((p) => p.kind === 'receipt' && (p.status ?? 'done') === 'done').map((p) => {
        const lines = rows.filter((r) => r.photoId === p.id);
        return {
          photoId: p.id, kind: 'receipt' as const, store: lines[0]?.store ?? null, purchasedOn: lines[0]?.purchasedOn ?? null,
          itemCount: lines.length, thumbnail: p.thumbnail ?? p.receiptImage,
          items: lines.map((l) => ({ productName: l.productName, priceCents: l.priceCents ?? null })),
        };
      });
      return res.json({ items: gear, receipts });
    } catch {
      return res.status(500).json({ error: 'Could not open your gear locker. Please try again.' });
    }
  });

  router.post('/api/photo/forget', limiter, json, async (req: Request, res: Response) => {
    const { familyId } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof familyId !== 'string' || !FAMILY_ID.test(familyId)) return res.status(400).json({ error: 'familyId is required.' });
    try {
      const deleted = await forgetItems(familyId, api.makeDeps().store);
      try { api.forgetGear?.(familyId); } catch { /* nothing more to delete */ }
      return res.json({ deleted });
    } catch {
      return res.status(500).json({ error: 'Could not remove your items. Please try again.' });
    }
  });

  // A body past the size limit (or broken JSON) gets a plain answer instead of a stack trace.
  router.use((err: { type?: string; status?: number }, _req: Request, res: Response, next: NextFunction) => {
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'That photo is too big. Please send one under 5 MB.' });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad request.' });
    return next(err);
  });

  return router;
}

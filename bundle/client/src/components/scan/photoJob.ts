// Background photo reading, phone side. The photo is sent once; the server saves it and answers straight away
// ("Thanks, we're reading your photo"), reads it in the background, and the app checks back every few seconds.
import type { PhotoReadResponse } from '@/lib/photoPrep';

export type PhotoStatus = 'reading' | 'done' | 'needs_clearer_photo' | 'rejected' | 'failed';

/** One photo's state, as the server reports it (product facts only). */
export interface PhotoStatusView {
  photoId: number;
  kind: 'item' | 'receipt';
  status: PhotoStatus;
  message: string | null;
  thumbnail: string | null;
  /** The reading (same shape as an instant read) once status is 'done'. */
  result?: Extract<PhotoReadResponse, { status: 'ok' }> & { already?: boolean };
  /** True when "Try again" can re-read the same photo; false means take a new photo. */
  canRetry: boolean;
}

/** What the upload answers: the instant reading (older servers, practice) or "we're reading it" with the photo's id. */
export type StartResponse = PhotoReadResponse | { status: 'reading'; photoId: number; message: string; kind?: 'item' | 'receipt' };

/** The one-line tip under the example labels: exactly what to capture. */
export const CAPTURE_TIP = 'Find the white sticker under the seat with the model number and date made.';
export const STROLLER_TIP = 'On a stroller it is usually on the frame near a back wheel.';

/** The made-up example labels (served by the photo routes from data/sample/photos). */
export const EXAMPLES = [
  { id: 'car-seat', title: 'Car seat sticker', src: '/api/photo/examples/car-seat', alt: 'Example car seat sticker (made-up brand): model number ZF-CS100, date of manufacture 2026/02/09, lot CS0209B' },
  { id: 'stroller', title: 'Stroller sticker', src: '/api/photo/examples/stroller', alt: 'Example stroller sticker (made-up brand): model number TM-ST200, date of manufacture 2026/03/14, lot 0314A' },
] as const;

const json = { 'content-type': 'application/json' };

/** Sends the prepared photo for background reading. */
export async function startPhoto(
  body: { familyId: string; kind: 'item' | 'receipt'; mimeType: string; imageBase64: string; thumbnail?: string },
  fetchFn?: typeof fetch,
): Promise<StartResponse> {
  const res = await (fetchFn ?? globalThis.fetch)('/api/photo/read', { method: 'POST', headers: json, body: JSON.stringify({ ...body, background: true }) });
  const out = (await res.json().catch(() => ({}))) as StartResponse & { error?: string };
  if (!res.ok) throw new Error(out.error || 'Could not send that photo. Please try again.');
  return out;
}

export async function fetchPhotoStatus(familyId: string, photoId: number, fetchFn?: typeof fetch): Promise<PhotoStatusView | null> {
  const res = await (fetchFn ?? globalThis.fetch)(`/api/photo/status/${photoId}?familyId=${encodeURIComponent(familyId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw Object.assign(new Error('Could not check that photo.'), { status: res.status });
  return (await res.json()) as PhotoStatusView;
}

/** The family's photos still being read, or stopped with a message. An older server (or a blip) simply gives none. */
export async function fetchPendingPhotos(familyId: string, fetchFn?: typeof fetch): Promise<PhotoStatusView[]> {
  try {
    if (!fetchFn && typeof globalThis.fetch !== 'function') return [];
    const res = await (fetchFn ?? globalThis.fetch)(`/api/families/${encodeURIComponent(familyId)}/photos`);
    if (!res.ok) return [];
    const out = (await res.json().catch(() => ({}))) as { photos?: PhotoStatusView[] };
    return Array.isArray(out.photos) ? out.photos : [];
  } catch { return []; }
}

/** "Try again": 'reading' when the same photo is being read again, 'retake' when a new photo is needed. */
export async function retryPhoto(familyId: string, photoId: number, fetchFn?: typeof fetch): Promise<'reading' | 'retake'> {
  const res = await (fetchFn ?? globalThis.fetch)('/api/photo/retry', { method: 'POST', headers: json, body: JSON.stringify({ familyId, photoId }) });
  if (res.status === 202) return 'reading';
  if (res.status === 410 || res.status === 404) return 'retake';
  throw new Error('Could not try that photo again. Please try again.');
}

export async function dismissPhoto(familyId: string, photoId: number, fetchFn?: typeof fetch): Promise<void> {
  await (fetchFn ?? globalThis.fetch)('/api/photo/dismiss', { method: 'POST', headers: json, body: JSON.stringify({ familyId, photoId }) });
}

/** Failed checks in a row before we stop checking one photo (the locker still shows it on the next open). */
export const MAX_STATUS_FAILURES = 8;

/**
 * Checks one photo every `intervalMs` until it is no longer 'reading'. Network blips are retried; a photo the server
 * no longer knows (404) stops at once. Returns a stop function.
 */
export function pollPhoto(
  familyId: string, photoId: number,
  h: { onUpdate?: (v: PhotoStatusView) => void; onDone: (v: PhotoStatusView) => void; onGone?: () => void },
  intervalMs = 3000, fetchFn?: typeof fetch,
): () => void {
  let stopped = false;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    try {
      const v = await fetchPhotoStatus(familyId, photoId, fetchFn);
      if (stopped) return;
      failures = 0;
      if (!v) return h.onGone?.();
      h.onUpdate?.(v);
      if (v.status !== 'reading') return h.onDone(v);
    } catch {
      if (stopped) return;
      if (++failures >= MAX_STATUS_FAILURES) return h.onGone?.();
    }
    if (!stopped) timer = setTimeout(tick, intervalMs);
  };
  timer = setTimeout(tick, intervalMs);
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}

/** The plain-language "done" line for a finished photo: what was added and what the recall check said. */
export function doneNotice(v: PhotoStatusView): string {
  if (v.status !== 'done') return v.message ?? 'We could not read that photo.';
  const items = v.result?.items ?? [];
  const first = items[0]?.productName ?? (v.kind === 'receipt' ? 'Your receipt' : 'Your item');
  const what = v.kind === 'receipt' ? `Your receipt (${items.length} ${items.length === 1 ? 'item' : 'items'})` : first;
  const found = items.some((i) => i.recall?.found === true);
  const none = items.length > 0 && items.every((i) => i.recall?.found === false);
  const tail = found ? 'Possible recall: open it to check.' : none ? 'No recalls found.' : 'Open it to see the recall check.';
  return `${what} is in your Gear Locker. ${tail}`;
}

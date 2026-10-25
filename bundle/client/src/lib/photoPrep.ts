// Phone-side photo preparation. Before a photo leaves the phone it is redrawn onto a blank canvas and re-saved as a
// fresh JPEG: that throws away the hidden details inside every photo (EXIF: GPS location, time, phone model) and
// shrinks it so the upload is small and fast. The server never receives the original file.

export const MAX_SIDE = 1600;
export const JPEG_QUALITY = 0.85;
/** The biggest file we will even try to open on the phone. */
export const MAX_PICK_BYTES = 25 * 1024 * 1024;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];

export function fitWithin(width: number, height: number, maxSide = MAX_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const scale = maxSide / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function checkPickedFile(f: File): string | null {
  if (!OK_TYPES.includes(f.type)) return 'Please choose a photo (JPEG or PNG).';
  if (f.size > MAX_PICK_BYTES) return 'That photo is too big. Please take a new one.';
  return null;
}

/** The browser-only parts, swappable in tests. */
export interface PhotoCodec {
  decode(file: File): Promise<{ width: number; height: number; source?: unknown }>;
  /** Draws onto a new canvas of this size and returns JPEG as base64 (no "data:" prefix). */
  redrawAsJpeg(source: unknown, width: number, height: number, file: File): Promise<string>;
  /** A small picture (about 200 px on the long side) as a "data:image/jpeg;base64,..." address, drawn from the same decoded photo. Optional. */
  thumbnailJpeg?(source: unknown, width: number, height: number): Promise<string>;
}

/** The long side of the picture kept in the gear locker. */
export const THUMB_SIDE = 200;

export const browserCodec: PhotoCodec = {
  async decode(file) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { width: bmp.width, height: bmp.height, source: bmp };
  },
  async thumbnailJpeg(source, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.7);
  },
  async redrawAsJpeg(source, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
    (source as ImageBitmap).close?.();
    const url = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    return url.slice(url.indexOf(',') + 1);
  },
};

export interface PreparedPhoto { mimeType: 'image/jpeg'; imageBase64: string; /** Small data-address picture for the gear locker (absent if the phone could not make one). */ thumbnail?: string }

export async function preparePhoto(file: File, codec: PhotoCodec = browserCodec): Promise<PreparedPhoto> {
  try {
    const decoded = await codec.decode(file);
    const { width, height } = fitWithin(decoded.width, decoded.height);
    // The small picture first: drawing the full-size one closes the decoded photo.
    let thumbnail: string | undefined;
    if (codec.thumbnailJpeg) {
      try { const t = fitWithin(decoded.width, decoded.height, THUMB_SIDE); thumbnail = await codec.thumbnailJpeg(decoded.source, t.width, t.height); } catch { thumbnail = undefined; }
    }
    const imageBase64 = await codec.redrawAsJpeg(decoded.source, width, height, file);
    return thumbnail ? { mimeType: 'image/jpeg', imageBase64, thumbnail } : { mimeType: 'image/jpeg', imageBase64 };
  } catch {
    throw new Error('We could not open that photo. Please try another one.');
  }
}

const FORGET_FAILED = 'Could not remove your items. Please try again.';

/** Ask the server to delete every item saved for this family (the existing "forget" route). Returns how many were removed. */
export async function forgetMyItems(familyId: string, fetchFn: typeof fetch = fetch): Promise<number> {
  let res: Response;
  try {
    res = await fetchFn('/api/photo/forget', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ familyId }),
    });
  } catch {
    throw new Error(FORGET_FAILED);
  }
  const json = (await res.json().catch(() => ({}))) as { deleted?: number; error?: string };
  if (!res.ok) throw new Error(json.error || FORGET_FAILED);
  return typeof json.deleted === 'number' ? json.deleted : 0;
}

/** One recall check: found / none found / could not check (found: null). */
export interface RecallInfo {
  found: boolean | null;
  source: 'NHTSA' | 'CPSC';
  recordsChecked: number | null;
  checkedOn: string;
  registerUrl?: string;
  matches?: { id: string; title: string; recallDate: string; url: string; summary: string }[];
  note?: string;
}

/** One item the server read (a gear label, or one line of a receipt), with its checks. */
export interface ScannedItem {
  productName: string;
  brand?: string | null;
  modelNumber?: string | null;
  upc?: string | null;
  lotCode?: string | null;
  store?: string | null;
  purchasedOn?: string | null;
  priceCents?: number | null;
  recall?: RecallInfo;
  /** Receipts only: the money-back check. */
  fsaEligible?: boolean;
  fsaCategory?: string;
  fsaAccount?: string;
  fsaSourceUrl?: string;
  [k: string]: unknown;
}

export type PhotoReadResponse =
  | {
      status: 'ok'; rounds?: number; stored?: number; items: ScannedItem[];
      kind?: 'item' | 'receipt'; photoId?: number | null; thumbnail?: string | null; store?: string | null; purchasedOn?: string | null;
      /** true when no real vision recording exists (practice mode): the answer is a made-up sample. */
      sample?: boolean;
    }
  | { status: 'needs_clearer_photo' | 'rejected' | 'unavailable'; message: string };

export async function sendPhoto(
  body: { familyId: string; kind: 'item' | 'receipt'; mimeType: string; imageBase64: string; thumbnail?: string },
  fetchFn: typeof fetch = fetch,
): Promise<PhotoReadResponse> {
  const res = await fetchFn('/api/photo/read', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ familyId: body.familyId, kind: body.kind, mimeType: body.mimeType, imageBase64: body.imageBase64, thumbnail: body.thumbnail }),
  });
  const json = (await res.json().catch(() => ({}))) as PhotoReadResponse & { error?: string };
  if (!res.ok) throw new Error(json.error || 'Could not read that photo. Please try again.');
  return json;
}

export interface LockerItem {
  id?: number | null; photoId?: number | null; thumbnail?: string | null;
  productName: string; brand?: string | null; modelNumber?: string | null; upc?: string | null;
  source?: string; recall?: RecallInfo | null;
}
export interface LockerReceipt {
  photoId: number | string; kind: 'receipt'; store?: string | null; purchasedOn?: string | null; itemCount: number; thumbnail?: string | null;
  items?: { productName: string; priceCents?: number | null }[];
}
export interface Locker { items: LockerItem[]; receipts: LockerReceipt[] }

/** The family's Gear Locker (gear items and receipts). */
export async function fetchLocker(familyId: string, fetchFn: typeof fetch = fetch): Promise<Locker> {
  const res = await fetchFn(`/api/families/${encodeURIComponent(familyId)}/gear`);
  if (!res.ok) throw new Error('Could not open your gear locker. Please try again.');
  const json = (await res.json().catch(() => ({}))) as Partial<Locker>;
  return { items: Array.isArray(json.items) ? json.items : [], receipts: Array.isArray(json.receipts) ? json.receipts : [] };
}

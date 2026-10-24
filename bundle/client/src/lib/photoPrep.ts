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
}

export const browserCodec: PhotoCodec = {
  async decode(file) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { width: bmp.width, height: bmp.height, source: bmp };
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

export interface PreparedPhoto { mimeType: 'image/jpeg'; imageBase64: string }

export async function preparePhoto(file: File, codec: PhotoCodec = browserCodec): Promise<PreparedPhoto> {
  try {
    const decoded = await codec.decode(file);
    const { width, height } = fitWithin(decoded.width, decoded.height);
    const imageBase64 = await codec.redrawAsJpeg(decoded.source, width, height, file);
    return { mimeType: 'image/jpeg', imageBase64 };
  } catch {
    throw new Error('We could not open that photo. Please try another one.');
  }
}

export type PhotoReadResponse =
  | { status: 'ok'; rounds?: number; items: Record<string, unknown>[] }
  | { status: 'needs_clearer_photo' | 'rejected' | 'unavailable'; message: string };

export async function sendPhoto(
  body: { familyId: string; kind: 'item' | 'receipt'; mimeType: string; imageBase64: string },
  fetchFn: typeof fetch = fetch,
): Promise<PhotoReadResponse> {
  const res = await fetchFn('/api/photo/read', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ familyId: body.familyId, kind: body.kind, mimeType: body.mimeType, imageBase64: body.imageBase64 }),
  });
  const json = (await res.json().catch(() => ({}))) as PhotoReadResponse & { error?: string };
  if (!res.ok) throw new Error(json.error || 'Could not read that photo. Please try again.');
  return json;
}

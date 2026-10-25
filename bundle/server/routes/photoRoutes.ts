// Photo intake routes. The photo arrives as base64 inside a small JSON body, is read in memory and never saved.
//   POST /api/photo/read    { familyId, kind: 'item' | 'receipt', mimeType, imageBase64, thumbnail? }  -> reading result + recall check
//   POST /api/photo/forget  { familyId }                                                    -> { deleted }  (items AND saved photos)
//   GET  /api/families/:familyId/gear                                                       -> the Gear Locker { items, receipts }
import crypto from 'node:crypto';
import express, { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { TraceLogger } from '../agents/trace';
import { createGenerator, isLiveModel, UnavailableGenerator } from '../adapters/llm';
import {
  MAX_PHOTO_BYTES, NO_MODEL_MESSAGE, defaultVisionCacheDir, forgetItems, getSharedPhotoStore, readPhoto,
  type PhotoDeps, type PhotoKind, type PhotoStore, type ReadItem,
} from '../ingest/photo';
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
}

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
  const recall: RecallResult = await checkItemRecall({ productName: i.productName, brand: i.brand, modelNumber: i.modelNumber, upc: i.upc }, today, z);
  return {
    productName: i.productName, brand: i.brand, modelNumber: i.modelNumber, lotCode: i.lotCode,
    upc: i.upc, sizeText: i.sizeText, store: i.store, purchasedOn: i.purchasedOn,
    priceCents: i.priceCents, quantity: i.quantity,
    recall,
    ...(kind === 'receipt' ? moneyBackFor(i.productName) : {}),
  };
}
// base64 is about a third bigger than the picture it carries.
const JSON_LIMIT = `${Math.ceil((MAX_PHOTO_BYTES * 4) / 3 / 1024 / 1024) + 1}mb`;

export function createPhotoRouter(api: PhotoApiDeps = createDefaultPhotoDeps()): Router {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: api.limit ?? 30, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many photos from this connection. Please try again in a few minutes.' },
  });
  const json = express.json({ limit: JSON_LIMIT });

  router.post('/api/photo/read', limiter, json, async (req: Request, res: Response) => {
    const { familyId, kind, mimeType, imageBase64, thumbnail } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof familyId !== 'string' || !FAMILY_ID.test(familyId)) return res.status(400).json({ error: 'familyId is required.' });
    if (typeof kind !== 'string' || !KINDS.includes(kind as PhotoKind)) return res.status(400).json({ error: "kind must be 'item' or 'receipt'." });
    if (typeof mimeType !== 'string' || typeof imageBase64 !== 'string' || !imageBase64) return res.status(400).json({ error: 'mimeType and imageBase64 are required.' });
    const bytes = Buffer.from(imageBase64, 'base64');
    if (bytes.length > MAX_PHOTO_BYTES) return res.status(413).json({ error: 'That photo is too big. Please send one under 5 MB.' });
    try {
      const out = await readPhoto({ familyId, kind: kind as PhotoKind, mimeType, bytes, thumbnail: typeof thumbnail === 'string' ? thumbnail : undefined }, api.makeDeps());
      if (out.status === 'invalid') return res.status(400).json({ status: out.status, error: out.message });
      if (out.status === 'needs_clearer_photo' && kind === 'item') return res.json({ status: out.status, message: NO_MODEL_MESSAGE });
      if (out.status !== 'ok') return res.json({ status: out.status, message: out.message });
      const today = checkDate(api, familyId);
      const z = api.recallRunner ? api.recallRunner() : null;
      // The recall check (and, for a receipt, the money-back check) runs here, straight from the photo, for every family.
      const items = await Promise.all(out.items.map((i) => describeItem(i, kind as PhotoKind, today, z)));
      // Gear (not receipts) is written into Bundle's memory for this family, so the Account tab can show it.
      if (kind === 'item') for (const i of out.items) { try { if (i.productName) api.rememberGear?.(familyId, `Has: ${i.productName}`); } catch { /* memory is a bonus, never a blocker */ } }
      // Parent-safe: product facts only (no hashes, no model details, no read text).
      return res.json({
        status: 'ok',
        kind,
        rounds: out.rounds,
        stored: out.stored,
        sample: out.sample,
        photoId: out.photoId,
        thumbnail: out.thumbnail,
        store: out.items[0]?.store ?? null,
        purchasedOn: out.items[0]?.purchasedOn ?? null,
        items,
      });
    } catch {
      return res.status(500).json({ error: 'Could not read that photo. Please try again.' });
    }
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
        const item = { productName: r.productName, brand: r.brand ?? null, modelNumber: r.modelNumber ?? null, upc: r.upc ?? null };
        // Car seats are checked against NHTSA's local file every time the locker opens; other gear shows no recall line here.
        const recall = isCarSeat(item) ? { ...checkCarSeat(item, today), ...regLink(r.brand) } : null;
        return { id: r.id ?? null, photoId: r.photoId ?? null, thumbnail: thumb, ...item, source: r.source, recall };
      });
      const receipts = photos.filter((p) => p.kind === 'receipt').map((p) => {
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

// Photo intake routes. The photo arrives as base64 inside a small JSON body, is read in memory and never saved.
//   POST /api/photo/read    { familyId, kind: 'item' | 'receipt', mimeType, imageBase64 }  -> reading result
//   POST /api/photo/forget  { familyId }                                                    -> { deleted }
import crypto from 'node:crypto';
import express, { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { TraceLogger } from '../agents/trace';
import { createGenerator, isLiveModel, UnavailableGenerator } from '../adapters/llm';
import {
  MAX_PHOTO_BYTES, createDbPhotoStore, createMemoryPhotoStore, defaultVisionCacheDir, forgetItems, readPhoto,
  type PhotoDeps, type PhotoKind, type PhotoStore,
} from '../ingest/photo';

export interface PhotoApiDeps {
  /** Fresh dependencies for one photo (model, store, trace, saved answers). Tests inject fakes. */
  makeDeps: () => PhotoDeps;
  /** Photos one visitor may send per 15 minutes (default 30). Tests lower it. */
  limit?: number;
}

/** One shared store: Neon when a database is set, otherwise memory (SAMPLE_MODE and local tries). */
let sharedStore: PhotoStore | undefined;
const defaultStore = (): PhotoStore => (sharedStore ??= process.env.DATABASE_URL && process.env.SAMPLE_MODE !== 'true' ? createDbPhotoStore() : createMemoryPhotoStore());

export function createDefaultPhotoDeps(): PhotoApiDeps {
  return {
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
    const { familyId, kind, mimeType, imageBase64 } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof familyId !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(familyId)) return res.status(400).json({ error: 'familyId is required.' });
    if (typeof kind !== 'string' || !KINDS.includes(kind as PhotoKind)) return res.status(400).json({ error: "kind must be 'item' or 'receipt'." });
    if (typeof mimeType !== 'string' || typeof imageBase64 !== 'string' || !imageBase64) return res.status(400).json({ error: 'mimeType and imageBase64 are required.' });
    const bytes = Buffer.from(imageBase64, 'base64');
    if (bytes.length > MAX_PHOTO_BYTES) return res.status(413).json({ error: 'That photo is too big. Please send one under 5 MB.' });
    try {
      const out = await readPhoto({ familyId, kind: kind as PhotoKind, mimeType, bytes }, api.makeDeps());
      if (out.status === 'invalid') return res.status(400).json({ status: out.status, error: out.message });
      if (out.status !== 'ok') return res.json({ status: out.status, message: out.message });
      // Parent-safe: product facts only (no hashes, no model details, no read text).
      return res.json({
        status: 'ok',
        rounds: out.rounds,
        stored: out.stored,
        items: out.items.map((i) => ({
          productName: i.productName, brand: i.brand, modelNumber: i.modelNumber, lotCode: i.lotCode,
          upc: i.upc, sizeText: i.sizeText, store: i.store, purchasedOn: i.purchasedOn,
          priceCents: i.priceCents, quantity: i.quantity,
        })),
      });
    } catch {
      return res.status(500).json({ error: 'Could not read that photo. Please try again.' });
    }
  });

  router.post('/api/photo/forget', limiter, json, async (req: Request, res: Response) => {
    const { familyId } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof familyId !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(familyId)) return res.status(400).json({ error: 'familyId is required.' });
    try {
      return res.json({ deleted: await forgetItems(familyId, api.makeDeps().store) });
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

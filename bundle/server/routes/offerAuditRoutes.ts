/**
 * GET /api/offer-audit: the public "data product" (plan section 1). Per-brand totals of how many offers the agents
 * checked and how many hid a catch, read through the Zetaris view v_offer_audit.
 *
 * Safe by construction:
 *  - It asks Zetaris one fixed question (offerAuditSql, reused unchanged from savedVerdicts.ts, so sample mode can
 *    replay the answer recorded with `npm run zetaris:record`). The only thing a visitor can vary is the brand name,
 *    which must be plain text and goes through the same quoting as the saved question.
 *  - The view has no family columns, and every response field is copied one by one below, so nothing else
 *    (family data, rule text, SQL, reviewer-only fields, error text) can reach the public by accident.
 *  - Rate limited. Read only.
 * With no saved answer (sample mode before a recording, or Zetaris down) it says so honestly (503); it never invents rows.
 */
import path from 'path';
import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { offerAuditSql } from '../agents/savedVerdicts';
import { col } from '../agents/sql';
import { ZetarisClient, type QueryResult } from '../adapters/zetaris';

/** The only fields a brand row may carry. */
export const BRAND_FIELDS = ['store', 'offersChecked', 'offersCaught', 'catchRate', 'avgFaceValueCents', 'avgTrueValueCents', 'avgEffortMinutes'] as const;

export interface BrandAudit {
  store: string;
  offersChecked: number | null;
  offersCaught: number | null;
  /** 0 to 1: the share of this brand's checked offers that hid a catch. */
  catchRate: number | null;
  avgFaceValueCents: number | null;
  avgTrueValueCents: number | null;
  avgEffortMinutes: number | null;
}

export interface OfferAuditResponse {
  status: 'found' | 'none' | 'unavailable';
  brands: BrandAudit[];
  message?: string;
}

type Asker = { runQuery(sql: string): Promise<Pick<QueryResult, 'rows'>> };

export interface OfferAuditDeps {
  /** A Zetaris client (or a fake in tests), made fresh per request so settings are read at call time. */
  zetaris: () => Asker;
  limit?: { limit: number; windowMs: number };
}

const WINDOW_MS = 10 * 60 * 1000;
const num = (v: unknown): number | null => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

function toBrand(r: Record<string, string | number | null>): BrandAudit {
  const store = col(r, 'store');
  return {
    store: store === null || store === undefined ? '' : String(store),
    offersChecked: num(col(r, 'offers_checked')), offersCaught: num(col(r, 'offers_caught')), catchRate: num(col(r, 'catch_rate')),
    avgFaceValueCents: num(col(r, 'avg_face_value_cents')), avgTrueValueCents: num(col(r, 'avg_true_value_cents')),
    avgEffortMinutes: num(col(r, 'avg_effort_minutes')),
  };
}

/** Real Zetaris in live mode; in SAMPLE_MODE only saved answers from data/sample/zetaris-cache (never a network call). */
export function createDefaultOfferAuditDeps(): OfferAuditDeps {
  return {
    zetaris: () => {
      const sample = process.env.SAMPLE_MODE === 'true';
      const missing = ['ZETARIS_BASE_URL', 'ZETARIS_ORG_ID', 'ZETARIS_API_KEY'].filter((k) => !process.env[k]);
      if (missing.length && !sample) throw new Error('Zetaris is not set up');
      return new ZetarisClient({
        baseUrl: process.env.ZETARIS_BASE_URL || 'http://sample-mode.invalid', orgId: process.env.ZETARIS_ORG_ID || 'sample',
        apiKey: process.env.ZETARIS_API_KEY || 'sample', sampleMode: sample,
        timeoutMs: (Number(process.env.SOURCE_TIMEOUT_SECONDS) || 20) * 1000 * 4,
        cacheDir: path.resolve('data/sample/zetaris-cache'), traceCaller: 'offer_audit',
      });
    },
  };
}

export function createOfferAuditRouter(deps: OfferAuditDeps = createDefaultOfferAuditDeps()): Router {
  const router = Router();
  const limiter = rateLimit({
    windowMs: deps.limit?.windowMs ?? WINDOW_MS, limit: deps.limit?.limit ?? 60,
    standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many requests from this address. Please try again in a few minutes.' },
  });

  router.get('/api/offer-audit', limiter, async (req: Request, res: Response) => {
    const raw = req.query.store;
    let sql: string;
    try {
      if (raw !== undefined && typeof raw !== 'string') throw new Error('one store only');
      sql = offerAuditSql(raw);
    } catch {
      return res.status(400).json({ error: 'The store name must be 1 to 80 plain characters (letters, numbers, spaces and . , & \' -).' });
    }
    res.set('Cache-Control', 'public, max-age=60');
    try {
      const { rows } = await deps.zetaris().runQuery(sql);
      const brands = rows.map(toBrand);
      const body: OfferAuditResponse = brands.length
        ? { status: 'found', brands }
        : { status: 'none', brands: [], message: 'No offer grades have been saved yet.' };
      return res.json(body);
    } catch {
      // Never echo the underlying error: it can name internal views or hosts.
      const body: OfferAuditResponse = { status: 'unavailable', brands: [], message: 'The offer audit is not available right now.' };
      res.set('Cache-Control', 'no-store');
      return res.status(503).json(body);
    }
  });

  return router;
}

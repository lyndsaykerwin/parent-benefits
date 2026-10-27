// Deals routes (Story 5, plans/v2-build-plan.md Lane D).
//   GET  /api/offer-search        live search of the trusted baby-offer sites, each result graded by the court (quiet failure);
//                                 confident grades are saved to the shared list, once per page and fine print
//   POST /api/offers/audit        "Audit a deal": a parent's offer through the court, saved only when it is confident (R2)
//   GET  /api/offers/report-card  the brand totals from /api/offer-audit, plus how much of it came from parents
import express, { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import type { Generator } from '../adapters/llm';
import type { BundleMemory } from '../adapters/memory';
import { offerAuditBySourceSql, offerAuditSql } from '../agents/savedVerdicts';
import { col } from '../agents/sql';
import { auditDeal, cleanAuditRequest } from '../offers/dealAudit';
import { defaultAuditStore, type AuditStore } from '../offers/auditStore';
import { LiveSearchUnavailable, createLiveSearchCache, runLiveSearch, tavilyKey, type SearchClient } from '../offers/liveSearch';
import type { LiveSearchReply, ReportCardReply } from '../../shared/offers';
import { createDefaultOfferAuditDeps, toBrand, type Asker } from './offerAuditRoutes';

export interface OfferApiDeps {
  llm: Generator;
  memory: BundleMemory;
  store?: AuditStore;
  /** Fresh Zetaris client per request (same as /api/offer-audit). */
  zetaris?: () => Asker;
  /** Reads settings at call time. Tests inject these. */
  env?: () => NodeJS.ProcessEnv;
  searchClient?: SearchClient;
  /** ISO date for "found today" and for the court's date maths. */
  today?: () => string;
  limits?: { search?: number; audit?: number; report?: number };
  logsDir?: string;
  /** Start the live search as soon as the server starts (real mode with a key only), so Deals finds a ready answer. The app turns it on. */
  prewarm?: boolean;
}

// Screenshots arrive as base64 inside the JSON body: about a third bigger than the picture (up to 5 MB).
const AUDIT_JSON_LIMIT = '8mb';
const realToday = () => new Date().toISOString().slice(0, 10);

export function createOfferRouter(deps: OfferApiDeps): Router {
  const router = Router();
  const store = deps.store ?? defaultAuditStore();
  const env = deps.env ?? (() => process.env);
  const today = deps.today ?? realToday;
  const zetaris = deps.zetaris ?? createDefaultOfferAuditDeps().zetaris;
  const limiter = (limit: number, windowMs: number, message: string) =>
    rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, message: { error: message } });

  // ---- live search: one cached search shared by everyone, so opening Deals does not spend a credit each time ----
  const searches = createLiveSearchCache(() => runLiveSearch({
    llm: deps.llm, memory: deps.memory, today: today(), apiKey: tavilyKey(env()), client: deps.searchClient, logsDir: deps.logsDir, store,
  }));
  // The search plus its checks takes longer than the screen waits (about 13 seconds against 9), so the app starts it at once.
  if (deps.prewarm && env().SAMPLE_MODE !== 'true' && (deps.searchClient || tavilyKey(env()))) {
    searches.get(today()).catch(() => undefined); // a failure here is quiet; a later visit simply tries again
  }
  /** How long the screen is made to wait; it gives up on its own at 10 seconds, so we answer a little sooner. */
  const WAIT_MS = 9000;

  router.get('/api/offer-search', limiter(deps.limits?.search ?? 30, 10 * 60 * 1000, 'Too many searches from this address. Please try again in a few minutes.'), async (_req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    // Practice mode skips the search on purpose (no key, no internet needed).
    if (env().SAMPLE_MODE === 'true') return res.json({ mode: 'practice' } satisfies LiveSearchReply);
    if (!deps.searchClient && !tavilyKey(env())) return res.status(503).json({ mode: 'unavailable' });
    try {
      const reply = await Promise.race([
        searches.get(today()),
        new Promise<never>((_, reject) => setTimeout(() => reject(new LiveSearchUnavailable('failed')), WAIT_MS).unref?.()),
      ]);
      return res.json(reply satisfies LiveSearchReply);
    } catch {
      // Never echo the reason: it can name a service. The search keeps running in the background and the next visit gets its answer.
      return res.status(503).json({ mode: 'unavailable' });
    }
  });

  // ---- audit a deal ----
  const auditJson = express.json({ limit: AUDIT_JSON_LIMIT });
  router.post('/api/offers/audit', limiter(deps.limits?.audit ?? 10, 15 * 60 * 1000, 'You have checked a lot of deals. Please try again in a few minutes.'), auditJson, async (req: Request, res: Response) => {
    const cleaned = cleanAuditRequest(req.body);
    if (!cleaned.ok) return res.status(400).json({ error: cleaned.message });
    try {
      // FinePrintCourt grades live. A high-confidence agreed grade is saved to offer_checks with source 'user_audit'
      // (see auditDeal), which feeds /api/offer-audit brand totals.
      const out = await auditDeal(cleaned.req, { llm: deps.llm, memory: deps.memory, store, today: today(), logsDir: deps.logsDir });
      if (!out.ok) return res.status(out.status).json({ error: out.message });
      return res.json(out.reply);
    } catch {
      return res.status(500).json({ error: 'We could not check that deal just now. Please try again.' });
    }
  });

  // ---- report card ----
  router.get('/api/offers/report-card', limiter(deps.limits?.report ?? 60, 10 * 60 * 1000, 'Too many requests from this address. Please try again in a few minutes.'), async (_req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    const fromParentsByStore = new Map<string, number>();
    let parentTotal = 0;
    let parentsKnown = false;
    let z: Asker | null = null;
    try { z = zetaris(); } catch { z = null; }
    if (z) {
      try {
        const { rows } = await z.runQuery(offerAuditBySourceSql());
        for (const r of rows) {
          if (String(col(r, 'source')) !== 'user_audit') continue;
          const n = Number(col(r, 'offers_checked')) || 0;
          fromParentsByStore.set(String(col(r, 'store') ?? ''), n); parentTotal += n;
        }
        parentsKnown = true;
      } catch { /* the by-source view may not be registered yet: fall back to our own copy below */ }
    }
    if (!parentsKnown) {
      try { const s = await store.parentStats(); parentTotal = s.total; for (const [k, v] of Object.entries(s.byStore)) fromParentsByStore.set(k, v); } catch { /* none to show */ }
    }

    let brands: ReportCardReply['brands'] = [];
    let zetarisAnswered = false;
    if (z) {
      try {
        const { rows } = await z.runQuery(offerAuditSql());
        zetarisAnswered = true;
        brands = rows.map(toBrand).map((b) => ({ store: b.store, offersChecked: b.offersChecked, offersCaught: b.offersCaught, fromParents: fromParentsByStore.get(b.store) ?? 0 }));
      } catch { /* quiet: the card is simply not shown */ }
    }
    // No Zetaris grades yet (practice mode, or an empty database): the parents' own audits still count, per store.
    if (!brands.length && fromParentsByStore.size) {
      brands = [...fromParentsByStore].map(([store, n]) => ({ store, offersChecked: n, offersCaught: null, fromParents: n }));
    }
    const body: ReportCardReply = brands.length
      ? { status: 'found', brands, fromParents: parentTotal }
      : { status: zetarisAnswered ? 'none' : 'unavailable', brands: [], fromParents: parentTotal, message: 'No offer grades have been saved yet.' };
    return res.json(body);
  });

  // A body past the limit (or broken JSON) gets a plain answer instead of a stack trace.
  router.use((err: { type?: string }, _req: Request, res: Response, next: NextFunction) => {
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'That screenshot is too big. Please use one under 5 MB, or paste the text.' });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad request.' });
    return next(err);
  });

  return router;
}

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import type { BundleResult, Family } from '../../shared/bundle';
import type { Generator } from '../adapters/llm';
import type { BundleMemory } from '../adapters/memory';
import { runBundle, newRunId, type RunDeps } from '../agents/orchestrator';
import { proposeRules, MAX_ISSUES } from '../agents/coach';
import type { BundleStore } from '../bundleStore';
import type { TraceLine } from '../agents/trace';

export const SEED_FAMILY_IDS = ['maya', 'leo', 'ava'] as const;
export const ZIP_ERROR = 'Enter a valid US ZIP code';
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REGISTRY = 200;

export interface ApiDeps {
  /** Fresh clients for one run (Zetaris, model, memory). Tests inject fakes here. */
  makeRunDeps: () => Omit<RunDeps, 'loadFamily' | 'runId'>;
  loadSeedFamily: (id: string) => Promise<Family>;
  store: BundleStore;
  memory: Pick<BundleMemory, 'addRule'>;
  llm: Generator;
  /** Reviewer-mode token (env REVIEWER_MODE_TOKEN). Empty means Reviewer mode is off. */
  reviewerToken: () => string;
  runLimit?: { limit: number; windowMs: number };
  /** Runs allowed at the same time across all visitors (default 5). */
  maxInFlight?: number;
  /** Where Task 13's eval writes its scoreboard (default logs/scoreboard.json). */
  scoreboardFile?: () => string;
}

/** Display-only family fields the UI needs (header chip, day count). Never income. */
type FamilyView = { name: string; birthDate: string | null; dueDate: string | null };
type RunEntry = { runId: string; familyId: string; status: 'running' | 'done' | 'failed'; startedAt: string; result?: BundleResult; error?: string; logsDir: string; family: FamilyView; today: string };

const isIsoDate = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

function tokenOk(supplied: unknown, expected: string): boolean {
  if (!expected || typeof supplied !== 'string' || !supplied) return false;
  const a = crypto.createHash('sha256').update(supplied).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function createBundleRouter(deps: ApiDeps): Router {
  const router = Router();
  const runs = new Map<string, RunEntry>();
  let inFlight = 0;
  const maxInFlight = deps.maxInFlight ?? 5;
  const knownFamilies = new Set<string>(SEED_FAMILY_IDS);

  const runLimiter = rateLimit({
    windowMs: deps.runLimit?.windowMs ?? WINDOW_MS, limit: deps.runLimit?.limit ?? 10,
    standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many runs from this address. Please try again in a few minutes.' },
  });
  const feedbackLimiter = rateLimit({
    windowMs: WINDOW_MS, limit: 30, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too much feedback from this address. Please try again in a few minutes.' },
  });

  /** Seed family id, or a new unsaved family built from the form. Returns an error message instead when invalid. */
  async function resolveFamily(body: any): Promise<{ family?: Family; error?: string }> {
    if (typeof body?.familyId === 'string') {
      if (!(SEED_FAMILY_IDS as readonly string[]).includes(body.familyId)) return { error: 'Choose a sample family, or enter your details.' };
      return { family: await deps.loadSeedFamily(body.familyId) };
    }
    const zip = body?.zip;
    if (typeof zip !== 'string' || !/^\d{5}$/.test(zip)) return { error: ZIP_ERROR };
    const state = await deps.store.zipState(zip.slice(0, 3));
    if (!state || state === 'US') return { error: ZIP_ERROR }; // seed table's '000'/'US' row is its unknown-prefix default
    const hasBirth = body.birthDate !== undefined && body.birthDate !== null && body.birthDate !== '';
    const hasDue = body.dueDate !== undefined && body.dueDate !== null && body.dueDate !== '';
    if (hasBirth === hasDue) return { error: 'Enter either a birth date or a due date.' };
    if (hasBirth && !isIsoDate(body.birthDate)) return { error: 'Enter the birth date as YYYY-MM-DD.' };
    if (hasDue && !isIsoDate(body.dueDate)) return { error: 'Enter the due date as YYYY-MM-DD.' };
    const employer = typeof body.employer === 'string' ? body.employer.trim().slice(0, 100) : '';
    return {
      family: {
        id: `guest-${crypto.randomBytes(4).toString('hex')}`, userId: null, isGuest: true, name: 'Guest',
        birthDate: hasBirth ? body.birthDate : null, dueDate: hasDue ? body.dueDate : null,
        zip, state, employer, householdSize: 3, annualIncomeCents: null, dcfsaOffered: true, dataConnected: false,
      },
    };
  }

  function startRun(family: Family): { entry: RunEntry; done: Promise<void> } {
    const base = deps.makeRunDeps();
    const runId = newRunId(family.id);
    knownFamilies.add(family.id);
    const entry: RunEntry = {
      runId, familyId: family.id, status: 'running', startedAt: new Date().toISOString(), logsDir: base.logsDir,
      family: { name: family.name, birthDate: family.birthDate, dueDate: family.dueDate }, today: base.today,
    };
    runs.set(runId, entry);
    while (runs.size > MAX_REGISTRY) runs.delete(runs.keys().next().value as string);
    inFlight++;
    const done = runBundle(family.id, { ...base, runId, loadFamily: async () => family })
      .then((result) => { entry.result = result; entry.status = 'done'; })
      .catch((e) => {
        entry.status = 'failed';
        entry.error = 'The run did not finish. Please try again.';
        console.error('Bundle run failed:', runId, (e as Error)?.message);
      })
      .finally(() => { inFlight--; });
    return { entry, done };
  }

  router.post('/api/run', runLimiter, async (req: Request, res: Response) => {
    try {
      const { family, error } = await resolveFamily(req.body);
      if (!family) return res.status(400).json({ error });
      if (inFlight >= maxInFlight) return res.status(503).json({ error: 'Bundle is busy right now. Please try again in a minute.' });
      const { entry, done } = startRun(family);
      if (req.query.wait === 'true') {
        await done;
        if (entry.status === 'done') return res.json(entry.result);
        return res.status(500).json({ error: entry.error, runId: entry.runId });
      }
      return res.status(202).json({ runId: entry.runId });
    } catch (e) {
      console.error('POST /api/run failed:', (e as Error)?.message);
      return res.status(500).json({ error: 'Could not start the run.' });
    }
  });

  router.get('/api/runs/:runId', (req, res) => {
    const e = runs.get(req.params.runId);
    if (!e) return res.status(404).json({ error: 'Run not found' });
    return res.json({ runId: e.runId, familyId: e.familyId, status: e.status, startedAt: e.startedAt, family: e.family, today: e.today, result: e.result ?? null, error: e.error ?? null });
  });

  router.get('/api/runs/:runId/trace', (req, res) => {
    const e = runs.get(req.params.runId);
    if (!e) return res.status(404).json({ error: 'Run not found' });
    const file = path.join(e.logsDir, `run-${e.runId.replace(/[^A-Za-z0-9_-]/g, '_')}.jsonl`);
    let lines: TraceLine[] = [];
    try {
      lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l) as TraceLine]; } catch { return []; } });
    } catch { /* no lines yet */ }
    return res.json(lines);
  });

  router.post('/api/feedback', feedbackLimiter, async (req, res) => {
    const { familyId, cardId, kind, note } = req.body ?? {};
    if (typeof familyId !== 'string' || !knownFamilies.has(familyId)) return res.status(400).json({ error: 'Unknown family' });
    if (typeof cardId !== 'string' || !cardId || cardId.length > 200) return res.status(400).json({ error: 'Missing card' });
    if (kind !== 'got_it' && kind !== 'issue') return res.status(400).json({ error: 'kind must be got_it or issue' });
    if (note !== undefined && typeof note !== 'string') return res.status(400).json({ error: 'note must be text' });
    try {
      const saved = await deps.store.addFeedback({ familyId, cardId, kind, note: (note ?? '').slice(0, 500) });
      let proposals: unknown[] = [];
      try {
        const existing = await deps.store.listProposals();
        const covered = new Set(existing.flatMap((p) => p.sourceFeedbackIds));
        const fresh = (await deps.store.listRecentIssues(MAX_ISSUES)).filter((r) => !covered.has(String(r.id)));
        proposals = await deps.store.saveProposals(await proposeRules(fresh, deps.llm));
      } catch (e) {
        console.error('Coach failed:', (e as Error)?.message); // feedback is saved either way
      }
      return res.json({ ok: true, feedbackId: saved.id, proposals });
    } catch (e) {
      console.error('POST /api/feedback failed:', (e as Error)?.message);
      return res.status(500).json({ error: 'Could not save feedback.' });
    }
  });

  router.get('/api/scoreboard', (_req, res) => {
    const file = deps.scoreboardFile?.() ?? path.resolve('logs', 'scoreboard.json');
    try {
      return res.json({ scoreboard: JSON.parse(fs.readFileSync(file, 'utf8')) });
    } catch {
      return res.json({ scoreboard: null }); // no eval has run yet (or the file is unreadable)
    }
  });

  router.get('/api/case-law', async (_req, res) => {
    try {
      const all = await deps.store.listProposals();
      return res.json({ proposals: all.filter((p) => p.status === 'proposed'), approved: all.filter((p) => p.status === 'approved') });
    } catch (e) {
      console.error('GET /api/case-law failed:', (e as Error)?.message);
      return res.status(500).json({ error: 'Could not load case law.' });
    }
  });

  router.post('/api/case-law/:id/approve', async (req, res) => {
    if (!tokenOk(req.header('x-reviewer-token'), deps.reviewerToken())) {
      return res.status(403).json({ error: 'Reviewer mode is required to approve a rule.' });
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).json({ error: 'Proposal not found' });
    try {
      const p = await deps.store.getProposal(id);
      if (!p) return res.status(404).json({ error: 'Proposal not found' });
      if (p.status === 'approved') return res.json({ ok: true, memoryId: p.memoryId, alreadyApproved: true });
      const memoryId = deps.memory.addRule(p.text, `case_law:${p.id}`, p.confidence, p.sourceFeedbackIds);
      await deps.store.markApproved(p.id, memoryId);
      return res.json({ ok: true, memoryId });
    } catch (e) {
      console.error('approve failed:', (e as Error)?.message);
      return res.status(500).json({ error: 'Could not approve the rule.' });
    }
  });

  return router;
}

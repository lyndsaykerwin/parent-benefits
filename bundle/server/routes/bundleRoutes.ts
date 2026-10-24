import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import type { BundleResult, Family, FeedCard } from '../../shared/bundle';
import type { Generator } from '../adapters/llm';
import type { BundleMemory } from '../adapters/memory';
import { runBundle, newRunId, type RunDeps } from '../agents/orchestrator';
import { proposeRules, MAX_ISSUES } from '../agents/coach';
import type { BundleStore } from '../bundleStore';
import type { TraceLine } from '../agents/trace';

import { SEED_FAMILY_IDS, isSeedFamily } from '../demoDate';
import { dateRangeError } from '../../shared/dateRange';
export { SEED_FAMILY_IDS };
export const ZIP_ERROR = 'Enter a valid US ZIP code';
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REGISTRY = 200;

export interface ApiDeps {
  /** Fresh clients for one run (Zetaris, model, memory). Tests inject fakes here. */
  makeRunDeps: (family: Family) => Omit<RunDeps, 'loadFamily' | 'runId'>;
  loadSeedFamily: (id: string) => Promise<Family>;
  store: BundleStore;
  memory: Pick<BundleMemory, 'addRule'>;
  llm: Generator;
  /** Reviewer-mode token (env REVIEWER_MODE_TOKEN). Empty means Reviewer mode is off. */
  reviewerToken: () => string;
  runLimit?: { limit: number; windowMs: number };
  /** Runs allowed at the same time across all visitors (default 5). */
  maxInFlight?: number;
  /** Runs one visitor (IP address) may have going at the same time (default 2). */
  maxInFlightPerIp?: number;
  /** The current date, for the date-range checks (tests pin it). */
  now?: () => Date;
  /** Where Task 13's eval writes its scoreboard (default logs/scoreboard.json). */
  scoreboardFile?: () => string;
}

/** Display-only family fields the UI needs (header chip, day count). Never income. */
type FamilyView = { name: string; birthDate: string | null; dueDate: string | null };
type RunEntry = { runId: string; familyId: string; status: 'running' | 'done' | 'failed'; startedAt: string; result?: BundleResult; error?: string; logsDir: string; family: FamilyView; today: string; demoDate: boolean };

const isIsoDate = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

function tokenOk(supplied: unknown, expected: string): boolean {
  if (!expected || typeof supplied !== 'string' || !supplied) return false;
  const a = crypto.createHash('sha256').update(supplied).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

// ---------- owner view split (plan section 4 / section 6 item 1) ----------
// Parents get a trimmed result, built here on the server, so nothing owner-only can leak through the API:
// no trace ids, agent names, SQL, debate text or memory-rule text. The reviewer token unlocks the full result.

const PARENT_CARD_KEYS = ['id', 'kind', 'title', 'body', 'amountCents', 'deadline', 'verdict', 'sources'] as const;
type ParentCard = Pick<FeedCard, (typeof PARENT_CARD_KEYS)[number]>;
export const CAUGHT_BY_PARENT_REPORTS = 'Other parents reported a catch like this one, so we left it out.';
const CAUGHT_GENERIC = 'We found a catch in the fine print, so we left it out.';
const OWNER_ONLY_TEXT = /zetaris|\bv_[a-z_]+\b|\bselect\b|\bcited\b|case law|court|memory|mem-[\w-]+/i;

/** One plain sentence for a caught offer. A memory rule's own text and the court's argument stay owner-only. */
export function parentCaughtReason(body: string): string {
  if (/case law applies/i.test(body) || /\[cited [^\]]+\]/i.test(body)) return CAUGHT_BY_PARENT_REPORTS;
  const one = body.replace(/^Court was offline;\s*/i, '').trim();
  const first = (one.split(/(?<=[.!?])\s/)[0] ?? '').trim();
  if (!first || OWNER_ONLY_TEXT.test(first)) return CAUGHT_GENERIC;
  const text = first.charAt(0).toUpperCase() + first.slice(1);
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

function parentCard(c: FeedCard, caught = false): ParentCard {
  const out = {} as Record<string, unknown>;
  for (const k of PARENT_CARD_KEYS) out[k] = (c as unknown as Record<string, unknown>)[k];
  out.sources = (c.sources ?? []).map((s) => ({ label: s.label, url: s.url }));
  if (caught) out.body = parentCaughtReason(c.body);
  return out as ParentCard;
}

/** The parent-safe copy of a run result. */
export function parentResult(r: BundleResult): BundleResult {
  return {
    familyId: r.familyId, runId: r.runId, receipt: r.receipt, banner: r.banner,
    cards: r.cards.map((c) => parentCard(c)) as FeedCard[],
    ...(r.blocked ? { blocked: r.blocked.map((c) => parentCard(c, true)) as FeedCard[] } : {}),
  };
}

/** The "Checking" screen's steps, in parent words (no agent names), and which trace line marks each one. */
export const PARENT_STEPS: { key: string; label: string; started: (l: TraceLine[]) => boolean; done: (l: TraceLine[]) => boolean }[] = [
  { key: 'money', label: 'Money you can get back', started: (l) => l.some((x) => x.agent_name === 'clawback'), done: (l) => l.some((x) => x.action === 'find_clawbacks') },
  { key: 'recalls', label: 'Your items vs. official recall lists', started: (l) => l.some((x) => x.agent_name === 'recall'), done: (l) => l.some((x) => x.action === 'check_recalls') },
  { key: 'benefits', label: 'Programs and deadlines for your family', started: (l) => l.some((x) => x.agent_name === 'benefits'), done: (l) => l.some((x) => x.action === 'plan_benefits') },
  { key: 'deals', label: 'Deals, read for hidden catches', started: (l) => l.some((x) => x.agent_name === 'fine_print_court'), done: (l) => l.some((x) => x.agent_name === 'fact_checker') },
  { key: 'double_check', label: 'Every card double-checked against its source', started: (l) => l.some((x) => x.agent_name === 'fact_checker'), done: (l) => l.some((x) => x.action === 'assemble') },
];
export type ParentStep = { key: string; label: string; state: 'waiting' | 'working' | 'done' };

function readTrace(e: RunEntry): TraceLine[] {
  const file = path.join(e.logsDir, `run-${e.runId.replace(/[^A-Za-z0-9_-]/g, '_')}.jsonl`);
  try {
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l) as TraceLine]; } catch { return []; } });
  } catch { return []; }
}

function progressFor(e: RunEntry): ParentStep[] {
  const lines = readTrace(e);
  return PARENT_STEPS.map((s) => ({
    key: s.key, label: s.label,
    state: e.status === 'done' || s.done(lines) ? 'done' : s.started(lines) ? 'working' : 'waiting',
  }));
}

export function createBundleRouter(deps: ApiDeps): Router {
  const router = Router();
  const runs = new Map<string, RunEntry>();
  let inFlight = 0;
  const maxInFlight = deps.maxInFlight ?? 5;
  const maxPerIp = deps.maxInFlightPerIp ?? 2;
  const inFlightByIp = new Map<string, number>();
  const knownFamilies = new Set<string>(SEED_FAMILY_IDS);
  const isOwner = (req: Request) => tokenOk(req.header('x-reviewer-token'), deps.reviewerToken());
  const view = (req: Request, r: BundleResult) => (isOwner(req) ? r : parentResult(r));

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
    const todayIso = (deps.now?.() ?? new Date()).toISOString().slice(0, 10);
    const rangeError = hasBirth ? dateRangeError('birth', body.birthDate, todayIso) : dateRangeError('due', body.dueDate, todayIso);
    if (rangeError) return { error: rangeError };
    const employer = typeof body.employer === 'string' ? body.employer.trim().slice(0, 100) : '';
    return {
      family: {
        id: `guest-${crypto.randomBytes(4).toString('hex')}`, userId: null, isGuest: true, name: 'Guest',
        birthDate: hasBirth ? body.birthDate : null, dueDate: hasDue ? body.dueDate : null,
        zip, state, employer, householdSize: 3, annualIncomeCents: null, dcfsaOffered: true, dataConnected: false,
      },
    };
  }

  function startRun(family: Family, ip: string): { entry: RunEntry; done: Promise<void> } {
    const base = deps.makeRunDeps(family);
    const runId = newRunId(family.id);
    knownFamilies.add(family.id);
    const entry: RunEntry = {
      runId, familyId: family.id, status: 'running', startedAt: new Date().toISOString(), logsDir: base.logsDir,
      family: { name: family.name, birthDate: family.birthDate, dueDate: family.dueDate }, today: base.today, demoDate: isSeedFamily(family.id),
    };
    runs.set(runId, entry);
    while (runs.size > MAX_REGISTRY) runs.delete(runs.keys().next().value as string);
    inFlight++;
    inFlightByIp.set(ip, (inFlightByIp.get(ip) ?? 0) + 1);
    const done = runBundle(family.id, { ...base, runId, loadFamily: async () => family })
      .then((result) => { entry.result = result; entry.status = 'done'; })
      .catch((e) => {
        entry.status = 'failed';
        entry.error = 'The run did not finish. Please try again.';
        console.error('Bundle run failed:', runId, (e as Error)?.message);
      })
      .finally(() => {
        inFlight--;
        const left = (inFlightByIp.get(ip) ?? 1) - 1;
        if (left > 0) inFlightByIp.set(ip, left); else inFlightByIp.delete(ip);
      });
    return { entry, done };
  }

  router.post('/api/run', runLimiter, async (req: Request, res: Response) => {
    try {
      const { family, error } = await resolveFamily(req.body);
      if (!family) return res.status(400).json({ error });
      if (inFlight >= maxInFlight) return res.status(503).json({ error: 'Bundle is busy right now. Please try again in a minute.' });
      const ip = req.ip ?? 'unknown';
      if ((inFlightByIp.get(ip) ?? 0) >= maxPerIp) return res.status(429).json({ error: `You already have ${maxPerIp} runs going. Please wait for one to finish.` });
      const { entry, done } = startRun(family, ip);
      if (req.query.wait === 'true') {
        await done;
        if (entry.status === 'done') return res.json(view(req, entry.result!));
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
    return res.json({
      runId: e.runId, familyId: e.familyId, status: e.status, startedAt: e.startedAt, family: e.family, today: e.today, demoDate: e.demoDate,
      result: e.result ? view(req, e.result) : null, error: e.error ?? null, progress: progressFor(e), owner: isOwner(req),
    });
  });

  router.get('/api/runs/:runId/trace', (req, res) => {
    const e = runs.get(req.params.runId);
    if (!e) return res.status(404).json({ error: 'Run not found' });
    if (!isOwner(req)) return res.status(403).json({ error: 'The audit log is for the reviewer only.' });
    return res.json(readTrace(e));
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
      if (!isOwner(req)) return res.json({ ok: true, feedbackId: saved.id, proposals: [], proposedCount: proposals.length }); // rule text is owner-only
      return res.json({ ok: true, feedbackId: saved.id, proposals, proposedCount: proposals.length });
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

  router.get('/api/case-law', async (req, res) => {
    try {
      const all = await deps.store.listProposals();
      const proposals = all.filter((p) => p.status === 'proposed');
      const approved = all.filter((p) => p.status === 'approved');
      if (!isOwner(req)) return res.json({ proposals: [], approved: [], proposedCount: proposals.length, approvedCount: approved.length });
      return res.json({ proposals, approved, proposedCount: proposals.length, approvedCount: approved.length });
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

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import type { BundleReceipt, BundleResult, Family, FeedCard, Household, InsuranceType, ValueScore, WorkStatus } from '../../shared/bundle';
import type { Generator } from '../adapters/llm';
import type { BundleMemory } from '../adapters/memory';
import { runBundle, newRunId, type RunDeps } from '../agents/orchestrator';
import { proposeRules, proposeFromDismissals, MAX_ISSUES } from '../agents/coach';
import type { BundleStore, SavedRunRow } from '../bundleStore';
import { agentTraceId } from '../../shared/agentLog';
import type { TraceLine } from '../agents/trace';

import { SEED_FAMILY_IDS, isSeedFamily } from '../demoDate';
import { dateRangeError } from '../../shared/dateRange';
import { isInlineFamily } from '../agents/sql';
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
type FamilyView = {
  name: string; birthDate: string | null; dueDate: string | null;
  state?: string; // optional because runs saved before this field existed lack it
  /** V2 onboarding answers (the checking screen and the Insurance tab read them). Absent on older runs, null when the parent chose not to say. */
  household?: Household | null; parent1Work?: WorkStatus | null; parent2Work?: WorkStatus | null; insurance?: InsuranceType | null;
  /** True when Bundle has saved purchases to check for this family (so the checking screen may show the recall line). */
  hasItems?: boolean;
};
type RunEntry = { runId: string; familyId: string; status: 'running' | 'done' | 'failed'; startedAt: string; result?: BundleResult; error?: string; logsDir: string; family: FamilyView; today: string; demoDate: boolean };

const HOUSEHOLDS: readonly string[] = ['one', 'two'];
const WORK: readonly string[] = ['paycheck', 'self_employed', 'not_working'];
const INSURANCE: readonly string[] = ['job', 'marketplace', 'medicaid', 'tricare', 'none_or_not_sure'];
const ANSWER_ERROR = 'Choose one of the listed answers.';

/** The display fields of a family that the screens need. Never income. */
export function familyView(f: Family): FamilyView {
  return {
    name: f.name, birthDate: f.birthDate, dueDate: f.dueDate, state: f.state,
    household: f.household ?? null, parent1Work: f.parent1Work ?? null, parent2Work: f.parent2Work ?? null, insurance: f.insurance ?? null,
    hasItems: !isInlineFamily(f) && f.dataConnected,
  };
}

/** The Q4 and Q5 answers from a request body. Each is optional ("prefer not to say" sends nothing); a value outside the lists is an error. */
function readAnswers(body: any): { answers?: Pick<Family, 'household' | 'parent1Work' | 'parent2Work' | 'insurance'>; error?: string } {
  const pick = <T extends string>(v: unknown, allowed: readonly string[]): T | null | undefined =>
    v === undefined || v === null || v === '' ? null : typeof v === 'string' && allowed.includes(v) ? (v as T) : undefined;
  const household = pick<Household>(body?.household, HOUSEHOLDS);
  const parent1Work = pick<WorkStatus>(body?.parent1Work, WORK);
  const parent2Work = pick<WorkStatus>(body?.parent2Work, WORK);
  const insurance = pick<InsuranceType>(body?.insurance, INSURANCE);
  if (household === undefined || parent1Work === undefined || parent2Work === undefined || insurance === undefined) return { error: ANSWER_ERROR };
  // Work answers only make sense with a household; a second parent only with "Two of us".
  if (!household) return { answers: { household: null, parent1Work: null, parent2Work: null, insurance } };
  return { answers: { household, parent1Work, parent2Work: household === 'two' ? parent2Work : null, insurance } };
}

const isIsoDate = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

export function tokenOk(supplied: unknown, expected: string): boolean {
  if (!expected || typeof supplied !== 'string' || !supplied) return false;
  const a = crypto.createHash('sha256').update(supplied).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

// ---------- owner view split (plan section 4 / section 6 item 1) ----------
// Parents get a trimmed result, built here on the server, so nothing owner-only can leak through the API:
// no trace ids, agent names, SQL, debate text or memory-rule text. The reviewer token unlocks the full result.

const PARENT_CARD_KEYS = ['id', 'kind', 'title', 'body', 'amountCents', 'deadline', 'verdict', 'sources'] as const;
type ParentCard = Pick<FeedCard, (typeof PARENT_CARD_KEYS)[number] | 'valueScore' | 'category' | 'minutes'>;
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

/** Value Score fields copied one by one (like the receipt), so a field added later never reaches parents by accident. */
function parentValueScore(v: ValueScore): ValueScore {
  return {
    trueValueCents: v.trueValueCents, effortLevel: v.effortLevel,
    effortMinutesEstimate: { min: v.effortMinutesEstimate.min, max: v.effortMinutesEstimate.max },
    stepsCount: v.stepsCount,
    payoutWaitDays: v.payoutWaitDays ? { min: v.payoutWaitDays.min, max: v.payoutWaitDays.max } : null,
    timeLabel: v.timeLabel, catchTypes: [...v.catchTypes], worthYourTime: v.worthYourTime, reasons: [...v.reasons],
  };
}

/** The parent-safe copy of one card (also used by the live-updates route). */
export function parentCard(c: FeedCard, caught = false): ParentCard {
  const out = {} as Record<string, unknown>;
  for (const k of PARENT_CARD_KEYS) out[k] = (c as unknown as Record<string, unknown>)[k];
  if (c.valueScore) out.valueScore = parentValueScore(c.valueScore);
  // The Home bucket and the minutes estimate are plain facts for the parent's screen (set only when the card has them).
  if (c.category) out.category = c.category;
  if (c.minutes !== undefined) out.minutes = c.minutes;
  out.sources = (c.sources ?? []).map((s) => ({ label: s.label, url: s.url }));
  out.body = caught ? parentCaughtReason(c.body) : c.body;
  return out as ParentCard;
}

/** Receipt fields copied one by one, so a field added later never reaches parents by accident. */
function parentReceipt(r: BundleReceipt): BundleReceipt {
  return {
    moneyBackCents: r.moneyBackCents, likelyBenefitsCents: r.likelyBenefitsCents,
    deadlineCount: r.deadlineCount, nextDeadline: r.nextDeadline, itemsChecked: r.itemsChecked,
  };
}

/** The parent-safe copy of a run result. */
export function parentResult(r: BundleResult): BundleResult {
  return {
    familyId: r.familyId, runId: r.runId, receipt: parentReceipt(r.receipt), banner: r.banner,
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

function savedRow(e: RunEntry, result: BundleResult): SavedRunRow {
  return {
    runId: e.runId, familyId: e.familyId, traceId: agentTraceId(e.runId), sampleMode: process.env.SAMPLE_MODE === 'true',
    result, family: e.family, today: e.today, demoDate: e.demoDate, startedAt: e.startedAt,
  };
}

/** A run read back from the results table (after a restart). Its trace file (if it is still on disk) is looked up in the default logs folder. */
function restoredEntry(r: SavedRunRow): RunEntry {
  return { runId: r.runId, familyId: r.familyId, status: 'done', startedAt: r.startedAt, result: r.result, logsDir: path.resolve('logs'), family: r.family, today: r.today, demoDate: r.demoDate };
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
    const { answers, error: answerError } = readAnswers(body);
    if (!answers) return { error: answerError };
    return {
      family: {
        id: `guest-${crypto.randomBytes(4).toString('hex')}`, userId: null, isGuest: true, name: 'Guest',
        birthDate: hasBirth ? body.birthDate : null, dueDate: hasDue ? body.dueDate : null,
        zip, state, employer, householdSize: answers.household === 'one' ? 2 : 3, annualIncomeCents: null, dcfsaOffered: true, dataConnected: false,
        ...answers,
      },
    };
  }

  function startRun(family: Family, ip: string): { entry: RunEntry; done: Promise<void> } {
    const base = deps.makeRunDeps(family);
    const runId = newRunId(family.id);
    knownFamilies.add(family.id);
    const entry: RunEntry = {
      runId, familyId: family.id, status: 'running', startedAt: new Date().toISOString(), logsDir: base.logsDir,
      family: familyView(family), today: base.today, demoDate: isSeedFamily(family.id),
    };
    runs.set(runId, entry);
    while (runs.size > MAX_REGISTRY) runs.delete(runs.keys().next().value as string);
    inFlight++;
    inFlightByIp.set(ip, (inFlightByIp.get(ip) ?? 0) + 1);
    const done = runBundle(family.id, { ...base, runId, loadFamily: async () => family })
      .then(async (result) => {
        entry.result = result;
        // Save before saying "done", so a finished run can always be read back after a restart.
        // A failed save is logged but never fails the run (it is still served from memory).
        try { await deps.store.saveRunResult(savedRow(entry, result)); }
        catch (e) { console.error('Saving run result failed:', runId, (e as Error)?.message); }
        entry.status = 'done';
      })
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
      // A family typed in on the onboarding screens is saved, and its id goes back to the browser so it can find the family again.
      // Saving never blocks the run: if it fails, no id is returned.
      let savedFamilyId: string | undefined;
      if (isInlineFamily(family)) {
        try { await deps.store.saveFamily(family); savedFamilyId = family.id; }
        catch (e) { console.error('Saving family failed:', family.id, (e as Error)?.message); }
      }
      if (req.query.wait === 'true') {
        await done;
        if (entry.status === 'done') return res.json({ ...view(req, entry.result!), family: entry.family });
        return res.status(500).json({ error: entry.error, runId: entry.runId });
      }
      return res.status(202).json({ runId: entry.runId, ...(savedFamilyId ? { familyId: savedFamilyId } : {}) });
    } catch (e) {
      console.error('POST /api/run failed:', (e as Error)?.message);
      return res.status(500).json({ error: 'Could not start the run.' });
    }
  });

  /** A run still in memory, else one saved in the results table (so results survive a restart). */
  async function findRun(runId: string): Promise<RunEntry | null> {
    const live = runs.get(runId);
    if (live) return live;
    try {
      const saved = await deps.store.getRunResult(runId);
      return saved ? restoredEntry(saved) : null;
    } catch (e) {
      console.error('Reading saved run failed:', runId, (e as Error)?.message);
      return null;
    }
  }

  const runBody = (req: Request, e: RunEntry) => ({
    runId: e.runId, familyId: e.familyId, status: e.status, startedAt: e.startedAt, family: e.family, today: e.today, demoDate: e.demoDate,
    result: e.result ? view(req, e.result) : null, error: e.error ?? null, progress: progressFor(e), owner: isOwner(req),
  });

  router.get('/api/runs/:runId', async (req, res) => {
    const e = await findRun(req.params.runId);
    if (!e) return res.status(404).json({ error: 'Run not found' });
    return res.json(runBody(req, e));
  });

  router.get('/api/runs/:runId/trace', async (req, res) => {
    const e = await findRun(req.params.runId);
    if (!e) return res.status(404).json({ error: 'Run not found' });
    if (!isOwner(req)) return res.status(403).json({ error: 'The audit log is for the reviewer only.' });
    return res.json(readTrace(e));
  });

  /** The newest saved result for a family, for the instant feed. Same parent/owner split as a normal run. */
  router.get('/api/families/:familyId/latest-run', async (req, res) => {
    if (!knownFamilies.has(req.params.familyId)) return res.status(404).json({ error: 'No saved run for this family' });
    try {
      const saved = await deps.store.latestRunResult(req.params.familyId);
      if (!saved) return res.status(404).json({ error: 'No saved run for this family' });
      return res.json(runBody(req, restoredEntry(saved)));
    } catch (e) {
      console.error('GET latest-run failed:', (e as Error)?.message);
      return res.status(500).json({ error: 'Could not load the saved run.' });
    }
  });

  router.post('/api/feedback', feedbackLimiter, async (req, res) => {
    const { familyId, cardId, kind, note } = req.body ?? {};
    if (typeof familyId !== 'string' || !knownFamilies.has(familyId)) return res.status(400).json({ error: 'Unknown family' });
    if (typeof cardId !== 'string' || !cardId || cardId.length > 200) return res.status(400).json({ error: 'Missing card' });
    if (kind !== 'got_it' && kind !== 'issue' && kind !== 'not_relevant') return res.status(400).json({ error: 'kind must be got_it, issue or not_relevant' });
    if (note !== undefined && typeof note !== 'string') return res.status(400).json({ error: 'note must be text' });
    try {
      const saved = await deps.store.addFeedback({ familyId, cardId, kind, note: (note ?? '').slice(0, 500) });
      // "I got this" and "Not relevant" are also remembered per card (the claims table). Never blocks the answer.
      if (kind === 'got_it' || kind === 'not_relevant') {
        try { await deps.store.setClaim({ familyId, cardId, status: kind }); }
        catch (e) { console.error('Saving claim failed:', (e as Error)?.message); }
      }
      let proposals: unknown[] = [];
      try {
        const existing = await deps.store.listProposals();
        const covered = new Set(existing.flatMap((p) => p.sourceFeedbackIds));
        const fresh = (await deps.store.listRecentIssues(MAX_ISSUES)).filter((r) => !covered.has(String(r.id)));
        proposals = await deps.store.saveProposals(await proposeRules(fresh, deps.llm));
      } catch (e) {
        console.error('Coach failed:', (e as Error)?.message); // feedback is saved either way
      }
      // The Coach also learns from "Not relevant": the same card dismissed by 2 or more families becomes a proposed rule.
      if (kind === 'not_relevant') {
        try {
          const dismissed = await deps.store.listRecentDismissals(MAX_ISSUES);
          const covered = new Set((await deps.store.listProposals()).flatMap((p) => p.sourceFeedbackIds));
          const fresh = proposeFromDismissals(dismissed).filter((p) => !p.sourceFeedbackIds.every((id) => covered.has(id)));
          proposals = [...proposals, ...(await deps.store.saveProposals(fresh))];
        } catch (e) {
          console.error('Coach (dismissals) failed:', (e as Error)?.message);
        }
      }
      if (!isOwner(req)) return res.json({ ok: true, feedbackId: saved.id, proposals: [], proposedCount: proposals.length }); // rule text is owner-only
      return res.json({ ok: true, feedbackId: saved.id, proposals, proposedCount: proposals.length });
    } catch (e) {
      console.error('POST /api/feedback failed:', (e as Error)?.message);
      return res.status(500).json({ error: 'Could not save feedback.' });
    }
  });

  /** Undo: take back an "I got this" or "Not relevant". The feedback row stays as history; the Coach only counts answers that still stand. */
  router.post('/api/claims/undo', feedbackLimiter, async (req, res) => {
    const { familyId, cardId } = req.body ?? {};
    if (typeof familyId !== 'string' || !knownFamilies.has(familyId)) return res.status(400).json({ error: 'Unknown family' });
    if (typeof cardId !== 'string' || !cardId || cardId.length > 200) return res.status(400).json({ error: 'Missing card' });
    try {
      await deps.store.clearClaim(familyId, cardId);
      return res.json({ ok: true });
    } catch (e) {
      console.error('POST /api/claims/undo failed:', (e as Error)?.message);
      return res.status(500).json({ error: 'Could not undo.' });
    }
  });

  // The scoreboard holds memory-rule text, memory ids, storage details and the model mode: owner-only.
  // No parent screen shows it (Smarter.tsx asks only with the reviewer code), so parents get a 403.
  router.get('/api/scoreboard', (req, res) => {
    if (!isOwner(req)) return res.status(403).json({ error: 'The scoreboard is for the reviewer only.' });
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

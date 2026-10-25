import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { BundleReceipt, BundleResult, Family, FeedCard } from '../../shared/bundle';
import type { ZetarisClient } from '../adapters/zetaris';
import { ZetarisUnavailable } from '../adapters/zetaris';
import type { Generator } from '../adapters/llm';
import type { BundleMemory } from '../adapters/memory';
import { TraceLogger } from './trace';
import type { AgentContext, Candidate, OfferCheckWriter } from './types';
import { checkWithCorrections } from './factChecker';
import { Workspace } from './workspace';
import { runEvents as defaultRunEvents, type RunEventHub, type AgentState } from './runEvents';
import * as clawback from './clawback';
import * as recall from './recall';
import * as court from './finePrintCourt';
import * as benefits from './benefits';
import { UNCOVERED_STATE_NOTE } from './benefits';
import { itemsSql } from './recall';
import { col, isInlineFamily } from './sql';
import { buildFallbackFillers } from './fallback';
import { familyProfileSql } from './savedVerdicts';

export const BANNER = "Some sources didn't respond: showing what we could check.";
export const COPY = {
  clawbackNoData: 'No money to claw back yet. Connect a card or upload Amazon orders.',
  clawbackNone: "Nothing to claw back: you're doing great.",
  recallNoPurchases: 'Connect your data to safety-check your items.',
  recallAllClear: (n: number) => `We checked ${n} items: all clear.`,
};
const INSURANCE_ID = 'benefit-insurance_add_baby';

export interface RunDeps {
  z: ZetarisClient;
  llm: Generator;
  memory: BundleMemory;
  loadFamily: (id: string) => Promise<Family>;
  logsDir: string;
  today: string;
  /** Optional: lets the API hand the caller the run id before the run finishes. */
  runId?: string;
  /** Where agreed court grades are saved (offer_checks). Absent in sample runs: nothing is saved. */
  offerChecks?: OfferCheckWriter;
  /** Live-update board for this run; defaults to the server's shared one. */
  events?: RunEventHub;
  /** The most time a run may take, in ms (default: RUN_DEADLINE_SECONDS, else 300 s). Past it, no new checking work starts. */
  budgetMs?: number;
  /** Clock for the budget (ms). Tests pass a fake so nothing waits for real. */
  now?: () => number;
}

/** A family from the sample file (the offline stand-in, and the fallback when Zetaris cannot answer in SAMPLE_MODE). */
export async function loadSampleFamily(id: string): Promise<Family> {
  const all: Family[] = JSON.parse(fs.readFileSync(path.resolve('data/sample/families.json'), 'utf8'));
  const f = all.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown sample family: ${id}`);
  return f;
}

const truthy = (v: unknown): boolean => v === true || v === 1 || /^(true|t|1|yes)$/i.test(String(v ?? ''));
const textOrNull = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v));
const dateOrNull = (v: unknown): string | null => { const t = textOrNull(v); return t ? t.slice(0, 10) : null; };
const intOrNull = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));

/** One row of the Zetaris family-profile view (v_family_profile) as a Family. Zetaris sends booleans as text and drops a zip's leading zero. */
export function familyFromRow(row: Record<string, unknown>): Family {
  const get = (n: string) => col(row as any, n);
  const zip = String(get('zip') ?? '');
  return {
    id: String(get('id')), userId: null, isGuest: truthy(get('is_guest')), name: String(get('name') ?? ''),
    birthDate: dateOrNull(get('birth_date')), dueDate: dateOrNull(get('due_date')),
    zip: /^\d{1,4}$/.test(zip) ? zip.padStart(5, '0') : zip, state: String(get('state') ?? ''),
    employer: String(get('employer') ?? ''), householdSize: Number(get('household_size') ?? 3),
    annualIncomeCents: intOrNull(get('annual_income_cents')), dcfsaOffered: truthy(get('dcfsa_offered')),
    dataConnected: truthy(get('data_connected')),
  };
}

/** The family profile asked of Zetaris with the existing familyProfileSql (the question that has saved replays). Throws if there is no such family. */
export async function loadFamilyViaZetaris(z: Pick<ZetarisClient, 'runQuery'>, id: string): Promise<Family> {
  const res = await z.runQuery(familyProfileSql(id));
  if (!res.rows.length) throw new Error(`Zetaris has no family profile for ${id}`);
  return familyFromRow(res.rows[0]);
}

/** The old direct read from Neon through Drizzle (imported lazily: server/db.ts throws without DATABASE_URL). */
async function loadFamilyFromNeon(id: string): Promise<Family> {
  const { db } = await import('../db');
  const { families } = await import('../../shared/schema');
  const { eq } = await import('drizzle-orm');
  const rows = await db.select().from(families).where(eq(families.id, id)).limit(1);
  if (!rows.length) throw new Error(`Unknown family: ${id}`);
  return rows[0] as Family;
}

export interface LoadFamilyOpts {
  /** Zetaris (its saved replays in SAMPLE_MODE). Without it the family comes straight from the old source. */
  z?: Pick<ZetarisClient, 'runQuery'>;
  /** The old direct read from Neon (default: the real database). Only used when Zetaris cannot answer. */
  neon?: (id: string) => Promise<Family>;
  log?: (message: string) => void;
}

/**
 * Load a family. Zetaris is the way agents read data, so it is asked first (in SAMPLE_MODE that is the saved replay).
 * If Zetaris cannot answer, the log says so and the old source is used: the sample file in SAMPLE_MODE, otherwise Neon.
 */
export async function defaultLoadFamily(id: string, opts: LoadFamilyOpts = {}): Promise<Family> {
  const sample = process.env.SAMPLE_MODE === 'true';
  const log = opts.log ?? ((m: string) => console.warn(m));
  if (opts.z) {
    try {
      const fam = await loadFamilyViaZetaris(opts.z, id);
      // The saved Zetaris replay predates the V2 onboarding answers, so in practice mode they come from the sample file.
      if (sample) {
        const s = await loadSampleFamily(id).catch(() => null);
        if (s) return { ...fam, household: s.household, parent1Work: s.parent1Work, parent2Work: s.parent2Work, insurance: s.insurance };
      }
      return fam;
    } catch (e: any) {
      log(`Family profile for ${id}: Zetaris could not answer (${String(e?.message ?? e).slice(0, 120)}); reading it ${sample ? 'from the sample file' : 'straight from Neon'} instead.`);
    }
  }
  return sample ? loadSampleFamily(id) : (opts.neon ?? loadFamilyFromNeon)(id);
}

// ---------- never-empty feed ----------

const KIND_ORDER: Record<string, number> = { clawback: 0, recall: 1, benefit: 2, discount: 3, coming_soon: 4 };
const toCard = (c: Candidate): FeedCard => ({
  id: c.id, kind: c.kind, title: c.title, body: c.body, amountCents: c.amountCents, deadline: c.deadline,
  verdict: c.verdict, sources: c.sources, traceId: c.traceId,
  ...(c.valueScore ? { valueScore: c.valueScore } : {}),
});
const infoCard = (id: string, kind: FeedCard['kind'], title: string, body: string, verdict: FeedCard['verdict'], traceId: string): FeedCard => ({
  id, kind, title, body, amountCents: null, deadline: null, verdict, sources: [], traceId,
});

/**
 * Turn verified candidates into the feed, enforcing the never-empty minimums.
 * Fillers are bundled stand-ins (verdict 'info', "Not yet verified"). They only top up a short feed and never count in the Receipt.
 * Real recalls are all kept (a safety recall is never hidden); the all-clear card appears only when there are none.
 */
export function assembleFeed(
  verified: Candidate[],
  family: Family,
  itemsChecked: number,
  fillers: { approvedGeneralOffers: Candidate[]; federalBenefits: Candidate[] },
  today: string = new Date().toISOString().slice(0, 10),
): { cards: FeedCard[]; receipt: BundleReceipt } {
  const cards: FeedCard[] = [];
  const seen = new Set<string>();
  const add = (c: Candidate) => { if (!seen.has(c.id)) { seen.add(c.id); cards.push(toCard(c)); } };
  const count = (k: string) => cards.filter((c) => c.kind === k).length;

  for (const c of verified) if (c.kind !== 'coming_soon') add(c);
  // Fillers only top up a short feed, and never repeat a rule or offer already shown.
  const have = (k: string, f: (c: Candidate) => string) => new Set(verified.filter((c) => c.kind === k).map(f));
  const refs = have('benefit', (c) => String(c.claim.ref));
  const titles = have('discount', (c) => c.title);
  for (const c of fillers.federalBenefits) {
    if (count('benefit') >= 2) break;
    if (c.kind === 'benefit' && !refs.has(String(c.claim.ref))) add(c);
  }
  for (const c of fillers.approvedGeneralOffers) {
    if (count('discount') >= 3) break;
    if (c.kind === 'discount' && !titles.has(c.title)) add(c);
  }

  if (count('recall') === 0) {
    cards.push(itemsChecked > 0
      ? infoCard('recall-all-clear', 'recall', 'Recall check', COPY.recallAllClear(itemsChecked), 'all_clear', 'assemble')
      : infoCard('recall-no-purchases', 'recall', 'Recall check', COPY.recallNoPurchases, 'info', 'assemble'));
  }
  if (count('clawback') === 0) {
    cards.push(infoCard('clawback-info', 'clawback', 'Money back',
      family.dataConnected ? COPY.clawbackNone : COPY.clawbackNoData, 'info', 'assemble'));
  }
  cards.push(
    infoCard('coming-soon-prefilled', 'coming_soon', 'Pre-filled applications', 'Coming soon: we will fill in benefit applications for you to review.', 'info', 'assemble'),
    infoCard('coming-soon-price-watch', 'coming_soon', "We'll watch for price drops", 'Coming soon: we will watch your purchases and flag price drops.', 'info', 'assemble'),
  );

  // Stable sort: insurance pinned first, then by kind.
  const rank = (c: FeedCard) => (c.id === INSURANCE_ID ? -1 : KIND_ORDER[c.kind]);
  const ordered = cards.map((c, i) => ({ c, i })).sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i).map((x) => x.c);

  const counts = (c: FeedCard) => c.verdict === 'verified' || c.verdict === 'likely';
  // Receipt honesty: only checked cards count (never the "Not yet verified" stand-ins). Money back is an explicit list of claim types.
  const MONEY_BACK_TYPES = new Set(['fsa_reimbursement', 'price_adjustment']);
  const moneyBackIds = new Set(verified.filter((c) => c.kind === 'clawback' && MONEY_BACK_TYPES.has(String(c.claim.type))).map((c) => c.id));
  const sum = (k: string) => ordered
    .filter((c) => c.kind === k && counts(c) && (k !== 'clawback' || moneyBackIds.has(c.id)))
    .reduce((a, c) => a + (c.amountCents ?? 0), 0);
  const deadlines = ordered
    .filter((c) => c.kind === 'benefit' && counts(c) && c.deadline && c.deadline >= today)
    .map((c) => c.deadline as string).sort();
  return {
    cards: ordered,
    receipt: {
      moneyBackCents: sum('clawback'), likelyBenefitsCents: sum('benefit'),
      deadlineCount: deadlines.length, nextDeadline: deadlines[0] ?? null, itemsChecked,
    },
  };
}

// ---------- run ----------

function ageDays(family: Family, today: string): number {
  const anchor = family.birthDate ?? family.dueDate;
  if (!anchor) return 0;
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${anchor}T00:00:00Z`)) / 86_400_000);
}

const TRANSIENT = /thrift|resultset/i;
/** Zetaris sometimes answers HTTP 400 with a server-side Thrift/ResultSet hiccup (seen live Oct 23); one pause-and-retry clears it. */
async function retryTransient<T>(fn: () => Promise<T>, onRetry: (msg: string) => void): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!TRANSIENT.test(String((e as Error)?.message))) throw e;
    onRetry(String((e as Error).message));
    await new Promise((r) => setTimeout(r, 1500));
    return fn();
  }
}

/** Words and phrases from what the family bought; used by the court to pick trigger offers (e.g. a diaper deal). */
async function purchaseKeywords(ctx: AgentContext, onRetry: (msg: string) => void): Promise<string[]> {
  if (isInlineFamily(ctx.family)) return []; // a typed-in family is never saved, so it has no purchases to look up
  try {
    const { rows } = await retryTransient(() => ctx.z.runQuery(itemsSql(ctx.family.id)), onRetry);
    const items = rows.map((r) => String(col(r, 'item_text') ?? '').toLowerCase().trim()).filter(Boolean);
    const words = items.flatMap((t) => t.match(/[a-z]{3,}/g) ?? []);
    return [...new Set([...items.map((t) => t.slice(0, 80)), ...words])].slice(0, 200);
  } catch (e) {
    if (e instanceof ZetarisUnavailable) throw e;
    return [];
  }
}

export function newRunId(familyId: string): string {
  return `${familyId.replace(/[^A-Za-z0-9_-]/g, '_')}-${crypto.randomUUID()}`;
}

const AGENT_NAMES_FOR_TRACE = ['clawback', 'recall', 'benefits', 'fine_print_court', 'fact_checker'] as const;
type TracedAgent = (typeof AGENT_NAMES_FOR_TRACE)[number];

export async function runBundle(familyId: string, deps: RunDeps): Promise<BundleResult> {
  const runId = deps.runId ?? newRunId(familyId);
  const events = deps.events ?? defaultRunEvents;
  events.open(runId); // before the first await, so a stream opened right after the 202 finds the run
  try {
    return await runBundleInner(familyId, runId, events, deps);
  } finally {
    events.finish(runId); // the live stream always ends, even if the run threw
  }
}

async function runBundleInner(familyId: string, runId: string, events: RunEventHub, deps: RunDeps): Promise<BundleResult> {
  // Each family run gets a fresh AI time limit (otherwise the clock counts from server start).
  deps.llm.startRun?.();
  const family = await deps.loadFamily(familyId);
  const trace = new TraceLogger(runId, deps.logsDir);
  // Every Zetaris query and memory call lands in this run's trace, under the name of the agent that made it
  // (test fakes without withTrace are used as-is).
  const zFor = (name: string) => (typeof deps.z.withTrace === 'function' ? deps.z.withTrace(trace, name) : deps.z);
  const memFor = (name: string) => (typeof deps.memory.withTrace === 'function' ? deps.memory.withTrace(trace, name) : deps.memory);
  const blocked: FeedCard[] = [];
  // One shared notebook for the whole run (Meterless H-MEM), opened once and logged as workspace_open.
  const workspace = new Workspace(runId, memFor('orchestrator'), trace);
  const ctxs = {} as Record<TracedAgent, AgentContext>;
  for (const name of AGENT_NAMES_FOR_TRACE) {
    ctxs[name] = {
      runId, family, z: zFor(name), llm: deps.llm, memory: memFor(name), trace, today: deps.today, blocked,
      workspace, ...(deps.offerChecks ? { offerChecks: deps.offerChecks } : {}),
    };
  }
  const maxRetries = /^\d+$/.test(process.env.MAX_RETRIES ?? '') ? Number(process.env.MAX_RETRIES) : 2;
  let banner: string | null = null;
  const log = (action: string, input: string, output: string, status: 'ok' | 'retry' | 'blocked' | 'error' | 'fallback', retry = 0) =>
    trace.log({ agent_name: 'orchestrator', action, input_summary: input.slice(0, 250), output_summary: output.slice(0, 250), target_agent: null, confidence: null, retry_count: retry, status });
  const noteFailure = (who: string, e: unknown) => {
    banner = BANNER;
    log('agent_failed', who, `${(e as Error)?.name ?? 'Error'}: ${(e as Error)?.message ?? e}`, 'error');
  };
  /** Live updates are a courtesy: a broken listener never stops the run. */
  const emit = (fn: () => void) => { try { fn(); } catch { /* ignore */ } };
  const status = (agent: string, state: AgentState) => emit(() => events.emit(runId, { type: 'agent_status', agent, state }));
  log('start', `family ${familyId}`, `today ${deps.today}`, 'ok');

  // Run budget: once it is used up, no new checking or correcting starts. What is already checked is kept, the rest is filled in
  // from the bundled stand-ins (marked "not yet verified"), and the screen says some sources did not finish.
  const now = deps.now ?? Date.now;
  const startedAt = now();
  const budgetMs = deps.budgetMs ?? (Number(process.env.RUN_DEADLINE_SECONDS) > 0 ? Number(process.env.RUN_DEADLINE_SECONDS) * 1000 : 300_000);
  let deadlineLogged = false;
  const overBudget = (): boolean => {
    if (now() - startedAt <= budgetMs) return false;
    if (!deadlineLogged) {
      deadlineLogged = true;
      banner = BANNER;
      log('run_deadline', `run took over ${Math.round(budgetMs / 1000)} s`, 'fallback: run deadline. No new checks started; finishing with the cards that are ready', 'fallback');
    }
    return true;
  };

  const withRetry = <T>(who: string, fn: () => Promise<T>): Promise<T> =>
    retryTransient(fn, (m) => log('retry_transient', who, m, 'retry', 1));
  const runAgent = async <T>(who: TracedAgent, fn: () => Promise<T>): Promise<T> => {
    status(who, 'working');
    try {
      const v = await withRetry(who, fn);
      status(who, 'done');
      return v;
    } catch (e) {
      status(who, 'failed');
      throw e;
    }
  };

  // 2. Run the four agents at the same time; one failing never stops the rest.
  // (The Benefits Planner runs its own eligibility counter-question loop inside planBenefits; it is not repeated here.)
  const [claws, rec, ben, offers] = await Promise.allSettled([
    runAgent('clawback', () => clawback.findClawbacks(ctxs.clawback)),
    runAgent('recall', () => recall.checkRecalls(ctxs.recall)),
    runAgent('benefits', () => benefits.planBenefits(ctxs.benefits, deps.today)),
    runAgent('fine_print_court', async () => court.judgeOffers(ctxs.fine_print_court, { ageDays: ageDays(family, deps.today), purchaseKeywords: await purchaseKeywords(ctxs.fine_print_court, (m) => log('retry_transient', 'purchase_keywords', m, 'retry', 1)), includeGeneral: true })),
  ]);
  const take = <T>(r: PromiseSettledResult<T>, who: string, empty: T): T => {
    if (r.status === 'fulfilled') return r.value;
    noteFailure(who, r.reason);
    return empty;
  };
  const clawCands = take(claws, 'clawback', [] as Candidate[]);
  const recRes = take(rec, 'recall', { candidates: [] as Candidate[], itemsChecked: 0 });
  const benCands = take(ben, 'benefits', [] as Candidate[]);
  const offerCands = take(offers, 'fine_print_court', [] as Candidate[]);

  // 3. Fact-check everything (4 at a time) with line-specific corrections. A card that is WRONG goes back to its owner, up to
  // maxRetries times, then is dropped. A card that could not be CHECKED (source down) is never sent back: transient errors get
  // one retry, otherwise it is dropped with the banner. The final yes is logged by the checker as approve_card.
  const reviserFor = (c: Candidate) => async (card: Candidate, why: string): Promise<Candidate | null> => {
    if (overBudget()) return null; // out of time: the card is dropped instead of being corrected again
    try {
      switch (c.agent) {
        case 'benefits': return await benefits.revise(card, why, ctxs.benefits, deps.today);
        case 'clawback': return await clawback.revise(card, why, ctxs.clawback);
        case 'recall': return await recall.revise(card, why, ctxs.recall);
        case 'fine_print_court': return await court.revise(card, why, ctxs.fine_print_court);
        default: return null;
      }
    } catch (e) {
      noteFailure(`revise ${c.agent}`, e);
      return null;
    }
  };
  const checkOne = async (start: Candidate): Promise<Candidate | null> => {
    const lessonIds = start.agent === 'fine_print_court' ? court.lessonIdsFor(ctxs.fine_print_court, start.id) : [];
    const check = (c: Candidate) => checkWithCorrections(c, ctxs.fact_checker, reviserFor(start), { lessonIds, maxRounds: maxRetries });
    let out = await check(start);
    if (out.decision === 'unchecked' && TRANSIENT.test(out.result.reason ?? '') && !overBudget()) {
      log('retry_transient', `fact_check ${start.id}`, out.result.reason ?? '', 'retry', out.rounds);
      await new Promise((r) => setTimeout(r, 1500));
      out = await check(out.card);
    }
    const c = out.card;
    if (out.decision === 'approved') {
      emit(() => events.emit(runId, { type: 'card_ready', card: toCard(c) }));
      return { ...c, retryCount: out.rounds };
    }
    if (out.decision === 'unchecked') {
      banner = BANNER;
      log('drop', `${c.kind} ${c.id} from ${c.agent}`, `dropped, not checked: ${out.result.reason}`, 'error', out.rounds);
      emit(() => events.emit(runId, { type: 'card_removed', cardId: c.id, reason: 'could not be checked' }));
      return null;
    }
    log('drop', `${c.kind} ${c.id} from ${c.agent}`, `dropped after ${out.rounds} retries: ${out.result.reason}`, 'blocked', out.rounds);
    emit(() => events.emit(runId, { type: 'card_removed', cardId: c.id, reason: 'did not pass the fact-check' }));
    return null;
  };
  status('fact_checker', 'working');
  const all = [...clawCands, ...recRes.candidates, ...benCands, ...offerCands];
  const results: (Candidate | null)[] = new Array(all.length).fill(null);
  let nextIdx = 0;
  await Promise.all(Array.from({ length: Math.min(4, all.length) }, async () => {
    while (nextIdx < all.length) {
      const i = nextIdx++;
      if (overBudget()) {
        emit(() => events.emit(runId, { type: 'card_removed', cardId: all[i].id, reason: 'ran out of time before it could be checked' }));
        log('drop', `${all[i].kind} ${all[i].id} from ${all[i].agent}`, 'dropped, not checked: fallback: run deadline', 'fallback');
        continue;
      }
      try {
        results[i] = await checkOne(all[i]);
      } catch (e) {
        noteFailure(`fact_check ${all[i].id}`, e);
        emit(() => events.emit(runId, { type: 'card_removed', cardId: all[i].id, reason: 'could not be checked' }));
      }
    }
  }));
  status('fact_checker', 'done');
  const verified = results.filter((c): c is Candidate => c !== null);

  // 4. Assemble. If agents came up short, bundled stand-ins (verdict info, "not yet verified", outside the Receipt) top the feed up.
  const { cards, receipt } = assembleFeed(verified, family, recRes.itemsChecked, buildFallbackFillers(family, deps.today), deps.today);
  log('assemble', `family ${familyId}`, `${cards.length} cards, ${verified.length}/${all.length} passed fact-check`, 'ok');

  // 5. Trust ledger out to logs/.
  try {
    deps.memory.exportLedger(path.join(deps.logsDir, `ledger-${runId}.jsonl`));
  } catch (e) {
    log('export_ledger', runId, `failed: ${(e as Error).message}`, 'error');
  }
  // Only a planner that actually read the rules can say the state is not covered; a failed planner says nothing.
  const uncovered = ctxs.benefits.stateCovered === false;
  return { familyId, runId, receipt, cards, banner, blocked, ...(uncovered ? { stateNote: UNCOVERED_STATE_NOTE } : {}) };
}

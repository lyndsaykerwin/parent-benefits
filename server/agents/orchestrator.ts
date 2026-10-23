import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { BundleReceipt, BundleResult, Family, FeedCard } from '../../shared/bundle';
import type { ZetarisClient } from '../adapters/zetaris';
import { ZetarisUnavailable } from '../adapters/zetaris';
import type { Generator } from '../adapters/llm';
import type { BundleMemory } from '../adapters/memory';
import { TraceLogger } from './trace';
import type { AgentContext, Candidate } from './types';
import { verify } from './factChecker';
import * as clawback from './clawback';
import * as recall from './recall';
import * as court from './finePrintCourt';
import * as benefits from './benefits';
import { itemsSql } from './recall';
import { col } from './sql';
import { buildFallbackFillers } from './fallback';

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
}

/** Load a family: sample file in SAMPLE_MODE, otherwise Neon through Drizzle (imported lazily: server/db.ts throws without DATABASE_URL). */
export async function defaultLoadFamily(id: string): Promise<Family> {
  if (process.env.SAMPLE_MODE === 'true') {
    const all: Family[] = JSON.parse(fs.readFileSync(path.resolve('data/sample/families.json'), 'utf8'));
    const f = all.find((x) => x.id === id);
    if (!f) throw new Error(`Unknown sample family: ${id}`);
    return f;
  }
  const { db } = await import('../db');
  const { families } = await import('../../shared/schema');
  const { eq } = await import('drizzle-orm');
  const rows = await db.select().from(families).where(eq(families.id, id)).limit(1);
  if (!rows.length) throw new Error(`Unknown family: ${id}`);
  return rows[0] as Family;
}

// ---------- never-empty feed ----------

const KIND_ORDER: Record<string, number> = { clawback: 0, recall: 1, benefit: 2, discount: 3, coming_soon: 4 };
const toCard = (c: Candidate): FeedCard => ({
  id: c.id, kind: c.kind, title: c.title, body: c.body, amountCents: c.amountCents, deadline: c.deadline,
  verdict: c.verdict, sources: c.sources, traceId: c.traceId,
});
const infoCard = (id: string, kind: FeedCard['kind'], title: string, body: string, verdict: FeedCard['verdict'], traceId: string): FeedCard => ({
  id, kind, title, body, amountCents: null, deadline: null, verdict, sources: [], traceId,
});

/**
 * Turn verified candidates into the feed, enforcing the never-empty minimums.
 * Fillers are only ever agent output that already passed fact-check (benefit rules, court-approved offers).
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
  // Receipt honesty: the Dependent Care FSA card is eligible spend, not money back or a benefit payout, so it is in neither total.
  const eligibleSpendIds = new Set([...verified, ...fillers.federalBenefits].filter((c) => c.claim.type === 'dcfsa_childcare').map((c) => c.id));
  const sum = (k: string) => ordered
    .filter((c) => c.kind === k && counts(c) && !eligibleSpendIds.has(c.id) && !c.id.startsWith('clawback-dcfsa-'))
    .reduce((a, c) => a + (c.amountCents ?? 0), 0);
  const deadlines = ordered
    .filter((c) => c.kind === 'benefit' && c.deadline && c.deadline >= today)
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

type Reviser = (c: Candidate, reason: string, ctx: AgentContext) => Promise<Candidate | null>;
const REVISERS: Record<string, Reviser> = {
  clawback: (c, r, x) => clawback.revise(c, r, x),
  recall: (c, r, x) => recall.revise(c, r, x),
  fine_print_court: (c, r, x) => court.revise(c, r, x),
  benefits: (c, r, x) => benefits.revise(c, r, x),
};

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

export async function runBundle(familyId: string, deps: RunDeps): Promise<BundleResult> {
  const family = await deps.loadFamily(familyId);
  const runId = deps.runId ?? newRunId(familyId);
  const trace = new TraceLogger(runId, deps.logsDir);
  // Every Zetaris query and memory call lands in this run's trace (test fakes without withTrace are used as-is).
  const z = typeof deps.z.withTrace === 'function' ? deps.z.withTrace(trace) : deps.z;
  const memory = typeof deps.memory.withTrace === 'function' ? deps.memory.withTrace(trace) : deps.memory;
  const ctx: AgentContext = { runId, family, z, llm: deps.llm, memory, trace, today: deps.today };
  const maxRetries = /^\d+$/.test(process.env.MAX_RETRIES ?? '') ? Number(process.env.MAX_RETRIES) : 2;
  let banner: string | null = null;
  const log = (action: string, input: string, output: string, status: 'ok' | 'retry' | 'blocked' | 'error' | 'fallback', retry = 0) =>
    trace.log({ agent_name: 'orchestrator', action, input_summary: input.slice(0, 250), output_summary: output.slice(0, 250), target_agent: null, confidence: null, retry_count: retry, status });
  const noteFailure = (who: string, e: unknown) => {
    banner = BANNER;
    log('agent_failed', who, `${(e as Error)?.name ?? 'Error'}: ${(e as Error)?.message ?? e}`, 'error');
  };
  log('start', `family ${familyId}`, `today ${deps.today}`, 'ok');

  const withRetry = <T>(who: string, fn: () => Promise<T>): Promise<T> =>
    retryTransient(fn, (m) => log('retry_transient', who, m, 'retry', 1));

  // 2. Run the four agents at the same time; one failing never stops the rest.
  const [claws, rec, ben, offers] = await Promise.allSettled([
    withRetry('clawback', () => clawback.findClawbacks(ctx)),
    withRetry('recall', () => recall.checkRecalls(ctx)),
    withRetry('benefits', () => benefits.planBenefits(ctx, deps.today)),
    withRetry('fine_print_court', async () => court.judgeOffers(ctx, { ageDays: ageDays(family, deps.today), purchaseKeywords: await purchaseKeywords(ctx, (m) => log('retry_transient', 'purchase_keywords', m, 'retry', 1)), includeGeneral: true })),
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

  // 3. Fact-check everything (4 at a time). A card that is WRONG goes back to its owner, up to maxRetries times, then is dropped.
  // A card that could not be CHECKED (source down) is never sent back: transient errors get one retry, otherwise it is dropped with the banner.
  const checkOne = async (start: Candidate): Promise<Candidate | null> => {
    let c = start;
    for (let attempt = 0; ; attempt++) {
      let res = await verify(c, ctx);
      if (res.unavailable && TRANSIENT.test(res.reason ?? '')) {
        log('retry_transient', `fact_check ${c.id}`, res.reason ?? '', 'retry', attempt);
        await new Promise((r) => setTimeout(r, 1500));
        res = await verify(c, ctx);
      }
      if (res.ok) return c;
      if (res.unavailable) {
        banner = BANNER;
        log('drop', `${c.kind} ${c.id} from ${c.agent}`, `dropped, not checked: ${res.reason}`, 'error', attempt);
        return null;
      }
      if (attempt >= maxRetries) {
        log('drop', `${c.kind} ${c.id} from ${c.agent}`, `dropped after ${attempt} retries: ${res.reason}`, 'blocked', attempt);
        return null;
      }
      const reason = `${res.reason ?? 'failed fact-check'}${res.corrected ? ` (corrected values: ${JSON.stringify(res.corrected)})` : ''}`;
      log('send_back', `${c.id} to ${c.agent}`, reason, 'retry', attempt + 1);
      let next: Candidate | null = null;
      try {
        next = c.agent === 'benefits' ? await benefits.revise(c, reason, ctx, deps.today)
          : REVISERS[c.agent] ? await REVISERS[c.agent](c, reason, ctx) : null;
      } catch (e) {
        noteFailure(`revise ${c.agent}`, e);
      }
      if (!next) {
        log('drop', `${c.kind} ${c.id} from ${c.agent}`, `dropped: ${c.agent} could not fix it (${res.reason})`, 'blocked', attempt + 1);
        return null;
      }
      c = { ...next, retryCount: attempt + 1 };
    }
  };
  const all = [...clawCands, ...recRes.candidates, ...benCands, ...offerCands];
  const results: (Candidate | null)[] = new Array(all.length).fill(null);
  let nextIdx = 0;
  await Promise.all(Array.from({ length: Math.min(4, all.length) }, async () => {
    while (nextIdx < all.length) {
      const i = nextIdx++;
      try {
        results[i] = await checkOne(all[i]);
      } catch (e) {
        noteFailure(`fact_check ${all[i].id}`, e);
      }
    }
  }));
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
  return { familyId, runId, receipt, cards, banner };
}

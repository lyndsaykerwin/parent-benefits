/**
 * Loop 2 (plan section 1b): the Fine Print Lawyer tries to disprove a benefit the Benefits Planner found, and
 * sends it back with ONE counter-question for Zetaris. The Planner asks, then confirms or drops the benefit.
 *
 * What the Lawyer may use (sign-off item 35): the family's state, due or birth date, ZIP, and the stored rule
 * tables `state_programs` and `tax_parameters`. Never job data, pay or exact income: anything that needs those
 * stays on the "Check with your job" card, which this loop never touches.
 *
 * Two things the Lawyer can challenge:
 *  - window:   a state program with a time window. Does the state's own program table agree on the window?
 *  - tax_year: a federal tax credit with a dollar amount. Does the tax table for the baby's year give the same amount?
 *
 * The question is one fixed Zetaris question per run (all challenged benefits share it), exported as
 * `eligibilityCounterSql` so its exact text can be recorded live once (`npm run zetaris:record`, see the hand-off
 * notes). In SAMPLE_MODE a saved answer is replayed only for that exact text; with none, the loop degrades honestly:
 * every challenged benefit stays on screen marked "not yet verified" and the trace says why. Nothing is invented.
 */
import { col, addDays } from './sql';
import type { AgentContext } from './types';
import type { Family } from '../../shared/bundle';

type Row = Record<string, string | number | null>;

const LAWYER = 'FinePrintLawyer';
const PLANNER = 'BenefitsPlanner';

/** Added to the end of a card's text when the counter-question could not be answered. No dollar signs, no promises. */
export const UNVERIFIED_NOTE = 'Not yet verified: we could not double-check this against our program tables.';

/** What the Lawyer reads about one benefit (all of it is already on the Planner's card). */
export interface BenefitTerms {
  code: string;
  title: string;
  scope: string;
  amountCents: number | null;
  windowEndDays: number | null;
  condition: string;
  deadline: string | null;
}

export type ChallengeKind = 'window' | 'tax_year';
export interface Challenge { code: string; kind: ChallengeKind; question: string }
export type Outcome = 'confirmed' | 'dropped' | 'unverified';
export interface Resolution { code: string; kind: ChallengeKind; outcome: Outcome; reason: string }

/**
 * THE counter-question. One fixed text per state: the state's own program rows plus the federal tax figures.
 * Only the two stored rule tables are read; no family, income, household or job column appears. A state that
 * is not two capital letters is replaced by an empty string, so it can never reach the SQL.
 */
export function eligibilityCounterSql(state: string): string {
  const st = /^[A-Z]{2}$/.test(state) ? state : '';
  return (
    "SELECT 'state_program' AS source, code, year, amount_cents, window_start_days_from_birth, window_end_days_from_birth " +
    `FROM bundle_pg.state_programs WHERE state = '${st}' ` +
    "UNION ALL SELECT 'tax_parameter' AS source, code, year, amount_cents, CAST(NULL AS integer) AS window_start_days_from_birth, CAST(NULL AS integer) AS window_end_days_from_birth " +
    'FROM bundle_pg.tax_parameters ORDER BY source, code, year'
  );
}

/** The tax table names a credit without the "FEDERAL_" label the rule table uses. */
const taxCodeFor = (ruleCode: string): string => ruleCode.replace(/^FEDERAL_/, '');
const isStateScope = (scope: string): boolean => /^[A-Z]{2}$/.test(scope);

/** The Lawyer's pass over the Planner's benefits: which ones could be disproved with data we have? Pure code, no model. */
export function challengeBenefits(terms: BenefitTerms[], _family: Pick<Family, 'state' | 'birthDate' | 'dueDate'>, _today: string): Challenge[] {
  const out: Challenge[] = [];
  for (const t of terms) {
    if (isStateScope(t.scope) && t.windowEndDays !== null) {
      out.push({
        code: t.code, kind: 'window',
        question: `${t.title} says the baby must be born or placed within ${t.windowEndDays} days. Does the ${t.scope} program table say the same window, and is it still open?`,
      });
    } else if (t.scope === 'federal' && t.amountCents !== null && /tax/i.test(`${t.title} ${t.condition}`)) {
      out.push({
        code: t.code, kind: 'tax_year',
        question: `${t.title} is shown at a fixed amount. Does the federal tax table for the baby's year give the same amount?`,
      });
    }
  }
  return out;
}

const numOf = (r: Row, k: string): number | null => {
  const v = col(r, k);
  return v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v);
};
const strOf = (r: Row, k: string): string => String(col(r, k) ?? '');

/** The newest row for `code` from `source`, no later than `year`. */
function latestRow(rows: Row[], source: string, code: string, year: number | null): Row | null {
  const mine = rows
    .filter((r) => strOf(r, 'source') === source && strOf(r, 'code') === code && numOf(r, 'year') !== null)
    .filter((r) => year === null || (numOf(r, 'year') as number) <= year)
    .sort((a, b) => (numOf(b, 'year') as number) - (numOf(a, 'year') as number));
  return mine[0] ?? null;
}

/** The Planner's side: read Zetaris' answer and confirm or drop one challenged benefit. Pure code. */
export function resolveChallenge(
  ch: Challenge, terms: BenefitTerms, rows: Row[],
  family: Pick<Family, 'birthDate' | 'dueDate'>, today: string,
): Resolution {
  const anchor = family.birthDate ?? family.dueDate ?? null;
  const year = Number((anchor ?? today).slice(0, 4));
  const make = (outcome: Outcome, reason: string): Resolution => ({ code: ch.code, kind: ch.kind, outcome, reason });

  if (ch.kind === 'window') {
    const row = latestRow(rows, 'state_program', ch.code, null);
    if (!row) return make('unverified', 'the state program table has no row for this program');
    const end = numOf(row, 'window_end_days_from_birth');
    if (end === null) return make('unverified', 'the state program table gives no window');
    if (end !== terms.windowEndDays) {
      return make('dropped', `window disagrees: rule says ${terms.windowEndDays} days, the state program table says ${end}`);
    }
    if (anchor && addDays(anchor, end) < today) return make('dropped', `window closed ${addDays(anchor, end)}`);
    return make('confirmed', `state program table agrees: ${end}-day window`);
  }

  const row = latestRow(rows, 'tax_parameter', taxCodeFor(ch.code), year);
  if (!row) return make('unverified', `the tax table has no ${taxCodeFor(ch.code)} figure for ${year} or earlier`);
  const amount = numOf(row, 'amount_cents');
  if (amount === null || terms.amountCents === null) return make('unverified', 'the tax table gives no amount');
  if (Math.abs(amount - terms.amountCents) > 1) {
    return make('dropped', `amount disagrees: rule says ${terms.amountCents} cents, the ${numOf(row, 'year')} tax table says ${amount}`);
  }
  return make('confirmed', `tax table (${numOf(row, 'year')}) agrees on the amount`);
}

function trace(
  ctx: AgentContext, who: 'fine_print_lawyer' | 'benefits', action: string, input: string, output: string,
  status: 'ok' | 'retry' | 'blocked' | 'error' | 'fallback' = 'ok', retry = 0,
): void {
  ctx.trace.log({
    agent_name: who, action, input_summary: input.slice(0, 250), output_summary: output.slice(0, 250),
    target_agent: null, confidence: null, retry_count: retry, status,
  });
}

/** Shared workspace notes are a courtesy: a failure to post never stops the loop. */
function note(ctx: AgentContext, n: { from: string; to: string; type: 'claim' | 'question' | 'answer' | 'verdict'; about: string; body: string; sql?: string; round: number }): void {
  try {
    ctx.workspace?.post({ from_agent: n.from, to_agent: n.to, type: n.type, about: n.about, body: n.body, evidence_sql: n.sql ?? '', round: n.round });
  } catch { /* ignore */ }
}

export const benefitCardId = (code: string): string => `benefit-${code.toLowerCase()}`;

export interface LoopResult {
  asked: boolean;
  resolutions: Map<string, Resolution>;
}

/**
 * Run the loop for one run: the Lawyer challenges, one Zetaris question goes out, the Planner resolves each challenge.
 * Never throws: a missing or failed answer leaves every challenged benefit "unverified".
 */
export async function runEligibilityLoop(ctx: AgentContext, terms: BenefitTerms[], today: string): Promise<LoopResult> {
  const challenges = challengeBenefits(terms, ctx.family, today);
  const resolutions = new Map<string, Resolution>();
  if (!challenges.length) {
    trace(ctx, 'fine_print_lawyer', 'challenge_benefits', `${terms.length} benefit(s) read`, 'nothing could be disproved with the data we have; no question asked');
    return { asked: false, resolutions };
  }
  const sql = eligibilityCounterSql(ctx.family.state);
  const byCode = new Map(terms.map((t) => [t.code, t]));
  trace(ctx, 'fine_print_lawyer', 'challenge_benefits', `${terms.length} benefit(s) read`,
    `challenging ${challenges.map((c) => c.code).join(', ')}; one counter-question for Zetaris`, 'retry', 1);
  for (const c of challenges) {
    const t = byCode.get(c.code)!;
    note(ctx, { from: PLANNER, to: LAWYER, type: 'claim', about: benefitCardId(c.code), round: 0,
      body: `Likely eligible: ${t.title}${t.deadline ? `, by ${t.deadline}` : ''}.` });
    note(ctx, { from: LAWYER, to: PLANNER, type: 'question', about: benefitCardId(c.code), round: 1, body: c.question, sql });
  }

  let rows: Row[] | null = null;
  let why = '';
  try {
    rows = (await ctx.z.runQuery(sql)).rows as Row[];
  } catch (e: any) {
    why = String(e?.message ?? e).slice(0, 160);
  }

  if (!rows) {
    trace(ctx, 'benefits', 'eligibility_check', 'counter-question to Zetaris',
      `no answer (${why}); keeping ${challenges.length} benefit(s) marked not yet verified`, 'fallback', 1);
  }
  for (const c of challenges) {
    const t = byCode.get(c.code)!;
    const r: Resolution = rows
      ? resolveChallenge(c, t, rows, ctx.family, today)
      : { code: c.code, kind: c.kind, outcome: 'unverified', reason: `Zetaris could not answer (${why})` };
    resolutions.set(c.code, r);
    note(ctx, { from: PLANNER, to: LAWYER, type: 'answer', about: benefitCardId(c.code), round: 1, body: r.reason, sql });
    note(ctx, { from: LAWYER, to: PLANNER, type: 'verdict', about: benefitCardId(c.code), round: 1, body: `${r.outcome}: ${r.reason}` });
    if (rows) {
      trace(ctx, 'benefits', 'eligibility_check', `rule ${c.code} (${c.kind})`, `${r.outcome}: ${r.reason}`,
        r.outcome === 'dropped' ? 'blocked' : r.outcome === 'unverified' ? 'fallback' : 'ok', 1);
    }
  }
  return { asked: true, resolutions };
}

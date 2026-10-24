import { col, addDays, today as todayIso, fmtUsd } from './sql';
import { explain } from './explain';
import type { AgentContext, Candidate } from './types';

const AGENT = 'benefits';

type Row = Record<string, string | number | null>;
const s = (r: Row, k: string) => String(col(r, k) ?? '');
const num = (r: Row, k: string): number | null => {
  const v = col(r, k);
  return v === null || v === undefined || v === '' ? null : Number(v);
};

/** Trump Account: babies born (or due) in this range get the federal starter deposit (matches the rule's condition text). */
const TRUMP_FIRST = '2025-01-01';
const TRUMP_LAST = '2028-12-31';
/** What a family sees when we have no programs on file for their state yet (Lyndsay's wording). */
export const UNCOVERED_STATE_NOTE = 'Support for your state’s programs is coming soon';
/** The Dependent Care FSA is a work benefit we cannot see, so it is a gentle "Check with your job" card for everyone. */
const DCFSA_CODE = 'DCFSA_LIFE_EVENT';

/** Federal rules plus the rules for the family's own state (rule scope is "federal" or a 2-letter state). An odd-looking state gets federal only. */
export function rulesSql(state: string): string {
  const own = /^[A-Z]{2}$/.test(state) ? ` OR scope = '${state}'` : '';
  return (
    'SELECT code, title, scope, amount_cents, window_start_days_from_birth, window_end_days_from_birth, condition, source_url ' +
    `FROM bundle_pg.benefit_rules WHERE scope = 'federal'${own} ORDER BY code`
  );
}

function log(ctx: AgentContext, action: string, input: string, output: string, status: 'ok' | 'retry' | 'blocked' | 'error' | 'fallback' = 'ok', retry = 0): string {
  return ctx.trace.log({
    agent_name: AGENT, action, input_summary: input, output_summary: output,
    target_agent: null, confidence: null, retry_count: retry, status,
  });
}

/** What the card says if the model is unavailable or says something we cannot trust. */
function fallbackText(code: string, title: string, cents: number | null, deadline: string | null, afterBirth: boolean): string {
  const when = afterBirth ? 'after your baby arrives' : 'for your baby';
  const by = deadline ? ` Do this by ${deadline}.` : '';
  switch (code) {
    case 'TRUMP_ACCOUNT':
      return `Your baby is likely eligible for a federal starter deposit of ${fmtUsd(cents ?? 0)} in a Trump Account (a savings account opened ${when}).${by}`;
    case 'FEDERAL_CHILD_TAX_CREDIT':
      return `You are likely eligible for the federal Child Tax Credit, worth up to ${fmtUsd(cents ?? 0)}. You claim it on your yearly tax return.`;
    case 'INSURANCE_ADD_BABY':
      return `You are likely eligible to add your baby to your health insurance outside the usual sign-up period, but only for a short time.${by}`;
    case DCFSA_CODE:
      return 'Some employers offer a Dependent Care FSA (a work account that lets you pay for childcare with pre-tax money). Check with your job to see whether yours does, and ask how long you have to sign up after your baby arrives.';
    default:
      return `${title}: you are likely eligible.${cents !== null ? ` Worth ${fmtUsd(cents)}.` : ''}${by}`;
  }
}

/**
 * Pure date and scope screen for one rule (no Zetaris, no income test). Shared by the planner and the offline fallback.
 * A rule is for everyone ("federal") or for one state only (scope = that 2-letter state).
 * Returns why it is skipped, or the deadline (null = no window).
 */
export function screenRule(
  rule: { code: string; scope: string; windowEndDays: number | null },
  family: { state: string; birthDate: string | null; dueDate: string | null },
  today: string,
): { skip: string } | { deadline: string | null } {
  const anchor = family.birthDate ?? family.dueDate ?? null;
  if (rule.scope !== 'federal' && rule.scope !== family.state) return { skip: `only for ${rule.scope} families` };
  if (rule.code === 'TRUMP_ACCOUNT' && !(anchor && anchor >= TRUMP_FIRST && anchor <= TRUMP_LAST)) return { skip: 'birth outside the Trump Account years' };
  if (rule.windowEndDays === null) return { deadline: null };
  if (!anchor) return { skip: 'no birth or due date' };
  const deadline = addDays(anchor, rule.windowEndDays);
  if (deadline < today) return { skip: `window closed ${deadline}` };
  return { deadline };
}

/** Plain-English card text for a rule when no model or source is available (used by the offline fallback). */
export function ruleFallbackText(code: string, title: string, cents: number | null, deadline: string | null, unborn: boolean): string {
  return fallbackText(code, title, cents, deadline, unborn);
}

/** The Dependent Care FSA card never shows dollars or a deadline, and is never counted: it is a "Check with your job" reminder. */
export const isCheckWithJob = (code: string): boolean => code === DCFSA_CODE;

/** Work out which benefits a family likely qualifies for. Amounts and deadlines come from the rules table. */
export async function planBenefits(ctx: AgentContext, today: string): Promise<Candidate[]> {
  // Only the state and the dates (both already on the family) are used. Exact income and household size are never read.
  const rSql = rulesSql(ctx.family.state);
  const rules = await ctx.z.runQuery(rSql);

  const born = ctx.family.birthDate;
  const due = ctx.family.dueDate;
  const unborn = !born && !!due;

  const out: Candidate[] = [];
  const skipped: string[] = [];
  for (const r of rules.rows) {
    const code = s(r, 'code');
    const scope = s(r, 'scope');
    const skip = (why: string) => { skipped.push(`${code}: ${why}`); };

    const screened = screenRule({ code, scope, windowEndDays: num(r, 'window_end_days_from_birth') }, ctx.family, today);
    if ('skip' in screened) { skip(screened.skip); continue; }
    const deadline = screened.deadline;

    const checkWithJob = isCheckWithJob(code);
    const cents = checkWithJob ? null : num(r, 'amount_cents');
    const title = `${s(r, 'title')}${unborn && !checkWithJob ? ' (after birth)' : ''}`;
    const fallback = fallbackText(code, s(r, 'title'), cents, deadline, unborn);
    const facts =
      `Benefit: ${s(r, 'title')}.` + (cents !== null ? ` Amount: ${fmtUsd(cents)}.` : '') +
      (deadline ? ` Deadline: ${deadline}.` : '') + (unborn ? ' The baby is not born yet.' : '') +
      ` Rule: ${s(r, 'condition')}.`;
    // The "Check with your job" text is fixed (no model): it must never say "your employer offers" or give a dollar amount.
    const body = checkWithJob ? fallback : await explain(ctx, AGENT, facts, cents !== null ? [cents] : [], fallback);
    out.push({
      id: `benefit-${code.toLowerCase()}`, kind: 'benefit', title, body, amountCents: cents, deadline,
      verdict: checkWithJob ? 'info' : 'likely', sources: [{ label: s(r, 'title'), url: s(r, 'source_url') }],
      traceId: log(ctx, 'benefit_match', `rule ${code}`, `${cents !== null ? fmtUsd(cents) : 'no amount'}${deadline ? `, by ${deadline}` : ''}`),
      agent: AGENT, claim: { type: 'rule', ref: code }, evidenceSql: rSql, retryCount: 0,
    });
  }
  // No rule for the family's own state on file: federal cards still show, with the honest "coming soon" note (never an error).
  if (!rules.rows.some((r) => s(r, 'scope') === ctx.family.state)) {
    log(ctx, 'state_coverage', `state ${ctx.family.state}`, `${UNCOVERED_STATE_NOTE}; showing federal programs only`, 'fallback');
  }
  log(ctx, 'plan_benefits', `family ${ctx.family.id}, ${unborn ? 'due' : 'born'} date, ${ctx.family.state}`,
    `${out.length} benefit(s): ${out.map((c) => c.claim.ref).join(', ') || 'none'}; skipped ${skipped.length}`);
  return out;
}

/** Re-derive one card from the rules table after the Fact-Checker sent it back. null = give up. */
export async function revise(c: Candidate, reason: string, ctx: AgentContext, today: string = todayIso()): Promise<Candidate | null> {
  log(ctx, 'revise', `rule ${c.claim.ref}: ${reason}`.slice(0, 200), 're-deriving from source', 'retry', c.retryCount + 1);
  const fresh = await planBenefits(ctx, today);
  const match = fresh.find((f) => f.claim.ref === c.claim.ref);
  if (!match) {
    log(ctx, 'revise', `rule ${c.claim.ref}`, 'gave up: not in source data', 'blocked', c.retryCount + 1);
    return null;
  }
  return { ...match, retryCount: c.retryCount + 1 };
}

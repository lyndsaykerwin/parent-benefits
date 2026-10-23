import { col, quoteId, quoteInt, addDays, today as todayIso, fmtUsd, InvalidId } from './sql';
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
/** WIC screen: household income at or below 185% of the poverty line. */
const WIC_PERCENT = 185;
const POVERTY_YEAR = 2026;

export function rulesSql(): string {
  return (
    'SELECT code, title, scope, amount_cents, window_start_days_from_birth, window_end_days_from_birth, condition, source_url ' +
    'FROM bundle_pg.benefit_rules ORDER BY code'
  );
}

export function familySql(familyId: string): string {
  return (
    'SELECT id, birth_date, due_date, state, household_size, annual_income_cents, dcfsa_offered ' +
    `FROM bundle_pg.v_planner_family WHERE id = ${quoteId(familyId)}`
  );
}

export function povertySql(householdSize: number): string {
  return (
    'SELECT household_size, annual_cents, year FROM bundle_pg.poverty_guidelines ' +
    `WHERE year = ${POVERTY_YEAR} AND household_size = ${quoteInt(householdSize)}`
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
    case 'MA_CHILD_TAX_CREDIT':
      return `As a Massachusetts resident, you are likely eligible for the state Child and Family Tax Credit of ${fmtUsd(cents ?? 0)}, claimed on your state tax return.`;
    case 'INSURANCE_ADD_BABY':
      return `You are likely eligible to add your baby to your health insurance outside the usual sign-up period, but only for a short time.${by}`;
    case 'DCFSA_LIFE_EVENT':
      return `Your employer offers a Dependent Care FSA (a work account for daycare costs), and you are likely eligible to start or change it because of your new baby.${by}`;
    case 'MA_PFML':
      return `You are likely eligible for Massachusetts Paid Family and Medical Leave, which may pay you while you are off work with your baby.${by}`;
    case 'WIC_SCREEN':
      return 'Your household is likely within the income limit for WIC (a government food program for pregnant women and young children), so it is worth a screening.';
    default:
      return `${title}: you are likely eligible.${cents !== null ? ` Worth ${fmtUsd(cents)}.` : ''}${by}`;
  }
}

/** Work out which benefits a family likely qualifies for. Amounts and deadlines come from the rules table. */
export async function planBenefits(ctx: AgentContext, today: string): Promise<Candidate[]> {
  let famSql: string;
  try {
    famSql = familySql(ctx.family.id);
  } catch (e) {
    if (e instanceof InvalidId) {
      log(ctx, 'plan_benefits', 'family', 'unsafe family id: nothing queried', 'error');
      return [];
    }
    throw e;
  }
  const rSql = rulesSql();
  const [rules, fam] = await Promise.all([ctx.z.runQuery(rSql), ctx.z.runQuery(famSql)]);
  const f = fam.rows[0];
  // Income and household size come from the planner view (the only one that carries income); dates and state from the family.
  const incomeCents = f ? num(f, 'annual_income_cents') : ctx.family.annualIncomeCents;
  const householdSize = (f ? num(f, 'household_size') : null) ?? ctx.family.householdSize;
  const dcfsaOffered = f ? ['true', '1', 't'].includes(String(col(f, 'dcfsa_offered')).toLowerCase()) : ctx.family.dcfsaOffered;

  const born = ctx.family.birthDate;
  const due = ctx.family.dueDate;
  const anchor = born ?? due ?? null;
  const unborn = !born && !!due;

  // WIC needs the poverty line for this household size, read from the table (never hard-coded).
  let wicOk = false;
  if (incomeCents !== null && Number.isFinite(householdSize) && Number.isInteger(householdSize)) {
    const { rows } = await ctx.z.runQuery(povertySql(householdSize));
    const line = rows.length ? num(rows[0], 'annual_cents') : null;
    if (line !== null) wicOk = incomeCents * 100 <= line * WIC_PERCENT;
  }

  const out: Candidate[] = [];
  const skipped: string[] = [];
  for (const r of rules.rows) {
    const code = s(r, 'code');
    const scope = s(r, 'scope');
    const skip = (why: string) => { skipped.push(`${code}: ${why}`); };

    if (scope === 'MA' && ctx.family.state !== 'MA') { skip('Massachusetts only'); continue; }
    if (code === 'DCFSA_LIFE_EVENT' && !dcfsaOffered) { skip('employer has no Dependent Care FSA'); continue; }
    if (code === 'TRUMP_ACCOUNT' && !(anchor && anchor >= TRUMP_FIRST && anchor <= TRUMP_LAST)) { skip('birth outside the Trump Account years'); continue; }
    if (code === 'WIC_SCREEN' && !wicOk) { skip('income above the WIC line or unknown'); continue; }

    const windowEnd = num(r, 'window_end_days_from_birth');
    let deadline: string | null = null;
    if (windowEnd !== null) {
      if (!anchor) { skip('no birth or due date'); continue; }
      deadline = addDays(anchor, windowEnd);
      if (deadline < today) { skip(`window closed ${deadline}`); continue; }
    }

    const cents = num(r, 'amount_cents');
    const title = `${s(r, 'title')}${unborn ? ' (after birth)' : ''}`;
    const fallback = fallbackText(code, s(r, 'title'), cents, deadline, unborn);
    const facts =
      `Benefit: ${s(r, 'title')}.` + (cents !== null ? ` Amount: ${fmtUsd(cents)}.` : '') +
      (deadline ? ` Deadline: ${deadline}.` : '') + (unborn ? ' The baby is not born yet.' : '') +
      ` Rule: ${s(r, 'condition')}.`;
    const body = await explain(ctx, AGENT, facts, cents !== null ? [cents] : [], fallback);
    out.push({
      id: `benefit-${code.toLowerCase()}`, kind: 'benefit', title, body, amountCents: cents, deadline,
      verdict: 'likely', sources: [{ label: s(r, 'title'), url: s(r, 'source_url') }],
      traceId: log(ctx, 'benefit_match', `rule ${code}`, `${cents !== null ? fmtUsd(cents) : 'no amount'}${deadline ? `, by ${deadline}` : ''}`),
      agent: AGENT, claim: { type: 'rule', ref: code }, evidenceSql: rSql, retryCount: 0,
    });
  }
  log(ctx, 'plan_benefits', `family ${ctx.family.id}, ${unborn ? 'due' : 'born'} date, ${ctx.family.state}`,
    `${out.length} benefit(s): ${out.map((c) => c.claim.ref).join(', ') || 'none'}; skipped ${skipped.length}`);
  return out;
}

/** Re-derive one card from the rules table after the Fact-Checker sent it back. null = give up. */
export async function revise(c: Candidate, reason: string, ctx: AgentContext): Promise<Candidate | null> {
  log(ctx, 'revise', `rule ${c.claim.ref}: ${reason}`.slice(0, 200), 're-deriving from source', 'retry', c.retryCount + 1);
  const fresh = await planBenefits(ctx, todayIso());
  const match = fresh.find((f) => f.claim.ref === c.claim.ref);
  if (!match) {
    log(ctx, 'revise', `rule ${c.claim.ref}`, 'gave up: not in source data', 'blocked', c.retryCount + 1);
    return null;
  }
  return { ...match, retryCount: c.retryCount + 1 };
}

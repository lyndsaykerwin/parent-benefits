import { col, isInlineFamily, quoteId, quoteDate, InvalidId, addDays, today, fmtUsd, dupKey } from './sql';
import { explain } from './explain';
import { DCFSA_CAP_CENTS } from './factChecker';
import type { AgentContext, Candidate } from './types';

const AGENT = 'clawback';

type Row = Record<string, string | number | null>;
const s = (r: Row, k: string) => String(col(r, k) ?? '');
const n = (r: Row, k: string) => Number(col(r, k) ?? 0);

/** Does a transaction's item description or merchant contain a keyword? The match happens inside Zetaris. */
const KEYWORD_MATCH =
  "(lower(t.category) LIKE concat('%', lower(c.keyword), '%') OR lower(t.merchant) LIKE concat('%', lower(c.keyword), '%'))";

export function fsaSql(familyId: string): string {
  return (
    'SELECT DISTINCT t.id AS tx_id, t.merchant AS merchant, t.date AS date, t.amount_cents AS amount_cents, ' +
    't.category AS item, c.keyword AS keyword, c.category AS fsa_category, c.account AS account, c.source_url AS source_url ' +
    'FROM bundle_pg.v_clawback_tx t ' +
    `JOIN bundle_pg.fsa_eligible_categories c ON c.account <> 'DCFSA' AND ${KEYWORD_MATCH} ` +
    `WHERE t.family_id = ${quoteId(familyId)} AND t.amount_cents > 0 ORDER BY date, tx_id`
  );
}

export function priceSql(familyId: string): string {
  return (
    'SELECT t.id AS tx_id, t.merchant AS merchant, t.date AS date, t.amount_cents AS amount_cents, t.category AS item, ' +
    'sp.adjustment_window_days AS window_days, po.price_cents AS observed_price_cents, po.observed_at AS observed_at, ' +
    'sp.source_url AS store_source_url, po.source_url AS price_source_url ' +
    'FROM bundle_pg.v_clawback_tx t ' +
    'JOIN bundle_pg.store_policies sp ON lower(sp.store) = lower(t.merchant) ' +
    'JOIN bundle_pg.price_observations po ON lower(po.store) = lower(sp.store) ' +
    "AND lower(t.category) LIKE concat('%', lower(po.keyword), '%') " +
    `WHERE t.family_id = ${quoteId(familyId)} AND t.amount_cents > 0 ` +
    'AND po.price_cents < t.amount_cents ' +
    'AND datediff(CAST(po.observed_at AS date), CAST(t.date AS date)) BETWEEN 0 AND sp.adjustment_window_days ' +
    'ORDER BY t.date, t.id'
  );
}

export function daycareSql(familyId: string, year: number): string {
  return (
    'SELECT DISTINCT t.id AS tx_id, t.merchant AS merchant, t.date AS date, t.amount_cents AS amount_cents, c.source_url AS source_url ' +
    'FROM bundle_pg.v_clawback_tx t ' +
    `JOIN bundle_pg.fsa_eligible_categories c ON c.account = 'DCFSA' AND ${KEYWORD_MATCH} ` +
    `WHERE t.family_id = ${quoteId(familyId)} AND t.amount_cents > 0 ` +
    `AND t.date >= ${quoteDate(`${year}-01-01`)} AND t.date <= ${quoteDate(`${year}-12-31`)} ORDER BY date, tx_id`
  );
}

function log(ctx: AgentContext, action: string, input: string, output: string, status: 'ok' | 'retry' | 'blocked' | 'error' | 'fallback' = 'ok', retry = 0): string {
  return ctx.trace.log({
    agent_name: AGENT, action, input_summary: input, output_summary: output,
    target_agent: null, confidence: null, retry_count: retry, status,
  });
}

async function fsaCandidates(ctx: AgentContext, seen: Set<string>): Promise<Candidate[]> {
  const sql = fsaSql(ctx.family.id);
  const { rows } = await ctx.z.runQuery(sql);
  const out: Candidate[] = [];
  for (const r of rows) {
    const cents = n(r, 'amount_cents');
    if (cents <= 0) continue;
    const key = dupKey(s(r, 'merchant'), s(r, 'date').slice(0, 10), cents);
    if (seen.has(key)) continue; // duplicate listing of the same purchase (or the same tx matched by two keywords)
    seen.add(key);
    const item = s(r, 'item') || s(r, 'merchant');
    const fallback = `You paid ${fmtUsd(cents)} at ${s(r, 'merchant')} for ${item}. It is likely eligible (${s(r, 'fsa_category')}), so you may be able to reimburse it from your health FSA or HSA.`;
    const body = await explain(ctx, AGENT, `Purchase: ${item} at ${s(r, 'merchant')} for ${fmtUsd(cents)}. Likely ${s(r, 'account')}-eligible as: ${s(r, 'fsa_category')}.`, [cents], fallback);
    const id = `clawback-fsa-${s(r, 'tx_id')}`;
    out.push({
      id, kind: 'clawback', title: `Reimburse your ${item}`, body, amountCents: cents, deadline: null,
      verdict: 'verified', sources: [{ label: `${s(r, 'fsa_category')} (eligible-items list)`, url: s(r, 'source_url') }],
      traceId: log(ctx, 'fsa_reimbursement', `tx ${s(r, 'tx_id')}`, `${fmtUsd(cents)} likely ${s(r, 'account')}-eligible`),
      agent: AGENT, claim: { type: 'fsa_reimbursement', txId: s(r, 'tx_id'), txAmountCents: cents },
      evidenceSql: sql, retryCount: 0,
    });
  }
  return out;
}

async function priceCandidates(ctx: AgentContext, seen: Set<string>): Promise<Candidate[]> {
  const sql = priceSql(ctx.family.id);
  const { rows } = await ctx.z.runQuery(sql);
  // One candidate per purchase: the lowest price seen inside that store's window.
  const best = new Map<string, Row>();
  for (const r of rows) {
    const paid = n(r, 'amount_cents');
    const price = n(r, 'observed_price_cents');
    const date = s(r, 'date').slice(0, 10);
    const end = addDays(date, n(r, 'window_days'));
    const seenOn = s(r, 'observed_at').slice(0, 10);
    // Re-check the window in code as well, so a surprising query result can never leak through.
    if (paid <= 0 || price >= paid || seenOn < date || seenOn > end) continue;
    const id = s(r, 'tx_id');
    const cur = best.get(id);
    if (!cur || price < n(cur, 'observed_price_cents')) best.set(id, r);
  }
  const out: Candidate[] = [];
  for (const r of best.values()) {
    const paid = n(r, 'amount_cents');
    const cents = paid - n(r, 'observed_price_cents');
    const date = s(r, 'date').slice(0, 10);
    const key = dupKey(s(r, 'merchant'), date, paid);
    if (seen.has(`price|${key}`)) continue;
    seen.add(`price|${key}`);
    const deadline = addDays(date, n(r, 'window_days'));
    const item = s(r, 'item');
    const fallback = `You paid ${fmtUsd(paid)} for ${item} at ${s(r, 'merchant')} on ${date}. The price is now ${fmtUsd(n(r, 'observed_price_cents'))}, and ${s(r, 'merchant')} adjusts prices for ${n(r, 'window_days')} days, so ask for ${fmtUsd(cents)} back by ${deadline}.`;
    const body = await explain(ctx, AGENT, `Bought ${item} at ${s(r, 'merchant')} for ${fmtUsd(paid)} on ${date}. Price dropped to ${fmtUsd(n(r, 'observed_price_cents'))} on ${s(r, 'observed_at')}. Store adjusts prices for ${n(r, 'window_days')} days; ask by ${deadline}. Difference ${fmtUsd(cents)}.`, [paid, n(r, 'observed_price_cents'), cents], fallback);
    out.push({
      id: `clawback-price-${s(r, 'tx_id')}`, kind: 'clawback', title: `Price drop on your ${item}`, body, amountCents: cents, deadline,
      verdict: 'verified',
      sources: [
        { label: `${s(r, 'merchant')} price-adjustment policy`, url: s(r, 'store_source_url') },
        { label: 'Price check', url: s(r, 'price_source_url') },
      ],
      traceId: log(ctx, 'price_adjustment', `tx ${s(r, 'tx_id')}`, `${fmtUsd(cents)} back by ${deadline}`),
      agent: AGENT, claim: { type: 'price_adjustment', txId: s(r, 'tx_id'), txAmountCents: paid },
      evidenceSql: sql, retryCount: 0,
    });
  }
  return out;
}

async function daycareCandidates(ctx: AgentContext): Promise<Candidate[]> {
  if (!ctx.family.dcfsaOffered) return [];
  const year = Number((ctx.today ?? today()).slice(0, 4));
  const sql = daycareSql(ctx.family.id, year);
  const { rows } = await ctx.z.runQuery(sql);
  const seen = new Set<string>();
  const pay: Row[] = [];
  for (const r of rows) {
    const cents = n(r, 'amount_cents');
    const key = dupKey(s(r, 'merchant'), s(r, 'date').slice(0, 10), cents);
    if (cents <= 0 || seen.has(key)) continue;
    seen.add(key);
    pay.push(r);
  }
  if (!pay.length) return [];
  const total = pay.reduce((a, r) => a + n(r, 'amount_cents'), 0);
  const cents = Math.min(total, DCFSA_CAP_CENTS);
  const last = pay[pay.length - 1];
  const who = s(pay[0], 'merchant');
  const fallback = `You paid ${fmtUsd(total)} to ${who} in ${pay.length} payment${pay.length === 1 ? '' : 's'} this year. Your employer offers a Dependent Care FSA (a work account that lets you pay for daycare with pre-tax dollars, up to ${fmtUsd(DCFSA_CAP_CENTS)} a year). You are likely eligible to pay up to ${fmtUsd(cents)} of daycare with pre-tax dollars. This is eligible spend, not money back.`;
  const body = await explain(ctx, AGENT, `Daycare payments to ${who} in ${year}: ${pay.length}, total ${fmtUsd(total)}. Employer offers a Dependent Care FSA with a yearly limit of ${fmtUsd(DCFSA_CAP_CENTS)}. Up to ${fmtUsd(cents)} of daycare can be paid with pre-tax dollars through the family's dependent-care FSA. This is eligible spend, not money back.`, [total, cents, DCFSA_CAP_CENTS], fallback);
  return [{
    id: `clawback-dcfsa-${ctx.family.id}-${year}`, kind: 'clawback', title: 'Your daycare payments may qualify for a Dependent Care FSA',
    body, amountCents: cents, deadline: null, verdict: 'likely',
    sources: [{ label: 'IRS Publication 503 (dependent care)', url: s(pay[0], 'source_url') }],
    traceId: log(ctx, 'dcfsa_childcare', `${pay.length} payments in ${year}`, `${fmtUsd(cents)} likely eligible`),
    agent: AGENT,
    claim: { type: 'dcfsa_childcare', txId: s(last, 'tx_id'), txAmountCents: n(last, 'amount_cents'), planYear: year },
    evidenceSql: sql, retryCount: 0,
  }];
}

/** Find money a family can get back: FSA reimbursements, store price adjustments, Dependent Care FSA. */
export async function findClawbacks(ctx: AgentContext): Promise<Candidate[]> {
  if (isInlineFamily(ctx.family)) {
    log(ctx, 'find_clawbacks', 'typed-in family', 'no saved purchases to look up: nothing queried');
    return [];
  }
  try {
    quoteId(ctx.family.id);
  } catch (e) {
    if (e instanceof InvalidId) {
      log(ctx, 'find_clawbacks', 'family', 'unsafe family id: nothing queried', 'error');
      return [];
    }
    throw e;
  }
  const seen = new Set<string>();
  const out = [
    ...(await fsaCandidates(ctx, seen)),
    ...(await priceCandidates(ctx, seen)),
    ...(await daycareCandidates(ctx)),
  ];
  log(ctx, 'find_clawbacks', `family ${ctx.family.id}`, `${out.length} candidate(s): ${out.map((c) => c.claim.type).join(', ') || 'none'}`);
  return out;
}

/** Re-derive one candidate from the source data after the Fact-Checker sent it back. null = give up. */
export async function revise(c: Candidate, reason: string, ctx: AgentContext): Promise<Candidate | null> {
  log(ctx, 'revise', `${c.claim.type} ${c.claim.txId}: ${reason}`.slice(0, 200), 're-deriving from source', 'retry', c.retryCount + 1);
  const fresh = await findClawbacks(ctx);
  const match = fresh.find((f) => f.claim.type === c.claim.type && (c.claim.type === 'dcfsa_childcare' || f.claim.txId === c.claim.txId));
  if (!match) {
    log(ctx, 'revise', `${c.claim.type} ${c.claim.txId}`, 'gave up: not in source data', 'blocked', c.retryCount + 1);
    return null;
  }
  return { ...match, retryCount: c.retryCount + 1 };
}

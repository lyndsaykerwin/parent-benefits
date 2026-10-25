import { col, isInlineFamily, quoteId, InvalidId, addDays, fmtUsd, dupKey } from './sql';
import { explain } from './explain';
import { findRecalledItems, itemKey, pairsSql } from './recall';
import type { AgentContext, Candidate } from './types';

const AGENT = 'clawback';

type Row = Record<string, string | number | null>;
const s = (r: Row, k: string) => String(col(r, k) ?? '');
const n = (r: Row, k: string) => Number(col(r, k) ?? 0);

/**
 * Money-back cards come ONLY from `purchase_items` rows that carry a price (photos, receipts, email receipts),
 * read through the Zetaris safe-columns view v_purchase_items (plan v3 sign-off items 8 and 9).
 * `price_cents` is what the family paid for that line.
 */
const ITEMS = 'bundle_pg.v_purchase_items p';

/** Does an item's name contain a keyword? The match happens inside Zetaris. */
const KEYWORD_MATCH = "lower(p.product_name) LIKE concat('%', lower(c.keyword), '%')";

export function fsaSql(familyId: string): string {
  return (
    'SELECT DISTINCT p.id AS item_id, COALESCE(p.store, p.seller) AS merchant, p.purchased_on AS date, p.price_cents AS amount_cents, ' +
    'p.product_name AS item, c.keyword AS keyword, c.category AS fsa_category, c.account AS account, c.source_url AS source_url ' +
    `FROM ${ITEMS} ` +
    `JOIN bundle_pg.fsa_eligible_categories c ON c.account IN ('FSA', 'HSA') AND ${KEYWORD_MATCH} ` +
    `WHERE p.family_id = ${quoteId(familyId)} AND p.price_cents > 0 ORDER BY date, item_id`
  );
}

export function priceSql(familyId: string): string {
  return (
    'SELECT p.id AS item_id, COALESCE(p.store, p.seller) AS merchant, p.purchased_on AS date, p.price_cents AS amount_cents, p.product_name AS item, ' +
    'sp.adjustment_window_days AS window_days, po.price_cents AS observed_price_cents, po.observed_at AS observed_at, ' +
    'sp.source_url AS store_source_url, po.source_url AS price_source_url ' +
    `FROM ${ITEMS} ` +
    'JOIN bundle_pg.store_policies sp ON lower(sp.store) = lower(COALESCE(p.store, p.seller)) ' +
    'JOIN bundle_pg.price_observations po ON lower(po.store) = lower(sp.store) ' +
    "AND lower(p.product_name) LIKE concat('%', lower(po.keyword), '%') " +
    `WHERE p.family_id = ${quoteId(familyId)} AND p.price_cents > 0 ` +
    'AND po.price_cents < p.price_cents ' +
    'AND datediff(CAST(po.observed_at AS date), CAST(p.purchased_on AS date)) BETWEEN 0 AND sp.adjustment_window_days ' +
    'ORDER BY p.purchased_on, p.id'
  );
}

/** The item each candidate is about, so the safety check can ask the Recall Checker by name. */
const itemOf = new WeakMap<Candidate, string>();

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
    const id = `clawback-fsa-${s(r, 'item_id')}`;
    const cand: Candidate = {
      id, kind: 'clawback', title: `Reimburse your ${item}`, body, amountCents: cents, deadline: null,
      verdict: 'verified', sources: [{ label: `${s(r, 'fsa_category')} (eligible-items list)`, url: s(r, 'source_url') }],
      traceId: log(ctx, 'fsa_reimbursement', `item ${s(r, 'item_id')}`, `${fmtUsd(cents)} likely ${s(r, 'account')}-eligible`),
      agent: AGENT, claim: { type: 'fsa_reimbursement', itemId: s(r, 'item_id'), itemAmountCents: cents },
      evidenceSql: sql, retryCount: 0,
    };
    itemOf.set(cand, item);
    out.push(cand);
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
    const id = s(r, 'item_id');
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
    const cand: Candidate = {
      id: `clawback-price-${s(r, 'item_id')}`, kind: 'clawback', title: `Price drop on your ${item}`, body, amountCents: cents, deadline,
      verdict: 'verified',
      sources: [
        { label: `${s(r, 'merchant')} price-adjustment policy`, url: s(r, 'store_source_url') },
        { label: 'Price check', url: s(r, 'price_source_url') },
      ],
      traceId: log(ctx, 'price_adjustment', `item ${s(r, 'item_id')}`, `${fmtUsd(cents)} back by ${deadline}`),
      agent: AGENT, claim: { type: 'price_adjustment', itemId: s(r, 'item_id'), itemAmountCents: paid },
      evidenceSql: sql, retryCount: 0,
    };
    itemOf.set(cand, item);
    out.push(cand);
  }
  return out;
}

const KILL_LINE = 'do not encourage buying or claiming a rebate on this item';

/** Leave a note for another agent in the shared workspace. A workspace problem must never stop the safety check. */
function tell(ctx: AgentContext, from: string, to: string, type: 'question' | 'answer' | 'verdict', about: string, body: string): void {
  try {
    ctx.workspace?.post({ from_agent: from, to_agent: to, type, about, body, evidence_sql: pairsSql(ctx.family.id), round: 0 });
  } catch (e) {
    log(ctx, 'workspace_note', about, `note not posted (${String((e as Error)?.message ?? e).slice(0, 80)})`, 'fallback');
  }
}

/**
 * The safety-value loop (loop 1). Before a price drop or rebate is published, the Clawback Hunter asks the Recall
 * Checker, through the workspace, whether that item is under a CPSC or FDA recall. A recalled item's deal is killed
 * here, before the Judge ever sees it: a money-back card must never nudge a parent toward a dangerous product.
 * If the Recall Checker cannot be reached the deals are kept and the trace says so (it is never silent).
 */
async function safetyGate(ctx: AgentContext, cands: Candidate[]): Promise<Candidate[]> {
  if (!cands.length) return cands;
  let recalled: Awaited<ReturnType<typeof findRecalledItems>>;
  try {
    recalled = await findRecalledItems(ctx);
  } catch (e) {
    log(ctx, 'safety_check', `${cands.length} deal(s)`, `Recall Checker unavailable (${String((e as Error)?.message ?? e).slice(0, 80)}): deals kept, not safety-checked`, 'fallback');
    return cands;
  }
  const kept: Candidate[] = [];
  for (const c of cands) {
    const item = itemOf.get(c) ?? '';
    const what = c.claim.type === 'price_adjustment' ? 'price drop' : 'reimbursement';
    tell(ctx, 'ClawbackHunter', 'RecallChecker', 'question', c.id, `Is "${item}" under a CPSC or FDA recall? I am about to publish a ${what} on it.`);
    const hit = recalled.get(itemKey(item));
    if (!hit) {
      tell(ctx, 'RecallChecker', 'ClawbackHunter', 'answer', c.id, `No open CPSC or FDA recall matched "${item}".`);
      log(ctx, 'safety_check', `${c.id}: ${item.slice(0, 80)}`, 'asked the Recall Checker: no recall matched, deal can go on');
      kept.push(c);
      continue;
    }
    tell(ctx, 'RecallChecker', 'ClawbackHunter', 'answer', c.id, `Yes: recall ${hit.recallId} (${hit.recallTitle}). Evidence: ${hit.evidence}.`);
    tell(ctx, 'ClawbackHunter', 'Orchestrator', 'verdict', c.id, `Deal killed: "${item}" is under recall ${hit.recallId}; ${KILL_LINE}.`);
    ctx.trace.log({
      agent_name: AGENT, action: 'safety_kill', input_summary: `${c.id}: ${item.slice(0, 80)}`,
      output_summary: `killed before the Judge: recall ${hit.recallId} (${hit.evidence}); ${KILL_LINE}`,
      target_agent: null, confidence: null, retry_count: 0, status: 'blocked',
      agentLog: { agent: 'ClawbackHunter', action: 'reject_card', status: 'rejected', target: 'RecallChecker' },
    });
  }
  return kept;
}

/** Find money a family can get back: FSA reimbursements and store price adjustments, from purchase_items only. */
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
  const found = [
    ...(await fsaCandidates(ctx, seen)),
    ...(await priceCandidates(ctx, seen)),
  ];
  const out = await safetyGate(ctx, found);
  log(ctx, 'find_clawbacks', `family ${ctx.family.id}`, `${out.length} candidate(s)${found.length > out.length ? ` (${found.length - out.length} killed by the recall check)` : ''}: ${out.map((c) => c.claim.type).join(', ') || 'none'}`);
  return out;
}

/** Re-derive one candidate from the source data after the Fact-Checker sent it back. null = give up. */
export async function revise(c: Candidate, reason: string, ctx: AgentContext): Promise<Candidate | null> {
  log(ctx, 'revise', `${c.claim.type} ${c.claim.itemId}: ${reason}`.slice(0, 200), 're-deriving from source', 'retry', c.retryCount + 1);
  const fresh = await findClawbacks(ctx);
  const match = fresh.find((f) => f.claim.type === c.claim.type && f.claim.itemId === c.claim.itemId);
  if (!match) {
    log(ctx, 'revise', `${c.claim.type} ${c.claim.itemId}`, 'gave up: not in source data', 'blocked', c.retryCount + 1);
    return null;
  }
  return { ...match, retryCount: c.retryCount + 1 };
}

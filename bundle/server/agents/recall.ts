import { askJson } from '../adapters/llm';
import { col, quoteId, InvalidId, isInlineFamily } from './sql';
import { explain } from './explain';
import type { AgentContext, Candidate } from './types';

const AGENT = 'recall';
const MAX_PAIRS = 25; // keeps the model cost and the run time bounded

type Row = Record<string, string | number | null>;
const s = (r: Row, k: string) => String(col(r, k) ?? '');

/** Words too generic to prove two product names refer to the same thing. */
const STOP = ['baby', 'infant', 'child', 'kids', 'kid', 'toddler', 'newborn', 'crib', 'with', 'from', 'pack', 'size', 'count', 'and', 'the', 'for', 'set', 'new', 'little', 'light', 'night'];
const STOP_SQL = `array(${STOP.map((w) => `'${w}'`).join(', ')})`;

/** Lower-case words of a text, minus short and generic ones, as a Zetaris array expression. */
const tokens = (expr: string) =>
  `filter(split(trim(regexp_replace(lower(${expr}), '[^a-z0-9]+', ' ')), ' '), w -> length(w) >= 3 AND NOT array_contains(${STOP_SQL}, w))`;
const brand = (expr: string) => `split(trim(regexp_replace(lower(${expr}), '[^a-z0-9]+', ' ')), ' ')[0]`;

/**
 * Rule for "looks like a product": a card row's item text counts only if it is not a service or a
 * generic spending category (childcare / daycare / tuition, groceries, restaurants, gas, utilities, rent, etc.).
 */
const NON_PRODUCT_WORDS = ['daycare', 'childcare', 'child care', 'tuition'];
const GENERIC_CATEGORIES = ['groceries', 'restaurants', 'dining', 'gas', 'fuel', 'utilities', 'rent', 'mortgage', 'insurance', 'transfer', 'payment'];
const NOT_A_PRODUCT =
  `NOT (${NON_PRODUCT_WORDS.map((w) => `lower(category) LIKE '%${w}%'`).join(' OR ')}) ` +
  `AND lower(trim(category)) NOT IN (${GENERIC_CATEGORIES.map((w) => `'${w}'`).join(', ')})`;

/** Everything the family bought: Amazon titles (from v_recall_orders) plus the item text on card purchases. */
function itemsSelect(familyId: string): string {
  const f = quoteId(familyId);
  return (
    'SELECT item_text, source, purchased_on FROM (' +
    `SELECT item_text, source, purchased_on FROM bundle_pg.v_recall_orders WHERE family_id = ${f} AND source = 'amazon' AND price_cents > 0 ` +
    'UNION ALL ' +
    `SELECT category AS item_text, 'card' AS source, date AS purchased_on FROM bundle_pg.v_clawback_tx WHERE family_id = ${f} AND amount_cents > 0 AND category <> '' AND ${NOT_A_PRODUCT}` +
    ') u'
  );
}

export function itemsSql(familyId: string): string {
  return `SELECT DISTINCT item_text, source FROM (${itemsSelect(familyId)}) a ORDER BY item_text`;
}

/** One statement: purchases x (CPSC + openFDA) recalls, joined inside Zetaris on a brand word or two real title words. */
export function pairsSql(familyId: string): string {
  const cpsc =
    "SELECT 'cpsc' AS recall_source, CAST(RecallID AS bigint) AS recall_id, CAST(RecallNumber AS string) AS recall_number, " +
    'substr(RecallDate, 1, 10) AS recall_date, Title AS recall_title, URL AS recall_url, p.Name AS recalled_product ' +
    'FROM bundle_live.cpsc_recalls LATERAL VIEW explode(Products) t AS p';
  const dateFix = (d: string) => `concat(substr(CAST(${d} AS string), 1, 4), '-', substr(CAST(${d} AS string), 5, 2), '-', substr(CAST(${d} AS string), 7, 2))`;
  const fda =
    "SELECT 'fda' AS recall_source, CAST(NULL AS bigint) AS recall_id, x.recall_number AS recall_number, " +
    `${dateFix('x.recall_initiation_date')} AS recall_date, concat('FDA recall: ', x.recalling_firm) AS recall_title, ` +
    "'https://www.accessdata.fda.gov/scripts/ires/index.cfm' AS recall_url, x.product_description AS recalled_product " +
    'FROM bundle_live.fda_food_recalls LATERAL VIEW explode(results) t AS x';
  return (
    'SELECT i.item_text AS item_text, i.purchased_on AS purchased_on, i.source AS source, r.recall_source AS recall_source, ' +
    'r.recall_id AS recall_id, r.recall_number AS recall_number, r.recall_date AS recall_date, r.recall_title AS recall_title, ' +
    'r.recall_url AS recall_url, r.recalled_product AS recalled_product ' +
    `FROM (${itemsSelect(familyId)}) i JOIN (SELECT * FROM (${cpsc}) c UNION ALL SELECT * FROM (${fda}) f) r ` +
    "ON lower(i.item_text) LIKE concat('%', lower(r.recalled_product), '%') " +
    `OR size(array_intersect(${tokens('i.item_text')}, ${tokens('r.recalled_product')})) >= 2 ` +
    `OR (length(${brand('r.recalled_product')}) >= 4 AND NOT array_contains(${STOP_SQL}, ${brand('r.recalled_product')}) ` +
    `AND array_contains(${tokens('i.item_text')}, ${brand('r.recalled_product')})) ` +
    'ORDER BY r.recall_date DESC'
  );
}

const norm = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();
/** The only match we accept without a model: the recalled product's whole name appears in what was bought. */
export const exactContainment = (item: string, product: string): boolean => {
  const p = norm(product);
  return p.length >= 4 && norm(item).includes(p);
};

function log(ctx: AgentContext, action: string, input: string, output: string, status: 'ok' | 'retry' | 'blocked' | 'error' | 'fallback' = 'ok', retry = 0): string {
  return ctx.trace.log({
    agent_name: AGENT, action, input_summary: input, output_summary: output,
    target_agent: null, confidence: null, retry_count: retry, status,
  });
}

interface Judged { row: Row; exact: boolean }

async function judgePair(ctx: AgentContext, row: Row): Promise<Judged | null> {
  const item = s(row, 'item_text');
  const product = s(row, 'recalled_product');
  const exact = exactContainment(item, product);
  // An exact product-name match is never second-guessed by the model.
  if (exact) return { row, exact };
  const prompt =
    'Is the product a family bought the SAME product (same brand and model) as the product named in a safety recall? ' +
    'Different products from the same category do not count. Reply as JSON: {"same": true} or {"same": false}.\n' +
    `Bought: ${item}\nRecalled: ${product}\nRecall: ${s(row, 'recall_title')}`;
  const { value, usedFallback } = await askJson<{ same: boolean }>(
    ctx.llm, prompt, (x): x is { same: boolean } => typeof (x as any)?.same === 'boolean', { same: false },
  );
  if (usedFallback) log(ctx, 'confirm_match', item.slice(0, 80), `no model answer: loose match rejected`, 'fallback');
  return value.same ? { row, exact } : null;
}

async function toCandidate(ctx: AgentContext, j: Judged): Promise<Candidate> {
  const r = j.row;
  const fda = s(r, 'recall_source') === 'fda';
  const item = s(r, 'item_text');
  const bought = s(r, 'purchased_on').slice(0, 10);
  const fallback = `You bought "${item}"${bought ? ` on ${bought}` : ''}. ${s(r, 'recall_title')} (recall date ${s(r, 'recall_date')}). Check the official notice and stop using the item if it is the same product.`;
  const body = await explain(ctx, AGENT, `Bought: ${item}. Recalled product: ${s(r, 'recalled_product')}. Recall: ${s(r, 'recall_title')} dated ${s(r, 'recall_date')}.`, [], fallback);
  const claim: Candidate['claim'] = fda
    ? { type: 'recall', recallSource: 'fda', recallNumber: s(r, 'recall_number') }
    : { type: 'recall', recallId: Number(col(r, 'recall_id')) };
  const key = fda ? `fda-${s(r, 'recall_number')}` : `cpsc-${s(r, 'recall_id')}`;
  return {
    id: `recall-${key}`, kind: 'recall', title: `Recall alert: ${s(r, 'recalled_product')}`.slice(0, 120), body,
    amountCents: null, deadline: null, verdict: j.exact ? 'verified' : 'likely',
    sources: [{ label: fda ? 'FDA recall notice' : 'CPSC recall notice', url: s(r, 'recall_url') }],
    traceId: log(ctx, 'recall_match', `${item.slice(0, 60)} vs ${s(r, 'recalled_product').slice(0, 60)}`, `${key}, ${j.exact ? 'exact name' : 'model-confirmed'}`),
    agent: AGENT, claim, evidenceSql: pairsSql(ctx.family.id), retryCount: 0,
  };
}

/** Safety-check what a family bought against live CPSC and FDA recalls. */
export async function checkRecalls(ctx: AgentContext): Promise<{ candidates: Candidate[]; itemsChecked: number }> {
  if (isInlineFamily(ctx.family)) {
    log(ctx, 'check_recalls', 'typed-in family', 'no saved purchases to check: nothing queried');
    return { candidates: [], itemsChecked: 0 };
  }
  let itemsSqlText: string;
  let pairs: string;
  try {
    itemsSqlText = itemsSql(ctx.family.id);
    pairs = pairsSql(ctx.family.id);
  } catch (e) {
    if (e instanceof InvalidId) {
      log(ctx, 'check_recalls', 'family', 'unsafe family id: nothing queried', 'error');
      return { candidates: [], itemsChecked: 0 };
    }
    throw e;
  }
  const items = await ctx.z.runQuery(itemsSqlText);
  const distinct = new Set(items.rows.map((r) => norm(s(r, 'item_text'))).filter(Boolean));
  const itemsChecked = distinct.size;
  if (itemsChecked === 0) {
    log(ctx, 'check_recalls', `family ${ctx.family.id}`, 'no purchases to check');
    return { candidates: [], itemsChecked: 0 };
  }

  const { rows } = await ctx.z.runQuery(pairs);
  const seenPair = new Set<string>();
  const deduped = rows.filter((r) => {
    const k = `${norm(s(r, 'item_text'))}|${s(r, 'recall_source')}|${s(r, 'recall_id')}|${s(r, 'recall_number')}`;
    if (seenPair.has(k)) return false;
    seenPair.add(k);
    return true;
  });
  // Exact-name pairs are all kept; only the loose pairs (which cost a model call) are capped.
  const isExact = (r: Row) => exactContainment(s(r, 'item_text'), s(r, 'recalled_product'));
  const unique = [...deduped.filter(isExact), ...deduped.filter((r) => !isExact(r)).slice(0, MAX_PAIRS)];

  const byRecall = new Map<string, Judged>();
  for (const row of unique) {
    const j = await judgePair(ctx, row);
    if (!j) continue;
    const key = `${s(row, 'recall_source')}|${s(row, 'recall_id')}|${s(row, 'recall_number')}`;
    const cur = byRecall.get(key);
    if (!cur || (j.exact && !cur.exact)) byRecall.set(key, j);
  }
  const candidates: Candidate[] = [];
  for (const j of byRecall.values()) candidates.push(await toCandidate(ctx, j));
  log(ctx, 'check_recalls', `family ${ctx.family.id}`, `${itemsChecked} items checked, ${rows.length} possible pairs, ${candidates.length} recall(s) confirmed`);
  return { candidates, itemsChecked };
}

/** Re-derive one recall candidate after the Fact-Checker sent it back. null = give up. */
export async function revise(c: Candidate, reason: string, ctx: AgentContext): Promise<Candidate | null> {
  log(ctx, 'revise', `${c.id}: ${reason}`.slice(0, 200), 're-deriving from source', 'retry', c.retryCount + 1);
  const { candidates } = await checkRecalls(ctx);
  const match = candidates.find((f) => f.id === c.id);
  if (!match) {
    log(ctx, 'revise', c.id, 'gave up: recall no longer matches', 'blocked', c.retryCount + 1);
    return null;
  }
  return { ...match, retryCount: c.retryCount + 1 };
}

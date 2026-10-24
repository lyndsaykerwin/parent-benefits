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
 * What the family bought: ONLY `purchase_items` rows (photos, receipts, email receipts), read through the Zetaris
 * safe-columns view v_purchase_items. Bank-style text is never matched (plan v3 sign-off item 8). Each row carries its
 * structured codes (UPC, model number, lot code) so the exact-code check can run before any looser name match.
 */
function itemsSelect(familyId: string): string {
  const f = quoteId(familyId);
  return (
    'SELECT product_name AS item_text, source, purchased_on, upc, lot_code, model_number ' +
    `FROM bundle_pg.v_purchase_items WHERE family_id = ${f} AND product_name <> ''`
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
    'SELECT i.item_text AS item_text, i.purchased_on AS purchased_on, i.source AS source, i.upc AS upc, i.lot_code AS lot_code, i.model_number AS model_number, r.recall_source AS recall_source, ' +
    'r.recall_id AS recall_id, r.recall_number AS recall_number, r.recall_date AS recall_date, r.recall_title AS recall_title, ' +
    'r.recall_url AS recall_url, r.recalled_product AS recalled_product ' +
    `FROM (${itemsSelect(familyId)}) i JOIN (SELECT * FROM (${cpsc}) c UNION ALL SELECT * FROM (${fda}) f) r ` +
    // Exact codes first: a UPC, lot code or model number written in the recall text is a match on its own.
    "ON (length(i.upc) >= 8 AND r.recalled_product LIKE concat('%', i.upc, '%')) " +
    "OR (length(i.lot_code) >= 4 AND lower(r.recalled_product) LIKE concat('%', lower(i.lot_code), '%')) " +
    "OR (length(i.model_number) >= 3 AND lower(r.recalled_product) LIKE concat('%', lower(i.model_number), '%')) " +
    "OR lower(i.item_text) LIKE concat('%', lower(r.recalled_product), '%') " +
    `OR size(array_intersect(${tokens('i.item_text')}, ${tokens('r.recalled_product')})) >= 2 ` +
    `OR (length(${brand('r.recalled_product')}) >= 4 AND NOT array_contains(${STOP_SQL}, ${brand('r.recalled_product')}) ` +
    `AND array_contains(${tokens('i.item_text')}, ${brand('r.recalled_product')})) ` +
    'ORDER BY r.recall_date DESC'
  );
}

/**
 * Finished ("Terminated") FDA recalls, by recall number. Kept as its own small Zetaris query (not folded into
 * pairsSql) so the saved replay of the main pairs query stays valid until a new recording run.
 */
export function finishedFdaSql(): string {
  return (
    'SELECT x.recall_number AS recall_number FROM bundle_live.fda_food_recalls LATERAL VIEW explode(results) t AS x ' +
    "WHERE lower(x.status) = 'terminated'"
  );
}

/** Drop pairs whose FDA recall is finished, so no parent gets a card about a recall that ended. The FDA feed stays. */
async function dropFinishedFda(ctx: AgentContext, rows: Row[]): Promise<Row[]> {
  if (!rows.some((r) => s(r, 'recall_source') === 'fda')) return rows;
  let finished: Set<string>;
  try {
    const res = await ctx.z.runQuery(finishedFdaSql());
    finished = new Set(res.rows.map((r) => s(r, 'recall_number')));
  } catch (e: any) {
    // Safer to keep a possibly-finished recall than to hide a live one: keep the rows and say so.
    log(ctx, 'filter_finished_fda', 'FDA recall status', `status list unavailable (${String(e?.message ?? e).slice(0, 80)}): FDA rows kept`, 'fallback');
    return rows;
  }
  const kept = rows.filter((r) => !(s(r, 'recall_source') === 'fda' && finished.has(s(r, 'recall_number'))));
  log(ctx, 'filter_finished_fda', `${rows.length} pairs`, `${rows.length - kept.length} pair(s) on finished FDA recalls dropped`);
  return kept;
}

const norm = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();
/** The only match we accept without a model: the recalled product's whole name appears in what was bought. */
export const exactContainment = (item: string, product: string): boolean => {
  const p = norm(product);
  return p.length >= 4 && norm(item).includes(p);
};

/**
 * Exact-code check done in code on a joined pair: the family's UPC, lot code or model number appears in the recall text.
 * Returns a plain evidence line, or null. Short codes never count (a fragment of another number is not a match).
 */
export function codeEvidence(row: Row): string | null {
  const text = norm(s(row, 'recalled_product'));
  const upc = s(row, 'upc').replace(/\D+/g, '');
  const noZeros = (x: string) => x.replace(/^0+/, '');
  if (upc.length >= 8 && text.replace(/\D+/g, ' ').split(' ').some((n) => n.length >= 8 && noZeros(n) === noZeros(upc))) {
    return `UPC ${upc} appears in the recall notice`;
  }
  const hasWord = (code: string) => new RegExp(`(^|[^a-z0-9])${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(text);
  const lot = norm(s(row, 'lot_code'));
  if (lot.length >= 4 && hasWord(lot)) return `lot code ${s(row, 'lot_code')} appears in the recall notice`;
  const model = norm(s(row, 'model_number'));
  if (model.length >= 3 && hasWord(model)) return `model number ${s(row, 'model_number')} appears in the recall notice`;
  return null;
}

function log(ctx: AgentContext, action: string, input: string, output: string, status: 'ok' | 'retry' | 'blocked' | 'error' | 'fallback' = 'ok', retry = 0): string {
  return ctx.trace.log({
    agent_name: AGENT, action, input_summary: input, output_summary: output,
    target_agent: null, confidence: null, retry_count: retry, status,
  });
}

interface Judged { row: Row; exact: boolean; evidence?: string }

async function judgePair(ctx: AgentContext, row: Row): Promise<Judged | null> {
  const item = s(row, 'item_text');
  const product = s(row, 'recalled_product');
  const evidence = codeEvidence(row) ?? undefined;
  const exact = !!evidence || exactContainment(item, product);
  // An exact code or product-name match is never second-guessed by the model.
  if (exact) return { row, exact, evidence };
  const prompt =
    'Is the product a family bought the SAME product (same brand and model) as the product named in a safety recall? ' +
    'Different products from the same category do not count. Reply as JSON: {"same": true} or {"same": false}.\n' +
    `Bought: ${item}\nRecalled: ${product}\nRecall: ${s(row, 'recall_title')}`;
  const { value, usedFallback } = await askJson<{ same: boolean }>(
    ctx.llm, prompt, (x): x is { same: boolean } => typeof (x as any)?.same === 'boolean', { same: false },
  );
  if (usedFallback) log(ctx, 'confirm_match', item.slice(0, 80), `no model answer: loose match rejected`, 'fallback');
  return value.same ? { row, exact, evidence } : null;
}

async function toCandidate(ctx: AgentContext, j: Judged): Promise<Candidate> {
  const r = j.row;
  const fda = s(r, 'recall_source') === 'fda';
  const item = s(r, 'item_text');
  const bought = s(r, 'purchased_on').slice(0, 10);
  const fallback = `You bought "${item}"${bought ? ` on ${bought}` : ''}. ${s(r, 'recall_title')} (recall date ${s(r, 'recall_date')}). Check the official notice and stop using the item if it is the same product.`;
  const explained = await explain(ctx, AGENT, `Bought: ${item}. Recalled product: ${s(r, 'recalled_product')}. Recall: ${s(r, 'recall_title')} dated ${s(r, 'recall_date')}.`, [], fallback);
  // The evidence line is added by code, so it is always true to the data and never depends on the model.
  const body = j.evidence ? `${explained} Matched on: ${j.evidence}.` : explained;
  const claim: Candidate['claim'] = fda
    ? { type: 'recall', recallSource: 'fda', recallNumber: s(r, 'recall_number') }
    : { type: 'recall', recallId: Number(col(r, 'recall_id')) };
  const key = fda ? `fda-${s(r, 'recall_number')}` : `cpsc-${s(r, 'recall_id')}`;
  return {
    id: `recall-${key}`, kind: 'recall', title: `Recall alert: ${s(r, 'recalled_product')}`.slice(0, 120), body,
    amountCents: null, deadline: null, verdict: j.exact ? 'verified' : 'likely',
    sources: [{ label: fda ? 'FDA recall notice' : 'CPSC recall notice', url: s(r, 'recall_url') }],
    traceId: log(ctx, 'recall_match', `${item.slice(0, 60)} vs ${s(r, 'recalled_product').slice(0, 60)}`, `${key}, ${j.evidence ? `exact code (${j.evidence})` : j.exact ? 'exact name' : 'model-confirmed'}`),
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

  const { rows: allRows } = await ctx.z.runQuery(pairs);
  const rows = await dropFinishedFda(ctx, allRows);
  const seenPair = new Set<string>();
  const deduped = rows.filter((r) => {
    const k = `${norm(s(r, 'item_text'))}|${s(r, 'recall_source')}|${s(r, 'recall_id')}|${s(r, 'recall_number')}`;
    if (seenPair.has(k)) return false;
    seenPair.add(k);
    return true;
  });
  // Exact-name pairs are all kept; only the loose pairs (which cost a model call) are capped.
  const isExact = (r: Row) => codeEvidence(r) !== null || exactContainment(s(r, 'item_text'), s(r, 'recalled_product'));
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

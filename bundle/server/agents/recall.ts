import { col, quoteId, quoteInt, InvalidId, isInlineFamily } from './sql';
import { explain } from './explain';
import { matchRecall, typesIn, extractLots, extractModels, extractUpcs, type PurchaseItem, type RecallRecord } from './recallMatch';
import type { AgentContext, Candidate } from './types';

const AGENT = 'recall';

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

/**
 * One statement: purchases x (CPSC + openFDA) recalls, joined inside Zetaris on a brand word or two real title words.
 * This is only the wide first net; the fixed matching rules (recallMatch.ts) decide which pairs are real.
 * Its text is unchanged so its saved replay stays valid.
 */
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

/** Which recalls to read the full record for. */
export interface RecallRef { source: 'cpsc' | 'fda'; id: number | string }

/**
 * The recall RECORD (description, where and when it was sold, model numbers, barcodes, lot codes) for the recalls
 * that came back as possible matches. A separate small query, so the recorded queries above keep their exact
 * text. No family data in it. Throws on an unsafe id.
 */
export function recallDetailsSql(refs: RecallRef[]): string {
  const cpsc = [...new Set(refs.filter((r) => r.source === 'cpsc').map((r) => quoteInt(r.id)))];
  const fda = [...new Set(refs.filter((r) => r.source === 'fda').map((r) => quoteId(String(r.id))))];
  const parts: string[] = [];
  if (cpsc.length) {
    parts.push(
      "SELECT 'cpsc' AS recall_source, CAST(RecallID AS bigint) AS recall_id, CAST(NULL AS string) AS recall_number, Description AS description, " +
      "concat_ws(' ', coalesce(SoldAtLabel, ''), concat_ws(' ', transform(Retailers, r -> r.Name))) AS sold_at, " +
      "concat_ws(' ', transform(Manufacturers, m -> m.Name)) AS firm, concat_ws(' ', transform(Products, p -> p.Model)) AS models, " +
      "concat_ws(' ', transform(ProductUPCs, u -> CAST(u.UPC AS string))) AS upcs, CAST(NULL AS string) AS lots " +
      `FROM bundle_live.cpsc_recalls WHERE RecallID IN (${cpsc.join(', ')})`,
    );
  }
  if (fda.length) {
    parts.push(
      "SELECT 'fda' AS recall_source, CAST(NULL AS bigint) AS recall_id, f.recall_number AS recall_number, f.reason_for_recall AS description, " +
      'f.distribution_pattern AS sold_at, f.recalling_firm AS firm, CAST(NULL AS string) AS models, CAST(NULL AS string) AS upcs, f.code_info AS lots ' +
      'FROM (SELECT x.recall_number AS recall_number, x.reason_for_recall AS reason_for_recall, x.distribution_pattern AS distribution_pattern, ' +
      'x.recalling_firm AS recalling_firm, x.code_info AS code_info FROM bundle_live.fda_food_recalls LATERAL VIEW explode(results) t AS x) f ' +
      `WHERE f.recall_number IN (${fda.join(', ')})`,
    );
  }
  if (!parts.length) throw new InvalidId('no recalls to look up');
  return parts.map((q) => `SELECT * FROM (${q}) d`).join(' UNION ALL ');
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
/** Normalised item name: the key findRecalledItems uses. */
export const itemKey = norm;
/** The recalled product's whole name appears in what was bought (a strong sign; the fixed rules still have to agree). */
export const exactContainment = (item: string, product: string): boolean => {
  const p = norm(product);
  return p.length >= 4 && norm(item).includes(p);
};

/**
 * Exact-code check done in code on a joined pair: the family's UPC, lot code or model number appears in the recall text.
 * Returns a plain evidence line, or null. Short codes never count (a fragment of another number is not a match).
 */
export type EvidenceType = 'upc' | 'lot' | 'model' | 'name' | 'confirmed';
export interface CodeMatch { line: string; type: 'upc' | 'lot' | 'model'; code: string }

export const codeEvidence = (row: Row): string | null => codeMatch(row)?.line ?? null;

export function codeMatch(row: Row): CodeMatch | null {
  const text = norm(s(row, 'recalled_product'));
  const upc = s(row, 'upc').replace(/\D+/g, '');
  const noZeros = (x: string) => x.replace(/^0+/, '');
  if (upc.length >= 8 && text.replace(/\D+/g, ' ').split(' ').some((n) => n.length >= 8 && noZeros(n) === noZeros(upc))) {
    return { line: `UPC ${upc} appears in the recall notice`, type: 'upc', code: upc };
  }
  const hasWord = (code: string) => new RegExp(`(^|[^a-z0-9])${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(text);
  const lot = norm(s(row, 'lot_code'));
  if (lot.length >= 4 && hasWord(lot)) return { line: `lot code ${s(row, 'lot_code')} appears in the recall notice`, type: 'lot', code: s(row, 'lot_code') };
  const model = norm(s(row, 'model_number'));
  if (model.length >= 3 && hasWord(model)) return { line: `model number ${s(row, 'model_number')} appears in the recall notice`, type: 'model', code: s(row, 'model_number') };
  return null;
}

function log(ctx: AgentContext, action: string, input: string, output: string, status: 'ok' | 'retry' | 'blocked' | 'error' | 'fallback' = 'ok', retry = 0): string {
  return ctx.trace.log({
    agent_name: AGENT, action, input_summary: input, output_summary: output,
    target_agent: null, confidence: null, retry_count: retry, status,
  });
}

const recallKey = (r: Row) => `${s(r, 'recall_source')}|${s(r, 'recall_id')}|${s(r, 'recall_number')}`;

/** The recall as the matcher wants it: the pair row, enriched with the recall record when Zetaris returned it. */
function toRecallRecord(row: Row, d: Row | undefined): RecallRecord {
  const fda = s(row, 'recall_source') === 'fda';
  const product = s(row, 'recalled_product');
  const description = d ? s(d, 'description') : '';
  return {
    id: fda ? `fda-${s(row, 'recall_number')}` : `cpsc-${s(row, 'recall_id')}`,
    source: fda ? 'fda' : 'cpsc', title: s(row, 'recall_title'), productNames: [product], description,
    recallDate: s(row, 'recall_date').slice(0, 10), status: 'ongoing',
    upcs: [...new Set([...extractUpcs(product), ...(d ? extractUpcs(s(d, 'upcs')) : [])])],
    models: d ? [...new Set([...extractModels(description), ...extractModels(`Model: ${s(d, 'models')}`)])] : [],
    lots: fda && d ? extractLots(s(d, 'lots')) : [], soldAt: d ? s(d, 'sold_at') : '', firm: d ? s(d, 'firm') : '',
  };
}

interface Judged { row: Row; exact: boolean; evidence: string; level: 'code' | 'rules'; evidenceType: EvidenceType; evidenceCode: string }

/** Evidence as one clean clause: no trailing full stop, and without the matcher's own can sentence (ours is added once, below). */
const cleanEvidence = (e: string) => e.replace(/\s*Check the lot code on the bottom of the can[^.]*\.?/i, '').trim().replace(/\.$/, '');

/** Judge one possible match: exact codes first, then the fixed rules (brand, type, model, sale dates, seller, size). No model call. */
function judgePair(ctx: AgentContext, row: Row, detail: Row | undefined, rejected: { n: number }): Judged | null {
  const item = s(row, 'item_text');
  const product = s(row, 'recalled_product');
  const code = codeMatch(row);
  if (code) return { row, exact: true, evidence: code.line, level: 'code', evidenceType: code.type, evidenceCode: code.code };
  const purchase: PurchaseItem = {
    text: item, date: s(row, 'purchased_on').slice(0, 10) || null, source: s(row, 'source') || null,
    upc: s(row, 'upc') || null, model: s(row, 'model_number') || null, lot: s(row, 'lot_code') || null,
  };
  const m = matchRecall(purchase, toRecallRecord(row, detail));
  if (!m.match) {
    if (rejected.n++ < 20) log(ctx, 'recall_rejected', `${item.slice(0, 60)} vs ${product.slice(0, 60)}`, `${m.reason}: ${m.evidence}`.slice(0, 220));
    return null;
  }
  const byName = exactContainment(item, product);
  const type: EvidenceType = m.reason === 'exact_upc' ? 'upc' : m.reason === 'exact_lot' ? 'lot' : m.reason === 'exact_model' ? 'model' : byName ? 'name' : 'confirmed';
  const codeOf = type === 'upc' ? purchase.upc : type === 'lot' ? purchase.lot : type === 'model' ? purchase.model : null;
  return { row, exact: m.level === 'exact' || byName, evidence: cleanEvidence(m.evidence), level: m.level === 'exact' ? 'code' : 'rules', evidenceType: type, evidenceCode: codeOf ?? '' };
}

const LOT_LINE = 'Check the lot number on the can against the recall notice.';
const isFormula = (j: Judged) => typesIn(`${s(j.row, 'recalled_product')} ${s(j.row, 'item_text')}`).has('formula');

async function toCandidate(ctx: AgentContext, j: Judged): Promise<Candidate> {
  const r = j.row;
  const fda = s(r, 'recall_source') === 'fda';
  const item = s(r, 'item_text');
  const bought = s(r, 'purchased_on').slice(0, 10);
  const fallback = `You bought "${item}"${bought ? ` on ${bought}` : ''}. ${s(r, 'recall_title')} (recall date ${s(r, 'recall_date')}). Check the official notice and stop using the item if it is the same product.`;
  const explained = await explain(ctx, AGENT, `Bought: ${item}. Recalled product: ${s(r, 'recalled_product')}. Recall: ${s(r, 'recall_title')} dated ${s(r, 'recall_date')}.`, [], fallback);
  // The evidence line is added by code, so it is always true to the data and never depends on the model.
  // Every recall alert has one, however it matched.
  let body = `${explained.replace(/\s*Matched on:.*$/s, '').trim()} Matched on: ${j.evidence}.`;
  if (isFormula(j)) body += ` ${LOT_LINE}`;
  const proof = { evidence: j.evidence, evidenceType: j.evidenceType, evidenceCode: j.evidenceCode, recalledProduct: s(r, 'recalled_product'), itemText: item, matchLevel: j.level };
  const claim: Candidate['claim'] = fda
    ? { type: 'recall', recallSource: 'fda', recallNumber: s(r, 'recall_number'), ...proof }
    : { type: 'recall', recallId: Number(col(r, 'recall_id')), ...proof };
  const key = fda ? `fda-${s(r, 'recall_number')}` : `cpsc-${s(r, 'recall_id')}`;
  return {
    id: `recall-${key}`, kind: 'recall', title: `Recall alert: ${s(r, 'recalled_product')}`.slice(0, 120), body,
    amountCents: null, deadline: null, verdict: j.exact ? 'verified' : 'likely',
    sources: [{ label: fda ? 'FDA recall notice' : 'CPSC recall notice', url: s(r, 'recall_url') }],
    traceId: log(ctx, 'recall_match', `${item.slice(0, 60)} vs ${s(r, 'recalled_product').slice(0, 60)}`, `${key}, ${j.level === 'code' ? 'exact' : 'rules'} match: ${j.evidence}`),
    agent: AGENT, claim, evidenceSql: pairsSql(ctx.family.id), retryCount: 0,
  };
}

interface Found { judged: Judged[]; itemsChecked: number }

/** Read the recall records for the possible matches. If Zetaris cannot answer, say so and judge from the pair rows alone. */
async function readRecallRecords(ctx: AgentContext, rows: Row[]): Promise<Map<string, Row>> {
  const out = new Map<string, Row>();
  const refs: RecallRef[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const fda = s(r, 'recall_source') === 'fda';
    const id: string | number = fda ? s(r, 'recall_number') : Number(col(r, 'recall_id'));
    const k = `${fda}|${id}`;
    if (seen.has(k) || id === '' || (typeof id === 'number' && !Number.isFinite(id))) continue;
    seen.add(k);
    refs.push({ source: fda ? 'fda' : 'cpsc', id });
  }
  if (!refs.length) return out;
  try {
    const res = await ctx.z.runQuery(recallDetailsSql(refs));
    for (const d of res.rows) out.set(recallKey(d), d);
    log(ctx, 'recall_record', `${refs.length} recall(s)`, `read ${out.size} recall record(s) for sale dates, models and lots`);
  } catch (e: any) {
    log(ctx, 'recall_record', `${refs.length} recall(s)`, `recall record unavailable (${String(e?.message ?? e).slice(0, 80)}): matched on product name and dates from the notice list only`, 'fallback');
  }
  return out;
}

async function findRecalled(ctx: AgentContext): Promise<Found> {
  if (isInlineFamily(ctx.family)) {
    log(ctx, 'check_recalls', 'typed-in family', 'no saved purchases to check: nothing queried');
    return { judged: [], itemsChecked: 0 };
  }
  let itemsSqlText: string;
  let pairs: string;
  try {
    itemsSqlText = itemsSql(ctx.family.id);
    pairs = pairsSql(ctx.family.id);
  } catch (e) {
    if (e instanceof InvalidId) {
      log(ctx, 'check_recalls', 'family', 'unsafe family id: nothing queried', 'error');
      return { judged: [], itemsChecked: 0 };
    }
    throw e;
  }
  const items = await ctx.z.runQuery(itemsSqlText);
  const distinct = new Set(items.rows.map((r) => norm(s(r, 'item_text'))).filter(Boolean));
  const itemsChecked = distinct.size;
  if (itemsChecked === 0) {
    log(ctx, 'check_recalls', `family ${ctx.family.id}`, 'no purchases to check');
    return { judged: [], itemsChecked: 0 };
  }

  const { rows: allRows } = await ctx.z.runQuery(pairs);
  const rows = await dropFinishedFda(ctx, allRows);
  const seenPair = new Set<string>();
  const deduped = rows.filter((r) => {
    const k = `${norm(s(r, 'item_text'))}|${recallKey(r)}`;
    if (seenPair.has(k)) return false;
    seenPair.add(k);
    return true;
  });

  const details = await readRecallRecords(ctx, deduped);
  const rejected = { n: 0 };
  const judged: Judged[] = [];
  for (const row of deduped) {
    const j = judgePair(ctx, row, details.get(recallKey(row)), rejected);
    if (j) judged.push(j);
  }
  log(ctx, 'check_recalls', `family ${ctx.family.id}`, `${itemsChecked} items checked, ${rows.length} possible pairs, ${judged.length} match(es) kept, ${rows.length - judged.length} rejected by the rules`);
  return { judged, itemsChecked };
}

// One lookup per run, shared by the recall cards and the Clawback Hunter's safety question (the two run at the same time).
const lookups = new WeakMap<AgentContext, Promise<Found>>();
function sharedLookup(ctx: AgentContext, fresh = false): Promise<Found> {
  const cached = lookups.get(ctx);
  if (cached && !fresh) return cached;
  const p = findRecalled(ctx);
  lookups.set(ctx, p);
  p.catch(() => { if (lookups.get(ctx) === p) lookups.delete(ctx); }); // a failed lookup is retried, never remembered
  return p;
}

/** An item the family bought that matches a recall: the Recall Checker's answer to the Clawback Hunter. */
export interface RecalledItem { itemText: string; recallId: string; recallTitle: string; evidence: string; source: 'cpsc' | 'fda'; url: string }

/** Items (keyed by itemKey(name)) that are under an open CPSC or FDA recall, each with its evidence line. */
export async function findRecalledItems(ctx: AgentContext): Promise<Map<string, RecalledItem>> {
  const { judged } = await sharedLookup(ctx);
  const out = new Map<string, RecalledItem>();
  for (const j of judged) {
    const fda = s(j.row, 'recall_source') === 'fda';
    const k = norm(s(j.row, 'item_text'));
    if (out.has(k) && !j.exact) continue;
    out.set(k, {
      itemText: s(j.row, 'item_text'), source: fda ? 'fda' : 'cpsc',
      recallId: fda ? `fda-${s(j.row, 'recall_number')}` : `cpsc-${s(j.row, 'recall_id')}`,
      recallTitle: s(j.row, 'recall_title'), evidence: j.evidence, url: s(j.row, 'recall_url'),
    });
  }
  return out;
}

/** Safety-check what a family bought against live CPSC and FDA recalls. */
export async function checkRecalls(ctx: AgentContext, opts: { fresh?: boolean } = {}): Promise<{ candidates: Candidate[]; itemsChecked: number }> {
  const { judged, itemsChecked } = await sharedLookup(ctx, opts.fresh);
  // One card per recall (the strongest match wins).
  const byRecall = new Map<string, Judged>();
  for (const j of judged) {
    const k = recallKey(j.row);
    const cur = byRecall.get(k);
    if (!cur || (j.exact && !cur.exact)) byRecall.set(k, j);
  }
  const candidates: Candidate[] = [];
  for (const j of byRecall.values()) candidates.push(await toCandidate(ctx, j));
  if (itemsChecked > 0) log(ctx, 'recall_cards', `family ${ctx.family.id}`, `${candidates.length} recall alert(s), each with an evidence line`);
  return { candidates, itemsChecked };
}

/** Re-derive one recall candidate after the Fact-Checker sent it back. null = give up. */
export async function revise(c: Candidate, reason: string, ctx: AgentContext): Promise<Candidate | null> {
  log(ctx, 'revise', `${c.id}: ${reason}`.slice(0, 200), 're-deriving from source', 'retry', c.retryCount + 1);
  const { candidates } = await checkRecalls(ctx, { fresh: true });
  const match = candidates.find((f) => f.id === c.id);
  if (!match) {
    log(ctx, 'revise', c.id, 'gave up: recall no longer matches', 'blocked', c.retryCount + 1);
    return null;
  }
  return { ...match, retryCount: c.retryCount + 1 };
}

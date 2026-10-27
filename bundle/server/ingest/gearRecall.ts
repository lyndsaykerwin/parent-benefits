// The recall check for one gear photo (and for the lines of a receipt).
//   Car seats  -> NHTSA's own list (the 69 child-seat recalls in data/nhtsa-car-seat-recalls.json), matched on brand and model.
//   Everything else -> the CPSC list, asked through Zetaris (live only; practice mode has no recorded answer for it).
// The answer is always one of: found (with the recall), "No recalls found" (a real check ran), or "could not check"
// (no list available). It never says "safe" and never says "no recalls" without having really checked.
import fs from 'node:fs';
import path from 'node:path';
import { manufactureWindow, matchRecall, outsideMadeDates, typesIn, type RecallRecord } from '../agents/recallMatch';
import { FSA_CATEGORIES } from '../../scripts/seed';

export interface RecallMatchInfo { id: string; title: string; recallDate: string; url: string; summary: string }
export interface RecallResult {
  /** true: matches found. false: a real check ran and found none. null: no list was available, so nothing was checked. */
  found: boolean | null;
  source: 'NHTSA' | 'CPSC';
  /** How many official recalls were checked against (69 NHTSA car-seat recalls, or the CPSC total). Null when not checked. */
  recordsChecked: number | null;
  /** YYYY-MM-DD */
  checkedOn: string;
  registerUrl?: string;
  matches?: RecallMatchInfo[];
  /** Plain words when found is null. */
  note?: string;
}

export interface CheckableItem {
  productName: string; brand: string | null; modelNumber: string | null; upc: string | null;
  /** Lot or batch code from the label. */
  lotCode?: string | null;
  /** Date of manufacture from the label (YYYY-MM-DD or YYYY-MM): recalls cover units made between two dates. */
  manufacturedOn?: string | null;
}

// ---------------------------------------------------------------------------
// NHTSA car seats
// ---------------------------------------------------------------------------

interface NhtsaRow { campaignNumber: string; manufacturer: string; brands: string[]; models: string[]; components: string[]; recallDate: string; summary: string }
interface NhtsaFile { recalls: NhtsaRow[] }

let nhtsaCache: NhtsaRow[] | undefined;
export function loadNhtsaCarSeats(cwd: string = process.cwd()): NhtsaRow[] {
  if (nhtsaCache && cwd === process.cwd()) return nhtsaCache;
  const file = JSON.parse(fs.readFileSync(path.resolve(cwd, 'data/nhtsa-car-seat-recalls.json'), 'utf8')) as NhtsaFile;
  if (cwd === process.cwd()) nhtsaCache = file.recalls;
  return file.recalls;
}

const compact = (t: string | null | undefined) => (t ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const wordsOf = (t: string) => (t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
const FILLER = new Set(['car', 'seat', 'infant', 'child', 'baby', 'with', 'and', 'the', 'booster', 'convertible', 'travel', 'system', 'base', 'for', 'new']);

/** A car seat by its words (not an adapter, not a stroller). */
export function isCarSeat(item: Pick<CheckableItem, 'productName'>): boolean {
  return typesIn(item.productName).has('car seat');
}

/** Same brand AND the same model: the model number inside NHTSA's model text, or every distinctive word of an NHTSA model in the product name. */
function nhtsaMatches(item: CheckableItem, row: NhtsaRow): boolean {
  const itemBrand = compact(item.brand) || compact(wordsOf(item.productName)[0]);
  const sameBrand = row.brands.some((b) => compact(b) === itemBrand) || compact(row.manufacturer).includes(itemBrand) && itemBrand.length >= 4;
  if (!sameBrand) return false;
  const nameWords = new Set(wordsOf(item.productName));
  const model = compact(item.modelNumber);
  // Many recalls list the exact model numbers only in the summary ("Model Numbers: E9LJ91A, E9LJ91M, …"): a whole-word hit there counts.
  if (model.length >= 5 && /\d/.test(model) && new RegExp(`(^|[^a-z0-9])${model}([^a-z0-9]|$)`).test(row.summary.toLowerCase())) return true;
  return row.models.some((m) => {
    const mc = compact(m);
    if (model.length >= 3 && mc.includes(model)) return true;
    const distinctive = wordsOf(m).filter((w) => !FILLER.has(w) && w.length >= 3);
    return distinctive.length >= 2 && distinctive.every((w) => nameWords.has(w));
  });
}

export function checkCarSeat(item: CheckableItem, today: string, rows: NhtsaRow[] = loadNhtsaCarSeats()): RecallResult {
  const sameModel = rows.filter((r) => nhtsaMatches(item, r));
  // A recall that names the manufacture dates it covers, and a label date outside them: this seat is not one of them.
  const ruledOut = sameModel.filter((r) => outsideMadeDates(item.manufacturedOn, r.summary));
  const hits = sameModel.filter((r) => !ruledOut.includes(r));
  const base = { source: 'NHTSA' as const, recordsChecked: rows.length, checkedOn: today };
  if (!hits.length) {
    return ruledOut.length
      ? { found: false, ...base, note: `Same model as NHTSA recall ${ruledOut.map((r) => r.campaignNumber).join(', ')}, but ${outsideMadeDates(item.manufacturedOn, ruledOut[0].summary)}` }
      : { found: false, ...base };
  }
  const win = hits.map((r) => manufactureWindow(r.summary)).find(Boolean);
  const note = win && !item.manufacturedOn ? `This recall covers seats made ${win.start} to ${win.end}. Check the date of manufacture on your seat's white sticker.` : undefined;
  return {
    found: true, ...base, ...(note ? { note } : {}),
    matches: hits.map((r) => ({
      id: `nhtsa-${r.campaignNumber}`, title: `NHTSA recall ${r.campaignNumber}: ${r.models.join(', ')}`.slice(0, 160), recallDate: r.recallDate,
      url: `https://www.nhtsa.gov/recalls?nhtsaId=${encodeURIComponent(r.campaignNumber)}`, summary: r.summary,
    })),
  };
}

// ---------------------------------------------------------------------------
// CPSC (everything else), through Zetaris
// ---------------------------------------------------------------------------

/** Asks Zetaris a read-only question. The real client's runQuery fits. */
export interface SqlRunner { runQuery(sql: string): Promise<{ rows: Record<string, string | number | null>[] }> }

const safeWord = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');

/** The CPSC list entries that mention the brand (words only, so nothing odd can reach the SQL). Text is new; the saved queries are untouched. */
export function cpscCandidatesSql(brand: string): string {
  const b = safeWord(brand);
  return (
    'SELECT CAST(RecallID AS bigint) AS recall_id, substr(RecallDate, 1, 10) AS recall_date, Title AS recall_title, URL AS recall_url, ' +
    'p.Name AS recalled_product, p.Model AS recalled_model, Description AS description ' +
    'FROM bundle_live.cpsc_recalls LATERAL VIEW explode(Products) t AS p ' +
    `WHERE lower(p.Name) LIKE '%${b}%' OR lower(Title) LIKE '%${b}%' OR lower(p.Model) LIKE '%${b}%' ORDER BY RecallDate DESC LIMIT 200`
  );
}
export const CPSC_TOTAL_SQL = 'SELECT count(*) AS n FROM bundle_live.cpsc_recalls';

const str = (v: unknown) => (v == null ? '' : String(v));

export async function checkCpsc(item: CheckableItem, today: string, z: SqlRunner): Promise<RecallResult> {
  const brand = item.brand || wordsOf(item.productName)[0] || '';
  if (safeWord(brand).length < 3) return { found: null, source: 'CPSC', recordsChecked: null, checkedOn: today, note: 'No brand was readable, so the CPSC list could not be searched.' };
  const [cands, total] = await Promise.all([z.runQuery(cpscCandidatesSql(brand)), z.runQuery(CPSC_TOTAL_SQL)]);
  const checked = Number(total.rows[0]?.n);
  const hits = cands.rows.filter((r) => {
    const rec: RecallRecord = {
      id: `cpsc-${str(r.recall_id)}`, source: 'cpsc', title: str(r.recall_title), productNames: [str(r.recalled_product)], description: str(r.description),
      recallDate: str(r.recall_date).slice(0, 10), status: 'ongoing', upcs: [],
      // The matcher compares model numbers in compact form (letters and digits only, lower case): "TM-ST200" -> "tmst200".
      models: str(r.recalled_model) ? str(r.recalled_model).split(/[,;]|\s+and\s+/i).map(compact).filter((m) => m.length >= 3) : [], lots: [], soldAt: '', firm: '',
    };
    return matchRecall({ text: item.productName, upc: item.upc, model: item.modelNumber, lot: item.lotCode ?? null, madeOn: item.manufacturedOn ?? null }, rec).match;
  });
  const base = { source: 'CPSC' as const, recordsChecked: Number.isFinite(checked) && checked > 0 ? checked : null, checkedOn: today };
  if (!hits.length) return { found: false, ...base };
  return {
    found: true, ...base,
    matches: hits.slice(0, 3).map((r) => ({ id: `cpsc-${str(r.recall_id)}`, title: str(r.recall_title), recallDate: str(r.recall_date).slice(0, 10), url: str(r.recall_url), summary: str(r.description).slice(0, 240) })),
  };
}

export const COULD_NOT_CHECK = 'The CPSC recall list is not available here (practice mode), so this was not checked.';

/** Recall check for one item. Car seats use NHTSA's file; everything else needs Zetaris and says so when it cannot reach it. */
export async function checkItemRecall(item: CheckableItem, today: string, z?: SqlRunner | null): Promise<RecallResult> {
  const registerUrl = registrationUrl(item.brand);
  if (isCarSeat(item)) return { ...checkCarSeat(item, today), ...(registerUrl ? { registerUrl } : {}) };
  if (!z) return { found: null, source: 'CPSC', recordsChecked: null, checkedOn: today, note: COULD_NOT_CHECK, ...(registerUrl ? { registerUrl } : {}) };
  try {
    return { ...(await checkCpsc(item, today, z)), ...(registerUrl ? { registerUrl } : {}) };
  } catch {
    return { found: null, source: 'CPSC', recordsChecked: null, checkedOn: today, note: 'We could not reach the CPSC recall list just now, so this was not checked.', ...(registerUrl ? { registerUrl } : {}) };
  }
}

// ---------------------------------------------------------------------------
// "Register it with [Brand]"
// ---------------------------------------------------------------------------

const REGISTER: Record<string, string> = { graco: 'https://www.gracobaby.com/product-registration' };
/** The brand's own registration page when we know it, else a search for it (so the link always goes somewhere useful). Null when there is no brand. */
export function registrationUrl(brand: string | null | undefined): string | null {
  const b = (brand ?? '').trim();
  if (!b) return null;
  return REGISTER[compact(b)] ?? `https://www.google.com/search?q=${encodeURIComponent(`${b} product registration baby`)}`;
}

// ---------------------------------------------------------------------------
// Money back (receipts)
// ---------------------------------------------------------------------------

export interface MoneyBack { fsaEligible: boolean; fsaCategory?: string; fsaAccount?: string; fsaSourceUrl?: string }

/** Split a receipt line or keyword into lower-case words. */
function receiptWords(text: string): string[] {
  return text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
}

/** The word without a plural "s" ("pads" -> "pad", "thermometers" -> "thermometer"). */
function singular(w: string): string {
  return w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
}

/** True when every letter of `short` appears in `word`, in the same order (e.g. "asprtr" inside "aspirator"). */
function lettersInOrder(short: string, word: string): boolean {
  let i = 0;
  for (const ch of word) if (ch === short[i]) i++;
  return i === short.length;
}

/**
 * Does one receipt word stand for one keyword word? Receipts shorten names in two ways:
 *   cut off the end ("THERMO", "THERM" for thermometer)   -> a start of the word, at least 4 letters
 *   drop the vowels ("ASPRTR", "THERMOMTR")               -> same first and last letter, at least 4 letters, rest in order
 * Short or loose guesses are refused, so "THERMAL", "THERMOS", "SALT" and "SUN" do not match.
 */
function wordMatches(token: string, word: string): boolean {
  if (singular(token) === singular(word)) return true; // same word, maybe plural (the plural trim is never used for short forms: "THERMOS" is not "THERMO")
  if (token.length < 4 || token.length > word.length) return false;
  if (word.startsWith(token)) return true;
  return token[0] === word[0] && token[token.length - 1] === word[word.length - 1] && lettersInOrder(token, word);
}

/** Is this receipt line on the FSA/HSA eligible list (the same keyword list the Money-back agent uses)?
 *  Every word of the keyword must appear on the line, written in full or as a standard receipt short form. */
export function moneyBackFor(productName: string): MoneyBack {
  const tokens = receiptWords(productName);
  const hit = FSA_CATEGORIES.find((c) => (c.account === 'FSA' || c.account === 'HSA') &&
    receiptWords(c.keyword).every((w) => tokens.some((t) => wordMatches(t, w))));
  return hit ? { fsaEligible: true, fsaCategory: hit.category, fsaAccount: hit.account, fsaSourceUrl: hit.sourceUrl ?? undefined } : { fsaEligible: false };
}

/**
 * Pure product-matching rules for recall alerts (plan section 3 "Key finding", section 6 item 5).
 * No database, no AI: given one thing a family bought and one recall, decide "same product?" and say why.
 *
 * Order of checks:
 *  1. Finished ("Terminated") FDA recalls never match.
 *  2. Exact codes first: UPC (the 12-digit barcode number), model number, lot code (batch number on a formula can).
 *  3. Otherwise "fields + hard rules": brand, product type from a fixed list, a distinctive model/series word,
 *     sale dates, seller, and size/model clashes. Every answer carries a one-line evidence string.
 */

export interface PurchaseItem {
  text: string;
  /** YYYY-MM-DD */
  date?: string | null;
  /** Store or source (amazon, walmart, target, plaid...). */
  source?: string | null;
  merchant?: string | null;
  upc?: string | null;
  model?: string | null;
  lot?: string | null;
  /** Date of manufacture from the item's label: YYYY-MM-DD or YYYY-MM. Car-seat and stroller recalls cover date ranges. */
  madeOn?: string | null;
}

export interface RecallRecord {
  id: string; // cpsc-<RecallID> or fda-<recall_number>
  source: 'cpsc' | 'fda';
  title: string;
  productNames: string[];
  description: string;
  /** YYYY-MM-DD */
  recallDate: string;
  status: 'ongoing' | 'terminated';
  upcs: string[];
  models: string[];
  lots: string[];
  /** Free text naming where and when it was sold. */
  soldAt: string;
  /** Recalling company (FDA) or manufacturer names (CPSC). */
  firm: string;
}

export interface MatchResult {
  recallId: string;
  match: boolean;
  level: 'exact' | 'rules' | null;
  /** Short machine reason, e.g. "exact_upc", "type_mismatch". */
  reason: string;
  /** One plain-English evidence line for the alert or the rejection. */
  evidence: string;
}

// ---------- text helpers ----------
const lower = (t: string) => (t || '').toLowerCase();
const words = (t: string) => lower(t).replace(/['’]/g, '').replace(/[^a-z0-9+]+/g, ' ').trim().split(' ').filter(Boolean);
const compact = (t: string) => lower(t).replace(/[^a-z0-9]+/g, '');
const digits = (t: string) => (t || '').replace(/\D+/g, '');
/** Plural to singular for the type list: mattresses → mattress, teethers → teether, glass stays glass. */
const singular = (w: string) => (/(ss|sh|ch|x)es$/.test(w) ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);

/** Fixed product-type list. Each entry: canonical type, then the phrases that mean it (singular stems). */
export const PRODUCT_TYPES: Array<[string, string[]]> = [
  ['high chair', ['high chair', 'highchair']],
  ['play yard', ['play yard', 'playard', 'play pen', 'playpen', 'pack n play', 'pack and play', 'travel crib', 'portable crib']],
  ['bassinet', ['bassinet', 'bedside sleeper', 'baby sleeper', 'bassinest']],
  ['mattress', ['mattress']],
  ['pad', ['pad', 'liner', 'insert', 'bumper']],
  ['crib', ['crib']],
  ['monitor', ['monitor']],
  ['teether', ['teether', 'teething']],
  ['stroller', ['stroller']],
  ['car seat adapter', ['car seat adapter', 'adapter']],
  ['car seat', ['car seat', 'infant seat']],
  ['bike seat', ['bicycle child carrier', 'bike carrier', 'bicycle carrier', 'bike child carrier', 'child carrier seat', 'bike seat', 'bicycle seat', 'rear bike']],
  ['carrier', ['baby carrier', 'carrier', 'sling', 'wrap']],
  ['swing', ['swing']],
  ['rocker', ['rocker', 'recliner', 'glider', 'bouncer']],
  ['walker', ['walker']],
  ['bath seat', ['bath seat', 'bather', 'bathtub', 'bath tub']],
  ['gate', ['gate']],
  ['nursing pillow', ['nursing pillow', 'feeding pillow', 'breastfeeding pillow']],
  ['pillow', ['pillow']],
  ['bottle', ['bottle']],
  ['pacifier', ['pacifier']],
  ['bib', ['bib']],
  ['formula', ['infant formula', 'formula']],
  ['activity center', ['activity center', 'activity centre']],
  ['toy', ['toy', 'plush', 'stuffed animal', 'rattle']],
  ['dresser', ['dresser', 'chest of drawers']],
  ['helmet', ['helmet']],
];

/** Types a text names. Longer phrases claim their words first, so "car seat adapter" is not also "car seat". */
export function typesIn(text: string): Set<string> {
  let t = ' ' + words(text).map(singular).join(' ') + ' ';
  const found = new Set<string>();
  const phrases = PRODUCT_TYPES.flatMap(([type, ps]) => ps.map((p) => [type, p] as const)).sort((a, b) => b[1].length - a[1].length);
  for (const [type, p] of phrases) {
    const needle = ' ' + p + ' ';
    if (t.includes(needle)) {
      found.add(type);
      t = t.split(needle).join(' ');
    }
  }
  if (found.has('nursing pillow')) found.delete('pillow');
  return found;
}

/** Words that never prove two products are the same (generic, colours, sizes, marketing). */
const GENERIC = new Set(
  ('baby babies infant infants child children kid kids toddler newborn for with and the from of in to by a an set pack count ' +
    'new original classic premium portable foldable compact lightweight electric organic cotton silicone wooden wood dual sided ' +
    'black white grey gray pink blue green red mint print stars moon polka dot recall recalls recalled due risk serious injury death ' +
    'sold model models products product company co inc llc ltd trading technology brand oz size month months tall wide ' +
    'reusable safety soft support complete total care powder milk whole based iron').split(' '),
);
const TYPE_WORDS = new Set(PRODUCT_TYPES.flatMap(([, ps]) => ps.flatMap((p) => p.split(' '))));

/** A model-number-looking token: letters and digits mixed, at least 4 long (RV001, BB702A, PAPA03001AI). */
const isModelCode = (w: string) => w.length >= 4 && /[a-z]/i.test(w) && /\d/.test(w) && !/^\d+(oz|in|ml|g|lb|lbs|ct|pk|mo|cm|mm|x\d+)$/i.test(w);

/** Model numbers written in recall text, e.g. "Model No.: RV001" or "model numbers BB702A and BB702B". */
export function extractModels(text: string): string[] {
  const out = new Set<string>();
  const re = /model\s*(?:no\.?|nos\.?|numbers?|#)?\s*[:.]?\s*((?:[A-Z0-9][A-Z0-9-]{2,}(?:\s*(?:,|and|or|&)\s*)?)+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text || ''))) {
    for (const w of m[1].split(/\s*(?:,|and|or|&)\s*|\s+/i)) {
      const c = w.replace(/[^A-Za-z0-9-]/g, '');
      if (isModelCode(c.replace(/-/g, ''))) out.add(compact(c));
    }
  }
  return [...out];
}

/**
 * A barcode number in one comparable form: 11–14 digits (UPC-A with or without its check digit, EAN-13, GTIN-14),
 * leading zeros stripped so "0860013251901" and "860013251901" are the same code. Anything else is not a barcode.
 */
export function normUpc(raw: string): string | null {
  const d = digits(raw);
  if (d.length < 11 || d.length > 14) return null;
  const stripped = d.replace(/^0+/, '');
  return stripped.length >= 8 ? stripped : null;
}

/** US phone layouts: 1-800-555-1234, 1 800 555 1234, 800-555-1234, (800) 555-1234. */
const PHONE_RE = /^(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}$/;

/** UPCs (12-digit barcode numbers) written in text, spaces and dashes allowed. Phone numbers are skipped. */
export function extractUpcs(text: string): string[] {
  const out = new Set<string>();
  const t = text || '';
  const re = /(?<![\d])(\d[\d\s-]{10,16}\d)(?![\d])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const raw = m[1].trim();
    const before = t.slice(Math.max(0, m.index - 20), m.index);
    // "1-800-555-1234", or a number right after "(800) " / "call" / "phone" / "tel", is a phone number, not a barcode.
    if (PHONE_RE.test(raw) || /\(\d{3}\)\s*$/.test(before) || /(?:call|phone|tel|telephone|toll[- ]free|fax)\W*$/i.test(before)) continue;
    const u = normUpc(raw);
    if (u) out.add(u);
  }
  return [...out];
}

/** Lot codes from an FDA code_info field: tokens with at least 6 characters that include digits. */
export function extractLots(text: string): string[] {
  const out = new Set<string>();
  const cleaned = (text || '').replace(/exp(?:iration)?\.?\s*date:?\s*[\d/.-]+/gi, ' ');
  for (const tok of cleaned.split(/[\s,;:#()]+/)) {
    const c = compact(tok);
    if (c.length >= 6 && /\d/.test(c)) out.add(c);
  }
  return [...out];
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const monthIdx = (m: string) => MONTHS.findIndex((x) => x.startsWith(lower(m).slice(0, 3)));
const ym = (y: string, m: string) => `${y}-${String(monthIdx(m) + 1).padStart(2, '0')}`;
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';

/** Sale window from "from March 2025 through August 2026", "from March 2025", or "in April 2026". Months as YYYY-MM. */
export function saleWindow(text: string): { start: string; end: string | null } | null {
  const t = text || '';
  const range = new RegExp(`from\\s+${MONTH_RE}\\s+(\\d{4})\\s+(?:through|to|until|thru)\\s+${MONTH_RE}\\s+(\\d{4})`, 'i').exec(t);
  if (range) return { start: ym(range[2], range[1]), end: ym(range[4], range[3]) };
  const from = new RegExp(`from\\s+${MONTH_RE}\\s+(\\d{4})`, 'i').exec(t);
  if (from) return { start: ym(from[2], from[1]), end: null };
  const inMonth = new RegExp(`(?:sold\\s+)?in\\s+${MONTH_RE}\\s+(\\d{4})`, 'i').exec(t);
  if (inMonth) return { start: ym(inMonth[2], inMonth[1]), end: ym(inMonth[2], inMonth[1]) };
  return null;
}

const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const p2 = (n: number) => String(n).padStart(2, '0');
/** One date as printed in a recall notice → [first day, last day] it can mean (a month alone covers the whole month). */
function dateSpan(raw: string): [string, string] | null {
  const t = raw.trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').replace(/(\d)(st|nd|rd|th)\b/g, '$1');
  let y = 0; let m = 0; let d = 0; let r: RegExpExecArray | null;
  if ((r = /^(\d{4})[-\/.](\d{1,2})(?:[-\/.](\d{1,2}))?$/.exec(t))) { y = +r[1]; m = +r[2]; d = r[3] ? +r[3] : 0; }
  else if ((r = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/.exec(t))) { m = +r[1]; d = +r[2]; y = +r[3]; }
  else if ((r = /^(\d{1,2})[-\/.](\d{4})$/.exec(t))) { m = +r[1]; y = +r[2]; }
  else if ((r = /^([a-z]+)\.?(?: (\d{1,2}))? (\d{4})$/.exec(t)) && monthIdx(r[1]) >= 0) { m = monthIdx(r[1]) + 1; d = r[2] ? +r[2] : 0; y = +r[3]; }
  else if ((r = /^(\d{1,2}) ([a-z]+)\.? (\d{4})$/.exec(t)) && monthIdx(r[2]) >= 0) { d = +r[1]; m = monthIdx(r[2]) + 1; y = +r[3]; }
  else return null;
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d > lastDay(y, m)) return null;
  const base = `${y}-${p2(m)}`;
  return d ? [`${base}-${p2(d)}`, `${base}-${p2(d)}`] : [`${base}-01`, `${base}-${p2(lastDay(y, m))}`];
}

const ONE_DATE = `(?:${MONTH_RE}\\s+(?:\\d{1,2}(?:st|nd|rd|th)?,?\\s+)?\\d{4}|\\d{1,2}\\s+${MONTH_RE}\\s+\\d{4}|\\d{4}[-/.]\\d{1,2}(?:[-/.]\\d{1,2})?|\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{4}|\\d{1,2}[-/.]\\d{4})`;

/**
 * Manufacture dates a recall covers, from notice text such as "manufactured between February 28, 2023 and March 7, 2025",
 * "dates of manufacture from June 2021 through December 2022" or "manufactured 2023/01/01 to 2023/06/30". YYYY-MM-DD bounds.
 */
export function manufactureWindow(text: string): { start: string; end: string } | null {
  const re = new RegExp(`manufactur\\w*[^.;]{0,60}?(?:between|from)?\\s*(?<a>${ONE_DATE})\\s*(?:and|through|thru|to|until|-|–)\\s*(?<b>${ONE_DATE})`, 'i');
  const m = re.exec(text || '');
  if (!m) return null;
  const a = dateSpan(m.groups!.a.replace(/\./g, '')); const b = dateSpan(m.groups!.b.replace(/\./g, ''));
  if (!a || !b || a[0] > b[1]) return null;
  return { start: a[0], end: b[1] };
}

/** "made YYYY-MM, but the recall covers units made A to B." when the label's date rules this unit out; else null. */
export function outsideMadeDates(madeOn: string | null | undefined, text: string): string | null {
  const win = madeOn ? manufactureWindow(text) : null;
  if (!madeOn || !win) return null;
  const span = dateSpan(madeOn);
  if (!span) return null;
  if (span[1] < win.start || span[0] > win.end) return `made ${madeOn}, but the recall covers units made ${win.start} to ${win.end}.`;
  return null;
}

const addMonths = (yyyymm: string, n: number) => {
  const [y, m] = yyyymm.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

const STORES = ['amazon', 'walmart', 'target', 'carters', 'buybuy', 'babylist', 'costco', 'kohls', 'macys', 'nordstrom', 'wayfair', 'temu', 'shein', 'ebay', 'etsy', 'bloomingdales'];

// ---------- feed adapters ----------
type Json = Record<string, any>;

export function fromCpsc(r: Json): RecallRecord {
  const names: string[] = (r.Products || []).map((p: Json) => String(p.Name || '')).filter(Boolean);
  const modelField: string[] = (r.Products || []).map((p: Json) => String(p.Model || '')).filter(Boolean);
  const soldAt = [r.SoldAtLabel, ...(r.Retailers || []).map((x: Json) => x.Name)].filter(Boolean).join(' ');
  const upcs = (r.ProductUPCs || []).flatMap((u: Json) => extractUpcs(String(u.UPC ?? u)));
  return {
    id: `cpsc-${r.RecallID}`, source: 'cpsc', title: String(r.Title || ''), productNames: names,
    description: String(r.Description || ''), recallDate: String(r.RecallDate || '').slice(0, 10), status: 'ongoing',
    upcs, models: [...new Set([...extractModels(String(r.Description || '')), ...modelField.flatMap((m) => extractModels(`Model: ${m}`))])],
    lots: [], soldAt, firm: (r.Manufacturers || []).map((x: Json) => x.Name).join(' '),
  };
}

export function fromFda(r: Json): RecallRecord {
  const d = String(r.recall_initiation_date || '');
  return {
    id: `fda-${r.recall_number}`, source: 'fda', title: `FDA recall: ${r.recalling_firm}`,
    productNames: [String(r.product_description || '')], description: String(r.reason_for_recall || ''),
    recallDate: d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d.slice(0, 10),
    status: lower(r.status) === 'terminated' ? 'terminated' : 'ongoing',
    upcs: extractUpcs(String(r.product_description || '') + ' ' + String(r.code_info || '')),
    models: [], lots: extractLots(String(r.code_info || '')), soldAt: String(r.distribution_pattern || ''), firm: String(r.recalling_firm || ''),
  };
}

// ---------- the matcher ----------
const no = (recallId: string, reason: string, evidence: string): MatchResult => ({ recallId, match: false, level: null, reason, evidence });

/** Brand keys of a purchase: its first word (3+ letters) and its first two words run together. */
function brandKeys(text: string): string[] {
  const w = words(text).filter((x) => !['the', 'new'].includes(x));
  const keys: string[] = [];
  if (w[0] && w[0].length >= 3 && !GENERIC.has(w[0]) && !TYPE_WORDS.has(w[0])) keys.push(w[0]);
  if (w[0] && w[1]) keys.push(w[0] + w[1]);
  return keys;
}

/** Letter/digit pattern of a code: "bb702a" → "a9a", "rv001" → "a9". */
const codeShape = (w: string) => compact(w).replace(/[a-z]+/g, 'a').replace(/\d+/g, '9');
/** Does a purchase word look like the same kind of code as a recalled model number? */
const looksLikeModel = (w: string, recallModel: string) => codeShape(w) === codeShape(recallModel) && Math.abs(compact(w).length - recallModel.length) <= 1;

/** Name text of the recall used for the brand check: title, product names and firm. */
const recallNameText = (r: RecallRecord) => `${r.title} ${r.productNames.join(' ')} ${r.firm}`;

/** The main product part of a recall product name (before " for ..."), so "adapters for X stroller" is an adapter. */
const primaryPart = (name: string) => name.split(/\s+for\s+/i)[0];

export function matchRecall(p: PurchaseItem, r: RecallRecord): MatchResult {
  const id = r.id;
  if (r.status === 'terminated') return no(id, 'fda_terminated', `${id} is a finished FDA recall, so it is not shown.`);

  const pText = [p.text, p.model ?? ''].join(' ');
  const pWords = words(pText);
  const recallAll = `${recallNameText(r)} ${r.description} ${r.soldAt}`;

  // 2. Exact codes.
  // Exact barcode only: both sides normalised (11–14 digits, leading zeros stripped) and compared whole. No "ends with".
  const pUpc = p.upc ? normUpc(p.upc) : null;
  if (pUpc && r.upcs.some((u) => normUpc(u) === pUpc)) {
    return { recallId: id, match: true, level: 'exact', reason: 'exact_upc', evidence: `Exact barcode match: UPC ${pUpc} is listed in recall ${id}.` };
  }
  const pLot = p.lot ? compact(p.lot) : '';
  if (pLot && (r.lots.includes(pLot) || compact(recallAll).includes(pLot) && pLot.length >= 6)) {
    return { recallId: id, match: true, level: 'exact', reason: 'exact_lot', evidence: `Exact lot code match: lot ${p.lot} is listed in recall ${id}.` };
  }
  const pModels = [...new Set([...(p.model ? [compact(p.model)] : []), ...pWords.filter((w) => isModelCode(w)).map(compact)])];
  const modelHit = pModels.find((m) => r.models.includes(m));
  // A model number only counts when the brands agree. The purchase "has a brand" when its text starts with a
  // capitalised word (VEVOR, Joolz); a bare "label photo" has none, so the model number alone decides.
  const pBrandKeys = /^\s*[A-Z]/.test(p.text || '') ? brandKeys(p.text) : [];
  const rName = recallNameText(r);
  const rNameWords = new Set(words(rName));
  const rNameCompact = compact(rName);
  const brandAgrees = (keys: string[]) => keys.some((k) => (k.length >= 3 && rNameWords.has(k)) || (k.length >= 6 && rNameCompact.includes(k)));
  if (modelHit && pBrandKeys.length && rName.trim() && !brandAgrees(pBrandKeys)) {
    return no(id, 'brand_mismatch', `Model ${modelHit.toUpperCase()} matches, but the brand of "${p.text.slice(0, 40)}" is not named in recall ${id}.`);
  }
  if (modelHit) {
    // A matching model number bought outside the recall's sale dates is an earlier, unaffected unit.
    const outside = outsideSaleDates(p, r);
    if (outside) return no(id, 'outside_sale_dates', `Model ${modelHit.toUpperCase()} matches, but ${outside}`);
    // The label's date of manufacture outside the recall's manufacture dates: a unit the recall does not cover.
    const made = outsideMadeDates(p.madeOn, `${r.description} ${r.soldAt}`);
    if (made) return no(id, 'outside_manufacture_dates', `Model ${modelHit.toUpperCase()} matches, but ${made}`);
    const win = p.madeOn ? manufactureWindow(`${r.description} ${r.soldAt}`) : null;
    const madeNote = win ? ` Made ${p.madeOn}, inside the recalled manufacture dates (${win.start} to ${win.end}).` : '';
    return { recallId: id, match: true, level: 'exact', reason: 'exact_model', evidence: `Exact model number match: ${modelHit.toUpperCase()} is named in recall ${id}.${madeNote}` };
  }

  // 3a. Brand.
  const nameText = recallNameText(r);
  const nameWords = new Set(words(nameText));
  const nameCompact = compact(nameText);
  const brand = brandKeys(p.text).find((k) => (k.length >= 3 && nameWords.has(k)) || (k.length >= 6 && nameCompact.includes(k)));
  if (!brand) return no(id, 'brand_mismatch', `The brand of "${p.text.slice(0, 40)}" is not named in recall ${id}.`);

  // 3b. Product type from the fixed list.
  const pTypes = typesIn(p.text);
  const rTypes = new Set<string>();
  for (const n of r.productNames) for (const t of typesIn(primaryPart(n))) rTypes.add(t);
  if (rTypes.size === 0) for (const t of typesIn(r.title)) rTypes.add(t);
  if (pTypes.size === 0) return no(id, 'no_product_type', `"${p.text.slice(0, 40)}" does not name a product type, so it cannot be matched.`);
  const sharedType = [...pTypes].find((t) => rTypes.has(t));
  if (!sharedType) return no(id, 'type_mismatch', `Same brand, but a ${[...pTypes].join('/')} is not the recalled ${[...rTypes].join('/') || 'product'}.`);

  // 3c. Model clash: the recall lists model numbers and the purchase shows a different one. Only a real model
  // field, or a word shaped like the recall's model numbers (same letter/digit pattern, similar length), counts:
  // a product name such as "Aer2" is not a model number.
  const clashModels = [
    ...(p.model ? [compact(p.model)] : []),
    ...words(p.text).filter((w) => isModelCode(w) && r.models.some((rm) => looksLikeModel(w, rm))).map(compact),
  ];
  if (r.models.length && clashModels.length) {
    return no(id, 'model_clash', `Model ${clashModels[0].toUpperCase()} is not one of the recalled models (${r.models.slice(0, 4).join(', ').toUpperCase()}).`);
  }

  // 3d. Distinctive series word (e.g. "Max View", "Elmo"): if the recalled name has one, the purchase must share it.
  const brandWords = new Set(words(brand));
  const distinct = new Set<string>();
  for (const n of r.productNames) {
    for (const w of words(primaryPart(n))) {
      if (w.length >= 3 && !GENERIC.has(w) && !TYPE_WORDS.has(w.replace(/s$/, '')) && !TYPE_WORDS.has(w) && !brandWords.has(w) && !/^\d+$/.test(w)) distinct.add(w);
    }
  }
  if (r.source === 'cpsc' && distinct.size) {
    const pc = compact(p.text);
    const pw = new Set(pWords.map((w) => w.replace(/s$/, '')));
    const nameTokens = [...distinct].filter((w) => !brand.includes(w));
    const runs = r.productNames.map((n) => compact(primaryPart(n)));
    const shares = nameTokens.length === 0 || nameTokens.some((w) => pw.has(w.replace(/s$/, '')) || (w.length >= 4 && pc.includes(w))) ||
      // spacing variants: "Max View" in the recall vs "MaxView" bought
      nameTokens.some((w, i) => nameTokens[i + 1] && pc.includes(w + nameTokens[i + 1])) || runs.some((rc) => rc.length >= 6 && pc.includes(rc));
    if (!shares) return no(id, 'series_mismatch', `Same brand and type, but the recalled ${[...distinct].slice(0, 3).join(' ')} is a different product line.`);
  }

  // 3e. Size clash (FDA formula): the recall lists can sizes and the purchase names a different one.
  if (r.source === 'fda') {
    const sizes = (t: string) => [...lower(t).matchAll(/(\d+(?:\.\d+)?)\s*-?\s*oz/g)].map((m) => Number(m[1]));
    const rs = sizes(r.productNames.join(' '));
    const ps = sizes(p.text);
    if (rs.length && ps.length && !ps.some((x) => rs.some((y) => Math.abs(x - y) < 0.05))) {
      return no(id, 'size_clash', `Can size ${ps[0]} oz is not one of the recalled sizes (${[...new Set(rs)].join(', ')} oz).`);
    }
  }

  // 3f. Sale dates.
  const bought = (p.date || '').slice(0, 7);
  const win = r.source === 'cpsc' ? saleWindow(r.soldAt) || saleWindow(r.description) : null;
  const outside = outsideSaleDates(p, r);
  if (outside) return no(id, 'outside_sale_dates', outside.charAt(0).toUpperCase() + outside.slice(1));
  const madeOut = outsideMadeDates(p.madeOn, `${r.description} ${r.soldAt}`);
  if (madeOut) return no(id, 'outside_manufacture_dates', madeOut.charAt(0).toUpperCase() + madeOut.slice(1));
  if (!win && bought && r.recallDate) {
    const rd = r.recallDate.slice(0, 7);
    // FDA formula: a can bought more than 6 months after the recall began is a newer batch (stale recall).
    const lateLimit = r.source === 'fda' ? 6 : 1;
    if (bought > addMonths(rd, lateLimit)) return no(id, 'bought_after_recall', `Bought ${bought}, after the recall of ${rd}.`);
    if (r.source === 'fda' && bought < addMonths(rd, -24)) return no(id, 'stale_fda', `Bought ${bought}, long before the ${rd} recall.`);
  }

  // 3g. Seller: when the recall says it was sold only at named stores, the purchase store must be one of them.
  const store = compact(p.merchant || p.source || '');
  const soldLower = lower(r.soldAt);
  const exclusive = /\b(exclusively|only)\b/.test(soldLower);
  const listedStores = STORES.filter((s) => compact(soldLower).includes(s));
  if (exclusive && store && STORES.includes(store) && listedStores.length && !listedStores.includes(store)) {
    return no(id, 'seller_mismatch', `Bought at ${store}, but the recall says it was sold only at ${listedStores.join(', ')}.`);
  }

  const parts = [`brand "${brand}"`, `type ${sharedType}`];
  if (bought && win) parts.push(`bought ${bought} inside the ${win.start}–${win.end ?? 'recall'} sale window`);
  if (store && listedStores.includes(store)) parts.push(`sold at ${store}`);
  const tail = r.source === 'fda' ? ' Check the lot code on the bottom of the can against the recall notice.' : '';
  return { recallId: id, match: true, level: 'rules', reason: 'rules', evidence: `Matches recall ${id}: ${parts.join(', ')}.${tail}` };
}

/** "bought YYYY-MM, but the recalled product was sold A to B." when a CPSC sale window rules the purchase out; else null. */
function outsideSaleDates(p: PurchaseItem, r: RecallRecord): string | null {
  const bought = (p.date || '').slice(0, 7);
  const win = r.source === 'cpsc' ? saleWindow(r.soldAt) || saleWindow(r.description) : null;
  if (!bought || !win) return null;
  const end = win.end ?? r.recallDate.slice(0, 7);
  if (bought < addMonths(win.start, -1) || bought > addMonths(end, 1)) return `bought ${bought}, but the recalled product was sold ${win.start} to ${end}.`;
  return null;
}

/** Every recall that matches one purchase. */
export function matchAll(p: PurchaseItem, recalls: RecallRecord[]): MatchResult[] {
  return recalls.map((r) => matchRecall(p, r)).filter((m) => m.match);
}

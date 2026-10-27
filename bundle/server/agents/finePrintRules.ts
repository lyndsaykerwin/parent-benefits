/**
 * Plain code rules for an offer's fine print (no AI). They read the dollar figures, dates and "strings attached"
 * straight from the text, compute the true value, and give a verdict: approve, approve_with_catch or reject.
 * A code "reject" always overrides an AI "approve" (see finalVerdict). Test cases: data/sample/fine-print-cases/.
 * Every dollar figure here is read from the text or computed from figures that are; nothing is guessed.
 */
import { createHash } from 'crypto';
import type { FinePrintCheck } from './types';
import type { FinePrintVerdict } from '../../shared/bundle';
import { effortSettings, type EffortSettings } from './valueScore';

/** An offer whose deadline is this many days away or fewer gets an "about to expire" catch. */
export const EXPIRING_SOON_DAYS = 7;

const AMT = '\\$\\s?(\\d[\\d,]*(?:\\.\\d+)?)';
const NUM = '\\d[\\d,]*(?:\\.\\d+)?';
/** A dollar amount written as "$9.95" or "9.95 dollars" (group 1 or group 2 holds the number). */
const MONEY = `(?:\\$\\s?(${NUM})|(${NUM})\\s*(?:dollars?|usd)\\b)`;
const cents = (s: string): number => Math.round(Number(s.replace(/,/g, '')) * 100);
const DAY_MS = 86_400_000;

// ---- Shared patterns: also used by offerScreen.offlineProblem, so the two can never drift apart. ----
/** A fee above this (in dollars) on a "free" offer whose value isn't stated makes it not free (reject). */
export const FEE_LIMIT_DOLLARS = 5;
/** Words that name a fee: shipping, handling, postage, S&H, S/H, or a plain "fee". */
const FEE_WORD = '(?:shipping|handling|postage|s\\s?&\\s?h|s\\/h|(?:processing|service|activation)\\s+fees?|fees?)';
const FEE_BEFORE = new RegExp(`${MONEY}\\s+(?:in\\s+|for\\s+)?${FEE_WORD}(?![\\w&/])`, 'gi');
const FEE_AFTER = new RegExp(`(?<![\\w&/])${FEE_WORD}(?:\\s+(?:and|&)\\s+${FEE_WORD})?(?:\\s+(?:fees?|charges?|costs?))?(?:\\s*:|\\s+(?:of|is|are|costs?|will be))?\\s*${MONEY}`, 'gi');
const THRESHOLD_WORDS = /(over|above|than|minimum|least|exceed\w*|spend\w*|orders?\s+of)\s*$/i;
/**
 * A shipping or handling fee with no amount: "Shipping charges may apply", "Shipping and handling fees apply",
 * "Taxes and shipping will apply", "Offers may be subject to additional shipping and handling fees". A catch, never a block.
 */
export const FEE_MAY_APPLY = /(?<!\bfree\s)(?<!\bno\s)\b(?:shipping|handling|postage)(?:\s+(?:and|&)\s+(?:shipping|handling|postage))?(?:\s+(?:fees?|charges?|costs?|rates?))?\s+(?:(?:may|will|can)\s+)?apply\b|\byou\s+pay\s+(?:for\s+)?(?:the\s+)?shipping\b|\bsubject\s+to\s+(?:an?\s+)?(?:additional\s+)?(?:shipping|handling)\b[^.;]{0,30}?\b(?:fees?|charges?|surcharges?)\b/i;
export const MEMBERSHIP_NEEDED = new RegExp([
  '\\b(?:requires?|required)\\b[^.;]{0,40}\\b(?:prime|membership|member|subscription)\\b',
  '\\b(?:prime|membership|member|subscription)\\s+(?:is\\s+)?required\\b',
  // "available to customers with active Amazon Prime accounts", "for Prime members only", "must be a Costco member"
  '\\b(?:available|open|only)\\s+(?:only\\s+)?(?:to|for)\\s+(?:customers\\s+(?:with|who\\s+(?:are|have))\\s+)?(?:an?\\s+)?(?:active\\s+|paid\\s+)?(?:amazon\\s+)?(?:prime|costco|walmart\\+|paid)\\b[^.;]{0,20}?\\b(?:accounts?|members?|memberships?)\\b',
  '\\bmust\\s+(?:be|have)\\s+(?:an?\\s+)?(?:active\\s+|paid\\s+)?(?:amazon\\s+)?[\\w+]+\\s+(?:member|membership)\\b',
  '\\b(?:available\\s+to\\s+)?members\\s+only\\b',
  '\\bprime\\s+members?\\s+only\\b',
].join('|'), 'gi');
/** "No", "never", "without"... just before a match turns it around ("No auto-renewal", "no membership required"). */
const NEGATION_BEFORE = /\b(?:no|not|never|without|won't|doesn't|does\s+not|will\s+not|isn't|is\s+not)\b[^.;,]{0,12}$/i;

/** Position of the first match of `re` that isn't negated, or -1. */
export function firstUnnegated(re: RegExp, text: string): number {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  for (const m of text.matchAll(g)) {
    const at = m.index ?? 0;
    if (!NEGATION_BEFORE.test(text.slice(Math.max(0, at - 25), at))) return at;
  }
  return -1;
}

/** Fee amounts written in the text; thresholds like "free shipping on orders over $50" and "no fee" don't count. */
export function statedFees(text: string): { cents: number; at: number }[] {
  const out = new Map<number, number>();
  for (const re of [FEE_BEFORE, FEE_AFTER, PAY_FOR_FEE]) {
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      const amountAt = start + m[0].search(/[$\d]/);
      if (THRESHOLD_WORDS.test(text.slice(Math.max(0, amountAt - 20), amountAt))) continue;
      if (NEGATION_BEFORE.test(text.slice(Math.max(0, start - 25), start))) continue;
      out.set(amountAt, cents(m[1] ?? m[2]));
    }
  }
  return [...out].map(([at, c]) => ({ at, cents: c }));
}

const FACE_VALUE = new RegExp(`\\(\\s*(?:an?\\s+)?${AMT}\\s+value\\)|\\b(?:valued\\s+at|worth)\\s+${AMT}|${AMT}\\s+(?:retail\\s+)?value\\b|${AMT}\\s+(?:back|off)\\b`, 'i');
/** "pay $8.95 + tax, where applicable, for shipping" (Babylist): a stated fee written with the amount before "for shipping". */
const PAY_FOR_FEE = new RegExp(`\\bpay\\s+${AMT}[^.;$]{0,40}?\\bfor\\s+(?:shipping|handling|postage)\\b`, 'gi');
const MEMBERSHIP_COST = new RegExp(`(\\d+)[- ]month\\s+(?:membership|subscription|plan)[^.;]*?${AMT}\\s*/\\s*(?:mo|month)\\b`, 'i');
const PERIOD = '(week|month|year|weekly|monthly|annually|yearly)';
/** A free trial or free first box that turns into a paid plan without the word "renew": "Free trial for 7 days, then
 *  $14.99 per month", "first box is free, then $24.99 per month", "after the trial you pay $9.99 a month". */
const SHORT_PERIOD = '(week|month|year|mth|mo|wk|yr)\\.?';
const ADVERB_PERIOD = '\\s*(weekly|monthly|annually|yearly)';
const THEN_PAID = new RegExp(`\\b(?:then|afterwards?|after\\s+(?:the|your|that)\\b[^.;$]{0,40}?|unless\\s+you\\s+cancel\\w*\\b[^.;$]{0,40}?|(?:becomes|converts?\\s+to|turns\\s+into|continues?\\s+(?:at|for))\\b[^.;$]{0,30}?)(?:\\s*(?:it'?s|it\\s+is|you(?:'ll)?\\s+(?:pay|be\\s+charged|be\\s+billed)|you\\s+will\\s+be\\s+(?:charged|billed)|only|just|at|for|is)\\b)?\\s*${AMT}\\s*(?:(?:/|per|a|an|each|every)\\s*${SHORT_PERIOD}|${ADVERB_PERIOD})(?![a-z])`, 'i');
/** "$0 today, $19 monthly after 30 days": a recurring price that starts later. */
const LATER_PAID = new RegExp(`${AMT}\\s*(?:(?:/|per|a|an|each|every)\\s*${SHORT_PERIOD}|${ADVERB_PERIOD})\\.?\\s+(?:after|once|when|starting|beginning|from)\\b`, 'i');
const RENEWAL = new RegExp(`\\b(?:renews?|renewal|auto-?renews?|(?:paid\\s+)?(?:membership|subscription|plan)\\s+(?:at|for))\\b[^.;]*?${AMT}\\s*/\\s*(week|month|year)|\\b(?:auto-?bill(?:s|ed)?|auto-?charge[sd]?|bill(?:s|ed)|charge[sd]?|renews?\\s+at)\\s+${AMT}\\s*(?:per\\s+|a\\s+|an\\s+|every\\s+|/\\s*)?${PERIOD}\\b`, 'i');
const AUTO_RENEW = /\b(?:renews?|renewal|auto-?renew\w*|recurring\s+(?:charge|billing|payment)s?|auto-?bill\w*|auto-?charge\w*|automatically\s+(?:billed|charged|renewed|enrolled)|(?:billed|charged)\s+(?:\$\s?[\d.,]+\s+)?(?:monthly|weekly|yearly|annually|every\s+(?:week|month|year)))\b/gi;
const PERIOD_WORD: Record<string, 'week' | 'month' | 'year'> = { week: 'week', weekly: 'week', wk: 'week', month: 'month', monthly: 'month', mo: 'month', mth: 'month', year: 'year', yearly: 'year', annually: 'year', yr: 'year' };
const MIN_PURCHASE = new RegExp([
  `(?:orders?|purchases?)\\s+of\\s+${AMT}\\s+(?:or\\s+more|\\+)`,
  `minimum\\s+(?:purchase|order|spend)\\s+(?:of\\s+|totaling\\s+|totalling\\s+)?${AMT}`,
  `spend\\s+${AMT}\\s+(?:or\\s+more|on\\b)`,
  // "have over $10 of purchases from their registry" (Amazon), "Purchase over $10 from your registry" (Target)
  `(?:over|more\\s+than|at\\s+least)\\s+${AMT}\\s+(?:of|in)\\s+(?:\\w+\\s+){0,2}purchases?`,
  `\\b(?:purchase|buy|spend)\\s+(?:over|more\\s+than|at\\s+least)\\s+${AMT}`,
  // "Over $25 purchased from and through your registry" (Walmart)
  `(?:over|more\\s+than|at\\s+least)\\s+${AMT}\\s+(?:purchased|spent)\\b`,
].join('|'), 'i');
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_NAME = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
const DEADLINE = new RegExp(`\\b(?:through|thru|ends?|until|expires?(?:\\s+on)?|by|valid\\s+(?:to|until|through))\\s+(?:(\\d{4}-\\d{2}-\\d{2})\\b|${MONTH_NAME}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b)`, 'gi');
/** Fine print up to this long is about one offer, so any end date in it is the offer's own. Longer text is a whole web page. */
const SHORT_FINE_PRINT_CHARS = 600;
/** A sentence that starts with a footnote mark (†, ‡, *, §, ¹...) is about a side offer, not the main one. */
const FOOTNOTE_START = /^[\s(]*[†‡*§¹²³⁴⁵]/;
const TITLE_STOP = new Set(['free', 'with', 'your', 'from', 'baby', 'offer', 'deal', 'deals', 'the', 'and', 'for', 'get', 'new']);
/** "within 30 days" only counts as a claim window when it's about claiming, redeeming, submitting or mailing. */
const CLAIM_WORDS = '(?:claim|redeem|submit|mail|send|file|register|apply|postmark|upload)\\w*';
const CLAIM_WINDOW = new RegExp(`\\b${CLAIM_WORDS}\\b[^.;]{0,80}?\\bwithin\\s+(\\d+)\\s+days\\b|\\bwithin\\s+(\\d+)\\s+days\\b[^.;]{0,30}?\\bto\\s+${CLAIM_WORDS}\\b`, 'i');
const WAIT_RANGE = /\b(\d+)\s*(?:[–-]|to)\s*(\d+)\s*(?:business\s+)?(day|week)s?\b/gi;
const PAYOUT_WORDS = /\b(?:allow|arrive|receive|ships?|deliver\w*|mailed|process\w*|paid|payout|payment|card|check)\b/i;
const REGIONS = /\b[Nn]ot\s+(?:[Aa]vailable|valid)\s+in\s+([A-Z]{2}(?:\s*(?:,|or|and|,\s*or|,\s*and)\s*[A-Z]{2})*)/;
const INJECTION = new RegExp([
  '\\b(?:ignore|disregard|forget|override)\\s+(?:all\\s+|any\\s+)?(?:of\\s+)?(?:your|the|these|those|previous|prior|earlier|above|my)?\\s*(?:previous\\s+|prior\\s+|earlier\\s+|above\\s+)?(?:rules|instructions|guidance|guidelines|prompts?|directions)',
  '\\bnote\\s+to\\s+(?:the\\s+)?(?:ai|assistant|model|reviewers?|llm)\\b',
  '\\b(?:ai|assistant|model)s?\\b[^.]{0,40}\\bapprove\\s+this\\b',
  '\\bmark\\s+(?:this\\s+|it\\s+)?(?:offer\\s+)?as\\s+(?:approved?|safe|verified|legit\\w*)\\b',
  '(?:^|[\\s.\\[(])(?:system|assistant)\\s*:',
].join('|'), 'i');

const FLAGS = {
  mailIn: /\bmail-in\b|\bmail\s+(?:the|your|in|it)\b/i,
  needsReceipt: /\breceipt\b/i,
  needsProofOfPurchase: /\bUPC\b|\bproof\s+of\s+purchase\b|\bbarcode\b/i,
  needsForms: /\bforms?\b/i,
  // A call you must make to get the offer. Not "mobile phone", not a help-line number ("give us a call at 1-800...").
  needsPhoneCall: /\bcall\b[^.;]{0,40}?\bto\s+(?:claim|request|order|redeem|enroll|register|activate|get|receive|qualify|schedule|sign\s+up)\b|\b(?:claim|request|order|redeem|enroll|register|activate)\w*\s+(?:it\s+)?(?:by\s+(?:phone|calling)|over\s+the\s+phone)\b|\bphone\s+call\s+(?:is\s+)?required\b|\bmust\s+call\b/i,
  accountRequired: /\bcreate\s+an?\s+(?:free\s+)?account\b|\baccount\s+(?:is\s+)?required\b|\bsign\s+up\s+(?:for|to|with)\b|\bregister\s+for\s+an?\s+(?:free\s+)?account\b/i,
  // Only when the app is a condition; a page menu's "Download the app" or "even if you don't download the app" is not.
  appRequired: /\bapp\s+(?:is\s+)?required\b|\b(?:must|need\s+to|required\s+to|have\s+to)\s+(?:download|use|install)\s+(?:our|the)\b[^.;]{0,20}?\bapp\b|\bonly\s+(?:available\s+)?(?:in|through|on|via)\s+(?:our|the)\b[^.;]{0,20}?\bapp\b|\bwhen\s+you\b[^.;]{0,60}?\bdownload\s+(?:our|the)\s+app\b|\bdownload\s+(?:our|the)\s+app\s+to\s+(?:claim|redeem|get|receive|activate|qualify|unlock)\b/i,
  marketingOptInRequired: /\bopt[- ]in\b/i,
  inStoreOnly: /\bin[- ]store(?:\s+pickup)?\s+only\b/i,
  limitedStock: /\bwhile\s+supplies\s+last\b|\blimited\s+(?:stock|quantities|supply)\b/i,
  onePerHousehold: /\bone\s+per\s+(?:household|customer|family)\b/i,
  cardRequired: /\bcard\s+required\b|\b(?:credit|debit|payment)\s+card\s+(?:is\s+)?required\b|\bcard\s+on\s+file\b|\brequires?\s+an?\s+(?:credit\s+|debit\s+|payment\s+)?card\b/i,
};
/** The flags that each count as one thing the parent has to do. */
const STEP_FLAGS = ['mailIn', 'needsReceipt', 'needsProofOfPurchase', 'needsForms', 'needsPhoneCall', 'accountRequired', 'appRequired', 'marketingOptInRequired'] as const;

/** A fingerprint of the exact wording (spacing and case ignored), so a change in the terms is noticed. */
export function fingerprint(text: string): string {
  return createHash('sha256').update(text.toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex');
}

/** An evidence quote must be exact words from the fine print (an empty quote means "nothing to quote"). */
export const quoteIsExact = (quote: string, finePrint: string): boolean => quote === '' || finePrint.includes(quote);

/**
 * The blocking rule (Lyndsay, Oct 26): only the code threshold blocks. A code "reject" always wins. An AI "reject"
 * blocks only when it cites a learned rule (parents' feedback); otherwise it can only turn an approval into a catch.
 * No AI answer = the code verdict.
 */
export function finalVerdict(code: FinePrintVerdict, ai: FinePrintVerdict | null | undefined, aiCitesRule = false): FinePrintVerdict {
  if (!ai || code === 'reject') return code;
  if (ai === 'reject' && aiCitesRule) return 'reject';
  if (ai === 'reject' || ai === 'approve_with_catch') return 'approve_with_catch';
  return code;
}

const EFFORT_ONLY = /\b(?:app|apps|account|sign(?:ing)?\s+up|join(?:ing)?|enrol(?:l|ling|lment)|register(?:ing)?|registration|program)\b/i;
const MONEY_WORDS = /\$|\b(?:fee|fees|cost|costs|pay|paid|charge\w*|purchase\w*|spend\w*|subscription|renew\w*|card|price)\b/i;

/** The AI Judge's ruling, as far as the threshold needs it. `quote` = exact words from the fine print behind a catch. */
export interface AiRuling { verdict: FinePrintVerdict; citedRuleIds: string[]; reason: string; quote?: string }

/**
 * Combine the code check and the AI Judge. The AI may flag a catch the code missed, but only with an exact quote
 * from the fine print (so it cannot invent one); that catch is added to the check's reasons. An AI reject blocks only
 * with a learned rule it cites, or exact quoted words that themselves show a paid-plan trap or a cost above the value.
 * An unquoted AI reject is never dropped: it becomes a catch ("our checker raised a concern...").
 */
export function combineVerdict(check: FinePrintCheck, ai: AiRuling | null | undefined, finePrint: string): { verdict: FinePrintVerdict; check: FinePrintCheck } {
  if (!ai) return { verdict: check.verdict, check };
  const cites = ai.citedRuleIds.length > 0;
  if (check.verdict === 'reject' || (ai.verdict === 'reject' && cites)) return { verdict: 'reject', check: { ...check, verdict: 'reject' } };
  if (ai.verdict === 'approve') return { verdict: check.verdict, check };
  const quote = (ai.quote ?? '').trim();
  const exact = !!quote && finePrint.includes(quote);
  // An AI reject backed by exact words that themselves show a paid-plan trap or a cost bigger than the value: block.
  if (ai.verdict === 'reject' && exact && checkFinePrint(quote, { today: '1970-01-01' }).catchTypes.some((t) => t === 'negative_value' || (t === 'auto_renew' && /\$/.test(quote)))) {
    return { verdict: 'reject', check: { ...check, verdict: 'reject', catchTypes: [...check.catchTypes, 'ai_found_catch'], reasons: [...check.reasons, ai.reason.trim() || 'the AI reviewer found a paid-plan trap'], evidenceQuote: check.evidenceQuote || quote } };
  }
  // The AI flags a catch (or an uncited reject) and the code already found one: a catch.
  if (check.verdict === 'approve_with_catch') return { verdict: 'approve_with_catch', check };
  // An AI reject we could not tie to exact words is never silently dropped: it shows as a catch the parent should read.
  if (!exact) {
    if (ai.verdict !== 'reject') return { verdict: check.verdict, check };
    return { verdict: 'approve_with_catch', check: { ...check, verdict: 'approve_with_catch', catchTypes: [...check.catchTypes, 'ai_concern'],
      reasons: [...check.reasons, `our checker raised a concern we couldn't confirm in the fine print: ${ai.reason.trim() || 'read the terms before you sign up'}`] } };
  }
  // Joining a free program, an app or an account is effort (minutes), not a catch, unless money or a card is involved.
  if (EFFORT_ONLY.test(ai.reason) && !MONEY_WORDS.test(ai.reason)) return { verdict: check.verdict, check };
  // Consistency (QC, Oct 26): an AI "catch" the code rules found nothing for counts only when the AI's quoted words,
  // read by the same code rules, show a catch. Otherwise two runs of the AI could grade the same page differently.
  if (ai.verdict === 'approve_with_catch' && !checkFinePrint(quote, { today: '1970-01-01' }).catchTypes.some((t) => t !== 'expired')) return { verdict: check.verdict, check };
  return {
    verdict: 'approve_with_catch',
    check: {
      ...check, verdict: 'approve_with_catch',
      catchTypes: [...check.catchTypes, 'ai_found_catch'], reasons: [...check.reasons, ai.reason.trim() || 'the AI reviewer found a catch'],
      evidenceQuote: check.evidenceQuote || quote,
    },
  };
}

export const availableInState = (check: Pick<FinePrintCheck, 'regionsExcluded'>, state: string): boolean =>
  !check.regionsExcluded.includes(state.toUpperCase());

/** Sentence spans [start, end) in the text, so evidence is always an exact slice. */
function sentences(text: string): [number, number][] {
  const spans: [number, number][] = [];
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    const ch = text[i];
    if (i === text.length || ((ch === '.' || ch === ';' || ch === '!' || ch === '?') && (i + 1 === text.length || /\s/.test(text[i + 1])))) {
      const end = i === text.length ? i : i + 1;
      const s = text.slice(start, end);
      const lead = s.length - s.trimStart().length;
      if (s.trim()) spans.push([start + lead, end]);
      start = end;
    }
  }
  return spans;
}

/** `effort` overrides the effort-minute estimates (defaults: effortSettings() in valueScore.ts). */
/** The one rule for effort level, shared by a fresh check and a reused saved grade. */
export function effortLevelFor(stepsCount: number, mailIn: boolean, inStoreOnly: boolean): 'low' | 'medium' | 'high' {
  return stepsCount >= 3 || mailIn ? 'high' : stepsCount >= 1 || inStoreOnly ? 'medium' : 'low';
}

export interface CheckOptions {
  today: string;
  effort?: EffortSettings;
  /** The offer's own listed dollar value (cents, from its headline), used only to decide "costs more than it is worth"
   *  when the fine print states no value. It is never written into faceValueCents (that stays "what the text says"). */
  listedValueCents?: number | null;
  /** The offer's title. On a long web page, a past end date counts only in a sentence that names the offer. */
  title?: string;
}

/** Read one offer's fine print with code rules only. No family data goes into a check. */
export function checkFinePrint(text: string, opts: CheckOptions): FinePrintCheck {
  const quoted: number[] = [];
  const catchTypes: string[] = [];
  const reasons: string[] = [];
  const catchAt: number[] = []; // text positions of the words behind each catch, for the evidence quote
  const addCatch = (type: string, reason: string, at: number) => {
    if (!catchTypes.includes(type)) { catchTypes.push(type); reasons.push(reason); }
    if (at >= 0) catchAt.push(at);
  };
  const pos = (re: RegExp): number => { const m = re.exec(text); return m ? m.index : -1; };

  // Money
  const face = FACE_VALUE.exec(text);
  const faceValueCents = face ? cents(face.slice(1).find((g) => g !== undefined)!) : null;
  if (faceValueCents !== null) quoted.push(faceValueCents);

  let hiddenCostCents = 0;
  const fees = statedFees(text);
  for (const f of fees) {
    hiddenCostCents += f.cents; quoted.push(f.cents);
    addCatch('shipping_fee', `the fine print states a $${(f.cents / 100).toFixed(2)} fee (shipping, handling or similar)`, f.at);
  }
  const mem = MEMBERSHIP_COST.exec(text);
  if (mem) {
    const months = Number(mem[1]); const monthly = cents(mem[2]);
    quoted.push(monthly);
    hiddenCostCents += months * monthly;
    addCatch('required_membership', `a required ${months}-month membership at $${(monthly / 100).toFixed(2)}/month adds $${((months * monthly) / 100).toFixed(2)}`, mem.index);
  } else if (firstUnnegated(MEMBERSHIP_NEEDED, text) >= 0) {
    const at = firstUnnegated(MEMBERSHIP_NEEDED, text);
    const which = /\bprime\b/i.test(text.slice(at, at + 120)) ? 'an Amazon Prime membership' : /\bcostco\b/i.test(text) ? 'a Costco membership' : 'a paid membership or subscription';
    addCatch('required_membership', `needs ${which} (no price given; fine if you already have one)`, at);
  }
  if (firstUnnegated(FEE_MAY_APPLY, text) >= 0) addCatch('fee_unknown', 'a shipping or handling fee may apply, with no amount given', firstUnnegated(FEE_MAY_APPLY, text));

  const trueValueCents = faceValueCents === null ? null : faceValueCents - hiddenCostCents;
  // "Costs more than it is worth": the stated value, or else the offer's listed value, minus the fees the text states.
  const worth = faceValueCents ?? opts.listedValueCents ?? null;
  const netCents = worth === null ? null : worth - hiddenCostCents;
  if (netCents !== null && netCents < 0) addCatch('negative_value', `it costs $${(-netCents / 100).toFixed(2)} more than it is worth`, -1);
  // (offerScreen.offlineProblem is stricter on purpose: it only picks clean stand-in offers.) When the value is
  // stated, the true-value maths above decides instead (e.g. a $45 pillow with $14.95 shipping is still worth $30.05).
  // With no value to compare against, a big fee on a "free" offer is a catch (we can't show it costs more than it's worth).
  const bigFee = fees.find((x) => x.cents > FEE_LIMIT_DOLLARS * 100);
  if (bigFee && worth === null && /\bfree\b/i.test(text)) {
    addCatch('fee_over_limit', `it says free but charges a $${(bigFee.cents / 100).toFixed(2)} fee (over $${FEE_LIMIT_DOLLARS}); we couldn't confirm it's worth more than that`, bigFee.at);
  }

  const minM = MIN_PURCHASE.exec(text);
  const minPurchaseCents = minM ? cents(minM.slice(1).find((g) => g !== undefined)!) : null;
  if (minPurchaseCents !== null) { quoted.push(minPurchaseCents); addCatch('minimum_purchase', `you must spend at least $${(minPurchaseCents / 100).toFixed(2)}`, minM!.index); }

  // Subscriptions
  const ren = RENEWAL.exec(text);
  // A saving is not a charge: "Save $5 monthly after you join" or "get $10 off" is skipped.
  const paidMatch = (re: RegExp): RegExpExecArray | null => {
    for (const m of text.matchAll(new RegExp(re.source, 'gi'))) {
      const amountAt = (m.index ?? 0) + m[0].indexOf('$');
      if (!/\b(?:save[sd]?|saving|earn(?:s|ed)?|get|gets|back|off|discount|credit|cash\s+back)\s*$/i.test(text.slice(Math.max(0, amountAt - 20), amountAt))) return m as unknown as RegExpExecArray;
    }
    return null;
  };
  const thenPaid = ren ? null : paidMatch(THEN_PAID) ?? paidMatch(LATER_PAID);
  const renewalPriceCents = ren ? cents(ren[1] ?? ren[3]) : thenPaid ? cents(thenPaid[1]) : null;
  if (renewalPriceCents !== null) quoted.push(renewalPriceCents);
  const renewalPeriod = ren ? PERIOD_WORD[(ren[2] ?? ren[4]).toLowerCase()] : thenPaid ? PERIOD_WORD[(thenPaid[2] ?? thenPaid[3]).toLowerCase().replace('.', '')] : null;
  // "No auto-renewal" is not a renewal. A trial that turns into a stated monthly price is one, even without the word.
  const recurring = ren ?? thenPaid; // a stated recurring price ("charged $9.99 a month") is a renewal too
  const autoRenewAt = firstUnnegated(AUTO_RENEW, text) >= 0 ? firstUnnegated(AUTO_RENEW, text)
    : recurring && !NEGATION_BEFORE.test(text.slice(Math.max(0, (recurring.index ?? 0) - 25), recurring.index ?? 0)) ? (recurring.index ?? 0) : -1;
  const autoRenew = autoRenewAt >= 0;
  if (autoRenew) addCatch('auto_renew', renewalPriceCents !== null ? `it renews automatically at $${(renewalPriceCents / 100).toFixed(2)}/${renewalPeriod}` : 'it renews automatically', autoRenewAt);
  const cancelMethod = /\bcancel\w*\s+online\b/i.test(text) ? 'online' : /\bcancel\w*\s+(?:by\s+(?:phone|calling)|via\s+phone)\b/i.test(text) ? 'phone' : /\bcancel\w*\s+by\s+mail\b/i.test(text) ? 'mail' : null;

  // Dates. On short fine print every end date is the offer's own. On a long web page, a date counts only when its
  // sentence names the offer (a word from its title) and is not a footnote for a side offer ("† Offer expires ...").
  const titleWords = (opts.title ?? '').toLowerCase().match(/[a-z]{4,}/g)?.filter((w) => !TITLE_STOP.has(w)) ?? [];
  const spansForDates = sentences(text);
  const dateSentence = (at: number) => { const sp = spansForDates.find(([a, b]) => at >= a && at < b); return sp ? text.slice(sp[0], sp[1]) : ''; };
  const relevantDate = (m: RegExpMatchArray): boolean => {
    const sent = dateSentence(m.index ?? 0);
    if (FOOTNOTE_START.test(sent)) return false;
    if (text.length <= SHORT_FINE_PRINT_CHARS) return true;
    const low = sent.toLowerCase();
    return titleWords.some((w) => low.includes(w.replace(/s$/, '')));
  };
  const dl = [...text.matchAll(DEADLINE)].find(relevantDate) ?? null;
  const deadlineDate = !dl ? null : dl[1] ?? `${dl[4]}-${String(MONTHS.indexOf(dl[2].slice(0, 3).toLowerCase()) + 1).padStart(2, '0')}-${dl[3].padStart(2, '0')}`;
  const daysLeft = deadlineDate ? Math.round((Date.parse(`${deadlineDate}T00:00:00Z`) - Date.parse(`${opts.today}T00:00:00Z`)) / DAY_MS) : null;
  const expired = daysLeft !== null && daysLeft < 0;
  if (expired) addCatch('expired', `the offer ended on ${deadlineDate}`, dl!.index);
  else if (daysLeft !== null && daysLeft <= EXPIRING_SOON_DAYS) addCatch('expiring_soon', `only ${daysLeft} days left (ends ${deadlineDate})`, dl!.index);
  const cw = CLAIM_WINDOW.exec(text);
  const claimWindowDays = cw ? Number(cw[1] ?? cw[2]) : null;
  // Payout wait: prefer a "N–M days/weeks" range in a sentence about the money arriving; else the first such range.
  const ranges = [...text.matchAll(WAIT_RANGE)];
  const sentenceOf = (at: number) => { const sp = sentences(text).find(([a, b]) => at >= a && at < b); return sp ? text.slice(sp[0], sp[1]) : ''; };
  const wr = ranges.find((m) => PAYOUT_WORDS.test(sentenceOf(m.index ?? 0))) ?? ranges[0] ?? null;
  const mult = wr && wr[3].toLowerCase() === 'week' ? 7 : 1;
  const payoutWaitDaysMin = wr ? Number(wr[1]) * mult : null;
  const payoutWaitDaysMax = wr ? Number(wr[2]) * mult : null;

  // Effort and availability flags
  const f = Object.fromEntries(Object.entries(FLAGS).map(([k, re]) => [k, re.test(text)])) as Record<keyof typeof FLAGS, boolean>;
  f.cardRequired = firstUnnegated(FLAGS.cardRequired, text) >= 0; // "No credit card required" is not a card requirement
  const CATCH_FOR: Partial<Record<keyof typeof FLAGS, [string, string]>> = {
    mailIn: ['mail_in_rebate', 'you have to mail something in'],
    // A phone call, a form, an account or an app is effort: it adds minutes (below), not a catch.
    marketingOptInRequired: ['marketing_opt_in', 'you have to agree to marketing messages'],
    inStoreOnly: ['in_store_only', 'in-store only'],
    limitedStock: ['limited_stock', 'while supplies last'],
    cardRequired: ['card_required', 'a payment card is required'],
  };
  for (const [k, v] of Object.entries(CATCH_FOR) as [keyof typeof FLAGS, [string, string]][]) if (f[k]) addCatch(v[0], v[1], pos(FLAGS[k]));
  const rg = REGIONS.exec(text);
  const regionsExcluded = rg ? rg[1].match(/[A-Z]{2}/g) ?? [] : [];
  if (regionsExcluded.length) addCatch('regions_excluded', `not available in ${regionsExcluded.join(', ')}`, rg!.index);

  const injectionDetected = INJECTION.test(text);
  if (injectionDetected) addCatch('prompt_injection', 'the fine print contains orders aimed at the AI reviewer; they were ignored', pos(INJECTION));

  const stepsCount = STEP_FLAGS.filter((k) => f[k]).length;
  // Effort minutes are ESTIMATES, not measurements; the numbers live in valueScore.ts (EFFORT_DEFAULTS).
  const e = opts.effort ?? effortSettings();
  const effort = { min: e.base.min, max: e.base.max };
  effort.min += stepsCount * e.perStep.min; effort.max += stepsCount * e.perStep.max;
  if (f.mailIn) { effort.min += e.mailIn.min; effort.max += e.mailIn.max; }
  if (f.needsPhoneCall) { effort.min += e.phoneCall.min; effort.max += e.phoneCall.max; }
  if (f.inStoreOnly) { effort.min += e.inStore.min; effort.max += e.inStore.max; }
  const effortLevel = effortLevelFor(stepsCount, f.mailIn, f.inStoreOnly);

  const payoutForm = /\bprepaid\s+(?:card|visa|mastercard)\b/i.test(text) ? 'prepaid_card'
    : /\bpoints\b/i.test(text) ? 'points'
    : /\bcheck\b/i.test(text) ? 'check'
    : /%\s*off\b|\$\s?\d[\d,.]*\s+off\b/i.test(text) ? 'instant_discount' : null;

  // Verdict (Lyndsay's rule, Oct 26): block only when it costs more than it is worth, or it turns into a paid
  // subscription (renews automatically AND a card is required or a renewal price is stated). Also blocked: an offer
  // whose own end date has passed (it can't be used) and orders aimed at the AI. Everything else is a catch.
  const REJECT = ['negative_value', 'expired', 'prompt_injection'];
  if (autoRenew && (f.cardRequired || renewalPriceCents !== null)) REJECT.push('auto_renew');
  const verdict: FinePrintVerdict = catchTypes.some((c) => REJECT.includes(c)) ? 'reject' : catchTypes.length ? 'approve_with_catch' : 'approve';

  // Evidence: the exact sentences that hold the catches (one continuous slice of the text).
  let evidenceQuote = '';
  const spans = sentences(text);
  const hits = spans.filter(([s, e]) => catchAt.some((p) => p >= s && p < e));
  if (hits.length) evidenceQuote = text.slice(hits[0][0], hits[hits.length - 1][1]);
  else if (catchTypes.length && spans.length) evidenceQuote = text.slice(spans[0][0], spans[spans.length - 1][1]);

  return {
    finePrintHash: fingerprint(text),
    faceValueCents, hiddenCostCents, trueValueCents, minPurchaseCents,
    autoRenew, renewalPriceCents, renewalPeriod, cardRequired: f.cardRequired, cancelMethod,
    deadlineDate, expired, daysLeft, claimWindowDays, payoutWaitDaysMin, payoutWaitDaysMax,
    stepsCount, effortMinutesEstimate: effort, effortLevel,
    mailIn: f.mailIn, needsReceipt: f.needsReceipt, needsProofOfPurchase: f.needsProofOfPurchase,
    needsPhoneCall: f.needsPhoneCall, needsForms: f.needsForms, accountRequired: f.accountRequired,
    appRequired: f.appRequired, marketingOptInRequired: f.marketingOptInRequired, inStoreOnly: f.inStoreOnly,
    payoutForm, limitedStock: f.limitedStock, regionsExcluded, onePerHousehold: f.onePerHousehold,
    catchTypes, verdict, reasons, evidenceQuote, injectionDetected, quotedAmountsCents: quoted,
  };
}

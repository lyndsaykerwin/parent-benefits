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
export const FEE_MAY_APPLY = /\b(?:shipping|handling|postage)(?:\s+(?:and|&)\s+(?:shipping|handling|postage))?\s+(?:fees?|charges?|costs?)\s+(?:may|will|can)\s+apply\b/i;
export const MEMBERSHIP_NEEDED = /\b(?:requires?|required)\b[^.;]{0,40}\b(?:prime|membership|member|subscription)\b|\b(?:prime|membership|member|subscription)\s+(?:is\s+)?required\b/gi;
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
  for (const re of [FEE_BEFORE, FEE_AFTER]) {
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

const FACE_VALUE = new RegExp(`\\(${AMT}\\s+value\\)|${AMT}\\s+(?:back|off)\\b`, 'i');
const MEMBERSHIP_COST = new RegExp(`(\\d+)[- ]month\\s+(?:membership|subscription|plan)[^.;]*?${AMT}\\s*/\\s*(?:mo|month)\\b`, 'i');
const PERIOD = '(week|month|year|weekly|monthly|annually|yearly)';
const RENEWAL = new RegExp(`\\b(?:renews?|renewal|auto-?renews?)\\b[^.;]*?${AMT}\\s*/\\s*(week|month|year)|\\b(?:auto-?bill(?:s|ed)?|auto-?charge[sd]?|bill(?:s|ed)|charge[sd]?|renews?\\s+at)\\s+${AMT}\\s*(?:per\\s+|a\\s+|an\\s+|every\\s+|/\\s*)?${PERIOD}\\b`, 'i');
const AUTO_RENEW = /\b(?:renews?|renewal|auto-?renew\w*|recurring\s+(?:charge|billing|payment)s?|auto-?bill\w*|auto-?charge\w*|automatically\s+(?:billed|charged|renewed)|(?:billed|charged)\s+(?:\$\s?[\d.,]+\s+)?(?:monthly|weekly|yearly|annually|every\s+(?:week|month|year)))\b/gi;
const PERIOD_WORD: Record<string, 'week' | 'month' | 'year'> = { week: 'week', weekly: 'week', month: 'month', monthly: 'month', year: 'year', yearly: 'year', annually: 'year' };
const MIN_PURCHASE = new RegExp(`(?:orders?|purchases?)\\s+of\\s+${AMT}\\s+(?:or\\s+more|\\+)|minimum\\s+(?:purchase|order|spend)\\s+(?:of\\s+)?${AMT}|spend\\s+${AMT}\\s+or\\s+more`, 'i');
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_NAME = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
const DEADLINE = new RegExp(`\\b(?:through|thru|ends?|until|expires?(?:\\s+on)?|by|valid\\s+(?:to|until|through))\\s+(?:(\\d{4}-\\d{2}-\\d{2})\\b|${MONTH_NAME}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b)`, 'i');
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
  needsPhoneCall: /\bcall\b|\bphone\b/i,
  accountRequired: /\bcreate\s+an\s+account\b|\baccount\s+(?:is\s+)?required\b|\bsign\s+up\b/i,
  appRequired: /\bdownload\s+(?:our|the)\s+app\b|\bapp\s+(?:is\s+)?required\b/i,
  marketingOptInRequired: /\bopt[- ]in\b/i,
  inStoreOnly: /\bin[- ]store(?:\s+pickup)?\s+only\b/i,
  limitedStock: /\bwhile\s+supplies\s+last\b|\blimited\s+(?:stock|quantities|supply)\b/i,
  onePerHousehold: /\bone\s+per\s+(?:household|customer|family)\b/i,
  cardRequired: /\bcard\s+required\b|\bcredit\s+card\s+(?:is\s+)?required\b/i,
};
/** The flags that each count as one thing the parent has to do. */
const STEP_FLAGS = ['mailIn', 'needsReceipt', 'needsProofOfPurchase', 'needsForms', 'needsPhoneCall', 'accountRequired', 'appRequired', 'marketingOptInRequired'] as const;

/** A fingerprint of the exact wording (spacing and case ignored), so a change in the terms is noticed. */
export function fingerprint(text: string): string {
  return createHash('sha256').update(text.toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex');
}

/** An evidence quote must be exact words from the fine print (an empty quote means "nothing to quote"). */
export const quoteIsExact = (quote: string, finePrint: string): boolean => quote === '' || finePrint.includes(quote);

/** A code "reject" always wins; otherwise the stricter of the two answers. No AI answer = the code verdict. */
export function finalVerdict(code: FinePrintVerdict, ai: FinePrintVerdict | null | undefined): FinePrintVerdict {
  const rank: Record<FinePrintVerdict, number> = { approve: 0, approve_with_catch: 1, reject: 2 };
  if (!ai) return code;
  return rank[code] >= rank[ai] ? code : ai;
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
export interface CheckOptions { today: string; effort?: EffortSettings }

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
  const faceValueCents = face ? cents(face[1] ?? face[2]) : null;
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
    addCatch('required_membership', 'the fine print says a paid membership or subscription is required (no price given)', firstUnnegated(MEMBERSHIP_NEEDED, text));
  }
  if (firstUnnegated(FEE_MAY_APPLY, text) >= 0) addCatch('fee_unknown', 'a shipping or handling fee may apply, with no amount given', firstUnnegated(FEE_MAY_APPLY, text));

  const trueValueCents = faceValueCents === null ? null : faceValueCents - hiddenCostCents;
  if (trueValueCents !== null && trueValueCents < 0) addCatch('negative_value', `it costs $${(-trueValueCents / 100).toFixed(2)} more than it is worth`, -1);
  // Same rule as offerScreen.offlineProblem: a "free" offer with a fee over the limit isn't free. When the value is
  // stated, the true-value maths above decides instead (e.g. a $45 pillow with $14.95 shipping is still worth $30.05).
  const bigFee = fees.find((x) => x.cents > FEE_LIMIT_DOLLARS * 100);
  if (bigFee && faceValueCents === null && /\bfree\b/i.test(text)) {
    addCatch('fee_over_limit', `it says free but charges a $${(bigFee.cents / 100).toFixed(2)} fee, over the $${FEE_LIMIT_DOLLARS} limit`, bigFee.at);
  }

  const minM = MIN_PURCHASE.exec(text);
  const minPurchaseCents = minM ? cents(minM[1] ?? minM[2] ?? minM[3]) : null;
  if (minPurchaseCents !== null) { quoted.push(minPurchaseCents); addCatch('minimum_purchase', `you must spend at least $${(minPurchaseCents / 100).toFixed(2)}`, minM!.index); }

  // Subscriptions
  const ren = RENEWAL.exec(text);
  const renewalPriceCents = ren ? cents(ren[1] ?? ren[3]) : null;
  if (renewalPriceCents !== null) quoted.push(renewalPriceCents);
  const renewalPeriod = ren ? PERIOD_WORD[(ren[2] ?? ren[4]).toLowerCase()] : null;
  const autoRenewAt = firstUnnegated(AUTO_RENEW, text); // "No auto-renewal" is not a renewal
  const autoRenew = autoRenewAt >= 0;
  if (autoRenew) addCatch('auto_renew', renewalPriceCents !== null ? `it renews automatically at $${(renewalPriceCents / 100).toFixed(2)}/${renewalPeriod}` : 'it renews automatically', autoRenewAt);
  const cancelMethod = /\bcancel\w*\s+online\b/i.test(text) ? 'online' : /\bcancel\w*\s+(?:by\s+(?:phone|calling)|via\s+phone)\b/i.test(text) ? 'phone' : /\bcancel\w*\s+by\s+mail\b/i.test(text) ? 'mail' : null;

  // Dates
  const dl = DEADLINE.exec(text);
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
  const CATCH_FOR: Partial<Record<keyof typeof FLAGS, [string, string]>> = {
    mailIn: ['mail_in_rebate', 'you have to mail something in'],
    needsPhoneCall: ['phone_call', 'you have to make a phone call'],
    needsForms: ['forms', 'you have to fill in a form'],
    accountRequired: ['account_required', 'you have to create an account'],
    appRequired: ['app_required', 'you have to download an app'],
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
  const effortLevel = stepsCount >= 3 || f.mailIn ? 'high' : stepsCount >= 1 || f.inStoreOnly ? 'medium' : 'low';

  const payoutForm = /\bprepaid\s+(?:card|visa|mastercard)\b/i.test(text) ? 'prepaid_card'
    : /\bpoints\b/i.test(text) ? 'points'
    : /\bcheck\b/i.test(text) ? 'check'
    : /%\s*off\b|\$\s?\d[\d,.]*\s+off\b/i.test(text) ? 'instant_discount' : null;

  // Verdict: reject for things that cost more than they save, traps, expired offers, or orders aimed at the AI.
  const REJECT = ['negative_value', 'auto_renew', 'expired', 'prompt_injection', 'fee_unknown', 'fee_over_limit'];
  if (catchTypes.includes('required_membership') && !mem) REJECT.push('required_membership');
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

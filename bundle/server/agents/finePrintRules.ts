/**
 * Plain code rules for an offer's fine print (no AI). They read the dollar figures, dates and "strings attached"
 * straight from the text, compute the true value, and give a verdict: approve, approve_with_catch or reject.
 * A code "reject" always overrides an AI "approve" (see finalVerdict). Test cases: data/sample/fine-print-cases/.
 * Every dollar figure here is read from the text or computed from figures that are; nothing is guessed.
 */
import { createHash } from 'crypto';
import type { FinePrintCheck } from './types';
import type { FinePrintVerdict } from '../../shared/bundle';

/** An offer whose deadline is this many days away or fewer gets an "about to expire" catch. */
export const EXPIRING_SOON_DAYS = 7;

const AMT = '\\$\\s?(\\d[\\d,]*(?:\\.\\d+)?)';
const cents = (s: string): number => Math.round(Number(s.replace(/,/g, '')) * 100);
const DAY_MS = 86_400_000;

const FEE_WORD = '(?:shipping|handling|postage)';
const FEE_BEFORE = new RegExp(`${AMT}\\s+${FEE_WORD}\\b`, 'gi');
const FEE_AFTER = new RegExp(`\\b${FEE_WORD}(?:\\s+(?:and|&)\\s+${FEE_WORD})?(?:\\s+(?:fees?|charges?|costs?))?(?:\\s*:|\\s+(?:of|is|are|costs?|will be))?\\s*${AMT}`, 'gi');
const THRESHOLD_WORDS = /(over|above|than|minimum|least|exceed\w*|spend\w*|orders?\s+of)\s*$/i;
const FEE_MAY_APPLY = /\b(?:shipping|handling|postage)(?:\s+(?:and|&)\s+(?:shipping|handling|postage))?\s+(?:fees?|charges?|costs?)\s+(?:may|will|can)\s+apply\b/i;
const MEMBERSHIP_NEEDED = /\b(?:requires?|required)\b[^.;]{0,40}\b(?:prime|membership|member|subscription)\b|\b(?:prime|membership|member|subscription)\s+(?:is\s+)?required\b/i;

const FACE_VALUE = new RegExp(`\\(${AMT}\\s+value\\)|${AMT}\\s+(?:back|off)\\b`, 'i');
const MEMBERSHIP_COST = new RegExp(`(\\d+)[- ]month\\s+(?:membership|subscription|plan)[^.;]*?${AMT}\\s*/\\s*(?:mo|month)\\b`, 'i');
const RENEWAL = new RegExp(`\\b(?:renews?|renewal|auto-?renews?)\\b[^.;]*?${AMT}\\s*/\\s*(week|month|year)`, 'i');
const AUTO_RENEW = /\b(?:renews?|auto-?renew\w*|recurring (?:charge|billing))\b/i;
const MIN_PURCHASE = new RegExp(`(?:orders?|purchases?)\\s+of\\s+${AMT}\\s+(?:or\\s+more|\\+)|minimum\\s+(?:purchase|order|spend)\\s+(?:of\\s+)?${AMT}|spend\\s+${AMT}\\s+or\\s+more`, 'i');
const DEADLINE = /\b(?:through|thru|ends?|until|expires?(?:\s+on)?|by|valid\s+to)\s+(\d{4}-\d{2}-\d{2})\b/i;
const CLAIM_WINDOW = /\bwithin\s+(\d+)\s+days\b/i;
const WAIT_RANGE = /\b(\d+)\s*[–-]\s*(\d+)\s*(day|week)s?\b/i;
const REGIONS = /\b[Nn]ot\s+(?:[Aa]vailable|valid)\s+in\s+([A-Z]{2}(?:\s*(?:,|or|and|,\s*or|,\s*and)\s*[A-Z]{2})*)/;
const INJECTION = /\bignore\s+(?:your|all|any|previous|the|these)\s+(?:rules|instructions)|\bnote\s+to\s+(?:the\s+)?(?:ai|assistant|model|reviewers?)\b|\b(?:ai|assistant|model)s?\b[^.]{0,40}\bapprove\s+this\b/i;

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

/** Shipping/handling amounts written in the text; thresholds like "free shipping on orders over $50" don't count. */
function shippingFees(text: string): { cents: number; at: number }[] {
  const out = new Map<number, number>();
  for (const re of [FEE_BEFORE, FEE_AFTER]) {
    for (const m of text.matchAll(re)) {
      const amountAt = (m.index ?? 0) + m[0].indexOf('$');
      if (THRESHOLD_WORDS.test(text.slice(Math.max(0, amountAt - 20), amountAt))) continue;
      out.set(amountAt, cents(m[1]));
    }
  }
  return [...out].map(([at, c]) => ({ at, cents: c }));
}

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

export interface CheckOptions { today: string; familyState?: string }

/** Read one offer's fine print with code rules only. `familyState` never changes the verdict (no family data in a check). */
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
  for (const f of shippingFees(text)) {
    hiddenCostCents += f.cents; quoted.push(f.cents);
    addCatch('shipping_fee', `the fine print states a $${(f.cents / 100).toFixed(2)} shipping or handling fee`, f.at);
  }
  const mem = MEMBERSHIP_COST.exec(text);
  if (mem) {
    const months = Number(mem[1]); const monthly = cents(mem[2]);
    quoted.push(monthly);
    hiddenCostCents += months * monthly;
    addCatch('required_membership', `a required ${months}-month membership at $${(monthly / 100).toFixed(2)}/month adds $${((months * monthly) / 100).toFixed(2)}`, mem.index);
  } else if (MEMBERSHIP_NEEDED.test(text)) {
    addCatch('required_membership', 'the fine print says a paid membership or subscription is required (no price given)', pos(MEMBERSHIP_NEEDED));
  }
  if (FEE_MAY_APPLY.test(text)) addCatch('fee_unknown', 'a shipping or handling fee may apply, with no amount given', pos(FEE_MAY_APPLY));

  const trueValueCents = faceValueCents === null ? null : faceValueCents - hiddenCostCents;
  if (trueValueCents !== null && trueValueCents < 0) addCatch('negative_value', `it costs $${(-trueValueCents / 100).toFixed(2)} more than it is worth`, -1);

  const minM = MIN_PURCHASE.exec(text);
  const minPurchaseCents = minM ? cents(minM[1] ?? minM[2] ?? minM[3]) : null;
  if (minPurchaseCents !== null) { quoted.push(minPurchaseCents); addCatch('minimum_purchase', `you must spend at least $${(minPurchaseCents / 100).toFixed(2)}`, minM!.index); }

  // Subscriptions
  const ren = RENEWAL.exec(text);
  const renewalPriceCents = ren ? cents(ren[1]) : null;
  if (renewalPriceCents !== null) quoted.push(renewalPriceCents);
  const renewalPeriod = ren ? (ren[2].toLowerCase() as 'week' | 'month' | 'year') : null;
  const autoRenew = AUTO_RENEW.test(text);
  if (autoRenew) addCatch('auto_renew', renewalPriceCents !== null ? `it renews automatically at $${(renewalPriceCents / 100).toFixed(2)}/${renewalPeriod}` : 'it renews automatically', pos(AUTO_RENEW));
  const cancelMethod = /\bcancel\w*\s+online\b/i.test(text) ? 'online' : /\bcancel\w*\s+(?:by\s+(?:phone|calling)|via\s+phone)\b/i.test(text) ? 'phone' : /\bcancel\w*\s+by\s+mail\b/i.test(text) ? 'mail' : null;

  // Dates
  const dl = DEADLINE.exec(text);
  const deadlineDate = dl ? dl[1] : null;
  const daysLeft = deadlineDate ? Math.round((Date.parse(`${deadlineDate}T00:00:00Z`) - Date.parse(`${opts.today}T00:00:00Z`)) / DAY_MS) : null;
  const expired = daysLeft !== null && daysLeft < 0;
  if (expired) addCatch('expired', `the offer ended on ${deadlineDate}`, dl!.index);
  else if (daysLeft !== null && daysLeft <= EXPIRING_SOON_DAYS) addCatch('expiring_soon', `only ${daysLeft} days left (ends ${deadlineDate})`, dl!.index);
  const cw = CLAIM_WINDOW.exec(text);
  const claimWindowDays = cw ? Number(cw[1]) : null;
  const wr = WAIT_RANGE.exec(text);
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
  const effort = { min: 2, max: 5 };
  effort.min += stepsCount * 5; effort.max += stepsCount * 10;
  if (f.mailIn) { effort.min += 10; effort.max += 20; }
  if (f.needsPhoneCall) { effort.min += 10; effort.max += 30; }
  if (f.inStoreOnly) { effort.min += 15; effort.max += 30; }
  const effortLevel = stepsCount >= 3 || f.mailIn ? 'high' : stepsCount >= 1 || f.inStoreOnly ? 'medium' : 'low';

  const payoutForm = /\bprepaid\s+(?:card|visa|mastercard)\b/i.test(text) ? 'prepaid_card'
    : /\bpoints\b/i.test(text) ? 'points'
    : /\bcheck\b/i.test(text) ? 'check'
    : /%\s*off\b|\$\s?\d[\d,.]*\s+off\b/i.test(text) ? 'instant_discount' : null;

  // Verdict: reject for things that cost more than they save, traps, expired offers, or orders aimed at the AI.
  const REJECT = ['negative_value', 'auto_renew', 'expired', 'prompt_injection', 'fee_unknown'];
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

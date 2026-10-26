// Version B (bottom tabs) logic: which card goes on which tab, the totals, the "Do these first" list, the "I got this" ticks.
// Pure functions, no screens. Every number is added up from the run's own cards and receipt, never typed in here.

import type { BundleResult, FeedCard, ValueScore } from '@shared/bundle';
import { URGENT_DAYS, daysUntil, deadlineText, fmtUsd, isCheckWithJob, type FamilyView, type SavedRun } from './bundle';
import { COVERED_STATES, UNCOVERED_STATE_NOTE } from './onboarding';
import { minutesOf } from '@shared/cardMeta';

export type TabId = 'home' | 'taxes' | 'savings' | 'insurance' | 'deals' | 'account';
export const TABS: { id: TabId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'taxes', label: 'Taxes' },
  { id: 'savings', label: 'Savings' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'deals', label: 'Deals' },
];
/** The five money tabs, then Account (the family's answers, memory and privacy). The bottom bar shows only the five; Account opens from the family chip in the header. */
export const ALL_TABS: { id: TabId; label: string }[] = [...TABS, { id: 'account', label: 'Account' }];
export const isTabId = (x: unknown): x is TabId => ALL_TABS.some((t) => t.id === x);

export type Stage = 'expecting' | 'born';
/** Expecting = a due date and no birth date. Anything else (including no information) is treated as "baby's here". */
export const stageOf = (f?: FamilyView): Stage => (f && f.dueDate && !f.birthDate ? 'expecting' : 'born');

/** Which tab a card lives on. Coming-soon tiles belong to no tab (they show in their own small section). */
export function tabForCard(c: FeedCard): TabId | null {
  if (c.kind === 'coming_soon') return null;
  if (c.kind === 'discount') return 'deals';
  if (c.kind === 'clawback' || c.kind === 'recall') return 'savings';
  if (/insurance|_pfml?$|_pfl$/.test(c.id)) return 'insurance';
  if (/tax_credit|dcfsa/.test(c.id)) return 'taxes';
  return 'savings'; // e.g. the baby's starter account
}

// ---------- what counts toward the big number (mirrors the server's receipt rule) ----------

const isChecked = (c: FeedCard) => c.verdict === 'verified' || c.verdict === 'likely';
const isMoneyBack = (c: FeedCard) => c.kind === 'clawback' && /^clawback-(fsa|price)-/.test(c.id) && isChecked(c);
const isCountedBenefit = (c: FeedCard) => c.kind === 'benefit' && isChecked(c) && !/^benefit-dcfsa/.test(c.id);

/** The value of a free gift: what is left after the strings attached when the fine print says, otherwise the offer's own figure. */
export const giftValue = (c: FeedCard): number => c.valueScore?.trueValueCents ?? c.amountCents ?? 0;
const isGift = (c: FeedCard) => c.kind === 'discount' && c.verdict !== 'info' && c.verdict !== 'blocked';

export interface HomeTotals {
  /** Savings and tax credits: the run's own receipt (money back + benefits you likely qualify for). */
  totalCents: number;
  /** Free gifts that passed the Fine Print Court. */
  giftsCents: number;
  /** The cards that add up to totalCents, for "How we got this number". */
  parts: FeedCard[];
  /** Benefit cards shown but deliberately left out of the total (check-with-your-job, not yet verified). */
  notCounted: FeedCard[];
}

export function homeTotals(result: BundleResult): HomeTotals {
  const parts = result.cards.filter((c) => (isMoneyBack(c) || isCountedBenefit(c)) && (c.amountCents ?? 0) > 0);
  return {
    totalCents: result.receipt.moneyBackCents + result.receipt.likelyBenefitsCents,
    giftsCents: result.cards.filter(isGift).reduce((a, c) => a + giftValue(c), 0),
    parts,
    notCounted: result.cards.filter((c) => c.kind === 'benefit' && !isCountedBenefit(c)),
  };
}

export interface CategorySummary { cents: number; count: number }
/** Money and number of items on one tab (gifts use their true value on the Deals tab). */
export function categorySummary(cards: FeedCard[], tab: TabId): CategorySummary {
  const mine = cards.filter((c) => tabForCard(c) === tab);
  const cents = mine.reduce((a, c) => a + (isGift(c) ? giftValue(c) : isMoneyBack(c) || isCountedBenefit(c) ? c.amountCents ?? 0 : 0), 0);
  const count = mine.filter((c) => (c.kind === 'discount' ? isGift(c) : c.kind === 'benefit' || isMoneyBack(c))).length;
  return { cents, count };
}

// ---------- Do these first ----------

export interface Urgent { card: FeedCard; label: string; tab: TabId }

const SHORT_WINDOW_DAYS = 60;

/**
 * Deadlines that need attention now, soonest first. For a baby who is here that is anything due within a month.
 * For an expecting family a deadline cannot start yet, so it says "Starts at birth" (only the short windows that
 * count from the birth, never the year-long ones).
 */
export function urgentDeadlines(cards: FeedCard[], today: string, stage: Stage, family?: FamilyView): Urgent[] {
  const withDeadline = cards.filter((c) => c.kind === 'benefit' && isChecked(c) && c.deadline);
  if (stage === 'expecting') {
    const due = family?.dueDate;
    return withDeadline
      .filter((c) => !due || daysBetween(due, c.deadline as string) <= SHORT_WINDOW_DAYS)
      .sort((a, b) => (a.deadline as string).localeCompare(b.deadline as string))
      .map((card) => ({ card, tab: tabForCard(card) ?? 'home', label: due ? `Starts at birth · ${daysBetween(due, card.deadline as string)} days to act` : 'Starts at birth' }));
  }
  return withDeadline
    .filter((c) => { const d = daysUntil(c.deadline as string, today); return d >= 0 && d <= URGENT_DAYS; })
    .sort((a, b) => (a.deadline as string).localeCompare(b.deadline as string))
    .map((card) => ({ card, tab: tabForCard(card) ?? 'home', label: deadlineText(card.deadline as string, today) }));
}

const daysBetween = (fromIso: string, toIso: string) => Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);

/** How many urgent deadlines the Insurance tab badge shows (a baby who is here only). */
export const badgeCount = (cards: FeedCard[], today: string, stage: Stage, family?: FamilyView): number =>
  stage === 'expecting' ? 0 : urgentDeadlines(cards, today, stage, family).filter((u) => u.tab === 'insurance').length;

// ---------- uncovered state ----------

/** The "coming soon" sentence for a family whose state we do not cover yet, or null. Reads, in order: the run's `stateNote`, a `coming-soon-state` card, the family's state. */
export function comingSoonNote(run: Pick<SavedRun, 'result' | 'family'>): string | null {
  const note = run.result.stateNote;
  if (note && note.trim()) return note.trim();
  const cardNote = run.result.cards.find((c) => c.kind === 'coming_soon' && c.id.startsWith('coming-soon-state'));
  if (cardNote) return cardNote.body.replace(/^coming soon:\s*/i, '').trim() || UNCOVERED_STATE_NOTE;
  const state = run.family?.state;
  if (state && /^[A-Z]{2}$/.test(state) && !(COVERED_STATES as readonly string[]).includes(state)) return UNCOVERED_STATE_NOTE;
  return null;
}

// ---------- "I got this" ticks (this browser only) ----------

/** Money and deal cards a parent can tick off. Check-with-your-job items and safety checks have no tick. */
export function claimableCards(cards: FeedCard[]): FeedCard[] {
  return cards.filter((c) => (isMoneyBack(c) || isCountedBenefit(c)) && !isCheckWithJob(c) ? true : isGift(c));
}

const claimKey = (familyId: string) => `bundle:claimed:${familyId}`;

export function loadClaims(familyId: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(claimKey(familyId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {};
  } catch { return {}; }
}

export function saveClaims(familyId: string, claims: Record<string, boolean>): void {
  try { localStorage.setItem(claimKey(familyId), JSON.stringify(claims)); } catch { /* storage blocked: ticks last until the page closes */ }
}

const dismissKey = (familyId: string) => `bundle:dismissed:${familyId}`;

/** The cards this family marked "Not relevant" (this browser; the server keeps a copy in the claims table). */
export function loadDismissed(familyId: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(dismissKey(familyId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {};
  } catch { return {}; }
}

export function saveDismissed(familyId: string, dismissed: Record<string, boolean>): void {
  try { localStorage.setItem(dismissKey(familyId), JSON.stringify(dismissed)); } catch { /* storage blocked: lasts until the page closes */ }
}

/**
 * The three money numbers on Home, all worked out from the run's counted cards:
 *   found   = the headline: everything counted, minus what the parent said does not apply to them;
 *   claimed = the counted money on cards marked "I got this";
 *   still   = found minus claimed.
 * "Not relevant" comes off found and still and never goes into claimed.
 */
export interface MoneyNumbers { found: number; claimed: number; still: number; dismissed: number }
export function moneyNumbers(result: BundleResult, claims: Record<string, boolean>, dismissed: Record<string, boolean>): MoneyNumbers {
  const t = homeTotals(result);
  const sum = (f: (c: FeedCard) => boolean) => t.parts.filter(f).reduce((a, c) => a + (c.amountCents ?? 0), 0);
  const gone = sum((c) => !!dismissed[c.id]);
  const claimed = sum((c) => !dismissed[c.id] && !!claims[c.id]);
  const found = t.totalCents - gone;
  return { found, claimed, still: found - claimed, dismissed: gone };
}

/** Where a card is right now: still to do, in the Claimed drawer, or in the Dismissed drawer. */
export type CardState = 'open' | 'claimed' | 'dismissed';
export const cardState = (id: string, claims: Record<string, boolean>, dismissed: Record<string, boolean>): CardState =>
  dismissed[id] ? 'dismissed' : claims[id] ? 'claimed' : 'open';

/** Task cards for the Home "Do these next" list: things a parent can act on that are not free gifts (gifts live on Deals). */
export const taskCards = (cards: FeedCard[]): FeedCard[] => claimableCards(cards).filter((c) => c.kind !== 'discount');
/** "Quick wins": under 5 minutes. A card with no estimate is never called a quick win. */
export const isQuickWin = (c: FeedCard): boolean => { const m = minutesOf(c); return m !== undefined && m < 5; };

/** "$ claimed": the money on ticked cards only. */
export function claimedCents(cards: FeedCard[], claims: Record<string, boolean>): number {
  return claimableCards(cards).filter((c) => claims[c.id]).reduce((a, c) => a + (isGift(c) ? giftValue(c) : c.amountCents ?? 0), 0);
}

// ---------- share ----------

/** The pre-written share message. A link only: never the list, the baby's date, the ZIP or any amount. */
export const shareMessage = (link: string): string => `Bundle found money and deadlines for our baby that I had no idea about. Takes 30 seconds: ${link}`;

// ---------- Value Score in plain words ----------

const CATCH_WORDS: Record<string, string> = {
  shipping_fee: 'shipping fee', fee_unknown: 'a fee may apply', required_membership: 'paid membership required', negative_value: 'costs more than it is worth',
  fee_over_limit: 'fee over our limit', minimum_purchase: 'minimum purchase', auto_renew: 'renews automatically', expired: 'offer ended',
  expiring_soon: 'ends soon', regions_excluded: 'not in every region',
};
export const catchWord = (t: string): string => CATCH_WORDS[t] ?? t.replace(/_/g, ' ');

/** The saved offline court line reads as a contradiction ("no flagged terms" yet "couldn't fully check"); say it as one idea. */
export function plainCardBody(body: string): string {
  return body.replace(/No flagged terms found\.\s*We couldn['’]t fully check this offer['’]s fine print\./, "We couldn’t read this offer’s fine print in full, so we haven’t confirmed it is free of catches. Read the terms before you sign up.");
}

/** True when the card body says the fine print could not be read in full (the saved offline court line). */
export const finePrintUnread = (body: string): boolean => /couldn['’]t (fully check|read) this offer['’]s fine print/.test(body);

/** The "How we checked" line for a normal card; says only what was actually checked. */
export function howWeChecked(body: string): string {
  return finePrintUnread(body)
    ? 'We checked this offer against its official source page. We couldn’t read its fine print in full, so read the terms before you sign up.'
    : 'We checked this against its official source before showing it to you.';
}

/** The wait part of the effort line, in a natural phrase ("right away" alone read oddly after a minutes count). */
export function waitPhrase(label: string): string {
  if (label === 'right away') return 'no payout wait stated';
  if (label === 'instant') return 'paid instantly';
  if (label === 'wait unknown') return 'payout wait unknown';
  if (label.startsWith('money in')) return label.replace(/^money in/, 'money arrives in');
  return label;
}

/** Plain lines for a deal's Value Score: true value, time (effort and wait), catches, and "probably not worth your time". */
export function valueScoreLines(v: ValueScore): string[] {
  const out: string[] = [];
  if (v.trueValueCents !== null) out.push(`True value ${fmtUsd(v.trueValueCents)}`);
  const { min, max } = v.effortMinutesEstimate;
  out.push(`About ${min === max ? min : `${min}–${max}`} minutes of effort, ${waitPhrase(v.timeLabel)}`);
  if (v.catchTypes.filter((t) => t !== 'prompt_injection').length) out.push(`Catch: ${v.catchTypes.filter((t) => t !== 'prompt_injection').map(catchWord).join(', ')}`);
  if (v.worthYourTime === false) out.push('Probably not worth your time');
  return out;
}

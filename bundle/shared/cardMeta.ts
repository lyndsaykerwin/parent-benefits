/**
 * Two plain facts about every card, worked out in code (never guessed on the screen):
 *   category: which Home bucket the card belongs in (money back now, at tax time, paid leave, a free gift, or just information);
 *   minutes:  about how long it takes the parent to act on it, for the "Quick wins" filter.
 * The server stamps both on every card. The browser calls the same functions for older saved runs that do not have them.
 */
import type { CardCategory, FeedCard } from './bundle';

type CardLike = Pick<FeedCard, 'id' | 'kind' | 'verdict' | 'amountCents'> & Partial<Pick<FeedCard, 'valueScore'>>;

const isChecked = (c: Pick<FeedCard, 'verdict'>) => c.verdict === 'verified' || c.verdict === 'likely';

export function cardCategory(c: CardLike): CardCategory {
  if (c.kind === 'discount') return c.verdict === 'info' || c.verdict === 'blocked' ? 'info' : 'gift';
  if (c.kind === 'coming_soon' || c.kind === 'recall') return 'info';
  if (c.kind === 'clawback') return /^clawback-(fsa|price)-/.test(c.id) && isChecked(c) ? 'money_back' : 'info';
  // Benefits: paid leave has its own bucket; check-with-your-job and insurance cards carry no money, so they are information.
  if (/^benefit-(.+_pfml?|.+_pfl)$/.test(c.id)) return 'leave';
  if (/^benefit-dcfsa/.test(c.id) || /insurance/.test(c.id)) return 'info';
  return isChecked(c) && (c.amountCents ?? 0) > 0 ? 'tax_time' : 'info';
}

/**
 * Our estimate, in minutes, of the one thing the parent does to act on a card. These are estimates, not measurements:
 * they are the same for every family and the screen says "about".
 * Quick wins (under 5 minutes) are the ones that are really just a line on a tax return.
 */
const MINUTES_BY_ID: [RegExp, number][] = [
  [/^benefit-insurance_add_baby$/, 15],
  [/^benefit-federal_child_tax_credit$/, 3],
  [/^benefit-ma_child_tax_credit$/, 4],
  [/^benefit-trump_account$/, 10],
  [/^benefit-.+_pfml?$|^benefit-.+_pfl$/, 20],
  [/^clawback-fsa-/, 5],
  [/^clawback-price-/, 10],
];

export function cardMinutes(c: CardLike): number | undefined {
  if (c.kind === 'discount') return c.valueScore ? c.valueScore.effortMinutesEstimate.max : undefined;
  if (c.kind !== 'benefit' && c.kind !== 'clawback') return undefined;
  return MINUTES_BY_ID.find(([re]) => re.test(c.id))?.[1];
}

/** The card's category and minutes: the server's stamp when it has one, else worked out here (older saved runs). */
export const categoryOf = (c: FeedCard): CardCategory => c.category ?? cardCategory(c);
export const minutesOf = (c: FeedCard): number | undefined => c.minutes ?? cardMinutes(c);

/**
 * Which Home bucket a card sits in. Like categoryOf, plus one more box: the baby's savings account (the Trump Account's
 * $1,000 deposit is money into the baby's own account, not a tax credit). Worked out from the card id, so older saved
 * runs whose stamp still says "tax_time" land in the right box too.
 */
export type HomeBucket = CardCategory | 'baby_savings';
export const isBabySavings = (c: Pick<FeedCard, 'id'>): boolean => c.id === 'benefit-trump_account';
export const bucketOf = (c: FeedCard): HomeBucket => (isBabySavings(c) && isChecked(c) && (c.amountCents ?? 0) > 0 ? 'baby_savings' : categoryOf(c));

/** Paid leave: the one number we have is Massachusetts' 2026 weekly maximum ($1,230.39, mass.gov). Other states get no figure. */
export const MA_LEAVE = { headline: 'You can get up to $1,230 a week for 12 weeks', sub: 'Depends on your pay. Paid weekly, during leave (MA paid family leave).' } as const;
export const OTHER_LEAVE_SUB = 'Depends on your state and your pay. Paid weekly, during leave.';

/**
 * Makes the "Add your baby to health insurance" card follow the parent's Q5 answer (30 days for a job plan, 60 for the
 * marketplace, a year of automatic cover for Medicaid, 90 for TRICARE). The rules live in shared/eligibility.ts.
 * The server's card is built from one federal rule, so this rewrites its deadline and sentence on the way to the screen.
 */
import type { FeedCard } from '@shared/bundle';
import { insuranceDeadline, insuranceDeadlineDate } from '@shared/eligibility';
import type { FamilyView } from './bundle';

export const isAddBabyCard = (c: FeedCard): boolean => c.kind === 'benefit' && /^benefit-insurance_add_baby$/.test(c.id);

/** The cards with the insurance card's deadline and sentence matched to the insurance answer. No answer leaves the card as the server made it. */
export function applyInsuranceAnswer(cards: FeedCard[], family?: FamilyView): FeedCard[] {
  if (!family?.insurance) return cards;
  const info = insuranceDeadline(family.insurance, family.state);
  const base = family.birthDate ?? family.dueDate;
  return cards.map((c) => {
    if (!isAddBabyCard(c)) return c;
    return { ...c, deadline: insuranceDeadlineDate(family.insurance, base, family.state), body: info.detail };
  });
}

/** The tax year a new baby's credits go on: the baby's birth (or due) year, else the current year. */
export function taxYearFor(family: FamilyView | undefined, today: string): number {
  const iso = family?.birthDate ?? family?.dueDate ?? today;
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) && y > 2000 ? y : new Date().getFullYear();
}

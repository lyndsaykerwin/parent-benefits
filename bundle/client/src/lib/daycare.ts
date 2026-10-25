/**
 * Adds the "Childcare tax credit" card for families where everyone who earns is self-employed (the daycare rule in
 * shared/eligibility.ts says `childcare_credit`). The other daycare answers need no card of their own: a paycheck gets the
 * server's "Dependent Care FSA: check with your job" card, and a parent not working gets none.
 * The card carries no dollar amount in the totals: "up to $1,500 for one child" is the credit's own ceiling, not a promise.
 */
import type { FeedCard } from '@shared/bundle';
import { daycareRoute } from '@shared/eligibility';
import type { FamilyView } from './bundle';

export const CHILDCARE_CREDIT_ID = 'benefit-childcare_tax_credit';

export function applyDaycareAnswer(cards: FeedCard[], family?: FamilyView): FeedCard[] {
  if (daycareRoute({ household: family?.household, parent1Work: family?.parent1Work, parent2Work: family?.parent2Work }) !== 'childcare_credit') return cards;
  if (cards.some((c) => c.id === CHILDCARE_CREDIT_ID)) return cards;
  const card: FeedCard = {
    id: CHILDCARE_CREDIT_ID, kind: 'benefit', title: 'Childcare tax credit',
    body: 'You are self-employed, so there is no work childcare account to use. The childcare tax credit can still give back up to $1,500 of daycare costs for one child. Ask your tax preparer to include it.',
    amountCents: null, deadline: null, verdict: 'info', category: 'info', traceId: 'client',
    sources: [{ label: 'IRS: Child and Dependent Care Credit', url: 'https://www.irs.gov/taxtopics/tc602' }],
  };
  // Right after the Dependent Care FSA slot on the Taxes tab: the tax-credit cards first, then this one.
  const at = cards.findIndex((c) => c.id === 'benefit-dcfsa_life_event');
  return at === -1 ? [...cards, card] : [...cards.slice(0, at), card, ...cards.slice(at + 1)];
}

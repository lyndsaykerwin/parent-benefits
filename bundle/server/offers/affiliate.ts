/**
 * Affiliate links: READY BUT OFF (plans/v2-build-plan.md, section 3 and Lane D). We have applied to the affiliate programs; nothing is
 * approved yet, so no link is ever attached today. The rules are fixed here so switching it on later cannot bend them:
 *   1. An offer is graded by the Fine Print Court FIRST. A link can be attached only to a card that already carries its grade.
 *   2. A blocked offer never gets a link.
 *   3. Nothing sorts by commission: this module has no commission number at all, and the Deals list orders by true value.
 *   4. A card with a link shows the label "Paid link" (the slot exists on the card; it stays empty while this is off).
 */
import type { FeedCard } from '../../shared/bundle';

/** Flip to true only after an affiliate program approves us. */
export const AFFILIATE_LINKS_ON = false;

export function attachPaidLink(card: FeedCard, url: string, on: boolean = AFFILIATE_LINKS_ON): FeedCard {
  if (!on) return card;
  if (!card.offerFacts) throw new Error('grade the offer before attaching a link');
  if (card.verdict === 'blocked' || card.offerFacts.court === 'reject') throw new Error('a blocked offer never gets a link');
  if (!/^https:\/\/\S+$/i.test(url)) throw new Error('a paid link must be an https address');
  return { ...card, paidLink: { label: 'Paid link', url } };
}

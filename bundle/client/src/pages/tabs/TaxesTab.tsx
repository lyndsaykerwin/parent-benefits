import { categoryOf } from '@shared/cardMeta';
import { fmtUsdShort } from '@/lib/bundle';
import { categorySummary, tabForCard } from '@/lib/tabs';
import { CardStack, CategoryHeader, ClaimDrawers, ComingSoonState, type TabProps } from './shared';
import { FilingBooster, TaxExtras, useFiling } from './TaxBooster';

/** Taxes: the filing-status booster, federal and state tax credits, the Dependent Care FSA (or childcare credit), the MA 529 line and the paycheck-form tip. */
export default function TaxesTab(props: TabProps) {
  const filing = useFiling(props.run.familyId);
  const mine = props.cards.filter((c) => tabForCard(c) === 'taxes');
  const { cents } = categorySummary(props.cards.filter((c) => !props.dismissed[c.id]), 'taxes');
  // The credits a tax return carries (the Trump Account is a deposit into the baby's account, not a credit).
  const credits = props.cards.filter((c) => !props.dismissed[c.id] && categoryOf(c) === 'tax_time' && c.id !== 'benefit-trump_account' && (c.amountCents ?? 0) > 0);
  return (
    <>
      <CategoryHeader
        eyebrow="Tax benefits" dot="#6B4EE6"
        title={cents > 0 ? `${fmtUsdShort(cents)} off your taxes` : 'Tax benefits'}
        sub={props.stage === 'expecting' ? 'These start once your baby is born. You claim them when you file your taxes.' : 'You claim these when you file your taxes. Each one links to its official source.'}
      />
      <FilingBooster props={props} credits={credits} status={filing} />
      <ComingSoonState note={props.stateNote} />
      <CardStack cards={mine} props={props} />
      <ClaimDrawers cards={mine} props={props} />
      <TaxExtras props={props} filing={filing.filing} />
    </>
  );
}

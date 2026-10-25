import { fmtUsdShort } from '@/lib/bundle';
import { categorySummary, tabForCard } from '@/lib/tabs';
import { CardStack, CategoryHeader, ComingSoonState, type TabProps } from './shared';

/** Taxes: federal and state tax credits, plus the Dependent Care FSA as a "Check with your job" card. */
export default function TaxesTab(props: TabProps) {
  const mine = props.cards.filter((c) => tabForCard(c) === 'taxes');
  const { cents } = categorySummary(props.cards, 'taxes');
  return (
    <>
      <CategoryHeader
        eyebrow="Tax benefits" dot="#6B4EE6"
        title={cents > 0 ? `${fmtUsdShort(cents)} off your taxes` : 'Tax benefits'}
        sub={props.stage === 'expecting' ? 'These start once your baby is born. You claim them when you file your taxes.' : 'You claim these when you file your taxes. Each one links to its official source.'}
      />
      <ComingSoonState note={props.stateNote} />
      <CardStack cards={mine} props={props} />
    </>
  );
}

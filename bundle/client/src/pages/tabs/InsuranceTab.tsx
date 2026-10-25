import { daysUntil } from '@/lib/bundle';
import { tabForCard, urgentDeadlines } from '@/lib/tabs';
import { CardStack, CategoryHeader, type TabProps } from './shared';

/** Insurance and leave: the add-your-baby deadline and paid family leave. */
export default function InsuranceTab(props: TabProps) {
  const mine = props.cards.filter((c) => tabForCard(c) === 'insurance');
  const urgent = urgentDeadlines(props.cards, props.run.today ?? '', props.stage, props.run.family).filter((u) => u.tab === 'insurance');
  const labels = Object.fromEntries(urgent.map((u) => [u.card.id, u.label]));
  const expecting = props.stage === 'expecting';
  const farthest = Math.max(0, ...urgent.map((u) => daysUntil(u.card.deadline as string, props.run.today)));
  const title = expecting
    ? 'Deadlines that start at birth'
    : urgent.length > 0 ? `${urgent.length} ${urgent.length === 1 ? 'deadline' : 'deadlines'} in ${farthest} ${farthest === 1 ? 'day' : 'days'}` : 'Insurance and leave';
  const sub = expecting
    ? 'These count from your baby’s birth date. We will show the countdown once baby arrives.'
    : 'These count from your baby’s birth date. Miss them and you may wait a year.';
  return (
    <>
      <CategoryHeader eyebrow="Insurance & leave" dot="#E4572E" title={title} sub={sub} />
      <CardStack cards={mine} props={props} deadlineLabels={expecting ? labels : undefined} />
    </>
  );
}

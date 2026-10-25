import { fmtUsdShort } from '@/lib/bundle';
import FeedCardView from '@/components/FeedCardView';
import { categorySummary, tabForCard } from '@/lib/tabs';
import { CardStack, CategoryHeader, SectionTitle, type TabProps } from './shared';

const hasMoneyBack = (cards: TabProps['cards']) => cards.some((c) => c.kind === 'clawback' && /^clawback-(fsa|price)-/.test(c.id));

/** One "Needs purchases" tile. Static words only: no amount, because nothing has been checked yet. */
function NeedsPurchases({ title, sub }: { title: string; sub: string }) {
  return (
    <article className="bundle-card p-4" aria-label={title} data-testid="needs-purchases">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow flex items-center gap-1.5 text-kind-clawback"><span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-kind-clawback" />Money back</p>
        <span className="rounded-full bg-[#F1ECE4] px-2 py-0.5 text-[12px] font-bold text-ink-2">Needs purchases</span>
      </div>
      <h3 className="mt-2 text-[17px] font-extrabold leading-snug tracking-[-0.01em]">{title}</h3>
      <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{sub}</p>
    </article>
  );
}

/** Savings: the baby's starter account, money back on purchases, and the recall check. */
export default function SavingsTab(props: TabProps) {
  const mine = props.cards.filter((c) => tabForCard(c) === 'savings');
  const soon = [...props.cards.filter((c) => c.kind === 'coming_soon' && !c.id.startsWith('coming-soon-state'))]
    .filter((c, i, all) => all.findIndex((x) => x.id === c.id) === i);
  const { cents } = categorySummary(props.cards, 'savings');
  const needs = !hasMoneyBack(props.cards);
  return (
    <>
      <CategoryHeader
        eyebrow="Savings" dot="#1E8A5A"
        title={cents > 0 ? `${fmtUsdShort(cents)} in savings` : 'Savings'}
        sub="Government deposits for your baby, plus money back on baby gear you have already bought."
      />
      <CardStack cards={mine} props={props} />
      {needs && (
        <div className="mt-3 space-y-3">
          <NeedsPurchases title="Pay yourself back from an FSA or HSA" sub="Thermometers, pumps and more can come out of a pre-tax health account." />
          <NeedsPurchases title="Price dropped after you bought" sub="Many stores refund the difference if you ask in time." />
          <p className="rounded-2xl bg-coral-tint px-4 py-3 text-[15px] font-semibold text-coral-deep" data-testid="purchases-prompt">
            Find money in what you have already bought: tap the + at the top and take a photo of an item or a receipt.
          </p>
        </div>
      )}
      <SectionTitle>Coming soon</SectionTitle>
      <div className="mt-2 grid gap-2">
        {soon.map((c) => <FeedCardView key={c.id} card={c} today={props.run.today} />)}
      </div>
    </>
  );
}

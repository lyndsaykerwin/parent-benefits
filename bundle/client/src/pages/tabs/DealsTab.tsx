import { Link } from 'wouter';
import { MemorySection } from '@/components/HowWeCheckedSections';
import { UNCHECKED_DEALS_SECTION, fmtUsdShort } from '@/lib/bundle';
import { blockedReason } from '@/lib/howWeChecked';
import { categorySummary } from '@/lib/tabs';
import { CardStack, CategoryHeader, ClaimDrawers, SectionTitle, type TabProps } from './shared';

/** Deals: offers that passed the Fine Print Court (with their Value Score), offers not yet checked, and the ones we blocked. */
export default function DealsTab(props: TabProps) {
  const deals = props.cards.filter((c) => c.kind === 'discount');
  const checked = deals.filter((c) => c.verdict !== 'info' && c.verdict !== 'blocked');
  const unchecked = deals.filter((c) => c.verdict === 'info');
  const blocked = props.run.result.blocked ?? [];
  const { cents } = categorySummary(props.cards.filter((c) => !props.dismissed[c.id]), 'deals');
  return (
    <>
      <CategoryHeader
        eyebrow="Discounts & offers" dot="#C9352B"
        title={cents > 0 ? `${fmtUsdShort(cents)} in free gifts` : 'Deals checked for you'}
        sub="Every offer read for fine print. Anything with a catch gets blocked."
      />
      {checked.length > 0 && <CardStack cards={checked} props={props} />}
      {unchecked.length > 0 && (
        <>
          <SectionTitle>{UNCHECKED_DEALS_SECTION}</SectionTitle>
          <CardStack cards={unchecked} props={props} />
        </>
      )}
      <ClaimDrawers cards={deals} props={props} />
      {blocked.length > 0 && (
        <section className="mt-7" aria-label="We caught these for you" data-testid="blocked-section">
          <h2 className="eyebrow text-[#9E2A21]">We caught these for you</h2>
          <p className="mt-1 text-[14px] text-ink-2">Blocked by Bundle. They are not counted in your totals.</p>
          <ul className="mt-2 space-y-3">
            {blocked.map((c) => (
              <li key={c.id} className="rounded-2xl border border-[#F2B9B3] bg-[#FDF1EF] p-4">
                <p className="text-[12px] font-bold uppercase tracking-[.12em] text-[#9E2A21]">Blocked by Bundle</p>
                <h3 className="mt-1 text-[17px] font-extrabold leading-snug text-ink">{c.title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{blockedReason(c)}</p>
                <Link href={props.href(c.id)} className="mt-1 inline-flex min-h-[44px] items-center text-[14px] font-bold text-coral-deep">See how we checked ›</Link>
                <MemorySection card={c} lines={props.lines} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {deals.length === 0 && blocked.length === 0 && (
        <p className="mt-4 rounded-2xl border border-line bg-paper px-4 py-3 text-[15px] text-ink-2">No offers to show yet. Check back soon.</p>
      )}
    </>
  );
}

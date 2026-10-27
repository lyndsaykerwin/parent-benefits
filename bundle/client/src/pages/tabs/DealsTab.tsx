import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import AuditDeal from '@/components/AuditDeal';
import FeedCardView from '@/components/FeedCardView';
import { MemorySection } from '@/components/HowWeCheckedSections';
import OfferReportCard from '@/components/OfferReportCard';
import { useLiveOffers, type LiveOffers } from '@/hooks/useLiveOffers';
import { UNCHECKED_DEALS_SECTION, fmtUsdShort } from '@/lib/bundle';
import { blockedReason } from '@/lib/howWeChecked';
import { NO_NEW_OFFERS_LINE, SEARCHING_LINE, checkingLine, fetchReportCard, foundLine, onlyNew, orderDeals } from '@/lib/offers';
import { categorySummary } from '@/lib/tabs';
import type { ReportCardReply } from '@shared/offers';
import { CardStack, CategoryHeader, ClaimDrawers, SectionTitle, type TabProps } from './shared';

/** The status line under the header. It says what is really happening, and never shows a spinner that could get stuck. */
function StatusLine({ live, saved }: { live: LiveOffers; saved: string }) {
  const searching = live.phase === 'searching';
  const text = live.phase === 'found' ? foundLine(live.sitesSearched, live.cards.length) : live.phase === 'quiet' ? NO_NEW_OFFERS_LINE : live.phase === 'practice' ? saved : SEARCHING_LINE;
  const dot = searching ? 'bg-coral animate-pulse' : live.phase === 'quiet' ? 'bg-ink-3' : 'bg-[#1E8E5A]';
  return (
    <div role="status" aria-live="polite" data-testid="deals-status" className="mt-4 flex items-start gap-2.5 rounded-2xl border border-line bg-paper px-4 py-3">
      <span aria-hidden="true" className={`mt-[7px] inline-block h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0">
        <p className="text-[14.5px] font-semibold leading-snug text-ink">{text}</p>
        {/* While the search runs, the saved offers below are already being checked against the baby's age. */}
        {searching && <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{saved}</p>}
      </div>
    </div>
  );
}

/** Deals: offers whose fine print checks out (with what it found), new finds from the live search, offers not yet checked, and the ones we blocked. */
export default function DealsTab(props: TabProps) {
  const [auditing, setAuditing] = useState(false);
  const [report, setReport] = useState<ReportCardReply | null>(null);
  const [reportVersion, setReportVersion] = useState(0);
  const live = useLiveOffers();

  useEffect(() => {
    let off = false;
    void fetchReportCard().then((r) => { if (!off) setReport(r); });
    return () => { off = true; };
  }, [reportVersion]);

  const deals = props.cards.filter((c) => c.kind === 'discount');
  const checked = orderDeals(deals.filter((c) => c.verdict !== 'info' && c.verdict !== 'blocked'));
  const unchecked = deals.filter((c) => c.verdict === 'info');
  const blocked = props.run.result.blocked ?? [];
  const { cents } = categorySummary(props.cards.filter((c) => !props.dismissed[c.id]), 'deals');
  const fresh = live.phase === 'found' ? orderDeals(onlyNew(live.cards, deals)) : [];

  if (auditing) {
    return <AuditDeal onBack={() => setAuditing(false)} onSaved={() => setReportVersion((v) => v + 1)} />;
  }
  return (
    <>
      <CategoryHeader
        eyebrow="Discounts & offers" dot="#C9352B"
        title={cents > 0 ? `${fmtUsdShort(cents)} in free gifts` : 'Deals checked for you'}
        sub="Every offer read for fine print. Anything with a catch gets blocked."
      />
      <button
        type="button" onClick={() => setAuditing(true)}
        className="mt-4 block w-full rounded-2xl border-2 border-dashed border-coral px-4 py-3.5 text-left"
      >
        <span className="eyebrow block text-coral-deep">Audit a deal</span>
        <span className="mt-1 block text-[18px] font-extrabold leading-snug text-ink">Tell us about any offer. We’ll read the fine print. <span aria-hidden="true">›</span></span>
      </button>
      <StatusLine live={live} saved={checkingLine(props.run.result.offersOnFile, props.run.family, props.run.today)} />
      {report && <OfferReportCard report={report} />}
      {fresh.length > 0 && (
        <>
          <SectionTitle tone="urgent">New today</SectionTitle>
          <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-500" data-testid="new-offers">
            {fresh.map((c) => <FeedCardView key={c.id} card={c} today={props.run.today} />)}
          </div>
        </>
      )}
      {checked.length > 0 && (
        <>
          {fresh.length > 0 && <SectionTitle>Your checked offers</SectionTitle>}
          <CardStack cards={checked} props={props} />
        </>
      )}
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
                <p className="mt-1 text-[15px] leading-relaxed text-ink-2"><span aria-hidden="true">🛡️ </span><strong className="font-bold text-[#9E2A21]">Fine print: Blocked:</strong> {blockedReason(c)}</p>
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

import { useEffect, useId, useState } from 'react';
import { Link } from 'wouter';
import AuditDeal from '@/components/AuditDeal';
import FeedCardView from '@/components/FeedCardView';
import { MemorySection } from '@/components/HowWeCheckedSections';
import OfferReportCard from '@/components/OfferReportCard';
import { useLiveOffers, type LiveOffers } from '@/hooks/useLiveOffers';
import { UNCHECKED_DEALS_SECTION, fmtUsdShort } from '@/lib/bundle';
import { blockedReason } from '@/lib/howWeChecked';
import {
  NO_NEW_OFFERS_LINE, SCANNING_LINE, SCAN_MS, SEARCHING_LINE, checkingLine, fetchReportCard, foundLine,
  guessAuditFields, onlyNew, orderDeals, sendAudit,
} from '@/lib/offers';
import { categorySummary, valueScoreLines } from '@/lib/tabs';
import type { AuditReply, ReportCardReply } from '@shared/offers';
import { cn } from '@/lib/utils';
import { CardStack, CategoryHeader, ClaimDrawers, SectionTitle, type TabProps } from './shared';

const liveVerdictLabel: Record<AuditReply['verdict'], string> = {
  approve: 'Approved',
  approve_with_catch: 'Approved',
  reject: 'Blocked',
};
const verdictPill: Record<AuditReply['verdict'], string> = {
  approve: 'bg-[#E3F3EA] text-[#17643F]',
  approve_with_catch: 'bg-[#FBEBCB] text-[#7A5410]',
  reject: 'bg-[#FBE3E0] text-[#9E2A21]',
};

/** The status line under the header. It says what is really happening, and never shows a spinner that could get stuck. */
function StatusLine({ live, saved, scanning }: { live: LiveOffers; saved: string; scanning: boolean }) {
  const searching = live.phase === 'searching';
  const real = live.phase === 'found' ? foundLine(live.sitesSearched, live.cards.length) : live.phase === 'quiet' ? NO_NEW_OFFERS_LINE : live.phase === 'practice' ? saved : SEARCHING_LINE;
  const text = scanning ? SCANNING_LINE : real;
  const dot = scanning || searching ? 'bg-coral animate-pulse' : live.phase === 'quiet' ? 'bg-ink-3' : 'bg-[#1E8E5A]';
  return (
    <div role="status" aria-live="polite" data-testid="deals-status" className="mt-4 flex items-start gap-2.5 rounded-2xl border border-line bg-paper px-4 py-3">
      <span aria-hidden="true" className={`mt-[7px] inline-block h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0">
        <p className="text-[14.5px] font-semibold leading-snug text-ink">{text}</p>
        {scanning && <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{real}</p>}
        {!scanning && searching && <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{saved}</p>}
      </div>
    </div>
  );
}

type QuickPhase =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done'; reply: AuditReply; store: string; offer: string }
  | { kind: 'problem'; message: string };

/** Paste-only auditor at the top of Deals. Store and “what you get” are guessed from the pasted text. */
function QuickAuditCard({ onSaved }: { onSaved?: () => void }) {
  const id = useId();
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<QuickPhase>({ kind: 'idle' });
  const ready = text.trim().length > 0 && phase.kind !== 'sending';

  const submit = async () => {
    const pasted = text.trim();
    if (!pasted) return;
    setPhase({ kind: 'sending' });
    const guessed = guessAuditFields(pasted);
    try {
      const reply = await sendAudit({ store: guessed.store, offer: guessed.offer, text: pasted });
      setPhase({ kind: 'done', reply, store: guessed.store, offer: guessed.offer });
      if (reply.saved && !reply.repeat) onSaved?.();
    } catch (e) {
      setPhase({ kind: 'problem', message: e instanceof Error ? e.message : 'We could not check that deal just now. Please try again.' });
    }
  };

  return (
    <section className="mt-4 rounded-2xl border border-line bg-paper p-4" data-testid="quick-audit" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-[18px] font-extrabold leading-snug text-ink">Check Any Offer or Registry Deal</h2>
      <p className="mt-1 text-[14.5px] leading-snug text-ink-2">Paste the fine print or offer text from Babylist, Target, or Amazon to test for hidden subscription traps.</p>
      <form className="mt-3" onSubmit={(e) => { e.preventDefault(); if (ready) void submit(); }}>
        <label htmlFor={`${id}-text`} className="sr-only">Offer or fine print to check</label>
        <textarea
          id={`${id}-text`}
          rows={5}
          maxLength={8000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the offer or the fine print here."
          className="w-full rounded-2xl border border-line bg-cream px-4 py-3 text-[16px] leading-snug text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-ink/30"
        />
        <button
          type="submit"
          disabled={!ready}
          className="mt-3 inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-ink px-4 text-[16px] font-extrabold text-cream disabled:opacity-40"
        >
          {phase.kind === 'sending' ? 'Reading the fine print…' : 'Audit Deal'}
        </button>
      </form>
      {phase.kind === 'problem' && (
        <p className="mt-3 rounded-2xl border border-[#F2B9B3] bg-[#FDF1EF] px-4 py-3 text-[15px] font-semibold text-[#9E2A21]">{phase.message}</p>
      )}
      {phase.kind === 'done' && (
        <div role="status" aria-live="polite" aria-label="Verdict" className="mt-4 rounded-2xl border border-line bg-cream p-4" data-testid="quick-audit-verdict">
          <p className="eyebrow text-ink-2">Verdict</p>
          <p className="mt-2">
            <span className={cn('inline-flex rounded-full px-3 py-1 text-[15px] font-extrabold', verdictPill[phase.reply.verdict])}>
              {liveVerdictLabel[phase.reply.verdict]}
            </span>
            {phase.reply.verdict === 'approve_with_catch' && <span className="ml-2 text-[14px] font-bold text-[#7A5410]">with a catch</span>}
          </p>
          <p className="mt-3 text-[17px] font-extrabold leading-snug text-ink">{phase.store}’s “{phase.offer}”</p>
          <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{phase.reply.summary}</p>
          {phase.reply.valueScore && (
            <div className="mt-3 rounded-xl bg-paper p-3" data-testid="quick-audit-value-score">
              <p className="eyebrow text-ink-2">Value Score</p>
              <ul className="mt-1 space-y-0.5 text-[14.5px] font-semibold leading-snug text-ink">
                {valueScoreLines(phase.reply.valueScore).map((l) => <li key={l}>{l}</li>)}
              </ul>
            </div>
          )}
          {phase.reply.hunter && (
            <div className="mt-3 rounded-xl bg-paper p-3">
              <p className="eyebrow text-[#17643F]">Deal Hunter</p>
              <p className="mt-1 text-[14.5px] leading-snug text-ink">{phase.reply.hunter}</p>
            </div>
          )}
          {phase.reply.lawyer && (
            <div className="mt-2 rounded-xl bg-paper p-3">
              <p className="eyebrow text-coral-deep">Fine-Print Lawyer</p>
              <p className="mt-1 text-[14.5px] leading-snug text-ink">{phase.reply.lawyer}</p>
            </div>
          )}
          {phase.reply.saved && (
            <p className="mt-3 text-[14.5px] font-semibold leading-snug text-[#17643F]">✓ Added to the shared list</p>
          )}
          {phase.reply.mode === 'quick' && !phase.reply.injection && (
            <p className="mt-3 text-[13.5px] leading-snug text-ink-2">Quick check. The full AI review runs in live mode.</p>
          )}
        </div>
      )}
    </section>
  );
}

/** Deals: offers whose fine print checks out (with what it found), new finds from the live search, offers not yet checked, and the ones we blocked. */
export default function DealsTab(props: TabProps) {
  const [auditing, setAuditing] = useState(false);
  const [report, setReport] = useState<ReportCardReply | null>(null);
  const [reportVersion, setReportVersion] = useState(0);
  const [scanning, setScanning] = useState(true);
  const live = useLiveOffers();

  useEffect(() => {
    const t = setTimeout(() => setScanning(false), SCAN_MS);
    return () => clearTimeout(t);
  }, []);

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
      <QuickAuditCard onSaved={() => setReportVersion((v) => v + 1)} />
      <button
        type="button" onClick={() => setAuditing(true)}
        className="mt-4 block w-full rounded-2xl border-2 border-dashed border-coral px-4 py-3.5 text-left"
      >
        <span className="eyebrow block text-coral-deep">Audit a deal</span>
        <span className="mt-1 block text-[18px] font-extrabold leading-snug text-ink">Tell us about any offer. We’ll read the fine print. <span aria-hidden="true">›</span></span>
      </button>
      <StatusLine live={live} saved={checkingLine(props.run.result.offersOnFile, props.run.family, props.run.today)} scanning={scanning} />
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

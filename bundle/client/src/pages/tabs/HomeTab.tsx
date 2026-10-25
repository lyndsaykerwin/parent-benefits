import { useState } from 'react';
import { Link } from 'wouter';
import { fmtUsdShort } from '@/lib/bundle';
import { categorySummary, claimableCards, giftValue, homeTotals, isQuickWin, moneyNumbers, taskCards, urgentDeadlines, cardState, type TabId } from '@/lib/tabs';
import { ComingSoonState, SectionTitle, CardStack, ClaimDrawers, type TabProps } from './shared';
import { ForgetItemsCard, HowWeGotThisNumber, SaveListCard, ShareBar } from './Extras';
import Buckets from './Buckets';

function Tile({ label, big, small, onClick }: { label: string; big: string; small: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="bundle-card flex min-h-[112px] flex-col items-start gap-1.5 p-4 text-left">
      <span className="text-[13px] font-bold text-ink-2">{label}</span>
      <span className="tabular text-[24px] font-extrabold leading-none tracking-[-0.02em]">{big}</span>
      <span className="text-[13px] text-ink-2">{small}</span>
    </button>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Home: the big total, "Do these first", the checklist progress, category tiles, and the light extras. */
export default function HomeTab(props: TabProps) {
  const { run, stage, cards } = props;
  const today = run.today ?? '';
  const [quick, setQuick] = useState(false);
  // "Not relevant" cards are out of every number and list on this screen; "I got this" cards stay in the headline and move to Claimed so far.
  const live = cards.filter((c) => !props.dismissed[c.id]);
  const money = moneyNumbers(run.result, props.claims, props.dismissed);
  const base = homeTotals(run.result);
  const totals = { ...base, totalCents: money.found, parts: base.parts.filter((c) => !props.dismissed[c.id]) };
  const urgent = urgentDeadlines(live, today, stage, run.family).filter((u) => cardState(u.card.id, props.claims, props.dismissed) === 'open');
  const claimable = claimableCards(cards);
  const claimed = money.claimed;
  const tasks = taskCards(cards);
  const openTasks = tasks.filter((c) => cardState(c.id, props.claims, props.dismissed) === 'open');
  const shownTasks = quick ? openTasks.filter(isQuickWin) : openTasks;
  const gifts = live.filter((c) => c.kind === 'discount' && c.verdict !== 'info' && c.verdict !== 'blocked' && giftValue(c) > 0);
  const blockedCount = run.result.blocked?.length ?? 0;
  const expecting = stage === 'expecting';
  const labels = Object.fromEntries(urgent.map((u) => [u.card.id, u.label]));
  const tax = categorySummary(live, 'taxes');
  const sav = categorySummary(live, 'savings');
  const ins = urgent.filter((u) => u.tab === 'insurance');
  const deals = categorySummary(live, 'deals');
  const giftsLine = totals.giftsCents > 0 ? `${fmtUsdShort(totals.giftsCents)} in free gifts${expecting ? ' you can get now' : ''}` : null;

  const giftSection = gifts.length > 0 && (
    <section aria-label="Free gifts">
      <SectionTitle>{expecting ? 'Free right now · registry gifts' : 'Free gifts'}</SectionTitle>
      <CardStack cards={gifts.slice(0, expecting ? 3 : 0)} props={props} />
      {expecting && gifts.length > 3 && (
        <button type="button" onClick={() => props.go('deals')} className="mt-2 flex min-h-[44px] items-center text-[14px] font-bold text-coral-deep">+ {gifts.length - 3} more in Deals ›</button>
      )}
    </section>
  );

  return (
    <>
      <section className="bundle-card mt-5 p-5" aria-labelledby="home-total">
        <p id="home-total" className="eyebrow text-ink-2">{expecting ? 'Waiting for your family' : 'Found for your family'}</p>
        <p data-testid="home-total-amount" className="tabular mt-1.5 text-[56px] font-extrabold leading-none tracking-[-0.04em] text-coral">{fmtUsdShort(totals.totalCents)}</p>
        <p className="mt-1.5 text-[16px] font-semibold" data-testid="home-total-sub">
          {expecting ? 'in savings and tax credits once baby arrives' : 'in savings and tax credits'}
          {giftsLine ? `, plus ${giftsLine}` : ''}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[12.5px] font-bold">
          {!expecting && urgent.length > 0 && <span className="rounded-full bg-coral-tint px-2.5 py-1 text-coral-deep">{plural(urgent.length, 'deadline', 'deadlines')} coming up</span>}
          <span className="rounded-full bg-[#E3F3EA] px-2.5 py-1 text-[#17643F]">Every amount traced to its source</span>
        </div>
        <HowWeGotThisNumber totals={totals} href={props.href} />

      </section>

      <div className="mt-3 grid grid-cols-2 gap-2.5" data-testid="money-summary">
        <div data-testid="still-to-claim" className="bundle-card p-4">
          <p className="eyebrow text-ink-2">Still to claim</p>
          <p className="tabular mt-1.5 text-[28px] font-extrabold leading-none tracking-[-0.02em] text-coral">{fmtUsdShort(money.still)}</p>
        </div>
        <div data-testid="claimed-so-far" className="bundle-card p-4">
          <p className="eyebrow text-ink-2">Claimed so far</p>
          <p className="tabular mt-1.5 text-[28px] font-extrabold leading-none tracking-[-0.02em] text-kind-clawback">{fmtUsdShort(money.claimed)}</p>
        </div>
      </div>

      <ComingSoonState note={props.stateNote} />

      {expecting && giftSection}

      {urgent.length > 0 && (
        <section aria-label="Do these first">
          <SectionTitle tone="urgent">{expecting ? 'Do these first · starts at birth' : 'Do these first'}</SectionTitle>
          <div className="mt-2 space-y-2">
            {urgent.map((u) => (
              <button key={u.card.id} type="button" onClick={() => props.go(u.tab as TabId)} className="bundle-card flex w-full items-center gap-3 p-3.5 text-left">
                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-coral" />
                <span className="flex min-w-0 grow flex-col gap-0.5">
                  <span className="text-[15px] font-extrabold leading-snug">{u.card.title}</span>
                  <span className="text-[13px] text-ink-2">See it in {u.tab === 'insurance' ? 'Insurance' : u.tab === 'taxes' ? 'Taxes' : 'Savings'}</span>
                </span>
                <span data-testid="urgent-label" className="shrink-0 rounded-full bg-coral-tint px-2 py-1 text-[12px] font-extrabold text-coral-deep">{labels[u.card.id]}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <Buckets {...props} />

      <section aria-label={quick ? 'Quick wins' : 'Do these next'} data-testid="task-list">
        <SectionTitle>Do these next</SectionTitle>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Filter tasks">
          <button type="button" aria-pressed={!quick} onClick={() => setQuick(false)} className={`min-h-[44px] rounded-full border px-4 text-[14px] font-bold ${!quick ? 'border-ink bg-ink text-cream' : 'border-line bg-paper text-ink'}`}>All</button>
          <button type="button" aria-pressed={quick} onClick={() => setQuick(true)} className={`min-h-[44px] rounded-full border px-4 text-[14px] font-bold ${quick ? 'border-ink bg-ink text-cream' : 'border-line bg-paper text-ink'}`}>⚡ Quick wins (under 5 min)</button>
        </div>
        {quick && <p className="mt-2 text-[13px] text-ink-2">Times are our estimates.</p>}
        {shownTasks.length > 0
          ? <CardStack cards={shownTasks} props={props} />
          : <p className="mt-3 rounded-2xl border border-line bg-paper px-4 py-3 text-[15px] text-ink-2" data-testid="tasks-empty">{quick ? 'No quick wins left. Nice work.' : 'Everything is handled. Nice work.'}</p>}
      </section>
      <ClaimDrawers cards={tasks} props={props} />

      <SectionTitle>By category</SectionTitle>
      <div className="mt-2 grid grid-cols-2 gap-2.5">
        <Tile label="Taxes" big={fmtUsdShort(tax.cents)} small={plural(tax.count, 'benefit', 'benefits')} onClick={() => props.go('taxes')} />
        <Tile label="Savings" big={fmtUsdShort(sav.cents)} small="starter account + money back" onClick={() => props.go('savings')} />
        <Tile label="Insurance" big={expecting ? 'At birth' : ins.length ? `${ins.length} due soon` : 'No rush'} small={expecting ? 'deadlines start at birth' : ins[0]?.label ?? 'nothing due this month'} onClick={() => props.go('insurance')} />
        <Tile label="Deals" big={fmtUsdShort(deals.cents)} small={`${plural(deals.count, 'offer', 'offers')}${blockedCount ? `, ${blockedCount} blocked` : ''}`} onClick={() => props.go('deals')} />
      </div>

      {blockedCount > 0 && (
        <button type="button" onClick={() => props.go('deals')} data-testid="trust-card" className="bundle-card mt-3 flex w-full items-center gap-3 p-4 text-left">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-coral"><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /><path d="m9 12 2 2 4-4" /></svg>
          <span className="flex flex-col">
            <span className="text-[15px] font-extrabold">We blocked {plural(blockedCount, 'deal', 'deals')} with a hidden catch</span>
            <span className="text-[13px] text-ink-2">See what we caught in Deals</span>
          </span>
        </button>
      )}

      {(claimed > 0 || claimable.some((c) => props.claims[c.id] && !props.dismissed[c.id])) && <ShareBar claimedCents={claimed} />}
      <SaveListCard />
      <ForgetItemsCard familyId={run.familyId} />

      <Link
        href="/smarter"
        className="mt-6 flex min-h-[64px] items-center justify-between gap-3 rounded-3xl bg-ink px-5 py-4 text-cream"
      >
        <span>
          <span className="block text-[17px] font-bold">Bundle got smarter</span>
          <span className="block text-[14px] text-[#D9CFC4]">See what parents taught it, and how it scores</span>
        </span>
        <span aria-hidden="true" className="text-[22px]">›</span>
      </Link>
    </>
  );
}

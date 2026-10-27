import type { FeedCard } from '@shared/bundle';
import { MA_LEAVE, OTHER_LEAVE_SUB, bucketOf, categoryOf, type HomeBucket } from '@shared/cardMeta';
import { fmtUsdShort } from '@/lib/bundle';
import { taxYearFor } from '@/lib/insurance';
import { claimableCards } from '@/lib/tabs';
import type { TabProps } from './shared';
import { useScan } from '@/components/scan/ScanContext';

/** "(after birth)" is added to cards while a family is expecting; the bucket already says when, so drop it here. */
const plainTitle = (t: string) => t.replace(/\s*\(after birth\)$/, '');

/** The short names the buckets use. Anything else keeps the card's own title. */
function shortTitle(c: FeedCard): string {
  if (c.id === 'benefit-trump_account') return 'Trump Account';
  if (c.id === 'benefit-federal_child_tax_credit') return 'Child Tax Credit';
  if (c.id === 'benefit-ma_child_tax_credit') return 'MA child credit';
  return plainTitle(c.title);
}

/** Plain notes under a line. The Child Tax Credit's two numbers answer different questions (IRS Rev. Proc. 2025-32: $2,200 maximum, $1,700 refundable for 2026). */
const NOTE: Record<string, string> = {
  'benefit-federal_child_tax_credit': 'Lowers your taxes by up to $2,200; up to $1,700 of that can come back as a refund even if you owe nothing.',
};

function Row({ card }: { card: FeedCard }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-line py-2.5 first:border-t-0">
      <span className="min-w-0 text-[16px] leading-snug">
        <span>{shortTitle(card)}</span>
        {NOTE[card.id] && <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{NOTE[card.id]}</span>}
      </span>
      <b className="tabular shrink-0 text-[16px]">{fmtUsdShort(card.amountCents ?? 0)}</b>
    </div>
  );
}

function Total({ cents }: { cents: number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line pt-2.5">
      <span className="text-[16px] font-extrabold">Total</span>
      <b className="tabular text-[16px]">{fmtUsdShort(cents)}</b>
    </div>
  );
}

const box = (accent: string) => `bundle-card relative mt-3 overflow-hidden p-4 pl-5 before:absolute before:inset-y-0 before:left-0 before:w-1 ${accent}`;

/**
 * Home's buckets: when the money arrives. Money back now (weeks), At tax time (spring after the baby's year), the baby's savings account
 * (the Trump Account deposit, once the baby has a Social Security number), Paid family leave (weekly).
 * Every amount is a card of the run; a card marked "Not relevant" is not in any bucket. Free gifts stay separate.
 */
export default function Buckets(props: TabProps) {
  const { run, stage } = props;
  const { openScan } = useScan();
  const live = props.cards.filter((c) => !props.dismissed[c.id]);
  const inBucket = (cat: HomeBucket) => live.filter((c) => bucketOf(c) === cat && (cat === 'leave' || (c.amountCents ?? 0) > 0));
  const moneyBack = inBucket('money_back');
  const taxTime = inBucket('tax_time');
  const leave = inBucket('leave')[0];
  const babySavings = inBucket('baby_savings');
  const year = taxYearFor(run.family, run.today ?? '');
  const gifts = live.filter((c) => categoryOf(c) === 'gift' && claimableCards(props.cards).some((g) => g.id === c.id));
  const sum = (cs: FeedCard[]) => cs.reduce((a, c) => a + (c.amountCents ?? 0), 0);
  const isMaLeave = leave && /^benefit-ma_pfml$/.test(leave.id);

  return (
    <>
      <h2 className="eyebrow mt-7 text-coral-deep">Your money, by when it arrives</h2>

      <section aria-label="Money back now" data-testid="bucket-money-back" className={box('before:bg-coral')}>
        <p className="eyebrow text-ink-2">Money back now</p>
        <h3 className="mt-1 text-[19px] font-extrabold leading-snug tracking-[-0.01em]">Within weeks of filing a claim</h3>
        {moneyBack.length === 0 ? (
          <button type="button" onClick={openScan} aria-haspopup="dialog" className="mt-3 flex min-h-[48px] w-full items-center gap-2 rounded-xl border border-dashed border-ink-3 px-3 text-left text-[15px] font-bold text-ink">
            <span aria-hidden="true" className="text-[20px] leading-none">+</span> Add a receipt to find money back
          </button>
        ) : (
          <div className="mt-2">
            {moneyBack.map((c) => <Row key={c.id} card={c} />)}
            {moneyBack.length > 1 && <Total cents={sum(moneyBack)} />}
          </div>
        )}
      </section>

      {taxTime.length > 0 && (
        <section aria-label="At tax time" data-testid="bucket-tax-time" className={box('before:bg-ink')}>
          <p className="eyebrow text-ink-2">At tax time</p>
          <h3 className="mt-1 text-[19px] font-extrabold leading-snug tracking-[-0.01em]">
            {stage === 'expecting' ? `When you file your ${year} taxes (spring ${year + 1}), once baby arrives` : `When you file your ${year} taxes (spring ${year + 1})`}
          </h3>
          <div className="mt-2">
            {taxTime.map((c) => <Row key={c.id} card={c} />)}
            {taxTime.length > 1 && <Total cents={sum(taxTime)} />}
          </div>
        </section>
      )}

      {babySavings.length > 0 && (
        <section aria-label="Your baby's savings account" data-testid="bucket-baby-savings" className={box('before:bg-[#1E8A5A]')}>
          <p className="eyebrow text-ink-2">Your baby’s savings account</p>
          <h3 className="mt-1 text-[19px] font-extrabold leading-snug tracking-[-0.01em]">
            {stage === 'expecting' ? 'Deposited after your baby is born and has a Social Security number' : 'Deposited once your baby has a Social Security number'}
          </h3>
          <div className="mt-2">
            {babySavings.map((c) => <Row key={c.id} card={c} />)}
          </div>
          <p className="mt-1 text-[14px] text-ink-2">Money from the government into an account in your baby’s name, not paid to you.</p>
          <button type="button" onClick={() => props.go('savings')} className="mt-1 flex min-h-[44px] items-center text-[15px] font-bold text-coral-deep">See the steps in Savings →</button>
        </section>
      )}

      {leave && (
        <section aria-label="Paid family leave" data-testid="bucket-leave" className={box('before:bg-kind-clawback')}>
          <p className="eyebrow text-ink-2">Paid family leave</p>
          <h3 className="mt-1 text-[19px] font-extrabold leading-snug tracking-[-0.01em]">{isMaLeave ? MA_LEAVE.headline : plainTitle(leave.title)}</h3>
          <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{isMaLeave ? MA_LEAVE.sub : OTHER_LEAVE_SUB}</p>
        </section>
      )}

      {gifts.length > 0 && stage !== 'expecting' && (
        <section aria-label="Free gifts" data-testid="bucket-gifts" className={box('before:bg-[#B7791F]')}>
          <p className="eyebrow text-ink-2">Free gifts</p>
          <h3 className="mt-1 text-[19px] font-extrabold leading-snug tracking-[-0.01em]">Registry and welcome boxes</h3>
          <p className="mt-1 text-[14px] text-ink-2">Shipped to you. Fine print checked.</p>
          <button type="button" onClick={() => props.go('deals')} className="mt-1 flex min-h-[44px] items-center text-[15px] font-bold text-coral-deep">See free gifts →</button>
        </section>
      )}
    </>
  );
}

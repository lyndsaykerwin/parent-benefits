import type { FeedCard } from '@shared/bundle';
import { MA_LEAVE, OTHER_LEAVE_SUB, categoryOf } from '@shared/cardMeta';
import { fmtUsdShort } from '@/lib/bundle';
import { taxYearFor } from '@/lib/insurance';
import { claimableCards } from '@/lib/tabs';
import type { TabProps } from './shared';

/** "(after birth)" is added to cards while a family is expecting; the bucket already says when, so drop it here. */
const plainTitle = (t: string) => t.replace(/\s*\(after birth\)$/, '');

/** The short names the buckets use. Anything else keeps the card's own title. */
function shortTitle(c: FeedCard): string {
  if (c.id === 'benefit-trump_account') return 'Trump Account';
  if (c.id === 'benefit-federal_child_tax_credit') return 'Child Tax Credit';
  if (c.id === 'benefit-ma_child_tax_credit') return 'MA child credit';
  return plainTitle(c.title);
}

/** Small notes that sit beside a line. Both come from the plan (plans/v2-feedback-response.md, "Money buckets"). */
const NOTE: Record<string, string> = { 'benefit-federal_child_tax_credit': 'up to $1,700 refundable' };

function Row({ card }: { card: FeedCard }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-line py-2.5 first:border-t-0">
      <span className="min-w-0 text-[16px] leading-snug">
        <span>{shortTitle(card)}</span>
        {NOTE[card.id] && <span className="text-[13px] text-ink-2"> ({NOTE[card.id]})</span>}
        {card.id === 'benefit-trump_account' && (
          <span className="mt-1 block"><span className="inline-flex rounded-full bg-[#E3F3EA] px-2.5 py-0.5 text-[12.5px] font-bold text-[#17643F]">Goes into your baby’s account</span></span>
        )}
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
 * Home's three buckets: when the money arrives. Money back now (weeks), At tax time (spring after the baby's year), Paid family leave (weekly).
 * Every amount is a card of the run; a card marked "Not relevant" is not in any bucket. Free gifts stay separate.
 */
export default function Buckets(props: TabProps) {
  const { run, stage } = props;
  const live = props.cards.filter((c) => !props.dismissed[c.id]);
  const inBucket = (cat: ReturnType<typeof categoryOf>) => live.filter((c) => categoryOf(c) === cat && (cat === 'leave' || (c.amountCents ?? 0) > 0));
  const moneyBack = inBucket('money_back');
  const taxTime = inBucket('tax_time');
  const leave = inBucket('leave')[0];
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
          <button type="button" onClick={() => props.go('savings')} className="mt-3 flex min-h-[48px] w-full items-center gap-2 rounded-xl border border-dashed border-ink-3 px-3 text-left text-[15px] font-bold text-ink">
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

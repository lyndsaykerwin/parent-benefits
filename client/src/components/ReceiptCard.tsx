import type { BundleReceipt } from '@shared/bundle';
import { daysUntil, fmtUsdShort } from '@/lib/bundle';

interface Props {
  receipt: BundleReceipt;
  /** Verified recall cards in this feed (0 = all clear). */
  recallCount: number;
  today?: string;
}

/** The Bundle Receipt: money back, benefits you likely qualify for, deadlines and items safety-checked. */
export default function ReceiptCard({ receipt, recallCount, today }: Props) {
  const next = receipt.nextDeadline ? daysUntil(receipt.nextDeadline, today) : null;
  const nextText = next === null ? null : next <= 0 ? 'next is today' : next === 1 ? 'next in 1 day' : `next in ${next} days`;
  return (
    <section aria-labelledby="receipt-title">
      <h2 id="receipt-title" className="eyebrow mt-5 text-ink-2">Your Bundle Receipt</h2>
      <div className="bundle-card mt-2 p-5">
        <p data-testid="receipt-money-back" className="tabular text-[48px] font-extrabold leading-none tracking-[-0.04em] text-coral">
          {fmtUsdShort(receipt.moneyBackCents)}
        </p>
        <p className="mt-2 text-[16px] font-bold text-ink">money back</p>
        <p className="text-[14px] text-ink-2">Refunds and price adjustments to claim</p>

        <div className="my-4 border-t border-dashed border-line" />

        <p data-testid="receipt-benefits" className="tabular text-[34px] font-extrabold leading-none tracking-[-0.03em] text-ink">
          {fmtUsdShort(receipt.likelyBenefitsCents)}
        </p>
        <p className="mt-2 text-[16px] font-bold text-ink">in benefits you likely qualify for</p>
        <p className="text-[14px] text-ink-2">Credits and payments from official programs</p>

        <div className="my-4 border-t border-dashed border-line" />

        <dl className="space-y-2 text-[15px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="font-semibold text-ink">{receipt.deadlineCount} {receipt.deadlineCount === 1 ? 'deadline' : 'deadlines'}</dt>
            <dd className="font-bold text-coral-deep">{nextText ?? 'none coming up'}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="font-semibold text-ink">{receipt.itemsChecked} {receipt.itemsChecked === 1 ? 'item' : 'items'} safety-checked</dt>
            <dd className={recallCount > 0 ? 'font-bold text-kind-recall' : 'font-bold text-kind-clawback'}>
              {recallCount > 0 ? `${recallCount} ${recallCount === 1 ? 'recall' : 'recalls'}` : 'all clear'}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

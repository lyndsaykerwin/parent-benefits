import type { ReportCardReply } from '@shared/offers';

/**
 * The offer report card: how many offers have been graded, how many had a catch, and per store how they split.
 * Offers a parent audited are counted and marked "from a parent", so they never pass as Bundle's own checks.
 * All numbers come from the server (the same grades /api/offer-audit serves); this screen adds nothing.
 */
export default function OfferReportCard({ report }: { report: ReportCardReply }) {
  const graded = report.brands.reduce((a, b) => a + (b.offersChecked ?? 0), 0);
  const caught = report.brands.reduce((a, b) => a + (b.offersCaught ?? 0), 0);
  const anyCaughtKnown = report.brands.some((b) => b.offersCaught !== null);
  const parents = report.fromParents;
  return (
    <section aria-label="Offer report card" data-testid="offer-report-card" className="mt-4 rounded-2xl border border-line bg-paper p-4">
      <p className="eyebrow text-ink-2">Offer report card</p>
      <p className="mt-2 text-[16px] font-bold leading-snug text-ink">
        We’ve graded {graded} offer{graded === 1 ? '' : 's'}{parents > 0 ? ` (${parents} from ${parents === 1 ? 'a parent' : 'parents'})` : ''}.
        {anyCaughtKnown ? ` ${caught} had a catch.` : ''}
      </p>
      <ul className="mt-3 space-y-3">
        {report.brands.map((b) => {
          const total = b.offersChecked ?? 0;
          const bad = b.offersCaught ?? 0;
          return (
            <li key={b.store} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-3 text-[14px]">
              <span className="min-w-0">
                <span className="block font-bold text-ink">{b.store}</span>
                {b.fromParents > 0 && <span className="mt-0.5 inline-flex rounded-full bg-[#FBEBCB] px-2 py-0.5 text-[11.5px] font-bold text-[#7A5410]">from a parent</span>}
              </span>
              {b.offersCaught !== null && total > 0 ? (
                <span aria-hidden="true" className="flex h-2.5 overflow-hidden rounded-full bg-[#F1ECE4]">
                  <span className="bg-[#1E8E5A]" style={{ width: `${((total - bad) / total) * 100}%` }} />
                  <span className="bg-[#E0A52B]" style={{ width: `${(bad / total) * 100}%` }} />
                </span>
              ) : <span />}
              <span className="text-right font-semibold text-ink-2">{total} graded</span>
            </li>
          );
        })}
      </ul>
      {anyCaughtKnown && <p className="mt-3 text-[13px] text-ink-2">Green approved · amber had a catch or was blocked</p>}
    </section>
  );
}

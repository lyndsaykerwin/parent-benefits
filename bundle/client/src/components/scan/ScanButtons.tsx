import { useScan } from './ScanContext';
import { CameraIcon } from './icons';

/** The "Scan" button at the right end of the header, on every tab. */
export function ScanHeaderButton() {
  const { openScan } = useScan();
  return (
    <button
      type="button" onClick={openScan} aria-haspopup="dialog"
      className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border-2 border-ink bg-paper px-3.5 text-[15px] font-bold text-ink transition active:scale-95"
    >
      <CameraIcon size={18} /> Scan
    </button>
  );
}

/** The wide dark "Scan gear or a receipt" button. */
export function ScanButton({ className = '' }: { className?: string }) {
  const { openScan } = useScan();
  return (
    <button
      type="button" onClick={openScan} aria-haspopup="dialog"
      className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 text-[16px] font-bold text-cream transition active:scale-[0.99] ${className}`}
    >
      <CameraIcon size={18} /> Scan gear or a receipt
    </button>
  );
}

/** The card on Home and Savings that invites a scan. */
export function ScanCard() {
  return (
    <section aria-label="Scan your baby gear" data-testid="scan-card" className="bundle-card mt-4 border-[#F5C4B0] bg-[#FFF8F4] p-4">
      <p className="text-[17px] font-extrabold leading-snug tracking-[-0.01em]"><span aria-hidden="true">📷 </span>Snap your baby gear — we’ll check recalls and find money back</p>
      <ScanButton className="mt-3" />
    </section>
  );
}

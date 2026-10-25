import React, { useCallback, useEffect, useState } from 'react';
import { fetchLocker, forgetMyItems, type Locker, type LockerItem } from '@/lib/photoPrep';
import { ForgetItemsCard } from '@/pages/tabs/Extras';
import { useFreezeSpot } from '@/lib/scrollSpot';
import { useScan } from './ScanContext';
import { ScanButton } from './ScanButtons';
import { LockerReceiptRow, RecallLine, Thumb } from './ResultCards';

type Load = { s: 'loading' } | { s: 'error'; message: string } | { s: 'ready'; locker: Locker };

/** Loads the family's locker, and again whenever something is saved or forgotten (the scan context's version goes up). */
export function useLocker(familyId: string): Load & { reload: () => void } {
  const { version } = useScan();
  const [state, setState] = useState<Load>({ s: 'loading' });
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    fetchLocker(familyId)
      .then((locker) => { if (live) setState({ s: 'ready', locker }); })
      .catch((e) => { if (live) setState({ s: 'error', message: (e as Error).message }); });
    return () => { live = false; };
  }, [familyId, version, n]);
  return { ...state, reload: useCallback(() => setN((x) => x + 1), []) };
}

const total = (l: Locker) => l.items.length + l.receipts.length;

function GearRow({ item }: { item: LockerItem }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <Thumb src={item.thumbnail} alt={`Photo of ${item.productName}`} kind="gear" />
      <div className="min-w-0 grow">
        <p className="text-[16px] font-extrabold leading-snug">{item.productName}</p>
        {(item.modelNumber || item.brand) && <p className="text-[13.5px] text-ink-2">{[item.brand, item.modelNumber ? `Model ${item.modelNumber}` : null].filter(Boolean).join(' · ')}</p>}
        {item.recall && <div className="mt-1.5"><RecallLine recall={item.recall} compact /></div>}
      </div>
    </li>
  );
}

/** The Gear Locker page: every gear item and receipt saved for this family, with a scan button and the privacy line. */
export function GearLockerView({ familyId }: { familyId: string }) {
  useFreezeSpot(); // the tab's scroll spot is kept while the locker is open, and the page returns to it on Back
  const { closeLocker, bump } = useScan();
  const load = useLocker(familyId);
  const locker = load.s === 'ready' ? load.locker : null;
  return (
    // The "Gear locker" region appears once the locker has loaded, so a screen reader never lands on an empty one.
    <Shell ready={load.s === 'ready'}>
      <button type="button" onClick={closeLocker} className="-ml-1 flex min-h-[44px] items-center gap-1 px-1 text-[15px] font-bold text-ink"><span aria-hidden="true">‹</span> Back</button>
      <h1 className="mt-1 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em]">Your gear locker</h1>
      <p className="mt-2 text-[16px] leading-relaxed text-ink-2">We check each item against official recall lists.</p>
      {load.s === 'loading' && <p role="status" className="mt-4 text-[15px] text-ink-2">Opening your locker…</p>}
      {load.s === 'error' && <p role="alert" className="mt-4 rounded-xl bg-[#FBE3E0] px-3 py-2 text-[14px] font-semibold text-[#9E2A21]">{load.message}</p>}
      {locker && total(locker) === 0 && <EmptyLocker />}
      {locker && total(locker) > 0 && (
        <div className="bundle-card mt-4 px-4">
          <ul className="divide-y divide-line">
            {locker.items.map((it, i) => <GearRow key={`${it.id ?? 'x'}-${i}`} item={it} />)}
            {locker.receipts.map((r) => <LockerReceiptRow key={`r-${r.photoId}`} r={r} />)}
          </ul>
        </div>
      )}
      {locker && total(locker) > 0 && <ScanButton className="mt-4" />}
      <ForgetItemsCard familyId={familyId} forget={async (id) => { const n = await forgetMyItems(id); bump(); return n; }} />
    </Shell>
  );
}

function Shell({ ready, children }: { ready: boolean; children: React.ReactNode }) {
  return ready
    ? <section aria-label="Gear locker" data-testid="gear-locker" className="mt-2">{children}</section>
    : <div data-testid="gear-locker-loading" className="mt-2">{children}</div>;
}

function EmptyLocker() {
  return (
    <div className="mt-4">
      <p className="bundle-card p-4 text-[15px] leading-snug text-ink-2" data-testid="locker-empty">No gear yet — scan a car seat sticker or a receipt to start.</p>
      <ScanButton className="mt-3 !bg-coral" />
    </div>
  );
}

/** A small locker card for the Savings tab (and the Account tab): how many things are saved, "Open ›", or the empty state with a scan button. `list` also names each gear item (the Account tab uses it). */
export function GearLockerCard({ familyId, list = false }: { familyId: string; list?: boolean }) {
  const { openLocker } = useScan();
  const load = useLocker(familyId);
  const locker = load.s === 'ready' ? load.locker : null;
  const n = locker ? total(locker) : 0;
  return (
    // Like the full locker page, the "gear locker" region appears once the locker has loaded (never an empty one).
    <section aria-label={locker ? 'Your gear locker card' : undefined} data-testid="gear-locker-card" className="bundle-card mt-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow text-ink-2">Your gear locker</p>
        <button type="button" onClick={openLocker} className="flex min-h-[44px] items-center px-1 text-[15px] font-bold text-coral-deep">Open ›</button>
      </div>
      {load.s === 'loading'
        ? <p className="text-[15px] leading-snug text-ink-2">Opening your locker…</p>
        : n === 0
        ? (
          <>
            <p className="text-[15px] leading-snug text-ink-2">No gear yet — scan a car seat sticker or a receipt to start.</p>
            <ScanButton className="mt-3" />
          </>
        )
        : (
          <p className="text-[15px] leading-snug text-ink-2">
            {locker!.items.length > 0 && <>{locker!.items.length} {locker!.items.length === 1 ? 'item' : 'items'}</>}
            {locker!.items.length > 0 && locker!.receipts.length > 0 && ' and '}
            {locker!.receipts.length > 0 && <>{locker!.receipts.length} {locker!.receipts.length === 1 ? 'receipt' : 'receipts'}</>}
            {' '}saved and checked against official recall lists.
          </p>
        )}
      {list && locker && locker.items.length > 0 && (
        <ul className="mt-2 divide-y divide-line" data-testid="locker-names">
          {locker.items.map((it, i) => <li key={`${it.id ?? 'x'}-${i}`} className="py-2 text-[15px] font-bold leading-snug">{it.productName}</li>)}
        </ul>
      )}
    </section>
  );
}

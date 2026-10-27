import React, { useCallback, useEffect, useState } from 'react';
import { fetchLocker, forgetMyItems, type Locker, type LockerItem } from '@/lib/photoPrep';
import { ForgetItemsCard } from '@/pages/tabs/Extras';
import { useFreezeSpot } from '@/lib/scrollSpot';
import { useScan } from './ScanContext';
import { ScanButton } from './ScanButtons';
import { LockerReceiptRow, RecallLine, Thumb } from './ResultCards';
import { dismissPhoto, fetchPendingPhotos, retryPhoto, type PhotoStatusView } from './photoJob';

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

/** Photos still being read, or stopped with a message. Checks again every few seconds while any is still reading. */
export function usePendingPhotos(familyId: string, pollMs = 4000): { photos: PhotoStatusView[]; reload: () => void } {
  const { version } = useScan();
  const [photos, setPhotos] = useState<PhotoStatusView[]>([]);
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      const list = await fetchPendingPhotos(familyId);
      if (!live) return;
      setPhotos(list);
      if (list.some((p) => p.status === 'reading')) timer = setTimeout(() => setN((x) => x + 1), pollMs);
    };
    void load();
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, [familyId, version, n, pollMs]);
  return { photos, reload: useCallback(() => setN((x) => x + 1), []) };
}

function PendingRow({ p, familyId, onChange }: { p: PhotoStatusView; familyId: string; onChange: () => void }) {
  const { openScan, track } = useScan();
  const what = p.kind === 'receipt' ? 'receipt' : 'gear photo';
  if (p.status === 'reading') {
    return (
      <li className="flex items-start gap-3 py-3" data-testid="photo-reading">
        <Thumb src={p.thumbnail} alt={`Your ${what}, being read`} kind={p.kind === 'receipt' ? 'receipt' : 'gear'} />
        <div className="min-w-0 grow" role="status">
          <p className="flex items-center gap-2 text-[16px] font-extrabold leading-snug">
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-coral" aria-hidden="true" /> Reading…
          </p>
          <p className="text-[13.5px] leading-snug text-ink-2">{p.message ?? `We're reading your ${what}. It appears here when it's done.`}</p>
        </div>
      </li>
    );
  }
  const retry = async () => {
    if (!p.canRetry) { openScan(); return; }
    const out = await retryPhoto(familyId, p.photoId).catch(() => 'retake' as const);
    if (out === 'retake') openScan(); else track(familyId, p.photoId);
    onChange();
  };
  const remove = async () => { await dismissPhoto(familyId, p.photoId).catch(() => undefined); onChange(); };
  return (
    <li className="flex items-start gap-3 py-3" data-testid="photo-problem-row">
      <Thumb src={p.thumbnail} alt={`Your ${what}`} kind={p.kind === 'receipt' ? 'receipt' : 'gear'} />
      <div className="min-w-0 grow">
        <p className="text-[16px] font-extrabold leading-snug text-[#8A5B00]">Couldn’t read this one</p>
        <p className="text-[14px] leading-snug text-ink-2">{p.message}</p>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={retry} className="min-h-[44px] rounded-xl bg-ink px-3 text-[14px] font-bold text-cream">{p.canRetry ? 'Try again' : 'Take a new photo'}</button>
          <button type="button" onClick={remove} className="min-h-[44px] px-2 text-[14px] font-bold text-ink underline underline-offset-4">Remove</button>
        </div>
      </div>
    </li>
  );
}

function GearRow({ item }: { item: LockerItem & { manufacturedOn?: string | null; lotCode?: string | null } }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <Thumb src={item.thumbnail} alt={`Photo of ${item.productName}`} kind="gear" />
      <div className="min-w-0 grow">
        <p className="text-[16px] font-extrabold leading-snug">{item.productName}</p>
        {(item.modelNumber || item.brand) && <p className="text-[13.5px] text-ink-2">{[item.brand, item.modelNumber ? `Model ${item.modelNumber}` : null, item.manufacturedOn ? `Made ${item.manufacturedOn}` : null, item.lotCode ? `Lot ${item.lotCode}` : null].filter(Boolean).join(' · ')}</p>}
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
  const pending = usePendingPhotos(familyId);
  const locker = load.s === 'ready' ? load.locker : null;
  const busy = pending.photos;
  return (
    // The "Gear locker" region appears once the locker has loaded, so a screen reader never lands on an empty one.
    <Shell ready={load.s === 'ready'}>
      <button type="button" onClick={closeLocker} className="-ml-1 flex min-h-[44px] items-center gap-1 px-1 text-[15px] font-bold text-ink"><span aria-hidden="true">‹</span> Back</button>
      <h1 className="mt-1 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em]">Your gear locker</h1>
      <p className="mt-2 text-[16px] leading-relaxed text-ink-2">We check each item against official recall lists.</p>
      {load.s === 'loading' && <p role="status" className="mt-4 text-[15px] text-ink-2">Opening your locker…</p>}
      {load.s === 'error' && <p role="alert" className="mt-4 rounded-xl bg-[#FBE3E0] px-3 py-2 text-[14px] font-semibold text-[#9E2A21]">{load.message}</p>}
      {locker && total(locker) === 0 && busy.length === 0 && <EmptyLocker />}
      {locker && total(locker) + busy.length > 0 && (
        <div className="bundle-card mt-4 px-4">
          <ul className="divide-y divide-line">
            {busy.map((p) => <PendingRow key={`p-${p.photoId}`} p={p} familyId={familyId} onChange={() => { pending.reload(); bump(); }} />)}
            {locker.items.map((it, i) => <GearRow key={`${it.id ?? 'x'}-${i}`} item={it} />)}
            {locker.receipts.map((r) => <LockerReceiptRow key={`r-${r.photoId}`} r={r} />)}
          </ul>
        </div>
      )}
      {locker && total(locker) + busy.length > 0 && <ScanButton className="mt-4" />}
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

/** "Brand Product", without saying the brand twice when the product name already starts with it. */
const gearTitle = (it: LockerItem) => (it.brand && !it.productName.toLowerCase().startsWith(it.brand.toLowerCase()) ? `${it.brand} ${it.productName}` : it.productName);

/** Savings tab: every scanned gear item, so a clean result (no recall, no money back) is still shown, not swallowed. */
function InspectedGear({ items }: { items: LockerItem[] }) {
  return (
    <div className="mt-3" data-testid="inspected-gear">
      <p className="text-[15px] font-extrabold">Inspected nursery gear</p>
      <ul className="mt-1 divide-y divide-line">
        {items.map((it, i) => {
          const details = [it.modelNumber ? `Model: ${it.modelNumber}` : null, it.upc ? `UPC: ${it.upc}` : null].filter(Boolean).join(' · ');
          return (
            <li key={`${it.id ?? 'x'}-${i}`} className="flex items-start gap-3 py-3" data-testid="inspected-item">
              <Thumb src={it.thumbnail} alt={`Photo of ${it.productName}`} kind="gear" />
              <div className="min-w-0 grow">
                <p className="text-[16px] font-extrabold leading-snug">{gearTitle(it)}</p>
                {details && <p className="text-[13.5px] text-ink-2">{details}</p>}
                {it.recall
                  ? <div className="mt-1.5"><RecallLine recall={it.recall} compact /></div>
                  : <span data-testid="verified-safe" className="mt-1.5 inline-block rounded-full bg-[#E3F3EA] px-2.5 py-1 text-[12.5px] font-bold text-[#17643F]">✓ Verified Safe · 0 Recalls Found</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A small locker card for the Savings tab (and the Account tab): how many things are saved, "Open ›", or the empty state with a scan button. `list` also names each gear item (the Account tab uses it); `inspected` shows each item with its recall result (the Savings tab uses it). */
export function GearLockerCard({ familyId, list = false, inspected = false }: { familyId: string; list?: boolean; inspected?: boolean }) {
  const { openLocker, notices } = useScan();
  const load = useLocker(familyId);
  const reading = usePendingPhotos(familyId).photos.filter((p) => p.status === 'reading').length;
  const locker = load.s === 'ready' ? load.locker : null;
  const n = locker ? total(locker) : 0;
  return (
    // Like the full locker page, the "gear locker" region appears once the locker has loaded (never an empty one).
    <section aria-label={locker ? 'Your gear locker card' : undefined} data-testid="gear-locker-card" className="bundle-card mt-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow flex items-center gap-2 text-ink-2">Your gear locker
          {notices.length > 0 && <span className="rounded-full bg-coral px-2 py-0.5 text-[11.5px] font-extrabold normal-case tracking-normal text-cream" data-testid="locker-badge">{notices.length} new</span>}
        </p>
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
      {reading > 0 && <p className="mt-1 text-[14px] font-semibold text-ink-2" data-testid="locker-card-reading">Reading {reading} {reading === 1 ? 'photo' : 'photos'}…</p>}
      {inspected && locker && locker.items.length > 0 && <InspectedGear items={locker.items} />}
      {list && locker && locker.items.length > 0 && (
        <ul className="mt-2 divide-y divide-line" data-testid="locker-names">
          {locker.items.map((it, i) => <li key={`${it.id ?? 'x'}-${i}`} className="py-2 text-[15px] font-bold leading-snug">{it.productName}</li>)}
        </ul>
      )}
    </section>
  );
}

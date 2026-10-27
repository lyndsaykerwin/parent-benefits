import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { checkPickedFile, preparePhoto, type PhotoReadResponse } from '@/lib/photoPrep';
import { cn } from '@/lib/utils';
import { useScan } from './ScanContext';
import { CameraIcon, CheckIcon, GearIcon, ReceiptIcon } from './icons';
import { GearResult, ReceiptResult, SampleNote } from './ResultCards';
import { CAPTURE_TIP, EXAMPLES, STROLLER_TIP, retryPhoto, startPhoto, type StartResponse } from './photoJob';

type Kind = 'gear' | 'receipt';
type OkResponse = Extract<PhotoReadResponse, { status: 'ok' }>;
type Step =
  | { s: 'choose' }
  | { s: 'capture'; kind: Kind }
  | { s: 'reading'; kind: Kind }
  /** Sent: the server is reading it in the background. The sheet can be closed; the locker gets a notice when done. */
  | { s: 'started'; kind: Kind; photoId: number; message: string }
  | { s: 'result'; kind: Kind; res: OkResponse }
  | { s: 'problem'; kind: Kind; message: string; retryId?: number };

export interface ScanDeps {
  prepare: typeof preparePhoto;
  send: (body: { familyId: string; kind: 'item' | 'receipt'; mimeType: string; imageBase64: string; thumbnail?: string }) => Promise<StartResponse>;
  /** Loads an example label picture as a file (the "Try the example" button). */
  loadExample?: (src: string) => Promise<File>;
}
async function loadExampleFile(src: string): Promise<File> {
  const res = await fetch(src);
  if (!res.ok) throw new Error('Could not open the example. Please try again.');
  return new File([await res.blob()], `${src.split('/').pop()}.png`, { type: 'image/png' });
}
const REAL: ScanDeps = { prepare: preparePhoto, send: startPhoto, loadExample: loadExampleFile };

/** The exact tip for the gear camera view (round 3, R7). */
export const GEAR_TIP = "Tip: frame the white manufacturer label or barcode sticker. It's usually under a car seat, on the back of a high chair, or on a stroller's rear frame.";
export const NO_MODEL = "We couldn't find a model number. Try the white label.";
export const TRUST_LINE = 'Photos are saved with your family’s profile only. We strip location data. Delete anytime.';

/** The words under "Where are you pointing the phone". */
const PHONE_GEAR = 'On your phone, point at the sticker on the bottom of the car seat.';

function Choice({ icon, title, sub, onClick }: { icon: JSX.Element; title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="bundle-card flex w-full items-center gap-3 p-3.5 text-left transition active:scale-[0.99]">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FCE9E1] text-coral-deep">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[17px] font-extrabold leading-snug">{title}</span>
        <span className="block text-[14px] leading-snug text-ink-2">{sub}</span>
      </span>
    </button>
  );
}

/**
 * The scan sheet: "What are you scanning?" (gear or a receipt) -> camera view with a framing guide -> reading -> result card.
 * Opened from every scan entry point through the shared scan context. The phone redraws the picture first (location and phone
 * details are dropped), the server reads it and checks recalls, and a small copy is kept in the gear locker.
 */
export default function ScanSheet({ familyId, deps = REAL }: { familyId: string; deps?: ScanDeps }) {
  const { sheetOpen, closeScan, openLocker, bump, track, photos } = useScan();
  const [step, setStep] = useState<Step>({ s: 'choose' });
  const [tab, setTab] = useState<'phone' | 'computer'>('phone');
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);

  // A fresh sheet every time it opens.
  useEffect(() => { if (sheetOpen) { setStep({ s: 'choose' }); setTab('phone'); } }, [sheetOpen]);
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeScan(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetOpen, closeScan]);

  // A background read finishing while the sheet is still open: show the result (or the problem) right here.
  const watched = step.s === 'started' ? photos[step.photoId] : undefined;
  useEffect(() => {
    if (step.s !== 'started' || !watched || watched.status === 'reading') return;
    if (watched.status === 'done' && watched.result && watched.result.items?.length) {
      setStep({ s: 'result', kind: step.kind, res: { ...watched.result, stored: watched.result.already ? 0 : watched.result.stored } });
    } else {
      setStep({ s: 'problem', kind: step.kind, message: watched.message ?? 'We could not read that photo.', retryId: watched.canRetry ? watched.photoId : undefined });
    }
  }, [step, watched]);

  if (!sheetOpen) return null;

  async function onPick(e: ChangeEvent<HTMLInputElement>, kind: Kind) {
    const file = e.target.files?.[0];
    e.target.value = ''; // so choosing the same photo again still fires
    if (!file) return;
    await readFile(file, kind);
  }

  async function tryExample(src: string) {
    setStep({ s: 'reading', kind: 'gear' });
    try { await readFile(await (deps.loadExample ?? loadExampleFile)(src), 'gear'); }
    catch (err) { if (live.current) setStep({ s: 'problem', kind: 'gear', message: (err as Error).message || 'Could not open the example.' }); }
  }

  async function tryAgain(kind: Kind, photoId: number) {
    try {
      const out = await retryPhoto(familyId, photoId);
      if (out === 'retake') { setStep({ s: 'capture', kind }); return; }
      track(familyId, photoId);
      setStep({ s: 'started', kind, photoId, message: "Thanks! We're reading your photo again. You can close this." });
    } catch { setStep({ s: 'capture', kind }); }
  }

  async function readFile(file: File, kind: Kind) {
    const bad = checkPickedFile(file);
    if (bad) { setStep({ s: 'problem', kind, message: bad }); return; }
    setStep({ s: 'reading', kind });
    try {
      const prepared = await deps.prepare(file);
      const res = await deps.send({ familyId, kind: kind === 'gear' ? 'item' : 'receipt', mimeType: prepared.mimeType, imageBase64: prepared.imageBase64, thumbnail: prepared.thumbnail });
      if (!live.current) return;
      if (res.status === 'reading') {
        track(familyId, res.photoId);
        setStep({ s: 'started', kind, photoId: res.photoId, message: res.message });
        bump();
        return;
      }
      if (res.status !== 'ok') { setStep({ s: 'problem', kind, message: res.message }); return; }
      if (res.items.length === 0) { setStep({ s: 'problem', kind, message: kind === 'gear' ? NO_MODEL : 'We could not find any items on that receipt. Try a flatter, brighter photo.' }); return; }
      setStep({ s: 'result', kind, res });
      bump();
    } catch (err) {
      if (live.current) setStep({ s: 'problem', kind, message: (err as Error).message || 'Could not read that photo. Please try again.' });
    }
  }

  const kind = step.s === 'choose' ? null : step.kind;
  const title = step.s === 'choose' ? 'What are you scanning?' : step.s === 'result' ? 'Your scan' : step.s === 'problem' ? 'Scan problem' : step.s === 'started' ? 'Photo sent' : kind === 'gear' ? 'Take a photo' : 'Take a photo of your receipt';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40" onClick={(e) => { if (e.target === e.currentTarget && step.s !== 'reading') closeScan(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="scan-title" className="max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl bg-cream px-4 pb-8 pt-3 shadow-2xl">
        <div aria-hidden="true" className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-line" />

        {step.s === 'capture' && (
          <button type="button" onClick={() => setStep({ s: 'choose' })} className="-ml-1 mb-1 flex min-h-[44px] items-center gap-1 px-1 text-[15px] font-bold text-ink">
            <span aria-hidden="true">‹</span> Back
          </button>
        )}
        <h2 id="scan-title" className={cn('text-[24px] font-extrabold tracking-[-0.02em]', step.s === 'result' && 'sr-only')}>{title}</h2>

        {step.s === 'choose' && (
          <div className="mt-3 space-y-2.5">
            <Choice icon={<GearIcon />} title="Gear (the sticker on the item)" sub="We check it against official recall lists" onClick={() => setStep({ s: 'capture', kind: 'gear' })} />
            <Choice icon={<ReceiptIcon />} title="A receipt" sub="Money back (FSA-eligible items, price drops) and a recall check on each item" onClick={() => setStep({ s: 'capture', kind: 'receipt' })} />
            <p className="px-2 pt-1 text-center text-[13.5px] leading-snug text-ink-2">{TRUST_LINE}</p>
            <button type="button" onClick={closeScan} className="mx-auto flex min-h-[44px] items-center px-3 text-[15px] font-bold text-ink underline decoration-2 underline-offset-4">Cancel</button>
          </div>
        )}

        {step.s === 'capture' && (
          <div className="mt-3">
            {step.kind === 'gear' ? (
              <>
                <div role="tablist" aria-label="Where you are" className="grid grid-cols-2 gap-1 rounded-xl bg-[#EFE9E0] p-1">
                  {(['phone', 'computer'] as const).map((t) => (
                    <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                      className={cn('min-h-[40px] rounded-lg px-2 text-[15px] font-bold', tab === t ? 'bg-paper text-ink shadow-sm' : 'text-ink-2')}>
                      {t === 'phone' ? 'On my phone' : 'On a computer'}
                    </button>
                  ))}
                </div>
                <section aria-label="What to photograph" className="bundle-card mt-3 p-4" data-testid="example-labels">
                  <p className="text-[16px] font-extrabold leading-snug" data-testid="capture-tip">{CAPTURE_TIP}</p>
                  <p className="mt-1 text-[14px] leading-snug text-ink-2">It shows the model number, the date made and the lot number. Recalls are matched on those. {STROLLER_TIP}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    {EXAMPLES.map((ex) => (
                      <figure key={ex.id} className="min-w-0">
                        <img src={ex.src} alt={ex.alt} className="aspect-[1200/860] w-full rounded-lg border border-line bg-[#EFE9E0] object-cover" loading="lazy" />
                        <figcaption className="mt-1 text-[12.5px] font-bold leading-tight text-ink-2">Example: {ex.title.toLowerCase()} <span className="font-semibold">(made-up)</span></figcaption>
                        <button type="button" onClick={() => tryExample(ex.src)} className="mt-1 min-h-[40px] w-full rounded-lg border-2 border-ink px-2 text-[13px] font-bold text-ink">Try this example</button>
                      </figure>
                    ))}
                  </div>
                </section>
                <div className="bundle-card mt-3 p-4">
                  <p className="text-[15px] leading-snug text-ink-2" data-testid="camera-where">{tab === 'phone' ? PHONE_GEAR : 'On a computer, upload a photo of the white label or barcode sticker.'}</p>
                  <div aria-hidden="true" data-testid="framing-guide" className="mx-auto mt-3 flex h-[120px] w-full max-w-[280px] items-center justify-center rounded-2xl border-[3px] border-dashed border-ink bg-[#FBF7F1]">
                    <span className="rounded border-2 border-coral bg-paper px-3 py-1 text-[11px] font-bold tracking-wide text-coral-deep">MODEL · DATE MADE · LOT</span>
                  </div>
                  <p className="mt-3 text-center text-[16px] font-extrabold">Fit the label inside the dashed frame.</p>
                  <p className="mt-3 rounded-xl bg-[#F1ECE4] px-3 py-2.5 text-[14px] leading-snug text-ink-2" data-testid="gear-tip">{GEAR_TIP}</p>
                </div>
              </>
            ) : (
              <div className="bundle-card p-4">
                <p className="text-[15px] leading-snug text-ink-2">Lay the receipt flat in good light, with every line in view. We read the store, date and items, and check each one for money back and recalls.</p>
                <p className="mt-3 rounded-xl bg-[#F1ECE4] px-3 py-2.5 text-[14px] leading-snug text-ink-2">Tip: cover or fold away your card number and address if they are printed on it. We never keep them.</p>
              </div>
            )}
            <label className="mt-4 flex min-h-[56px] cursor-pointer items-center justify-center gap-2 rounded-2xl bg-ink px-4 text-[17px] font-bold text-cream">
              <CameraIcon size={20} /> {step.kind === 'gear' && tab === 'computer' ? 'Choose photo' : 'Take photo'}
              <input type="file" accept="image/*" {...(tab === 'phone' ? { capture: 'environment' as const } : {})} className="sr-only" aria-label="Take or choose a photo" onChange={(e) => onPick(e, step.kind)} />
            </label>
            <p className="mt-3 px-2 text-center text-[13.5px] leading-snug text-ink-2">{TRUST_LINE}</p>
            <button type="button" onClick={closeScan} className="mx-auto mt-1 flex min-h-[44px] items-center px-3 text-[15px] font-bold text-ink underline decoration-2 underline-offset-4">Cancel</button>
          </div>
        )}

        {step.s === 'reading' && (
          <div role="status" className="mt-6 flex flex-col items-center gap-3 pb-6 text-center" data-testid="scan-reading">
            <span className="h-9 w-9 animate-spin rounded-full border-4 border-line border-t-coral" aria-hidden="true" />
            <p className="text-[17px] font-bold">Sending your photo…</p>
            <p className="text-[14px] text-ink-2">Then we read it and check it against the official recall lists.</p>
          </div>
        )}

        {step.s === 'started' && (
          <div className="mt-3" data-testid="scan-started">
            <div role="status" className="rounded-2xl border-2 border-[#1E8A5A] bg-paper p-4">
              <p className="flex items-center gap-2 text-[18px] font-extrabold leading-snug"><CheckIcon size={20} /> Got it.</p>
              <p className="mt-1.5 text-[16px] leading-snug">{step.message}</p>
              <p className="mt-3 flex items-center gap-2 text-[14px] text-ink-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-coral" aria-hidden="true" />
                {photos[step.photoId]?.message ?? 'Reading it now. The free photo reader can take a minute or two when it is busy.'}
              </p>
            </div>
            <button type="button" onClick={openLocker} className="mt-4 flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-coral px-4 text-[17px] font-bold text-cream">See your gear locker →</button>
            <button type="button" onClick={closeScan} className="mx-auto mt-2 flex min-h-[44px] items-center px-3 text-[15px] font-bold text-ink underline decoration-2 underline-offset-4">Done</button>
          </div>
        )}

        {step.s === 'result' && (
          <div className="mt-1">
            {step.res.sample && <SampleNote />}
            <div aria-live="polite" className="space-y-3">
              {step.kind === 'gear'
                ? step.res.items.map((it, i) => <GearResult key={`${it.productName}-${i}`} item={it} thumbnail={step.res.thumbnail} sample={step.res.sample} already={step.res.stored === 0} />)
                : <ReceiptResult items={step.res.items} store={step.res.store} purchasedOn={step.res.purchasedOn} thumbnail={step.res.thumbnail} sample={step.res.sample} already={step.res.stored === 0} />}
            </div>
            <button type="button" onClick={openLocker} className="mt-4 flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-coral px-4 text-[17px] font-bold text-cream">See your gear locker →</button>
            <button type="button" onClick={closeScan} className="mx-auto mt-2 flex min-h-[44px] items-center px-3 text-[15px] font-bold text-ink underline decoration-2 underline-offset-4">Done</button>
          </div>
        )}

        {step.s === 'problem' && (
          <div className="mt-2">
            <div role="alert" className="rounded-2xl border-2 border-[#B7791F] bg-paper p-4" data-testid="photo-problem">
              <p className="eyebrow text-[#8A5B00]">Couldn’t read it</p>
              <p className="mt-1.5 text-[20px] font-extrabold leading-snug">{step.message}</p>
              {step.message === NO_MODEL && <p className="mt-1.5 text-[14px] text-ink-2">We never guess a model, so nothing was saved.</p>}
            </div>
            <button type="button" onClick={() => (step.retryId ? tryAgain(step.kind, step.retryId) : setStep({ s: 'capture', kind: step.kind }))} className="mt-4 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 text-[17px] font-bold text-cream"><CameraIcon size={20} /> Try again</button>
            <button type="button" onClick={closeScan} className="mx-auto mt-2 flex min-h-[44px] items-center px-3 text-[15px] font-bold text-ink underline decoration-2 underline-offset-4">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

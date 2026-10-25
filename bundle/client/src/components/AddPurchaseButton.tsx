import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useLocation } from 'wouter';
import { api } from '@/lib/bundle';
import { checkPickedFile, preparePhoto, sendPhoto, type PhotoReadResponse } from '@/lib/photoPrep';
import { cn } from '@/lib/utils';

type Kind = 'item' | 'receipt';
type State =
  | { phase: 'idle' }
  | { phase: 'reading' }
  | { phase: 'done'; message: string; added: boolean }
  | { phase: 'problem'; message: string };

export interface PhotoDeps {
  prepare: typeof preparePhoto;
  send: typeof sendPhoto;
  startRun: typeof api.startRun;
}
const REAL_DEPS: PhotoDeps = { prepare: preparePhoto, send: sendPhoto, startRun: api.startRun };

const MAX_NAMES = 3;

/** Words for what the server read: how many rows were really saved (`stored`), not just how many it saw. */
export function describeReading(res: PhotoReadResponse): { message: string; added: boolean } | { problem: string } {
  if (res.status !== 'ok') return { problem: res.message };
  const names = res.items.map((i) => (typeof i.productName === 'string' ? i.productName : '')).filter(Boolean);
  const shown = names.slice(0, MAX_NAMES).join(', ') + (names.length > MAX_NAMES ? `, and ${names.length - MAX_NAMES} more` : '');
  const stored = typeof res.stored === 'number' ? res.stored : res.items.length;
  if (res.items.length === 0) return { problem: 'We could not find an item in that photo. Try a clearer one, with the label in view.' };
  if (stored === 0) return { message: `We already had ${shown || 'that'}, so nothing new was added.`, added: false };
  return { message: `Added ${stored === 1 ? '1 item' : `${stored} items`}${shown ? `: ${shown}` : ''}.`, added: true };
}

/**
 * The "+" at the top of every Version B tab. It opens "Take a photo": the phone redraws the picture first (hidden
 * location and phone details are dropped), then the server reads the product details and saves only those.
 */
export default function AddPurchaseButton({ familyId, deps = REAL_DEPS }: { familyId: string; deps?: PhotoDeps }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('item');
  const [state, setState] = useState<State>({ phase: 'idle' });
  const [, navigate] = useLocation();
  const opener = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function close() {
    setOpen(false);
    setState({ phase: 'idle' });
    opener.current?.focus();
  }

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // so choosing the same photo again still fires
    if (!file) return;
    const bad = checkPickedFile(file);
    if (bad) { setState({ phase: 'problem', message: bad }); return; }
    setState({ phase: 'reading' });
    try {
      const prepared = await deps.prepare(file);
      const res = await deps.send({ familyId, kind, mimeType: prepared.mimeType, imageBase64: prepared.imageBase64 });
      const out = describeReading(res);
      setState('problem' in out ? { phase: 'problem', message: out.problem } : { phase: 'done', message: out.message, added: out.added });
    } catch (err) {
      setState({ phase: 'problem', message: (err as Error).message || 'Could not read that photo. Please try again.' });
    }
  }

  async function checkAgain() {
    setState({ phase: 'reading' });
    try {
      const { runId } = await deps.startRun({ familyId });
      close();
      navigate(`/feed/${encodeURIComponent(runId)}`);
    } catch (err) {
      setState({ phase: 'problem', message: (err as Error).message || 'Could not start a new check. Please try again.' });
    }
  }

  const busy = state.phase === 'reading';

  return (
    <>
      <button
        ref={opener}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Add a purchase: take a photo"
        aria-haspopup="dialog"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-coral text-cream shadow-sm transition active:scale-95"
      >
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="photo-title" className="w-full max-w-[480px] rounded-t-3xl bg-cream px-5 pb-8 pt-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h2 id="photo-title" className="text-[22px] font-extrabold tracking-[-0.02em]">Take a photo</h2>
              <button type="button" onClick={close} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full text-[22px] text-ink-2">×</button>
            </div>
            <p className="mt-1 text-[15px] leading-relaxed text-ink-2">
              Snap a baby item (the label or barcode in view) or a receipt. Bundle checks it for recalls and money back. The photo itself is never saved, only the product details.
            </p>

            <div role="group" aria-label="What is in the photo" className="mt-4 grid grid-cols-2 gap-2">
              {(['item', 'receipt'] as const).map((k) => (
                <button
                  key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
                  className={cn('min-h-[48px] rounded-2xl border-2 px-3 text-[15px] font-bold', kind === k ? 'border-ink bg-ink text-cream' : 'border-line bg-paper text-ink')}
                >
                  {k === 'item' ? 'An item' : 'A receipt'}
                </button>
              ))}
            </div>

            <label className={cn('mt-4 flex min-h-[56px] cursor-pointer items-center justify-center rounded-2xl bg-coral px-4 text-[17px] font-bold text-cream', busy && 'pointer-events-none opacity-60')}>
              {busy ? 'Reading your photo…' : 'Take or choose a photo'}
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={onPick} disabled={busy} aria-label="Take or choose a photo" />
            </label>

            <div aria-live="polite" className="mt-3">
              {state.phase === 'done' && (
                <div className="rounded-2xl border border-line bg-paper px-4 py-3 text-[15px] font-semibold text-ink" data-testid="photo-result">
                  <p>{state.message}</p>
                  {state.added && (
                    <button type="button" onClick={checkAgain} className="mt-2 min-h-[44px] w-full rounded-xl bg-ink px-3 text-[15px] font-bold text-cream">Check my new items</button>
                  )}
                </div>
              )}
              {state.phase === 'problem' && (
                <p role="alert" className="rounded-2xl bg-[#FBE3E0] px-4 py-3 text-[15px] font-semibold text-[#9E2A21]" data-testid="photo-problem">{state.message}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { useId, useRef, useState, type ChangeEvent } from 'react';
import { useFreezeSpot } from '@/lib/scrollSpot';
import type { AuditReply } from '@shared/offers';
import { checkPickedFile, preparePhoto } from '@/lib/photoPrep';
import { sendAudit, verdictLabel } from '@/lib/offers';
import { cn } from '@/lib/utils';

type Source = 'paste' | 'screenshot';
type Phase = { kind: 'form' } | { kind: 'sending' } | { kind: 'done'; reply: AuditReply; store: string; offer: string } | { kind: 'problem'; message: string };

const pill: Record<AuditReply['verdict'], string> = {
  approve: 'bg-[#E3F3EA] text-[#17643F]',
  approve_with_catch: 'bg-[#FBEBCB] text-[#7A5410]',
  reject: 'bg-[#FBE3E0] text-[#9E2A21]',
};

const inputClass = 'mt-1.5 min-h-[48px] w-full rounded-2xl border border-line bg-paper px-4 text-[16px] text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-ink/30';

/** The words under the verdict: saved for other parents, or shown to this parent only (R2). */
function SharedLine({ reply }: { reply: AuditReply }) {
  if (reply.saved && reply.repeat) {
    return <p className="mt-4 text-[14.5px] font-semibold leading-snug text-[#17643F]">✓ Another parent already checked this offer, so you got its saved verdict at once.</p>;
  }
  if (reply.saved) {
    const n = reply.sharedFromParents;
    return (
      <>
        <p className="mt-4 text-[14.5px] font-semibold leading-snug text-[#17643F]">✓ Added to the shared list. The next parent checking this offer gets this verdict instantly.</p>
        <p data-testid="audit-thanks" className="mt-2 rounded-2xl bg-[#E3F3EA] px-3.5 py-3 text-[14.5px] font-semibold leading-snug text-[#17643F]">
          Thanks. You’re helping other parents{typeof n === 'number' ? `: ${n} offer${n === 1 ? '' : 's'} on the shared list came from parents.` : '.'}
        </p>
      </>
    );
  }
  return <p className="mt-4 text-[14.5px] font-semibold leading-snug text-ink-2">Shown to you only; not added to the shared list.</p>;
}

function Verdict({ reply, store, offer }: { reply: AuditReply; store: string; offer: string }) {
  return (
    <section role="status" aria-live="polite" aria-label="Verdict" className="mt-5 rounded-2xl border border-line bg-paper p-4" data-testid="audit-verdict">
      <p className="eyebrow text-ink-2">Verdict</p>
      <p className="mt-2"><span className={cn('inline-flex rounded-full px-3 py-1 text-[15px] font-extrabold', pill[reply.verdict])}>{verdictLabel[reply.verdict]}</span></p>
      <p className="mt-3 text-[17px] font-extrabold leading-snug text-ink">{store}’s “{offer}”</p>
      <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{reply.summary}</p>
      {reply.hunter && (
        <div className="mt-3 rounded-xl bg-cream p-3">
          <p className="eyebrow text-[#17643F]">Deal Hunter</p>
          <p className="mt-1 text-[14.5px] leading-snug text-ink">{reply.hunter}</p>
        </div>
      )}
      {reply.lawyer && (
        <div className="mt-2 rounded-xl bg-cream p-3">
          <p className="eyebrow text-coral-deep">Fine-Print Lawyer</p>
          <p className="mt-1 text-[14.5px] leading-snug text-ink">{reply.lawyer}</p>
        </div>
      )}
      <SharedLine reply={reply} />
      {reply.mode === 'quick' && !reply.injection && (
        <p className="mt-3 rounded-xl bg-cream px-3 py-2.5 text-[13.5px] leading-snug text-ink-2">Quick check. The full AI review runs in live mode.</p>
      )}
    </section>
  );
}

/**
 * "Audit a deal": who is offering it, what you get, an optional link, and the fine print as pasted text or a screenshot.
 * The verdict names the store you typed. Nothing is invented on this screen: it shows what the server's court answered.
 */
export default function AuditDeal({ onBack, onSaved }: { onBack: () => void; onSaved?: () => void }) {
  useFreezeSpot();
  const ids = { store: useId(), offer: useId(), link: useId(), text: useId(), file: useId() };
  const [store, setStore] = useState('');
  const [offer, setOffer] = useState('');
  const [link, setLink] = useState('');
  const [source, setSource] = useState<Source>('paste');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'form' });
  const fileRef = useRef<HTMLInputElement>(null);

  const ready = store.trim() && offer.trim() && (source === 'paste' ? text.trim() : file) && phase.kind !== 'sending';

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    const bad = f ? checkPickedFile(f) : null;
    setFileProblem(bad); setFile(bad ? null : f);
  };

  const submit = async () => {
    setPhase({ kind: 'sending' });
    try {
      const base = { store: store.trim(), offer: offer.trim(), ...(link.trim() ? { link: link.trim() } : {}) };
      const body = source === 'paste'
        ? { ...base, text: text.trim() }
        : { ...base, ...(await preparePhoto(file as File)) };
      const reply = await sendAudit(body);
      setPhase({ kind: 'done', reply, store: base.store, offer: base.offer });
      if (reply.saved && !reply.repeat) onSaved?.();
    } catch (e) {
      setPhase({ kind: 'problem', message: e instanceof Error ? e.message : 'We could not check that deal just now. Please try again.' });
    }
  };

  const tab = (id: Source, label: string) => (
    <button
      type="button" role="tab" aria-selected={source === id} onClick={() => setSource(id)}
      className={cn('min-h-[44px] flex-1 rounded-xl px-3 text-[15px] font-bold', source === id ? 'bg-paper text-ink shadow-sm' : 'text-ink-2')}
    >{label}</button>
  );

  return (
    <section aria-label="Audit a deal" className="mt-4" data-testid="audit-deal">
      <button type="button" onClick={onBack} className="inline-flex min-h-[44px] items-center gap-1 text-[15px] font-bold text-ink">
        <span aria-hidden="true">‹</span> Back
      </button>
      <h1 className="mt-1 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em]">Audit a deal</h1>
      <p className="mt-2 text-[16px] leading-relaxed text-ink-2">Tell us about the offer. We’ll read the fine print for hidden catches. When both sides of our court agree, the verdict goes on a shared list for other parents.</p>

      <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); if (ready) void submit(); }}>
        <div>
          <label htmlFor={ids.store} className="text-[15px] font-extrabold text-ink">Who’s offering it?</label>
          <input id={ids.store} className={inputClass} value={store} maxLength={80} onChange={(e) => setStore(e.target.value)} placeholder="Store or brand" autoComplete="off" />
        </div>
        <div>
          <label htmlFor={ids.offer} className="text-[15px] font-extrabold text-ink">What do you get?</label>
          <input id={ids.offer} className={inputClass} value={offer} maxLength={200} onChange={(e) => setOffer(e.target.value)} placeholder="For example: a free welcome box" autoComplete="off" />
        </div>
        <div>
          <label htmlFor={ids.link} className="text-[15px] font-extrabold text-ink">Link <span className="font-medium text-ink-2">(optional)</span></label>
          <input id={ids.link} type="url" inputMode="url" className={inputClass} value={link} maxLength={300} onChange={(e) => setLink(e.target.value)} placeholder="https://" autoComplete="off" />
        </div>
        <div>
          <p className="text-[15px] font-extrabold text-ink" id={`${ids.text}-h`}>Fine print</p>
          <div role="tablist" aria-labelledby={`${ids.text}-h`} className="mt-1.5 flex gap-1 rounded-2xl bg-[#F1ECE4] p-1">
            {tab('paste', 'Paste the text')}
            {tab('screenshot', 'Add a screenshot')}
          </div>
          {source === 'paste' ? (
            <textarea
              aria-label="Fine print" rows={5} value={text} maxLength={8000} onChange={(e) => setText(e.target.value)}
              placeholder="Paste the terms exactly as the offer shows them."
              className="mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-[16px] leading-snug text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-ink/30"
            />
          ) : (
            <div className="mt-2">
              <label htmlFor={ids.file} className="text-[14px] font-semibold text-ink-2">Add a screenshot of the fine print</label>
              <input
                ref={fileRef} id={ids.file} type="file" accept="image/*" onChange={pick}
                className="mt-1.5 block w-full text-[15px] text-ink file:mr-3 file:min-h-[44px] file:rounded-xl file:border file:border-line file:bg-paper file:px-4 file:font-bold file:text-ink"
              />
              {file && <p className="mt-1 text-[13.5px] text-ink-2">Chosen: {file.name}</p>}
              {fileProblem && <p className="mt-1 text-[14px] font-semibold text-[#9E2A21]">{fileProblem}</p>}
              <p className="mt-1 text-[13px] leading-snug text-ink-2">We read the words in the picture, then check them like pasted text. The picture itself is not kept.</p>
            </div>
          )}
        </div>
        <button
          type="submit" disabled={!ready}
          className="inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-ink px-4 text-[16px] font-extrabold text-cream disabled:opacity-40"
        >
          {phase.kind === 'sending' ? 'Reading the fine print…' : 'Check this deal'}
        </button>
      </form>

      {phase.kind === 'problem' && <p className="mt-4 rounded-2xl border border-[#F2B9B3] bg-[#FDF1EF] px-4 py-3 text-[15px] font-semibold text-[#9E2A21]">{phase.message}</p>}
      {phase.kind === 'done' && <Verdict reply={phase.reply} store={phase.store} offer={phase.offer} />}
    </section>
  );
}

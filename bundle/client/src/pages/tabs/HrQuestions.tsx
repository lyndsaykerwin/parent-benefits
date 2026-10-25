import { useState } from 'react';
import { questionsToAsk } from '@shared/eligibility';
import { taxYearFor } from '@/lib/insurance';
import type { SavedRun } from '@/lib/bundle';

const button = 'flex min-h-[52px] flex-1 items-center justify-center rounded-2xl px-4 text-[16px] font-bold transition active:scale-[.99]';

/** "Questions to ask HR" (or "for your tax preparer"): built from the work and insurance answers, with Copy and Email to myself. Bundle sends nothing. */
export default function HrQuestions({ run, onBack }: { run: SavedRun; onBack: () => void }) {
  const f = run.family;
  const list = questionsToAsk({ household: f?.household, parent1Work: f?.parent1Work, parent2Work: f?.parent2Work, insurance: f?.insurance }, taxYearFor(f, run.today ?? ''));
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [note, setNote] = useState<string | null>(null);
  const text = list.items.map((q, i) => `${i + 1}. ${q}`).join('\n');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setNote(`Copied ${list.items.length} questions.`);
    } catch {
      setNote('Couldn’t copy. Press and hold the questions to copy them.');
    }
  }

  async function email() {
    // The phone's own share menu (or the computer's mail program) does the sending, so Bundle never sees the questions go anywhere.
    try {
      if (navigator.share) { await navigator.share({ title: list.title, text }); return; }
    } catch { /* closed the share menu: nothing to do */ return; }
    window.location.href = `mailto:?subject=${encodeURIComponent(list.title)}&body=${encodeURIComponent(text)}`;
  }

  return (
    <section data-testid="hr-questions" aria-label={list.title}>
      <button type="button" onClick={onBack} className="-ml-1 mt-4 inline-flex min-h-[44px] items-center gap-1 text-[16px] font-bold text-ink">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        Back
      </button>
      <h1 className="mt-1 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em]">{list.title}</h1>
      <p className="mt-2 text-[16px] leading-relaxed text-ink-2">Built from your answers. Tick them off as you ask.</p>
      <ul className="bundle-card mt-4 divide-y divide-line p-2">
        {list.items.map((q, i) => (
          <li key={q}>
            <label className="flex min-h-[48px] cursor-pointer items-start gap-3 px-2 py-3 text-[16px] leading-snug">
              <input type="checkbox" checked={!!done[i]} onChange={() => setDone((d) => ({ ...d, [i]: !d[i] }))} className="mt-0.5 h-5 w-5 shrink-0 accent-[#E4572E]" />
              <span className={done[i] ? 'text-ink-2 line-through' : ''}>{q}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex gap-3">
        <button type="button" onClick={copy} className={`${button} bg-ink text-cream`}>Copy</button>
        <button type="button" onClick={email} className={`${button} border border-line bg-paper text-ink`}>Email to myself</button>
      </div>
      <p role="status" className="mt-3 min-h-[24px] text-[14px] font-semibold text-ink-2">{note}</p>
    </section>
  );
}

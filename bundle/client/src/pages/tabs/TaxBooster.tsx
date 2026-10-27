import { useEffect, useState } from 'react';
import type { FeedCard } from '@shared/bundle';
import { earners } from '@shared/eligibility';
import { fmtUsdShort } from '@/lib/bundle';
import { taxYearFor } from '@/lib/insurance';
import { sendToSelf, startNote } from '@/lib/sendToSelf';
import type { TabProps } from './shared';

export type Filing = 'joint' | 'single' | 'hoh' | 'unsure';
const CHOICES: { id: Filing; label: string }[] = [
  { id: 'joint', label: 'Married filing together' },
  { id: 'single', label: 'Single' },
  { id: 'hoh', label: 'Head of household' },
  { id: 'unsure', label: 'Not sure' },
];
const filingLabel = (f: Filing) => CHOICES.find((c) => c.id === f)!.label;

const filingKey = (familyId: string) => `bundle:filing:${familyId}`;
const skipKey = (familyId: string) => `bundle:filing-skipped:${familyId}`;
function load(familyId: string): { filing: Filing | null; skipped: boolean } {
  try {
    const f = localStorage.getItem(filingKey(familyId));
    return { filing: CHOICES.some((c) => c.id === f) ? (f as Filing) : null, skipped: localStorage.getItem(skipKey(familyId)) === '1' };
  } catch { return { filing: null, skipped: false }; }
}
function save(familyId: string, filing: Filing | null, skipped: boolean) {
  try {
    if (filing) localStorage.setItem(filingKey(familyId), filing); else localStorage.removeItem(filingKey(familyId));
    if (skipped) localStorage.setItem(skipKey(familyId), '1'); else localStorage.removeItem(skipKey(familyId));
  } catch { /* the answer lasts until the page closes */ }
}

/** The number counts up to its new value (a short count-up); with "reduce motion" on, it just shows the number. */
function useCountUp(target: number, from: number, run: boolean): number {
  const [v, setV] = useState(run ? from : target);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!run || reduce || typeof requestAnimationFrame !== 'function') { setV(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 700);
      setV(Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, from, run]);
  return v;
}

const isMa = (props: TabProps) => props.run.family?.state === 'MA' || props.cards.some((c) => /^benefit-ma_/.test(c.id));

/** What the 529 line says for each filing answer. Massachusetts lets you deduct up to $1,000 (single) or $2,000 (together). */
export const five29Line = (filing: Filing | null): string =>
  filing === 'joint' ? '$2,000 (filing together)' : filing === 'single' || filing === 'hoh' ? '$1,000 (filing single)' : '$1,000 single / $2,000 together';

/** The filing-status answer for this family, kept in this browser. One place, so the booster and the 529 line always agree. */
export function useFiling(familyId: string) {
  const [state, setState] = useState(() => load(familyId));
  const set = (f: Filing | null, s: boolean) => { setState({ filing: f, skipped: s }); save(familyId, f, s); };
  return { ...state, set };
}
export type FilingState = ReturnType<typeof useFiling>;

/** The filing-status booster at the top of Taxes: the money first (as a range), one tap to make it exact. */
export function FilingBooster({ props, credits, status }: { props: TabProps; credits: FeedCard[]; status: FilingState }) {
  const { filing, skipped, set } = status;

  const federal = credits.filter((c) => /^benefit-federal_/.test(c.id)).reduce((a, c) => a + (c.amountCents ?? 0), 0);
  const all = credits.reduce((a, c) => a + (c.amountCents ?? 0), 0);
  const exact = filing && filing !== 'unsure';
  const [animate, setAnimate] = useState(false);
  const shown = useCountUp(exact ? all : federal, federal, !!exact && animate);
  const [note, setNote] = useState<string | null>(null);
  const lines = credits.map((c) => `${c.title.replace(/\s*\(after birth\)$/, '')} ${fmtUsdShort(c.amountCents ?? 0)}`);
  const year = taxYearFor(props.run.family, props.run.today ?? '');

  // Nothing to narrow: with no range there is no reason to ask.
  if (credits.length === 0 || federal === all) return null;

  const shareText = `Our baby’s tax credits for the ${year} tax year: ${lines.join(' + ')} = ${fmtUsdShort(all)}. Worth confirming with our tax preparer.`;
  async function share() {
    setNote(startNote({ title: 'Baby tax credits', text: shareText }));
    const r = await sendToSelf({ title: 'Baby tax credits', text: shareText });
    setNote(r.message);
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(shareText);
      setNote('Copied. Paste it into a message or email.');
    } catch {
      setNote('Couldn’t copy. Press and hold the numbers above to copy them.');
    }
  }

  if (skipped && !filing) {
    return (
      <button type="button" data-testid="booster-taxes-chip" onClick={() => set(null, false)} className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-line bg-paper px-4 text-[14px] font-bold text-ink">
        <span aria-hidden="true">+</span> Make my tax number exact
      </button>
    );
  }

  if (filing) {
    return (
      <section aria-label="Your tax credits" data-testid="booster-taxes-result" className="bundle-card mt-4 border-[1.5px] border-[#F5C4B0] bg-gradient-to-br from-[#FFF4EC] to-white p-4">
        <p className="eyebrow text-coral-deep">Your tax credits</p>
        <p data-testid="booster-amount" className="tabular mt-1.5 text-[44px] font-extrabold leading-none tracking-[-0.03em]">{exact ? fmtUsdShort(shown) : `${fmtUsdShort(federal)}–${fmtUsdShort(all)}`}</p>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">
          {exact
            ? <>Now exact for “{filingLabel(filing)}”: {lines.join(' + ')}. Your income can lower these, so your tax preparer has the final say.</>
            : 'No problem. We’ll keep the range; your tax preparer can confirm.'}
        </p>
        <button type="button" onClick={share} className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-line bg-paper px-4 text-center text-[15px] font-bold text-ink">Send these to your partner or tax preparer</button>
        <button type="button" onClick={copy} className="mt-2 flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-line bg-paper px-4 text-center text-[15px] font-bold text-ink">Copy</button>
        <p role="status" className="min-h-[20px] text-[13px] font-semibold text-ink-2">{note}</p>
        <button type="button" onClick={() => { setAnimate(false); set(null, false); }} className="min-h-[44px] text-[14px] font-bold text-ink-2 underline decoration-line decoration-2 underline-offset-4">Change my answer</button>
      </section>
    );
  }

  return (
    <section aria-label="Make your tax number exact" data-testid="booster-taxes" className="bundle-card mt-4 border-[1.5px] border-[#F5C4B0] bg-gradient-to-br from-[#FFF4EC] to-white p-4">
      <p className="eyebrow text-coral-deep">Your tax credits</p>
      <p className="tabular mt-1.5 text-[36px] font-extrabold leading-none tracking-[-0.03em]">{fmtUsdShort(federal)}–{fmtUsdShort(all)}</p>
      <p className="mt-2 text-[16px] font-extrabold">One tap makes it exact →</p>
      <p className="mt-2.5 text-[14px] text-ink-2">How will you file taxes this year?</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="How will you file taxes this year?">
        {CHOICES.map((c) => (
          <button key={c.id} type="button" aria-pressed="false" onClick={() => { setAnimate(true); set(c.id, false); }} className="min-h-[44px] rounded-full border border-line bg-paper px-4 text-[15px] font-bold text-ink transition active:scale-[.98]">{c.label}</button>
        ))}
      </div>
      <p className="mt-2 text-[13px] text-ink-2">Head of household = single parent who pays most home costs.</p>
      <button type="button" onClick={() => set(null, true)} className="mt-1 min-h-[44px] text-[14px] font-bold text-ink-2 underline decoration-line decoration-2 underline-offset-4">Not now</button>
    </section>
  );
}

/** The Massachusetts 529 deduction line (MA families only). It sits on Savings; the filing answer comes from useFiling, so it always agrees with the Taxes booster. */
export function Five29Card({ props }: { props: TabProps }) {
  const { filing } = useFiling(props.run.familyId);
  if (!isMa(props)) return null;
  return (
    <article aria-label="529 college savings (MA)" data-testid="card-529" className="bundle-card mt-3 p-4">
      <p className="eyebrow text-ink-2">529 college savings (MA)</p>
      <h3 className="mt-1.5 text-[17px] font-extrabold leading-snug tracking-[-0.01em]">State tax deduction: {five29Line(filing)}</h3>
      <p className="mt-1 text-[15px] leading-relaxed text-ink-2">A 529 is a savings account for school with tax breaks. Massachusetts lets you deduct what you put in, up to this amount.</p>
      <a href="https://www.savingforcollege.com/article/tax-benefits-of-massachusetts-529-plans" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-[32px] items-center rounded-full border border-line bg-cream px-3 text-[13px] font-semibold text-ink-2 underline-offset-2 hover:underline">Savingforcollege.com: MA 529 tax benefits</a>
    </article>
  );
}

/** The paycheck-form (W-4) tip, at the bottom of Taxes. */
export function TaxExtras({ props }: { props: TabProps }) {
  const f = props.run.family;
  const someonePaid = (() => { const e = earners({ household: f?.household, parent1Work: f?.parent1Work, parent2Work: f?.parent2Work }); return !e || e.includes('paycheck'); })();
  if (!someonePaid) return null;
  return (
    <article aria-label="Update your paycheck tax form (W-4)" data-testid="card-w4" className="bundle-card mt-3 p-4">
      <p className="eyebrow text-ink-2">For your tax preparer</p>
      <h3 className="mt-1.5 text-[17px] font-extrabold leading-snug tracking-[-0.01em]">Update your paycheck tax form (W-4)</h3>
      <p className="mt-1 text-[15px] leading-relaxed text-ink-2">The W-4 tells your employer how much tax to take from each paycheck.</p>
      <p className="mt-2 rounded-xl bg-cream px-3 py-2 text-[14px] text-ink-2">Add your baby in Step 3 (dependents) so less tax is taken from each paycheck.</p>
    </article>
  );
}

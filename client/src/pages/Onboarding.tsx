import { useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import AppShell from '@/components/AppShell';
import { api, localToday, type RunRequest } from '@/lib/bundle';

const field = 'block rounded-2xl border border-line bg-paper px-4 pb-3 pt-2.5 focus-within:border-coral focus-within:ring-2 focus-within:ring-coral/25';
const label = 'eyebrow block text-ink-2';
const input = 'mt-1 block w-full bg-transparent text-[18px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-ink-2';

export default function Onboarding() {
  const [, navigate] = useLocation();
  const [date, setDate] = useState('');
  const [zip, setZip] = useState('');
  const [employer, setEmployer] = useState('');
  const [busy, setBusy] = useState<'form' | 'guest' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [soon, setSoon] = useState<string | null>(null);

  async function start(body: RunRequest, who: 'form' | 'guest') {
    setBusy(who);
    setError(null);
    try {
      const { runId } = await api.startRun(body);
      navigate(`/feed/${encodeURIComponent(runId)}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!date) return setError('Enter your due date or your baby’s birth date.');
    if (!/^\d{5}$/.test(zip)) return setError('Enter a valid US ZIP code');
    // A date on or before today is a birth date; a future date is a due date.
    const dates = date <= localToday() ? { birthDate: date } : { dueDate: date };
    void start({ zip, employer: employer.trim(), ...dates }, 'form');
  }

  const comingSoon = (what: string) =>
    setSoon(`${what} is coming soon. Tap “Try as guest” to see a sample family whose card and Amazon orders are already connected.`);

  return (
    <AppShell>
      <h1 className="mt-6 text-[32px] font-extrabold leading-[1.08] tracking-[-0.03em]">
        Let’s find what your family is <span className="text-coral">owed.</span>
      </h1>
      <p className="mt-2 text-[16px] text-ink-2">Three answers. About 30 seconds. No sign‑up.</p>

      <form className="mt-6 space-y-3" onSubmit={onSubmit} noValidate>
        <label className={field}>
          <span className={label}>Due date or birth date</span>
          <input className={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-describedby="date-help" />
        </label>
        <p id="date-help" className="sr-only">A past date counts as a birth date, a future date as a due date.</p>
        <label className={field}>
          <span className={label}>ZIP code</span>
          <input
            className={input} inputMode="numeric" autoComplete="postal-code" maxLength={5} placeholder="02139"
            value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
          />
        </label>
        <label className={field}>
          <span className={label}>Employer <span className="normal-case tracking-normal text-ink-2">(optional)</span></span>
          <input className={input} autoComplete="organization" placeholder="Where you or your partner work" value={employer} onChange={(e) => setEmployer(e.target.value)} maxLength={100} />
        </label>

        {error && (
          <p role="alert" className="rounded-2xl bg-[#FBE3E0] px-4 py-3 text-[15px] font-semibold text-[#9E2A21]">{error}</p>
        )}

        <button
          type="submit" disabled={busy !== null}
          className="mt-1 flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-ink px-4 text-[17px] font-bold text-cream transition active:scale-[.99] disabled:opacity-60"
        >
          {busy === 'form' ? 'Starting…' : 'Find what we’re owed'}
        </button>
      </form>

      <button
        type="button" disabled={busy !== null} onClick={() => start({ familyId: 'maya' }, 'guest')}
        className="mt-3 flex min-h-[64px] w-full flex-col items-center justify-center rounded-2xl border border-[#F5C4B0] bg-coral-tint px-4 py-2 transition active:scale-[.99] disabled:opacity-60"
      >
        <span className="text-[17px] font-bold text-coral-deep">{busy === 'guest' ? 'Starting…' : 'Try as guest'}</span>
        <span className="text-[14px] font-medium text-coral-deep">Explore a sample family. No sign‑up.</span>
      </button>

      <div className="mt-4 text-center">
        <p className="text-[14px] text-ink-2">Optional: add your data for more matches</p>
        <div className="mt-1 flex justify-center gap-2">
          <button type="button" onClick={() => comingSoon('Connecting a card')} className="min-h-[44px] rounded-full px-3 text-[15px] font-bold text-ink underline decoration-line decoration-2 underline-offset-4">
            Connect a card
          </button>
          <button type="button" onClick={() => comingSoon('Uploading Amazon orders')} className="min-h-[44px] rounded-full px-3 text-[15px] font-bold text-ink underline decoration-line decoration-2 underline-offset-4">
            Upload Amazon orders
          </button>
        </div>
        {soon && <p role="status" className="mx-auto mt-2 max-w-[340px] rounded-2xl bg-paper px-4 py-3 text-[14px] text-ink-2">{soon}</p>}
      </div>

      <p className="mt-8 text-center text-[13px] text-ink-2">
        Bundle finds and prepares. You decide. Sample families use made-up data.
      </p>
    </AppShell>
  );
}

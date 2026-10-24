import { useState, type FormEvent, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { api, localToday, type RunRequest } from '@/lib/bundle';
import { dateLimits, dateRangeError } from '@shared/dateRange';
import { babyAgeLine, stateForZip, zipMessage } from '@/lib/onboarding';

/** Top row of Lyndsay's mocks (Main → Date → ZIP), then the Checking screen (/feed/:runId). Work screen is cut. */
type Stage = 'expecting' | 'born';
type Step = 1 | 2 | 3;

const PROGRESS: Record<Step, { label: string; pct: number }> = {
  1: { label: '1 of 3', pct: 33 },
  2: { label: '2 of 3', pct: 66 },
  3: { label: 'Last one', pct: 90 },
};

const primary = 'flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-ink px-4 text-[17px] font-bold text-cream transition active:scale-[.99] disabled:opacity-60';
const fieldBox = 'mt-7 block rounded-2xl border-2 border-line bg-paper px-4 pb-3 pt-2.5 focus-within:border-coral';
const fieldLabel = 'block text-[12px] font-bold uppercase tracking-[.12em] text-ink-2';
const fieldInput = 'mt-0.5 block w-full bg-transparent text-[24px] font-extrabold tracking-[.02em] text-ink outline-none placeholder:font-semibold placeholder:text-line';

function Frame({ step, onBack, children }: { step: Step; onBack?: () => void; children: ReactNode }) {
  const p = PROGRESS[step];
  return (
    <div className="min-h-[100dvh] bg-cream text-ink">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col px-5 pb-7 pt-5">
        <header className="flex h-11 items-center gap-3">
          {onBack ? (
            <button type="button" onClick={onBack} aria-label="Back" className="-ml-2.5 flex h-11 w-11 items-center justify-center text-ink">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
          ) : (
            <span className="text-[26px] font-extrabold tracking-[-0.03em]">bundle<span className="text-coral">.</span></span>
          )}
          <div className={`h-1.5 flex-grow overflow-hidden rounded-full bg-line ${onBack ? '' : 'ml-3'}`} role="progressbar" aria-label="Setup progress" aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-coral" style={{ width: `${p.pct}%` }} />
          </div>
          <span className="text-[13px] font-bold text-ink-2">{p.label}</span>
        </header>
        <main className="flex flex-grow flex-col">{children}</main>
      </div>
    </div>
  );
}

function Alert({ text }: { text: string | null }) {
  if (!text) return null;
  return <p role="alert" className="mt-4 rounded-2xl bg-[#FBE3E0] px-4 py-3 text-[15px] font-semibold text-[#9E2A21]">{text}</p>;
}

const ClockIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
const HeartIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" /></svg>
);

function Choice({ title, sub, icon, onClick }: { title: string; sub: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      className="flex min-h-[172px] flex-col gap-2.5 rounded-3xl border border-line bg-paper p-[18px] text-left shadow-[0_1px_2px_rgba(27,23,20,.04),0_12px_32px_rgba(27,23,20,.06)] transition active:scale-[.99]"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-coral-tint text-coral-deep">{icon}</span>
      <span className="text-[19px] font-extrabold tracking-[-0.01em]">{title}</span>
      <span className="text-[14px] leading-[1.35] text-ink-2">{sub}</span>
    </button>
  );
}

export default function Onboarding() {
  const [, navigate] = useLocation();
  const today = localToday();
  const limits = dateLimits(today);
  const [step, setStep] = useState<Step>(1);
  const [stage, setStage] = useState<Stage>('born');
  const [date, setDate] = useState('');
  const [zip, setZip] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = (s: Step) => { setError(null); setStep(s); };

  async function start(body: RunRequest) {
    setBusy(true);
    setError(null);
    try {
      const { runId } = await api.startRun(body);
      navigate(`/feed/${encodeURIComponent(runId)}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  function onDate(e: FormEvent) {
    e.preventDefault();
    if (!date) return setError(stage === 'expecting' ? 'Enter your due date. Your doctor’s estimate is fine.' : 'Enter your baby’s birth date.');
    const rangeError = dateRangeError(stage === 'expecting' ? 'due' : 'birth', date, today);
    if (rangeError) return setError(rangeError);
    go(3);
  }

  function onZip(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{5}$/.test(zip) || !stateForZip(zip)) return setError('Enter a valid 5-digit US ZIP code.');
    void start(stage === 'expecting' ? { zip, dueDate: date } : { zip, birthDate: date });
  }

  if (step === 1) {
    return (
      <Frame step={1}>
        <h1 className="mt-9 text-[36px] font-extrabold leading-[1.06] tracking-[-0.03em]">
          Let’s find what your family is <span className="text-coral">owed.</span>
        </h1>
        <p className="mt-3 text-[16px] leading-[1.45] text-ink-2">Cash, credits and free stuff, checked for you. About 30 seconds. No sign-up.</p>
        <p className="mb-3 mt-9 text-[20px] font-extrabold tracking-[-0.01em]">Where are you right now?</p>
        <div className="grid grid-cols-2 gap-3">
          <Choice title="We’re expecting" sub="Free registry boxes now, money once baby arrives" icon={<ClockIcon />} onClick={() => { setStage('expecting'); setDate(''); go(2); }} />
          <Choice title="Baby’s here" sub="Deadlines to catch, money to claim, savings on what you buy" icon={<HeartIcon />} onClick={() => { setStage('born'); setDate(''); go(2); }} />
        </div>
        <div className="min-h-8 flex-grow" />
        <Alert text={error} />
        <button
          type="button" disabled={busy} onClick={() => start({ familyId: 'maya' })}
          className="mt-3 flex min-h-[64px] w-full flex-col items-center justify-center rounded-2xl border border-[#F5C4B0] bg-coral-tint px-4 py-2 transition active:scale-[.99] disabled:opacity-60"
        >
          <span className="text-[17px] font-bold text-coral-deep">{busy ? 'Starting…' : 'Try a sample family'}</span>
          <span className="text-[14px] font-medium text-coral-deep">Made-up data. See a finished list in one tap.</span>
        </button>
        <p className="mt-4 text-center text-[13px] leading-[1.4] text-ink-2">We never ask for bank details to get started. Bundle finds and prepares. You decide.</p>
      </Frame>
    );
  }

  if (step === 2) {
    const expecting = stage === 'expecting';
    const age = expecting ? null : babyAgeLine(date, today);
    return (
      <Frame step={2} onBack={() => go(1)}>
        <form className="flex flex-grow flex-col" onSubmit={onDate} noValidate>
          <span className="mt-10 inline-flex w-fit rounded-full bg-coral-tint px-3 py-1 text-[13px] font-bold text-coral-deep">{expecting ? 'We’re expecting' : 'Baby’s here'}</span>
          <h1 className="mt-3 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em]">
            {expecting ? 'When’s your baby due?' : 'Congrats! What’s your baby’s birthday?'}
          </h1>
          <p className="mt-2.5 text-[16px] leading-[1.45] text-ink-2">
            {expecting
              ? 'The due date from your doctor is fine, and we update it when baby arrives.'
              : 'Some deadlines count from the day baby was born, so we need the exact date.'}
          </p>
          <label className={fieldBox}>
            <span className={fieldLabel}>{expecting ? 'Due date' : 'Birth date'}</span>
            <input
              className={fieldInput} type="date" value={date}
              min={expecting ? limits.dueMin : limits.birthMin} max={expecting ? limits.dueMax : today}
              onChange={(e) => { setDate(e.target.value); setError(null); }}
            />
          </label>
          {age && (
            <p className="mt-3 flex items-start gap-2 text-[15px] font-bold text-[#1E6B47]">
              <svg className="mt-0.5 shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
              <span>{age}</span>
            </p>
          )}
          <Alert text={error} />
          <div className="min-h-8 flex-grow" />
          <button type="submit" className={primary}>Next</button>
        </form>
      </Frame>
    );
  }

  const msg = zipMessage(zip);
  const covered = stateForZip(zip)?.covered;
  return (
    <Frame step={3} onBack={() => go(2)}>
      <form className="flex flex-grow flex-col" onSubmit={onZip} noValidate>
        <h1 className="mt-10 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em]">Where do you live?</h1>
        <p className="mt-2.5 text-[16px] leading-[1.45] text-ink-2">Every state has its own programs. Your ZIP code tells us which ones are yours.</p>
        <label className={fieldBox}>
          <span className={fieldLabel}>ZIP code</span>
          <input
            className={fieldInput} type="text" inputMode="numeric" autoComplete="postal-code" maxLength={5} placeholder="02139"
            value={zip} aria-describedby="zip-state"
            onChange={(e) => { setZip(e.target.value.replace(/\D/g, '').slice(0, 5)); setError(null); }}
          />
        </label>
        <p id="zip-state" aria-live="polite" className={`mt-3 flex items-start gap-2 text-[15px] font-bold ${covered ? 'text-[#1E6B47]' : 'text-ink-2'}`}>
          {msg && covered && (
            <svg className="mt-0.5 shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
          )}
          {msg && <span>{msg}</span>}
        </p>
        <Alert text={error} />
        <div className="min-h-8 flex-grow" />
        <button type="submit" disabled={busy} className={primary}>{busy ? 'Starting…' : 'Looks right'}</button>
      </form>
    </Frame>
  );
}

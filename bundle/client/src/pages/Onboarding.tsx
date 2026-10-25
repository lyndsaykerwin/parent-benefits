import { useState, type FormEvent, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { api, localToday, rememberFamilyId, type RunRequest } from '@/lib/bundle';
import { dateLimits, dateRangeError } from '@shared/dateRange';
import type { Household, InsuranceType, WorkStatus } from '@shared/bundle';
import { daycareRoute, insuranceChoices, type DaycareRoute } from '@shared/eligibility';
import { babyAgeLine, stateForZip, zipMessage, zipRejectedMessage } from '@/lib/onboarding';

/** Five questions (design/v2): stage, date, ZIP, who is raising the baby and how each parent earns, health insurance. Then the Checking screen (/feed/:runId). */
type Stage = 'expecting' | 'born';
type Step = 1 | 2 | 3 | 4 | 5;

const PROGRESS: Record<Step, { label: string; pct: number }> = {
  1: { label: '1 of 5', pct: 15 },
  2: { label: '2 of 5', pct: 35 },
  3: { label: '3 of 5', pct: 55 },
  4: { label: '4 of 5', pct: 75 },
  5: { label: '5 of 5', pct: 92 },
};

const HOUSEHOLDS: { id: Household; label: string }[] = [{ id: 'one', label: 'Just me' }, { id: 'two', label: 'Two of us' }];
const WORK: { id: WorkStatus; label: string; hint: string }[] = [
  { id: 'paycheck', label: 'Paycheck from a job', hint: 'taxes come out of your pay' },
  { id: 'self_employed', label: 'Self-employed or freelance', hint: 'you pay your own taxes' },
  { id: 'not_working', label: 'Not working right now', hint: 'staying home, studying or between jobs' },
];

/** The green line under the work rows: what the answer means for daycare, in plain words. */
const WORK_LINE: Record<DaycareRoute, string> = {
  dcfsa: 'You may be able to set aside up to $7,500 tax-free for daycare.',
  childcare_credit: 'The childcare tax credit can give back up to $1,500 (one child).',
  none: 'Daycare tax savings usually need earned income, so we’ll show other ways to save.',
  general: '',
};
/** The green line at the top of Q5: shows that the last answer shaped the result. */
const PAYOFF_LINE: Record<DaycareRoute, string> = {
  dcfsa: 'Got it — checking daycare tax savings for you.',
  childcare_credit: 'Got it — checking daycare tax savings for you.',
  none: 'Got it — we’ll show other ways to save on childcare.',
  general: 'No problem — we’ll show general daycare savings. Add this later for your exact number.',
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

const CheckIcon = () => (
  <svg className="mt-0.5 shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
);

function Payoff({ text }: { text: string }) {
  if (!text) return null;
  return <p role="status" className="mt-4 flex items-start gap-2 rounded-2xl bg-[#E3F3EA] px-3.5 py-2.5 text-[14px] font-bold text-[#17643F]"><CheckIcon /><span>{text}</span></p>;
}

/** The quiet links under a question: a way out ("prefer not to say") and a "Why we ask" line. */
function QuietLinks({ skipLabel, onSkip, why, disabled }: { skipLabel: string; onSkip: () => void; why: string; disabled?: boolean }) {
  return (
    <div className="mt-4 flex flex-col items-start gap-1">
      <button type="button" onClick={onSkip} disabled={disabled} className="min-h-[44px] text-[15px] font-bold text-ink-2 underline decoration-line decoration-2 underline-offset-4 disabled:opacity-60">{skipLabel}</button>
      <details className="min-h-[44px] text-[15px] text-ink-2">
        <summary className="inline-flex min-h-[44px] cursor-pointer items-center font-bold underline decoration-line decoration-2 underline-offset-4">Why we ask</summary>
        <p className="pb-1 leading-[1.45]">{why}</p>
      </details>
    </div>
  );
}

const optionBox = (on: boolean) => `w-full rounded-2xl border-2 px-4 py-3 text-left transition active:scale-[.99] disabled:opacity-60 ${on ? 'border-coral bg-coral-tint' : 'border-line bg-paper'}`;

function SampleButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button" disabled={busy} onClick={onClick}
      className="mt-3 flex min-h-[64px] w-full flex-col items-center justify-center rounded-2xl border border-[#F5C4B0] bg-coral-tint px-4 py-2 transition active:scale-[.99] disabled:opacity-60"
    >
      <span className="text-[17px] font-bold text-coral-deep">{busy ? 'Starting…' : 'Try a sample family'}</span>
      <span className="text-[14px] font-medium text-coral-deep">Made-up data. See a finished list in one tap.</span>
    </button>
  );
}

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
  // Q4 and Q5 live here too, so Back keeps every answer.
  const [household, setHousehold] = useState<Household | null>(null);
  const [work1, setWork1] = useState<WorkStatus | null>(null);
  const [work2, setWork2] = useState<WorkStatus | null>(null);
  const [workSkipped, setWorkSkipped] = useState(false);
  const [insurance, setInsurance] = useState<InsuranceType | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** True when the server turned down a ZIP this screen accepted (server knows fewer states; any-state support is W2-STATE). */
  const [zipRejected, setZipRejected] = useState(false);

  const go = (s: Step) => { setError(null); setZipRejected(false); setStep(s); };

  async function start(body: RunRequest) {
    setBusy(true);
    setError(null);
    setZipRejected(false);
    try {
      const { runId, familyId } = await api.startRun(body);
      // The server saved the family; keep its id so this browser can find the family again.
      if (familyId && !('familyId' in body)) rememberFamilyId(familyId);
      navigate(`/feed/${encodeURIComponent(runId)}`);
    } catch (e) {
      const err = e as Error & { status?: number };
      if ('zip' in body && err.status === 400 && /ZIP/i.test(err.message)) {
        // The ZIP is on screen 3, so take the parent back there (their other answers are kept).
        setStep(3);
        setError(zipRejectedMessage(body.zip));
        setZipRejected(true);
      } else {
        setError(err.message);
      }
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
    go(4);
  }

  /** The finished answers go to the server in one request. Anything the parent skipped is simply left out. */
  function finish(ins: InsuranceType) {
    const answered = !workSkipped && household && work1 && (household === 'one' || work2);
    void start({
      zip, ...(stage === 'expecting' ? { dueDate: date } : { birthDate: date }),
      ...(answered ? { household, parent1Work: work1, ...(household === 'two' ? { parent2Work: work2! } : {}) } : {}),
      insurance: ins,
    } as RunRequest);
  }

  const rows: { who: 'you' | 'partner'; label: string; value: WorkStatus | null; set: (w: WorkStatus) => void }[] =
    household === 'two'
      ? [{ who: 'you', label: 'You', value: work1, set: setWork1 }, { who: 'partner', label: 'Your partner', value: work2, set: setWork2 }]
      : household === 'one' ? [{ who: 'you', label: 'You', value: work1, set: setWork1 }] : [];
  const workDone = rows.length > 0 && rows.every((r) => r.value);
  const route: DaycareRoute = workSkipped ? 'general' : daycareRoute({ household, parent1Work: work1, parent2Work: work2 });
  const state = stateForZip(zip)?.code;

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
        <SampleButton busy={busy} onClick={() => start({ familyId: 'maya' })} />
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
              <CheckIcon />
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

  if (step === 3) {
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
              onChange={(e) => { setZip(e.target.value.replace(/\D/g, '').slice(0, 5)); setError(null); setZipRejected(false); }}
            />
          </label>
          <p id="zip-state" aria-live="polite" className={`mt-3 flex items-start gap-2 text-[15px] font-bold ${covered ? 'text-[#1E6B47]' : 'text-ink-2'}`}>
            {msg && covered && <CheckIcon />}
            {msg && <span>{msg}</span>}
          </p>
          <Alert text={error} />
          {zipRejected && <SampleButton busy={busy} onClick={() => start({ familyId: 'maya' })} />}
          <div className="min-h-8 flex-grow" />
          <button type="submit" disabled={busy} className={primary}>Looks right</button>
        </form>
      </Frame>
    );
  }

  if (step === 4) {
    return (
      <Frame step={4} onBack={() => go(3)}>
        <h1 className="mt-10 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em]">Who’s raising this baby?</h1>
        <div role="group" aria-label="Household" className="mt-5 grid grid-cols-2 gap-3">
          {HOUSEHOLDS.map((h) => (
            <button
              key={h.id} type="button" aria-pressed={household === h.id}
              onClick={() => { setHousehold(h.id); setWorkSkipped(false); }}
              className={`min-h-[56px] rounded-2xl border-2 px-4 text-center text-[17px] font-bold transition active:scale-[.99] ${household === h.id ? 'border-coral bg-coral-tint' : 'border-line bg-paper'}`}
            >{h.label}</button>
          ))}
        </div>
        {rows.length > 0 && (
          <div data-testid="work-rows">
            <p className="mt-6 text-[19px] font-extrabold leading-snug tracking-[-0.01em]">{household === 'two' ? 'How does each of you earn money?' : 'How do you earn money?'}</p>
            {rows.map((r) => (
              <div key={r.who} role="group" aria-label={r.label} className="mt-3 space-y-2">
                {household === 'two' && <p aria-hidden="true" className="eyebrow text-ink-2">{r.label}</p>}
                {WORK.map((w) => (
                  <button key={w.id} type="button" aria-pressed={r.value === w.id} onClick={() => { r.set(w.id); setWorkSkipped(false); }} className={optionBox(r.value === w.id)}>
                    <span className="block text-[16px] font-extrabold leading-tight">{w.label}</span>
                    <span className="mt-0.5 block text-[13.5px] text-ink-2">{w.hint}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        {workDone && <Payoff text={WORK_LINE[route]} />}
        <QuietLinks
          skipLabel="Something else / prefer not to say"
          onSkip={() => { setWorkSkipped(true); go(5); }}
          why="So we can check daycare tax savings. Work benefits like these depend on how each parent earns."
        />
        <div className="min-h-8 flex-grow" />
        <button type="button" disabled={!workDone} onClick={() => { setWorkSkipped(false); go(5); }} className={primary}>Continue</button>
      </Frame>
    );
  }

  const choices = insuranceChoices(state);
  const options = choices.filter((c) => c.id !== 'none_or_not_sure');
  const none = choices.find((c) => c.id === 'none_or_not_sure')!;
  return (
    <Frame step={5} onBack={() => go(4)}>
      <Payoff text={PAYOFF_LINE[route]} />
      <h1 className="mt-5 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em]">Where do you get your health insurance?</h1>
      <div className="mt-5 space-y-2.5">
        {options.map((o) => (
          <button
            key={o.id} type="button" disabled={busy} aria-pressed={insurance === o.id}
            onClick={() => { setInsurance(o.id); finish(o.id); }}
            className={`flex min-h-[60px] items-center gap-3 ${optionBox(insurance === o.id)}`}
          >
            <span aria-hidden="true" className={`h-5 w-5 shrink-0 rounded-full border-2 ${insurance === o.id ? 'border-coral bg-coral' : 'border-line'}`} />
            <span className="text-[16px] font-extrabold leading-snug">{o.label}</span>
          </button>
        ))}
      </div>
      <Alert text={error} />
      <QuietLinks
        skipLabel={none.label} disabled={busy}
        onSkip={() => { setInsurance('none_or_not_sure'); finish('none_or_not_sure'); }}
        why="So we can give you the right deadline. Each kind of insurance has its own."
      />
      {busy && <p role="status" className="mt-4 text-[15px] font-bold text-ink-2">Starting…</p>}
    </Frame>
  );
}

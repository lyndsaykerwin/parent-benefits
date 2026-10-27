import { useEffect, useRef, useState } from 'react';
import { GearLockerCard, useLocker } from '@/components/scan/GearLocker';
import { api, localToday, rememberFamilyId, type FamilyMemory, type RunRequest } from '@/lib/bundle';
import { clearBrowserData, clearEdit, loadPlan, markStartOver, peekEdit, savePlan, type EditKey } from '@/lib/account';
import { stateForZip } from '@/lib/onboarding';
import { dateLimits, dateRangeError } from '@shared/dateRange';
import { HOUSEHOLD_LABEL, WORK_LABEL, profileRows } from '@shared/familyFacts';
import { insuranceChoices } from '@shared/eligibility';
import { plainLesson } from '@/lib/offers';
import type { Household, InsuranceType, WorkStatus } from '@shared/bundle';
import { cn } from '@/lib/utils';
import { loadCarrier } from './InsuranceTab';
import { useFiling } from './TaxBooster';
import type { TabProps } from './shared';
import { FamilyChoices, isSampleId, openingLabel, useFamilySwitch, type SwitchTarget } from './FamilySwitch';

export type { SwitchTarget } from './FamilySwitch';

export interface AccountProps extends TabProps {
  /** Opens another family's saved results. Resolves with a plain-English problem, or null once it has switched. */
  onSwitch: (target: SwitchTarget) => Promise<string | null>;
  /** "Start over": back to the five questions. */
  onStartOver: () => void;
  /** After "Forget everything" has deleted it all. */
  onForgot: () => void;
  /** After the answers were saved and a new check started. */
  onRerun: (runId: string) => void;
  /** "‹ Back": returns to the tab Account was opened from. */
  onBack: () => void;
}

const WORK_ORDER: WorkStatus[] = ['paycheck', 'self_employed', 'not_working'];

const pill = (on: boolean) => cn('min-h-[44px] rounded-xl border-2 px-3 text-left text-[15px] font-bold transition active:scale-[.99]', on ? 'border-coral bg-coral-tint text-ink' : 'border-line bg-paper text-ink');
const fieldInput = 'mt-1 block min-h-[48px] w-full rounded-xl border-2 border-line bg-paper px-3 text-[18px] font-bold text-ink outline-none focus:border-coral';

function Chevron({ up }: { up: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={up ? 'rotate-180' : ''}><path d="m6 9 6 6 6-6" /></svg>;
}

const shortDate = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '');
const SOURCE_LABEL: Record<string, string> = { setup: 'From your answers', gear: 'From your Gear Locker' };

/** Every saved scan, including the individual lines read from receipt photos. */
function NurseryGearGallery({ familyId }: { familyId: string }) {
  const load = useLocker(familyId);
  if (load.s === 'loading') return <p role="status" className="mt-2 text-[15px] text-ink-2">Loading saved nursery gear…</p>;
  if (load.s === 'error') return <p role="alert" className="mt-2 text-[15px] text-ink-2">Could not load your saved purchase items right now.</p>;

  const scans = [
    ...load.locker.items.map((item) => ({
      key: `gear-${item.id ?? item.photoId ?? item.productName}`,
      name: item.productName,
      detail: [item.brand, item.modelNumber ? `Model ${item.modelNumber}` : null].filter(Boolean).join(' · '),
      thumbnail: item.thumbnail,
      source: 'Gear scan',
    })),
    ...load.locker.receipts.flatMap((receipt) => (receipt.items ?? []).map((item, index) => ({
      key: `receipt-${receipt.photoId}-${index}`,
      name: item.productName,
      detail: [receipt.store, receipt.purchasedOn].filter(Boolean).join(' · '),
      thumbnail: receipt.thumbnail,
      source: 'Receipt scan',
    }))),
  ];

  return (
    <section aria-label="Nursery Gear Locker" className="bundle-card mt-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow text-ink-2">Nursery Gear Locker</p>
          <p className="text-[16px] font-extrabold">Saved purchase items</p>
        </div>
        <span className="rounded-full bg-cream px-2.5 py-1 text-[12px] font-bold text-ink-2">{scans.length} saved</span>
      </div>
      {scans.length === 0 ? (
        <p className="mt-2 text-[15px] leading-snug text-ink-2">No scanned items yet. Gear labels and receipt lines you save will appear here.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-2" data-testid="purchase-items-gallery">
          {scans.map((item) => (
            <li key={item.key} className="min-w-0 rounded-2xl border border-line bg-paper p-3">
              {item.thumbnail ? <img src={item.thumbnail} alt="" className="mb-2 h-20 w-full rounded-xl object-cover" /> : <div aria-hidden="true" className="mb-2 flex h-20 items-center justify-center rounded-xl bg-cream text-[24px]">🧾</div>}
              <p className="text-[14px] font-extrabold leading-snug">{item.name}</p>
              {item.detail && <p className="mt-0.5 text-[12px] leading-snug text-ink-2">{item.detail}</p>}
              <span className="mt-2 inline-block rounded-full bg-[#E3F3EA] px-2 py-0.5 text-[11px] font-bold text-[#17643F]">{item.source}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AccountTab(props: AccountProps) {
  const { run } = props;
  const owner = !!props.owner;
  const family = run.family;
  const guest = !isSampleId(run.familyId);
  const rows = profileRows({ ...family, state: family?.state });
  // A sample family is shown as of its demo date (like the rest of the app), so its memory entries carry that date too.
  const memoryDate = (savedOn: string) => shortDate(!guest && run.demoDate && run.today ? run.today : savedOn);

  // ----- progress ring: how many answers that shape the numbers are in -----
  const filing = useFiling(run.familyId);
  const pump = family?.insurance === 'job' || family?.insurance === 'marketplace';
  const carrier = pump ? loadCarrier(run.familyId) : 'n/a';
  const steps: { key: string; done: boolean; open: () => void }[] = [
    ...rows.map((r) => ({ key: r.key, done: r.answered, open: () => beginEdit(r.key) })),
    { key: 'filing', done: !!filing.filing, open: () => props.go('taxes') },
    ...(pump ? [{ key: 'carrier', done: !!carrier, open: () => props.go('insurance') }] : []),
  ];
  const left = steps.filter((s) => !s.done);
  const pct = Math.round((100 * (steps.length - left.length)) / steps.length);

  // ----- editing the answers -----
  const [editing, setEditing] = useState<EditKey | null>(() => peekEdit());
  useEffect(() => { clearEdit(); }, []);
  const [draft, setDraft] = useState(() => draftFrom());
  function draftFrom() {
    const expecting = !!family?.dueDate && !family?.birthDate;
    return {
      stage: (expecting ? 'expecting' : 'born') as 'expecting' | 'born', date: family?.birthDate ?? family?.dueDate ?? '', zip: family?.zip ?? '',
      household: (family?.household ?? null) as Household | null, work1: (family?.parent1Work ?? null) as WorkStatus | null, work2: (family?.parent2Work ?? null) as WorkStatus | null,
      insurance: (family?.insurance ?? null) as InsuranceType | null,
    };
  }
  function beginEdit(k: EditKey) { setDraft(draftFrom()); setFormError(null); setEditing(k); }
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const today = localToday();
  const limits = dateLimits(today);

  async function save() {
    const d = draft;
    if (!/^\d{5}$/.test(d.zip) || !stateForZip(d.zip)) return setFormError('Enter a valid 5-digit US ZIP code.');
    if (!d.date) return setFormError(d.stage === 'expecting' ? 'Enter your due date. Your doctor’s estimate is fine.' : 'Enter your baby’s birth date.');
    const rangeError = dateRangeError(d.stage === 'expecting' ? 'due' : 'birth', d.date, today);
    if (rangeError) return setFormError(rangeError);
    const answered = d.household && d.work1 && (d.household === 'one' || d.work2);
    const body = {
      ...(guest ? { familyId: run.familyId } : {}),
      zip: d.zip, ...(d.stage === 'expecting' ? { dueDate: d.date } : { birthDate: d.date }),
      ...(answered ? { household: d.household, parent1Work: d.work1, ...(d.household === 'two' ? { parent2Work: d.work2 } : {}) } : {}),
      ...(d.insurance ? { insurance: d.insurance } : {}),
    } as RunRequest;
    setSaving(true);
    setFormError(null);
    try {
      const { runId, familyId } = await api.startRun(body);
      if (familyId) rememberFamilyId(familyId);
      props.onRerun(runId);
    } catch (e) {
      setFormError((e as Error).message || 'Could not save that. Please try again.');
      setSaving(false);
    }
  }

  // ----- switch family (shared with the header's family chip menu) -----
  const [menu, setMenu] = useState(false);
  const { current, switching, switchError, hasSaved, pick: pickFamily } = useFamilySwitch(run.familyId, props.onSwitch);
  const pick = (t: SwitchTarget) => { setMenu(false); void pickFamily(t); };

  // ----- what Bundle remembers -----
  const [memory, setMemory] = useState<FamilyMemory | null>(null);
  const [memoryError, setMemoryError] = useState(false);
  useEffect(() => {
    let live = true;
    setMemory(null);
    setMemoryError(false);
    Promise.resolve().then(() => api.memory(run.familyId)).then((m) => { if (live) setMemory(m); }).catch(() => { if (live) setMemoryError(true); });
    return () => { live = false; };
  }, [run.familyId]);
  // Lessons written automatically while grading an offer (no parent reports) are for the reviewer only.
  const learned = (memory?.learned ?? []).filter((m) => owner || m.reports !== null);
  const [techFamily, setTechFamily] = useState(false);
  const [techLearned, setTechLearned] = useState(false);

  // ----- forget everything -----
  const [forgetting, setForgetting] = useState(false);
  const [forgetBusy, setForgetBusy] = useState(false);
  const [forgetError, setForgetError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (forgetting) cancelRef.current?.focus(); }, [forgetting]);
  async function forgetAll() {
    setForgetBusy(true);
    setForgetError(null);
    try {
      await api.forgetFamily(run.familyId);
      clearBrowserData();
      props.onForgot();
    } catch (e) {
      setForgetError((e as Error).message || 'Could not forget everything. Please try again.');
      setForgetBusy(false);
    }
  }

  // ----- the plan's optional name (it saves itself; a name is just a label on this device) -----
  const [planName, setPlanName] = useState(() => loadPlan(run.familyId).name);
  useEffect(() => { setPlanName(loadPlan(run.familyId).name); }, [run.familyId]);
  const [naming, setNaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  function saveName() {
    const n = nameDraft.trim().slice(0, 40) || null;
    savePlan(run.familyId, { name: n, hidden: false });
    setPlanName(n);
    setNaming(false);
  }
  const name = isSampleId(run.familyId) ? (family?.name ?? 'Sample').replace(/\s*\(.*\)\s*$/, '').trim() : planName ?? 'My saved profile';
  const choices = insuranceChoices(stateForZip(draft.zip)?.code ?? family?.state);
  const workRows = draft.household === 'two' ? [['You', 'work1'], ['Your partner', 'work2']] as const : draft.household === 'one' ? [['You', 'work1']] as const : [];

  const editor = (k: EditKey) => (
    <div className="mt-3 rounded-2xl bg-cream p-3" data-testid={`editor-${k}`}>
      {!guest && <p className="mb-2 text-[13px] leading-snug text-ink-2">This is a sample family, so saving makes a copy as your own saved profile. The sample stays as it is.</p>}
      {k === 'stage' && (
        <div role="group" aria-label="Stage" className="grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={draft.stage === 'expecting'} onClick={() => setDraft({ ...draft, stage: 'expecting', date: draft.stage === 'expecting' ? draft.date : '' })} className={pill(draft.stage === 'expecting')}>We’re expecting</button>
          <button type="button" aria-pressed={draft.stage === 'born'} onClick={() => setDraft({ ...draft, stage: 'born', date: draft.stage === 'born' ? draft.date : '' })} className={pill(draft.stage === 'born')}>Baby’s here</button>
        </div>
      )}
      {(k === 'stage' || k === 'date') && (
        <label className="mt-2 block">
          <span className="eyebrow text-ink-2">{draft.stage === 'expecting' ? 'Due date' : 'Birth date'}</span>
          <input
            type="date" className={fieldInput} value={draft.date}
            min={draft.stage === 'expecting' ? limits.dueMin : limits.birthMin} max={draft.stage === 'expecting' ? limits.dueMax : today}
            onChange={(e) => { setDraft({ ...draft, date: e.target.value }); setFormError(null); }}
          />
        </label>
      )}
      {k === 'zip' && (
        <label className="block">
          <span className="eyebrow text-ink-2">ZIP code</span>
          <input
            type="text" inputMode="numeric" autoComplete="postal-code" maxLength={5} className={fieldInput} value={draft.zip}
            onChange={(e) => { setDraft({ ...draft, zip: e.target.value.replace(/\D/g, '').slice(0, 5) }); setFormError(null); }}
          />
        </label>
      )}
      {k === 'work' && (
        <div>
          <div role="group" aria-label="Household" className="grid grid-cols-2 gap-2">
            {(['one', 'two'] as Household[]).map((h) => (
              <button key={h} type="button" aria-pressed={draft.household === h} onClick={() => setDraft({ ...draft, household: h, work2: h === 'one' ? null : draft.work2 })} className={pill(draft.household === h)}>{HOUSEHOLD_LABEL[h]}</button>
            ))}
          </div>
          {workRows.map(([label, field]) => (
            <div key={field} role="group" aria-label={label} className="mt-3 space-y-2">
              {draft.household === 'two' && <p aria-hidden="true" className="eyebrow text-ink-2">{label}</p>}
              {WORK_ORDER.map((w) => (
                <button key={w} type="button" aria-pressed={draft[field] === w} onClick={() => setDraft({ ...draft, [field]: w })} className={cn(pill(draft[field] === w), 'block w-full')}>{WORK_LABEL[w]}</button>
              ))}
            </div>
          ))}
          <button type="button" onClick={() => setDraft({ ...draft, household: null, work1: null, work2: null })} className="mt-2 min-h-[44px] text-[14px] font-bold text-ink-2 underline decoration-line decoration-2 underline-offset-4">Skip this question</button>
        </div>
      )}
      {k === 'insurance' && (
        <div role="group" aria-label="Health insurance" className="space-y-2">
          {choices.map((c) => (
            <button key={c.id} type="button" aria-pressed={draft.insurance === c.id} onClick={() => setDraft({ ...draft, insurance: c.id })} className={cn(pill(draft.insurance === c.id), 'block w-full')}>{c.label}</button>
          ))}
        </div>
      )}
      {formError && <p role="alert" className="mt-3 rounded-xl bg-[#FBE3E0] px-3 py-2 text-[14px] font-semibold text-[#9E2A21]">{formError}</p>}
      <button type="button" onClick={save} disabled={saving} className="mt-3 flex min-h-[52px] w-full items-center justify-center rounded-xl bg-ink px-3 text-[16px] font-bold text-cream disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
      <button type="button" onClick={() => { setEditing(null); setFormError(null); }} disabled={saving} className="mx-auto mt-1 flex min-h-[44px] items-center px-3 text-[15px] font-bold text-ink-2 underline decoration-line decoration-2 underline-offset-4">Cancel</button>
      <p className="mt-2 text-[12.5px] text-ink-2">We’ll update your results with this answer.</p>
    </div>
  );

  return (
    <>
      <button type="button" onClick={props.onBack} className="-ml-1 mt-3 flex min-h-[44px] items-center gap-1 px-1 text-[15px] font-bold text-ink"><span aria-hidden="true">‹</span> Back</button>
      <h1 className="mt-2 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em]">Account</h1>

      <section aria-label="Family" data-testid="family-switcher" className="bundle-card mt-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow text-ink-2">Family</p>
            <p className="mt-0.5 flex items-center gap-2 text-[18px] font-extrabold leading-tight">
              <span className="truncate" data-testid="family-name">{name}</span>
              {!guest && <span className="rounded-full bg-[#FBEFC9] px-2 py-0.5 text-[11.5px] font-bold text-[#7A5A00]">Sample</span>}
            </p>
          </div>
          <button
            type="button" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}
            className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border-2 border-line bg-paper px-3 text-[15px] font-bold text-ink"
          >Switch family / demo family <Chevron up={menu} /></button>
        </div>
        {menu && (
          <div role="menu" aria-label="Families" className="mt-3 space-y-2">
            <FamilyChoices current={current} hasSaved={hasSaved} disabled={switching !== null} onPick={pick} />
          </div>
        )}
        {switching && <p role="status" className="mt-3 text-[14px] font-semibold text-ink-2">Opening {openingLabel(switching)}…</p>}
        {switchError && <p role="alert" className="mt-3 rounded-xl bg-[#FBE3E0] px-3 py-2 text-[14px] font-semibold text-[#9E2A21]">{switchError}</p>}
        {guest && !naming && (
          <button type="button" onClick={() => { setNameDraft(planName ?? ''); setNaming(true); }} className="mt-2 min-h-[44px] text-[14px] font-bold text-ink-2 underline decoration-line decoration-2 underline-offset-4">{planName ? 'Change name' : 'Name this plan'}</button>
        )}
        {guest && naming && (
          <form className="mt-2" onSubmit={(e) => { e.preventDefault(); saveName(); }}>
            <label htmlFor={`plan-name-${run.familyId}`} className="block text-[14px] font-bold">Plan name <span className="font-semibold text-ink-2">(optional)</span></label>
            <input
              id={`plan-name-${run.familyId}`} type="text" maxLength={40} autoComplete="off" placeholder="e.g. Our baby plan"
              value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className={fieldInput}
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setNaming(false)} className="min-h-[48px] rounded-xl border-2 border-line bg-paper px-3 text-[15px] font-bold text-ink">Cancel</button>
              <button type="submit" className="min-h-[48px] rounded-xl bg-ink px-3 text-[15px] font-bold text-cream">Save name</button>
            </div>
          </form>
        )}
        <p className="mt-3 text-[13.5px] font-semibold text-ink-2" data-testid="trust-line">Saved on this device. No account needed.</p>
      </section>

      <section aria-label="Plan progress" data-testid="plan-ring" className="bundle-card mt-3 flex items-center gap-4 p-4">
        <div className="relative h-[64px] w-[64px] shrink-0" role="img" aria-label={`${pct} percent complete`}>
          <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
            <circle cx="32" cy="32" r="26" fill="none" stroke="var(--line)" strokeWidth="8" />
            <circle cx="32" cy="32" r="26" fill="none" stroke="var(--coral)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 163.4} 163.4`} transform="rotate(-90 32 32)" />
          </svg>
          <span aria-hidden="true" className="tabular absolute inset-0 flex items-center justify-center text-[14px] font-extrabold">{pct}%</span>
        </div>
        <div className="min-w-0">
          <p className="text-[18px] font-extrabold leading-snug">Your numbers are {pct}% complete.</p>
          {left.length > 0 ? (
            <>
              <p className="text-[14px] leading-snug text-ink-2">Answer {left.length} more {left.length === 1 ? 'question' : 'questions'} to firm them up.</p>
              <button type="button" onClick={left[0].open} className="mt-1 min-h-[44px] text-[15px] font-bold text-coral-deep">Answer the next one →</button>
            </>
          ) : <p className="text-[14px] leading-snug text-ink-2">Every answer is in.</p>}
        </div>
      </section>

      <p className="eyebrow mt-6 text-coral-deep">Your family profile</p>
      <section aria-label="Your family profile" data-testid="profile" className="bundle-card mt-2 px-4">
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.key} className="py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink-2">{r.label}</p>
                  <p className={cn('text-[16px] font-extrabold leading-snug', !r.answered && 'text-ink-2')}>{r.value}</p>
                </div>
                <button
                  type="button" aria-label={`Edit ${r.label}`} aria-expanded={editing === r.key}
                  onClick={() => (editing === r.key ? setEditing(null) : beginEdit(r.key))}
                  className="min-h-[44px] shrink-0 rounded-xl border-2 border-line bg-paper px-4 text-[15px] font-bold text-ink"
                >{editing === r.key ? 'Close' : 'Edit'}</button>
              </div>
              {editing === r.key && editor(r.key)}
            </li>
          ))}
        </ul>
      </section>

      <GearLockerCard familyId={run.familyId} list />
      <NurseryGearGallery familyId={run.familyId} />

      <p className="eyebrow mt-6 text-coral-deep">What we know about your family</p>
      <section aria-label="What we know about your family" data-testid="memory-family" className="bundle-card mt-2 px-4 py-2">
        {memory === null && !memoryError && <p role="status" className="py-3 text-[15px] text-ink-2">Looking at what we know…</p>}
        {memoryError && <p role="alert" className="py-3 text-[15px] text-ink-2">Could not read this right now. Please try again in a minute.</p>}
        {memory && memory.family.length === 0 && <p className="py-3 text-[15px] leading-snug text-ink-2">Nothing yet. Your answers and gear show up here so we can keep checking them for you.</p>}
        {memory && memory.family.length > 0 && (
          <ul className="divide-y divide-line">
            {memory.family.map((m, i) => (
              <li key={`${m.id}-${i}`} className="py-3">
                <p className="text-[15.5px] leading-snug">{m.text}</p>
                <p className="mt-1.5 flex flex-wrap gap-1.5 text-[12px] font-bold">
                  <span className="rounded-full bg-[#E3F3EA] px-2.5 py-0.5 text-[#17643F]">{SOURCE_LABEL[m.source] ?? 'Saved for you'}{memoryDate(m.savedOn) ? ` · ${memoryDate(m.savedOn)}` : ''}</span>
                  {owner && <span className="rounded-full bg-[#F1ECE4] px-2.5 py-0.5 text-ink-2">Saved in Meterless memory</span>}
                </p>
                {techFamily && <p className="mt-1 font-mono text-[12px] text-ink-2">{m.id} · source: {m.source}</p>}
              </li>
            ))}
          </ul>
        )}
        {owner && (
          <button type="button" aria-expanded={techFamily} onClick={() => setTechFamily((t) => !t)} className="flex min-h-[44px] items-center gap-1 text-[13.5px] font-bold text-ink-2">
            Technical details <Chevron up={techFamily} />
          </button>
        )}
      </section>

      <p className="eyebrow mt-6 text-coral-deep">Tips from other parents</p>
      <section aria-label="Lessons from parents" data-testid="memory-learned" className="bundle-card mt-2 px-4 py-2">
        {memory && learned.length === 0 && <p className="py-3 text-[15px] leading-snug text-ink-2">Nothing yet. When parents flag a bad offer, we warn everyone else.</p>}
        {memory && learned.length > 0 && (
          <ul className="divide-y divide-line">
            {learned.map((m, i) => (
              <li key={`${m.id}-${i}`} className="py-3">
                <p className="text-[15.5px] leading-snug">{plainLesson(m.text)}</p>
                <p className="mt-1 text-[13px] text-ink-2">{m.reports === null ? 'Automatic grading note (reviewer only)' : `From ${m.reports} parent ${m.reports === 1 ? 'report' : 'reports'}`}</p>
                {techLearned && <p className="mt-1 font-mono text-[12px] text-ink-2">{m.id}</p>}
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-line py-3 text-[13.5px] text-ink-2">When you report an offer, it helps protect every family checking it.</p>
        {owner && (
          <button type="button" aria-expanded={techLearned} onClick={() => setTechLearned((t) => !t)} className="flex min-h-[44px] items-center gap-1 text-[13.5px] font-bold text-ink-2">
            Technical details <Chevron up={techLearned} />
          </button>
        )}
      </section>

      <div className="mt-6 grid grid-cols-2 gap-2.5">
        <button type="button" onClick={() => { markStartOver(); props.onStartOver(); }} className="min-h-[52px] rounded-2xl border-2 border-line bg-paper px-3 text-[16px] font-bold text-ink">Start over</button>
        <button type="button" onClick={() => { setForgetError(null); setForgetting(true); }} className="min-h-[52px] rounded-2xl border-2 border-[#E8B4AE] bg-paper px-3 text-[16px] font-bold text-[#B3261E]">Forget everything</button>
      </div>

      {forgetting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(27,23,20,.55)] px-4" data-testid="forget-modal">
          <div role="alertdialog" aria-modal="true" aria-labelledby="forget-title" aria-describedby="forget-body" className="w-full max-w-[420px] rounded-3xl bg-paper p-5 shadow-xl">
            <h2 id="forget-title" className="text-[20px] font-extrabold">Forget everything?</h2>
            <p id="forget-body" className="mt-2 text-[15px] leading-snug text-ink-2">This deletes your saved answers, gear and receipt photos, and everything we know about your family, and clears your plan from this device. It can’t be undone.</p>
            {forgetError && <p role="alert" className="mt-3 rounded-xl bg-[#FBE3E0] px-3 py-2 text-[14px] font-semibold text-[#9E2A21]">{forgetError}</p>}
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button ref={cancelRef} type="button" onClick={() => setForgetting(false)} disabled={forgetBusy} className="min-h-[52px] rounded-2xl border-2 border-line bg-paper px-3 text-[16px] font-bold text-ink">Keep my data</button>
              <button type="button" onClick={forgetAll} disabled={forgetBusy} className="min-h-[52px] rounded-2xl bg-[#C9352B] px-3 text-[16px] font-bold text-white disabled:opacity-60">{forgetBusy ? 'Deleting…' : 'Forget'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

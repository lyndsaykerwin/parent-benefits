// "Switch family": the list of sample families plus "My saved profile", and the logic behind a pick.
// Shared by the Account screen and the family chip menu in the header, so both behave the same way.
import { useState } from 'react';
import { savedFamilyId } from '@/lib/bundle';
import { cn } from '@/lib/utils';

/** A choice in the "Switch family" menu: one of the three sample families, or the parent's own saved profile. */
export type SwitchTarget = 'maya' | 'leo' | 'ava' | 'saved';

// Descriptions of the made-up sample families (data/sample/families.json). Fictional data only.
export const SAMPLES: { id: Exclude<SwitchTarget, 'saved'>; name: string; line: string }[] = [
  { id: 'maya', name: 'Maya', line: 'Baby born Oct 3, 2026 · ZIP 02139' },
  { id: 'leo', name: 'Leo', line: 'Expecting, due Dec 7, 2026 · ZIP 02446' },
  { id: 'ava', name: 'Ava', line: 'Baby born Aug 24, 2026 · ZIP 43215 (Ohio)' },
];

export const isSampleId = (id: string) => SAMPLES.some((s) => s.id === id);

/** The state of a "Switch family" pick: which family is on screen, which one is opening, and any problem to show. */
export function useFamilySwitch(familyId: string, onSwitch: (t: SwitchTarget) => Promise<string | null>) {
  const [switching, setSwitching] = useState<SwitchTarget | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const current: SwitchTarget = isSampleId(familyId) ? (familyId as SwitchTarget) : 'saved';
  const hasSaved = !isSampleId(familyId) || !!savedFamilyId();
  async function pick(t: SwitchTarget) {
    setSwitchError(null);
    if (t === current) return;
    setSwitching(t);
    const problem = await onSwitch(t);
    // On success the screen shows the other family. On a problem, say so.
    if (problem) setSwitchError(problem);
    setSwitching(null);
  }
  return { current, switching, switchError, hasSaved, pick };
}

/** The family choices, as menu items (role="menuitemradio"). Each is at least 44px tall. */
export function FamilyChoices({ current, hasSaved, disabled, onPick }: { current: SwitchTarget; hasSaved: boolean; disabled: boolean; onPick: (t: SwitchTarget) => void }) {
  const item = (on: boolean) => cn('flex min-h-[44px] w-full items-start gap-3 rounded-2xl border-2 p-3 text-left disabled:opacity-60', on ? 'border-coral bg-coral-tint' : 'border-line bg-paper');
  const dot = (on: boolean) => cn('mt-1 h-5 w-5 shrink-0 rounded-full border-2', on ? 'border-coral bg-coral' : 'border-line');
  return (
    <>
      {SAMPLES.map((s) => (
        <button key={s.id} type="button" role="menuitemradio" aria-checked={current === s.id} disabled={disabled} onClick={() => onPick(s.id)} className={item(current === s.id)}>
          <span aria-hidden="true" className={dot(current === s.id)} />
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-[16px] font-extrabold">{s.name} <span className="rounded-full bg-[#FBEFC9] px-2 py-0.5 text-[11.5px] font-bold text-[#7A5A00]">Sample</span></span>
            <span className="block text-[13.5px] text-ink-2">{s.line}</span>
          </span>
        </button>
      ))}
      <button type="button" role="menuitemradio" aria-checked={current === 'saved'} disabled={disabled} onClick={() => onPick('saved')} className={item(current === 'saved')}>
        <span aria-hidden="true" className={dot(current === 'saved')} />
        <span className="min-w-0">
          <span className="block text-[16px] font-extrabold">My saved profile</span>
          <span className="block text-[13.5px] text-ink-2">{hasSaved ? 'Your own answers, kept on this device' : 'Not set up yet: answer the 5 questions'}</span>
        </span>
      </button>
    </>
  );
}

/** "Opening Leo…" while a switch is under way. */
export const openingLabel = (t: SwitchTarget) => (t === 'saved' ? 'your saved profile' : SAMPLES.find((s) => s.id === t)?.name);

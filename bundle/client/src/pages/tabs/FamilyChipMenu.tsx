import { useEffect, useRef, useState } from 'react';
import { FamilyChoices, openingLabel, useFamilySwitch, type SwitchTarget } from './FamilySwitch';

interface Props {
  /** The chip's words: `full` ("Baby Maya · day 20", "Your family · day 20") from 640px up, `short` ("Maya", "Your family") on a phone. */
  label: { short: string; full: string };
  familyId: string;
  /** Opens another family's saved results. Resolves with a plain-English problem, or null once it has switched. */
  onSwitch: (target: SwitchTarget) => Promise<string | null>;
  /** Opens the Account screen (the family's answers, memory and privacy). */
  onOpenAccount: () => void;
}

/**
 * The family chip in the header, as a button. Tapping it opens a small menu: "Switch family" (the same list as on the
 * Account screen) and "Your plan and memory", which opens the Account screen. Closes on a tap outside, Escape, or a choice.
 */
export default function FamilyChipMenu({ label, familyId, onSwitch, onOpenAccount }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const { current, switching, switchError, hasSaved, pick } = useFamilySwitch(familyId, onSwitch);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role^="menuitem"]:not([disabled])')?.focus();
    const onDown = (e: Event) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const choose = (t: SwitchTarget) => { setOpen(false); void pick(t); };

  return (
    // Not `relative`: the menu is placed against the whole header (AppShell), so it never runs off a phone screen.
    <div ref={wrap} className="min-w-0">
      <button
        ref={button} type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="family-chip"
        className="flex min-h-[44px] max-w-full items-center gap-0.5 rounded-full border border-line bg-paper pl-3 pr-2 text-[13px] font-semibold text-ink-2 hover:border-coral"
      >
        <span className="sr-only">Family menu: {label.full}</span>
        {/* A phone header is too narrow for the stage text next to the wordmark and Scan, so it shows only who it is. */}
        <span aria-hidden="true" className="truncate sm:hidden" data-testid="chip-short">{label.short}</span>
        <span aria-hidden="true" className="hidden truncate sm:inline" data-testid="chip-full">{label.full}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className={open ? 'shrink-0 rotate-180' : 'shrink-0'}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div ref={menu} role="menu" aria-label="Family menu" className="absolute right-0 top-full z-50 mt-1 w-full max-w-[340px] space-y-2 rounded-2xl border border-line bg-paper p-3 shadow-lg">
          <p className="eyebrow px-1 text-ink-2">Switch family</p>
          <FamilyChoices current={current} hasSaved={hasSaved} disabled={switching !== null} onPick={choose} />
          <div className="border-t border-line pt-2">
            <button
              type="button" role="menuitem" onClick={() => { setOpen(false); onOpenAccount(); }}
              className="flex min-h-[44px] w-full items-center justify-between rounded-xl px-2 text-left text-[15px] font-bold text-coral-deep hover:bg-coral-tint"
            >Your plan and memory <span aria-hidden="true">›</span></button>
          </div>
        </div>
      )}
      {switching && <p role="status" className="absolute right-0 top-full z-50 mt-1 whitespace-nowrap rounded-xl bg-paper px-3 py-2 text-[13px] font-semibold text-ink-2 shadow">Opening {openingLabel(switching)}…</p>}
      {switchError && !open && <p role="alert" className="absolute right-0 top-full z-50 mt-1 w-full max-w-[340px] rounded-xl bg-[#FBE3E0] px-3 py-2 text-[14px] font-semibold text-[#9E2A21]">{switchError}</p>}
    </div>
  );
}

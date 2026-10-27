import type { SwitchTarget } from './FamilySwitch';

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
 * The account button in the header, left of Scan: a plain person icon. One tap opens the Account screen, which holds the
 * family switcher, the Gear Locker and what Bundle remembers. No dropdown in between.
 */
export default function FamilyChipMenu({ label, onOpenAccount }: Props) {
  return (
    <button
      type="button" onClick={onOpenAccount} data-testid="family-chip" aria-label={`Your account (${label.full})`}
      className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full border border-line bg-paper text-ink hover:border-coral"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
      </svg>
    </button>
  );
}

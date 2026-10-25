// The five onboarding answers in plain words. One place, so the Account tab and the memory entries Bundle writes
// about a family always say the same thing.
import type { Household, InsuranceType, WorkStatus } from './bundle';
import { insuranceLabel } from './eligibility';

export const HOUSEHOLD_LABEL: Record<Household, string> = { one: 'Just me', two: 'Two of us' };
export const WORK_LABEL: Record<WorkStatus, string> = {
  paycheck: 'Paycheck from a job',
  self_employed: 'Self-employed or freelance',
  not_working: 'Not working right now',
};

export interface ProfileAnswers {
  birthDate?: string | null;
  dueDate?: string | null;
  zip?: string | null;
  state?: string;
  household?: Household | null;
  parent1Work?: WorkStatus | null;
  parent2Work?: WorkStatus | null;
  insurance?: InsuranceType | null;
}

export type ProfileKey = 'stage' | 'date' | 'zip' | 'work' | 'insurance';
export interface ProfileRow { key: ProfileKey; label: string; value: string; /** false = the family has not answered this one */ answered: boolean }

/** "2026-10-03" -> "Oct 3, 2026". */
export const prettyDate = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** "Two of us · You: Paycheck from a job · Partner: Paycheck from a job", or null when the work question was skipped. */
export function workLine(a: ProfileAnswers): string | null {
  if (!a.household || !a.parent1Work) return null;
  const parts = [HOUSEHOLD_LABEL[a.household], `You: ${WORK_LABEL[a.parent1Work]}`];
  if (a.household === 'two' && a.parent2Work) parts.push(`Partner: ${WORK_LABEL[a.parent2Work]}`);
  return parts.join(' · ');
}

/** The five rows, in the order the Account tab shows them. */
export function profileRows(a: ProfileAnswers): ProfileRow[] {
  const expecting = !!a.dueDate && !a.birthDate;
  const date = a.birthDate ?? a.dueDate ?? null;
  const work = workLine(a);
  const ins = insuranceLabel(a.insurance, a.state);
  return [
    { key: 'stage', label: 'Stage', value: expecting ? 'Expecting' : 'Baby’s here', answered: true },
    { key: 'date', label: expecting ? 'Due date' : 'Birth date', value: date ? prettyDate(date) : 'Not set', answered: !!date },
    { key: 'zip', label: 'ZIP code', value: a.zip || 'Not set', answered: !!a.zip },
    { key: 'work', label: 'Work setup', value: work ?? 'Not answered', answered: !!work },
    { key: 'insurance', label: 'Health insurance', value: ins ?? 'Not answered', answered: !!ins },
  ];
}

/** The lines Bundle writes into its memory for a family. Only answers the family gave. */
export function profileFacts(a: ProfileAnswers): string[] {
  const label: Record<ProfileKey, string> = { stage: 'Stage', date: '', zip: 'ZIP', work: 'Work setup', insurance: 'Insurance' };
  return profileRows(a).filter((r) => r.answered).map((r) => `${r.key === 'date' ? r.label : label[r.key]}: ${r.value}`);
}

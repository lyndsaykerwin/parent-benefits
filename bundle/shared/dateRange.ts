/**
 * Sensible limits for a typed-in family: a birth date in the last 2 years, a due date in the next 10 months.
 * Used by the server (rejects anything else) and the sign-up form (min/max on the date box).
 */
export const BIRTH_ERROR = 'The birth date must be within the last 2 years.';
export const DUE_ERROR = 'The due date must be within the next 10 months.';

const iso = (d: Date): string => d.toISOString().slice(0, 10);

function shiftMonths(today: string, months: number): string {
  const d = new Date(`${today}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return iso(d);
}

function shiftDays(today: string, days: number): string {
  return iso(new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000));
}

/** Earliest and latest allowed dates (ISO). A day of slack on each end covers time zones. */
export function dateLimits(today: string): { birthMin: string; birthMax: string; dueMin: string; dueMax: string } {
  return {
    birthMin: shiftMonths(today, -24),
    birthMax: shiftDays(today, 1),
    dueMin: shiftDays(today, -1),
    dueMax: shiftMonths(today, 10),
  };
}

/** An error message when the date is outside the allowed range, otherwise null. */
export function dateRangeError(kind: 'birth' | 'due', date: string, today: string): string | null {
  const l = dateLimits(today);
  if (kind === 'birth') return date >= l.birthMin && date <= l.birthMax ? null : BIRTH_ERROR;
  return date >= l.dueMin && date <= l.dueMax ? null : DUE_ERROR;
}

/**
 * Value Score = true value after the strings attached + the time it takes to get it.
 * "Worth your time" rule with four settings (each can be changed in the environment):
 *   WORTH_MIN_VALUE_CENTS     500   – below $5 of true value, never worth it
 *   WORTH_MAX_EFFORT_MINUTES   30   – more effort than this needs at least...
 *   WORTH_EFFORT_VALUE_CENTS 2000   – ...$20 of true value to be worth it
 *   WORTH_MAX_PAYOUT_DAYS      90   – money that takes longer than this to arrive isn't worth it
 * Effort is never converted into dollars (that would need a made-up hourly rate).
 */
import type { FinePrintCheck } from './types';
import type { DayRange, ValueScore } from '../../shared/bundle';

export interface WorthSettings { minValueCents: number; maxEffortMinutes: number; effortValueCents: number; maxPayoutDays: number }
export const WORTH_DEFAULTS: WorthSettings = { minValueCents: 500, maxEffortMinutes: 30, effortValueCents: 2000, maxPayoutDays: 90 };

const num = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return v !== undefined && v.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : fallback;
};
export function worthSettings(env: Record<string, string | undefined> = process.env): WorthSettings {
  return {
    minValueCents: num(env.WORTH_MIN_VALUE_CENTS, WORTH_DEFAULTS.minValueCents),
    maxEffortMinutes: num(env.WORTH_MAX_EFFORT_MINUTES, WORTH_DEFAULTS.maxEffortMinutes),
    effortValueCents: num(env.WORTH_EFFORT_VALUE_CENTS, WORTH_DEFAULTS.effortValueCents),
    maxPayoutDays: num(env.WORTH_MAX_PAYOUT_DAYS, WORTH_DEFAULTS.maxPayoutDays),
  };
}

/** Plain words for the wait, using both ends of the range from the fine print. */
export function payoutWaitLabel(wait: DayRange | null): string {
  if (!wait) return 'right away';
  const weeks = wait.min % 7 === 0 && wait.max % 7 === 0 && wait.min >= 7;
  const [a, b, unit] = weeks ? [wait.min / 7, wait.max / 7, 'weeks'] : [wait.min, wait.max, 'days'];
  return a === b ? `money in about ${a} ${unit}` : `money in about ${a}–${b} ${unit}`;
}

const dollars = (c: number) => `$${(c / 100).toFixed(2)}`;

export function valueScore(check: FinePrintCheck, settings: WorthSettings = WORTH_DEFAULTS): ValueScore {
  const payoutWaitDays = check.payoutWaitDaysMax !== null
    ? { min: check.payoutWaitDaysMin ?? check.payoutWaitDaysMax, max: check.payoutWaitDaysMax } : null;
  const reasons: string[] = [];
  let worth: boolean | null = true;
  const v = check.trueValueCents;

  if (check.verdict === 'reject') { worth = false; reasons.push(`rejected: ${check.reasons.join('; ')}`); }
  if (v === null) {
    if (worth !== false) { worth = null; reasons.push('the fine print gives no dollar figure, so the value is unknown'); }
  } else {
    if (v < settings.minValueCents) { worth = false; reasons.push(`true value ${dollars(v)} is under the ${dollars(settings.minValueCents)} minimum`); }
    if (check.effortMinutesEstimate.max > settings.maxEffortMinutes && v < settings.effortValueCents) {
      worth = false; reasons.push(`up to ${check.effortMinutesEstimate.max} minutes of effort for ${dollars(v)} (needs ${dollars(settings.effortValueCents)} or more)`);
    }
  }
  if (payoutWaitDays && payoutWaitDays.max > settings.maxPayoutDays) {
    worth = false; reasons.push(`the wait for the money (up to ${payoutWaitDays.max} days) is longer than ${settings.maxPayoutDays} days`);
  }
  if (worth === true) reasons.push(`${dollars(v!)} after the strings attached, ${check.effortLevel} effort, ${payoutWaitLabel(payoutWaitDays)}`);

  return {
    trueValueCents: v,
    effortLevel: check.effortLevel,
    effortMinutesEstimate: check.effortMinutesEstimate,
    stepsCount: check.stepsCount,
    payoutWaitDays,
    timeLabel: payoutWaitLabel(payoutWaitDays),
    catchTypes: check.catchTypes,
    worthYourTime: worth,
    reasons,
  };
}

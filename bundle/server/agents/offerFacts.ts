/**
 * The facts an offer card shows about the Fine Print Court's work (plans/v2-build-plan.md, R5): the verdict, how many
 * subscription traps and hidden fees were found, the minutes it takes and the true value. Everything here is read from the
 * court's own result, never typed by hand. The same function serves saved runs, live-found offers and parent audits.
 */
import type { FinePrintVerdict, OfferFacts } from '../../shared/bundle';
import type { FinePrintCheck } from './types';

/** Catch types that are a subscription trap: a trial that renews into a paid plan. A membership the family may already
 *  have (e.g. "needs Prime") is a catch, listed in `catches`, but not counted as a trap. */
const SUBSCRIPTION_CATCHES = new Set(['auto_renew']);

export interface OfferFactsInput {
  check: FinePrintCheck;
  verdict: FinePrintVerdict;
  /** The offer's own listed value (cents), used when the fine print states none. */
  faceCents?: number | null;
  /** Said when the AI court was off and only the code rules ran. */
  ruleCheckOnly?: boolean;
  /** The court's own reason for a block (plain sentence); used when the code found no catch of its own. */
  reason?: string;
  ageDays?: number | null;
  minAgeDays?: number | null;
  maxAgeDays?: number | null;
}

export function buildOfferFacts(i: OfferFactsInput): OfferFacts {
  const { check } = i;
  const face = check.faceValueCents ?? i.faceCents ?? null;
  const trueValueCents = check.trueValueCents ?? (face !== null ? Math.max(0, face - check.hiddenCostCents) : null);
  const catches = check.reasons.filter((r) => r.trim());
  if (i.verdict === 'reject' && i.reason && !catches.length) catches.push(i.reason);
  return {
    court: i.verdict,
    catches,
    subscriptionTraps: check.catchTypes.filter((t) => SUBSCRIPTION_CATCHES.has(t)).length || (check.autoRenew ? 1 : 0),
    hiddenFeeCents: check.hiddenCostCents,
    ruleCheckOnly: !!i.ruleCheckOnly,
    trueValueCents,
    minutes: check.effortMinutesEstimate.max,
    ageDays: i.ageDays ?? null,
    minAgeDays: i.minAgeDays ?? null,
    maxAgeDays: i.maxAgeDays ?? null,
  };
}

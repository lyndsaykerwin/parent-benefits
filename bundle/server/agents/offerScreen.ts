/**
 * Plain, model-free checks on an offer's fine print. Shared by the Fine Print Court's offline screen and the
 * list of bundled stand-in offers (so a stand-in never needs a membership or has a big fee).
 * The patterns and the $5 limit come from finePrintRules.ts, so this screen and the full code check never drift apart.
 */
import { FEE_LIMIT_DOLLARS, FEE_MAY_APPLY, MEMBERSHIP_NEEDED, firstUnnegated, statedFees } from './finePrintRules';

export { FEE_LIMIT_DOLLARS };

/**
 * Plain checks that need no model: the fine print needs a paid membership, or states a fee (over $5, or of an unstated size).
 * Returns why the offer is a problem, or null. Also used to keep such offers out of the bundled stand-in list.
 */
export function offlineProblem(finePrint: string): string | null {
  if (firstUnnegated(MEMBERSHIP_NEEDED, finePrint) >= 0) return 'the fine print says a paid membership (Prime, membership or subscription) is required';
  if (firstUnnegated(FEE_MAY_APPLY, finePrint) >= 0) return 'the fine print says a shipping or handling fee may apply (no amount given)';
  const big = statedFees(finePrint).find((f) => f.cents > FEE_LIMIT_DOLLARS * 100);
  if (big) return `the fine print states a $${big.cents / 100} shipping or handling fee, which is over $${FEE_LIMIT_DOLLARS}`;
  return null;
}

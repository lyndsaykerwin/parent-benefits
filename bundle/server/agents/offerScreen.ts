/**
 * Plain, model-free checks on an offer's fine print. Shared by the Fine Print Court's offline screen and the
 * list of bundled stand-in offers (so a stand-in never needs a membership or has a big fee).
 */

/** A shipping or handling fee above this (in dollars) makes a "free" offer not free. */
export const FEE_LIMIT_DOLLARS = 5;

const FEE_WORD = '(?:shipping|handling|postage)';
const AMOUNT = '\\$\\s?(\\d[\\d,]*(?:\\.\\d+)?)';
// "$7.99 shipping" / "$7.99 shipping fee"
const FEE_BEFORE = new RegExp(`${AMOUNT}\\s+${FEE_WORD}\\b`, 'gi');
// "shipping fee of $7.99" / "shipping and handling: $7.95" / "shipping is $6"
const FEE_AFTER = new RegExp(`\\b${FEE_WORD}(?:\\s+(?:and|&)\\s+${FEE_WORD})?(?:\\s+(?:fees?|charges?|costs?))?(?:\\s*:|\\s+(?:of|is|are|costs?|will be))?\\s*${AMOUNT}`, 'gi');
const THRESHOLD_WORDS = /(over|above|than|minimum|least|exceed\w*|spend\w*|orders?\s+of)\s*$/i;

/** A dollar amount directly attached to shipping/handling/postage and over $5. Thresholds like "free shipping on orders over $50" do not count. */
function bigFee(finePrint: string): number | null {
  for (const re of [FEE_BEFORE, FEE_AFTER]) {
    for (const m of finePrint.matchAll(re)) {
      const amountAt = (m.index ?? 0) + m[0].indexOf('$');
      if (THRESHOLD_WORDS.test(finePrint.slice(Math.max(0, amountAt - 20), amountAt))) continue;
      const n = Number(m[1].replace(/,/g, ''));
      if (n > FEE_LIMIT_DOLLARS) return n;
    }
  }
  return null;
}
/** The fine print says a paid membership or subscription is needed ("Requires Prime", "Costco membership required"). */
const MEMBERSHIP_NEEDED = /\b(?:requires?|required)\b[^.;]{0,40}\b(?:prime|membership|member|subscription)\b|\b(?:prime|membership|member|subscription)\s+(?:is\s+)?required\b/i;

/** A shipping or handling fee that "may apply" with no amount given. */
const FEE_MAY_APPLY = /\b(?:shipping|handling|postage)(?:\s+(?:and|&)\s+(?:shipping|handling|postage))?\s+(?:fees?|charges?|costs?)\s+(?:may|will|can)\s+apply\b/i;

/**
 * Plain checks that need no model: the fine print needs a paid membership, or states a shipping/handling fee (over $5, or of an unstated size).
 * Returns why the offer is a problem, or null. Also used to keep such offers out of the bundled stand-in list.
 */
export function offlineProblem(finePrint: string): string | null {
  if (MEMBERSHIP_NEEDED.test(finePrint)) return 'the fine print says a paid membership (Prime, membership or subscription) is required';
  if (FEE_MAY_APPLY.test(finePrint)) return 'the fine print says a shipping or handling fee may apply (no amount given)';
  const fee = bigFee(finePrint);
  if (fee !== null) return `the fine print states a $${fee} shipping or handling fee, which is over $${FEE_LIMIT_DOLLARS}`;
  return null;
}


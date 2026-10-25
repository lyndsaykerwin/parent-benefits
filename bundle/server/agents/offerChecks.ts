/**
 * Saving a finished court grade to offer_checks (the Living Fine-Print Database).
 *
 * Only grades both sides agreed on are saved (status 'agreed'). That is what lets savedVerdicts.canSkipAi
 * reuse a grade later without asking the AI again: a disputed or offline grade is never written, so it can
 * never be mistaken for a settled one. The writer enforces this itself, not just the caller.
 * No family data goes in: the table has no family column and nothing here reads one.
 */
import { offerChecks } from '../../shared/schema';
import type { db as appDb } from '../db';
import type { FinePrintCheck, InsertOfferCheck, OfferCheckWriter } from './types';

export const COURT_AGENT = 'fine_print_court';

type FinalVerdict = 'approve' | 'approve_with_catch' | 'reject';

/**
 * The row for one agreed grade. The saved "minutes" is the upper end of the effort estimate (the cautious
 * number); the payout wait keeps both ends exactly as the fine print gave them, or stays empty.
 */
export function buildOfferCheckRow(
  offer: { id: number | string; store: string; sourceUrl: string },
  check: FinePrintCheck,
  verdict: FinalVerdict,
  ruleCitations: string[],
  status: 'agreed',
  model: string | null = null,
): InsertOfferCheck {
  return {
    offerId: String(offer.id), store: offer.store, sourceUrl: offer.sourceUrl || null,
    finePrintHash: check.finePrintHash, agent: COURT_AGENT, model,
    faceValueCents: check.faceValueCents, hiddenCostCents: check.hiddenCostCents, trueValueCents: check.trueValueCents,
    minPurchaseCents: check.minPurchaseCents, autoRenew: check.autoRenew, renewalPriceCents: check.renewalPriceCents,
    deadlineDate: check.deadlineDate, expired: check.expired, claimWindowDays: check.claimWindowDays,
    payoutWaitDaysMin: check.payoutWaitDaysMin, payoutWaitDaysMax: check.payoutWaitDaysMax,
    stepsCount: check.stepsCount, effortLevel: check.effortLevel, effortMinutesEstimate: check.effortMinutesEstimate.max,
    mailIn: check.mailIn, needsReceipt: check.needsReceipt, needsPhoneCall: check.needsPhoneCall, accountRequired: check.accountRequired,
    limitedStock: check.limitedStock, regionsExcluded: check.regionsExcluded,
    catchTypes: check.catchTypes, verdict, status, ruleCitations,
    catchSummary: check.reasons.join('; '), evidenceQuote: check.evidenceQuote, injectionDetected: check.injectionDetected,
  };
}

/** A writer over the app's database (or any drizzle database with `insert`). Refuses any row that is not 'agreed'. */
export function createOfferCheckWriter(db: Pick<typeof appDb, 'insert'>): OfferCheckWriter {
  return {
    async insert(row: InsertOfferCheck): Promise<string> {
      if (row.status !== 'agreed') throw new Error(`only agreed grades are saved (got status "${String(row.status)}")`);
      const [saved] = await db.insert(offerChecks).values(row).returning({ id: offerChecks.id });
      return String(saved.id);
    },
  };
}

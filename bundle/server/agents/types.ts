import type { Family, FeedCard } from '../../shared/bundle';
import type { ZetarisClient } from '../adapters/zetaris';
import type { Generator } from '../adapters/llm';
import type { BundleMemory } from '../adapters/memory';
import type { TraceLogger } from './trace';
import type { Workspace } from './workspace';
import type { offerChecks } from '../../shared/schema';

/** One row to save in offer_checks. */
export type InsertOfferCheck = typeof offerChecks.$inferInsert;

export interface CourtRuling {
  verdict: 'approve' | 'reject';
  citedRuleIds: string[];
  reason: string;
}

/**
 * The structured facts the code rules pull out of one offer's fine print (audit-ma-poverty-evals.md 3c).
 * These become the `offer_checks` row; no family data lives here.
 */
export interface FinePrintCheck {
  finePrintHash: string;
  faceValueCents: number | null;
  hiddenCostCents: number;
  trueValueCents: number | null;
  minPurchaseCents: number | null;
  autoRenew: boolean;
  renewalPriceCents: number | null;
  renewalPeriod: 'week' | 'month' | 'year' | null;
  cardRequired: boolean;
  cancelMethod: 'online' | 'phone' | 'mail' | null;
  deadlineDate: string | null;
  expired: boolean;
  daysLeft: number | null;
  claimWindowDays: number | null;
  payoutWaitDaysMin: number | null;
  payoutWaitDaysMax: number | null;
  stepsCount: number;
  effortMinutesEstimate: { min: number; max: number };
  effortLevel: 'low' | 'medium' | 'high';
  mailIn: boolean;
  needsReceipt: boolean;
  needsProofOfPurchase: boolean;
  needsPhoneCall: boolean;
  needsForms: boolean;
  accountRequired: boolean;
  appRequired: boolean;
  marketingOptInRequired: boolean;
  inStoreOnly: boolean;
  payoutForm: 'instant_discount' | 'prepaid_card' | 'points' | 'check' | null;
  limitedStock: boolean;
  regionsExcluded: string[];
  onePerHousehold: boolean;
  catchTypes: string[];
  verdict: 'approve' | 'approve_with_catch' | 'reject';
  reasons: string[];
  evidenceQuote: string;
  injectionDetected: boolean;
  /** Every dollar amount (cents) the rules read straight from the text; anything else is computed from these. */
  quotedAmountsCents: number[];
}

/**
 * Where the court saves a finished grade (the Living Fine-Print Database). The real one wraps the database
 * (offerChecks.createOfferCheckWriter); tests pass a fake. Only 'agreed' rows are ever accepted.
 */
export interface OfferCheckWriter {
  /** Saves one row and returns its id (as text). */
  insert(row: InsertOfferCheck): Promise<string>;
}

export interface AgentContext {
  runId: string;
  family: Family;
  z: ZetarisClient;
  llm: Generator;
  memory: BundleMemory;
  trace: TraceLogger;
  /** Shared notes agents leave for each other during this run (Meterless H-MEM). Optional until the orchestrator creates it. */
  workspace?: Workspace;
  /** The date this run is evaluated at (ISO). Falls back to the TODAY env var, then the real date. */
  today?: string;
  /** Offers the court rejected, filled by the court so the app can show "we caught these for you" (never counted in totals). */
  blocked?: FeedCard[];
  /** Saves each agreed court grade to offer_checks. Absent in sample runs without a database: nothing is saved, and the trace says so. */
  offerChecks?: OfferCheckWriter;
  /** Set by the Benefits Planner: false = no program rows on file for the family's state (federal only); true = covered; unset = not known. */
  stateCovered?: boolean;
}

export interface Candidate extends FeedCard {
  agent: string;
  claim: Record<string, string | number>;
  evidenceSql: string;
  retryCount: number;
  /** The court's final answer when it differs from a plain approval: 'approve_with_catch' counts only the true value. */
  courtVerdict?: 'approve' | 'approve_with_catch';
}

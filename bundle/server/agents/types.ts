import type { Family, FeedCard } from '../../shared/bundle';
import type { ZetarisClient } from '../adapters/zetaris';
import type { Generator } from '../adapters/llm';
import type { BundleMemory } from '../adapters/memory';
import type { TraceLogger } from './trace';

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

export interface AgentContext {
  runId: string;
  family: Family;
  z: ZetarisClient;
  llm: Generator;
  memory: BundleMemory;
  trace: TraceLogger;
  /** The date this run is evaluated at (ISO). Falls back to the TODAY env var, then the real date. */
  today?: string;
  /** Offers the court rejected, filled by the court so the app can show "we caught these for you" (never counted in totals). */
  blocked?: FeedCard[];
}

export interface Candidate extends FeedCard {
  agent: string;
  claim: Record<string, string | number>;
  evidenceSql: string;
  retryCount: number;
}

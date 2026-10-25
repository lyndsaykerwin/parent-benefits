export type CardKind = 'clawback' | 'recall' | 'discount' | 'benefit' | 'coming_soon';
export type Verdict = 'verified' | 'likely' | 'all_clear' | 'info' | 'blocked';
export interface Source { label: string; url: string }
export interface FeedCard {
  id: string; kind: CardKind; title: string; body: string;
  amountCents: number | null; deadline: string | null; // ISO date
  verdict: Verdict; sources: Source[]; traceId: string;
  /** Discount cards only: the value-and-time grade, computed by code from the quoted fine print. */
  valueScore?: ValueScore;
}

/** The fine-print verdict: clean, worth it but the parent sees the catch, or not worth it / misleading. */
export type FinePrintVerdict = 'approve' | 'approve_with_catch' | 'reject';
export type EffortLevel = 'low' | 'medium' | 'high';
export interface DayRange { min: number; max: number }
export interface MinuteRange { min: number; max: number }

/**
 * The value-and-time grade shown on a deal card. Every dollar figure is from the quoted fine print or computed
 * by code from figures that are. Effort is never turned into dollars (that would need a made-up hourly rate).
 */
export interface ValueScore {
  /** Face value minus hidden costs; null when the fine print gives no dollar figure. */
  trueValueCents: number | null;
  effortLevel: EffortLevel;
  effortMinutesEstimate: MinuteRange;
  stepsCount: number;
  payoutWaitDays: DayRange | null;
  /** Plain words for the wait, e.g. "money in about 8–10 weeks". */
  timeLabel: string;
  catchTypes: string[];
  /** true = worth your time under the current settings; null = can't tell (no dollar figure). */
  worthYourTime: boolean | null;
  /** Plain-English reasons for the worth-your-time answer. */
  reasons: string[];
}
export interface BundleReceipt {
  moneyBackCents: number;
  likelyBenefitsCents: number;
  deadlineCount: number;
  nextDeadline: string | null;
  itemsChecked: number;
}
export interface BundleResult {
  familyId: string; runId: string; receipt: BundleReceipt; cards: FeedCard[]; banner: string | null;
  /** Offers the Fine Print Court rejected (verdict 'blocked'). Shown separately; never in the Receipt or the discount minimums. */
  blocked?: FeedCard[];
  /**
   * Set when we have no programs on file for the family's state yet: the plain "coming soon" sentence the screen shows
   * beside the federal programs. Absent for states we cover. (The server does not send it yet; the screen also reads
   * `family.state` and a `coming-soon-state` card.)
   */
  stateNote?: string | null;
}
export interface Family {
  id: string; userId: string | null; isGuest: boolean; name: string;
  birthDate: string | null; dueDate: string | null; zip: string; state: string;
  employer: string; householdSize: number; annualIncomeCents: number | null;
  dcfsaOffered: boolean; dataConnected: boolean;
}

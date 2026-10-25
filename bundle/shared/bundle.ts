export type CardKind = 'clawback' | 'recall' | 'discount' | 'benefit' | 'coming_soon';
export type CardCategory = 'money_back' | 'tax_time' | 'leave' | 'gift' | 'info';
export type Household = 'one' | 'two';
export type WorkStatus = 'paycheck' | 'self_employed' | 'not_working';
export type InsuranceType = 'job' | 'marketplace' | 'medicaid' | 'tricare' | 'none_or_not_sure';
export type Verdict = 'verified' | 'likely' | 'all_clear' | 'info' | 'blocked';
export interface Source { label: string; url: string }
export interface FeedCard {
  id: string; kind: CardKind; title: string; body: string;
  amountCents: number | null; deadline: string | null; // ISO date
  verdict: Verdict; sources: Source[]; traceId: string;
  /** Which Home bucket the card belongs in. Set by the server; absent on older saved runs. */
  category?: CardCategory;
  /** Rough minutes the parent needs to act on it. Set by the server; absent on older saved runs. */
  minutes?: number;
  /** Discount cards only: the value-and-time grade, computed by code from the quoted fine print. */
  valueScore?: ValueScore;
  /** Discount cards only: what the Fine Print Court found, in the numbers the card shows. Absent on older saved runs. */
  offerFacts?: OfferFacts;
  /** Live-search offers only: the ISO day the offer was found, and that it was not in the saved list. */
  foundOn?: string;
  isNew?: boolean;
  /**
   * RESERVED for affiliate links (switched off). A link is attached only AFTER the court has graded the offer, the list is
   * never sorted by it, and a card with one must show the label. Nothing sets this today.
   */
  paidLink?: { label: 'Paid link'; url: string };
}

/** What the Fine Print Court found about one offer: the facts a card shows (plans/v2-build-plan.md, R5). */
export interface OfferFacts {
  /** The court's final answer. 'reject' only appears on blocked offers. */
  court: FinePrintVerdict;
  /** Plain-English catches ("signs you up for a paid plan"), for "Approved with a catch" and "Blocked". */
  catches: string[];
  /** Auto-renewing trials and required memberships found in the fine print. */
  subscriptionTraps: number;
  /** Fees the fine print makes you pay (shipping, handling), in cents. */
  hiddenFeeCents: number;
  /** true = the AI court was off, so only the code rules read the fine print. Said on the card. */
  ruleCheckOnly: boolean;
  /** Face value minus hidden fees; null when no dollar figure is known. */
  trueValueCents: number | null;
  /** The cautious (upper) minutes estimate. */
  minutes: number;
  /** Whole days old the baby is on the run's date (negative while the baby is still due), and the ages the offer fits. */
  ageDays: number | null;
  minAgeDays: number | null;
  maxAgeDays: number | null;
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
  /** How many saved offers the court looked through for this family (before the baby's age narrowed them). Absent on older saved runs. */
  offersOnFile?: number;
}
export interface Family {
  id: string; userId: string | null; isGuest: boolean; name: string;
  birthDate: string | null; dueDate: string | null; zip: string; state: string;
  employer: string; householdSize: number; annualIncomeCents: number | null;
  dcfsaOffered: boolean; dataConnected: boolean;
  /** V2 onboarding answers (optional: older families don't have them). */
  household?: Household | null; parent1Work?: WorkStatus | null; parent2Work?: WorkStatus | null;
  insurance?: InsuranceType | null;
}

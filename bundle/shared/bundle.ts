export type CardKind = 'clawback' | 'recall' | 'discount' | 'benefit' | 'coming_soon';
export type Verdict = 'verified' | 'likely' | 'all_clear' | 'info' | 'blocked';
export interface Source { label: string; url: string }
export interface FeedCard {
  id: string; kind: CardKind; title: string; body: string;
  amountCents: number | null; deadline: string | null; // ISO date
  verdict: Verdict; sources: Source[]; traceId: string;
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
}
export interface Family {
  id: string; userId: string | null; isGuest: boolean; name: string;
  birthDate: string | null; dueDate: string | null; zip: string; state: string;
  employer: string; householdSize: number; annualIncomeCents: number | null;
  dcfsaOffered: boolean; dataConnected: boolean;
}

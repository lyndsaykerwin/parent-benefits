// Shared by the server and the screen: the live offer search, the "Audit a deal" form and the offer report card.
import type { FeedCard, FinePrintVerdict, OfferFacts } from './bundle';

/** How many trusted baby-offer pages the live search reads (server/offers/liveSearch.ts has the list, and a test keeps both equal). */
export const OFFER_SITES_COUNT = 14;

/**
 * GET /api/offer-search.
 *  - 'live': the search ran. `cards` are new offers the court has already graded (may be empty).
 *  - 'practice': practice mode skips the search on purpose.
 * Any failure (no key, no internet, too slow) is a non-200 answer; the screen then quietly keeps the saved offers.
 */
export type LiveSearchReply =
  | { mode: 'live'; sitesSearched: number; searchedOn: string; cards: FeedCard[] }
  | { mode: 'practice' };

/** POST /api/offers/audit: what a parent typed (the fine print is pasted text OR a screenshot, never both). */
export interface AuditRequest { store: string; offer: string; link?: string; text?: string; imageBase64?: string; mimeType?: string }

export interface AuditReply {
  verdict: FinePrintVerdict;
  /** One plain sentence about what the court found. */
  summary: string;
  /** 'full' = the AI court ran (or a saved full verdict was reused). 'quick' = only the code rules ran (practice mode, or the AI was unavailable). */
  mode: 'full' | 'quick';
  /** true = on the shared list for other parents. */
  saved?: boolean;
  /** true = another parent had already audited this exact offer, so the saved verdict came back at once. */
  repeat?: boolean;
  /** true = the text held hidden orders aimed at the AI reviewer; they were ignored and nothing was saved. */
  injection?: boolean;
  /** How many offers on the shared list came from parents (only when saved). */
  sharedFromParents?: number;
  facts?: OfferFacts;
  /** What each side of the court argued (full mode only). */
  hunter?: string;
  lawyer?: string;
}

/** GET /api/offers/report-card: the brand totals from /api/offer-audit plus how much of it came from parents. */
export interface ReportCardReply {
  status: 'found' | 'none' | 'unavailable';
  brands: { store: string; offersChecked: number | null; offersCaught: number | null; fromParents: number }[];
  /** Offers on the shared list that parents audited. */
  fromParents: number;
  message?: string;
}

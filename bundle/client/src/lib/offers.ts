// Deals (Story 5): the live offer search, "Audit a deal", the offer report card, and the plain-English lines an offer card shows.
// Pure helpers plus three small server calls. Nothing here is typed-in data: every figure comes from the server's court result.
import type { FeedCard, FinePrintVerdict, OfferFacts } from '@shared/bundle';
import { OFFER_SITES_COUNT, type AuditReply, type AuditRequest, type LiveSearchReply, type ReportCardReply } from '@shared/offers';
import { fmtUsd, fmtUsdShort, type FamilyView } from './bundle';
import { daysUntil } from './bundle';
import { catchWord } from './tabs';

export { OFFER_SITES_COUNT };
/** The live search gives up after this long and quietly keeps the saved offers (R3). */
export const SEARCH_TIMEOUT_MS = 10_000;

// ---------- status line ----------

export const SEARCHING_LINE = `Searching ${OFFER_SITES_COUNT} trusted baby-offer sites for new offers…`;
export const NO_NEW_OFFERS_LINE = 'No new offers right now. Showing your checked offers.';

/** "Day 20" for a born baby, "due in 44 days" for an expecting family, otherwise null. */
export function babyDayLabel(f: FamilyView | undefined, today?: string): string | null {
  if (!f) return null;
  if (f.birthDate) return `Day ${Math.max(0, -daysUntil(f.birthDate, today))}`;
  if (f.dueDate) { const d = daysUntil(f.dueDate, today); return d > 0 ? `due in ${d} days` : 'due now'; }
  return null;
}

/** The practice-mode line: the real number of saved offers and the real day. */
export function checkingLine(offersOnFile: number | undefined, f: FamilyView | undefined, today?: string): string {
  const day = babyDayLabel(f, today);
  const n = typeof offersOnFile === 'number' ? `${offersOnFile} saved offer${offersOnFile === 1 ? '' : 's'}` : 'saved offers';
  return `Checking ${n} against your baby’s age${day ? ` (${day})` : ''}`;
}

export const foundLine = (sites: number, count: number): string =>
  `Searched ${sites} trusted baby-offer sites · ${count === 0 ? 'no new offers today' : `${count} new offer${count === 1 ? '' : 's'} found today`}`;

// ---------- the lines on an offer card (R5) ----------

const months = (days: number) => Math.max(0, Math.round(days / 30.4));
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export interface FactLine { icon: string; text: string; note?: string; tone: 'good' | 'catch' | 'blocked' | 'plain' }

/** "Fine print: OK (no subscription traps, no hidden fees)", "Fine print: OK, with a catch: …" or "Fine print: Blocked: …". */
export function courtLine(f: OfferFacts): FactLine {
  const note = f.ruleCheckOnly ? 'Quick check only. Read the terms before you sign up.' : undefined;
  if (f.court === 'approve_with_catch') return { icon: '🛡️', text: `Fine print: OK, with a catch: ${f.catches.join('; ') || 'read the fine print'}`, tone: 'catch', note };
  if (f.court === 'reject') return { icon: '🛡️', text: `Fine print: Blocked: ${f.catches.join('; ') || 'a catch in the fine print'}`, tone: 'blocked', note };
  const traps = f.subscriptionTraps === 0 ? 'no subscription traps' : plural(f.subscriptionTraps, 'subscription trap', 'subscription traps');
  const fees = f.hiddenFeeCents === 0 ? 'no hidden fees' : `${fmtUsd(f.hiddenFeeCents)} hidden fees`;
  return { icon: '🛡️', text: `Fine print: OK (${traps}, ${fees})`, tone: 'good', note };
}

/** "About 5 minutes". The server's cautious (upper) estimate, said as a single number. */
export const minutesLine = (f: OfferFacts): FactLine => ({ icon: '⏱️', text: `About ${f.minutes} ${f.minutes === 1 ? 'minute' : 'minutes'}`, tone: 'plain' });

/** "True value $35", or an honest "no dollar amount stated" when neither the fine print nor the offer names one. */
export const valueLine = (f: OfferFacts): FactLine =>
  ({ icon: '💵', text: f.trueValueCents !== null ? `True value ${fmtUsdShort(f.trueValueCents)}` : 'True value not stated (no dollar amount in the offer)', tone: 'plain' });

/** "Your baby is 20 days old. This offer is for babies 0–12 months." */
export function ageLine(f: OfferFacts): string | null {
  if (f.ageDays === null || f.maxAgeDays === null) return null;
  const range = `${months(Math.max(0, f.minAgeDays ?? 0))}–${Math.max(1, months(f.maxAgeDays))} months`;
  const who = f.ageDays < 0 ? `Your baby is due in ${plural(-f.ageDays, 'day', 'days')}.` : `Your baby is ${plural(f.ageDays, 'day', 'days')} old.`;
  return `${who} This offer is for babies ${range}.`;
}

export const factLines = (f: OfferFacts): FactLine[] => [courtLine(f), minutesLine(f), valueLine(f)];

/** Best first by what the offer is worth to the parent. Never by commission: no commission figure exists anywhere in the app. */
export function orderDeals(cards: FeedCard[]): FeedCard[] {
  const worth = (c: FeedCard) => c.offerFacts?.trueValueCents ?? c.valueScore?.trueValueCents ?? c.amountCents ?? -1;
  return cards.map((c, i) => ({ c, i })).sort((a, b) => worth(b.c) - worth(a.c) || a.i - b.i).map((x) => x.c);
}

const sameLink = (u: string) => u.replace(/^https?:\/\/(www\.)?/i, '').replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
/** New finds that are not already one of the saved offers (same page address or same title). */
export function onlyNew(found: FeedCard[], saved: FeedCard[]): FeedCard[] {
  const links = new Set(saved.flatMap((c) => c.sources.map((s) => sameLink(s.url))));
  const titles = new Set(saved.map((c) => c.title.trim().toLowerCase()));
  return found.filter((c) => !c.sources.some((s) => links.has(sameLink(s.url))) && !titles.has(c.title.trim().toLowerCase()));
}

// ---------- server calls ----------

export type SearchResult =
  | { kind: 'practice' }
  | { kind: 'live'; cards: FeedCard[]; sitesSearched: number }
  | { kind: 'quiet' };

/** Asks the live search. Every failure (no key, no internet, timeout, odd answer) comes back as 'quiet', never as an error. */
export async function searchOffers(signal?: AbortSignal): Promise<SearchResult> {
  try {
    const res = await fetch('/api/offer-search', { signal });
    if (res.status === 404) return { kind: 'practice' }; // the server does not know the route: stay in practice mode
    if (!res.ok) return { kind: 'quiet' };
    const body = (await res.json()) as Partial<LiveSearchReply>;
    if (body.mode === 'practice') return { kind: 'practice' };
    if (body.mode === 'live' && Array.isArray(body.cards)) {
      const cards = body.cards.filter((c): c is FeedCard => !!c && typeof c.id === 'string' && typeof c.title === 'string' && Array.isArray(c.sources));
      return { kind: 'live', cards, sitesSearched: typeof body.sitesSearched === 'number' ? body.sitesSearched : OFFER_SITES_COUNT };
    }
    return { kind: 'quiet' };
  } catch { return { kind: 'quiet' }; }
}

export async function sendAudit(body: AuditRequest): Promise<AuditReply> {
  let res: Response;
  try {
    res = await fetch('/api/offers/audit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch { throw new Error('We could not reach Bundle. Check your connection and try again.'); }
  const json = (await res.json().catch(() => ({}))) as Partial<AuditReply> & { error?: string };
  if (!res.ok) throw new Error(json.error || 'We could not check that deal just now. Please try again.');
  if (!json.verdict || typeof json.summary !== 'string') throw new Error('We could not check that deal just now. Please try again.');
  return json as AuditReply;
}

/** The report card, or null when it is not available (it is simply left out then). */
export async function fetchReportCard(): Promise<ReportCardReply | null> {
  try {
    const res = await fetch('/api/offers/report-card');
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<ReportCardReply>;
    return body && body.status === 'found' && Array.isArray(body.brands) && body.brands.length ? (body as ReportCardReply) : null;
  } catch { return null; }
}

export const verdictLabel: Record<FinePrintVerdict, string> = { approve: 'OK', approve_with_catch: 'OK, with a catch', reject: 'Blocked' };

/** A saved grading lesson ("… graded approve_with_catch …; catches: required_membership") in plain words, using the same labels as the offer cards. */
export function plainLesson(text: string): string {
  return text
    .replace(/\bgraded (approve_with_catch|approve|reject)\b/g, (_, v: FinePrintVerdict) => `graded ${verdictLabel[v].toLowerCase()}`)
    .replace(/\bcatches: ([a-z_]+(?:, [a-z_]+)*)/g, (_, list: string) => `catches: ${list.split(', ').map(catchWord).join(', ')}`);
}

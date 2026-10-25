/**
 * Live offer search (plans/v2-build-plan.md, R3). Tavily searches the trusted baby-offer pages below; every result goes through the
 * Fine Print Court before a parent sees it. It never blocks the Deals screen (the screen shows saved offers at once and asks this in
 * the background), and a missing key behaves exactly like a failed search: the route answers "unavailable" and the screen quietly keeps
 * the saved offers.
 *
 * Cost: one basic search is one Tavily credit. The answer is kept for a few hours, so opening Deals twenty times costs one credit.
 * Nothing found here is ever added to a family's money totals; these cards live on the Deals screen only.
 */
import crypto from 'node:crypto';
import { tavily } from '@tavily/core';
import type { FeedCard } from '../../shared/bundle';
import { OFFER_SITES_COUNT, type LiveSearchReply } from '../../shared/offers';
import type { Generator } from '../adapters/llm';
import type { BundleMemory } from '../adapters/memory';
import { judgeText } from '../agents/finePrintCourt';
import { buildOfferFacts } from '../agents/offerFacts';
import { TraceLogger } from '../agents/trace';
import type { AgentContext } from '../agents/types';
import { valueScore, worthSettings } from '../agents/valueScore';
import { fmtUsd } from '../agents/sql';
import type { ZetarisClient } from '../adapters/zetaris';

/** The 14 trusted pages (research/v2-offers-research.md, checked Oct 25, 2026). Only these sites are searched, and only results from them are kept. */
export const ALLOW_LIST: { store: string; title: string; url: string }[] = [
  { store: 'Amazon', title: 'Amazon Baby Registry', url: 'https://www.amazon.com/baby-reg/homepage' },
  { store: 'Amazon', title: 'Amazon Welcome Box rules', url: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=GBLXVKVYG5SBG8HF' },
  { store: 'Target', title: 'Target baby registry welcome kit', url: 'https://www.target.com/help/article/000062588' },
  { store: 'Target', title: 'Target registry completion coupon', url: 'https://www.target.com/help/article/000062273' },
  { store: 'Walmart', title: 'Walmart baby registry and welcome box', url: 'https://www.walmart.com/cp/baby-registry/1229485' },
  { store: 'Walmart', title: 'Walmart welcome box offer rules', url: 'https://www.walmart.com/help/article/baby-registry-gift-box-offer/9cd45411397d425b8e88bc89583deb62' },
  { store: 'Babylist', title: 'Babylist Hello Baby Box', url: 'https://www.babylist.com/hello-baby/babylist-hello-baby-box' },
  { store: 'Pampers', title: 'Pampers Club rewards', url: 'https://www.pampers.com/en-us/rewards' },
  { store: 'Huggies', title: 'Huggies Rewards', url: 'https://www.huggies.com/en-us/rewards' },
  { store: 'Enfamil', title: 'Enfamil Family Beginnings', url: 'https://www.enfamil.com/help-center/enfamil-family-beginnings/' },
  { store: 'Similac', title: 'MySimilac Rewards', url: 'https://www.similac.com/rewards.html' },
  { store: 'Aeroflow', title: 'Aeroflow (insurance-covered breast pumps)', url: 'https://aeroflowbreastpumps.com/' },
  { store: 'Byram Healthcare', title: 'Byram Healthcare (insurance breast pumps)', url: 'https://www.byramhealthcare.com/' },
  { store: 'Massachusetts WIC', title: 'Massachusetts WIC', url: 'https://www.mass.gov/wic' },
];

/** The sites those pages sit on: what Tavily is told to search (include_domains), and what a result's address must belong to. */
export const ALLOW_DOMAINS = [...new Set(ALLOW_LIST.map((p) => new URL(p.url).hostname.replace(/^www\./, '')))];

const STORE_BY_DOMAIN: Record<string, string> = Object.fromEntries(ALLOW_LIST.map((p) => [new URL(p.url).hostname.replace(/^www\./, ''), p.store]));

/** The store a result belongs to, or null when its address is not on one of the trusted sites. */
export function storeForUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const hit = ALLOW_DOMAINS.find((d) => host === d || host.endsWith(`.${d}`));
    return hit ? STORE_BY_DOMAIN[hit] : null;
  } catch { return null; }
}

const QUERY = 'free baby welcome box newborn registry sample offer rewards for new parents';
const MAX_RESULTS = 8;
const MAX_JUDGED = 6;
/** The search call gives up after this long; the screen gives up on its own at 10 seconds. */
const TAVILY_SECONDS = 8;
const CACHE_MS = 6 * 60 * 60 * 1000;

interface TavilyLikeResult { title?: string; url?: string; content?: string; rawContent?: string }
export interface SearchClient {
  search(query: string, options: Record<string, unknown>): Promise<{ results: TavilyLikeResult[] }>;
}

export interface LiveSearchDeps {
  llm: Generator;
  memory: BundleMemory;
  today: string;
  /** The Tavily key. Missing = the search cannot run (the same quiet outcome as a failed search). */
  apiKey?: string;
  /** Tests inject a fake client. */
  client?: SearchClient;
  /** Where each graded result's trace file goes (default: logs/). */
  logsDir?: string;
}

/** "Unavailable" is not an error to show: the screen swaps its status line and keeps the saved offers. */
export class LiveSearchUnavailable extends Error {
  constructor(public reason: 'no_key' | 'failed') { super(reason === 'no_key' ? 'TAVILY_API_KEY is not set' : 'the live search failed'); }
}

const NO_ZETARIS = { runQuery: async () => { throw new Error('a live offer has no saved-offer lookup'); }, withTrace() { return this; } } as unknown as ZetarisClient;
const STUB_FAMILY = {
  id: 'live-search', userId: null, isGuest: true, name: 'Live search', birthDate: null, dueDate: null, zip: '', state: '', employer: '',
  householdSize: 1, annualIncomeCents: null, dcfsaOffered: false, dataConnected: false,
};

const cleanTitle = (t: string) => t.replace(/\s+/g, ' ').replace(/\s*[|–—-]\s*[^|–—-]{0,30}$/, '').trim().slice(0, 120);
/** A dollar amount the page names in its headline ("Free $25 sample pack"), in cents; null when the headline names none. */
export function headlineCents(title: string): number | null {
  const m = /\$\s?(\d{1,4})(?:\.(\d\d))?\b/.exec(title);
  return m ? Number(m[1]) * 100 + Number(m[2] ?? 0) : null;
}

/** One search result through the court, as a card. null = not shown (not a trusted site, hidden orders, or the court blocked it). */
async function gradeResult(r: TavilyLikeResult, deps: LiveSearchDeps): Promise<FeedCard | null> {
  const url = String(r.url ?? '');
  const store = storeForUrl(url);
  const title = cleanTitle(String(r.title ?? ''));
  const finePrint = String(r.rawContent || r.content || '').replace(/\s+/g, ' ').trim().slice(0, 6000);
  if (!store || !title || !finePrint) return null;
  const runId = `live_${crypto.randomBytes(6).toString('hex')}`;
  const trace = new TraceLogger(runId, deps.logsDir);
  const ctx: AgentContext = { runId, family: STUB_FAMILY, z: NO_ZETARIS, llm: deps.llm, memory: deps.memory, trace, today: deps.today };
  const face = headlineCents(title);
  const j = await judgeText(ctx, { store, title, finePrint, sourceUrl: url, valueCents: face });
  // Hidden orders aimed at the AI reviewer: drop the result entirely. A blocked offer is not shown as a new find either.
  if (j.check.injectionDetected || j.verdict === 'reject') return null;
  const facts = buildOfferFacts({ check: j.check, verdict: j.verdict, faceCents: face, ruleCheckOnly: j.usedFallback });
  const amountCents = facts.trueValueCents;
  const traceId = trace.lines().filter((l) => l.agent_name === 'judge').pop()?.trace_id ?? '';
  return {
    id: `live-${crypto.createHash('sha256').update(url).digest('hex').slice(0, 12)}`,
    kind: 'discount', title,
    body: `${store} has an offer${amountCents !== null ? ` worth about ${fmtUsd(amountCents)}` : ''}. ${j.verdict === 'approve_with_catch' ? `Approved with a catch: ${j.check.reasons.join('; ')}.` : 'Our fine-print check found nothing that makes it costly.'}`,
    amountCents, deadline: null, verdict: 'likely', sources: [{ label: `${store} offer page`, url }], traceId,
    valueScore: valueScore(j.check, worthSettings()), offerFacts: facts, foundOn: deps.today, isNew: true,
  };
}

/** Searches the trusted pages and grades what comes back. Throws LiveSearchUnavailable when it cannot search. */
export async function runLiveSearch(deps: LiveSearchDeps): Promise<Extract<LiveSearchReply, { mode: 'live' }>> {
  const client = deps.client ?? (deps.apiKey ? (tavily({ apiKey: deps.apiKey }) as unknown as SearchClient) : null);
  if (!client) throw new LiveSearchUnavailable('no_key');
  let found: TavilyLikeResult[];
  try {
    const res = await client.search(QUERY, {
      searchDepth: 'basic', maxResults: MAX_RESULTS, includeDomains: ALLOW_DOMAINS, includeDomainsMode: 'restrict',
      timeRange: 'month', includeRawContent: 'text', timeout: TAVILY_SECONDS,
    });
    found = Array.isArray(res?.results) ? res.results : [];
  } catch { throw new LiveSearchUnavailable('failed'); }
  // Belt and braces: Tavily is told to stay on these sites, and anything that is not on them is dropped here too. One card per page.
  const seen = new Set<string>();
  const onList = found.filter((r) => { const u = String(r.url ?? ''); if (!storeForUrl(u) || seen.has(u)) return false; seen.add(u); return true; }).slice(0, MAX_JUDGED);
  const graded = await Promise.all(onList.map((r) => gradeResult(r, deps).catch(() => null)));
  return { mode: 'live', sitesSearched: OFFER_SITES_COUNT, searchedOn: deps.today, cards: graded.filter((c): c is FeedCard => c !== null) };
}

/** Keeps one answer for a few hours (and shares one running search between visitors), so Deals can be opened freely without spending credits. */
export function createLiveSearchCache(run: () => Promise<Extract<LiveSearchReply, { mode: 'live' }>>, now: () => number = Date.now) {
  let cached: { at: number; day: string; reply: Extract<LiveSearchReply, { mode: 'live' }> } | null = null;
  let inflight: Promise<Extract<LiveSearchReply, { mode: 'live' }>> | null = null;
  return {
    get(day: string): Promise<Extract<LiveSearchReply, { mode: 'live' }>> {
      if (cached && cached.day === day && now() - cached.at < CACHE_MS) return Promise.resolve(cached.reply);
      if (!inflight) {
        inflight = run().then((reply) => { cached = { at: now(), day, reply }; return reply; }).finally(() => { inflight = null; });
        inflight.catch(() => undefined); // a failure reaches the waiting request; here it just must not go unhandled
      }
      return inflight;
    },
    clear() { cached = null; },
  };
}

// The key is read here and nowhere else; it is never logged or sent to the screen.
export const tavilyKey = (env: NodeJS.ProcessEnv = process.env): string => (env.TAVILY_API_KEY ?? '').trim();

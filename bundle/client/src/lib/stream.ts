import type { FeedCard, CardKind, Source } from '@shared/bundle';
import { pollRun, type PollApi, type PollHandlers } from './poll';

/**
 * Live updates for the "Checking" screen: cards show up as each one is ready, plus short status pills.
 * The server sends them over a one-way connection (server-sent events) at GET /api/runs/:runId/events.
 * If that connection is missing or breaks, we quietly go back to asking once a second (poll.ts).
 *
 * Event shape = RunEvent in server/agents/runEvents.ts. Each message is sent under its type name
 * (card_ready, card_updated, card_removed, agent_status), with the event as JSON in `data`. A plain
 * unnamed message with the type inside the data works too. An `end` message means the run is over.
 */

export type AgentState = 'waiting' | 'working' | 'done' | 'failed';

/** The server's event (cards here may hold owner-only fields; we strip them before keeping anything). */
export type StreamEvent = { runId?: string; seq?: number; at?: string } & (
  | { type: 'card_ready'; card: FeedCard }
  | { type: 'card_updated'; card: FeedCard }
  | { type: 'card_removed'; cardId: string; reason?: string }
  | { type: 'agent_status'; agent: string; state: AgentState; label?: string }
);

export interface StreamState {
  /** Cards that are ready, most urgent first. Parent-safe fields only. */
  cards: FeedCard[];
  /** Ids the server took back; a saved copy of these must not be shown either. */
  removed: string[];
  agents: Record<string, AgentState>;
  /** Order in which agents first reported, so pills stay in a steady order. */
  order: string[];
  lastSeq: number;
}

export const emptyStream = (): StreamState => ({ cards: [], removed: [], agents: {}, order: [], lastSeq: 0 });

// ---------- parent whitelist (same fields as PARENT_CARD_KEYS in bundleRoutes.ts) ----------

const KINDS: CardKind[] = ['recall', 'clawback', 'benefit', 'discount', 'coming_soon'];
const VERDICTS = ['verified', 'likely', 'all_clear', 'info', 'blocked'];

/** Copy a card field by field. Anything not listed (trace ids, debate, SQL, rule text) never gets in. Returns null for junk. */
export function sanitizeCard(c: unknown): FeedCard | null {
  if (!c || typeof c !== 'object') return null;
  const x = c as Record<string, unknown>;
  if (typeof x.id !== 'string' || typeof x.title !== 'string' || !KINDS.includes(x.kind as CardKind) || !VERDICTS.includes(x.verdict as string)) return null;
  const sources: Source[] = Array.isArray(x.sources)
    ? x.sources.filter((s): s is Source => !!s && typeof (s as Source).url === 'string').map((s) => ({ label: String((s as Source).label ?? ''), url: (s as Source).url }))
    : [];
  return {
    id: x.id, kind: x.kind as CardKind, title: x.title, body: typeof x.body === 'string' ? x.body : '',
    amountCents: typeof x.amountCents === 'number' ? x.amountCents : null,
    deadline: typeof x.deadline === 'string' ? x.deadline : null,
    verdict: x.verdict as FeedCard['verdict'], sources,
  } as FeedCard;
}

/** Recalls first (safety), then money back, benefits, deals, coming soon; nearest deadline first inside a kind. */
export function sortCards(cards: FeedCard[]): FeedCard[] {
  return cards
    .map((c, i) => ({ c, i }))
    .sort((a, b) =>
      KINDS.indexOf(a.c.kind) - KINDS.indexOf(b.c.kind)
      || (a.c.deadline ?? '9999').localeCompare(b.c.deadline ?? '9999')
      || a.i - b.i)
    .map((x) => x.c);
}

// ---------- applying events ----------

export function applyEvent(s: StreamState, e: StreamEvent): StreamState {
  if (!e || typeof e !== 'object') return s;
  if (typeof e.seq === 'number') {
    if (e.seq <= s.lastSeq) return s; // already seen (a replay after reconnecting)
  }
  const lastSeq = typeof e.seq === 'number' ? e.seq : s.lastSeq;
  switch (e.type) {
    case 'card_ready':
    case 'card_updated': {
      const card = sanitizeCard(e.card);
      if (!card) return s;
      // A blocked offer is never shown as a ready card; if it replaces a card we showed, the card goes away.
      const rest = s.cards.filter((c) => c.id !== card.id);
      const cards = card.verdict === 'blocked' ? rest : sortCards([...rest, card]);
      return { ...s, cards, removed: s.removed.filter((id) => id !== card.id), lastSeq };
    }
    case 'card_removed': {
      if (typeof e.cardId !== 'string') return s;
      return { ...s, cards: s.cards.filter((c) => c.id !== e.cardId), removed: s.removed.includes(e.cardId) ? s.removed : [...s.removed, e.cardId], lastSeq };
    }
    case 'agent_status': {
      if (typeof e.agent !== 'string' || !['waiting', 'working', 'done', 'failed'].includes(e.state)) return s;
      const key = agentKey(e.agent);
      return { ...s, agents: { ...s.agents, [key]: e.state }, order: s.order.includes(key) ? s.order : [...s.order, key], lastSeq };
    }
    default:
      return s;
  }
}

// ---------- status pills (parent words only: no agent names) ----------

const ALIASES: Record<string, string> = { fine_print_court: 'court', factchecker: 'fact_checker' };
const agentKey = (agent: string) => ALIASES[agent.toLowerCase()] ?? agent.toLowerCase();

const PILL_WORDS: Record<string, Record<AgentState, string>> = {
  clawback: { waiting: 'Money check coming up', working: 'Looking for money you can get back…', done: 'Money check finished', failed: 'Couldn’t finish the money check' },
  recall: { waiting: 'Recall check coming up', working: 'Checking recalls…', done: 'Recall check finished', failed: 'Couldn’t finish the recall check' },
  benefits: { waiting: 'Program check coming up', working: 'Checking programs and deadlines…', done: 'Programs and deadlines checked', failed: 'Couldn’t finish the program check' },
  court: { waiting: 'Deal check coming up', working: 'Reading the fine print on deals…', done: 'Deal fine print checked', failed: 'Couldn’t finish the deal check' },
  fact_checker: { waiting: 'Final check coming up', working: 'Double-checking each card against its source…', done: 'Every card double-checked', failed: 'Couldn’t finish the final check' },
};
const GENERIC: Record<AgentState, string> = { waiting: 'Getting ready…', working: 'Working on your results…', done: 'Step finished', failed: 'One step didn’t finish' };
const PILL_ORDER = Object.keys(PILL_WORDS);

export interface Pill { key: string; state: AgentState; text: string }

export function pillLines(s: StreamState): Pill[] {
  const known = PILL_ORDER.filter((k) => s.agents[k]);
  const other = s.order.filter((k) => !PILL_WORDS[k]);
  return [...known, ...other].map((key) => {
    const state = s.agents[key];
    return { key, state, text: (PILL_WORDS[key] ?? GENERIC)[state] };
  });
}

// ---------- the connection ----------

/** If nothing at all arrives for this long, we stop trusting the stream and ask the server directly. */
export const STREAM_STALL_MS = 45_000;
const EVENT_TYPES = ['card_ready', 'card_updated', 'card_removed', 'agent_status'] as const;

export interface FollowHandlers extends PollHandlers {
  /** Called with the newest stream state each time something arrives. */
  onStream: (s: StreamState) => void;
}
export interface FollowOptions {
  /** Pass null to force polling only. Defaults to the browser's EventSource when there is one. */
  EventSourceCtor?: typeof EventSource | null;
  intervalMs?: number;
}

/**
 * Watch a run: stream cards and pills if the browser and server allow it, and always finish through
 * pollRun, so the final screen is exactly the saved result. Returns a stop function.
 */
export function followRun(runId: string, api: PollApi, h: FollowHandlers, opts: FollowOptions = {}): () => void {
  const Ctor = opts.EventSourceCtor === undefined ? (typeof EventSource !== 'undefined' ? EventSource : null) : opts.EventSourceCtor;
  let stopped = false;
  let stopPoll: (() => void) | null = null;
  let es: EventSource | null = null;
  let stall: ReturnType<typeof setTimeout> | undefined;
  let state = emptyStream();

  const startPolling = () => {
    if (stopped || stopPoll) return;
    if (stall) clearTimeout(stall);
    try { es?.close(); } catch { /* already closed */ }
    stopPoll = pollRun(runId, api, h, opts.intervalMs ?? 1000);
  };

  const feed = (raw: unknown) => {
    if (stopped) return;
    try {
      const e = (typeof raw === 'string' ? JSON.parse(raw) : raw) as StreamEvent;
      armStall();
      const next = applyEvent(state, e);
      if (next !== state) { state = next; h.onStream(state); }
    } catch { /* one bad message must not break the stream */ }
  };

  const armStall = () => {
    if (stall) clearTimeout(stall);
    stall = setTimeout(startPolling, STREAM_STALL_MS);
  };

  if (!Ctor) {
    startPolling();
  } else {
    try {
      es = new Ctor(`/api/runs/${encodeURIComponent(runId)}/events`);
      for (const t of EVENT_TYPES) es.addEventListener(t, (m) => feed((m as MessageEvent).data));
      es.addEventListener('end', () => startPolling());
      es.onmessage = (m) => feed(m.data);
      es.onerror = () => startPolling();
      armStall();
    } catch {
      startPolling();
    }
  }

  return () => {
    stopped = true;
    if (stall) clearTimeout(stall);
    try { es?.close(); } catch { /* ignore */ }
    stopPoll?.();
  };
}

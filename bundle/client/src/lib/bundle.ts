import type { BundleResult, FeedCard, CardKind, Source, Verdict } from '@shared/bundle';

/** One line of the agents' audit trail, as served by GET /api/runs/:runId/trace. */
export interface TraceLine {
  timestamp: string;
  trace_id: string;
  agent_name: string;
  action: string;
  input_summary: string;
  output_summary: string;
  target_agent: string | null;
  confidence: number | null;
  retry_count: number;
  status: 'ok' | 'retry' | 'blocked' | 'fallback' | 'error';
}

export interface FamilyView { name: string; birthDate: string | null; dueDate: string | null; /** 2-letter state from the ZIP, when the server sends it */ state?: string }

export interface RunStatus {
  runId: string;
  familyId: string;
  status: 'running' | 'done' | 'failed';
  startedAt: string;
  family?: FamilyView;
  today?: string;
  /** true for the sample families, which are evaluated at a fixed demo date */
  demoDate?: boolean;
  result: BundleResult | null;
  error: string | null;
}

// ---------- money and dates ----------

/** 2899 -> "$28.99". Cards always show cents so amounts are exact. */
export function fmtUsd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/** Receipt headline numbers: drop ".00" so big totals read cleanly ("$3,640", "$48.99"). */
export function fmtUsdShort(cents: number): string {
  const whole = cents % 100 === 0;
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2,
  });
}

export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const dayMs = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Whole days from today to an ISO date (negative when it has passed). */
export function daysUntil(iso: string, today: string = localToday()): number {
  return Math.round((utc(iso) - utc(today)) / dayMs);
}

/** "2026-11-02" -> "Nov 2" (adds the year when it is not this year's). */
export function fmtDate(iso: string, today: string = localToday()): string {
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC' });
}

/** Deadlines within this many days are shown as a countdown in coral; later ones as a calm date. */
export const URGENT_DAYS = 30;

export function deadlineText(iso: string, today?: string): string {
  const d = daysUntil(iso, today);
  if (d < 0) return `Closed ${fmtDate(iso, today)}`;
  if (d === 0) return 'Due today';
  if (d === 1) return '1 day left';
  return `${d} days left`;
}

/** Header chip, e.g. "Baby Maya · day 20" or "Baby due in 45 days". */
export function familyChip(f: FamilyView | undefined, today?: string): string | null {
  if (!f) return null;
  const first = f.name.replace(/\s*\(.*\)\s*$/, '').trim() || 'Baby';
  if (f.birthDate) return `Baby ${first} · day ${Math.max(0, -daysUntil(f.birthDate, today))}`;
  if (f.dueDate) {
    const d = daysUntil(f.dueDate, today);
    return d > 0 ? `${first} · due in ${d} days` : `${first} · due now`;
  }
  return first;
}

/** "Demo date: Oct 23, 2026" for the sample families (they run at a fixed date), otherwise null. */
export function demoDateLabel(demoDate: boolean | undefined, today: string | undefined): string | null {
  if (!demoDate || !today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  return `Demo date: ${new Date(`${today}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`;
}

// ---------- cards ----------

export const KIND_META: Record<CardKind, { label: string; section: string; dot: string; text: string }> = {
  clawback: { label: 'Money back', section: 'Money back', dot: 'bg-kind-clawback', text: 'text-kind-clawback' },
  recall: { label: 'Recall', section: 'Safety check', dot: 'bg-kind-recall', text: 'text-kind-recall' },
  benefit: { label: 'Benefit', section: 'Benefits', dot: 'bg-coral', text: 'text-coral-deep' },
  discount: { label: 'Discount', section: 'Deals that passed Fine Print Court', dot: 'bg-kind-discount', text: 'text-kind-discount' },
  coming_soon: { label: 'Coming soon', section: 'Coming soon', dot: 'bg-ink-3', text: 'text-ink-2' },
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  verified: 'Verified',
  likely: 'Likely eligible',
  all_clear: 'All clear',
  info: 'Not yet verified',
  blocked: 'Blocked',
};

/** Only http(s) links are rendered, so a bad source URL (e.g. "javascript:") can never become a clickable link. */
export const safeSources = (sources: Source[]): Source[] => sources.filter((s) => /^https?:\/\//i.test(s.url));

export const isDcfsa = (c: FeedCard) => c.id.startsWith('clawback-dcfsa');
/** Work-based items we cannot see: the Dependent Care FSA and paid family leave. They get the gentle "Check with your job" card (no dollar amount, never in a total). */
export const isCheckWithJob = (c: FeedCard) => c.kind === 'benefit' && /^benefit-(dcfsa|.+_pfml?$|.+_pfl$)/.test(c.id);
/** The insurance card is pinned first only when it was actually checked; a "Not yet verified" stand-in is not promoted. */
export const isInsurance = (c: FeedCard) => c.kind === 'benefit' && /insurance/i.test(c.id) && c.verdict !== 'info';

/** The small word under a card amount. DCFSA is the family's own pre-tax money, so it is "eligible spend", never "money back". */
export function amountCaption(c: FeedCard): string | null {
  if (c.amountCents === null) return null;
  if (isCheckWithJob(c)) return null;
  if (c.verdict === 'info') return 'not yet verified';
  if (isDcfsa(c)) return 'eligible spend';
  if (c.kind === 'clawback') return 'money back';
  if (c.kind === 'benefit') return 'likely benefit';
  if (c.kind === 'discount') return 'savings';
  return null;
}

const ORDER: CardKind[] = ['clawback', 'recall', 'benefit', 'discount', 'coming_soon'];

/** Section title for deals that never went through Fine Print Court (bundled stand-ins shown when the court could not run). */
export const UNCHECKED_DEALS_SECTION = 'Offers not yet checked by Fine Print Court';

export interface CardGroup { kind: CardKind; cards: FeedCard[]; /** true = offers the court has not checked */ unchecked?: boolean }

/**
 * Pinned insurance card first, then groups in the fixed order clawback, recall, benefit, discount, coming_soon.
 * Discounts the court did not check (verdict "info") get their own group and title, never "passed Fine Print Court".
 */
export function groupCards(cards: FeedCard[]): { pinned: FeedCard | null; groups: CardGroup[] } {
  const pinned = cards.find(isInsurance) ?? null;
  const rest = cards.filter((c) => c !== pinned);
  const groups: CardGroup[] = [];
  for (const kind of ORDER) {
    if (kind === 'discount') {
      const checked = rest.filter((c) => c.kind === 'discount' && c.verdict !== 'info');
      const unchecked = rest.filter((c) => c.kind === 'discount' && c.verdict === 'info');
      if (checked.length) groups.push({ kind, cards: checked });
      if (unchecked.length) groups.push({ kind, cards: unchecked, unchecked: true });
    } else {
      const inKind = rest.filter((c) => c.kind === kind);
      if (inKind.length) groups.push({ kind, cards: inKind });
    }
  }
  return { pinned, groups };
}

// ---------- trace ----------

const AGENT_LABEL: Record<string, string> = {
  orchestrator: 'Orchestrator',
  clawback: 'Clawback Finder',
  recall: 'Recall Checker',
  benefits: 'Benefits Planner',
  fine_print_court: 'Fine Print Court',
  deal_hunter: 'Deal Hunter',
  fine_print_lawyer: 'Fine Print Lawyer',
  judge: 'Judge',
  fact_checker: 'Fact-Checker',
  memory: 'Memory',
  zetaris: 'Zetaris',
  fallback: 'Saved copy',
};

/** Deadline line for a card: a countdown when it is close, otherwise "By Oct 3, 2027" / "Ends Oct 3, 2027". */
export function cardDeadline(kind: CardKind, iso: string, today: string = localToday()): { text: string; urgent: boolean } {
  const d = daysUntil(iso, today);
  if (d <= URGENT_DAYS) return { text: deadlineText(iso, today), urgent: true };
  return { text: `${kind === 'discount' ? 'Ends' : 'By'} ${fmtDate(iso, today)}`, urgent: false };
}

export function agentLabel(name: string): string {
  return AGENT_LABEL[name] ?? name.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

const clip = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** A short plain-English sentence for one trace line (used in the live progress list). */
export function describeLine(l: TraceLine): string {
  const who = agentLabel(l.agent_name);
  if (l.status === 'fallback' && /model unavailable|no model answer/i.test(l.output_summary)) return `${who} used its backup check (AI offline)`;
  if (l.action === 'start') return 'Started your Bundle';
  if (l.action === 'retry_transient') return `A data source was slow, so we asked again (${l.input_summary})`;
  if (l.agent_name === 'fact_checker') {
    const kind = l.input_summary.split(' ')[0] || 'a';
    if (l.status === 'ok') return `Fact-Checker confirmed a ${kind} card`;
    if (l.status === 'retry') return `Fact-Checker sent 1 back: ${clip(l.output_summary, 70)}`;
    return `Fact-Checker dropped a ${kind} card: ${clip(l.output_summary, 60)}`;
  }
  if (l.agent_name === 'memory' && l.action === 'rule_recalled') {
    const [id, conf] = l.output_summary.split('|');
    const pct = Number.isFinite(Number(conf)) && conf !== '' ? ` (${Math.round(Number(conf) * 100)}%)` : '';
    return id ? `Memory recalled rule ${id}${pct}` : 'Memory recalled a rule';
  }
  if (l.agent_name === 'judge') return `Judge ruled on ${l.input_summary}: ${clip(l.output_summary.split(':')[0], 40)}`;
  if (l.action === 'explain') return `${who} wrote a plain-English explanation`;
  if (l.action === 'assemble') return `Built your feed: ${l.output_summary}`;
  return `${who}: ${clip(l.output_summary)}`;
}

/** The trace lines that belong to one card: its own line, the explanation just before it, court arguments, and the Fact-Checker's verdicts. */
export function traceForCard(card: FeedCard, lines: TraceLine[]): TraceLine[] {
  const keep = new Set<string>();
  const own = lines.findIndex((l) => l.trace_id === card.traceId);
  if (own >= 0) {
    keep.add(lines[own].trace_id);
    const prev = lines[own - 1];
    if (prev && prev.agent_name === lines[own].agent_name && prev.action === 'explain') keep.add(prev.trace_id);
  }
  const offerId = card.kind === 'discount' ? card.id.replace(/^(?:discount|blocked)-/, '') : null;
  for (const l of lines) {
    if (l.agent_name === 'fact_checker' && l.input_summary.includes(`card ${card.id} `)) keep.add(l.trace_id);
    if (offerId && l.input_summary === `offer ${offerId}`) keep.add(l.trace_id);
  }
  return lines.filter((l) => keep.has(l.trace_id));
}

// ---------- API ----------

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((body as { error?: string }).error || `Something went wrong (${res.status}).`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return body as T;
}

export type RunRequest = { familyId: string } | { zip: string; birthDate?: string; dueDate?: string; employer?: string };

export const api = {
  startRun: (body: RunRequest) =>
    fetch('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => json<{ runId: string }>(r)),
  run: (runId: string) => fetch(`/api/runs/${encodeURIComponent(runId)}`).then((r) => json<RunStatus>(r)),
  /** Newest saved result for a family (the instant feed). Rejects with the server's message (404) when there is none yet. */
  latestRun: (familyId: string) => fetch(`/api/families/${encodeURIComponent(familyId)}/latest-run`).then((r) => json<RunStatus>(r)),
  trace: (runId: string) => fetch(`/api/runs/${encodeURIComponent(runId)}/trace`).then((r) => json<TraceLine[]>(r)),
  feedback: (body: { familyId: string; cardId: string; kind: 'got_it' | 'issue'; note?: string }) =>
    fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => json<{ ok: true; proposals: unknown[] }>(r)),
  caseLaw: () => fetch('/api/case-law').then((r) => json<{ proposals: Proposal[]; approved: Proposal[] }>(r)),
  approve: (id: number, token: string) =>
    fetch(`/api/case-law/${id}/approve`, { method: 'POST', headers: { 'x-reviewer-token': token } }).then((r) => json<{ ok: true }>(r)),
  scoreboard: () => fetch('/api/scoreboard').then((r) => json<{ scoreboard: Scoreboard | null }>(r)),
};

export interface Proposal {
  id: number; text: string; confidence: number; sourceFeedbackIds: string[];
  status: 'proposed' | 'approved' | 'rejected'; memoryId: string | null;
}

export interface Scoreboard {
  trapsCaught: number; trapsTotal: number; falseAlarms: number; sourcedPct: number; runs: number; stable: boolean;
  learning?: { run1Approved: boolean; run2Blocked: boolean; citedRuleId: string | null };
  llm?: string;
}

// ---------- remembered runs (this tab only) ----------

const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };

export interface SavedRun { runId: string; familyId: string; family?: FamilyView; today?: string; demoDate?: boolean; result: BundleResult }

export function saveRun(r: SavedRun): void {
  safe(() => {
    sessionStorage.setItem(`bundle:run:${r.runId}`, JSON.stringify(r));
    sessionStorage.setItem('bundle:last', r.runId);
  }, undefined);
}

export function loadRun(runId?: string | null): SavedRun | null {
  return safe(() => {
    const id = runId || sessionStorage.getItem('bundle:last');
    if (!id) return null;
    const raw = sessionStorage.getItem(`bundle:run:${id}`);
    return raw ? (JSON.parse(raw) as SavedRun) : null;
  }, null);
}

export const reviewerToken = {
  get: () => safe(() => sessionStorage.getItem('bundle:reviewerToken') ?? '', ''),
  set: (t: string) => safe(() => (t ? sessionStorage.setItem('bundle:reviewerToken', t) : sessionStorage.removeItem('bundle:reviewerToken')), undefined),
};

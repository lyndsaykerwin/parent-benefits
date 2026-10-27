import type { BundleResult, FeedCard, CardKind, Household, InsuranceType, Source, Verdict, WorkStatus } from '@shared/bundle';

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

export interface FamilyView {
  name: string; birthDate: string | null; dueDate: string | null;
  /** 2-letter state from the ZIP, when the server sends it */
  state?: string;
  /** The ZIP the family gave (shown on the Account tab; absent on older saved runs). */
  zip?: string;
  /** The parent's Q4 and Q5 answers (null = prefer not to say; absent on runs saved before V2). */
  household?: Household | null; parent1Work?: WorkStatus | null; parent2Work?: WorkStatus | null; insurance?: InsuranceType | null;
  /** True when the family has saved purchases to check (the recall line on the checking screen shows only then). */
  hasItems?: boolean;
}

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

/**
 * Header chip, e.g. "Baby Maya · day 20" or "Leo · due in 45 days" for a sample family. A family the parent typed in is
 * "Your family · day 20" / "Your family · due in 45 days": onboarding never asks for a name, so none is shown (never "Baby Guest").
 * Typed in = a saved `guest-` id, or a name that is not a sample family's.
 */
export function familyChip(f: FamilyView | undefined, today?: string, familyId?: string): string | null {
  return familyChipParts(f, today, familyId)?.full ?? null;
}

/** The chip in two sizes: `short` is just who it is ("Maya", "Your family"), for a narrow phone header; `full` adds the stage. */
export function familyChipParts(f: FamilyView | undefined, today?: string, familyId?: string): { short: string; full: string } | null {
  if (!f) return null;
  const typedIn = (familyId !== undefined && /^guest-/.test(familyId)) || !/\(sample family\)\s*$/i.test(f.name ?? '');
  const first = f.name.replace(/\s*\(.*\)\s*$/, '').trim() || 'Baby';
  const short = typedIn ? 'Your family' : first;
  if (f.birthDate) return { short, full: `${typedIn ? 'Your family' : `Baby ${first}`} · day ${Math.max(0, -daysUntil(f.birthDate, today))}` };
  if (f.dueDate) {
    const d = daysUntil(f.dueDate, today);
    return { short, full: d > 0 ? `${short} · due in ${d} days` : `${short} · due now` };
  }
  return { short, full: short };
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
  discount: { label: 'Discount', section: 'Deals whose fine print checks out', dot: 'bg-kind-discount', text: 'text-kind-discount' },
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
export const UNCHECKED_DEALS_SECTION = 'Offers we haven’t checked yet';

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
  fine_print_court: 'Fine print check',
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

/** The answers from onboarding. Q4 and Q5 are left out when the parent chose "prefer not to say". */
export type RunRequest = { familyId: string } | {
  /** A saved family's id: the answers below then replace that family's answers (the check re-runs for the same family). */
  familyId?: string;
  zip: string; birthDate?: string; dueDate?: string; employer?: string;
  household?: Household; parent1Work?: WorkStatus; parent2Work?: WorkStatus; insurance?: InsuranceType;
};

/** localStorage key holding the id of the family saved at the end of onboarding. */
export const FAMILY_ID_KEY = 'bundle_family_id';
export function rememberFamilyId(id: string): void {
  try { localStorage.setItem(FAMILY_ID_KEY, id); } catch { /* storage blocked: the run still works */ }
}
/** The saved family's id in this browser, or null. */
export function savedFamilyId(): string | null {
  try { const id = localStorage.getItem(FAMILY_ID_KEY); return id && /^[A-Za-z0-9_-]{1,40}$/.test(id) ? id : null; } catch { return null; }
}

/** The finished run in a server reply, in the shape the screens keep. */
export function runFromStatus(s: RunStatus): SavedRun | null {
  return s.status === 'done' && s.result ? { runId: s.runId, familyId: s.familyId, family: s.family, today: s.today, demoDate: s.demoDate, result: s.result } : null;
}

/** What Bundle remembers about a family, and what it has learned from parents (the Account tab). */
export interface FamilyMemoryItem { id: string; text: string; source: string; savedOn: string }
export interface LearnedMemoryItem { id: string; text: string; reports: number | null }
export interface FamilyMemory { family: FamilyMemoryItem[]; learned: LearnedMemoryItem[] }

/** A server reply read defensively: anything that is not the expected shape counts as "nothing yet". */
export function readFamilyMemory(raw: unknown): FamilyMemory {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[] : []);
  return {
    family: list(o.family).filter((m) => typeof m.text === 'string').map((m) => ({ id: String(m.id ?? ''), text: String(m.text), source: String(m.source ?? 'setup'), savedOn: String(m.savedOn ?? '') })),
    learned: list(o.learned).filter((m) => typeof m.text === 'string').map((m) => ({ id: String(m.id ?? ''), text: String(m.text), reports: typeof m.reports === 'number' ? m.reports : null })),
  };
}

export const api = {
  startRun: (body: RunRequest) =>
    fetch('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => json<{ runId: string; familyId?: string }>(r)),
  run: (runId: string) => fetch(`/api/runs/${encodeURIComponent(runId)}`).then((r) => json<RunStatus>(r)),
  /** Newest saved result for a family (the instant feed). Rejects with the server's message (404) when there is none yet. */
  latestRun: (familyId: string) => fetch(`/api/families/${encodeURIComponent(familyId)}/latest-run`).then((r) => json<RunStatus>(r)),
  memory: (familyId: string) => fetch(`/api/families/${encodeURIComponent(familyId)}/memory`).then((r) => json<unknown>(r)).then(readFamilyMemory),
  /** "Forget everything": the server deletes the family, claims, photos, runs and memory entries. */
  forgetFamily: (familyId: string) =>
    fetch(`/api/families/${encodeURIComponent(familyId)}`, { method: 'DELETE' }).then((r) => json<{ ok: true }>(r)),
  trace: (runId: string) => fetch(`/api/runs/${encodeURIComponent(runId)}/trace`).then((r) => json<TraceLine[]>(r)),
  feedback: (body: { familyId: string; cardId: string; kind: 'got_it' | 'issue' | 'not_relevant'; note?: string }) =>
    fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => json<{ ok: true; proposals: unknown[] }>(r)),
  /** Take back an "I got this" or "Not relevant" on the server (the browser has already put the card back). */
  undoClaim: (body: { familyId: string; cardId: string }) =>
    fetch('/api/claims/undo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => json<{ ok: true }>(r)),
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

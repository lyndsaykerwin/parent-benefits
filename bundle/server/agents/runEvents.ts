import type { FeedCard } from '../../shared/bundle';

/**
 * The run event hub: a tiny in-process "message board" for one run's live updates.
 * W4-ORCH writes to it (emit) while a run is going; W4-STREAM reads from it (subscribe)
 * and turns the events into server-sent events for the screen.
 *
 * The events hold the FULL (owner) card. Whoever sends them to a browser must apply the
 * same parent whitelist as `parentResult` in bundleRoutes.ts unless the reviewer token is present.
 */

export type AgentState = 'waiting' | 'working' | 'done' | 'failed';

export type RunEventBody =
  | { type: 'card_ready'; card: FeedCard }
  | { type: 'card_updated'; card: FeedCard }
  | { type: 'card_removed'; cardId: string; reason?: string }
  | { type: 'agent_status'; agent: string; state: AgentState; label?: string };

/** Every stored event also carries its run, its position in the run (1, 2, 3...) and a time. */
export type RunEvent = RunEventBody & { runId: string; seq: number; at: string };
export type RunEventType = RunEvent['type'];

export interface SubscribeOptions {
  /** Replay only events after this position (a reconnecting stream passes the last one it saw). */
  afterSeq?: number;
  /** Called once when the run is finished (immediately if it already was). */
  onEnd?: () => void;
}

export interface HubLimits { maxRuns?: number; maxEventsPerRun?: number }

type Listener = (e: RunEvent) => void;
type Sub = { fn: Listener; onEnd?: () => void };
type RunLog = { events: RunEvent[]; nextSeq: number; finished: boolean; subs: Set<Sub> };

export class RunEventHub {
  private runs = new Map<string, RunLog>();
  private maxRuns: number;
  private maxEvents: number;

  constructor(limits: HubLimits = {}) {
    this.maxRuns = limits.maxRuns ?? 100;
    this.maxEvents = limits.maxEventsPerRun ?? 500;
  }

  private log(runId: string): RunLog {
    let l = this.runs.get(runId);
    if (!l) {
      l = { events: [], nextSeq: 1, finished: false, subs: new Set() };
      this.runs.set(runId, l);
      while (this.runs.size > this.maxRuns) this.runs.delete(this.runs.keys().next().value as string); // oldest run goes first
    }
    return l;
  }

  /** Write one event. Ignored once the run is finished. A broken listener never affects the writer or the other listeners. */
  emit(runId: string, event: RunEventBody): RunEvent | null {
    const l = this.log(runId);
    if (l.finished) return null;
    const stored = { ...event, runId, seq: l.nextSeq++, at: new Date().toISOString() } as RunEvent;
    l.events.push(stored);
    if (l.events.length > this.maxEvents) l.events.splice(0, l.events.length - this.maxEvents);
    for (const sub of [...l.subs]) {
      try { sub.fn(stored); } catch (e) { console.error('Run event listener failed:', (e as Error)?.message); }
    }
    return stored;
  }

  /** Mark the run over: listeners get `onEnd`, and later subscribers get the replay and then `onEnd` straight away. */
  finish(runId: string): void {
    const l = this.log(runId);
    if (l.finished) return;
    l.finished = true;
    for (const sub of [...l.subs]) {
      try { sub.onEnd?.(); } catch (e) { console.error('Run event end handler failed:', (e as Error)?.message); }
    }
    l.subs.clear();
  }

  /** Listen to a run. Past events are replayed first (so a late or reconnecting reader misses nothing). Returns an unsubscribe function. */
  subscribe(runId: string, fn: Listener, opts: SubscribeOptions = {}): () => void {
    const l = this.log(runId);
    const sub: Sub = { fn, onEnd: opts.onEnd };
    for (const e of l.events.filter((x) => x.seq > (opts.afterSeq ?? 0))) {
      try { fn(e); } catch (err) { console.error('Run event listener failed:', (err as Error)?.message); }
    }
    if (l.finished) {
      try { opts.onEnd?.(); } catch (err) { console.error('Run event end handler failed:', (err as Error)?.message); }
      return () => undefined;
    }
    l.subs.add(sub);
    return () => { l.subs.delete(sub); };
  }

  /** A copy of the stored events after `afterSeq` (default: all). */
  history(runId: string, afterSeq = 0): RunEvent[] {
    return (this.runs.get(runId)?.events ?? []).filter((e) => e.seq > afterSeq).map((e) => ({ ...e }));
  }

  isFinished(runId: string): boolean { return this.runs.get(runId)?.finished ?? false; }
  listenerCount(runId: string): number { return this.runs.get(runId)?.subs.size ?? 0; }
}

/** The one hub the server shares. Tests make their own with `new RunEventHub()`. */
export const runEvents = new RunEventHub();

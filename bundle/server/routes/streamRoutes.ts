import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { runEvents as sharedHub, type RunEvent, type RunEventHub } from '../agents/runEvents';
import type { FeedCard } from '../../shared/bundle';
import { parentCard, tokenOk } from './bundleRoutes';

/**
 * Live updates for the "Checking" screen: GET /api/runs/:runId/events, sent as server-sent events
 * (a one-way, long-open web connection). Each message is `event: <type>` + the event as JSON in `data`,
 * and `event: end` when the run is over. The hub holds FULL owner cards, so parents only ever get
 * cards copied through the parentCard whitelist, and status words without free text.
 */

/** Agent names a parent's screen understands. Anything else is not sent to parents. */
const PARENT_AGENTS = new Set(['clawback', 'recall', 'benefits', 'fine_print_court', 'court', 'fact_checker', 'factchecker']);

/** The parent-safe copy of one event, or null if parents should not see it. */
export function parentEvent(e: RunEvent): RunEvent | null {
  switch (e.type) {
    case 'card_ready':
    case 'card_updated':
      if (!e.card || typeof e.card !== 'object') return null;
      return { type: e.type, card: parentCard(e.card) as FeedCard, runId: e.runId, seq: e.seq, at: e.at } as RunEvent;
    case 'card_removed':
      // The reason can name internal checks, so it stays owner-only.
      return { type: 'card_removed', cardId: e.cardId, runId: e.runId, seq: e.seq, at: e.at };
    case 'agent_status':
      if (!PARENT_AGENTS.has(String(e.agent).toLowerCase())) return null;
      // The label is free text; the screen writes its own parent wording from agent + state.
      return { type: 'agent_status', agent: e.agent, state: e.state, runId: e.runId, seq: e.seq, at: e.at };
    default:
      return null;
  }
}

export interface StreamDeps {
  reviewerToken: () => string;
  hub?: RunEventHub;
  heartbeatMs?: number;
  /** Longest one connection stays open (the run budget is 300 s). */
  maxOpenMs?: number;
  /** Streams one visitor (IP address) may hold open at once. */
  maxPerIp?: number;
  limit?: { limit: number; windowMs: number };
}

export function createStreamRouter(deps: StreamDeps): Router {
  const router = Router();
  const hub = deps.hub ?? sharedHub;
  const heartbeatMs = deps.heartbeatMs ?? 15_000;
  const maxOpenMs = deps.maxOpenMs ?? 6 * 60_000;
  const maxPerIp = deps.maxPerIp ?? 4;
  const openByIp = new Map<string, number>();
  const limiter = rateLimit({
    windowMs: deps.limit?.windowMs ?? 10 * 60 * 1000, limit: deps.limit?.limit ?? 60,
    standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many connections from this address. Please try again in a few minutes.' },
  });

  router.get('/api/runs/:runId/events', limiter, (req: Request, res: Response) => {
    const runId = req.params.runId;
    const owner = tokenOk(req.header('x-reviewer-token'), deps.reviewerToken());
    const ip = req.ip ?? 'unknown';
    if ((openByIp.get(ip) ?? 0) >= maxPerIp) return res.status(429).json({ error: 'Too many live connections. Please close one and try again.' });

    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive', 'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    const write = (chunk: string) => { if (!res.writableEnded && !res.destroyed) res.write(chunk); };
    const sendEnd = () => { write('event: end\ndata: {}\n\n'); res.end(); };

    // A run this server never heard of (or after a restart): say "end" so the screen falls back to its normal check.
    // Asking must not create an empty log, or strangers could push real runs out of the hub.
    if (!hub.has(runId)) return void sendEnd();

    openByIp.set(ip, (openByIp.get(ip) ?? 0) + 1);
    let closed = false;
    let unsubscribe: () => void = () => undefined;
    let beat: ReturnType<typeof setInterval> | undefined;
    let cap: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      unsubscribe();
      if (beat) clearInterval(beat);
      if (cap) clearTimeout(cap);
      const left = (openByIp.get(ip) ?? 1) - 1;
      if (left > 0) openByIp.set(ip, left); else openByIp.delete(ip);
    };
    res.on('close', cleanup);

    const header = req.header('last-event-id');
    const fromQuery = typeof req.query.afterSeq === 'string' ? req.query.afterSeq : undefined;
    const parsed = Number.parseInt(header ?? fromQuery ?? '', 10);
    const afterSeq = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;

    const send = (e: RunEvent) => {
      if (closed) return;
      const out = owner ? e : parentEvent(e);
      if (!out) return;
      write(`id: ${out.seq}\nevent: ${out.type}\ndata: ${JSON.stringify(out)}\n\n`);
    };
    const end = () => { if (closed) return; sendEnd(); cleanup(); };

    beat = setInterval(() => write(': ping\n\n'), heartbeatMs);
    cap = setTimeout(end, maxOpenMs);
    // subscribe may replay and call onEnd before it returns, so `closed` guards cleanup order.
    unsubscribe = hub.subscribe(runId, send, { afterSeq, onEnd: end });
    if (closed) unsubscribe();
  });

  return router;
}

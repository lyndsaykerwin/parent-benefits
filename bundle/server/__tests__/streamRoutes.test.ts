import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';
import { createStreamRouter, parentEvent } from '../routes/streamRoutes';
import { RunEventHub } from '../agents/runEvents';
import { applyEvent, emptyStream, type StreamEvent } from '../../client/src/lib/stream';
import type { FeedCard } from '../../shared/bundle';

const TOKEN = 'sekret';
const ownerCard = {
  id: 'c1', kind: 'benefit', title: 'Pay', body: 'Body', amountCents: 100, deadline: '2026-12-01', verdict: 'verified',
  sources: [{ label: 'Src', url: 'https://x.gov', internalNote: 'OWNER-SOURCE' }],
  traceId: 'OWNER-TRACE', sql: 'SELECT OWNER-SQL', debate: 'OWNER-DEBATE', memoryRule: 'OWNER-RULE',
} as unknown as FeedCard;

let server: http.Server | undefined;
let port: number;
const open: http.ClientRequest[] = [];

async function start(hub: RunEventHub, extra: Partial<Parameters<typeof createStreamRouter>[0]> = {}) {
  const app = express();
  app.use(createStreamRouter({ reviewerToken: () => TOKEN, hub, heartbeatMs: 20, ...extra }));
  server = http.createServer(app);
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
  port = (server.address() as AddressInfo).port;
}
afterEach(async () => {
  open.splice(0).forEach((r) => r.destroy());
  const s = server;
  server = undefined;
  if (s) await new Promise((r) => s.close(r));
});

/** Read the stream until it ends (or `until` is satisfied); return status, headers and the raw text. */
function get(path: string, headers: Record<string, string> = {}, until?: (t: string) => boolean) {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; text: string; req: http.ClientRequest }>((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path, headers }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      const done = () => resolve({ status: res.statusCode!, headers: res.headers, text, req });
      res.on('data', (d) => { text += d; if (until?.(text)) done(); });
      res.on('end', done);
    });
    open.push(req);
  });
}
const parse = (text: string) => text.split('\n\n').filter((b) => b.includes('event:')).map((b) => {
  const f = (k: string) => b.split('\n').find((l) => l.startsWith(`${k}: `))?.slice(k.length + 2);
  return { id: f('id'), event: f('event')!, data: JSON.parse(f('data')!) };
});
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('live updates route', () => {
  it('parents never get owner-only card fields, status words or removal reasons', async () => {
    const hub = new RunEventHub();
    hub.emit('r1', { type: 'agent_status', agent: 'recall', state: 'working', label: 'OWNER-LABEL zetaris v_recalls' });
    hub.emit('r1', { type: 'agent_status', agent: 'secret_internal_agent', state: 'working' });
    hub.emit('r1', { type: 'card_ready', card: ownerCard });
    hub.emit('r1', { type: 'card_removed', cardId: 'c2', reason: 'OWNER-REASON' });
    hub.finish('r1');
    await start(hub);
    const r = await get('/api/runs/r1/events');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/text\/event-stream/);
    expect(r.text).not.toMatch(/OWNER|SELECT|zetaris|secret_internal/);
    const evs = parse(r.text);
    expect(evs.map((e) => e.event)).toEqual(['agent_status', 'card_ready', 'card_removed', 'end']);
    expect(Object.keys(evs[1].data.card).sort()).toEqual(['amountCents', 'body', 'deadline', 'id', 'kind', 'sources', 'title', 'verdict']);
    expect(evs[1].data.card.sources).toEqual([{ label: 'Src', url: 'https://x.gov' }]);
    expect(evs[0].data.label).toBeUndefined();
  });

  it('the reviewer token unlocks the full events; a wrong token does not', async () => {
    const hub = new RunEventHub();
    hub.emit('r1', { type: 'card_ready', card: ownerCard });
    hub.emit('r1', { type: 'agent_status', agent: 'x_agent', state: 'done', label: 'L' });
    hub.finish('r1');
    await start(hub);
    const r = await get('/api/runs/r1/events', { 'x-reviewer-token': TOKEN });
    expect(r.text).toContain('OWNER-TRACE');
    expect(r.text).toContain('x_agent');
    const wrong = await get('/api/runs/r1/events', { 'x-reviewer-token': 'nope' });
    expect(wrong.text).not.toContain('OWNER-TRACE');
  });

  it('sends event ids, ends when the run finishes live, and replays only after Last-Event-ID', async () => {
    const hub = new RunEventHub();
    hub.emit('r1', { type: 'agent_status', agent: 'recall', state: 'working' });
    hub.emit('r1', { type: 'agent_status', agent: 'recall', state: 'done' });
    await start(hub);
    const p = get('/api/runs/r1/events', { 'last-event-id': '1' });
    await wait(50);
    hub.emit('r1', { type: 'card_ready', card: ownerCard });
    hub.finish('r1');
    const evs = parse((await p).text);
    expect(evs.map((e) => e.id ?? null)).toEqual(['2', '3', null]);
    expect(evs.map((e) => e.event)).toEqual(['agent_status', 'card_ready', 'end']);
    expect(hub.listenerCount('r1')).toBe(0);
    const q = parse((await get('/api/runs/r1/events?afterSeq=2')).text);
    expect(q.map((e) => e.event)).toEqual(['card_ready', 'end']);
  });

  it('an unknown run ends straight away and creates nothing in the hub', async () => {
    const hub = new RunEventHub();
    await start(hub);
    const r = await get('/api/runs/nope/events');
    expect(r.status).toBe(200);
    expect(parse(r.text).map((e) => e.event)).toEqual(['end']);
    expect(hub.has('nope')).toBe(false);
  });

  it('a stream opened before the first event still gets card_ready and end', async () => {
    const hub = new RunEventHub();
    hub.open('r1');
    hub.open('r1'); // idempotent
    await start(hub);
    const p = get('/api/runs/r1/events');
    await wait(50);
    expect(hub.listenerCount('r1')).toBe(1);
    hub.emit('r1', { type: 'card_ready', card: ownerCard });
    hub.finish('r1');
    expect(parse((await p).text).map((e) => e.event)).toEqual(['card_ready', 'end']);
    expect(hub.listenerCount('r1')).toBe(0);
  });

  it('removes its listener when the browser disconnects', async () => {
    const hub = new RunEventHub();
    hub.emit('r1', { type: 'agent_status', agent: 'recall', state: 'working' });
    await start(hub);
    const r = await get('/api/runs/r1/events', {}, (t) => t.includes('event: agent_status'));
    expect(hub.listenerCount('r1')).toBe(1);
    r.req.destroy();
    for (let i = 0; i < 100 && hub.listenerCount('r1') > 0; i++) await wait(10);
    expect(hub.listenerCount('r1')).toBe(0);
  });

  it('sends heartbeat comments while waiting', async () => {
    const hub = new RunEventHub();
    hub.emit('r1', { type: 'agent_status', agent: 'recall', state: 'working' });
    await start(hub);
    const r = await get('/api/runs/r1/events', {}, (t) => t.includes(': ping'));
    expect(r.text).toContain(': ping');
  });

  it('closes a stream that stays open too long, and limits streams per visitor', async () => {
    const hub = new RunEventHub();
    hub.emit('r1', { type: 'agent_status', agent: 'recall', state: 'working' });
    await start(hub, { maxOpenMs: 150, maxPerIp: 1 });
    const first = get('/api/runs/r1/events');
    await wait(30);
    const second = await get('/api/runs/r1/events');
    expect(second.status).toBe(429);
    expect(parse((await first).text).pop()?.event).toBe('end');
    expect(hub.listenerCount('r1')).toBe(0);
  });

  it('the app-side stream reader accepts exactly what the route sends to parents', () => {
    const e = parentEvent({ type: 'card_ready', card: ownerCard, runId: 'r', seq: 1, at: 'now' })!;
    const s = applyEvent(emptyStream(), JSON.parse(JSON.stringify(e)) as StreamEvent);
    expect(s.cards.map((c) => c.id)).toEqual(['c1']);
    expect(s.lastSeq).toBe(1);
    const a = applyEvent(s, parentEvent({ type: 'agent_status', agent: 'fine_print_court', state: 'working', runId: 'r', seq: 2, at: 'now' })! as StreamEvent);
    expect(a.agents.court).toBe('working');
  });
});

describe('a real sample run, streamed to a parent', () => {
  it('every card_ready the real orchestrator emits goes through the parent whitelist (no trace id, SQL or agent log)', async () => {
    const os = await import('os');
    const fs = await import('fs');
    const path = await import('path');
    const { runBundle, loadSampleFamily } = await import('../agents/orchestrator');
    const { makeRealRunDeps } = await import('../bundleDeps');
    const { BundleMemory } = await import('../adapters/memory');
    const savedMode = process.env.SAMPLE_MODE;
    process.env.SAMPLE_MODE = 'true';
    try {
      const hub = new RunEventHub();
      const memory = new BundleMemory(fs.mkdtempSync(path.join(os.tmpdir(), 'stream-mem-')));
      await runBundle('maya', {
        ...makeRealRunDeps(memory, 'maya'), loadFamily: loadSampleFamily, runId: 'real-maya', events: hub,
        logsDir: fs.mkdtempSync(path.join(os.tmpdir(), 'stream-logs-')),
      });
      // The hub holds the full owner card, which does carry the trace id (so the check below is a real test).
      const ownerCards = hub.history('real-maya').filter((e) => e.type === 'card_ready').map((e: any) => e.card);
      expect(ownerCards.length).toBeGreaterThan(0);
      expect(ownerCards.every((c: any) => typeof c.traceId === 'string' && c.traceId.length > 0)).toBe(true);

      await start(hub);
      const r = await get('/api/runs/real-maya/events');
      const cards = parse(r.text).filter((e) => e.event === 'card_ready').map((e) => e.data.card);
      expect(cards.map((c) => c.id)).toEqual(ownerCards.map((c: any) => c.id));
      const allowed = ['amountCents', 'body', 'category', 'deadline', 'id', 'kind', 'minutes', 'offerFacts', 'sources', 'title', 'valueScore', 'verdict'];
      for (const c of cards) {
        expect(Object.keys(c).every((k) => allowed.includes(k))).toBe(true);
        expect(c.sources.every((s: any) => Object.keys(s).sort().join() === 'label,url')).toBe(true);
      }
      expect(r.text).not.toMatch(/traceId|evidenceSql|bundle_pg|SELECT |agent_name|input_summary|retry_count|"claim"/);
    } finally {
      if (savedMode === undefined) delete process.env.SAMPLE_MODE; else process.env.SAMPLE_MODE = savedMode;
    }
  });
});

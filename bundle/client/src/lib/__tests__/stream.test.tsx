import { applyEvent, emptyStream, followRun, pillLines, sanitizeCard, sortCards, STREAM_STALL_MS, type StreamEvent } from '../stream';
import type { PollApi } from '../poll';
import type { RunStatus } from '../bundle';
import type { FeedCard } from '@shared/bundle';

const card = (id: string, kind: FeedCard['kind'], extra: Partial<FeedCard> = {}): FeedCard => ({
  id, kind, title: `Title ${id}`, body: 'Body', amountCents: null, deadline: null, verdict: 'verified',
  sources: [{ label: 'Src', url: 'https://example.gov/x' }], traceId: 'secret-trace', ...extra,
});
const ev = (e: Record<string, unknown>, seq = 1): StreamEvent => ({ runId: 'r1', seq, at: '2026-10-25T00:00:00Z', ...e } as StreamEvent);

describe('sanitizeCard (parents only ever see whitelisted fields)', () => {
  it('drops owner-only fields such as traceId and unknown extras', () => {
    const dirty = { ...card('a', 'recall'), debate: 'court argued', sql: 'SELECT 1', memoryRule: 'mem-1' } as unknown as FeedCard;
    const clean = sanitizeCard(dirty) as unknown as Record<string, unknown>;
    expect(Object.keys(clean).sort()).toEqual(['amountCents', 'body', 'deadline', 'id', 'kind', 'sources', 'title', 'verdict']);
    expect(JSON.stringify(clean)).not.toMatch(/secret-trace|court argued|SELECT|mem-1/);
  });
  it('keeps only label and url on sources, and rejects junk', () => {
    const c = sanitizeCard({ ...card('a', 'recall'), sources: [{ label: 'L', url: 'https://x.gov', extra: 'no' }] } as unknown as FeedCard) as FeedCard;
    expect(c.sources).toEqual([{ label: 'L', url: 'https://x.gov' }]);
    expect(sanitizeCard({ nope: true } as unknown as FeedCard)).toBeNull();
    expect(sanitizeCard(null as unknown as FeedCard)).toBeNull();
  });
});

describe('applyEvent', () => {
  it('shows cards in kind order (recalls first), then by nearest deadline', () => {
    let s = emptyStream();
    s = applyEvent(s, ev({ type: 'card_ready', card: card('d1', 'discount') }, 1));
    s = applyEvent(s, ev({ type: 'card_ready', card: card('b2', 'benefit', { deadline: '2026-12-01' }) }, 2));
    s = applyEvent(s, ev({ type: 'card_ready', card: card('b1', 'benefit', { deadline: '2026-11-01' }) }, 3));
    s = applyEvent(s, ev({ type: 'card_ready', card: card('r1', 'recall') }, 4));
    s = applyEvent(s, ev({ type: 'card_ready', card: card('c1', 'clawback') }, 5));
    expect(s.cards.map((c) => c.id)).toEqual(['r1', 'c1', 'b1', 'b2', 'd1']);
    expect(s.lastSeq).toBe(5);
  });
  it('card_updated replaces, card_removed removes, repeated seq is ignored', () => {
    let s = emptyStream();
    s = applyEvent(s, ev({ type: 'card_ready', card: card('a', 'benefit') }, 1));
    s = applyEvent(s, ev({ type: 'card_updated', card: card('a', 'benefit', { title: 'New' }) }, 2));
    expect(s.cards[0].title).toBe('New');
    const again = applyEvent(s, ev({ type: 'card_ready', card: card('z', 'benefit') }, 2));
    expect(again.cards).toHaveLength(1);
    s = applyEvent(s, ev({ type: 'card_removed', cardId: 'a' }, 3));
    expect(s.cards).toHaveLength(0);
    expect(s.removed).toContain('a');
  });
  it('never shows a blocked card as a streamed card', () => {
    const s = applyEvent(emptyStream(), ev({ type: 'card_ready', card: card('x', 'discount', { verdict: 'blocked' }) }));
    expect(s.cards).toHaveLength(0);
  });
  it('strips owner fields from streamed cards', () => {
    const s = applyEvent(emptyStream(), ev({ type: 'card_ready', card: card('a', 'recall') }));
    expect('traceId' in s.cards[0]).toBe(false);
  });
  it('ignores malformed events', () => {
    const s = applyEvent(emptyStream(), { type: 'card_ready' } as unknown as StreamEvent);
    expect(s).toEqual(emptyStream());
  });
});

describe('status pills', () => {
  const text = (s: ReturnType<typeof emptyStream>) => pillLines(s).map((p) => p.text);
  it('changes wording per agent_status and never says real-time or names an agent', () => {
    let s = emptyStream();
    s = applyEvent(s, ev({ type: 'agent_status', agent: 'recall', state: 'working' }, 1));
    expect(text(s)).toEqual(['Checking recalls…']);
    s = applyEvent(s, ev({ type: 'agent_status', agent: 'recall', state: 'done' }, 2));
    expect(text(s)).toEqual(['Recall check finished']);
    s = applyEvent(s, ev({ type: 'agent_status', agent: 'fine_print_court', state: 'working' }, 3));
    s = applyEvent(s, ev({ type: 'agent_status', agent: 'fact_checker', state: 'working' }, 4));
    s = applyEvent(s, ev({ type: 'agent_status', agent: 'clawback', state: 'failed' }, 5));
    const all = text(s).join(' | ');
    expect(all).not.toMatch(/real-?time|Fact-Checker|Fine Print Court|Clawback Finder/i);
    expect(pillLines(s).find((p) => p.key === 'clawback')?.state).toBe('failed');
  });
  it('ignores a server label (could hold jargon) and an unknown agent gets a generic pill', () => {
    const s = applyEvent(emptyStream(), ev({ type: 'agent_status', agent: 'mystery_bot', state: 'working', label: 'Running SQL on Zetaris' }));
    expect(text(s)).toEqual(['Working on your results…']);
  });
});

describe('sortCards', () => {
  it('is stable for equal cards', () => {
    expect(sortCards([card('b', 'benefit'), card('a', 'benefit')]).map((c) => c.id)).toEqual(['b', 'a']);
  });
});

// ---------- followRun with a fake EventSource ----------

class FakeES {
  static last: FakeES | null = null;
  listeners: Record<string, ((e: { data: string }) => void)[]> = {};
  onerror: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  closed = false;
  constructor(public url: string) { FakeES.last = this; }
  addEventListener(t: string, fn: (e: { data: string }) => void) { (this.listeners[t] ||= []).push(fn); }
  close() { this.closed = true; }
  emit(type: string, payload: unknown) { for (const fn of this.listeners[type] ?? []) fn({ data: JSON.stringify(payload) }); }
  fail() { this.onerror?.(); }
}
const ES = FakeES as unknown as typeof EventSource;

const running: RunStatus = { runId: 'r1', familyId: 'maya', status: 'running', startedAt: '2026-10-25T00:00:00Z', result: null, error: null };
const finished: RunStatus = { ...running, status: 'done', result: { familyId: 'maya', runId: 'r1', receipt: { moneyBackCents: 0, likelyBenefitsCents: 0, deadlineCount: 0, nextDeadline: null, itemsChecked: 0 }, cards: [card('p1', 'recall')], banner: null } };

async function flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
beforeEach(() => { jest.useFakeTimers(); FakeES.last = null; });
afterEach(() => jest.useRealTimers());

function setup(responses: RunStatus[]) {
  let i = 0;
  const api: PollApi = { run: jest.fn(async () => responses[Math.min(i++, responses.length - 1)]), trace: jest.fn(async () => []) };
  const h = { onStream: jest.fn(), onStatus: jest.fn(), onDone: jest.fn(), onFailed: jest.fn(), onGiveUp: jest.fn() };
  return { api, h };
}

describe('followRun', () => {
  it('streams cards and pills without polling, then finishes through one poll when the stream ends', async () => {
    const { api, h } = setup([finished]);
    followRun('r1', api, h, { EventSourceCtor: ES });
    const es = FakeES.last!;
    expect(es.url).toBe('/api/runs/r1/events');
    es.emit('agent_status', ev({ type: 'agent_status', agent: 'recall', state: 'working' }, 1));
    es.emit('card_ready', ev({ type: 'card_ready', card: card('p1', 'recall') }, 2));
    const last = h.onStream.mock.calls[h.onStream.mock.calls.length - 1][0];
    expect(last.cards.map((c: FeedCard) => c.id)).toEqual(['p1']);
    expect(pillLines(last).map((p) => p.text)).toEqual(['Checking recalls…']);
    expect(api.run).not.toHaveBeenCalled();
    es.emit('end', {});
    await flush();
    expect(es.closed).toBe(true);
    expect(h.onDone).toHaveBeenCalledTimes(1);
    expect(h.onDone.mock.calls[0][0].result.cards.map((c: FeedCard) => c.id)).toEqual(['p1']); // final state = polled result
  });

  it('also reads default "message" events that carry the type inside the data', () => {
    const { api, h } = setup([running]);
    followRun('r1', api, h, { EventSourceCtor: ES });
    FakeES.last!.onmessage?.({ data: JSON.stringify(ev({ type: 'card_ready', card: card('m1', 'benefit') })) });
    expect(h.onStream.mock.calls.pop()![0].cards).toHaveLength(1);
  });

  it('a stream error closes it and polling resumes', async () => {
    const { api, h } = setup([running, finished]);
    followRun('r1', api, h, { EventSourceCtor: ES, intervalMs: 1000 });
    expect(api.run).not.toHaveBeenCalled();
    FakeES.last!.fail();
    expect(FakeES.last!.closed).toBe(true);
    await flush();
    expect(api.run).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1000); await flush();
    expect(h.onDone).toHaveBeenCalledTimes(1);
  });

  it('polls straight away when the browser has no EventSource', async () => {
    const { api, h } = setup([finished]);
    followRun('r1', api, h, { EventSourceCtor: null });
    await flush();
    expect(h.onDone).toHaveBeenCalledTimes(1);
  });

  it('falls back to polling if the stream goes quiet', async () => {
    const { api, h } = setup([finished]);
    followRun('r1', api, h, { EventSourceCtor: ES });
    jest.advanceTimersByTime(STREAM_STALL_MS + 10);
    await flush();
    expect(FakeES.last!.closed).toBe(true);
    expect(h.onDone).toHaveBeenCalledTimes(1);
  });

  it('the stop function closes the stream and stops everything', async () => {
    const { api, h } = setup([running]);
    const stop = followRun('r1', api, h, { EventSourceCtor: ES });
    stop();
    expect(FakeES.last!.closed).toBe(true);
    FakeES.last!.fail();
    await flush();
    expect(api.run).not.toHaveBeenCalled();
  });

  it('ignores garbage data without breaking', () => {
    const { api, h } = setup([running]);
    followRun('r1', api, h, { EventSourceCtor: ES });
    expect(() => FakeES.last!.listeners['card_ready'][0]({ data: 'not json' })).not.toThrow();
  });
});

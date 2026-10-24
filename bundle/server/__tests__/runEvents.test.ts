import { RunEventHub, type RunEvent } from '../agents/runEvents';
import type { FeedCard } from '../../shared/bundle';

const card = (id: string): FeedCard => ({ id, kind: 'deal', title: `Made-up ${id}`, body: 'b', amountCents: 100, deadline: null, verdict: 'verified', sources: [], traceId: 't', agent: 'fine_print_court' } as unknown as FeedCard);

describe('RunEventHub', () => {
  it('delivers the four event kinds to a subscriber of that run only', () => {
    const hub = new RunEventHub();
    const got: RunEvent[] = [];
    const other: RunEvent[] = [];
    hub.subscribe('r1', (e) => got.push(e));
    hub.subscribe('r2', (e) => other.push(e));
    hub.emit('r1', { type: 'card_ready', card: card('a') });
    hub.emit('r1', { type: 'card_updated', card: card('a') });
    hub.emit('r1', { type: 'card_removed', cardId: 'a', reason: 'recalled' });
    hub.emit('r1', { type: 'agent_status', agent: 'recall', state: 'working', label: 'Checking recall lists' });
    expect(got.map((e) => e.type)).toEqual(['card_ready', 'card_updated', 'card_removed', 'agent_status']);
    expect(other).toEqual([]);
  });

  it('numbers events in order and replays missed ones to a late subscriber', () => {
    const hub = new RunEventHub();
    hub.emit('r1', { type: 'card_ready', card: card('a') });
    hub.emit('r1', { type: 'card_ready', card: card('b') });
    const late: RunEvent[] = [];
    hub.subscribe('r1', (e) => late.push(e));
    expect(late.map((e) => e.seq)).toEqual([1, 2]);
    hub.emit('r1', { type: 'card_removed', cardId: 'a' });
    expect(late.map((e) => e.seq)).toEqual([1, 2, 3]);
  });

  it('replays only events after `afterSeq` (for reconnecting streams)', () => {
    const hub = new RunEventHub();
    for (const id of ['a', 'b', 'c']) hub.emit('r1', { type: 'card_ready', card: card(id) });
    const got: RunEvent[] = [];
    hub.subscribe('r1', (e) => got.push(e), { afterSeq: 2 });
    expect(got.map((e) => e.seq)).toEqual([3]);
    expect(hub.history('r1', 1).map((e) => e.seq)).toEqual([2, 3]);
  });

  it('unsubscribe stops delivery', () => {
    const hub = new RunEventHub();
    const got: RunEvent[] = [];
    const off = hub.subscribe('r1', (e) => got.push(e));
    hub.emit('r1', { type: 'agent_status', agent: 'a', state: 'done' });
    off();
    hub.emit('r1', { type: 'agent_status', agent: 'b', state: 'done' });
    expect(got).toHaveLength(1);
    expect(hub.listenerCount('r1')).toBe(0);
  });

  it('a throwing listener does not stop the others or the emitter', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const hub = new RunEventHub();
    const got: RunEvent[] = [];
    hub.subscribe('r1', () => { throw new Error('boom'); });
    hub.subscribe('r1', (e) => got.push(e));
    expect(() => hub.emit('r1', { type: 'agent_status', agent: 'a', state: 'working' })).not.toThrow();
    expect(got).toHaveLength(1);
    spy.mockRestore();
  });

  it('finish() tells listeners the run is over and ends the stream for later subscribers', () => {
    const hub = new RunEventHub();
    const done = jest.fn();
    const got: RunEvent[] = [];
    hub.subscribe('r1', (e) => got.push(e), { onEnd: done });
    hub.emit('r1', { type: 'card_ready', card: card('a') });
    hub.finish('r1');
    expect(done).toHaveBeenCalledTimes(1);
    expect(hub.isFinished('r1')).toBe(true);
    const lateEnd = jest.fn();
    const late: RunEvent[] = [];
    hub.subscribe('r1', (e) => late.push(e), { onEnd: lateEnd });
    expect(late).toHaveLength(1); // replayed
    expect(lateEnd).toHaveBeenCalledTimes(1);
    hub.emit('r1', { type: 'card_ready', card: card('z') }); // ignored after finish
    expect(hub.history('r1')).toHaveLength(1);
  });

  it('keeps memory bounded: old runs and long histories are dropped', () => {
    const hub = new RunEventHub({ maxRuns: 2, maxEventsPerRun: 3 });
    for (let i = 0; i < 5; i++) hub.emit('r1', { type: 'agent_status', agent: 'a', state: 'working', label: String(i) });
    expect(hub.history('r1')).toHaveLength(3);
    expect(hub.history('r1')[0].seq).toBe(3); // seq keeps counting
    hub.emit('r2', { type: 'agent_status', agent: 'a', state: 'working' });
    hub.emit('r3', { type: 'agent_status', agent: 'a', state: 'working' });
    expect(hub.history('r1')).toEqual([]);
    expect(hub.history('r3')).toHaveLength(1);
  });

  it('history() returns copies so callers cannot change what is stored', () => {
    const hub = new RunEventHub();
    hub.emit('r1', { type: 'card_ready', card: card('a') });
    hub.history('r1').pop();
    expect(hub.history('r1')).toHaveLength(1);
  });

  it('a throwing replay listener or onEnd handler does not break subscribe() or finish()', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const hub = new RunEventHub();
    hub.emit('r1', { type: 'card_ready', card: card('a') });
    expect(() => hub.subscribe('r1', () => { throw new Error('replay boom'); })).not.toThrow();
    const ok = jest.fn();
    hub.subscribe('r1', () => undefined, { onEnd: () => { throw new Error('end boom'); } });
    hub.subscribe('r1', () => undefined, { onEnd: ok });
    expect(() => hub.finish('r1')).not.toThrow();
    expect(ok).toHaveBeenCalledTimes(1); // the next listener still hears the end
    expect(() => hub.subscribe('r1', () => undefined, { onEnd: () => { throw new Error('late end boom'); } })).not.toThrow();
    expect(hub.isFinished('r1')).toBe(true);
    spy.mockRestore();
  });
});

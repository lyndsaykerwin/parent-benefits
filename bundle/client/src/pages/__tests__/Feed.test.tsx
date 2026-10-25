import React from 'react';
import { render, screen, cleanup, waitFor, act, fireEvent } from '@testing-library/react';
import { Router, Route } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import Feed from '../Feed';

afterEach(() => { cleanup(); sessionStorage.clear(); });

describe('Feed "Checking" screen (W1-OWNER)', () => {
  it('a parent sees lines built from the answers, in plain words, and the trace is never asked for', async () => {
    const family = { name: 'maya', birthDate: null, dueDate: '2026-12-07', household: 'two', parent1Work: 'paycheck', parent2Work: 'paycheck', insurance: 'job', hasItems: true };
    const body = {
      runId: 'r1', familyId: 'maya', status: 'running', startedAt: new Date().toISOString(), family, today: '2026-10-23', demoDate: false,
      result: null, error: null, progress: [], owner: false,
    };
    const fetchMock = jest.fn(async (_url: string) => ({ ok: true, status: 200, json: async () => body }));
    (global as any).fetch = fetchMock;
    const { hook } = memoryLocation({ path: '/feed/r1' });
    render(<Router hook={hook}><Route path="/feed/:runId" component={Feed} /></Router>);

    await waitFor(() => expect(screen.getByText('State and federal family benefits')).toBeTruthy(), { timeout: 3000 });
    expect(screen.queryByText(/Live activity/i)).toBeNull();
    expect(document.body.textContent).not.toMatch(/checking live/i);
    expect(screen.getByText(/often quick/)).toBeTruthy();
    expect(screen.queryByText(/Fine Print Court|Fact-Checker|Clawback Finder/)).toBeNull();
    expect(screen.queryByRole('button', { name: /View my results/ })).toBeNull(); // the run has not finished
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/trace'))).toBe(false);
  });
});

describe('Feed hands a finished run to Version B (W3-VERSIONB)', () => {
  const finished = () => {
    const { sampleRun } = jest.requireActual('../../test-support/sampleRuns') as typeof import('../../test-support/sampleRuns');
    const run = sampleRun('maya');
    const body = { runId: run.runId, familyId: 'maya', status: 'done', startedAt: new Date().toISOString(), family: run.family, today: run.today, demoDate: true, result: run.result, error: null, progress: [], owner: false };
    (global as any).fetch = jest.fn(async (url: string) => {
      if (String(url).includes('/agent-log')) return { ok: false, status: 404, json: async () => ({}) };
      if (String(url).includes('/trace')) return { ok: true, status: 200, json: async () => [] };
      return { ok: true, status: 200, json: async () => body };
    });
    window.scrollTo = jest.fn() as unknown as typeof window.scrollTo;
    const { hook } = memoryLocation({ path: `/feed/${run.runId}` });
    render(<Router hook={hook}><Route path="/feed/:runId" component={Feed} /></Router>);
  };
  /** A parent waits out the checking lines, then taps "View my results" (the clock is fake so this takes no real time). */
  const openResults = async () => {
    for (let i = 0; i < 30 && !screen.queryByRole('button', { name: /View my results/ }); i++) await act(async () => { await jest.advanceTimersByTimeAsync(500); });
    fireEvent.click(screen.getByRole('button', { name: /View my results/ }));
  };
  beforeEach(() => { jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }); });
  afterEach(() => { jest.useRealTimers(); });

  it('opens on the Home tab of the five-tab app after "View my results", using the run\'s own numbers', async () => {
    finished();
    await openResults();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
    expect(screen.getByTestId('home-total-amount').textContent).toBe('$3,688.99');
    expect(screen.getByRole('button', { name: /take a photo/i })).toBeTruthy();
    expect(screen.queryByTestId('owner-panel-slot')).toBeNull(); // a parent never gets the owner slot
    expect(screen.queryByText('How the agents worked together')).toBeNull();
    expect(((global as any).fetch as jest.Mock).mock.calls.some(([u]) => String(u).includes('/agent-log'))).toBe(false);
  });

  it('shows the owner (reviewer code set) the "How the agents worked together" panel on Home', async () => {
    sessionStorage.setItem('bundle:reviewerToken', 'test-code');
    finished();
    // The owner's own checking screen is the agent view and opens the results by itself.
    await act(async () => { await jest.advanceTimersByTimeAsync(1500); });
    expect(screen.queryByRole('button', { name: /View my results/ })).toBeNull();
    await waitFor(() => expect(screen.getByTestId('owner-panel-slot')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('How the agents worked together')).toBeTruthy());
  });
});

describe('Feed instant saved results and live cards (W4-STREAM-UI)', () => {
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
  }
  const mk = (id: string, title: string, kind = 'benefit') => ({ id, kind, title, body: 'Plain body', amountCents: null, deadline: null, verdict: 'verified', sources: [{ label: 'Src', url: 'https://example.gov' }], traceId: 'owner-trace-id' });
  const receipt = { moneyBackCents: 0, likelyBenefitsCents: 0, deadlineCount: 0, nextDeadline: null, itemsChecked: 0 };
  const runningBody = { runId: 'r2', familyId: 'maya', status: 'running', startedAt: new Date().toISOString(), family: { name: 'maya', birthDate: null, dueDate: '2026-12-07' }, today: '2026-10-23', demoDate: false, result: null, error: null, progress: [], owner: false };
  const savedBody = { ...runningBody, runId: 'old', status: 'done', result: { familyId: 'maya', runId: 'old', receipt, cards: [mk('saved-1', 'Saved WIC card')], banner: null } };

  function mount(latest: 'saved' | '404' = 'saved') {
    (global as any).EventSource = FakeES;
    FakeES.last = null;
    const fetchMock = jest.fn(async (url: string) => {
      if (String(url).includes('/latest-run')) return latest === 'saved' ? { ok: true, status: 200, json: async () => savedBody } : { ok: false, status: 404, json: async () => ({ error: 'No saved run for this family' }) };
      return { ok: true, status: 200, json: async () => ({ ...runningBody, startedAt: new Date().toISOString() }) }; // started "now", whatever the clock says
    });
    (global as any).fetch = fetchMock;
    const { hook } = memoryLocation({ path: '/feed/r2' });
    render(<Router hook={hook}><Route path="/feed/:runId" component={Feed} /></Router>);
    return fetchMock;
  }
  afterEach(() => { delete (global as any).EventSource; });

  it('shows the family\'s last saved results straight away, labelled as saved', async () => {
    mount('saved');
    await waitFor(() => expect(screen.getByText('Saved WIC card')).toBeTruthy());
    expect(screen.getByTestId('saved-feed-note').textContent).toMatch(/last check/i);
  });

  it('a missing saved run (after a restart) just shows the normal checking screen, no error', async () => {
    mount('404');
    await waitFor(() => expect(screen.getByTestId('parent-steps')).toBeTruthy());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByTestId('saved-feed-note')).toBeNull();
  });

  it('streamed cards appear as they are ready, a new copy replaces the saved one, and owner fields never reach the page', async () => {
    mount('saved');
    await waitFor(() => expect(FakeES.last).toBeTruthy());
    expect(FakeES.last!.url).toBe('/api/runs/r2/events');
    await waitFor(() => expect(screen.getByText('Saved WIC card')).toBeTruthy());
    act(() => {
      FakeES.last!.emit('agent_status', { type: 'agent_status', agent: 'recall', state: 'working', seq: 1 });
      FakeES.last!.emit('card_ready', { type: 'card_ready', seq: 2, card: mk('saved-1', 'Fresh WIC card') });
      FakeES.last!.emit('card_ready', { type: 'card_ready', seq: 3, card: mk('new-1', 'Brand new recall', 'recall') });
    });
    await waitFor(() => expect(screen.getByText('Brand new recall')).toBeTruthy());
    expect(screen.getByText('Fresh WIC card')).toBeTruthy();
    expect(screen.queryByText('Saved WIC card')).toBeNull();
    expect(screen.queryByText('Checking recalls…')).toBeNull(); // the family's own lines are on screen, so no second set of pills
    expect(document.body.innerHTML).not.toMatch(/owner-trace-id|real-?time/i);
  });

  it('the seconds counter keeps counting while the stream is quiet', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      mount('404');
      await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      expect(screen.getByText('0s')).toBeTruthy();
      await act(async () => { jest.advanceTimersByTime(3000); });
      expect(screen.getByText('3s')).toBeTruthy();
    } finally { jest.useRealTimers(); }
  });

  it('keeps working (polling) when the stream breaks', async () => {
    const fetchMock = mount('saved');
    await waitFor(() => expect(FakeES.last).toBeTruthy());
    const polls = () => fetchMock.mock.calls.filter(([u]) => /\/api\/runs\/r2$/.test(String(u))).length;
    const before = polls();
    act(() => { FakeES.last!.onerror?.(); });
    await waitFor(() => expect(polls()).toBeGreaterThan(before));
    expect(FakeES.last!.closed).toBe(true);
  });
});

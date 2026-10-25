import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { Router, Route } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import Feed from '../Feed';

afterEach(() => { cleanup(); sessionStorage.clear(); });

const progress = [
  { key: 'money', label: 'Money you can get back', state: 'done' },
  { key: 'recalls', label: 'Your items vs. official recall lists', state: 'working' },
  { key: 'benefits', label: 'Programs and deadlines for your family', state: 'waiting' },
];

describe('Feed "Checking" screen (W1-OWNER)', () => {
  it('a parent sees only the server\'s parent-safe step wording, and the trace is never asked for', async () => {
    const body = {
      runId: 'r1', familyId: 'maya', status: 'running', startedAt: new Date().toISOString(), family: { name: 'maya', birthDate: null, dueDate: '2026-12-07' }, today: '2026-10-23', demoDate: false,
      result: null, error: null, progress, owner: false,
    };
    const fetchMock = jest.fn(async (_url: string) => ({ ok: true, status: 200, json: async () => body }));
    (global as any).fetch = fetchMock;
    const { hook } = memoryLocation({ path: '/feed/r1' });
    render(<Router hook={hook}><Route path="/feed/:runId" component={Feed} /></Router>);

    await waitFor(() => expect(screen.getByText("Your items vs. official recall lists")).toBeTruthy());
    expect(screen.getByText('Money you can get back')).toBeTruthy();
    expect(screen.queryByText(/Live activity/i)).toBeNull();
    expect(screen.queryByText(/Fine Print Court|Fact-Checker|Clawback Finder/)).toBeNull();
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

  it('opens on the Home tab of the five-tab app, using the run\'s own numbers', async () => {
    finished();
    await waitFor(() => expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy());
    expect(screen.getByTestId('home-total-amount').textContent).toBe('$3,688.99');
    expect(screen.getByRole('button', { name: /take a photo/i })).toBeTruthy();
    expect(screen.queryByTestId('owner-panel-slot')).toBeNull(); // a parent never gets the owner slot
    expect(screen.queryByText('How the agents worked together')).toBeNull();
    expect(((global as any).fetch as jest.Mock).mock.calls.some(([u]) => String(u).includes('/agent-log'))).toBe(false);
  });

  it('shows the owner (reviewer code set) the "How the agents worked together" panel on Home', async () => {
    sessionStorage.setItem('bundle:reviewerToken', 'test-code');
    finished();
    await waitFor(() => expect(screen.getByTestId('owner-panel-slot')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('How the agents worked together')).toBeTruthy());
  });
});

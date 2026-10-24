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

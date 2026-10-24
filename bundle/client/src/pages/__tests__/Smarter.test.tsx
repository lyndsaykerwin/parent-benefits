import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import Smarter from '../Smarter';

afterEach(() => { cleanup(); sessionStorage.clear(); });

const rule = { id: 1, text: 'Reject offers that turn into paid memberships', confidence: 0.7, sourceFeedbackIds: ['1', '2'], status: 'proposed', memoryId: null };

function mount(owner: boolean) {
  if (owner) sessionStorage.setItem('bundle:reviewerToken', 'sekret');
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    const isOwner = (init?.headers as Record<string, string> | undefined)?.['x-reviewer-token'] === 'sekret';
    const body = String(url).includes('case-law')
      ? isOwner ? { proposals: [rule], approved: [], proposedCount: 1, approvedCount: 0 } : { proposals: [], approved: [], proposedCount: 1, approvedCount: 2 }
      : { scoreboard: null };
    return { ok: true, status: 200, json: async () => body };
  });
  (global as any).fetch = fetchMock;
  const { hook } = memoryLocation({ path: '/smarter' });
  render(<Router hook={hook}><Smarter /></Router>);
  return fetchMock;
}

describe('Smarter owner view split (W1-OWNER)', () => {
  it('a parent sees a plain count, never rule text, proposals, Approve or the scoreboard', async () => {
    const f = mount(false);
    await waitFor(() => expect(screen.getByTestId('parent-rules').textContent).toMatch(/2 lessons/));
    expect(screen.queryByText(/Approve/)).toBeNull();
    expect(screen.queryByText(/Scoreboard/)).toBeNull();
    expect(f.mock.calls.some(([u]) => String(u).includes('scoreboard'))).toBe(false);
  });
  it('the owner sees the proposed rule with its Approve button', async () => {
    mount(true);
    await waitFor(() => expect(screen.getByText(rule.text)).toBeTruthy());
    expect(screen.getByText('Approve rule')).toBeTruthy();
  });
  it('the owner asks for the scoreboard with the reviewer code (the server refuses it without one)', async () => {
    const f = mount(true);
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u).includes('scoreboard'))).toBe(true));
    for (const [u, init] of f.mock.calls) {
      if (/scoreboard|case-law/.test(String(u))) expect((init?.headers as Record<string, string>)['x-reviewer-token']).toBe('sekret');
    }
  });
});

import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { Router, Route } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import type { FeedCard, BundleResult } from '@shared/bundle';
import { saveRun } from '@/lib/bundle';
import CardDetail from '../CardDetail';

afterEach(() => { cleanup(); sessionStorage.clear(); });

const base = (over: Partial<FeedCard>): FeedCard => ({ id: 'x', kind: 'discount', title: 'T', body: 'b', amountCents: null, deadline: null, verdict: 'likely', sources: [], traceId: '', ...over });

function open(card: FeedCard, where: 'cards' | 'blocked') {
  const result: BundleResult = { familyId: 'maya', runId: 'r1', receipt: { moneyBackCents: 0, likelyBenefitsCents: 0, deadlineCount: 0, nextDeadline: null, itemsChecked: 0 }, cards: where === 'cards' ? [card] : [], banner: null, blocked: where === 'blocked' ? [card] : [] };
  saveRun({ runId: 'r1', familyId: 'maya', result });
  (global as any).fetch = jest.fn(async () => new Response('[]', { status: 200 }));
  const { hook } = memoryLocation({ path: `/card/${card.id}?run=r1` });
  render(<Router hook={hook}><Route path="/card/:id" component={CardDetail} /></Router>);
}

describe('CardDetail feedback section', () => {
  it('a court-blocked card renders no "I got this / Report issue" feedback', async () => {
    open(base({ id: 'blocked-1', title: 'Blocked trap', verdict: 'blocked' }), 'blocked');
    await waitFor(() => expect(screen.getByText('How we checked')).toBeTruthy());
    expect(screen.queryByText('I got this')).toBeNull();
    expect(screen.queryByText('Report issue')).toBeNull();
  });
  it('a normal card still shows the feedback buttons', async () => {
    open(base({ id: 'discount-2', title: 'Fine deal' }), 'cards');
    await waitFor(() => expect(screen.getByText('I got this')).toBeTruthy());
    expect(screen.getByText('Report issue')).toBeTruthy();
  });
});

describe('CardDetail owner view split (W1-OWNER)', () => {
  const calls = () => ((global as any).fetch as jest.Mock).mock.calls as [string, RequestInit | undefined][];
  it('a parent (no reviewer code) never asks for the audit log and sees one plain "We checked this" line', async () => {
    open(base({ id: 'discount-2', title: 'Fine deal', sources: [{ label: 'Store offer page', url: 'https://example.com' }] }), 'cards');
    await waitFor(() => expect(screen.getByText(/We checked this/)).toBeTruthy());
    expect(calls().some(([u]) => String(u).includes('/trace'))).toBe(false);
    expect(screen.queryByText(/audit log/i)).toBeNull();
    expect(screen.queryByText(/agents? /i)).toBeNull();
  });
  it('the owner (reviewer code set) gets the audit log, asked for with the reviewer header', async () => {
    sessionStorage.setItem('bundle:reviewerToken', 'sekret');
    open(base({ id: 'discount-2', title: 'Fine deal' }), 'cards');
    await waitFor(() => expect(calls().some(([u]) => String(u).includes('/trace'))).toBe(true));
    const [, init] = calls().find(([u]) => String(u).includes('/trace'))!;
    expect((init?.headers as Record<string, string>)['x-reviewer-token']).toBe('sekret');
  });
});

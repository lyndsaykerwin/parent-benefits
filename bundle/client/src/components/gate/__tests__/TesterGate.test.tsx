import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import TesterGate, { MADE_UP_DETAILS_NOTICE } from '../TesterGate';

type Reply = { status: number; body: unknown };

function mockFetch(replies: Record<string, Reply[]>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  (global as any).fetch = jest.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const key = `${init?.method || 'GET'} ${url}`;
    const r = replies[key]?.shift();
    if (!r) throw new Error(`no reply for ${key}`);
    return { ok: r.status < 400, status: r.status, json: async () => r.body } as Response;
  });
  return calls;
}

afterEach(() => { cleanup(); delete (global as any).fetch; document.cookie = 'bundle_gate=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'; });

describe('TesterGate', () => {
  it('opens the app straight away when no tester code is needed (laptop)', async () => {
    mockFetch({ 'GET /api/tester-access': [{ status: 200, body: { required: false, ok: true } }] });
    render(<TesterGate><p>the app</p></TesterGate>);
    expect(await screen.findByText('the app')).toBeTruthy();
    expect(screen.queryByLabelText('Enter the tester code you were sent')).toBeNull();
    expect(screen.queryByTestId('made-up-line')).toBeNull(); // no tester mode on the laptop
  });

  it('opens the app when this phone already typed the code', async () => {
    mockFetch({ 'GET /api/tester-access': [{ status: 200, body: { required: true, ok: true } }] });
    render(<TesterGate><p>the app</p></TesterGate>);
    expect(await screen.findByText('the app')).toBeTruthy();
    expect((await screen.findByTestId('made-up-line')).textContent).toBe(MADE_UP_DETAILS_NOTICE); // stays visible in tester mode
  });

  it('shows the one-field gate with the made-up-details notice when a code is needed', async () => {
    mockFetch({ 'GET /api/tester-access': [{ status: 200, body: { required: true, ok: false } }] });
    render(<TesterGate><p>the app</p></TesterGate>);
    expect(await screen.findByLabelText('Enter the tester code you were sent')).toBeTruthy();
    expect(screen.getByTestId('made-up-notice').textContent).toBe(MADE_UP_DETAILS_NOTICE);
    expect(screen.queryByText('the app')).toBeNull();
  });

  it('shows the server message on a wrong code, then opens the app on the right one', async () => {
    const calls = mockFetch({
      'GET /api/tester-access': [{ status: 200, body: { required: true, ok: false } }],
      'POST /api/tester-access': [
        { status: 401, body: { error: 'That code didn’t work.' } },
        { status: 200, body: { ok: true } },
      ],
    });
    render(<TesterGate><p>the app</p></TesterGate>);
    const input = await screen.findByLabelText('Enter the tester code you were sent');
    fireEvent.change(input, { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start testing' }));
    expect((await screen.findByRole('alert')).textContent).toBe('That code didn’t work.');
    fireEvent.change(input, { target: { value: ' right ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start testing' }));
    expect(await screen.findByText('the app')).toBeTruthy();
    expect(screen.getByTestId('made-up-line').textContent).toBe(MADE_UP_DETAILS_NOTICE); // still shown after unlocking
    const posts = calls.filter((c) => c.init?.method === 'POST');
    expect(JSON.parse(String(posts[1].init?.body))).toEqual({ code: 'right' });
  });

  it('does not block the app when the server cannot be reached', async () => {
    (global as any).fetch = jest.fn(async () => { throw new Error('offline'); });
    render(<TesterGate><p>the app</p></TesterGate>);
    await waitFor(() => expect(screen.getByText('the app')).toBeTruthy());
  });

  it('when the site says a gate is on, the app is not shown before the check finishes', async () => {
    document.cookie = 'bundle_gate=on; path=/';
    mockFetch({ 'GET /api/tester-access': [{ status: 200, body: { required: true, ok: false } }] });
    render(<TesterGate><p>the app</p></TesterGate>);
    expect(screen.queryByText('the app')).toBeNull();
    expect(await screen.findByLabelText('Enter the tester code you were sent')).toBeTruthy();
  });

  it('with no gate note and no fetch available, the app shows immediately', () => {
    delete (global as any).fetch;
    render(<TesterGate><p>the app</p></TesterGate>);
    expect(screen.getByText('the app')).toBeTruthy();
  });
});

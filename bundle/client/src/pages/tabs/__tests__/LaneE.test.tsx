// Lane E extras (Story 6): editing an answer re-runs the check, Forget everything, the Insurance "Change" link, the front door
// (saved profile or questions), the Save your plan name, and Back keeping your place between tabs.
import React from 'react';
import { render, screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import App from '@/App';
import Start from '@/pages/Start';
import { fakeServer, callsTo, type FakeRoute, goTab, mayaRun, openAccount, showVersionB } from '../../../__acceptance__/v2/helpers';

afterEach(() => { cleanup(); for (const k of ['scrollY', 'pageYOffset']) delete (window as any)[k]; try { sessionStorage.clear(); localStorage.clear(); } catch { /* ignore */ } delete (global as any).EventSource; });

const QUIET: FakeRoute[] = [
  [/\/memory/, () => ({ family: [], learned: [] })],
  [/\/gear/, () => ({ items: [], receipts: [] })],
];

describe('Account tab actions', () => {
  it('editing the ZIP re-runs the check for the same saved family, with every answer, and comes back to Account', async () => {
    const server = fakeServer([...QUIET, [/\/api\/run$/, () => ({ runId: 'run-new', familyId: 'guest-ab12cd34' })]]);
    const loc = showVersionB(mayaRun({ familyId: 'guest-ab12cd34' }));
    openAccount();
    fireEvent.click(screen.getByRole('button', { name: 'Edit ZIP code' }));
    const editor = screen.getByTestId('editor-zip');
    fireEvent.change(within(editor).getByLabelText('ZIP code'), { target: { value: '10001' } });
    fireEvent.click(within(editor).getByRole('button', { name: 'Save and re-check' }));
    await waitFor(() => expect(callsTo(server, /\/api\/run$/)).toHaveLength(1));
    const sent = callsTo(server, /\/api\/run$/)[0];
    expect(sent.method).toBe('POST');
    expect(sent.body).toMatchObject({ familyId: 'guest-ab12cd34', zip: '10001', birthDate: '2026-10-03', household: 'two', parent1Work: 'paycheck', parent2Work: 'paycheck', insurance: 'job' });
    await waitFor(() => expect(loc.history?.at(-1)).toBe('/feed/run-new'));
    expect(sessionStorage.getItem('bundle:tab:run-new')).toBe('account');
  });

  it('a wrong ZIP is explained and nothing is sent', () => {
    const server = fakeServer(QUIET);
    showVersionB(mayaRun({ familyId: 'guest-ab12cd34' }));
    openAccount();
    fireEvent.click(screen.getByRole('button', { name: 'Edit ZIP code' }));
    const editor = screen.getByTestId('editor-zip');
    fireEvent.change(within(editor).getByLabelText('ZIP code'), { target: { value: '12' } });
    fireEvent.click(within(editor).getByRole('button', { name: 'Save and re-check' }));
    expect(within(editor).getByRole('alert').textContent).toMatch(/valid 5-digit US ZIP/);
    expect(callsTo(server, /\/api\/run$/)).toHaveLength(0);
  });

  it('a sample family says an edit makes a copy, and sends no family id', async () => {
    const server = fakeServer([...QUIET, [/\/api\/run$/, () => ({ runId: 'run-mine', familyId: 'guest-0a0a0a0a' })]]);
    showVersionB(mayaRun());
    openAccount();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Health insurance' }));
    const editor = screen.getByTestId('editor-insurance');
    expect(editor.textContent).toMatch(/sample family, so saving makes a copy/);
    fireEvent.click(within(editor).getByRole('button', { name: /Medicaid/ }));
    fireEvent.click(within(editor).getByRole('button', { name: 'Save and re-check' }));
    await waitFor(() => expect(callsTo(server, /\/api\/run$/)).toHaveLength(1));
    expect(callsTo(server, /\/api\/run$/)[0].body).not.toHaveProperty('familyId');
    expect(callsTo(server, /\/api\/run$/)[0].body).toMatchObject({ zip: '02139', insurance: 'medicaid' });
    await waitFor(() => expect(localStorage.getItem('bundle_family_id')).toBe('guest-0a0a0a0a'));
  });

  it('the Insurance tab "Change" link opens the insurance answer on the Account tab', () => {
    fakeServer(QUIET);
    showVersionB(mayaRun({ familyId: 'guest-ab12cd34' }));
    goTab('Insurance');
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.getByRole('region', { name: 'Account' })).toBeTruthy();
    expect(screen.getByTestId('editor-insurance')).toBeTruthy();
  });

  it('Forget everything deletes on the server, clears this browser, and goes to the first screen; a failure keeps everything', async () => {
    let fail = true;
    const server = fakeServer([...QUIET, [/\/api\/families\/guest-ab12cd34$/, () => { if (fail) throw new Error('boom'); return { ok: true }; }]]);
    localStorage.setItem('bundle_family_id', 'guest-ab12cd34');
    localStorage.setItem('bundle:claimed:guest-ab12cd34', '{"x":true}');
    const loc = showVersionB(mayaRun({ familyId: 'guest-ab12cd34' }));
    openAccount();
    fireEvent.click(screen.getByRole('button', { name: /Forget everything/ }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toMatch(/can’t be undone/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep my data' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Forget everything/ }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Forget' }));
    expect((await within(screen.getByRole('alertdialog')).findByRole('alert')).textContent).toMatch(/boom|try again/i);
    expect(localStorage.getItem('bundle_family_id')).toBe('guest-ab12cd34'); // nothing was cleared
    fail = false;
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Forget' }));
    await waitFor(() => expect(loc.history?.at(-1)).toBe('/'));
    expect(callsTo(server, /\/api\/families\/guest-ab12cd34$/).map((c) => c.method)).toEqual(['DELETE', 'DELETE']); // the failed try, then the one that worked
    expect(localStorage.length).toBe(0);
  });
});

describe('Save your plan', () => {
  it('Not now hides the card, and the name shows on the Account tab', () => {
    fakeServer(QUIET);
    const first = showVersionB(mayaRun({ familyId: 'guest-ab12cd34' }));
    void first;
    fireEvent.change(screen.getByTestId('save-name-input'), { target: { value: 'Our baby plan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    openAccount();
    expect(screen.getByTestId('family-name').textContent).toBe('Our baby plan');
    goTab('Home');
    expect(screen.getByTestId('save-confirm')).toBeTruthy();
    cleanup();
    localStorage.clear();
    showVersionB(mayaRun({ familyId: 'guest-ab12cd34' }));
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByTestId('save-card')).toBeNull();
  });
});

describe('the front door', () => {
  const open = () => { const { hook } = memoryLocation({ path: '/' }); render(<Router hook={hook}><Start /></Router>); };

  it('a saved id the server no longer knows is dropped and the five questions start', async () => {
    window.scrollTo = jest.fn() as unknown as typeof window.scrollTo;
    localStorage.setItem('bundle_family_id', 'guest-ab12cd34');
    fakeServer([]); // every request is a 404
    open();
    expect(await screen.findByText(/Let’s find what your family is/)).toBeTruthy();
    expect(localStorage.getItem('bundle_family_id')).toBeNull();
  });

  it('"Start over" shows the questions once, even with a saved profile', () => {
    window.scrollTo = jest.fn() as unknown as typeof window.scrollTo;
    localStorage.setItem('bundle_family_id', 'guest-ab12cd34');
    sessionStorage.setItem('bundle:start-over', '1');
    const server = fakeServer([]);
    open();
    expect(screen.getByText(/Let’s find what your family is/)).toBeTruthy();
    expect(callsTo(server, /api/)).toHaveLength(0);
    expect(localStorage.getItem('bundle_family_id')).toBe('guest-ab12cd34'); // kept until new answers replace it
  });

  it('a network problem is not treated as "no profile": the saved id stays and Try again is offered', async () => {
    localStorage.setItem('bundle_family_id', 'guest-ab12cd34');
    (global as any).fetch = jest.fn(async () => { throw new Error('offline'); });
    open();
    expect(await screen.findByText(/couldn’t reach Bundle/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(localStorage.getItem('bundle_family_id')).toBe('guest-ab12cd34');
  });

  it('in React\'s double-run development mode a saved profile is still opened and its id is kept', async () => {
    window.scrollTo = jest.fn() as unknown as typeof window.scrollTo;
    localStorage.setItem('bundle_family_id', 'guest-ab12cd34');
    const run = mayaRun({ familyId: 'guest-ab12cd34' });
    fakeServer([[/\/api\/families\/guest-ab12cd34\/latest-run/, () => ({ runId: run.runId, familyId: run.familyId, status: 'done', startedAt: '2026-10-23T12:00:00.000Z', family: run.family, today: run.today, demoDate: run.demoDate, result: run.result, error: null })]]);
    const loc = memoryLocation({ path: '/', record: true });
    render(<React.StrictMode><Router hook={loc.hook}><Start /></Router></React.StrictMode>);
    await waitFor(() => expect(loc.history?.at(-1)).toBe(`/feed/${run.runId}`));
    expect(localStorage.getItem('bundle_family_id')).toBe('guest-ab12cd34');
  });

  it('the whole App at "/" with no saved id starts the questions', () => {
    const { hook } = memoryLocation({ path: '/' });
    render(<Router hook={hook}><App /></Router>);
    expect(screen.getByText(/Let’s find what your family is/)).toBeTruthy();
  });
});

describe('Back keeps your place between tabs', () => {
  it('coming back to a tab puts you at the spot you left it, and a tab you never scrolled starts at the top', () => {
    const scrollTo = jest.fn();
    const set = (y: number) => {
      Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: y });
      window.dispatchEvent(new Event('scroll'));
    };
    fakeServer(QUIET);
    showVersionB(mayaRun({ familyId: 'guest-ab12cd34' }));
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    set(420); // scrolled down Home
    goTab('Taxes');
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0 });
    set(90);
    goTab('Home');
    expect(scrollTo.mock.calls.some((a) => a[0]?.top === 420)).toBe(true);
    openAccount();
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0 });
  });
});

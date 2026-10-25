// Story 6: Account tab, memory, saved families and Back (plans/v2-build-plan.md, section 1 rulings 5 and 8, round 3 R1/R8, section 4 lane E, section 5).
import React from 'react';
import { render, screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';
import { Router, Route } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import App from '@/App';
import VersionB from '@/pages/tabs/VersionB';
import CardDetail from '@/pages/CardDetail';
import { saveRun } from '@/lib/bundle';
import { FakeES, callsTo, fakeServer, leoRun, mayaRun, showVersionB, tab, goTab } from './helpers';

afterEach(() => { cleanup(); for (const k of ['scrollY', 'pageYOffset']) delete (window as any)[k]; delete (document.documentElement as any).scrollTop; try { sessionStorage.clear(); localStorage.clear(); } catch { /* ignore */ } delete (global as any).EventSource; });

const GEAR = [{ productName: 'Graco SnugRide 35 Lite infant car seat', brand: 'Graco', modelNumber: '2120349', upc: '047406173005' }];
// Each memory entry says where it came from (source) and when (savedOn), so the screen can use a friendly label.
const MEMORY = {
  family: [
    { id: 'mem-201', text: 'Lives in ZIP 02139 (Massachusetts)', source: 'setup', savedOn: '2026-10-23' },
    { id: 'mem-202', text: 'Health insurance through a job', source: 'setup', savedOn: '2026-10-23' },
  ],
  learned: [{ id: 'mem-95', text: 'Auto-renewing "free" boxes are a catch', reports: 3 }],
};

describe('S6a: Account tab with friendly memory labels', () => {
  // S6 — "There is an Account tab. It shows the 5 onboarding answers, the Gear Locker, 'What Bundle remembers about your
  // family' with friendly labels ('Remembered from your setup', 'Saved in Meterless memory') and no raw 'mem-' ids on
  // screen until 'Technical details' is tapped, 'What Bundle has learned from parents' with 'learned from N parent reports',
  // plus 'Forget everything' and 'Start over'. Home no longer shows 'Start over with your own details'."
  it('shows answers, gear and friendly memory labels; mem- ids only after "Technical details"', async () => {
    fakeServer([
      [/memory/i, () => MEMORY],
      [/gear|purchase|items/i, () => ({ items: GEAR, receipts: [] })],
    ]);
    const loc = showVersionB(mayaRun({ familyId: 'guest-ab12cd34', family: { name: 'Your family' } }));

    expect(screen.queryByText(/Start over with your own details/)).toBeNull();

    expect(tab('Account')).toBeTruthy();
    goTab('Account');
    expect(tab('Account').getAttribute('aria-current')).toBe('page');
    const page = screen.getByRole('region', { name: 'Account' });

    // the 5 answers (Q4 in its new two-part wording)
    expect(within(page).getByText(/Baby[’']s here/)).toBeTruthy();
    expect(within(page).getByText(/Oct(ober)? 3, 2026/)).toBeTruthy();
    expect(within(page).getByText(/02139/)).toBeTruthy();
    expect(within(page).getByText(/Two of us/)).toBeTruthy();
    expect(within(page).getAllByText(/Paycheck from a job/).length).toBeGreaterThan(0);
    expect(within(page).getByText(/Through a job/)).toBeTruthy();

    // gear locker
    const locker = await within(page).findByRole('region', { name: /Gear locker/i });
    expect(within(locker).getByText(/Graco SnugRide 35 Lite/)).toBeTruthy();

    // memory, from the server, in friendly words
    expect(await within(page).findByText(/What Bundle remembers about your family/)).toBeTruthy();
    expect(await within(page).findByText(/Lives in ZIP 02139/)).toBeTruthy();
    expect(within(page).getAllByText(/Remembered from your setup/).length).toBeGreaterThan(0);
    expect(within(page).getAllByText(/Saved in Meterless memory/).length).toBeGreaterThan(0);
    expect(within(page).getByText(/What Bundle has learned from parents/)).toBeTruthy();
    expect(within(page).getByText(/learned from 3 parent reports/)).toBeTruthy();
    expect(page.textContent).not.toMatch(/mem-\d+/);

    // the raw ids sit behind "Technical details"
    fireEvent.click(within(page).getAllByRole('button', { name: /Technical details/i })[0]);
    await waitFor(() => expect(page.textContent).toMatch(/mem-\d+/));

    // trust actions
    expect(within(page).getByRole('button', { name: /Forget everything/i })).toBeTruthy();
    const startOver = within(page).queryByRole('link', { name: /Start over/i }) ?? within(page).getByRole('button', { name: /Start over/i });
    fireEvent.click(startOver);
    expect(loc.history?.at(-1)).toBe('/');
  });
});

/** Opens the "Switch family" control (a drop-down list or a menu button) and picks a family by name. */
function switchFamily(name: RegExp) {
  const page = screen.getByRole('region', { name: 'Account' });
  const select = within(page).queryByRole('combobox', { name: /Switch family/i });
  if (select) {
    const option = within(select).getAllByRole('option').find((o) => name.test(o.textContent ?? ''));
    if (!option) throw new Error(`No "${name}" choice in the Switch family list`);
    fireEvent.change(select, { target: { value: (option as HTMLOptionElement).value } });
    return;
  }
  fireEvent.click(within(page).getByRole('button', { name: /Switch family/i }));
  const item = screen.queryAllByRole('menuitem', { name }).concat(screen.queryAllByRole('menuitemradio', { name }), screen.queryAllByRole('option', { name }))[0];
  if (!item) throw new Error(`No "${name}" choice in the Switch family menu`);
  fireEvent.click(item);
}

/** Fake server reply for GET /api/families/<id>…: the saved family plus its last finished run, in several common shapes. */
function familyReply(run: ReturnType<typeof mayaRun>) {
  const status = { runId: run.runId, familyId: run.familyId, status: 'done', startedAt: '2026-10-23T12:00:00.000Z', family: run.family, today: run.today, demoDate: run.demoDate, result: run.result, error: null };
  return { ...status, id: run.familyId, family: { id: run.familyId, ...run.family }, run: status, lastRun: status, latestRun: status };
}

describe('S6b: saved families, Switch family, and Back keeps your place', () => {
  // S6 (R1) — "The Account tab has a 'Switch family' menu (Maya, Leo, Ava, My saved profile). Choosing Leo loads Leo's
  // saved results and the Account tab then shows Leo's answers (due Dec 7, 2026, ZIP 02446)."
  it('"Switch family" → Leo shows Leo\'s answers (due Dec 7, 2026, ZIP 02446)', async () => {
    const leo = leoRun();
    fakeServer([
      [/\/api\/families\/leo/i, () => familyReply(leo)],
      [/\/api\/runs\/run-leo$/, () => familyReply(leo).run],
      [/memory/i, () => ({ family: [], learned: [] })],
      [/gear|purchase|items/i, () => ({ items: [], receipts: [] })],
    ]);
    showVersionB(mayaRun());
    goTab('Account');
    switchFamily(/Leo/);

    await waitFor(() => {
      const page = screen.getByRole('region', { name: 'Account' });
      expect(within(page).getByText(/Dec(ember)? 7, 2026/)).toBeTruthy();
      expect(within(page).getByText(/02446/)).toBeTruthy();
    });
    const page = screen.getByRole('region', { name: 'Account' });
    expect(page.textContent).not.toMatch(/02139/);
  });

  // S6 (R1) — "The browser remembers the family id (localStorage 'bundle_family_id'). Opening the app with a saved id loads
  // that family's saved results straight away, without showing the onboarding questions."
  it('a saved bundle_family_id in localStorage opens that family\'s results without onboarding', async () => {
    (global as any).EventSource = FakeES;
    window.scrollTo = jest.fn() as unknown as typeof window.scrollTo;
    localStorage.setItem('bundle_family_id', 'fam-7f3a9c');
    const run = mayaRun({ familyId: 'fam-7f3a9c', family: { name: 'Your family' } });
    const server = fakeServer([
      [/\/api\/families\//i, () => familyReply(run)],
      [new RegExp(`/api/runs/${run.runId}$`), () => familyReply(run).run],
      [/\/agent-log|\/trace/, () => []],
      [/memory/i, () => ({ family: [], learned: [] })],
      [/gear|purchase|items/i, () => ({ items: [], receipts: [] })],
    ]);
    const { hook } = memoryLocation({ path: '/' });
    render(<Router hook={hook}><App /></Router>);

    await waitFor(() => expect(callsTo(server, /\/api\/families\/fam-7f3a9c/i).length).toBeGreaterThan(0));
    expect(await screen.findByRole('navigation', { name: 'Main' })).toBeTruthy();
    expect(screen.getByTestId('still-to-claim')).toBeTruthy();
    expect(screen.queryByText(/Let[’']s find what your family is/)).toBeNull();
    expect(screen.queryByText(/Where are you right now\?/)).toBeNull();
  });

  // S6 (R8) — "Back from a card's detail page returns to the tab the card was opened from (for example Deals), not Home,
  // at the same scroll spot the parent left."
  it('Back from card detail returns to the tab the card came from (Deals), not Home, at the same scroll spot', async () => {
    const scrollTo = jest.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    const setScroll = (y: number) => {
      Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: y });
      Object.defineProperty(window, 'pageYOffset', { configurable: true, writable: true, value: y });
      Object.defineProperty(document.documentElement, 'scrollTop', { configurable: true, writable: true, value: y });
      window.dispatchEvent(new Event('scroll'));
    };
    const run = mayaRun();
    fakeServer([
      [new RegExp(`/api/runs/${run.runId}$`), () => familyReply(run).run],
      [/\/agent-log|\/trace/, () => []],
      [/memory/i, () => ({ family: [], learned: [] })],
      [/gear|purchase|items/i, () => ({ items: [], receipts: [] })],
    ]);
    saveRun(run);
    const loc = memoryLocation({ path: `/feed/${run.runId}`, record: true });
    render(
      <Router hook={loc.hook}>
        <Route path="/feed/:runId">{() => <VersionB run={run} owner={false} />}</Route>
        <Route path="/card/:id" component={CardDetail} />
      </Router>,
    );
    goTab('Deals');
    const offer = screen.getByRole('article', { name: /Free newborn diaper box/ });
    const open = within(offer).queryAllByRole('link').find((a) => /\/card\//.test(a.getAttribute('href') ?? ''));
    if (!open) throw new Error('No link to the card detail page inside the offer card');
    setScroll(640); // the parent has scrolled down the Deals tab
    fireEvent.click(open);
    setScroll(0); // the detail page opens at the top
    expect(loc.history?.at(-1)).toMatch(/^\/card\//);

    const back = await screen.findByRole('link', { name: /Back|Your feed/ });
    fireEvent.click(back);
    await waitFor(() => expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy());
    expect(tab('Deals').getAttribute('aria-current')).toBe('page');
    expect(tab('Home').getAttribute('aria-current')).not.toBe('page');
    // back at the same spot: window.scrollTo(0, 640) or window.scrollTo({ top: 640 })
    await waitFor(() => expect(scrollTo.mock.calls.some((a) => a[1] === 640 || (a[0] && typeof a[0] === 'object' && a[0].top === 640))).toBe(true));
  });
});

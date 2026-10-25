import React from 'react';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import VersionB from '../VersionB';
import { sampleRun } from '../../../test-support/sampleRuns';
import { fmtUsdShort } from '@/lib/bundle';

beforeAll(() => { window.scrollTo = jest.fn() as unknown as typeof window.scrollTo; });
afterEach(() => { cleanup(); try { sessionStorage.clear(); localStorage.clear(); } catch { /* ignore */ } });

function show(id: Parameters<typeof sampleRun>[0], opts: { owner?: boolean; withState?: boolean; ownerPanel?: React.ReactNode } = {}) {
  const run = sampleRun(id, { withState: opts.withState });
  const { hook } = memoryLocation({ path: `/feed/${run.runId}` });
  render(<Router hook={hook}><VersionB run={run} owner={!!opts.owner} ownerPanel={opts.ownerPanel} /></Router>);
  return run;
}
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: new RegExp(`^${name}`) });
const plus = () => screen.getByRole('button', { name: /take a photo/i });

describe('Version B tabs, baby is here (Maya)', () => {
  it('shows Home, Taxes, Savings, Insurance and Deals, starting on Home, with a "+" on every tab', () => {
    show('maya');
    const bar = screen.getByRole('navigation', { name: 'Main' });
    expect(within(bar).getAllByRole('button').map((b) => b.textContent?.replace(/\d+$/, ''))).toEqual(['Home', 'Taxes', 'Savings', 'Insurance', 'Deals']);
    expect(tab('Home').getAttribute('aria-current')).toBe('page');
    for (const name of ['Home', 'Taxes', 'Savings', 'Insurance', 'Deals']) {
      fireEvent.click(tab(name));
      expect(tab(name).getAttribute('aria-current')).toBe('page');
      expect(plus()).toBeTruthy();
    }
  });

  it('the "+" opens "Take a photo"', () => {
    show('maya');
    fireEvent.click(tab('Deals'));
    fireEvent.click(plus());
    const dialog = screen.getByRole('dialog', { name: /take a photo/i });
    expect(within(dialog).getByLabelText(/take or choose a photo/i)).toBeTruthy();
  });

  it('Home: the big number is the run total, in "savings and tax credits" (never "cash"), with "How we got this number"', () => {
    const run = show('maya');
    const total = run.result.receipt.moneyBackCents + run.result.receipt.likelyBenefitsCents;
    expect(screen.getByTestId('home-total-amount').textContent).toBe(fmtUsdShort(total));
    const sub = screen.getByTestId('home-total-sub').textContent!;
    expect(sub).toMatch(/in savings and tax credits, plus \$[\d,.]+ in free gifts/);
    expect(document.body.textContent).not.toMatch(/\bcash\b/i);
    expect(screen.getByText('How we got this number')).toBeTruthy();
    // the lines inside add up to the headline
    const lines = within(screen.getByTestId('how-number')).getAllByText(/^\$[\d,.]+$/).map((e) => Number(e.textContent!.replace(/[$,]/g, '')));
    expect(Math.round(lines.reduce((a, b) => a + b, 0) * 100)).toBe(total);
  });

  it('Home: "Do these first" lists the real deadline with its countdown', () => {
    show('maya');
    const first = screen.getByRole('region', { name: 'Home' });
    expect(within(first).getByText('Do these first')).toBeTruthy();
    expect(screen.getByTestId('urgent-label').textContent).toBe('10 days left');
  });

  it('Home: category tiles carry the run\'s numbers and the blocked-deal trust card shows', () => {
    const run = show('maya');
    const n = run.result.blocked!.length;
    expect(n).toBeGreaterThan(0);
    expect(screen.getByText(new RegExp(`We blocked ${n} ${n === 1 ? 'deal' : 'deals'} with a hidden catch`))).toBeTruthy();
    fireEvent.click(screen.getByTestId('trust-card'));
    expect(tab('Deals').getAttribute('aria-current')).toBe('page');
  });

  it('Taxes: tax credits with "How we checked", and the Dependent Care FSA is a "Check with your job" card with no dollar amount', () => {
    show('maya');
    fireEvent.click(tab('Taxes'));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('$2,640 off your taxes');
    const fsa = screen.getByRole('article', { name: /Dependent Care FSA/ });
    expect(within(fsa).getByText('Check with your job')).toBeTruthy();
    expect(within(fsa).queryByTestId('card-amount')).toBeNull();
    expect(within(fsa).queryByText(/\$/)).toBeNull();
    expect(screen.getAllByText(/How we checked/).length).toBeGreaterThanOrEqual(3);
    expect(document.body.textContent).not.toMatch(/daycare invoice/i);
  });

  it('Savings: starter account, money back and the recall alert, from the run', () => {
    show('maya');
    fireEvent.click(tab('Savings'));
    expect(screen.getByRole('article', { name: /Reimburse your Frida baby thermometer/ })).toBeTruthy();
    expect(screen.getByRole('article', { name: /Price drop on your Graco/ })).toBeTruthy();
    expect(screen.getByRole('article', { name: /Recall alert: KEAWIS Crib Mattress/ })).toBeTruthy();
    expect(screen.queryAllByTestId('needs-purchases')).toHaveLength(0);
  });

  it('Insurance: counts the real deadline from the birth date, and pins the red badge while you are elsewhere', () => {
    show('maya');
    expect(within(tab('Insurance')).getByLabelText('1 deadline').textContent).toBe('1');
    fireEvent.click(tab('Insurance'));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('1 deadline in 10 days');
    expect(within(tab('Insurance')).queryByLabelText(/deadline/)).toBeNull();
    expect(screen.getByRole('article', { name: /Paid Family and Medical Leave/ })).toBeTruthy();
  });

  it('Deals: offers that passed, and the blocked ones under "We caught these for you"', () => {
    show('maya');
    fireEvent.click(tab('Deals'));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/^\$[\d,.]+ in free gifts$/);
    expect(screen.getByRole('article', { name: /Free newborn diaper box/ })).toBeTruthy();
    const blocked = screen.getByTestId('blocked-section');
    expect(within(blocked).getByText('We caught these for you')).toBeTruthy();
    expect(within(blocked).getByText('Free baby registry welcome box')).toBeTruthy();
    expect(within(blocked).getAllByText('Blocked by Bundle').length).toBeGreaterThan(0);
  });
});

describe('Version B tabs, expecting (Leo)', () => {
  it('Home leads with free gifts, and deadlines say "starts at birth" instead of a countdown', () => {
    show('leo');
    expect(screen.getByText('Waiting for your family')).toBeTruthy();
    expect(screen.getByTestId('home-total-sub').textContent).toMatch(/once baby arrives.*free gifts you can get now/);
    const gifts = screen.getByRole('region', { name: 'Free gifts' });
    const urgent = screen.getByRole('region', { name: 'Do these first' });
    expect(gifts.compareDocumentPosition(urgent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('urgent-label').textContent).toMatch(/^Starts at birth/);
    expect(document.body.textContent).not.toMatch(/days left/);
  });

  it('every benefit deadline says "Starts at birth", including the year-long paid-leave card', () => {
    show('leo');
    fireEvent.click(tab('Insurance'));
    const leave = screen.getByRole('article', { name: /Paid Family and Medical Leave/ });
    expect(within(leave).getByText('Starts at birth')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/days left|By Dec 7|Ends /);
    fireEvent.click(tab('Taxes'));
    expect(document.body.textContent).not.toMatch(/days left/);
  });

  it('Insurance says deadlines start at birth, with no badge', () => {
    show('leo');
    expect(within(tab('Insurance')).queryByLabelText(/deadline/)).toBeNull();
    fireEvent.click(tab('Insurance'));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Deadlines that start at birth');
    expect(screen.getAllByText(/Starts at birth/).length).toBeGreaterThan(0);
  });

  it('Savings shows two "Needs purchases" tiles and points to the + photo button (no purchases yet)', () => {
    show('leo');
    fireEvent.click(tab('Savings'));
    expect(screen.getAllByTestId('needs-purchases')).toHaveLength(2);
    expect(screen.getByTestId('purchases-prompt').textContent).toMatch(/tap the \+/);
  });
});

describe('light extras', () => {
  it('"I got this" moves money to "Claimed so far", persists in this browser, and reveals the share bar', () => {
    const run = show('maya');
    expect(screen.queryByTestId('share-bar')).toBeNull();
    fireEvent.click(tab('Savings'));
    const acct = screen.getByRole('article', { name: /Trump Account/ });
    fireEvent.click(within(acct).getByRole('button', { name: 'I got this' }));
    fireEvent.click(tab('Home'));
    expect(screen.getByTestId('claimed-so-far').textContent).toMatch(/\$1,000/);
    expect(screen.getByTestId('share-bar')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(`bundle:claimed:${run.familyId}`)!)).toEqual({ 'benefit-trump_account': true });
    cleanup();
    show('maya');
    expect(screen.getByTestId('claimed-so-far').textContent).toMatch(/\$1,000/);
  });

  it('starts with nothing claimed and the whole total still to claim', () => {
    const run = show('maya');
    expect(screen.getByTestId('claimed-so-far').textContent).toMatch(/\$0/);
    expect(screen.getByTestId('still-to-claim').textContent).toContain(fmtUsdShort(run.result.receipt.moneyBackCents + run.result.receipt.likelyBenefitsCents));
  });

  it('share sends a link only: no names, dates, ZIP or amounts', async () => {
    const share = jest.fn(async () => undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    show('maya');
    fireEvent.click(tab('Savings'));
    fireEvent.click(within(screen.getByRole('article', { name: /Trump Account/ })).getByRole('button', { name: 'I got this' }));
    fireEvent.click(tab('Home'));
    fireEvent.click(screen.getByRole('button', { name: 'Share this with a friend' }));
    await Promise.resolve();
    expect(share).toHaveBeenCalledTimes(1);
    const arg = (share.mock.calls[0] as unknown as [{ text: string; url: string }])[0];
    expect(arg.text + arg.url).not.toMatch(/\$|Maya|\d{4}-\d{2}-\d{2}|\b\d{5}\b|run-maya/);
    delete (navigator as any).share;
  });

  it('"Save your list" is a labelled demo and saves nothing', () => {
    show('maya');
    const card = screen.getByTestId('save-card');
    expect(within(card).getByText('Demo: not built yet')).toBeTruthy();
    const btn = within(card).getByRole('button', { name: /Continue with Google/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(card.textContent).toMatch(/does nothing for now/);
  });
});

describe('uncovered states', () => {
  it('shows federal programs plus a visible "coming soon" card on Home and Taxes (never an error)', () => {
    show('fern', { withState: true });
    expect(screen.getByTestId('state-coming-soon').textContent).toMatch(/Support for your state’s programs is coming soon/);
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(tab('Taxes'));
    expect(screen.getByTestId('state-coming-soon')).toBeTruthy();
    expect(screen.getByRole('article', { name: /Federal Child Tax Credit/ })).toBeTruthy();
  });

  it('covered states do not show it', () => {
    show('maya', { withState: true });
    expect(screen.queryByTestId('state-coming-soon')).toBeNull();
  });
});

describe('owner view slot', () => {
  it('leaves a slot for the agent panel for the owner only', () => {
    show('maya', { owner: true, ownerPanel: <p>panel goes here</p> });
    expect(screen.getByTestId('owner-panel-slot').textContent).toBe('panel goes here');
  });
  it('a parent never gets the slot or the panel', () => {
    show('maya', { owner: false, ownerPanel: <p>panel goes here</p> });
    expect(screen.queryByTestId('owner-panel-slot')).toBeNull();
    expect(screen.queryByText('panel goes here')).toBeNull();
  });
});

describe('tab memory', () => {
  it('reopens on the tab you were on (coming back from "How we checked")', () => {
    show('maya');
    fireEvent.click(tab('Deals'));
    cleanup();
    show('maya');
    expect(tab('Deals').getAttribute('aria-current')).toBe('page');
  });
});

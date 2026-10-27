// Lane A (Oct 26 feedback round): screens and wording. One describe per approved decision (plans/2026-10-26-feedback-round-plan.md).
import React from 'react';
import { render, screen, cleanup, fireEvent, within, waitFor, act } from '@testing-library/react';
import { Router, Route } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import VersionB from '../VersionB';
import HrQuestions from '../HrQuestions';
import Feed from '../../Feed';
import { bucketOf } from '@shared/cardMeta';
import { courtLine } from '@/lib/offers';
import { verdictLabel } from '@/lib/offers';
import { sendToSelf } from '@/lib/sendToSelf';
import { catchWord } from '@/lib/tabs';
import type { OfferFacts } from '@shared/bundle';
import { fakeServer, goTab, mayaRun, openAccount, showVersionB, FakeES } from '../../../__acceptance__/v2/helpers';

beforeAll(() => { window.scrollTo = jest.fn() as unknown as typeof window.scrollTo; });
afterEach(() => { cleanup(); try { sessionStorage.clear(); localStorage.clear(); } catch { /* ignore */ } delete (global as any).EventSource; });

const QUIET: [RegExp, () => unknown][] = [[/\/memory/, () => ({ family: [], learned: [] })], [/\/gear/, () => ({ items: [], receipts: [] })]];
const region = (name: string) => screen.getByRole('region', { name });
function showOwner(run = mayaRun()) {
  const loc = memoryLocation({ path: `/feed/${run.runId}`, record: true });
  render(<Router hook={loc.hook}><VersionB run={run} owner /></Router>);
}

describe('1. the plan saves itself', () => {
  it('Home shows one plain line, with no name box, "Save name" or "Not now"', () => {
    fakeServer(QUIET);
    showVersionB(mayaRun({ familyId: 'guest-ab12cd34' }));
    expect(screen.getByTestId('plan-saved').textContent).toBe('✓ Your plan is saved.');
    expect(screen.queryByTestId('save-card')).toBeNull();
    expect(screen.queryByTestId('save-name-input')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save name' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Not now' })).toBeNull();
  });

  it('naming the plan lives on the Account page', () => {
    fakeServer(QUIET);
    showVersionB(mayaRun({ familyId: 'guest-ab12cd34' }));
    openAccount();
    fireEvent.click(screen.getByRole('button', { name: 'Name this plan' }));
    fireEvent.change(screen.getByLabelText(/Plan name/), { target: { value: 'Our baby plan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(screen.getByTestId('family-name').textContent).toBe('Our baby plan');
    expect(localStorage.getItem('bundle:plan:guest-ab12cd34')).toMatch(/Our baby plan/);
  });
});

describe('2. Trump Account and the 529 live on Savings', () => {
  it('the Trump Account is its own "baby savings" bucket on Home, not "At tax time"', () => {
    expect(bucketOf({ id: 'benefit-trump_account', kind: 'benefit', verdict: 'likely', amountCents: 100000, category: 'tax_time' } as any)).toBe('baby_savings');
    expect(bucketOf({ id: 'benefit-federal_child_tax_credit', kind: 'benefit', verdict: 'likely', amountCents: 220000 } as any)).toBe('tax_time');
    fakeServer(QUIET);
    showVersionB(mayaRun());
    expect(screen.getByTestId('bucket-tax-time').textContent).not.toMatch(/Trump/);
    const savings = screen.getByTestId('bucket-baby-savings');
    expect(savings.textContent).toMatch(/Trump Account/);
    expect(savings.textContent).toMatch(/\$1,000/);
  });

  it('Savings spells out the steps (Social Security number, then IRS Form 4547) and has the MA 529 card; Taxes has neither', () => {
    fakeServer(QUIET);
    showVersionB(mayaRun());
    goTab('Taxes');
    expect(region('Taxes').textContent).not.toMatch(/Trump Account/);
    expect(screen.queryByTestId('card-529')).toBeNull();
    goTab('Savings');
    const steps = screen.getByTestId('trump-steps');
    expect(steps.textContent).toMatch(/Social Security number/);
    expect(steps.textContent).toMatch(/IRS Form 4547/);
    expect(steps.textContent).toMatch(/born 2025.2028/);
    expect(screen.getByTestId('card-529')).toBeTruthy();
  });

  it('the 529 line on Savings agrees with the filing answer given on Taxes', () => {
    fakeServer(QUIET);
    showVersionB(mayaRun());
    goTab('Taxes');
    fireEvent.click(screen.getByRole('button', { name: 'Married filing together' }));
    goTab('Savings');
    expect(screen.getByTestId('card-529').textContent).toContain('$2,000 (filing together)');
  });
});

describe('3. Child Tax Credit wording', () => {
  it('says what $2,200 and $1,700 each mean, never "(up to $1,700 refundable)"', () => {
    fakeServer(QUIET);
    showVersionB(mayaRun());
    const tax = screen.getByTestId('bucket-tax-time');
    expect(tax.textContent).toContain('Lowers your taxes by up to $2,200; up to $1,700 of that can come back as a refund even if you owe nothing.');
    expect(document.body.textContent).not.toMatch(/\$1,700 refundable/);
  });
});

describe('4. "Fine Print", not "Fine Print Court"', () => {
  const facts = (over: Partial<OfferFacts> = {}): OfferFacts => ({ court: 'approve', subscriptionTraps: 0, hiddenFeeCents: 0, catches: [], minutes: 5, trueValueCents: 3500, ageDays: null, minAgeDays: null, maxAgeDays: null, ...over } as OfferFacts);
  it('the offer-card lines say "Fine print" and "OK, with a catch"', () => {
    expect(courtLine(facts()).text).toBe('Fine print: OK (no subscription traps, no hidden fees)');
    expect(courtLine(facts({ court: 'approve_with_catch', catches: ['signs you up for a paid trial'] })).text).toBe('Fine print: OK, with a catch: signs you up for a paid trial');
    expect(courtLine(facts({ court: 'reject', catches: ['a paid membership is required'] })).text).toBe('Fine print: Blocked: a paid membership is required');
    expect(verdictLabel.approve_with_catch).toBe('OK, with a catch');
  });

  it('no parent tab says "Fine Print Court" or "court"', () => {
    fakeServer(QUIET);
    showVersionB(mayaRun());
    for (const t of ['Home', 'Taxes', 'Savings', 'Insurance', 'Deals']) {
      goTab(t);
      expect(document.body.textContent).not.toMatch(/Fine Print Court/i);
      expect(document.body.innerHTML).not.toMatch(/Fine Print Court/i); // aria-labels too
    }
  });
});

describe('5. "How we checked" only on deals, money back and recalls', () => {
  it('benefit cards get a plain "Source" link to their source; deals, money back and recalls keep "How we checked"', () => {
    fakeServer(QUIET);
    showVersionB(mayaRun());
    goTab('Taxes');
    const ctc = screen.getByRole('article', { name: /^Federal Child Tax Credit/ });
    expect(within(ctc).queryByRole('link', { name: /How we checked/ })).toBeNull();
    expect(within(ctc).getByRole('link', { name: /^Source/ }).getAttribute('href')).toBe('https://www.irs.gov/credits-deductions/individuals/child-tax-credit');
    goTab('Savings');
    for (const name of [/Trump Account/]) expect(within(screen.getByRole('article', { name })).queryByRole('link', { name: /How we checked/ })).toBeNull();
    const fsa = screen.getAllByRole('article').find((a) => a.getAttribute('data-kind') === 'clawback')!;
    expect(within(fsa).getByRole('link', { name: /How we checked/ })).toBeTruthy();
    const recall = screen.getAllByRole('article').find((a) => a.getAttribute('data-kind') === 'recall');
    if (recall) expect(within(recall).getByRole('link', { name: /How we checked/ })).toBeTruthy();
    goTab('Deals');
    const deal = screen.getAllByRole('article').find((a) => a.getAttribute('data-kind') === 'discount')!;
    expect(within(deal).getByRole('link', { name: /How we checked/ })).toBeTruthy();
  });

  it('the owner (reviewer code) keeps "How we checked" on every card', () => {
    fakeServer(QUIET);
    showOwner();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: /^Taxes/ }));
    const ctc = screen.getByRole('article', { name: /^Federal Child Tax Credit/ });
    expect(within(ctc).getByRole('link', { name: /How we checked/ })).toBeTruthy();
  });
});

describe('6. Account in plain words', () => {
  const MEMORY = {
    family: [{ id: 'mem-201', text: 'Lives in ZIP 02139', source: 'setup', savedOn: '2026-10-23' }],
    learned: [
      { id: 'mem-95', text: 'Auto-renewing "free" boxes are a catch', reports: 3 },
      { id: 'mem-7', text: 'Enfamil offer "Free box" graded approve_with_catch: true value $5.00', reports: null },
    ],
  };
  it('a parent sees no Meterless, no "Technical details" and no automatic grading notes', async () => {
    fakeServer([[/\/memory/, () => MEMORY], [/\/gear/, () => ({ items: [], receipts: [] })]]);
    showVersionB(mayaRun());
    openAccount();
    const page = region('Account');
    expect(await within(page).findByText(/Lives in ZIP 02139/)).toBeTruthy();
    expect(within(page).getByText('What we know about your family')).toBeTruthy();
    expect(within(page).getAllByText(/From your answers/).length).toBeGreaterThan(0);
    expect(within(page).getByText('Tips from other parents')).toBeTruthy();
    expect(within(page).getByText(/Auto-renewing/)).toBeTruthy();
    expect(page.textContent).not.toMatch(/Meterless|Technical details|graded|Enfamil|Bundle learned|re-check|exact/);
    expect(within(page).queryByRole('button', { name: /Technical details/ })).toBeNull();
    expect(page.textContent).toMatch(/Your numbers are \d+% complete\./);
  });

  it('the owner (reviewer code) still sees Meterless, grading notes and "Technical details"', async () => {
    fakeServer([[/\/memory/, () => MEMORY], [/\/gear/, () => ({ items: [], receipts: [] })]]);
    showOwner();
    openAccount();
    const page = region('Account');
    expect(await within(page).findByText(/Lives in ZIP 02139/)).toBeTruthy();
    expect(within(page).getAllByText(/Saved in Meterless memory/).length).toBeGreaterThan(0);
    expect(within(page).getByText(/Enfamil/)).toBeTruthy();
    expect(within(page).getAllByRole('button', { name: /Technical details/ }).length).toBe(2);
  });
});

describe('7. "Email to myself" never fails silently', () => {
  const nav = (over: Record<string, unknown>) => ({ maxTouchPoints: 0, ...over }) as unknown as Navigator;
  it('a computer opens a mailto: link, even when the browser has a Share sheet', async () => {
    const share = jest.fn();
    const open = jest.fn();
    const r = await sendToSelf({ title: 'Questions', text: '1. Hi' }, { nav: nav({ share }), open });
    expect(share).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith('mailto:?subject=Questions&body=1.%20Hi');
    expect(r.ok).toBe(true);
  });
  it('a phone uses the Share sheet; closing it is not an error', async () => {
    const open = jest.fn();
    const ok = await sendToSelf({ title: 'Q', text: 't' }, { nav: nav({ maxTouchPoints: 5, share: jest.fn(async () => {}) }), open });
    expect(ok).toEqual({ ok: true, message: null });
    const abort = Object.assign(new Error('closed'), { name: 'AbortError' });
    const closed = await sendToSelf({ title: 'Q', text: 't' }, { nav: nav({ maxTouchPoints: 5, share: jest.fn(async () => { throw abort; }) }), open });
    expect(closed).toEqual({ ok: true, message: null });
    expect(open).not.toHaveBeenCalled();
  });
  it('a phone whose Share sheet fails falls back to email; if that fails too, it says so', async () => {
    const open = jest.fn();
    const blocked = Object.assign(new Error('no'), { name: 'NotAllowedError' });
    await sendToSelf({ title: 'Q', text: 't' }, { nav: nav({ maxTouchPoints: 5, share: jest.fn(async () => { throw blocked; }) }), open });
    expect(open).toHaveBeenCalledTimes(1);
    const r = await sendToSelf({ title: 'Q', text: 't' }, { nav: nav({}), open: () => { throw new Error('nope'); } });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/Copy/);
  });
  it('a computer is told to "click" Copy; a phone to "tap" it', async () => {
    const r = await sendToSelf({ title: 'Q', text: 't' }, { nav: nav({}), open: jest.fn() });
    expect(r.message).toMatch(/click Copy/);
    const failedOnPhone = await sendToSelf({ title: 'Q', text: 't' }, { nav: nav({ maxTouchPoints: 5 }), open: () => { throw new Error('x'); } });
    expect(failedOnPhone.message).toMatch(/Tap Copy/);
  });
  it('on a phone the button says "Choose where to send it…", not "Opening your email…"', async () => {
    const share = jest.fn(() => new Promise<void>(() => {})); // the Share sheet stays open
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
    const { hook } = memoryLocation({ path: '/' });
    render(<Router hook={hook}><HrQuestions run={mayaRun()} onBack={() => {}} /></Router>);
    fireEvent.click(screen.getByRole('button', { name: 'Email to myself' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Choose where to send it…'));
    expect(share).toHaveBeenCalled();
    delete (navigator as any).share;
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });
  });
  it('the Taxes "Send these" card has a working Copy button with visible feedback', async () => {
    const writeText = jest.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    fakeServer(QUIET);
    showVersionB(mayaRun());
    goTab('Taxes');
    fireEvent.click(screen.getByRole('button', { name: 'Married filing together' }));
    const card = screen.getByTestId('booster-taxes-result');
    fireEvent.click(within(card).getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(within(card).getByRole('status').textContent).toMatch(/^Copied/));
    expect((writeText.mock.calls[0] as unknown as string[])[0]).toMatch(/tax credits/);
  });
  it('the button shows "Opening your email…" when clicked on a computer', async () => {
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {}); // jsdom cannot follow a mailto: link and says so
    const run = mayaRun();
    const { hook } = memoryLocation({ path: '/' });
    render(<Router hook={hook}><HrQuestions run={run} onBack={() => {}} /></Router>);
    fireEvent.click(screen.getByRole('button', { name: 'Email to myself' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Opening your email…/));
    quiet.mockRestore();
  });
});

describe('fine-print catch words', () => {
  it('the new ai_found_catch type is said in plain words', () => {
    expect(catchWord('ai_found_catch')).toBe('our checker found a catch in the fine print');
  });
});

describe('8. the checking screen shows only the checklist', () => {
  const mk = (id: string, title: string) => ({ id, kind: 'benefit', title, body: 'Plain body', amountCents: null, deadline: null, verdict: 'verified', sources: [{ label: 'Src', url: 'https://example.gov' }], traceId: 'owner-trace-id' });
  const receipt = { moneyBackCents: 0, likelyBenefitsCents: 0, deadlineCount: 0, nextDeadline: null, itemsChecked: 0 };
  const running = { runId: 'r2', familyId: 'maya', status: 'running', startedAt: new Date().toISOString(), family: { name: 'maya', birthDate: null, dueDate: '2026-12-07' }, today: '2026-10-23', demoDate: false, result: null, error: null, progress: [], owner: false };
  const saved = { ...running, runId: 'old', status: 'done', result: { familyId: 'maya', runId: 'old', receipt, cards: [mk('saved-1', 'Saved WIC card')], banner: null } };
  it('a parent never sees last run\'s cards or streamed cards while it checks, and the old run is not even fetched', async () => {
    (global as any).EventSource = FakeES;
    FakeES.last = null;
    const fetchMock = jest.fn(async (url: string) => (String(url).includes('/latest-run')
      ? { ok: true, status: 200, json: async () => saved }
      : { ok: true, status: 200, json: async () => ({ ...running, startedAt: new Date().toISOString() }) }));
    (global as any).fetch = fetchMock;
    const { hook } = memoryLocation({ path: '/feed/r2' });
    render(<Router hook={hook}><Route path="/feed/:runId" component={Feed} /></Router>);
    await waitFor(() => expect(FakeES.last).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('parent-steps')).toBeTruthy());
    act(() => {
      FakeES.last!.emit('agent_status', { type: 'agent_status', agent: 'recall', state: 'working', seq: 1 });
      FakeES.last!.emit('card_ready', { type: 'card_ready', seq: 2, card: mk('new-1', 'Brand new card') });
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(screen.queryByTestId('live-cards')).toBeNull();
    expect(screen.queryByText('Saved WIC card')).toBeNull();
    expect(screen.queryByText('Brand new card')).toBeNull();
    expect(screen.queryByText('Checking recalls…')).toBeNull(); // the family's own lines are on screen, so no second set of pills
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/latest-run'))).toBe(false);
    expect(document.body.innerHTML).not.toMatch(/owner-trace-id|real-?time/i); // owner fields never reach a parent's page
  });
});

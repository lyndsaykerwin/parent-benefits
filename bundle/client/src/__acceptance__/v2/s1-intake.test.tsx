// Story 1: 5-question intake, the honest checking screen and the insurance deadline timer
// (plans/v2-build-plan.md, section 1 rulings 1-3 and section 5).
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor, act, within } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import Onboarding from '@/pages/Onboarding';
import { fmtUsdShort } from '@/lib/bundle';
import { HOUSEHOLD, WORK, INSURANCE, FakeES, fakeServer, callsTo, mayaRun, mountFeed, showVersionB, goTab } from './helpers';

afterEach(() => {
  cleanup();
  jest.useRealTimers();
  try { sessionStorage.clear(); localStorage.clear(); } catch { /* ignore */ }
  delete (global as any).EventSource;
});

const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const Q4 = /Who[’']s raising this baby\?/i;
const Q5 = /Where do you get your health insurance\?/i;
const WORK_CHIPS = [/^Paycheck from a job/, /^Self-employed or freelance/, /^Not working right now/];
const row = (name: string) => screen.getByRole('group', { name });

/** Q4 may have a Next button, or move on by itself once every row is answered: accept either.
 *  `again` re-taps the last answer (for coming back to an already-answered Q4 with no Next button). */
function finishQ4(again?: () => void) {
  const next = screen.queryByRole('button', { name: /^(Next|Continue)$/ });
  if (next) fireEvent.click(next);
  else if (again && screen.queryByText(Q4)) again();
}

describe('S1a: onboarding asks 5 questions, with Q4 in two parts', () => {
  // S1 — "Q4 asks 'Who's raising this baby?' (Just me / Two of us). 'Just me' shows one row ('You'); 'Two of us' adds
  // 'Your partner'. Each row has 'Paycheck from a job', 'Self-employed or freelance' and 'Not working right now', with
  // everyday hints and no 'W-2'. Back keeps the answers, and the run request carries household, both work answers and insurance."
  it('shows the right parent rows, keeps answers on Back, and sends household + both work answers + insurance', async () => {
    const server = fakeServer([[/\/api\/run$/, () => ({ runId: 'r9' })]]);
    const loc = memoryLocation({ path: '/', record: true });
    render(<Router hook={loc.hook}><Onboarding /></Router>);

    expect(screen.getByText('1 of 5')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Baby’s here/ }));
    expect(screen.getByText('2 of 5')).toBeTruthy();
    const born = daysFromNow(-20);
    fireEvent.change(screen.getByLabelText('Birth date'), { target: { value: born } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('3 of 5')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('ZIP code'), { target: { value: '02139' } });
    fireEvent.click(screen.getByRole('button', { name: 'Looks right' }));

    // Q4 part 1: who's raising the baby
    expect(screen.getByText('4 of 5')).toBeTruthy();
    expect(screen.getByText(Q4)).toBeTruthy();
    expect(screen.getByText(/Something else \/ prefer not to say/)).toBeTruthy();
    expect(screen.getByText(/So we can check daycare tax savings/)).toBeTruthy();
    expect(server).not.toHaveBeenCalled(); // ZIP no longer submits: two questions to go

    // "Just me": one row, "You"
    fireEvent.click(screen.getByRole('button', { name: /^Just me/ }));
    expect(row('You')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Your partner' })).toBeNull();
    for (const chip of WORK_CHIPS) expect(within(row('You')).getByRole('button', { name: chip })).toBeTruthy();

    // "Two of us": a second row, "Your partner", with the same three choices
    fireEvent.click(screen.getByRole('button', { name: /^Two of us/ }));
    for (const chip of WORK_CHIPS) {
      expect(within(row('You')).getByRole('button', { name: chip })).toBeTruthy();
      expect(within(row('Your partner')).getByRole('button', { name: chip })).toBeTruthy();
    }
    // everyday hints explain job vs freelance; "W-2" never appears
    expect(screen.getAllByText(/taxes come out of your pay/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/you pay your own taxes/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/staying home, studying or between jobs/i).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/W-2/);

    fireEvent.click(within(row('You')).getByRole('button', { name: /^Paycheck from a job/ }));
    fireEvent.click(within(row('Your partner')).getByRole('button', { name: /^Self-employed or freelance/ }));
    finishQ4();

    // Q5: insurance
    expect(await screen.findByText(/5 of 5|Last one/)).toBeTruthy();
    expect(screen.getByText(Q5)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Through a job \(mine or my partner[’']s\)/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Health Connector \/ Healthcare\.gov/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^MassHealth/ })).toBeTruthy(); // MA ZIP: the state's own name first
    expect(screen.getByRole('button', { name: /TRICARE \(military\)/ })).toBeTruthy();
    expect(screen.getByText(/No insurance right now \/ not sure/)).toBeTruthy();
    expect(screen.getByText(/So we can give you the right deadline/)).toBeTruthy();

    // Back keeps answers: Q4 still shows "Two of us" and each parent's choice as chosen, and Q3 still has the ZIP
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText(Q4)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Two of us/ }).getAttribute('aria-pressed')).toBe('true');
    expect(within(row('You')).getByRole('button', { name: /^Paycheck from a job/ }).getAttribute('aria-pressed')).toBe('true');
    expect(within(row('Your partner')).getByRole('button', { name: /^Self-employed or freelance/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect((screen.getByLabelText('ZIP code') as HTMLInputElement).value).toBe('02139');
    fireEvent.click(screen.getByRole('button', { name: 'Looks right' }));
    expect(screen.getByText(Q4)).toBeTruthy();
    finishQ4(() => fireEvent.click(within(row('Your partner')).getByRole('button', { name: /^Self-employed or freelance/ })));

    // Last answer starts the run with all the answers
    fireEvent.click(await screen.findByRole('button', { name: /Health Connector \/ Healthcare\.gov/ }));
    await waitFor(() => expect(callsTo(server, /\/api\/run$/)).toHaveLength(1));
    expect(callsTo(server, /\/api\/run$/)[0].body).toEqual({
      zip: '02139', birthDate: born, household: HOUSEHOLD.two, parent1Work: WORK.paycheck, parent2Work: WORK.selfEmployed, insurance: INSURANCE.marketplace,
    });
    await waitFor(() => expect(loc.history?.at(-1)).toBe('/feed/r9'));
  });
});

/** The checking screen's lines that are on screen right now (not the "Getting started…" placeholder). */
const shownLines = () => {
  const box = screen.queryByTestId('parent-steps');
  return box ? within(box).queryAllByRole('listitem').filter((li) => !/Getting started/.test(li.textContent ?? '')) : [];
};
const tick = (ms: number) => act(async () => { jest.advanceTimersByTime(ms); });

describe('S1b: the checking screen is honest and unhurried', () => {
  // S1 — "For a two-parent home where one parent is 'Not working right now', the checking screen has NO Dependent Care FSA
  // (or daycare tax savings) line. Lines appear one at a time and stay on screen. Only after the last line does
  // 'We found $X for your family. View my results' appear, and nothing moves on by itself: results show only after the tap."
  it('two parents, one not working: no Dependent Care FSA line, lines appear one by one, results wait for "View my results"', async () => {
    jest.useFakeTimers();
    const base = mayaRun();
    const family = { ...base.family, household: HOUSEHOLD.two, parent1Work: WORK.paycheck, parent2Work: WORK.notWorking, insurance: INSURANCE.job };
    const total = base.result.receipt.moneyBackCents + base.result.receipt.likelyBenefitsCents;
    mountFeed(base.runId, {
      runId: base.runId, familyId: 'maya', status: 'done', startedAt: new Date().toISOString(), family, today: base.today,
      demoDate: true, result: base.result, error: null, progress: [], owner: false,
    });
    await tick(0);
    expect(FakeES.last).toBeTruthy();
    // The run's agents report in and the stream ends at once: the server is fast, the screen should not be.
    act(() => {
      for (const [seq, agent] of ['benefits', 'court', 'fact_checker'].entries()) {
        FakeES.last!.emit('agent_status', { type: 'agent_status', agent, state: 'done', seq: seq + 1 });
      }
      FakeES.last!.emit('end', {});
    });

    // Wait (in small steps) for the first line, then check it is alone
    for (let i = 0; i < 30 && shownLines().length === 0; i++) await tick(100);
    expect(shownLines()).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /View my results/ })).toBeNull();

    // About 1.2–1.5 seconds later, the second line joins it (the first stays)
    await tick(1500);
    expect(shownLines()).toHaveLength(2);

    // Let every timer run: all lines are there, the reveal card waits, and nothing moved on by itself
    await tick(60_000);
    const steps = screen.getByTestId('parent-steps');
    expect(within(steps).getByText(/State and federal family benefits/)).toBeTruthy();
    expect(within(steps).getByText(/Insurance deadline to add your baby/)).toBeTruthy();
    expect(within(steps).getByText(/Free registry gifts and welcome boxes/)).toBeTruthy();
    expect(within(steps).getByText(/Every result double-checked against its official source/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Dependent Care FSA/);
    expect(document.body.textContent).not.toMatch(/Daycare tax savings/i);
    const reveal = screen.getByRole('button', { name: /View my results/ });
    expect(screen.getByText(new RegExp(`We found \\${fmtUsdShort(total)} for your family`))).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();

    fireEvent.click(reveal);
    await tick(0);
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
  });
});

describe('S1c: the insurance countdown pill follows the insurance answer', () => {
  // S1 — "On the Insurance tab, a family whose insurance is through a job sees the '30 days from birth to add baby' pill
  // with 'Check your plan' (not one 30-day rule for everyone)."
  it('job-based insurance shows "30 days from birth to add baby" and "Check your plan"', () => {
    showVersionB(mayaRun({ family: { insurance: INSURANCE.job } }));
    goTab('Insurance');
    const card = screen.getByRole('article', { name: /Add your baby to health insurance/ });
    expect(within(card).getByText(/30 days from birth to add baby/)).toBeTruthy();
    expect(within(card).getByText(/Check your plan/)).toBeTruthy();
  });
});

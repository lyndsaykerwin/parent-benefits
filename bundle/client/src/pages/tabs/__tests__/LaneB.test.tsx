// Lane B (Stories 3 and 4) beyond the acceptance tests: the money numbers, the Taxes booster, the childcare card, the detail page.
import React from 'react';
import { render, screen, cleanup, fireEvent, within, waitFor, act } from '@testing-library/react';
import { Router, Route } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import VersionB from '../VersionB';
import CardDetail from '../../CardDetail';
import { sampleRun } from '../../../test-support/sampleRuns';
import { moneyNumbers, isQuickWin } from '@/lib/tabs';
import { applyDaycareAnswer, CHILDCARE_CREDIT_ID } from '@/lib/daycare';
import { saveRun } from '@/lib/bundle';

beforeAll(() => { window.scrollTo = jest.fn() as unknown as typeof window.scrollTo; });
afterEach(() => { cleanup(); jest.useRealTimers(); try { sessionStorage.clear(); localStorage.clear(); } catch { /* ignore */ } });

const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: new RegExp(`^${name}`) });
function show(id: Parameters<typeof sampleRun>[0], family: Record<string, unknown> = {}) {
  const run = sampleRun(id, { withState: true });
  run.family = { ...run.family!, ...family } as typeof run.family;
  const { hook } = memoryLocation({ path: `/feed/${run.runId}` });
  render(<Router hook={hook}><VersionB run={run} owner={false} /></Router>);
  return run;
}
const dollars = (el: HTMLElement) => Number(el.textContent!.match(/\$([\d,]+(?:\.\d\d)?)/)![1].replace(/,/g, ''));

describe('the three money numbers', () => {
  const { result } = sampleRun('maya');
  const total = result.receipt.moneyBackCents + result.receipt.likelyBenefitsCents;
  it('start as everything still to claim', () => {
    expect(moneyNumbers(result, {}, {})).toEqual({ found: total, claimed: 0, still: total, dismissed: 0 });
  });
  it('"I got this" moves money from still to claimed and leaves the headline alone', () => {
    const n = moneyNumbers(result, { 'benefit-trump_account': true }, {});
    expect(n).toMatchObject({ found: total, claimed: 100000, still: total - 100000 });
  });
  it('"Not relevant" lowers the headline and still, never adds to claimed', () => {
    const n = moneyNumbers(result, {}, { 'benefit-ma_child_tax_credit': true });
    expect(n).toMatchObject({ found: total - 44000, claimed: 0, still: total - 44000, dismissed: 44000 });
  });
  it('a card cannot count twice: dismissed wins over claimed in the sums', () => {
    const n = moneyNumbers(result, { 'benefit-trump_account': true }, { 'benefit-trump_account': true });
    expect(n.claimed).toBe(0);
    expect(n.found).toBe(total - 100000);
  });
  it('a card with no estimate is never a quick win', () => {
    expect(isQuickWin({ ...result.cards[0], id: 'benefit-unknown', kind: 'benefit', minutes: undefined })).toBe(false);
  });
});

describe('Home after "Not relevant"', () => {
  it('shows the instant Undo bar for a few seconds, then it goes away; the card stays in the Dismissed drawer', () => {
    jest.useFakeTimers();
    show('maya');
    fireEvent.click(tab('Taxes'));
    fireEvent.click(within(screen.getByRole('article', { name: /Massachusetts Child and Family Tax Credit/ })).getByRole('button', { name: 'Not relevant' }));
    const bar = screen.getByTestId('undo-bar');
    expect(bar.textContent).toMatch(/Dismissed\. \$440 taken off Still to claim\./);
    act(() => { jest.advanceTimersByTime(7000); });
    expect(screen.queryByTestId('undo-bar')).toBeNull();
    expect(screen.getByRole('button', { name: /^Dismissed \(1\)/ })).toBeTruthy();
  });

  it('the dismissed card leaves the tax bucket and the Taxes header total, and the answer is remembered after a reload', () => {
    const run = show('maya');
    fireEvent.click(tab('Taxes'));
    fireEvent.click(within(screen.getByRole('article', { name: /Massachusetts Child and Family Tax Credit/ })).getByRole('button', { name: 'Not relevant' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('$2,200 off your taxes'); // was $2,640 with the MA credit
    fireEvent.click(tab('Home'));
    const tax = screen.getByRole('region', { name: 'At tax time' });
    expect(within(tax).queryByText('MA child credit')).toBeNull();
    expect(within(tax).getByText('$2,200')).toBeTruthy(); // only the federal credit is left (the Trump Account has its own savings box since Oct 26)
    expect(within(screen.getByTestId('bucket-baby-savings')).getByText('$1,000')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(`bundle:dismissed:${run.familyId}`)!)).toEqual({ 'benefit-ma_child_tax_credit': true });
    cleanup();
    show('maya');
    expect(dollars(screen.getByTestId('home-total-amount'))).toBe(run.result.receipt.moneyBackCents / 100 + 3200);
  });

  it('a "Not relevant" card is out of "Do these next" too, and Quick wins shows only what is under 5 minutes', () => {
    show('maya');
    fireEvent.click(screen.getByRole('button', { name: /Quick wins/i }));
    const list = screen.getByRole('region', { name: 'Quick wins' });
    expect(within(list).getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['Federal Child Tax Credit', 'Massachusetts Child and Family Tax Credit']);
    fireEvent.click(within(within(list).getByRole('article', { name: /Massachusetts/ })).getByRole('button', { name: 'Not relevant' }));
    expect(within(screen.getByRole('region', { name: 'Quick wins' })).getAllByRole('article')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByRole('region', { name: 'Do these next' })).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Do these next' })).getByRole('article', { name: /Add your baby to health insurance/ })).toBeTruthy();
  });
});

describe('Home buckets', () => {
  it('Money back now lists each refund and adds a Total when there are two or more', () => {
    show('maya');
    const now = screen.getByRole('region', { name: 'Money back now' });
    expect(within(now).getByText('$28.99')).toBeTruthy();
    expect(within(now).getByText('$20')).toBeTruthy();
    expect(within(now).getByText('$48.99')).toBeTruthy();
  });
  it('a family in a state without paid leave on file has no leave bucket (no invented numbers)', () => {
    show('ava');
    expect(screen.queryByRole('region', { name: 'Paid family leave' })).toBeNull();
  });
  it('an older saved run without category and minutes still lands in the right buckets', () => {
    const run = sampleRun('maya', { withState: true });
    run.result = { ...run.result, cards: run.result.cards.map(({ category: _c, minutes: _m, ...rest }) => rest) };
    const { hook } = memoryLocation({ path: `/feed/${run.runId}` });
    render(<Router hook={hook}><VersionB run={run} owner={false} /></Router>);
    expect(within(screen.getByRole('region', { name: 'At tax time' })).getByText('$2,640')).toBeTruthy(); // credits only
    expect(within(screen.getByTestId('bucket-baby-savings')).getByText('$1,000')).toBeTruthy(); // the Trump Account, even with no category stamp
    fireEvent.click(screen.getByRole('button', { name: /Quick wins/i }));
    expect(within(screen.getByRole('region', { name: 'Quick wins' })).getAllByRole('article')).toHaveLength(2);
  });
});

describe('Taxes: filing-status booster', () => {
  it('leads with the money as a range built from the family\'s own cards, then one tap makes it exact', () => {
    show('maya');
    fireEvent.click(tab('Taxes'));
    const booster = screen.getByTestId('booster-taxes');
    expect(booster.textContent).toContain('$2,200–$2,640'); // federal credit alone .. federal + MA credit
    expect(booster.textContent).toContain('One tap makes it exact');
    expect(booster.textContent).toContain('Head of household = single parent who pays most home costs.');
    fireEvent.click(within(booster).getByRole('button', { name: 'Married filing together' }));
    const done = screen.getByTestId('booster-taxes-result');
    expect(done.textContent).toMatch(/Now exact for “Married filing together”: Federal Child Tax Credit \$2,200 \+ Massachusetts Child and Family Tax Credit \$440/);
    expect(within(done).getByRole('button', { name: /Send these to your partner or tax preparer/ })).toBeTruthy();
    fireEvent.click(tab('Savings')); // the 529 line lives on Savings since Oct 26, and agrees with this answer
    expect(screen.getByTestId('card-529').textContent).toContain('$2,000 (filing together)');
  });

  it('shows the MA 529 line (on Savings) as a range until the family answers, and $1,000 for single', () => {
    show('maya');
    fireEvent.click(tab('Savings'));
    expect(screen.getByTestId('card-529').textContent).toContain('$1,000 single / $2,000 together');
    fireEvent.click(tab('Taxes'));
    fireEvent.click(screen.getByRole('button', { name: 'Single' }));
    fireEvent.click(tab('Savings'));
    expect(screen.getByTestId('card-529').textContent).toContain('$1,000 (filing single)');
  });

  it('"Not sure" keeps the range; "Not now" shrinks to a chip that brings the card back', () => {
    show('maya');
    fireEvent.click(tab('Taxes'));
    fireEvent.click(screen.getByRole('button', { name: 'Not sure' }));
    expect(screen.getByTestId('booster-taxes-result').textContent).toContain('$2,200–$2,640');
    fireEvent.click(screen.getByRole('button', { name: 'Change my answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByTestId('booster-taxes')).toBeNull();
    fireEvent.click(screen.getByTestId('booster-taxes-chip'));
    expect(screen.getByTestId('booster-taxes')).toBeTruthy();
  });

  it('remembers the answer in this browser', () => {
    show('maya');
    fireEvent.click(tab('Taxes'));
    fireEvent.click(screen.getByRole('button', { name: 'Head of household' }));
    cleanup();
    show('maya');
    fireEvent.click(tab('Taxes'));
    expect(screen.getByTestId('booster-taxes-result').textContent).toContain('Head of household');
  });

  it('has no booster, and no 529 line, for a family with no state credit (Ohio)', () => {
    show('ava');
    fireEvent.click(tab('Taxes'));
    expect(screen.queryByTestId('booster-taxes')).toBeNull();
    fireEvent.click(tab('Savings'));
    expect(screen.queryByTestId('card-529')).toBeNull();
  });

  it('shows the paycheck-form (W-4) tip when someone is paid through a job, not for a self-employed couple', () => {
    show('maya', { household: 'two', parent1Work: 'paycheck', parent2Work: 'paycheck' });
    fireEvent.click(tab('Taxes'));
    expect(screen.getByTestId('card-w4').textContent).toContain('Update your paycheck tax form (W-4)');
    cleanup();
    show('maya', { household: 'two', parent1Work: 'self_employed', parent2Work: 'self_employed' });
    fireEvent.click(tab('Taxes'));
    expect(screen.queryByTestId('card-w4')).toBeNull();
  });
});

describe('Childcare tax credit card (self-employed families)', () => {
  const cards = sampleRun('maya').result.cards;
  it('replaces the "check with your job" slot for a self-employed family, carries no amount, and is never claimable or counted', () => {
    const out = applyDaycareAnswer(cards, { household: 'one', parent1Work: 'self_employed' } as any);
    const c = out.find((x) => x.id === CHILDCARE_CREDIT_ID)!;
    expect(c.title).toBe('Childcare tax credit');
    expect(c.amountCents).toBeNull();
    expect(c.verdict).toBe('info');
    expect(out.some((x) => x.id === 'benefit-dcfsa_life_event')).toBe(false);
    expect(out.indexOf(c)).toBe(cards.findIndex((x) => x.id === 'benefit-dcfsa_life_event'));
  });
  it('does nothing for a paycheck family, and never adds it twice', () => {
    expect(applyDaycareAnswer(cards, { household: 'one', parent1Work: 'paycheck' } as any)).toBe(cards);
    const once = applyDaycareAnswer(cards, { household: 'one', parent1Work: 'self_employed' } as any);
    expect(applyDaycareAnswer(once, { household: 'one', parent1Work: 'self_employed' } as any)).toBe(once);
  });
  it('shows on the Taxes tab with "Ask your tax preparer" and no buttons', () => {
    show('maya', { household: 'one', parent1Work: 'self_employed' });
    fireEvent.click(tab('Taxes'));
    const c = screen.getByRole('article', { name: 'Childcare tax credit' });
    expect(within(c).getByText('Ask your tax preparer')).toBeTruthy();
    expect(within(c).queryByRole('button', { name: 'I got this' })).toBeNull();
  });
});

describe('card detail page uses the same two buttons', () => {
  function openDetail(cardId: string) {
    const run = sampleRun('maya');
    saveRun(run);
    const fetchMock = jest.fn(async () => new Response('{"ok":true,"proposals":[]}', { status: 200 }));
    (global as any).fetch = fetchMock;
    const { hook } = memoryLocation({ path: `/card/${cardId}?run=${run.runId}` });
    render(<Router hook={hook}><Route path="/card/:id" component={CardDetail} /></Router>);
    return { run, fetchMock };
  }
  it('"Not relevant" on the detail page is saved as the same answer the cards use, with an Undo', async () => {
    const { run, fetchMock } = openDetail('benefit-ma_child_tax_credit');
    fireEvent.click(await screen.findByRole('button', { name: 'Not relevant' }));
    expect(screen.getByText(/Dismissed\. \$440 taken off Still to claim\./)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(`bundle:dismissed:${run.familyId}`)!)).toEqual({ 'benefit-ma_child_tax_credit': true });
    await waitFor(() => expect(JSON.parse(String((fetchMock.mock.calls as any[]).find(([u]) => u === '/api/feedback')![1].body))).toMatchObject({ kind: 'not_relevant', cardId: 'benefit-ma_child_tax_credit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(localStorage.getItem(`bundle:dismissed:${run.familyId}`)).toBe('{}');
    expect(screen.getByRole('button', { name: 'I got this' })).toBeTruthy();
  });
  it('"I got this" there lands in the same Claimed list as the card button', async () => {
    const { run } = openDetail('benefit-trump_account');
    fireEvent.click(await screen.findByRole('button', { name: 'I got this' }));
    expect(JSON.parse(localStorage.getItem(`bundle:claimed:${run.familyId}`)!)).toEqual({ 'benefit-trump_account': true });
    expect(screen.getByText(/moved this one to Claimed/)).toBeTruthy();
  });
  it('a safety recall has no I got this / Not relevant, only Report issue', async () => {
    openDetail('recall-cpsc-10560');
    await screen.findByRole('button', { name: 'Report issue' });
    expect(screen.queryByRole('button', { name: 'I got this' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Not relevant' })).toBeNull();
  });
});

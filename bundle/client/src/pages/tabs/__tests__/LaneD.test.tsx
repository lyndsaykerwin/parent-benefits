// Lane D (Story 5) behaviour beyond the acceptance tests: practice-mode status, report card, thank-you count, card lines, ordering.
import { screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';
import { fakeServer, callsTo, mayaRun, showVersionB, goTab } from '../../../__acceptance__/v2/helpers';
import { ageLine, courtLine, minutesLine, onlyNew, orderDeals, valueLine } from '@/lib/offers';
import type { FeedCard, OfferFacts } from '@shared/bundle';

afterEach(() => { cleanup(); try { sessionStorage.clear(); localStorage.clear(); } catch { /* ignore */ } });

const facts = (over: Partial<OfferFacts> = {}): OfferFacts => ({
  court: 'approve', catches: [], subscriptionTraps: 0, hiddenFeeCents: 0, ruleCheckOnly: false, trueValueCents: 3500, minutes: 10,
  ageDays: 20, minAgeDays: 0, maxAgeDays: 365, ...over,
});
const card = (id: string, over: Partial<FeedCard> = {}): FeedCard => ({ id, kind: 'discount', title: id, body: '', amountCents: null, deadline: null, verdict: 'likely', sources: [{ label: 's', url: `https://x.test/${id}` }], traceId: '', ...over });

describe('the lines on an offer card (R5)', () => {
  it('says approved, catch and blocked in the court\'s own words', () => {
    expect(courtLine(facts()).text).toBe('Fine Print Court: Approved (0 subscription traps, $0 hidden fees)');
    expect(courtLine(facts({ subscriptionTraps: 1, hiddenFeeCents: 599 })).text).toBe('Fine Print Court: Approved (1 subscription trap, $5.99 hidden fees)');
    expect(courtLine(facts({ court: 'approve_with_catch', catches: ['signs you up for a paid trial'] })).text).toBe('Fine Print Court: Approved with a catch: signs you up for a paid trial');
    expect(courtLine(facts({ court: 'reject', catches: ['a paid membership is required'] })).text).toBe('Fine Print Court: Blocked: a paid membership is required');
    expect(courtLine(facts({ ruleCheckOnly: true })).note).toMatch(/rule check only/i);
    expect(minutesLine(facts()).text).toBe('About 10 minutes');
    expect(valueLine(facts()).text).toBe('True value $35');
    expect(valueLine(facts({ trueValueCents: null })).text).toMatch(/not stated/);
  });

  it('says the baby\'s exact age and the months the offer fits', () => {
    expect(ageLine(facts())).toBe('Your baby is 20 days old. This offer is for babies 0–12 months.');
    expect(ageLine(facts({ ageDays: 1, minAgeDays: -280, maxAgeDays: 182 }))).toBe('Your baby is 1 day old. This offer is for babies 0–6 months.');
    expect(ageLine(facts({ ageDays: -44 }))).toBe('Your baby is due in 44 days. This offer is for babies 0–12 months.');
    expect(ageLine(facts({ ageDays: null }))).toBeNull();
  });

  it('orders by what the offer is worth to the parent (never by commission) and hides finds that are already saved', () => {
    const a = card('a', { offerFacts: facts({ trueValueCents: 900 }) });
    const b = card('b', { offerFacts: facts({ trueValueCents: 4000 }) });
    const c = card('c', { offerFacts: facts({ trueValueCents: null }) });
    expect(orderDeals([a, c, b]).map((x) => x.id)).toEqual(['b', 'a', 'c']);
    expect(onlyNew([card('a2', { sources: [{ label: 's', url: 'https://www.x.test/a/' }] }), card('n', { title: 'Brand new' })], [a]).map((x) => x.id)).toEqual(['n']);
    expect(onlyNew([card('dup', { sources: [{ label: 's', url: 'http://x.test/a?utm=1' }] })], [a])).toEqual([]);
  });
});

describe('Deals screen', () => {
  it('practice mode: the server says "practice" and the line stays "Checking N saved offers…" with the real count and day', async () => {
    fakeServer([[/offer-search/, () => ({ mode: 'practice' })]]);
    const run = mayaRun();
    showVersionB({ ...run, result: { ...run.result, offersOnFile: 16 } });
    goTab('Deals');
    expect(await screen.findByText(/Checking 16 saved offers against your baby[’']s age \(Day 20\)/)).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(/Searching 14 trusted/)).toBeNull());
    expect(screen.queryByText(/No new offers right now/)).toBeNull();
  });

  it('the report card counts offers from parents and labels them "from a parent"', async () => {
    fakeServer([
      [/offer-search/, () => ({ mode: 'practice' })],
      [/report-card/, () => ({ status: 'found', fromParents: 1, brands: [
        { store: 'Made-up Store', offersChecked: 4, offersCaught: 1, fromParents: 0 },
        { store: 'Bitsy Box', offersChecked: 1, offersCaught: 0, fromParents: 1 },
      ] })],
    ]);
    showVersionB(mayaRun());
    goTab('Deals');
    const report = await screen.findByRole('region', { name: 'Offer report card' });
    expect(within(report).getByText(/We’ve graded 5 offers \(1 from a parent\)\. 1 had a catch\./)).toBeTruthy();
    const row = within(report).getByText('Bitsy Box').closest('li')!;
    expect(within(row as HTMLElement).getByText('from a parent')).toBeTruthy();
    expect(within(report).getAllByText('from a parent')).toHaveLength(1);
  });

  it('a saved audit says "Added to the shared list" and thanks the parent with the real count', async () => {
    const server = fakeServer([[/offers\/audit/, () => ({ verdict: 'approve', summary: 'No catches.', mode: 'full', saved: true, sharedFromParents: 3 })]]);
    showVersionB(mayaRun());
    goTab('Deals');
    fireEvent.click(screen.getByRole('button', { name: /Audit a deal/i }));
    fireEvent.change(screen.getByLabelText(/Who[’']s offering it\?/), { target: { value: 'Bitsy Box' } });
    fireEvent.change(screen.getByLabelText(/What do you get\?/), { target: { value: 'A free baby box' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Fine print/ }), { target: { value: 'Free box. No purchase needed.' } });
    fireEvent.click(screen.getByRole('button', { name: /Check this deal/i }));
    expect(await screen.findByText(/Added to the shared list/)).toBeTruthy();
    expect(screen.getByText(/You’re helping other parents: 3 offers on the shared list came from parents\./)).toBeTruthy();
    expect(callsTo(server, /offers\/audit/)[0].body).toEqual({ store: 'Bitsy Box', offer: 'A free baby box', text: 'Free box. No purchase needed.' });
  });

  it('an unsaved audit says it is shown to this parent only, and a problem is said in plain words', async () => {
    fakeServer([[/offers\/audit/, () => ({ verdict: 'reject', summary: 'Hidden paid plan.', mode: 'quick', saved: false })]]);
    showVersionB(mayaRun());
    goTab('Deals');
    fireEvent.click(screen.getByRole('button', { name: /Audit a deal/i }));
    fireEvent.change(screen.getByLabelText(/Who[’']s offering it\?/), { target: { value: 'Bitsy Box' } });
    fireEvent.change(screen.getByLabelText(/What do you get\?/), { target: { value: 'A free baby box' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Fine print/ }), { target: { value: 'Anything at all here.' } });
    fireEvent.click(screen.getByRole('button', { name: /Check this deal/i }));
    expect(await screen.findByText('Blocked')).toBeTruthy();
    expect(screen.getByText(/Shown to you only; not added to the shared list\./)).toBeTruthy();
    expect(screen.queryByText(/helping other parents/)).toBeNull();
  });

  it('the saved cards keep their claim buttons (Lane B) next to the new lines', async () => {
    fakeServer([[/offer-search/, () => ({ mode: 'practice' })]]);
    showVersionB(mayaRun());
    goTab('Deals');
    const diaper = screen.getByRole('article', { name: /Free newborn diaper box/ });
    expect(within(diaper).getByRole('button', { name: /I got this/ })).toBeTruthy();
    expect(within(diaper).getByRole('button', { name: /Not relevant/ })).toBeTruthy();
    expect(within(diaper).getByText(/True value \$40/)).toBeTruthy();
    expect(within(diaper).getByText(/Rule check only/)).toBeTruthy();
  });
});

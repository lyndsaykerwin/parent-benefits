// Story 5: Deals, live offer search and "Audit a deal" (plans/v2-build-plan.md, section 1 rulings 4 and 10, round 3 R2/R3/R5, section 4 lane D, section 5).
import { screen, cleanup, fireEvent, within, waitFor, act } from '@testing-library/react';
import { fakeServer, callsTo, mayaRun, showVersionB, goTab } from './helpers';

// A screenshot goes through the same photo reader as the gear scan; the test browser has no canvas, so replace only that step.
jest.mock('@/lib/photoPrep', () => ({
  ...jest.requireActual('@/lib/photoPrep'),
  preparePhoto: jest.fn(async () => ({ mimeType: 'image/jpeg', imageBase64: 'QUJD' })),
}));

afterEach(() => { cleanup(); try { sessionStorage.clear(); localStorage.clear(); } catch { /* ignore */ } });

/** A switch control drawn as a tab or a button. */
const choice = (name: RegExp) => screen.queryByRole('tab', { name }) ?? screen.getByRole('button', { name });

describe('S5: Deals says what is really being checked, with the exact age', () => {
  // S5 — "In practice mode Deals shows a true status line, 'Checking N saved offers against your baby's age (Day 20)'
  // (no fake 'Scanning…'), and each offer's age line reads 'Your baby is 20 days old. This offer is for babies 0–12 months.'
  // instead of 'Fits babies up to 12 months old.'"
  it('shows the saved-offers status line and the exact-age line on offers', () => {
    fakeServer([]); // practice mode: no live search reply (every request gets "not found")
    showVersionB(mayaRun());
    goTab('Deals');
    expect(screen.getByText(/Checking \d+ saved offers against your baby[’']s age \(Day 20\)/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Scanning/i);
    const diaper = screen.getByRole('article', { name: /Free newborn diaper box/ });
    expect(within(diaper).getByText(/Your baby is 20 days old\. This offer is for babies 0[–-]12 months\./)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Fits babies up to/);
  });

  // S5 (R5) — "Offer cards show the fine-print court's real findings instead of filler: 'Fine Print Court: Approved',
  // 'About N minutes' of effort and 'True value $X'. The sentence 'Likely a good deal' never appears."
  it('an offer card shows "Fine print: OK", "About N minutes" and "True value $", never "Likely a good deal" (Oct 26: "Fine Print Court" renamed)', () => {
    fakeServer([]); // practice mode
    showVersionB(mayaRun());
    goTab('Deals');
    const offers = screen.getAllByRole('article');
    const approved = offers.filter((a) => /Fine print: OK/.test(a.textContent ?? ''));
    expect(approved.length).toBeGreaterThan(0);
    const card = approved[0];
    expect(within(card).getByText(/Fine print: OK/)).toBeTruthy();
    expect(within(card).getByText(/About \d+ minutes/)).toBeTruthy();
    expect(within(card).getByText(/True value \$/)).toBeTruthy();
    expect(screen.queryByText(/Likely a good deal/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/Likely a good deal/);
  });
});

describe('S5: Audit a deal asks for specifics', () => {
  // S5 — "'Audit a deal' is a short form: 'Who's offering it?', 'What do you get?', 'Link (optional)', and the fine print,
  // either by 'Paste the text' or 'Add a screenshot'. 'Check this deal' sends {store, offer, link, text} to the server,
  // and the verdict names the store the parent typed."
  it('sends store, offer, link and pasted text, and the verdict names the store', async () => {
    const pasted = 'Free baby box! Just pay $5.99 shipping. Membership auto-renews at $29.99/month after 30 days.';
    // The fake reply does not repeat the store name: the screen must name it from what the parent typed.
    const server = fakeServer([[/audit/i, () => ({ verdict: 'approve_with_catch', summary: 'Auto-renews at $29.99 a month after 30 days.', mode: 'quick' })]]);
    showVersionB(mayaRun());
    goTab('Deals');
    fireEvent.click(screen.getByRole('button', { name: /Audit a deal/i }));

    fireEvent.change(screen.getByLabelText(/Who[’']s offering it\?/), { target: { value: 'Bitsy Box' } });
    fireEvent.change(screen.getByLabelText(/What do you get\?/), { target: { value: 'A free baby box' } });
    fireEvent.change(screen.getByLabelText(/Link \(optional\)/), { target: { value: 'https://example.com/bitsy-box' } });

    // Screenshot option: a file picker
    fireEvent.click(choice(/Add a screenshot/i));
    expect(screen.getByLabelText(/screenshot/i, { selector: 'input[type="file"]' })).toBeTruthy();

    // Paste option: a text box for the fine print
    fireEvent.click(choice(/Paste the text/i));
    fireEvent.change(screen.getByRole('textbox', { name: /Fine print|Paste the (text|offer)/i }), { target: { value: pasted } });
    fireEvent.click(screen.getByRole('button', { name: /Check this deal/i }));

    await waitFor(() => expect(callsTo(server, /audit/i)).toHaveLength(1));
    const call = callsTo(server, /audit/i)[0];
    expect(call.method).toBe('POST');
    expect(call.body).toEqual(expect.objectContaining({ store: 'Bitsy Box', offer: 'A free baby box', link: 'https://example.com/bitsy-box', text: pasted }));
    expect(call.body.imageBase64).toBeUndefined();

    const verdict = await screen.findByText(/OK, with a catch/i);
    const verdictBox = verdict.closest('section, article, [role="status"], [aria-live]') ?? document.body;
    expect(verdictBox.textContent).toMatch(/Bitsy Box/);
    expect(screen.getByText(/Auto-renews at \$29\.99 a month after 30 days\./)).toBeTruthy();
    expect(screen.getByText(/Quick check\. The full AI review runs in live mode/)).toBeTruthy();
  });
});

describe('S5: a confident audit is added to the shared list', () => {
  // S5 (R2) — "When the full AI court is confident (both sides agree, no hidden instructions), the audited offer is saved
  // for other parents and the screen says so: 'Added to the shared list'. (The server marks it source 'user_audit'.)"
  it('a confident reply ({mode: "full", saved: true}) shows "Added to the shared list"', async () => {
    const server = fakeServer([[/audit/i, () => ({ verdict: 'approve', summary: 'No subscription and no shipping fee.', mode: 'full', saved: true })]]);
    showVersionB(mayaRun());
    goTab('Deals');
    fireEvent.click(screen.getByRole('button', { name: /Audit a deal/i }));
    fireEvent.change(screen.getByLabelText(/Who[’']s offering it\?/), { target: { value: 'Bitsy Box' } });
    fireEvent.change(screen.getByLabelText(/What do you get\?/), { target: { value: 'A free baby box' } });
    fireEvent.click(choice(/Paste the text/i));
    fireEvent.change(screen.getByRole('textbox', { name: /Fine print|Paste the (text|offer)/i }), { target: { value: 'Free baby box. No purchase needed. Free shipping.' } });
    fireEvent.click(screen.getByRole('button', { name: /Check this deal/i }));

    await waitFor(() => expect(callsTo(server, /audit/i)).toHaveLength(1));
    const call = callsTo(server, /audit/i)[0];
    expect(call.method).toBe('POST');
    expect(call.body).toEqual(expect.objectContaining({ store: 'Bitsy Box', offer: 'A free baby box' }));
    expect(await screen.findByText(/Added to the shared list/i)).toBeTruthy();
    expect(screen.queryByText(/not added to the shared list/i)).toBeNull();
  });
});

describe('S5: live offer search', () => {
  /** A request that stays unanswered until the test answers it (or fails it). */
  function deferred() {
    let resolve!: (v: unknown) => void; let reject!: (e: unknown) => void;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  }
  /** Fake server where the live offer search answers only when the test says so; everything else is "not found". */
  function serverWithPendingSearch() {
    const search = deferred();
    const mock = jest.fn((url: string) => {
      if (/offer-search/i.test(String(url))) {
        return search.promise.then((body) => ({ ok: true, status: 200, json: async () => body }));
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({ error: 'not found' }) });
    });
    (global as any).fetch = mock;
    return { mock, search };
  }
  const SAVED_OFFER = /Free newborn diaper box/; // a saved, already-graded offer from Maya's sample run
  /** No spinner or status line is left saying "Searching". */
  const nothingStillSearching = () => {
    for (const el of [...screen.queryAllByRole('progressbar'), ...screen.queryAllByRole('status')]) expect(el.textContent ?? '').not.toMatch(/Searching/i);
    expect(screen.queryByText(/Searching 14 trusted baby-offer sites/)).toBeNull();
  };

  const live = {
    id: 'live-huggies-1', kind: 'discount', title: 'Free Huggies newborn sample pack', body: 'Free sample pack of newborn diapers and wipes. No purchase needed.',
    amountCents: 2500, deadline: null, verdict: 'verified', sources: [{ label: 'Huggies', url: 'https://www.huggies.com/en-us/offers' }], traceId: 't-live-1',
    foundOn: '2026-10-25', isNew: true,
    valueScore: { trueValueCents: 2500, effortLevel: 'low', effortMinutesEstimate: { min: 3, max: 5 }, stepsCount: 2, payoutWaitDays: null, timeLabel: 'right away', catchTypes: [], worthYourTime: true, reasons: ['Free, no purchase needed'] },
  };

  afterEach(() => { jest.useRealTimers(); });

  // S5 (R3) — "Opening Deals shows the saved, already-graded offers at once, while the live search of the trusted
  // baby-offer sites runs in the background ('Searching 14 trusted baby-offer sites…'). When it answers, new offers
  // slide in with 'New · found today' and their grade (the Value Score from the fine-print court)."
  it('saved offers show before the search answers; new offers then show "New · found today" and a grade', async () => {
    const { mock, search } = serverWithPendingSearch();
    showVersionB(mayaRun());
    goTab('Deals');

    await waitFor(() => expect(mock.mock.calls.filter(([u]) => /offer-search/i.test(String(u))).length).toBeGreaterThan(0));
    // the search has not answered yet: saved offers are already on screen
    expect(screen.getByRole('article', { name: SAVED_OFFER })).toBeTruthy();
    expect(screen.getByText(/Searching 14 trusted baby-offer sites/)).toBeTruthy();
    expect(screen.queryByRole('article', { name: /Free Huggies newborn sample pack/ })).toBeNull();

    await act(async () => { search.resolve({ mode: 'live', sitesSearched: 14, searchedOn: '2026-10-25', cards: [live] }); });
    const card = await screen.findByRole('article', { name: /Free Huggies newborn sample pack/ });
    expect(within(card).getByText(/New\s*·\s*found today/)).toBeTruthy();
    expect(within(card).getByText(/True value \$25/)).toBeTruthy();
    expect(screen.getByRole('article', { name: SAVED_OFFER })).toBeTruthy();
  });

  // S5 (R3) — "If the live search fails (error or no internet), the line changes to 'No new offers right now. Showing your
  // checked offers.' The saved offers stay, no spinner is left running and no error appears."
  it('a failed search shows "No new offers right now", keeps the saved offers and leaves nothing "Searching"', async () => {
    const { mock, search } = serverWithPendingSearch();
    showVersionB(mayaRun());
    goTab('Deals');
    await waitFor(() => expect(mock.mock.calls.filter(([u]) => /offer-search/i.test(String(u))).length).toBeGreaterThan(0));

    await act(async () => { search.reject(new TypeError('Failed to fetch')); });
    expect(await screen.findByText(/No new offers right now/)).toBeTruthy();
    expect(screen.getByRole('article', { name: SAVED_OFFER })).toBeTruthy();
    nothingStillSearching();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // S5 (R3) — "The live search gives up after 10 seconds and quietly keeps the saved offers, with the same
  // 'No new offers right now' line."
  it('a search that never answers gives up after 10 seconds with "No new offers right now"', async () => {
    jest.useFakeTimers();
    const { mock } = serverWithPendingSearch(); // never answered
    showVersionB(mayaRun());
    goTab('Deals');
    await act(async () => { await Promise.resolve(); });
    expect(mock.mock.calls.filter(([u]) => /offer-search/i.test(String(u))).length).toBeGreaterThan(0);
    expect(screen.getByRole('article', { name: SAVED_OFFER })).toBeTruthy();

    await act(async () => { jest.advanceTimersByTime(10_500); await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(/No new offers right now/)).toBeTruthy();
    expect(screen.getByRole('article', { name: SAVED_OFFER })).toBeTruthy();
    nothingStillSearching();
  });
});

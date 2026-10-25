// Story 4: One-tap completion, honest "Not relevant" and quick wins (plans/v2-build-plan.md, section 1 R6, lane B, section 5).
import { screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';
import { fakeServer, callsTo, mayaRun, showVersionB, goTab, dollars, control } from './helpers';

afterEach(() => { cleanup(); try { sessionStorage.clear(); localStorage.clear(); } catch { /* ignore */ } });

/** A closed drawer on the current tab, "Claimed" or "Dismissed" (opened first if it starts folded). */
function drawer(name: 'Claimed' | 'Dismissed'): HTMLElement {
  const re = name === 'Claimed' ? /^(show )?claimed(?! so far)/i : /^(show )?dismissed/i;
  const toggle = screen.queryAllByRole('button', { name: re }).find((b) => b.hasAttribute('aria-expanded'));
  if (toggle && toggle.getAttribute('aria-expanded') === 'false') fireEvent.click(toggle);
  return screen.getByRole('region', { name: name === 'Claimed' ? /^claimed(?! so far)/i : /^dismissed/i });
}
/** True when a card sits inside either drawer. */
const inDrawer = (el: HTMLElement) => { for (let n = el.parentElement; n; n = n.parentElement) if ((n.getAttribute('role') === 'region' || n.tagName === 'SECTION') && /^(claimed(?! so far)|dismissed)/i.test(n.getAttribute('aria-label') ?? '')) return true; return false; };
/** Cards with this name that are still in the main list (not in a drawer). */
const inMainList = (name: RegExp) => screen.queryAllByRole('article', { name }).filter((a) => !inDrawer(a));

/** The three money numbers on Home: "Still to claim", "Claimed so far" and the big headline total. */
function homeNumbers() {
  goTab('Home');
  return {
    still: dollars(screen.getByTestId('still-to-claim')),
    claimed: dollars(screen.getByTestId('claimed-so-far')),
    headline: dollars(screen.getByTestId('home-total-amount')),
  };
}

describe('S4: "I got this" moves the card to the Claimed drawer', () => {
  // S4 — "Tapping 'I got this' moves the card into the 'Claimed' drawer and moves its money from 'Still to claim'
  // to 'Claimed so far'."
  it('"I got this" puts the card in "Claimed" and moves its $1,000 from Still to claim to Claimed so far', () => {
    fakeServer([[/\/api\/feedback$/, () => ({ ok: true, proposals: [] })]]);
    showVersionB(mayaRun());
    expect(screen.getByTestId('still-to-claim').textContent).toMatch(/Still to claim/i);
    expect(screen.getByTestId('claimed-so-far').textContent).toMatch(/Claimed so far/i);
    const before = homeNumbers();

    goTab('Savings');
    const trump = screen.getByRole('article', { name: /Trump Account/ });
    fireEvent.click(control(trump, /I got this/i));
    expect(inMainList(/Trump Account/)).toHaveLength(0);
    expect(within(drawer('Claimed')).getByRole('article', { name: /Trump Account/ })).toBeTruthy();

    const after = homeNumbers();
    expect(after.still).toBeCloseTo(before.still - 1000, 2);
    expect(after.claimed).toBeCloseTo(before.claimed + 1000, 2);
  });
});

describe('S4: "Not relevant" lowers the money numbers and can be undone', () => {
  // S4 (R6) — "Tapping 'Not relevant' takes the card's amount off 'Still to claim' and off the big headline number on Home
  // at once, leaves 'Claimed so far' alone, moves the card to a closed 'Dismissed' drawer and tells the Coach
  // (feedback kind 'not_relevant'). 'Undo' puts the card and all three numbers back."
  it('"Not relevant" moves the card to "Dismissed", lowers Still to claim and the headline, and Undo restores all three', async () => {
    const server = fakeServer([[/\/api\/feedback$/, () => ({ ok: true, proposals: [] })]]);
    showVersionB(mayaRun());
    const before = homeNumbers();

    goTab('Taxes');
    const ma = screen.getByRole('article', { name: /Massachusetts Child and Family Tax Credit/ });
    fireEvent.click(control(ma, /Not relevant/i));
    expect(inMainList(/Massachusetts Child and Family Tax Credit/)).toHaveLength(0);
    expect(within(drawer('Dismissed')).getByRole('article', { name: /Massachusetts Child and Family Tax Credit/ })).toBeTruthy();
    await waitFor(() => expect(callsTo(server, /\/api\/feedback$/).map((c) => c.body)).toContainEqual(expect.objectContaining({ familyId: 'maya', cardId: 'benefit-ma_child_tax_credit', kind: 'not_relevant' })));

    const after = homeNumbers();
    expect(after.still).toBeCloseTo(before.still - 440, 2);
    expect(after.claimed).toBeCloseTo(before.claimed, 2);
    expect(after.headline).toBeCloseTo(before.headline - 440, 2);

    // Undo: from the instant Undo or from inside the Dismissed drawer
    goTab('Taxes');
    const undo = screen.queryAllByRole('button', { name: /Undo/i })[0] ?? within(drawer('Dismissed')).getByRole('button', { name: /Undo/i });
    fireEvent.click(undo);
    expect(inMainList(/Massachusetts Child and Family Tax Credit/)).toHaveLength(1);
    const undone = homeNumbers();
    expect(undone.still).toBeCloseTo(before.still, 2);
    expect(undone.claimed).toBeCloseTo(before.claimed, 2);
    expect(undone.headline).toBeCloseTo(before.headline, 2);
  });
});

describe('S4: Quick wins filter', () => {
  // S4 — "The 'Quick wins' filter shows only cards that take under 5 minutes, each with its time estimate; longer jobs
  // like adding baby to insurance (about 15 min) are hidden."
  it('shows only cards under 5 minutes', () => {
    showVersionB(mayaRun());
    fireEvent.click(screen.getByRole('button', { name: /Quick wins/i }));
    const list = screen.getByRole('region', { name: /Quick wins/i });
    const cards = within(list).getAllByRole('article');
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) {
      const m = c.textContent!.match(/(\d+)\s*min/);
      expect(m).not.toBeNull();
      expect(Number(m![1])).toBeLessThan(5);
    }
    expect(within(list).queryByRole('article', { name: /Add your baby to health insurance/ })).toBeNull();
  });
});

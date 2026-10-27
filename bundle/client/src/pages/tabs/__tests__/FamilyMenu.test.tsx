// Option B (Oct 25): Account leaves the bottom bar. The family chip in the header is a button that opens a small menu with
// "Switch family" and "Your plan and saved answers" (the Account screen). Typed-in families show "Your family", never "Baby Guest".
import { screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';
import { fakeServer, leoRun, mayaRun, showVersionB, chipButton, openAccount, type FakeRoute } from '../../../__acceptance__/v2/helpers';
import { familyChip, familyChipParts } from '@/lib/bundle';

afterEach(() => { cleanup(); try { sessionStorage.clear(); localStorage.clear(); } catch { /* ignore */ } });

const QUIET: FakeRoute[] = [
  [/\/memory/, () => ({ family: [], learned: [] })],
  [/\/gear/, () => ({ items: [], receipts: [] })],
];

describe('bottom bar', () => {
  it('has exactly 5 tabs and no Account tab', () => {
    fakeServer(QUIET);
    showVersionB(mayaRun());
    const bar = screen.getByRole('navigation', { name: 'Main' });
    expect(within(bar).getAllByRole('button').map((b) => b.textContent?.replace(/\d+$/, ''))).toEqual(['Home', 'Taxes', 'Savings', 'Insurance', 'Deals']);
    expect(within(bar).queryByRole('button', { name: /Account/ })).toBeNull();
  });
});

describe('family chip menu', () => {
  it('is a menu button that opens, and closes on Escape and on a tap outside', () => {
    fakeServer(QUIET);
    showVersionB(mayaRun());
    const chip = chipButton();
    expect(chip.getAttribute('aria-haspopup')).toBe('menu');
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    expect(chip.textContent).toMatch(/Baby Maya · day 20/);

    fireEvent.click(chip);
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    const menu = screen.getByRole('menu', { name: /Family menu/i });
    expect(within(menu).getAllByRole('menuitemradio').map((m) => m.textContent)).toEqual([
      expect.stringMatching(/^Maya/), expect.stringMatching(/^Leo/), expect.stringMatching(/^Ava/), expect.stringMatching(/^My saved profile/),
    ]);
    expect(within(menu).getByRole('menuitem', { name: /Your plan and saved answers/ })).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: /Family menu/i })).toBeNull();
    expect(chip.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(chip);
    expect(screen.getByRole('menu', { name: /Family menu/i })).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu', { name: /Family menu/i })).toBeNull();
  });

  it('"Your plan and saved answers" opens the Account screen and closes the menu', () => {
    fakeServer(QUIET);
    showVersionB(mayaRun());
    openAccount();
    expect(screen.queryByRole('menu', { name: /Family menu/i })).toBeNull();
    const page = screen.getByRole('region', { name: 'Account' });
    expect(within(page).getByRole('button', { name: /Forget everything/i })).toBeTruthy();
    // no bottom-bar tab claims to be the current page while Account is open
    const bar = screen.getByRole('navigation', { name: 'Main' });
    expect(within(bar).getAllByRole('button').some((b) => b.getAttribute('aria-current') === 'page')).toBe(false);
  });

  it('switching family from the chip menu loads that family and updates the chip', async () => {
    const leo = leoRun();
    const status = { runId: leo.runId, familyId: leo.familyId, status: 'done', startedAt: '2026-10-23T12:00:00.000Z', family: leo.family, today: leo.today, demoDate: leo.demoDate, result: leo.result, error: null };
    fakeServer([...QUIET, [/\/api\/families\/leo/i, () => status], [/\/api\/runs\/run-leo$/, () => status]]);
    showVersionB(mayaRun());
    fireEvent.click(chipButton());
    fireEvent.click(within(screen.getByRole('menu', { name: /Family menu/i })).getByRole('menuitemradio', { name: /Leo/ }));
    expect(screen.queryByRole('menu', { name: /Family menu/i })).toBeNull();
    await waitFor(() => expect(chipButton().textContent).toMatch(/Leo · due in 45 days/));
    // a switch from the chip lands on Home, not Account
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: /^Home/ }).getAttribute('aria-current')).toBe('page');
  });

  it('typed-in family chip shows "Your family", never "Baby Guest", even with a saved plan name', () => {
    fakeServer(QUIET);
    localStorage.setItem('bundle:plan:guest-ab12cd34', JSON.stringify({ name: 'Our baby plan', hidden: false }));
    showVersionB(mayaRun({ familyId: 'guest-ab12cd34', family: { name: 'Guest' } }));
    const text = chipButton().textContent ?? '';
    expect(text).toMatch(/Your family · day 20/);
    expect(text).not.toMatch(/Guest|Our baby plan/);
    expect(screen.getByTestId('chip-short').textContent).toBe('Your family');
  });

  it('shows only the short name on a phone and the stage from 640px up; screen readers get the full label once', () => {
    fakeServer(QUIET);
    showVersionB(mayaRun());
    expect(screen.getByTestId('chip-short').textContent).toBe('Maya');
    expect(screen.getByTestId('chip-short').className).toMatch(/sm:hidden/);
    expect(screen.getByTestId('chip-full').textContent).toBe('Baby Maya · day 20');
    expect(screen.getByTestId('chip-full').className).toMatch(/^hidden .*sm:inline/);
    expect(chipButton().getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: 'Family menu: Baby Maya · day 20' })).toBeTruthy();
  });
});

describe('familyChip label', () => {
  it('keeps the sample name for sample families and says "Your family" for typed-in ones', () => {
    expect(familyChip({ name: 'Maya (sample family)', birthDate: '2026-10-03', dueDate: null }, '2026-10-23', 'maya')).toBe('Baby Maya · day 20');
    expect(familyChip({ name: 'Guest', birthDate: '2026-10-03', dueDate: null }, '2026-10-23', 'guest-ab12cd34')).toBe('Your family · day 20');
    expect(familyChip({ name: 'Guest', birthDate: null, dueDate: '2026-12-07' }, '2026-10-23', 'guest-ab12cd34')).toBe('Your family · due in 45 days');
    expect(familyChip({ name: 'Guest', birthDate: null, dueDate: null }, '2026-10-23', 'guest-ab12cd34')).toBe('Your family');
    expect(familyChipParts({ name: 'Leo (sample family)', birthDate: null, dueDate: '2026-12-07' }, '2026-10-23', 'leo')).toEqual({ short: 'Leo', full: 'Leo · due in 45 days' });
    expect(familyChipParts({ name: 'Guest', birthDate: '2026-10-03', dueDate: null }, '2026-10-23', 'guest-ab12cd34')).toEqual({ short: 'Your family', full: 'Your family · day 20' });
    // no id known: a name without "(sample family)" is treated as typed in
    expect(familyChip({ name: 'Guest', birthDate: '2026-10-03', dueDate: null }, '2026-10-23')).toBe('Your family · day 20');
  });
});

// Option B (Oct 25): Account leaves the bottom bar. The family chip in the header is a button that opens a small menu with
// "Switch family" and "Your plan and saved answers" (the Account screen). Typed-in families show "Your family", never "Baby Guest".
import { screen, cleanup, within } from '@testing-library/react';
import { fakeServer, mayaRun, showVersionB, chipButton, openAccount, type FakeRoute } from '../../../__acceptance__/v2/helpers';
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

describe('account button (Oct 26: one tap, no dropdown)', () => {
  it('is a plain account icon that opens the Account screen in one tap, with no menu', () => {
    fakeServer(QUIET);
    showVersionB(mayaRun());
    expect(chipButton().getAttribute('aria-haspopup')).toBeNull();
    expect(chipButton().querySelector('svg')).toBeTruthy();
    openAccount();
    expect(screen.queryByRole('menu')).toBeNull();
    const page = screen.getByRole('region', { name: 'Account' });
    expect(within(page).getByRole('button', { name: /Forget everything/i })).toBeTruthy();
    // no bottom-bar tab claims to be the current page while Account is open
    const bar = screen.getByRole('navigation', { name: 'Main' });
    expect(within(bar).getAllByRole('button').some((b) => b.getAttribute('aria-current') === 'page')).toBe(false);
  });

  it('screen readers hear whose account it is; typed-in families are "Your family", never "Baby Guest"', () => {
    fakeServer(QUIET);
    localStorage.setItem('bundle:plan:guest-ab12cd34', JSON.stringify({ name: 'Our baby plan', hidden: false }));
    showVersionB(mayaRun({ familyId: 'guest-ab12cd34', family: { name: 'Guest' } }));
    const name = chipButton().getAttribute('aria-label') ?? '';
    expect(name).toMatch(/Your family · day 20/);
    expect(name).not.toMatch(/Guest|Our baby plan/);
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

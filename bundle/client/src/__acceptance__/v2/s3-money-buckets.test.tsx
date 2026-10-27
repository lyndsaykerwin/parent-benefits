// Story 3: Money buckets on Home (plans/v2-feedback-response.md, "Money buckets, in detail" + section 4).
import { screen, cleanup, within } from '@testing-library/react';
import { fmtUsdShort } from '@/lib/bundle';
import { mayaRun, leoRun, showVersionB } from './helpers';

afterEach(() => { cleanup(); try { sessionStorage.clear(); localStorage.clear(); } catch { /* ignore */ } });

const bucket = (name: string) => screen.getByRole('region', { name });

describe('S3: Home splits the money into three buckets', () => {
  // S3 — "Home shows 'Money back now', 'At tax time' and 'Paid family leave' with the run's real amounts; tax-time money
  // says 'when you file your 2026 taxes (spring 2027)' for a 2026 baby; the Trump Account is labelled as going into the
  // baby's account; paid leave says 'up to $1,230 a week for 12 weeks'."
  it('Maya (born 2026): real amounts in each bucket, spring 2027, Trump Account in its own baby-savings box', () => {
    const run = mayaRun();
    showVersionB(run);
    const cards = run.result.cards;
    const sum = (re: RegExp) => cards.filter((c) => re.test(c.id) && (c.verdict === 'verified' || c.verdict === 'likely')).reduce((a, c) => a + (c.amountCents ?? 0), 0);

    const now = bucket('Money back now');
    expect(within(now).getByText(fmtUsdShort(sum(/^clawback-(fsa|price)-/)))).toBeTruthy(); // $48.99 for Maya

    const tax = bucket('At tax time');
    expect(within(tax).getByText(fmtUsdShort(sum(/^benefit-(federal_child_tax_credit|ma_child_tax_credit)$/)))).toBeTruthy(); // $2,640
    expect(within(tax).getByText(/when you file your 2026 taxes \(spring 2027\)/i)).toBeTruthy();
    // Oct 26 (Lyndsay): the Trump Account is not a tax credit, so it has its own "baby's savings account" box.
    expect(within(tax).queryByText(/Trump Account/)).toBeNull();
    const savings = bucket('Your baby\'s savings account');
    expect(within(savings).getByText(/Trump Account/)).toBeTruthy();
    expect(within(savings).getByText(fmtUsdShort(sum(/^benefit-trump_account$/)))).toBeTruthy(); // $1,000
    expect(within(savings).getByText(/account in your baby[’']s name/i)).toBeTruthy();

    const leave = bucket('Paid family leave');
    expect(within(leave).getByText(/up to \$1,230 a week for 12 weeks/)).toBeTruthy();
  });

  // S3 — "The tax year is worked out from the date (a baby due in 2027 means spring 2028), and 'Money back now' with no
  // receipts says 'Add a receipt to find money back', never '$0'."
  it('a baby due in 2027 says spring 2028, and an empty "Money back now" asks for a receipt instead of $0', () => {
    showVersionB(leoRun({ dueDate: '2027-01-15' }));
    expect(within(bucket('At tax time')).getByText(/2027 taxes \(spring 2028\)/i)).toBeTruthy();
    const now = bucket('Money back now');
    expect(within(now).getByText(/Add a receipt to find money back/)).toBeTruthy();
    expect(now.textContent).not.toMatch(/\$0\b/);
  });
});

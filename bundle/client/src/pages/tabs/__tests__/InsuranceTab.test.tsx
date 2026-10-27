import React from 'react';
import { cleanup, fireEvent, screen, within, waitFor } from '@testing-library/react';
import { mayaRun, showVersionB, goTab } from '@/__acceptance__/v2/helpers';

afterEach(() => { cleanup(); try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ } });

const open = (family: Record<string, unknown> = {}) => { showVersionB(mayaRun({ family })); goTab('Insurance'); };
const pillText = () => screen.getByTestId('countdown-pill').textContent;

describe('Insurance tab follows the insurance answer', () => {
  it.each([
    ['job', '30 days from birth to add baby', /10 days left/],
    ['marketplace', '60 days from birth to add baby', /By Dec 2/],
    ['tricare', '90 days to register baby in DEERS', /By Jan 1, 2027/],
  ])('%s: pill and deadline', (insurance, pill, due) => {
    open({ insurance });
    expect(pillText()).toBe(pill);
    const card = screen.getByRole('article', { name: /Add your baby to health insurance/ });
    expect(within(card).getByText(due as RegExp)).toBeTruthy();
    expect(card.textContent).toMatch(/Your answer:/);
  });
  it('Medicaid: covered for a year, a to-do, no countdown', () => {
    open({ insurance: 'medicaid', state: 'MA' });
    expect(pillText()).toBe('Baby is covered automatically for 1 year');
    const card = screen.getByRole('article', { name: /Add your baby to health insurance/ });
    expect(card.textContent).toMatch(/report the birth within 10 days/i);
    expect(within(card).queryByText(/days left/)).toBeNull();
  });
  it('no insurance / not sure: the baby may qualify for the state program', () => {
    open({ insurance: 'none_or_not_sure', state: 'MA' });
    expect(pillText()).toBe('Your baby may qualify for MassHealth');
    expect(screen.queryByTestId('card-breast-pump')).toBeNull();
    expect(screen.queryByTestId('booster-carrier')).toBeNull();
  });
});

describe('Questions to ask HR', () => {
  it('opens from the Insurance tab with questions built from the answers, and Back returns', () => {
    open({ insurance: 'job' });
    fireEvent.click(screen.getByRole('button', { name: /See the questions/ }));
    expect(screen.getByRole('heading', { name: 'Questions to ask HR' })).toBeTruthy();
    expect(screen.getByText('Do we have 30 or 60 days to add our baby?')).toBeTruthy();
    expect(screen.getByText('Do we offer a Dependent Care FSA, and what’s the cap?')).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/30 or 60 days/));
    expect((screen.getByLabelText(/30 or 60 days/) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByTestId('countdown-pill')).toBeTruthy();
  });
  it('drops the FSA questions when a parent is not working, and swaps to tax-preparer questions for self-employed', () => {
    open({ insurance: 'job', parent2Work: 'not_working' });
    fireEvent.click(screen.getByRole('button', { name: /See the questions/ }));
    expect(screen.queryByText(/Dependent Care FSA/)).toBeNull();
    cleanup();
    open({ household: 'one', parent1Work: 'self_employed', insurance: 'job' });
    expect(screen.getByRole('heading', { name: 'Questions for your tax preparer' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /See the questions/ }));
    expect(screen.getByText(/childcare tax credit for daycare costs/)).toBeTruthy();
    expect(screen.getByText(/2026 return/)).toBeTruthy();
  });
  it('Copy puts the numbered questions on the clipboard and says so', async () => {
    const writeText = jest.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    open({ insurance: 'job' });
    fireEvent.click(screen.getByRole('button', { name: /See the questions/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(screen.getByText('Copied 4 questions.')).toBeTruthy());
    expect((writeText.mock.calls[0] as unknown as string[])[0]).toMatch(/^1\. Do we have 30 or 60 days/);
  });
  it('Email to myself uses the device share menu on a phone (Bundle sends nothing)', async () => {
    const share = jest.fn(async () => undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true }); // a touch phone (Oct 26: computers get a mailto: link)
    open({ insurance: 'job' });
    fireEvent.click(screen.getByRole('button', { name: /See the questions/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Email to myself' }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect((share.mock.calls[0] as unknown as [{ title: string }])[0].title).toBe('Questions to ask HR');
    delete (navigator as any).share;
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });
  });
});

describe('carrier booster (optional)', () => {
  it('shows for job and marketplace plans, one tap gives the steps, and the choice is remembered', () => {
    open({ insurance: 'job' });
    expect(screen.getByTestId('card-breast-pump').textContent).toMatch(/covers a breast pump at \$0/);
    for (const c of ['Aetna', 'BCBS', 'UnitedHealthcare', 'Kaiser', 'Other']) expect(screen.getByRole('button', { name: c })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Aetna' }));
    expect(screen.getByText('Here’s how to order your free pump through Aetna')).toBeTruthy();
    expect(screen.queryByTestId('booster-carrier')).toBeNull();
    expect(localStorage.getItem('bundle:carrier:maya')).toBe('Aetna');
    cleanup();
    open({ insurance: 'job' });
    expect(screen.getByText('Here’s how to order your free pump through Aetna')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pick a different company' }));
    expect(screen.getByTestId('booster-carrier')).toBeTruthy();
  });
  it('is not offered to Medicaid or TRICARE families', () => {
    for (const insurance of ['medicaid', 'tricare']) {
      open({ insurance });
      expect(screen.queryByTestId('booster-carrier')).toBeNull();
      expect(screen.queryByTestId('card-breast-pump')).toBeNull();
      cleanup();
    }
  });
});

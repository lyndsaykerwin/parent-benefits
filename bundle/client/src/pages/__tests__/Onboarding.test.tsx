import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import Onboarding from '../Onboarding';
import { stateForZip, zipMessage, babyAgeLine, COVERED_STATES } from '@/lib/onboarding';

afterEach(() => { cleanup(); try { localStorage.clear(); } catch { /* ignore */ } });

function mount() {
  const fetchMock = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ runId: 'r9' }) }));
  (global as any).fetch = fetchMock;
  const loc = memoryLocation({ path: '/', record: true });
  render(<Router hook={loc.hook}><Onboarding /></Router>);
  return { fetchMock, loc };
}

const body = (m: jest.Mock) => JSON.parse((m.mock.calls[0] as any[])[1].body);
const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

describe('onboarding helpers', () => {
  it('covered states match the states in data/sample/state-programs.json', () => {
    const fs = require('fs');
    const path = require('path');
    const rows = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'data/sample/state-programs.json'), 'utf8'));
    expect([...new Set(rows.map((r: any) => r.state))].sort()).toEqual([...COVERED_STATES].sort());
  });
  it('maps ZIPs to states', () => {
    expect(stateForZip('02139')).toEqual({ code: 'MA', name: 'Massachusetts', covered: true });
    expect(stateForZip('44101')).toEqual({ code: 'OH', name: 'Ohio', covered: false });
    expect(stateForZip('94110')).toEqual({ code: 'CA', name: 'California', covered: true });
    expect(stateForZip('60601')).toEqual({ code: 'IL', name: 'Illinois', covered: false });
    expect(stateForZip('123')).toBeNull();
  });
  it('covered vs uncovered state wording', () => {
    expect(zipMessage('02139')).toBe('Found it: showing Massachusetts programs plus federal ones');
    expect(zipMessage('60601')).toContain('Support for your state’s programs is coming soon');
    expect(zipMessage('60601')).toContain('federal');
    expect(zipMessage('44101')).toBe('Ohio: showing federal programs. Support for your state’s programs is coming soon.');
  });
  it('baby age line only while 30-day deadlines can still be open', () => {
    expect(babyAgeLine('2026-10-04', '2026-10-24')).toBe('20 days old: some 30-day deadlines are still open');
    expect(babyAgeLine('2026-01-04', '2026-10-24')).toBeNull();
  });
});

/** Walks screens 1-3 (stage, date, ZIP) and stops on Q4. */
function toQ4(stage: 'expecting' | 'born', date: string, zip: string) {
  fireEvent.click(screen.getByRole('button', { name: stage === 'expecting' ? /We’re expecting/ : /Baby’s here/ }));
  fireEvent.change(screen.getByLabelText(stage === 'expecting' ? 'Due date' : 'Birth date'), { target: { value: date } });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.change(screen.getByLabelText('ZIP code'), { target: { value: zip } });
  fireEvent.click(screen.getByRole('button', { name: 'Looks right' }));
}
const row = (name: string) => screen.getByRole('group', { name });

describe('Onboarding five questions', () => {
  it('starts on screen 1 of 5 with the two choices and a sample family', () => {
    mount();
    expect(screen.getByText('1 of 5')).toBeTruthy();
    expect(screen.getByText('Where are you right now?')).toBeTruthy();
    expect(screen.getByRole('button', { name: /We’re expecting/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Baby’s here/ })).toBeTruthy();
    expect(screen.queryByText(/Employer/)).toBeNull();
    expect(screen.queryByText(/Connect a card/)).toBeNull();
  });

  it('expecting path: due date and ZIP, then work and insurance, then one request with every answer', async () => {
    const { fetchMock, loc } = mount();
    fireEvent.click(screen.getByRole('button', { name: /We’re expecting/ }));
    expect(screen.getByText('2 of 5')).toBeTruthy();
    expect(screen.getByText('When’s your baby due?')).toBeTruthy();
    const due = future(60);
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: due } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('3 of 5')).toBeTruthy();
    expect(screen.getByText('Where do you live?')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('ZIP code'), { target: { value: '02139' } });
    expect(screen.getByText('Found it: showing Massachusetts programs plus federal ones')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Looks right' }));
    expect(fetchMock).not.toHaveBeenCalled(); // the ZIP no longer starts the run
    expect(screen.getByText('4 of 5')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Just me/ }));
    fireEvent.click(within(row('You')).getByRole('button', { name: /^Self-employed or freelance/ }));
    expect(screen.getByText(/childcare tax credit can give back up to \$1,500/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('5 of 5')).toBeTruthy();
    expect(screen.getByText(/Got it — checking daycare tax savings for you/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^MassHealth/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(body(fetchMock)).toEqual({ zip: '02139', dueDate: due, household: 'one', parent1Work: 'self_employed', insurance: 'medicaid' });
    await waitFor(() => expect(loc.history?.at(-1)).toBe('/feed/r9'));
  });

  it('baby’s here path sends birthDate, and an uncovered state shows the other marketplace and Medicaid names', async () => {
    const { fetchMock } = mount();
    const born = future(-10);
    toQ4('born', born, '60601');
    fireEvent.click(screen.getByRole('button', { name: /^Two of us/ }));
    fireEvent.click(within(row('You')).getByRole('button', { name: /^Paycheck from a job/ }));
    fireEvent.click(within(row('Your partner')).getByRole('button', { name: /^Not working right now/ }));
    expect(screen.getByText(/Daycare tax savings usually need earned income/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/we’ll show other ways to save on childcare/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Healthcare\.gov \/ your state marketplace/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Medicaid \/ CHIP/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^TRICARE/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(body(fetchMock)).toEqual({ zip: '60601', birthDate: born, household: 'two', parent1Work: 'paycheck', parent2Work: 'not_working', insurance: 'tricare' });
  });

  it('Continue stays off until every row is answered, and a switch to "Just me" ignores the partner row', async () => {
    const { fetchMock } = mount();
    toQ4('born', future(-10), '02139');
    const next = () => screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    expect(next().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /^Two of us/ }));
    fireEvent.click(within(row('You')).getByRole('button', { name: /^Paycheck from a job/ }));
    expect(next().disabled).toBe(true);
    fireEvent.click(within(row('Your partner')).getByRole('button', { name: /^Self-employed/ }));
    expect(next().disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /^Just me/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: /^Through a job/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(body(fetchMock)).toEqual(expect.objectContaining({ household: 'one', parent1Work: 'paycheck', insurance: 'job' }));
    expect(body(fetchMock)).not.toHaveProperty('parent2Work');
  });

  it('"prefer not to say" on Q4 skips the work answers and says so, and Q5\'s way out sends "not sure"', async () => {
    const { fetchMock } = mount();
    toQ4('born', future(-10), '02139');
    fireEvent.click(screen.getByRole('button', { name: /Something else \/ prefer not to say/ }));
    expect(screen.getByText('5 of 5')).toBeTruthy();
    expect(screen.getByText(/No problem — we’ll show general daycare savings/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /No insurance right now \/ not sure/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const sent = body(fetchMock);
    expect(sent).toEqual({ zip: '02139', birthDate: expect.any(String), insurance: 'none_or_not_sure' });
  });

  it('both questions have "Why we ask" and a way out', () => {
    mount();
    toQ4('born', future(-10), '02139');
    expect(screen.getByText('Why we ask')).toBeTruthy();
    expect(screen.getByText(/So we can check daycare tax savings/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /prefer not to say/ }));
    expect(screen.getByText('Why we ask')).toBeTruthy();
    expect(screen.getByText(/So we can give you the right deadline/)).toBeTruthy();
    expect(screen.getByText(/No insurance right now \/ not sure/)).toBeTruthy();
  });

  it('remembers the saved family id the server sends back (and not for a sample family)', async () => {
    const { fetchMock } = mount();
    fetchMock.mockImplementationOnce(async () => ({ ok: true, status: 202, json: async () => ({ runId: 'r9', familyId: 'guest-ab12cd34' }) }) as any);
    toQ4('born', future(-10), '02139');
    fireEvent.click(screen.getByRole('button', { name: /prefer not to say/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Through a job/ }));
    await waitFor(() => expect(localStorage.getItem('bundle_family_id')).toBe('guest-ab12cd34'));
    cleanup();
    localStorage.clear();
    const again = mount();
    again.fetchMock.mockImplementationOnce(async () => ({ ok: true, status: 202, json: async () => ({ runId: 'r9', familyId: 'maya' }) }) as any);
    fireEvent.click(screen.getByRole('button', { name: /Try a sample family/ }));
    await waitFor(() => expect(again.loc.history?.at(-1)).toBe('/feed/r9'));
    expect(localStorage.getItem('bundle_family_id')).toBeNull();
  });

  it('blocks a missing date and a bad ZIP with plain messages', () => {
    const { fetchMock } = mount();
    fireEvent.click(screen.getByRole('button', { name: /We’re expecting/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('alert').textContent).toMatch(/due date/i);
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: future(30) } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('ZIP code'), { target: { value: '021' } });
    fireEvent.click(screen.getByRole('button', { name: 'Looks right' }));
    expect(screen.getByRole('alert').textContent).toMatch(/ZIP/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a ZIP the server rejects sends the parent back to the ZIP screen with an honest message and the sample-family button', async () => {
    const { fetchMock, loc } = mount();
    fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 400, json: async () => ({ error: 'Enter a valid US ZIP code' }) }) as any);
    toQ4('born', future(-10), '59001');
    fireEvent.click(screen.getByRole('button', { name: /prefer not to say/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Through a job/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('We can’t check Montana yet. Try a sample family to see how it works.'));
    expect((screen.getByLabelText('ZIP code') as HTMLInputElement).value).toBe('59001');
    expect(screen.queryByText(/Enter a valid US ZIP/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Try a sample family/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse((fetchMock.mock.calls[1] as any[])[1].body)).toEqual({ familyId: 'maya' });
    await waitFor(() => expect(loc.history?.at(-1)).toBe('/feed/r9'));
  });

  it('Try a sample family starts the sample run (its five answers come with the sample family)', async () => {
    const { fetchMock, loc } = mount();
    fireEvent.click(screen.getByRole('button', { name: /Try a sample family/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(body(fetchMock)).toEqual({ familyId: 'maya' });
    await waitFor(() => expect(loc.history?.at(-1)).toBe('/feed/r9'));
  });

  it('Back keeps every answer, all the way back to the first screens', () => {
    mount();
    const born = future(-10);
    toQ4('born', born, '02139');
    fireEvent.click(screen.getByRole('button', { name: /^Two of us/ }));
    fireEvent.click(within(row('You')).getByRole('button', { name: /^Paycheck from a job/ }));
    fireEvent.click(within(row('Your partner')).getByRole('button', { name: /^Not working right now/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: /^Two of us/ }).getAttribute('aria-pressed')).toBe('true');
    expect(within(row('You')).getByRole('button', { name: /^Paycheck/ }).getAttribute('aria-pressed')).toBe('true');
    expect(within(row('Your partner')).getByRole('button', { name: /^Not working/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect((screen.getByLabelText('ZIP code') as HTMLInputElement).value).toBe('02139');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect((screen.getByLabelText('Birth date') as HTMLInputElement).value).toBe(born);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('1 of 5')).toBeTruthy();
  });
});

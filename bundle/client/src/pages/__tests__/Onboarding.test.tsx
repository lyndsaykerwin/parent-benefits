import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import Onboarding from '../Onboarding';
import { stateForZip, zipMessage, babyAgeLine } from '@/lib/onboarding';

afterEach(() => cleanup());

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
  it('maps ZIPs to states', () => {
    expect(stateForZip('02139')).toEqual({ code: 'MA', name: 'Massachusetts', covered: true });
    expect(stateForZip('44101')?.code).toBe('OH');
    expect(stateForZip('94110')).toEqual({ code: 'CA', name: 'California', covered: false });
    expect(stateForZip('123')).toBeNull();
  });
  it('covered vs uncovered state wording', () => {
    expect(zipMessage('02139')).toBe('Found it: showing Massachusetts programs plus federal ones');
    expect(zipMessage('94110')).toContain('Support for your state’s programs is coming soon');
    expect(zipMessage('94110')).toContain('federal');
  });
  it('baby age line only while 30-day deadlines can still be open', () => {
    expect(babyAgeLine('2026-10-04', '2026-10-24')).toBe('20 days old: some 30-day deadlines are still open');
    expect(babyAgeLine('2026-01-04', '2026-10-24')).toBeNull();
  });
});

describe('Onboarding top row', () => {
  it('starts on screen 1 of 3 with the two choices and a sample family', () => {
    mount();
    expect(screen.getByText('1 of 3')).toBeTruthy();
    expect(screen.getByText('Where are you right now?')).toBeTruthy();
    expect(screen.getByRole('button', { name: /We’re expecting/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Baby’s here/ })).toBeTruthy();
    expect(screen.queryByText(/Employer/)).toBeNull();
    expect(screen.queryByText(/Connect a card/)).toBeNull();
  });

  it('expecting path asks for the due date and sends dueDate + zip, then opens Checking', async () => {
    const { fetchMock, loc } = mount();
    fireEvent.click(screen.getByRole('button', { name: /We’re expecting/ }));
    expect(screen.getByText('2 of 3')).toBeTruthy();
    expect(screen.getByText('When’s your baby due?')).toBeTruthy();
    const due = future(60);
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: due } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Last one')).toBeTruthy();
    expect(screen.getByText('Where do you live?')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('ZIP code'), { target: { value: '02139' } });
    expect(screen.getByText('Found it: showing Massachusetts programs plus federal ones')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Looks right' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(body(fetchMock)).toEqual({ zip: '02139', dueDate: due });
    await waitFor(() => expect(loc.history?.at(-1)).toBe('/feed/r9'));
  });

  it('baby’s here path asks for the birthday and sends birthDate', async () => {
    const { fetchMock } = mount();
    fireEvent.click(screen.getByRole('button', { name: /Baby’s here/ }));
    expect(screen.getByText('Congrats! What’s your baby’s birthday?')).toBeTruthy();
    const born = future(-10);
    fireEvent.change(screen.getByLabelText('Birth date'), { target: { value: born } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('ZIP code'), { target: { value: '94110' } });
    expect(screen.getByText(/Support for your state’s programs is coming soon/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Looks right' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(body(fetchMock)).toEqual({ zip: '94110', birthDate: born });
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

  it('Try a sample family starts the sample run', async () => {
    const { fetchMock, loc } = mount();
    fireEvent.click(screen.getByRole('button', { name: /Try a sample family/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(body(fetchMock)).toEqual({ familyId: 'maya' });
    await waitFor(() => expect(loc.history?.at(-1)).toBe('/feed/r9'));
  });

  it('Back returns to the previous screen', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /Baby’s here/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('1 of 3')).toBeTruthy();
  });
});

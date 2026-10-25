import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import AddPurchaseButton, { describeReading, type PhotoDeps } from '../AddPurchaseButton';
import type { PhotoReadResponse } from '@/lib/photoPrep';

afterEach(cleanup);

function setup(send: PhotoDeps['send'], extra: Partial<PhotoDeps> = {}) {
  const deps: PhotoDeps = {
    prepare: jest.fn(async () => ({ mimeType: 'image/jpeg' as const, imageBase64: 'QUJD' })),
    send,
    startRun: jest.fn(async () => ({ runId: 'run-new' })),
    ...extra,
  };
  const loc = memoryLocation({ path: '/feed/old', record: true });
  render(<Router hook={loc.hook}><AddPurchaseButton familyId="maya" deps={deps} /></Router>);
  fireEvent.click(screen.getByRole('button', { name: /take a photo/i }));
  return { deps, loc };
}
const pick = (file = new File(['x'], 'p.jpg', { type: 'image/jpeg' })) =>
  fireEvent.change(screen.getByLabelText('Take or choose a photo', { selector: 'input' }), { target: { files: [file] } });

const ok = (over: Partial<Extract<PhotoReadResponse, { status: 'ok' }>> = {}): PhotoReadResponse => ({
  status: 'ok', rounds: 1, stored: 1, items: [{ productName: 'Frida baby thermometer', brand: 'Frida' }], ...over,
});

describe('AddPurchaseButton', () => {
  it('opens a "Take a photo" sheet that says the photo is not saved', () => {
    setup(jest.fn());
    const d = screen.getByRole('dialog', { name: 'Take a photo' });
    expect(d.textContent).toMatch(/never saved/);
  });

  it('sends the prepared photo to the server with the family and the chosen kind, then says how many items were really saved', async () => {
    const send = jest.fn(async () => ok({ stored: 2, items: [{ productName: 'Crib mattress' }, { productName: 'Bottle' }] }));
    const { deps } = setup(send);
    fireEvent.click(screen.getByRole('button', { name: 'A receipt' }));
    pick();
    await waitFor(() => expect(screen.getByTestId('photo-result')).toBeTruthy());
    expect(deps.prepare).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ familyId: 'maya', kind: 'receipt', mimeType: 'image/jpeg', imageBase64: 'QUJD' });
    expect(screen.getByTestId('photo-result').textContent).toContain('Added 2 items: Crib mattress, Bottle.');
  });

  it('uses "stored", not the item count: a photo we already had adds nothing', async () => {
    setup(jest.fn(async () => ok({ stored: 0 })));
    pick();
    await waitFor(() => expect(screen.getByTestId('photo-result')).toBeTruthy());
    expect(screen.getByTestId('photo-result').textContent).toMatch(/We already had Frida baby thermometer, so nothing new was added/);
    expect(screen.queryByRole('button', { name: 'Check my new items' })).toBeNull();
  });

  it('"Check my new items" starts a new run for the family and opens it', async () => {
    const { deps, loc } = setup(jest.fn(async () => ok()));
    pick();
    fireEvent.click(await screen.findByRole('button', { name: 'Check my new items' }));
    await waitFor(() => expect(loc.history!.at(-1)).toBe('/feed/run-new'));
    expect(deps.startRun).toHaveBeenCalledWith({ familyId: 'maya' });
  });

  it.each([
    ['needs_clearer_photo', 'That photo was too blurry to read. Try again in better light.'],
    ['rejected', 'That does not look like a baby item.'],
    ['unavailable', 'Photo reading needs the live model.'],
  ] as const)('shows the server\'s plain message for "%s" and saves nothing', async (status, message) => {
    setup(jest.fn(async () => ({ status, message }) as PhotoReadResponse));
    pick();
    await waitFor(() => expect(screen.getByTestId('photo-problem')).toBeTruthy());
    expect(screen.getByTestId('photo-problem').textContent).toBe(message);
    expect(screen.queryByTestId('photo-result')).toBeNull();
  });

  it('turns a network or server error into a plain message', async () => {
    setup(jest.fn(async () => { throw new Error('Could not read that photo. Please try again.'); }));
    pick();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Could not read that photo. Please try again.'));
  });

  it('rejects a file that is not a photo before anything is sent', async () => {
    const send = jest.fn();
    const { deps } = setup(send);
    pick(new File(['x'], 'notes.pdf', { type: 'application/pdf' }));
    expect(screen.getByRole('alert').textContent).toMatch(/choose a photo/i);
    expect(deps.prepare).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('closes with the X and with Escape', () => {
    setup(jest.fn());
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /take a photo/i }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('describeReading', () => {
  it('says there was nothing to read when the server found no items', () => {
    expect(describeReading({ status: 'ok', items: [], stored: 0 })).toEqual({ problem: expect.stringMatching(/could not find an item/) });
  });
  it('trims a long list of names', () => {
    const items = ['a', 'b', 'c', 'd', 'e'].map((productName) => ({ productName }));
    expect(describeReading({ status: 'ok', items, stored: 5 })).toEqual({ message: 'Added 5 items: a, b, c, and 2 more.', added: true });
  });
  it('falls back to the item count when an older server sends no "stored"', () => {
    expect(describeReading({ status: 'ok', items: [{ productName: 'Pump' }] })).toEqual({ message: 'Added 1 item: Pump.', added: true });
  });
});

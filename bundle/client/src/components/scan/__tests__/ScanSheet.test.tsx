import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import ScanSheet, { GEAR_TIP, NO_MODEL, type ScanDeps } from '../ScanSheet';
import { ScanProvider, useScan } from '../ScanContext';
import type { PhotoReadResponse } from '@/lib/photoPrep';

afterEach(cleanup);

const GRACO = {
  productName: 'Graco infant car seat (sample)', brand: 'Graco', modelNumber: 'SAMPLE-1042', upc: '012345678905',
  recall: { found: false as const, source: 'NHTSA' as const, recordsChecked: 69, checkedOn: '2026-10-25', registerUrl: 'https://www.gracobaby.com/product-registration' },
};
const ok = (over: Partial<Extract<PhotoReadResponse, { status: 'ok' }>> = {}): PhotoReadResponse => ({ status: 'ok', rounds: 1, stored: 1, kind: 'item', items: [GRACO], ...over });

function Opener() { const { openScan } = useScan(); return <button onClick={openScan}>open</button>; }
function setup(send: ScanDeps['send']) {
  const deps: ScanDeps = { prepare: jest.fn(async () => ({ mimeType: 'image/jpeg' as const, imageBase64: 'QUJD', thumbnail: 'data:image/jpeg;base64,QUJD' })), send };
  render(<ScanProvider><Opener /><ScanSheet familyId="maya" deps={deps} /></ScanProvider>);
  fireEvent.click(screen.getByText('open'));
  return deps;
}
const choose = (re: RegExp) => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: re }));
const pick = (file = new File(['x'], 'p.jpg', { type: 'image/jpeg' })) =>
  fireEvent.change(screen.getByLabelText('Take or choose a photo', { selector: 'input' }), { target: { files: [file] } });

describe('ScanSheet', () => {
  it('asks "What are you scanning?" and says photos are saved with location data stripped', () => {
    setup(jest.fn());
    const d = screen.getByRole('dialog', { name: 'What are you scanning?' });
    expect(within(d).getByRole('button', { name: /^Gear/ })).toBeTruthy();
    expect(within(d).getByRole('button', { name: /^A receipt/ })).toBeTruthy();
    expect(d.textContent).toContain('We strip location data. Delete anytime.');
  });

  it('gear: shows the dashed frame and exactly the white-label tip', () => {
    setup(jest.fn());
    choose(/^Gear/);
    expect(screen.getByTestId('framing-guide').className).toMatch(/border-dashed/);
    expect(screen.getByTestId('gear-tip').textContent).toBe(GEAR_TIP);
    expect(GEAR_TIP).toBe("Tip: frame the white manufacturer label or barcode sticker. It's usually under a car seat, on the back of a high chair, or on a stroller's rear frame.");
  });

  it('sends the prepared photo and thumbnail with the family and kind, then shows the recall card', async () => {
    const send = jest.fn(async () => ok());
    const deps = setup(send);
    choose(/^Gear/);
    pick();
    await screen.findByRole('article', { name: /Graco infant car seat/ });
    expect(deps.prepare).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ familyId: 'maya', kind: 'item', mimeType: 'image/jpeg', imageBase64: 'QUJD', thumbnail: 'data:image/jpeg;base64,QUJD' });
    expect(screen.getByText(/69 NHTSA car-seat recalls/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Register it with Graco/ }).getAttribute('href')).toBe('https://www.gracobaby.com/product-registration');
    expect(screen.getByText(/Saved to your gear locker/)).toBeTruthy();
  });

  it('a made-up practice answer is labelled as a sample', async () => {
    setup(jest.fn(async () => ok({ sample: true })));
    choose(/^Gear/);
    pick();
    await screen.findByRole('article');
    expect(screen.getByTestId('sample-note').textContent).toMatch(/made-up sample/);
  });

  it('a recall that could not be checked says so and never says "No recalls found"', async () => {
    const recall = { found: null, source: 'CPSC' as const, recordsChecked: null, checkedOn: '2026-10-25', note: 'The CPSC recall list is not available here.' };
    setup(jest.fn(async () => ok({ kind: 'receipt', store: 'Made-up Baby Mart', items: [{ productName: 'Bottle', recall }] })));
    choose(/^A receipt/);
    pick();
    await screen.findByRole('article', { name: /Receipt · 1 item/ });
    expect(screen.getByTestId('recall-unchecked').textContent).toMatch(/Not checked for recalls/);
    expect(document.body.textContent).not.toMatch(/No recalls found/);
  });

  it('a possible recall is shown as a warning with the notice link', async () => {
    const recall = { found: true, source: 'NHTSA' as const, recordsChecked: 69, checkedOn: '2026-10-25', matches: [{ id: 'n1', title: 'NHTSA recall 15C004000', recallDate: '2015-09-01', url: 'https://www.nhtsa.gov/recalls?nhtsaId=15C004000', summary: '' }] };
    setup(jest.fn(async () => ok({ items: [{ ...GRACO, recall }] })));
    choose(/^Gear/);
    pick();
    expect((await screen.findByTestId('recall-found')).textContent).toMatch(/Possible recall/);
  });

  it('an unreadable gear photo says exactly "We couldn\'t find a model number. Try the white label." and offers Try again', async () => {
    setup(jest.fn(async () => ({ status: 'needs_clearer_photo', message: NO_MODEL }) as PhotoReadResponse));
    choose(/^Gear/);
    pick();
    const box = await screen.findByTestId('photo-problem');
    expect(box.textContent).toContain("We couldn't find a model number. Try the white label.");
    expect(box.textContent).toContain('We never guess a model, so nothing was saved.');
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(screen.getByTestId('gear-tip')).toBeTruthy();
  });

  it('shows the server\'s plain message for other problems and saves nothing', async () => {
    setup(jest.fn(async () => ({ status: 'rejected', message: 'That does not look like a baby item.' }) as PhotoReadResponse));
    choose(/^A receipt/);
    pick();
    expect((await screen.findByTestId('photo-problem')).textContent).toContain('That does not look like a baby item.');
  });

  it('turns a network error into a plain message', async () => {
    setup(jest.fn(async () => { throw new Error('Could not read that photo. Please try again.'); }));
    choose(/^Gear/);
    pick();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Could not read that photo. Please try again.'));
  });

  it('rejects a file that is not a photo before anything is sent', () => {
    const send = jest.fn();
    const deps = setup(send);
    choose(/^Gear/);
    pick(new File(['x'], 'notes.pdf', { type: 'application/pdf' }));
    expect(screen.getByRole('alert').textContent).toMatch(/choose a photo/i);
    expect(deps.prepare).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('closes with Cancel and with Escape', () => {
    setup(jest.fn());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByText('open'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

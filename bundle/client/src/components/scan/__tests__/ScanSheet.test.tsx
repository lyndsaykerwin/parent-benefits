import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import ScanSheet, { GEAR_TIP, NO_MODEL, type ScanDeps } from '../ScanSheet';
import { ScanProvider, useScan } from '../ScanContext';
import type { PhotoReadResponse } from '@/lib/photoPrep';
import { CAPTURE_TIP } from '../photoJob';
import { GearLockerView } from '../GearLocker';

afterEach(cleanup);

const GRACO = {
  productName: 'Graco infant car seat (sample)', brand: 'Graco', modelNumber: 'SAMPLE-1042', upc: '012345678905',
  recall: { found: false as const, source: 'NHTSA' as const, recordsChecked: 69, checkedOn: '2026-10-25', registerUrl: 'https://www.gracobaby.com/product-registration' },
};
const ok = (over: Partial<Extract<PhotoReadResponse, { status: 'ok' }>> = {}): PhotoReadResponse => ({ status: 'ok', rounds: 1, stored: 1, kind: 'item', items: [GRACO], ...over });

function Opener() { const { openScan } = useScan(); return <button onClick={openScan}>open</button>; }
function setup(send: ScanDeps['send'], extra: Partial<ScanDeps> = {}) {
  const deps: ScanDeps = { prepare: jest.fn(async () => ({ mimeType: 'image/jpeg' as const, imageBase64: 'QUJD', thumbnail: 'data:image/jpeg;base64,QUJD' })), send, ...extra };
  render(<ScanProvider pollMs={5}><Opener /><ScanSheet familyId="maya" deps={deps} /></ScanProvider>);
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

/** A fetch stand-in: each URL pattern answers from a list (the last answer repeats). */
function fakeFetch(routes: [RegExp, unknown[]][]) {
  const seen = new Map<RegExp, number>();
  const f = jest.fn(async (url: string) => {
    const hit = routes.find(([re]) => re.test(String(url)));
    if (!hit) return { ok: false, status: 404, json: async () => ({}) };
    const i = seen.get(hit[0]) ?? 0; seen.set(hit[0], i + 1);
    const body = hit[1][Math.min(i, hit[1].length - 1)];
    return { ok: true, status: 200, json: async () => body };
  });
  (global as any).fetch = f;
  return f;
}

describe('Lane C: examples and background reading', () => {
  afterEach(() => { delete (global as any).fetch; });

  it('gear capture shows the two made-up example labels with exactly what to capture', () => {
    setup(jest.fn());
    choose(/^Gear/);
    expect(screen.getByTestId('capture-tip').textContent).toBe(CAPTURE_TIP);
    expect(CAPTURE_TIP).toBe('Find the white sticker under the seat with the model number and date made.');
    const imgs = within(screen.getByTestId('example-labels')).getAllByRole('img');
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual(['/api/photo/examples/car-seat', '/api/photo/examples/stroller']);
    expect(imgs[1].getAttribute('alt')).toMatch(/model number TM-ST200, date of manufacture 2026\/03\/14, lot 0314A/);
  });

  it('"Try this example" sends the example label like a photo', async () => {
    const send = jest.fn(async () => ok());
    const loadExample = jest.fn(async () => new File(['x'], 'car-seat.png', { type: 'image/png' }));
    setup(send, { loadExample });
    choose(/^Gear/);
    fireEvent.click(screen.getAllByRole('button', { name: 'Try this example' })[0]);
    await screen.findByRole('article', { name: /Graco infant car seat/ });
    expect(loadExample).toHaveBeenCalledWith('/api/photo/examples/car-seat');
  });

  it('a slow read says "we\'re reading your photo" at once, then shows the result when the background read is done', async () => {
    fakeFetch([[/\/api\/photo\/status\/7/, [
      { photoId: 7, kind: 'item', status: 'reading', message: null, thumbnail: null, canRetry: false },
      { photoId: 7, kind: 'item', status: 'done', message: null, thumbnail: null, canRetry: false, result: { status: 'ok', kind: 'item', stored: 1, items: [{ ...GRACO, manufacturedOn: '2026-02-09', lotCode: 'CS0209B' }] } },
    ]]]);
    setup(jest.fn(async () => ({ status: 'reading' as const, photoId: 7, message: "Thanks! We're reading your photo." })));
    choose(/^Gear/);
    pick();
    expect((await screen.findByTestId('scan-started')).textContent).toMatch(/We're reading your photo/);
    const card = await screen.findByRole('article', { name: /Graco infant car seat/ });
    expect(card.textContent).toMatch(/Made 2026-02-09/);
    expect(card.textContent).toMatch(/Lot CS0209B/);
  });

  it('a background read that stops shows its plain message and a working "Try again"', async () => {
    const f = fakeFetch([
      [/\/api\/photo\/status\/8/, [{ photoId: 8, kind: 'item', status: 'failed', message: 'We had trouble reading that photo just now. Please try again in a minute.', thumbnail: null, canRetry: true }]],
      [/\/api\/photo\/retry/, [{ status: 'reading' }]],
    ]);
    f.mockImplementation(async (url: string) => /retry/.test(url)
      ? { ok: true, status: 202, json: async () => ({}) }
      : { ok: true, status: 200, json: async () => ({ photoId: 8, kind: 'item', status: 'failed', message: 'We had trouble reading that photo just now. Please try again in a minute.', thumbnail: null, canRetry: true }) });
    setup(jest.fn(async () => ({ status: 'reading' as const, photoId: 8, message: 'Thanks!' })));
    choose(/^Gear/);
    pick();
    expect((await screen.findByTestId('photo-problem')).textContent).toMatch(/trouble reading/);
    expect(screen.getByTestId('photo-problem').textContent).not.toMatch(/clearer/);
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    await waitFor(() => expect(f.mock.calls.some(([u]) => /\/api\/photo\/retry/.test(String(u)))).toBe(true));
  });
});

describe('Lane C: the Gear Locker shows "Reading…" and then the item', () => {
  afterEach(() => { cleanup(); delete (global as any).fetch; });
  it('shows a Reading… tile while the photo is read, then the item once done', async () => {
    let done = false;
    (global as any).fetch = jest.fn(async (url: string) => {
      if (/\/photos$/.test(url)) return { ok: true, status: 200, json: async () => ({ photos: done ? [] : [{ photoId: 3, kind: 'item', status: 'reading', message: null, thumbnail: null, canRetry: false }] }) };
      if (/\/gear$/.test(url)) return { ok: true, status: 200, json: async () => ({ items: done ? [{ id: 1, productName: 'Zooblefern infant car seat', brand: 'Zooblefern', modelNumber: 'ZF-CS100', manufacturedOn: '2026-02-09', lotCode: 'CS0209B', recall: null }] : [], receipts: [] }) };
      return { ok: false, status: 404, json: async () => ({}) };
    });
    function Bump() { const { bump } = useScan(); return <button onClick={bump}>reload</button>; }
    render(<ScanProvider><Bump /><GearLockerView familyId="maya" /></ScanProvider>);
    expect((await screen.findByTestId('photo-reading')).textContent).toMatch(/Reading…/);
    expect(screen.queryByTestId('locker-empty')).toBeNull();
    done = true;
    fireEvent.click(screen.getByText('reload'));
    expect(await screen.findByText('Zooblefern infant car seat')).toBeTruthy();
    expect(screen.getByText(/Made 2026-02-09 · Lot CS0209B/)).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('photo-reading')).toBeNull());
  });
});

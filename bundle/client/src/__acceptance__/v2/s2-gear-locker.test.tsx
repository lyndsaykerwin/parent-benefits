// Story 2: Gear scan and Gear Locker (plans/v2-build-plan.md, section 1 rulings 7 and 9, round 3 R7, and section 5).
import { screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { fakeServer, callsTo, goTab, mayaRun, showVersionB } from './helpers';

// The phone's photo redraw needs a real canvas, which the test browser does not have: replace only that step.
jest.mock('@/lib/photoPrep', () => ({
  ...jest.requireActual('@/lib/photoPrep'),
  preparePhoto: jest.fn(async () => ({ mimeType: 'image/jpeg', imageBase64: 'QUJD' })),
}));

afterEach(() => { cleanup(); try { sessionStorage.clear(); localStorage.clear(); } catch { /* ignore */ } });

// Fictional example item (model number is an example, not a confirmed real model).
const GRACO = {
  productName: 'Graco SnugRide 35 Lite infant car seat', brand: 'Graco', modelNumber: '2120349', upc: '047406173005',
  recall: { found: false, source: 'NHTSA', recordsChecked: 69, checkedOn: '2026-10-25', registerUrl: 'https://www.gracobaby.com/product-registration' },
};
// Fictional receipt: three items from one store visit, plus the saved thumbnail of the receipt photo.
const THUMB = 'data:image/jpeg;base64,QUJD';
const RECEIPT_ITEMS = [
  { productName: 'Frida Baby NoseFrida', brand: 'Frida Baby', fsaEligible: true, recall: { found: false, source: 'CPSC', recordsChecked: 10058, checkedOn: '2026-10-25' } },
  { productName: 'Infant digital thermometer', brand: 'Safety 1st', fsaEligible: true, recall: { found: false, source: 'CPSC', recordsChecked: 10058, checkedOn: '2026-10-25' } },
  { productName: 'Newborn diapers, 84 count', brand: 'Pampers', fsaEligible: false, recall: { found: false, source: 'CPSC', recordsChecked: 10058, checkedOn: '2026-10-25' } },
];
const RECEIPT = { photoId: 'ph-1', kind: 'receipt', store: 'Target', purchasedOn: '2026-10-20', itemCount: 3, thumbnail: THUMB, items: RECEIPT_ITEMS };

/** Opens the scan sheet from the Home card and picks what is being scanned. */
function openScan(choice: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: /Scan gear or a receipt/i }));
  const sheet = screen.getByRole('dialog', { name: /What are you scanning\?/i });
  expect(within(sheet).getByRole('button', { name: /^Gear/ })).toBeTruthy();
  expect(within(sheet).getByRole('button', { name: /^A receipt/ })).toBeTruthy();
  fireEvent.click(within(sheet).getByRole('button', { name: choice }));
  return sheet;
}
const pickPhoto = (sheet: HTMLElement, name: string) =>
  fireEvent.change(within(sheet).getByLabelText('Take or choose a photo', { selector: 'input' }), { target: { files: [new File(['x'], name, { type: 'image/jpeg' })] } });

/** "See your gear locker →" at the end of a scan result, drawn as a link or a button. */
const findLockerLink = () => waitFor(() =>
  screen.queryByRole('link', { name: /See your gear locker/i }) ?? screen.getByRole('button', { name: /See your gear locker/i }));

describe('S2: the Home scan button leads to an honest recall result and the Gear Locker', () => {
  // S2 — "Home has a 'Scan gear or a receipt' button. It opens 'What are you scanning?' with 'Gear' and 'A receipt'.
  // The gear camera view shows the framing tip ('Tip: frame the white manufacturer label or barcode sticker…').
  // A gear photo with no recall shows 'No recalls found' (never 'Verified Safe') with the model, UPC, how many official
  // recalls it was checked against (NHTSA for car seats) and a 'Register it with Graco' link, then
  // 'See your gear locker' leads to the Gear Locker with the item in it."
  it('Gear: shows "No recalls found", then "See your gear locker" lands on the locker with the item', async () => {
    const server = fakeServer([
      [/\/api\/photo\/read$/, () => ({ status: 'ok', rounds: 1, stored: 1, kind: 'item', items: [GRACO] })],
      [/gear|purchase|items/i, () => ({ items: [GRACO], receipts: [] })],
      [/memory/i, () => ({ family: [], learned: [] })],
    ]);
    showVersionB(mayaRun());

    const sheet = openScan(/^Gear/);
    expect(sheet.textContent).toMatch(/point at the sticker on the bottom of the car seat/i);
    // R7 framing tip, so the AI can read the label
    expect(within(sheet).getByText(/white manufacturer label/i)).toBeTruthy();
    pickPhoto(sheet, 'seat.jpg');
    await waitFor(() => expect(callsTo(server, /\/api\/photo\/read$/)).toHaveLength(1));
    expect(callsTo(server, /\/api\/photo\/read$/)[0].body).toEqual(expect.objectContaining({ kind: 'item' }));

    const result = await screen.findByRole('article', { name: /Graco SnugRide 35 Lite/ });
    expect(within(result).getByText(/No recalls found/)).toBeTruthy();
    expect(within(result).getByText(/Model 2120349/)).toBeTruthy();
    expect(within(result).getByText(/UPC 047406173005/)).toBeTruthy();
    expect(within(result).getByText(/69 NHTSA car-seat recalls/)).toBeTruthy();
    expect(within(result).getByRole('link', { name: /Register it with Graco/ })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Verified Safe/i);

    fireEvent.click(await findLockerLink());
    const locker = await screen.findByRole('region', { name: /Gear locker/i });
    expect(within(locker).getByText(/Graco SnugRide 35 Lite/)).toBeTruthy();
  });

  // S2 — "A receipt photo is read for money back and recalls; the Gear Locker then shows the receipt as one entry,
  // with a small picture (thumbnail) of the receipt and 'Receipt · N items'."
  it('Savings: a clean scan is still shown as inspected gear (name, model, UPC, "No recalls found"), never swallowed', async () => {
    fakeServer([
      [/gear|purchase|items/i, () => ({ items: [GRACO, { productName: 'Mystery bouncer', brand: 'Acme', recall: { found: null } }], receipts: [] })],
      [/memory/i, () => ({ family: [], learned: [] })],
    ]);
    showVersionB(mayaRun());
    goTab('Savings');
    const rows = await screen.findAllByTestId('inspected-item');
    expect(rows[0].textContent).toMatch(/Graco SnugRide 35 Lite/);
    expect(rows[0].textContent).not.toMatch(/Graco Graco/);
    expect(rows[0].textContent).toMatch(/Model: 2120349 · UPC: 047406173005/);
    expect(within(rows[0]).getByTestId('no-recalls').textContent).toMatch(/No recalls found/);
    // "could not check" is never shown as "No recalls found"
    expect(within(rows[1]).queryByTestId('no-recalls')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Verified Safe/i);
  });

  it('A receipt: the locker shows a receipt thumbnail and "Receipt · 3 items"', async () => {
    const server = fakeServer([
      [/\/api\/photo\/read$/, () => ({ status: 'ok', rounds: 1, stored: 3, kind: 'receipt', photoId: 'ph-1', thumbnail: THUMB, store: 'Target', items: RECEIPT_ITEMS })],
      [/gear|purchase|items/i, () => ({ items: RECEIPT_ITEMS, receipts: [RECEIPT] })],
      [/memory/i, () => ({ family: [], learned: [] })],
    ]);
    showVersionB(mayaRun());

    const sheet = openScan(/^A receipt/);
    pickPhoto(sheet, 'receipt.jpg');
    await waitFor(() => expect(callsTo(server, /\/api\/photo\/read$/)).toHaveLength(1));
    expect(callsTo(server, /\/api\/photo\/read$/)[0].body).toEqual(expect.objectContaining({ kind: 'receipt' }));

    fireEvent.click(await findLockerLink());
    const locker = await screen.findByRole('region', { name: /Gear locker/i });
    expect(within(locker).getByText(/Receipt\s*·\s*3 items/)).toBeTruthy();
    expect(within(locker).getByRole('img', { name: /receipt/i })).toBeTruthy();
  });
});

// Lane C: every scan entry point opens the same sheet; the locker shows gear and receipts; "Forget" empties it.
import { screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { fakeServer, callsTo, mayaRun, leoRun, showVersionB, goTab } from '@/__acceptance__/v2/helpers';
import { preparePhoto, type PhotoCodec } from '@/lib/photoPrep';

afterEach(() => { cleanup(); try { sessionStorage.clear(); localStorage.clear(); } catch { /* ignore */ } });

const GEAR = { id: 1, photoId: 1, thumbnail: 'data:image/jpeg;base64,QUJD', productName: 'Graco infant car seat (sample)', brand: 'Graco', modelNumber: 'SAMPLE-1042', upc: '012345678905', source: 'photo_item',
  recall: { found: false, source: 'NHTSA', recordsChecked: 69, checkedOn: '2026-10-25', registerUrl: 'https://www.gracobaby.com/product-registration' } };
const RECEIPT = { photoId: 2, kind: 'receipt', store: 'Made-up Baby Mart', purchasedOn: '2026-10-20', itemCount: 3, thumbnail: 'data:image/jpeg;base64,QUJD', items: [] };
const quiet = [/memory/i, () => ({ family: [], learned: [] })] as [RegExp, () => unknown];

const sheetOpen = () => screen.getByRole('dialog', { name: /What are you scanning\?/i });

describe('scan entry points', () => {
  it('the Home card, the header Scan button and Home\'s empty "Money back now" button all open the same sheet', () => {
    fakeServer([quiet]);
    showVersionB(leoRun()); // Leo's run has no money-back cards: the empty bucket shows its button
    fireEvent.click(screen.getByRole('button', { name: /Scan gear or a receipt/i }));
    expect(sheetOpen()).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Scan$/ }));
    expect(sheetOpen()).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: /Add a receipt to find money back/i }));
    expect(sheetOpen()).toBeTruthy();
  });

  it('Savings has its own scan card, and the empty locker has a scan button that opens the sheet', async () => {
    fakeServer([[/gear/, () => ({ items: [], receipts: [] })], quiet]);
    showVersionB(mayaRun());
    goTab('Savings');
    const card = screen.getByTestId('scan-card');
    fireEvent.click(within(card).getByRole('button', { name: /Scan gear or a receipt/i }));
    expect(sheetOpen()).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    const locker = screen.getByTestId('gear-locker-card');
    await within(locker).findByText(/No gear yet/);
    fireEvent.click(within(locker).getByRole('button', { name: /Scan gear or a receipt/i }));
    expect(sheetOpen()).toBeTruthy();
  });
});

describe('the Gear Locker', () => {
  it('opens from the Savings card ("Open ›"), lists gear and a receipt with its thumbnail, and has a Back button', async () => {
    fakeServer([[/gear/, () => ({ items: [GEAR], receipts: [RECEIPT] })], quiet]);
    showVersionB(mayaRun());
    goTab('Savings');
    const card = screen.getByTestId('gear-locker-card');
    await within(card).findByText(/1 item and 1 receipt saved/);
    fireEvent.click(within(card).getByRole('button', { name: /Open/ }));
    const locker = await screen.findByRole('region', { name: /Gear locker/i });
    expect(within(locker).getByText(/Graco infant car seat/)).toBeTruthy();
    expect(within(locker).getByText(/Model SAMPLE-1042/)).toBeTruthy();
    expect(within(locker).getByText(/69 NHTSA car-seat recalls/)).toBeTruthy();
    expect(within(locker).getByText(/Receipt\s*·\s*3 items/)).toBeTruthy();
    expect(within(locker).getByRole('img', { name: /receipt/i }).getAttribute('src')).toMatch(/^data:image\/jpeg/);
    expect(within(locker).getByText(/We strip location data/)).toBeTruthy();
    fireEvent.click(within(locker).getByRole('button', { name: /Back/ }));
    expect(screen.queryByTestId('gear-locker')).toBeNull();
    expect(screen.getByTestId('gear-locker-card')).toBeTruthy(); // back on Savings
  });

  it('"Forget my items" deletes everything on the server and empties the locker', async () => {
    let forgotten = false;
    const server = fakeServer([
      [/photo\/forget$/, () => { forgotten = true; return { deleted: 2 }; }],
      [/gear/, () => (forgotten ? { items: [], receipts: [] } : { items: [GEAR], receipts: [RECEIPT] })],
      quiet,
    ]);
    showVersionB(mayaRun());
    goTab('Savings');
    const card = screen.getByTestId('gear-locker-card');
    fireEvent.click(await within(card).findByRole('button', { name: /Open/ }));
    const locker = await screen.findByRole('region', { name: /Gear locker/i });
    fireEvent.click(within(locker).getByRole('button', { name: 'Forget my items' }));
    fireEvent.click(within(locker).getByRole('button', { name: /Yes, delete them/ }));
    await waitFor(() => expect(callsTo(server, /photo\/forget$/)).toHaveLength(1));
    expect(callsTo(server, /photo\/forget$/)[0].body).toEqual({ familyId: 'maya' });
    await waitFor(() => expect(screen.getByTestId('locker-empty')).toBeTruthy());
  });
});

describe('phone-side photo prep', () => {
  it('also makes a small thumbnail from the same photo, drawn before the full-size redraw closes it', async () => {
    const order: string[] = [];
    const codec: PhotoCodec = {
      decode: async () => ({ width: 4000, height: 3000, source: 'bmp' }),
      thumbnailJpeg: async (_s, w, h) => { order.push(`thumb ${w}x${h}`); return 'data:image/jpeg;base64,VEhVTUI='; },
      redrawAsJpeg: async (_s, w, h) => { order.push(`full ${w}x${h}`); return 'QUJD'; },
    };
    const out = await preparePhoto(new File(['x'], 'p.jpg', { type: 'image/jpeg' }), codec);
    expect(order).toEqual(['thumb 200x150', 'full 1600x1200']);
    expect(out).toEqual({ mimeType: 'image/jpeg', imageBase64: 'QUJD', thumbnail: 'data:image/jpeg;base64,VEhVTUI=' });
  });
  it('still works if the thumbnail cannot be made', async () => {
    const codec: PhotoCodec = {
      decode: async () => ({ width: 800, height: 600, source: 'bmp' }),
      thumbnailJpeg: async () => { throw new Error('no canvas'); },
      redrawAsJpeg: async () => 'QUJD',
    };
    expect(await preparePhoto(new File(['x'], 'p.jpg', { type: 'image/jpeg' }), codec)).toEqual({ mimeType: 'image/jpeg', imageBase64: 'QUJD' });
  });
});

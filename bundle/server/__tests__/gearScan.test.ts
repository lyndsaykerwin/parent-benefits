// Lane C: gear scan and locker. NHTSA car-seat check, saved photos (location data stripped), the Gear Locker route, forget,
// hasItems for typed-in families, and the guest-family recall check. All data here is made up except NHTSA's public recall file.
import express from 'express';
import type { AddressInfo } from 'node:net';
import { TraceLogger } from '../agents/trace';
import type { Generator } from '../adapters/llm';
import { createMemoryPhotoStore, getSharedPhotoStore, resetSharedPhotoStore, type PhotoDeps } from '../ingest/photo';
import { createPhotoRouter } from '../routes/photoRoutes';
import { checkCarSeat, checkCpsc, isCarSeat, loadNhtsaCarSeats, moneyBackFor, registrationUrl } from '../ingest/gearRecall';
import { hasExif, stripJpegMetadata } from '../ingest/imageClean';
import { bodyParsers } from '../middleware/bodyLimit';
import { familyView } from '../routes/bundleRoutes';
import { checkRecalls } from '../agents/recall';
import type { Family } from '../../shared/bundle';

const TODAY = '2026-10-25';

/** A tiny made-up JPEG with an EXIF block (fake GPS text) between the start marker and the picture data. */
function jpegWithExif(extra = 0): Buffer {
  const exif = Buffer.concat([Buffer.from('Exif\0\0'), Buffer.from('GPS 42.36 -71.06 FAKE')]);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.from([(exif.length + 2) >> 8, (exif.length + 2) & 255]), exif]);
  const comment = Buffer.concat([Buffer.from([0xff, 0xfe, 0x00, 0x08]), Buffer.from('secret')]);
  const scan = Buffer.concat([Buffer.from([0xff, 0xda, 0x00, 0x02]), Buffer.alloc(extra + 8, 7), Buffer.from([0xff, 0xd9])]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, comment, scan]);
}
const THUMB = `data:image/jpeg;base64,${jpegWithExif().toString('base64')}`;

const CAR_SEAT = JSON.stringify({
  rejected: null, readText: 'Model SAMPLE-1042 UPC 012345678905 Graco infant car seat', store: null, purchasedOn: null,
  items: [{ productName: 'Graco infant car seat (sample)', brand: 'Graco', modelNumber: 'SAMPLE-1042', lotCode: null, upc: '012345678905', sizeText: null, priceCents: null, quantity: 1 }],
});
const RECEIPT = JSON.stringify({
  rejected: null, readText: 'Made-up Baby Mart 2026-10-20 Infant digital thermometer 12.99 Diapers 24.99', store: 'Made-up Baby Mart', purchasedOn: '2026-10-20',
  items: [
    { productName: 'Infant digital thermometer', brand: null, modelNumber: null, lotCode: null, upc: null, sizeText: null, priceCents: 1299, quantity: 1 },
    { productName: 'Newborn diapers', brand: null, modelNumber: null, lotCode: null, upc: null, sizeText: null, priceCents: 2499, quantity: 1 },
  ],
});
const vision = (answer: string): Generator => ({ async generate() { throw new Error('no'); }, async see() { return answer; } });

async function withApp(deps: PhotoDeps, fn: (url: string) => Promise<void>, extra: Partial<Parameters<typeof createPhotoRouter>[0]> = {}) {
  const app = express();
  app.use(...bodyParsers()); // the real size limits (100 KB everywhere except the photo route)
  app.use(createPhotoRouter({ makeDeps: () => deps, now: () => new Date(`${TODAY}T12:00:00Z`), ...extra }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  try { await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); } finally { server.close(); }
}
const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const jpegBody = (kind: 'item' | 'receipt', over: object = {}, bytes = jpegWithExif()) =>
  ({ familyId: 'guest-ab12cd34', kind, mimeType: 'image/jpeg', imageBase64: bytes.toString('base64'), thumbnail: THUMB, ...over });
const mkDeps = (answer: string): PhotoDeps => ({ gen: vision(answer), store: createMemoryPhotoStore(), sampleMode: false, cacheDir: '/nonexistent', trace: new TraceLogger('gear-test', '/tmp/gear-test-logs'), env: {} });

describe('NHTSA car-seat file', () => {
  it('holds the 69 child-seat recalls', () => {
    expect(loadNhtsaCarSeats()).toHaveLength(69);
  });
  it('a made-up seat that is not on the list gets a real "No recalls found" against 69', () => {
    const r = checkCarSeat({ productName: 'Graco infant car seat (sample)', brand: 'Graco', modelNumber: 'SAMPLE-1042', upc: '012345678905' }, TODAY);
    expect(r).toMatchObject({ found: false, source: 'NHTSA', recordsChecked: 69, checkedOn: TODAY });
  });
  it('a model number listed only in the recall summary is found (judge sample: Britax Advocate 70 G3, E9LJ91A, NHTSA 12C004000)', () => {
    const r = checkCarSeat({ productName: 'Advocate 70 G3 Convertible Car Seat', brand: 'BRITAX', modelNumber: 'E9LJ91A', upc: null, manufacturedOn: '2012-03-15' }, TODAY);
    expect(r.found).toBe(true);
    expect(r.matches?.map((m) => m.id)).toContain('nhtsa-12C004000');
    // a different Britax number that is not in any summary is still "No recalls found"
    expect(checkCarSeat({ productName: 'Advocate 70 G3 Convertible Car Seat', brand: 'BRITAX', modelNumber: 'Z1ZZ99Q', upc: null }, TODAY).found).toBe(false);
  });
  it('a seat that IS on the list is found, with the campaign number', () => {
    const row = loadNhtsaCarSeats().find((x) => x.brands.includes('Graco') && x.models.some((m) => m.split(/\s+/).filter((w) => w.length >= 3).length >= 2))!;
    const model = row.models.find((m) => m.split(/\s+/).filter((w) => w.length >= 3).length >= 2)!;
    const r = checkCarSeat({ productName: `Graco ${model.toLowerCase()}`, brand: 'Graco', modelNumber: null, upc: null }, TODAY);
    expect(r.found).toBe(true);
    expect(r.matches?.some((m) => m.id === `nhtsa-${row.campaignNumber}`)).toBe(true);
  });
  it('knows a car seat from a stroller or an adapter', () => {
    expect(isCarSeat({ productName: 'Graco SnugRide infant car seat' })).toBe(true);
    expect(isCarSeat({ productName: 'Baby Jogger car seat adapter' })).toBe(false);
    expect(isCarSeat({ productName: 'Umbrella stroller' })).toBe(false);
  });
  it('registration link: Graco has its own page, other brands get a search, no brand gets none', () => {
    expect(registrationUrl('Graco')).toBe('https://www.gracobaby.com/product-registration');
    expect(registrationUrl('Acme Baby')).toMatch(/search\?q=Acme%20Baby/);
    expect(registrationUrl(null)).toBeNull();
  });
});

describe('CPSC check (through Zetaris)', () => {
  const item = { productName: 'Acme baby bouncer', brand: 'Acme', modelNumber: null, upc: null };
  it('says it could not check, never "no recalls", when no list is reachable', async () => {
    const { checkItemRecall } = await import('../ingest/gearRecall');
    expect(await checkItemRecall(item, TODAY, null)).toMatchObject({ found: null, source: 'CPSC', recordsChecked: null });
    const broken = { runQuery: async () => { throw new Error('down'); } };
    expect(await checkItemRecall(item, TODAY, broken)).toMatchObject({ found: null });
  });
  it('reports the real count of CPSC recalls it asked about', async () => {
    const z = { runQuery: async (sql: string) => ({ rows: /count\(\*\)/.test(sql) ? [{ n: 10058 }] : [] }) };
    expect(await checkCpsc(item, TODAY, z)).toMatchObject({ found: false, source: 'CPSC', recordsChecked: 10058 });
  });
  it('only brand words reach the SQL', async () => {
    const seen: string[] = [];
    await checkCpsc({ ...item, brand: "Acme'; DROP TABLE x;--" }, TODAY, { runQuery: async (sql) => { seen.push(sql); return { rows: [{ n: 1 }] }; } });
    expect(seen.join(' ')).not.toMatch(/DROP TABLE|';/);
  });
});

describe('money back on a receipt line', () => {
  it('flags FSA/HSA-eligible things by the shared keyword list, and only those', () => {
    expect(moneyBackFor('Infant digital thermometer')).toMatchObject({ fsaEligible: true });
    expect(moneyBackFor('Newborn diapers, 84 count')).toEqual({ fsaEligible: false });
  });

  it('understands the short forms shops print on receipts', () => {
    for (const line of ['INFANT DIGITAL THERMO', 'BABY THERM DIGITAL', 'DIG THERMOMTR', 'THERMOMETERS 2PK']) {
      expect({ line, ...moneyBackFor(line) }).toMatchObject({ line, fsaEligible: true, fsaCategory: 'Baby thermometer', fsaAccount: 'FSA' });
    }
    expect(moneyBackFor('NASAL ASPRTR BABY')).toMatchObject({ fsaEligible: true, fsaCategory: 'Nasal aspirator' });
    expect(moneyBackFor('BABY NASAL ASPIRATOR')).toMatchObject({ fsaEligible: true, fsaCategory: 'Nasal aspirator' });
    expect(moneyBackFor('SALINE NASAL DROPS')).toMatchObject({ fsaEligible: true, fsaCategory: 'Nasal saline drops' });
    expect(moneyBackFor('INFANT GAS DROPS')).toMatchObject({ fsaEligible: true, fsaCategory: 'Infant gas relief' });
    expect(moneyBackFor('NURSING PAD 60CT')).toMatchObject({ fsaEligible: true, fsaCategory: 'Nursing supplies' });
    expect(moneyBackFor('TYLENOL INFANT SUSP')).toMatchObject({ fsaEligible: true, fsaCategory: 'Infant pain reliever' });
  });

  it('does not stretch a short form into a false match', () => {
    for (const line of [
      'THERMAL BLANKET',        // "thermal" is not a thermometer
      'THERMOS BOTTLE',         // a drinks flask
      'SALT AND PEPPER',        // not saline
      'SUN HAT',                // not sunscreen
      'GAS STATION SNACK',      // one word of "gas drops" is not enough
      'BREAST MILK STORAGE BAGS', // one word of "breast pump" is not enough
      'NURSING PILLOW',         // not nursing pads
      'ASPEN CANDLE',           // not an aspirator
      'THE BABY DAYCARE BOOK',  // daycare is a Dependent Care FSA cost, not a health FSA/HSA item
      'Newborn diapers, 84 count',
      '',
    ]) {
      expect({ line, ...moneyBackFor(line) }).toEqual({ line, fsaEligible: false });
    }
  });
});

describe('location data is stripped', () => {
  it('removes EXIF and comments and keeps the picture data', () => {
    const src = jpegWithExif(50);
    expect(hasExif(src)).toBe(true);
    const out = stripJpegMetadata(src);
    expect(hasExif(out)).toBe(false);
    expect(out.toString('latin1')).not.toMatch(/GPS|Exif|secret/);
    expect(out.length).toBeLessThan(src.length);
    expect(out.subarray(-2)).toEqual(Buffer.from([0xff, 0xd9]));
  });
  it('refuses a file that is not a JPEG', () => {
    expect(() => stripJpegMetadata(Buffer.from('hello world'))).toThrow();
  });
});

describe('POST /api/photo/read and the Gear Locker', () => {
  it('gear: checks the recall straight from the photo, saves only the thumbnail, and lists it in the locker (even for a typed-in family)', async () => {
    const deps = mkDeps(CAR_SEAT);
    await withApp(deps, async (url) => {
      const j = await (await post(`${url}/api/photo/read`, jpegBody('item'))).json();
      expect(j).toMatchObject({ status: 'ok', kind: 'item', stored: 1, sample: false });
      expect(j.items[0].recall).toMatchObject({ found: false, source: 'NHTSA', recordsChecked: 69, checkedOn: TODAY, registerUrl: 'https://www.gracobaby.com/product-registration' });
      const photos = await deps.store.listPhotos('guest-ab12cd34');
      expect(photos).toHaveLength(1);
      expect(photos[0]).toMatchObject({ kind: 'gear', receiptImage: null });
      expect(Buffer.from(photos[0].thumbnail!.split(',')[1], 'base64').toString('latin1')).not.toMatch(/GPS|Exif/);
      const locker = await (await fetch(`${url}/api/families/guest-ab12cd34/gear`)).json();
      expect(locker.items).toHaveLength(1);
      expect(locker.items[0]).toMatchObject({ productName: 'Graco infant car seat (sample)', modelNumber: 'SAMPLE-1042', thumbnail: photos[0].thumbnail });
      expect(locker.items[0].recall.found).toBe(false);
      expect(locker.receipts).toEqual([]);
    });
  });

  it('receipt: money-back check on each line, the picture saved without location data, one locker entry "N items"', async () => {
    const deps = mkDeps(RECEIPT);
    await withApp(deps, async (url) => {
      const j = await (await post(`${url}/api/photo/read`, jpegBody('receipt', { familyId: 'maya' }))).json();
      expect(j).toMatchObject({ status: 'ok', kind: 'receipt', store: 'Made-up Baby Mart', stored: 2 });
      expect(j.items.map((i: any) => i.fsaEligible)).toEqual([true, false]);
      expect(j.items[0].recall).toMatchObject({ found: null, source: 'CPSC' }); // no Zetaris here: honest "not checked"
      const [photo] = await deps.store.listPhotos('maya');
      expect(photo.kind).toBe('receipt');
      expect(Buffer.from(photo.receiptImage!.split(',')[1], 'base64').toString('latin1')).not.toMatch(/GPS|Exif|secret/);
      const locker = await (await fetch(`${url}/api/families/maya/gear`)).json();
      expect(locker.items).toEqual([]);
      expect(locker.receipts).toHaveLength(1);
      expect(locker.receipts[0]).toMatchObject({ kind: 'receipt', store: 'Made-up Baby Mart', itemCount: 2, photoId: photo.id });
      expect(locker.receipts[0].thumbnail).toMatch(/^data:image\/jpeg;base64,/);
    });
  });

  it('a receipt line uses Zetaris for CPSC when it is reachable', async () => {
    const z = { runQuery: async (sql: string) => ({ rows: /count\(\*\)/.test(sql) ? [{ n: 10058 }] : [] }) };
    await withApp(mkDeps(RECEIPT), async (url) => {
      const j = await (await post(`${url}/api/photo/read`, jpegBody('receipt'))).json();
      expect(j.items[0].recall).toMatchObject({ found: false, source: 'CPSC', recordsChecked: 10058 });
    }, { recallRunner: () => z });
  });

  it('the same photo twice keeps one picture', async () => {
    const deps = mkDeps(CAR_SEAT);
    await withApp(deps, async (url) => {
      await post(`${url}/api/photo/read`, jpegBody('item'));
      const again = await (await post(`${url}/api/photo/read`, jpegBody('item'))).json();
      expect(again.stored).toBe(0);
      expect(await deps.store.listPhotos('guest-ab12cd34')).toHaveLength(1);
    });
  });

  it('works for a photo over 100 KB (the small global limit stands aside for this route)', async () => {
    const big = jpegWithExif(300_000);
    expect(big.length).toBeGreaterThan(100 * 1024);
    await withApp(mkDeps(CAR_SEAT), async (url) => {
      const res = await post(`${url}/api/photo/read`, jpegBody('item', {}, big));
      expect(res.status).toBe(200);
      expect((await res.json()).status).toBe('ok');
    });
  });

  it('"Forget" deletes the items and the saved pictures', async () => {
    const deps = mkDeps(CAR_SEAT);
    await withApp(deps, async (url) => {
      await post(`${url}/api/photo/read`, jpegBody('item'));
      expect(await deps.store.listPhotos('guest-ab12cd34')).toHaveLength(1);
      const j = await (await post(`${url}/api/photo/forget`, { familyId: 'guest-ab12cd34' })).json();
      expect(j.deleted).toBe(1);
      expect(await deps.store.listPhotos('guest-ab12cd34')).toHaveLength(0);
      expect(await deps.store.listItems('guest-ab12cd34')).toHaveLength(0);
      expect(await (await fetch(`${url}/api/families/guest-ab12cd34/gear`)).json()).toEqual({ items: [], receipts: [] });
    });
  });

  it('a thumbnail that is not a small JPEG is dropped, not stored', async () => {
    const deps = mkDeps(CAR_SEAT);
    await withApp(deps, async (url) => {
      await post(`${url}/api/photo/read`, jpegBody('item', { thumbnail: 'data:text/html;base64,PHNjcmlwdD4=' }));
      expect((await deps.store.listPhotos('guest-ab12cd34'))[0].thumbnail).toBeNull();
    });
  });
});

describe('typed-in families', () => {
  const guest = { id: 'guest-ab12cd34', isGuest: true, dataConnected: false } as Family;
  it('hasItems turns true once the family has saved gear or receipts', () => {
    expect(familyView(guest).hasItems).toBe(false);
    expect(familyView(guest, true).hasItems).toBe(true);
    expect(familyView({ ...guest, id: 'maya', isGuest: false, dataConnected: true } as Family).hasItems).toBe(true);
  });

  it('the recall check is no longer skipped: a guest with saved gear is looked up, and an unreachable list is said plainly, never "all clear"', async () => {
    resetSharedPhotoStore();
    await getSharedPhotoStore().insertItems([{ familyId: guest.id, source: 'photo_item', productName: 'Graco infant car seat (sample)', brand: 'Graco', modelNumber: 'SAMPLE-1042', quantity: 1, confidence: 0.95, extractor: 'test', inputHash: 'h1', lineIndex: 0 }]);
    const lines: { status: string; output_summary: string }[] = [];
    const asked: string[] = [];
    const ctx: any = {
      family: guest,
      z: { runQuery: async (sql: string) => { asked.push(sql); throw new Error('Zetaris is not reachable'); } },
      trace: { log: (l: any) => { lines.push(l); return 't'; } },
    };
    const out = await checkRecalls(ctx);
    expect(asked.length).toBeGreaterThan(0); // it really asked (the old code skipped typed-in families entirely)
    expect(out).toEqual({ candidates: [], itemsChecked: 0 });
    expect(lines.some((l) => l.status === 'fallback' && /not checked/.test(l.output_summary))).toBe(true);
    resetSharedPhotoStore();
  });

  it('a guest with nothing saved still queries nothing', async () => {
    resetSharedPhotoStore();
    const asked: string[] = [];
    const ctx: any = { family: guest, z: { runQuery: async (s: string) => { asked.push(s); return { rows: [] }; } }, trace: { log: () => 't' } };
    await checkRecalls(ctx);
    expect(asked).toEqual([]);
  });
});

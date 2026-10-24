import fs from 'fs';
import path from 'path';
import { parseAmazonCsv, parseAmazonCsvWithStats } from '../ingest/amazonCsv';
import { loadPurchaseItems, mapPurchaseReceipt } from '../ingest/purchaseItems';

const CSV = fs.readFileSync(path.resolve(process.cwd(), 'data/sample/amazon-orders.csv'), 'utf8');
const dataLines = CSV.trim().split(/\r?\n/).length - 1;

describe('parseAmazonCsv', () => {
  it('parses the fixture into rows with integer priceCents', () => {
    const rows = parseAmazonCsv(CSV, 'maya');
    expect(rows.length).toBe(dataLines);
    for (const r of rows) {
      expect(Number.isInteger(r.priceCents)).toBe(true);
      expect(r.familyId).toBe('maya');
    }
    expect(rows[0]).toMatchObject({ orderDate: '2026-09-10', priceCents: 8999, asin: 'B0KEAWIS01' });
  });

  it('skips and counts a malformed line', () => {
    const bad = CSV.trim() + '\nmaya-ord-99,maya,not-a-date,"Broken row",B0BAD,,abc\n';
    const { rows, skipped } = parseAmazonCsvWithStats(bad, 'maya');
    expect(rows.length).toBe(dataLines);
    expect(skipped).toBe(1);
  });

  it('accepts the Amazon export column names', () => {
    const csv = 'Order Date,Product Name,ASIN,Unit Price\n2026-10-01,"Diapers, size 1",B0DIAPER01,$24.50\n';
    const [r] = parseAmazonCsv(csv, 'x');
    expect(r).toMatchObject({ title: 'Diapers, size 1', asin: 'B0DIAPER01', priceCents: 2450, orderDate: '2026-10-01' });
  });
});

describe('id uniqueness and guards', () => {
  it('gives unique ids to lines sharing an Order ID', () => {
    const csv = 'Order ID,Order Date,Product Name,ASIN,Unit Price\nA1,2026-10-01,Wipes,B01,5.00\nA1,2026-10-01,Diapers,B02,20.00\n';
    const rows = parseAmazonCsv(csv, 'x');
    expect(rows.length).toBe(2);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2);
  });
  it('throws on an empty familyId', () => {
    expect(() => parseAmazonCsv(CSV, '')).toThrow();
    expect(() => mapPurchaseReceipt({ id: 'r1', familyId: ' ', source: 'photo_receipt', items: [{ productName: 'x' }] })).toThrow();
  });
});

const families: { id: string }[] = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'data/sample/families.json'), 'utf8'));
const CARD_WORDS = /bright horizons|daycare|tuition|groceries|whole foods|kroger|plaid|bank|amzn|mktp/i;

describe('mapPurchaseReceipt', () => {
  const receipt = { id: 'maya-r1', familyId: 'maya', source: 'photo_receipt' as const, store: 'Target', purchasedOn: '2026-10-05', items: [
    { productName: 'Frida baby thermometer', priceCents: 2899 },
    { productName: 'Gripe water', priceCents: 999, quantity: 2, upc: '000000000000' },
  ] };

  it('turns one receipt into one row per line with the same input_hash and a 0-based line_index', () => {
    const rows = mapPurchaseReceipt(receipt);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ familyId: 'maya', source: 'photo_receipt', store: 'Target', purchasedOn: '2026-10-05', productName: 'Frida baby thermometer', priceCents: 2899, quantity: 1, lineIndex: 0 });
    expect(rows[1]).toMatchObject({ lineIndex: 1, quantity: 2 });
    expect(rows[0].inputHash).toBe(rows[1].inputHash);
    expect(rows[0].inputHash).toMatch(/^[0-9a-f]{40,64}$/);
    expect(mapPurchaseReceipt(receipt)[0].inputHash).toBe(rows[0].inputHash); // same receipt, same fingerprint
    expect(mapPurchaseReceipt({ ...receipt, id: 'maya-r2' })[0].inputHash).not.toBe(rows[0].inputHash);
  });

  it('labels every row as made up, never as a real extraction', () => {
    for (const r of mapPurchaseReceipt(receipt)) expect(r.extractor).toBe('sample_fixture');
  });

  it('rejects bad rows instead of guessing: unknown source, empty name, fractional or negative price, bad date', () => {
    const bad = (over: object) => () => mapPurchaseReceipt({ ...receipt, ...over } as any);
    expect(bad({ source: 'plaid' })).toThrow(/source/);
    expect(bad({ items: [{ productName: ' ', priceCents: 1 }] })).toThrow(/productName/);
    expect(bad({ items: [{ productName: 'x', priceCents: 12.5 }] })).toThrow(/priceCents/);
    expect(bad({ items: [{ productName: 'x', priceCents: -100 }] })).toThrow(/priceCents/);
    expect(bad({ purchasedOn: '10/05/2026' })).toThrow(/purchasedOn/);
  });
});

describe('loadPurchaseItems (made-up sample rows, the only purchase source)', () => {
  const rows = loadPurchaseItems();

  it('loads rows that fit the purchase_items table shape', () => {
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(['email', 'barcode', 'photo_item', 'photo_receipt']).toContain(r.source);
      expect(r.productName.trim()).not.toBe('');
      expect(r.inputHash).toBeTruthy();
      expect(Number.isInteger(r.lineIndex)).toBe(true);
      if (r.priceCents !== null && r.priceCents !== undefined) expect(Number.isInteger(r.priceCents) && r.priceCents >= 0).toBe(true);
    }
  });

  it('every row belongs to a sample family that exists, and no (family, input_hash, line_index) repeats', () => {
    const ids = new Set(families.map((f) => f.id));
    for (const r of rows) expect(ids.has(r.familyId)).toBe(true);
    const keys = rows.map((r) => `${r.familyId}|${r.inputHash}|${r.lineIndex}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has no card-style or bank text anywhere: no daycare invoices, groceries or bank lines', () => {
    for (const r of rows) expect(`${r.productName} ${r.store ?? ''} ${r.brand ?? ''}`).not.toMatch(CARD_WORDS);
  });

  it('keeps the planted test cases: thermometer, price-drop playard, recalled KEAWIS mattress, 7 distinct maya items', () => {
    const maya = rows.filter((r) => r.familyId === 'maya');
    const find = (needle: string) => maya.find((r) => r.productName.toLowerCase().includes(needle));
    expect(find('thermometer')).toMatchObject({ store: 'Target', priceCents: 2899, purchasedOn: '2026-10-05' });
    expect(find("pack 'n play")).toMatchObject({ store: 'Target', priceCents: 8999, purchasedOn: '2026-10-09' });
    expect(find('keawis')).toBeDefined();
    expect(new Set(maya.map((r) => r.productName.toLowerCase())).size).toBe(7);
  });

  it('gives ava her infant-medicine line (an FSA money-back card) and leo nothing', () => {
    expect(rows.some((r) => r.familyId === 'ava' && /infant tylenol/i.test(r.productName) && r.priceCents === 1458)).toBe(true);
    expect(rows.some((r) => r.familyId === 'leo')).toBe(false);
  });

  it('has no refund lines and no duplicate listings (the receipt-line dedupe lives in the table)', () => {
    expect(rows.every((r) => (r.priceCents ?? 0) >= 0)).toBe(true);
    const seen = new Set<string>();
    for (const r of rows) {
      const k = `${r.familyId}|${r.store}|${r.purchasedOn}|${r.productName}|${r.priceCents}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });
});

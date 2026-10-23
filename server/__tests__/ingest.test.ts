import fs from 'fs';
import path from 'path';
import { parseAmazonCsv, parseAmazonCsvWithStats } from '../ingest/amazonCsv';
import { mapPlaidTxn, loadPlaidFixture } from '../ingest/plaid';

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
  it('gives unique fallback ids to identical Plaid lines without ids', () => {
    const t = { amount: 5, merchant_name: 'Target', date: '2026-10-10' };
    expect(mapPlaidTxn(t, 'x', 0).id).not.toBe(mapPlaidTxn(t, 'x', 1).id);
  });
  it('throws on an empty familyId', () => {
    expect(() => parseAmazonCsv(CSV, '')).toThrow();
    expect(() => mapPlaidTxn({ amount: 1, date: '2026-10-10' }, '')).toThrow();
  });
});

describe('mapPlaidTxn', () => {
  it('maps dollars to integer cents and prefers merchant_name', () => {
    const t = mapPlaidTxn({ amount: 28.99, merchant_name: 'Target', date: '2026-10-10' }, 'maya');
    expect(t.amountCents).toBe(2899);
    expect(t.merchant).toBe('Target');
    expect(t.familyId).toBe('maya');
  });

  it('loads the fixture with refunds as negative cents', () => {
    const rows = loadPlaidFixture();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.amountCents < 0)).toBe(true);
    expect(rows.every((r) => Number.isInteger(r.amountCents))).toBe(true);
  });
});

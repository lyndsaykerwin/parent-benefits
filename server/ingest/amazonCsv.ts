// Parses an Amazon order-history CSV. Understands both Bundle's sample columns
// (order_id, order_date, title, asin, upc, price) and Amazon's export names
// (Order Date, Product Name, ASIN, Unit Price). Bad lines are skipped and counted.
import type * as s from '../../shared/schema';

export type AmazonOrderRow = typeof s.amazonOrders.$inferInsert;

const ALIASES: Record<string, string[]> = {
  id: ['order_id', 'order id'],
  orderDate: ['order_date', 'order date'],
  title: ['title', 'product name'],
  asin: ['asin', 'asin/isbn'],
  upc: ['upc'],
  price: ['price', 'unit price'],
};

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
    } else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

const ISO = /^\d{4}-\d{2}-\d{2}/;

export function parseAmazonCsvWithStats(csv: string, familyId: string): { rows: AmazonOrderRow[]; skipped: number } {
  const lines = csv.trim().split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return { rows: [], skipped: 0 };
  const header = splitLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (k: string) => header.findIndex((h) => ALIASES[k].includes(h));
  const [iId, iDate, iTitle, iAsin, iUpc, iPrice] = ['id', 'orderDate', 'title', 'asin', 'upc', 'price'].map(idx);
  if (iDate < 0 || iTitle < 0 || iPrice < 0) return { rows: [], skipped: lines.length - 1 };

  const rows: AmazonOrderRow[] = [];
  let skipped = 0;
  lines.slice(1).forEach((line, n) => {
    const c = splitLine(line);
    const date = (c[iDate] ?? '').trim();
    const title = (c[iTitle] ?? '').trim();
    const priceText = (c[iPrice] ?? '').replace(/[$,\s]/g, '');
    const price = /^-?\d+(\.\d+)?$/.test(priceText) ? parseFloat(priceText) : NaN;
    if (!ISO.test(date) || Number.isNaN(Date.parse(`${date.slice(0, 10)}T00:00:00Z`)) || !title || Number.isNaN(price)) {
      skipped++;
      return;
    }
    rows.push({
      id: (iId >= 0 && c[iId]?.trim()) || `${familyId}-amz-${n + 1}`,
      familyId,
      orderDate: date.slice(0, 10),
      title,
      asin: (iAsin >= 0 && c[iAsin]?.trim()) || null,
      upc: (iUpc >= 0 && c[iUpc]?.trim()) || null,
      priceCents: Math.round(price * 100),
    });
  });
  return { rows, skipped };
}

export function parseAmazonCsv(csv: string, familyId: string): AmazonOrderRow[] {
  return parseAmazonCsvWithStats(csv, familyId).rows;
}

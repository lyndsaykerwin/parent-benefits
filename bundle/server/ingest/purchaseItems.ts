// Loads the made-up sample receipts in data/sample/purchase-items.json into purchase_items rows.
// purchase_items is the ONLY purchase source the agents use (plan v3 sign-off items 8 and 9): the old card-style
// (Plaid-shaped) rows and the Amazon order file are no longer read by any agent. Every row here is made up.
import fs from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import type * as s from '../../shared/schema';

export type PurchaseItemRow = typeof s.purchaseItems.$inferInsert;

export const PURCHASE_SOURCES = ['email', 'barcode', 'photo_item', 'photo_receipt'] as const;
type Source = (typeof PURCHASE_SOURCES)[number];

export interface SampleItem {
  productName: string;
  brand?: string | null;
  modelNumber?: string | null;
  lotCode?: string | null;
  upc?: string | null;
  sizeText?: string | null;
  quantity?: number;
  /** What the family paid for this line, in cents. */
  priceCents?: number | null;
}

/** One made-up receipt (or item photo): its lines share an input_hash, each with its own line_index. */
export interface SampleReceipt {
  /** Stable label, e.g. "maya-target-2026-10-05". Hashed into input_hash. */
  id: string;
  familyId: string;
  source: Source;
  store?: string | null;
  seller?: string | null;
  purchasedOn?: string | null;
  items: SampleItem[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function mapPurchaseReceipt(r: SampleReceipt): PurchaseItemRow[] {
  if (!r.familyId || !r.familyId.trim()) throw new Error('familyId is required');
  if (!PURCHASE_SOURCES.includes(r.source)) throw new Error(`unknown source "${r.source}"`);
  if (r.purchasedOn != null && !ISO_DATE.test(r.purchasedOn)) throw new Error(`purchasedOn must be YYYY-MM-DD: ${r.purchasedOn}`);
  if (!r.items?.length) throw new Error(`receipt ${r.id} has no items`);
  const inputHash = createHash('sha256').update(`${r.familyId}|${r.source}|${r.id}`).digest('hex');
  return r.items.map((it, lineIndex) => {
    if (!it.productName || !it.productName.trim()) throw new Error(`productName is required (receipt ${r.id}, line ${lineIndex})`);
    if (it.priceCents != null && (!Number.isInteger(it.priceCents) || it.priceCents < 0)) {
      throw new Error(`priceCents must be a whole number of cents, zero or more (receipt ${r.id}, line ${lineIndex})`);
    }
    return {
      familyId: r.familyId,
      source: r.source,
      store: r.store ?? null,
      seller: r.seller ?? null,
      purchasedOn: r.purchasedOn ?? null,
      productName: it.productName.trim(),
      brand: it.brand ?? null,
      modelNumber: it.modelNumber ?? null,
      lotCode: it.lotCode ?? null,
      upc: it.upc ?? null,
      sizeText: it.sizeText ?? null,
      quantity: it.quantity ?? 1,
      priceCents: it.priceCents ?? null,
      confidence: null,
      // Labels these rows as made-up sample data, never a real photo or email reading.
      extractor: 'sample_fixture',
      inputHash,
      lineIndex,
    };
  });
}

/** Reads the made-up sample receipts (run from the repo root, as npm scripts and jest do). */
export function loadPurchaseItems(dir = path.resolve(process.cwd(), 'data/sample')): PurchaseItemRow[] {
  const raw: { receipts: SampleReceipt[] } = JSON.parse(fs.readFileSync(path.join(dir, 'purchase-items.json'), 'utf8'));
  return raw.receipts.flatMap(mapPurchaseReceipt);
}

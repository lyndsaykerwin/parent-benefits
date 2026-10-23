// Maps Plaid-shaped transactions into Bundle's transactions table shape.
// Live Plaid is "coming soon"; today the sample fixture uses the same mapper.
import fs from 'fs';
import path from 'path';
import type * as s from '../../shared/schema';

export type TransactionRow = typeof s.transactions.$inferInsert;

export interface PlaidTxn {
  transaction_id?: string;
  family_id?: string;
  date: string;
  name?: string;
  merchant_name?: string | null;
  /** Dollars. Plaid's positive amount means money going out. */
  amount: number;
  personal_finance_category?: { primary?: string; detailed?: string } | null;
}

export function mapPlaidTxn(t: PlaidTxn, familyId: string): TransactionRow {
  const amountCents = Math.round(t.amount * 100);
  return {
    id: t.transaction_id ?? `${familyId}-${t.date}-${amountCents}`,
    familyId,
    date: t.date,
    merchant: t.merchant_name || t.name || 'Unknown',
    amountCents,
    category: t.personal_finance_category?.detailed ?? '',
    source: 'fixture',
  };
}

/** Reads the sample Plaid-format file (run from the repo root, as npm scripts and jest do). */
export function loadPlaidFixture(dir = path.resolve(process.cwd(), 'data/sample')): TransactionRow[] {
  const raw: PlaidTxn[] = JSON.parse(fs.readFileSync(path.join(dir, 'plaid-transactions.json'), 'utf8'));
  return raw.map((p) => mapPlaidTxn(p, p.family_id ?? ''));
}

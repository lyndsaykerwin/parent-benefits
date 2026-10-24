/**
 * Schema tests (W1-DB): the plan v3 tables exist with the right columns, are
 * protected by BUNDLE_TABLE_NAMES, have generated setup SQL in migrations/,
 * and (when the local test Postgres is running: `npm run db:test`) the app's
 * real db.ts connects with the standard `pg` driver and can write/read rows.
 */
import fs from 'fs';
import path from 'path';
import { getTableColumns, getTableName, sql } from 'drizzle-orm';
import * as schema from '@shared/schema';

const NEW_TABLES = ['purchase_items', 'offer_checks', 'run_results', 'tax_parameters', 'state_programs'];

function columnNames(table: Parameters<typeof getTableColumns>[0]): string[] {
  return Object.values(getTableColumns(table)).map((c) => c.name);
}

describe('plan v3 tables', () => {
  it('every new table is in BUNDLE_TABLE_NAMES (so db:push may touch it)', () => {
    for (const t of NEW_TABLES) expect(schema.BUNDLE_TABLE_NAMES).toContain(t);
  });

  it('every pgTable in the schema is listed in BUNDLE_TABLE_NAMES', () => {
    const tables = Object.values(schema).filter(
      (v) => v && typeof v === 'object' && Symbol.for('drizzle:Name') in (v as object),
    ) as Parameters<typeof getTableName>[0][];
    for (const t of tables) expect(schema.BUNDLE_TABLE_NAMES).toContain(getTableName(t));
  });

  it('offer_checks has every section 1 field, incl. value + time grade, and no family column', () => {
    const cols = columnNames(schema.offerChecks);
    const required = [
      'offer_id', 'store', 'source_url', 'fine_print_hash', 'checked_at', 'agent', 'model',
      'face_value_cents', 'hidden_cost_cents', 'true_value_cents', 'min_purchase_cents', 'auto_renew', 'renewal_price_cents',
      'deadline_date', 'expired', 'claim_window_days', 'payout_wait_days_max', 'payout_wait_days_min',
      'steps_count', 'effort_level', 'effort_minutes_estimate', 'mail_in', 'needs_receipt', 'needs_phone_call', 'account_required',
      'limited_stock', 'regions_excluded',
      'catch_types', 'verdict', 'status', 'rule_citations', 'catch_summary', 'evidence_quote', 'injection_detected',
      'recall_status', 'recall_ids', 'recall_checked_at',
    ];
    for (const c of required) expect(cols).toContain(c);
    expect(cols.filter((c) => /family|user|zip|name/.test(c) && c !== 'fine_print_hash')).toEqual([]);
  });

  it('purchase_items has section 3 columns plus seller, quantity and input_hash', () => {
    const cols = columnNames(schema.purchaseItems);
    for (const c of ['family_id', 'source', 'store', 'seller', 'purchased_on', 'product_name', 'brand', 'model_number',
      'lot_code', 'upc', 'size_text', 'quantity', 'price_cents', 'confidence', 'extractor', 'input_hash', 'line_index', 'created_at']) {
      expect(cols).toContain(c);
    }
  });

  it('run_results, tax_parameters and state_programs carry their key fields (year + source link per rule row)', () => {
    expect(columnNames(schema.runResults)).toEqual(expect.arrayContaining(['run_id', 'family_id', 'trace_id', 'result', 'created_at']));
    expect(columnNames(schema.taxParameters)).toEqual(expect.arrayContaining(['year', 'code', 'amount_cents', 'source_url']));
    expect(columnNames(schema.statePrograms)).toEqual(expect.arrayContaining(['state', 'year', 'code', 'amount_cents', 'source_url']));
  });

  it('generated setup SQL in migrations/ creates every Bundle table', () => {
    const dir = path.join(__dirname, '..', '..', 'migrations');
    const allSql = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
    for (const t of schema.BUNDLE_TABLE_NAMES) expect(allSql).toContain(`CREATE TABLE "${t}"`);
  });
});

describe('isLocalDatabaseUrl', () => {
  it('treats this machine as local and Neon as remote', async () => {
    // server/db.ts throws on import without DATABASE_URL; no connection is opened here.
    const saved = process.env.DATABASE_URL;
    process.env.DATABASE_URL ??= process.env.TEST_DATABASE_URL ?? 'postgres://bundle:bundle@127.0.0.1:5432/bundle_test';
    const { isLocalDatabaseUrl } = await import('../db');
    if (saved === undefined) delete process.env.DATABASE_URL;
    expect(isLocalDatabaseUrl('postgres://bundle:bundle@127.0.0.1:5432/bundle_test')).toBe(true);
    expect(isLocalDatabaseUrl('postgresql://u:p@localhost/db')).toBe(true);
    expect(isLocalDatabaseUrl('postgresql://u:p@LOCALHOST:5432/db')).toBe(true);
    expect(isLocalDatabaseUrl('postgres://u:p@LocalHost/db')).toBe(true);
    expect(isLocalDatabaseUrl('postgresql://u:p@[::1]:5432/db')).toBe(true);
    expect(isLocalDatabaseUrl('postgresql://u:p@ep-cool-1234.us-east-2.aws.neon.tech/neondb?sslmode=require')).toBe(false);
    expect(isLocalDatabaseUrl('not a url')).toBe(false);
  });
});

// ---- Live local Postgres (skipped with a note when `npm run db:test` hasn't been run) ----
const TEST_URL = process.env.TEST_DATABASE_URL ?? 'postgres://bundle:bundle@127.0.0.1:5432/bundle_test';

async function localDbReady(): Promise<boolean> {
  const { Client } = await import('pg');
  const c = new Client({ connectionString: TEST_URL, connectionTimeoutMillis: 1500 });
  try { await c.connect(); await c.query('select 1 from offer_checks limit 1'); return true; }
  catch { return false; }
  finally { await c.end().catch(() => undefined); }
}

describe('local Postgres through server/db.ts (standard pg driver)', () => {
  let ready = false;
  let dbMod: typeof import('../db') | undefined;
  const savedUrl = process.env.DATABASE_URL;

  beforeAll(async () => {
    ready = await localDbReady();
    if (!ready) { console.warn(`[schema.test] local test Postgres not ready at ${TEST_URL}; run "npm run db:test" to enable live checks`); return; }
    process.env.DATABASE_URL = TEST_URL;
    // The earlier test already imported ../db with a different address; forget that copy so this one uses TEST_URL.
    jest.resetModules();
    dbMod = await import('../db');
  });

  afterAll(async () => {
    if (dbMod) await dbMod.pool.end();
    if (savedUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = savedUrl;
  });

  it('uses the pg driver for a local address', () => {
    if (!ready) return;
    expect(dbMod!.driver).toBe('pg');
  });

  it('writes and reads offer_checks, purchase_items and run_results rows', async () => {
    if (!ready) return;
    const { db } = dbMod!;
    const tag = `test_${Date.now()}`;
    await db.insert(schema.offerChecks).values({
      offerId: tag, store: 'Made-up Store', finePrintHash: 'abc123', agent: 'fact_checker', verdict: 'approve_with_catch',
      status: 'agreed', trueValueCents: 4000, effortMinutesEstimate: 15, stepsCount: 3, payoutWaitDaysMin: 42,
      payoutWaitDaysMax: 56, claimWindowDays: 30, ruleCitations: ['CL-1'], recallStatus: 'none_found',
    });
    const [row] = await db.select().from(schema.offerChecks).where(sql`${schema.offerChecks.offerId} = ${tag}`);
    expect(row.trueValueCents).toBe(4000);
    expect(row.ruleCitations).toEqual(['CL-1']);
    expect(row.catchTypes).toEqual([]);

    // Two different items from the same receipt (same input_hash) are both kept...
    await db.insert(schema.purchaseItems).values({ familyId: tag, source: 'photo_receipt', productName: 'Sample stroller', seller: 'Sample Seller', inputHash: 'h1', lineIndex: 0 });
    await db.insert(schema.purchaseItems).values({ familyId: tag, source: 'photo_receipt', productName: 'Sample wipes', inputHash: 'h1', lineIndex: 1 });
    // ...but the exact same line of the same receipt is rejected.
    await expect(
      db.insert(schema.purchaseItems).values({ familyId: tag, source: 'photo_receipt', productName: 'Sample wipes', inputHash: 'h1', lineIndex: 1 }),
    ).rejects.toThrow();
    const items = await db.select().from(schema.purchaseItems)
      .where(sql`${schema.purchaseItems.familyId} = ${tag}`).orderBy(schema.purchaseItems.lineIndex);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.productName)).toEqual(['Sample stroller', 'Sample wipes']);
    expect(items[0].quantity).toBe(1);

    await db.insert(schema.runResults).values({ runId: tag, familyId: 'maya', result: { cards: [1, 2] } });
    const [rr] = await db.select().from(schema.runResults).where(sql`${schema.runResults.runId} = ${tag}`);
    expect(rr.result).toEqual({ cards: [1, 2] });

    await db.delete(schema.offerChecks).where(sql`${schema.offerChecks.offerId} = ${tag}`);
    await db.delete(schema.purchaseItems).where(sql`${schema.purchaseItems.familyId} = ${tag}`);
    await db.delete(schema.runResults).where(sql`${schema.runResults.runId} = ${tag}`);
  });
});

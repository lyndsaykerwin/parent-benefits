/**
 * Registers Bundle's sources in Zetaris (the SQL "data door").
 *
 *   npx tsx scripts/zetaris/register.ts           -> dry run: prints the SQL, changes nothing
 *   npx tsx scripts/zetaris/register.ts --apply   -> runs it, one statement per call
 *   npx tsx scripts/zetaris/register.ts --replace=v_judge_offers [--apply]  -> also re-create the named views (replaces a changed definition)
 *
 * Safe to re-run: it asks Zetaris what already exists (SHOW ...) and skips those
 * objects, so the Spike 0 objects (bundle_pg, bundle_live.cpsc_recalls) are reused,
 * never recreated. It never drops or alters anything.
 */
import os from 'os';
import path from 'path';
import { loadEnv } from '../../server/env';
import { ZetarisClient } from '../../server/adapters/zetaris';
import { BUNDLE_TABLE_NAMES } from '../../shared/schema';

loadEnv();
const apply = process.argv.includes('--apply');
// --replace=v_judge_offers,... : re-run CREATE DATASOURCE VIEW for those views even though they exist,
// so a changed definition replaces the old one. Only views named here are touched.
const replaceViews = new Set(
  (process.argv.find((a) => a.startsWith('--replace='))?.slice('--replace='.length) ?? '').split(',').filter(Boolean),
);

interface Step { label: string; sql: string; redacted: string; exists: boolean }

const DS = 'bundle_pg';
const LIVE = 'bundle_live';

const VIEWS: Record<string, string> = {
  // Judge: offers only, no family columns.
  v_judge_offers:
    'SELECT id, title, store, min_age_days, max_age_days, trigger_keyword, value_cents, fine_print, source_url FROM offers',
  // Planner: family profile, including income (only this view carries it).
  v_planner_family:
    'SELECT id, name, birth_date, due_date, zip, state, employer, household_size, annual_income_cents, dcfsa_offered, data_connected FROM families',
  // Clawback: card transactions keyed by family id, no income.
  v_clawback_tx:
    'SELECT id, family_id, date, merchant, amount_cents, category FROM transactions',
  // Recall checker: everything a family bought, from Amazon orders and card transactions, no income.
  v_recall_orders:
    "SELECT family_id, order_date AS purchased_on, title AS item_text, 'amazon' AS source, price_cents FROM amazon_orders " +
    "UNION ALL SELECT family_id, date AS purchased_on, merchant AS item_text, 'card' AS source, amount_cents AS price_cents FROM transactions",
  // Scout: public rules and offers only, no family data.
  v_scout_rules:
    "SELECT code AS ref, title, scope AS kind, amount_cents, source_url, 'rule' AS record_type FROM benefit_rules " +
    "UNION ALL SELECT CAST(id AS varchar) AS ref, title, store AS kind, value_cents AS amount_cents, source_url, 'offer' AS record_type FROM offers",
};

const OPENFDA =
  'https://api.fda.gov/food/enforcement.json?search=product_description:%22infant%20formula%22&limit=100';

function names(res: { rows: Record<string, unknown>[] }): Set<string> {
  const s = new Set<string>();
  for (const r of res.rows) for (const k of ['name', 'table_identifier']) if (r[k]) s.add(String(r[k]).toLowerCase());
  return s;
}

async function main() {
  const need = ['DATABASE_URL', 'ZETARIS_BASE_URL', 'ZETARIS_ORG_ID', 'ZETARIS_API_KEY'];
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing settings: ${missing.join(', ')}`);

  const db = new URL(process.env.DATABASE_URL!);
  const jdbcUrl = `jdbc:postgresql://${db.hostname}:${db.port || 5432}${db.pathname}?sslmode=require`;
  const user = decodeURIComponent(db.username);
  const pw = decodeURIComponent(db.password);

  const z = new ZetarisClient({
    baseUrl: process.env.ZETARIS_BASE_URL!, orgId: process.env.ZETARIS_ORG_ID!,
    apiKey: process.env.ZETARIS_API_KEY!, timeoutMs: 60_000, sampleMode: false,
    // DDL results are not worth caching; keep them out of the repo.
    cacheDir: path.join(os.tmpdir(), 'bundle-zetaris-register'),
  });

  // What already exists? (read-only)
  const dsExisting = names(await z.runQuery('SHOW DATASOURCES'));
  const liveDbs = names(await z.runQuery('SHOW LIGHTNING DATABASES'));
  const dsTables = dsExisting.has(DS) ? names(await z.runQuery(`SHOW DATASOURCE TABLES ${DS}`)) : new Set<string>();
  const dsViews = names(await z.runQuery('SHOW DATASOURCE VIEWS'));
  const liveTables = liveDbs.has(LIVE) ? names(await z.runQuery(`SHOW LIGHTNING TABLES ${LIVE}`)) : new Set<string>();

  const steps: Step[] = [];
  const dsSql = (pwText: string) =>
    `CREATE DATASOURCE ${DS} DESCRIBE BY "Bundle Neon" OPTIONS (jdbcdriver "org.postgresql.Driver", jdbcurl "${jdbcUrl}", username "${user}", password "${pwText}")`;
  steps.push({ label: 'datasource', sql: dsSql(pw), redacted: dsSql('***'), exists: dsExisting.has(DS) });

  for (const t of BUNDLE_TABLE_NAMES) {
    const sql = `REGISTER DATASOURCE TABLE '${t}' FROM ${DS}`;
    steps.push({ label: `table ${t}`, sql, redacted: sql, exists: dsTables.has(t) });
  }
  for (const [v, select] of Object.entries(VIEWS)) {
    const sql = `CREATE DATASOURCE VIEW ${v} FROM ${DS} AS ${select}`;
    steps.push({ label: `view ${v}`, sql, redacted: sql, exists: !replaceViews.has(v) && (dsViews.has(v) || dsViews.has(`${DS}.${v}`) || dsTables.has(v)) });
  }
  const liveDb = `CREATE LIGHTNING DATABASE ${LIVE} DESCRIBE BY "Live recall feeds"`;
  steps.push({ label: 'lightning database', sql: liveDb, redacted: liveDb, exists: liveDbs.has(LIVE) });
  // cpsc_recalls already exists from Spike 0 (window starts 2025-06-01); reused as is.
  const cpsc = `CREATE LIGHTNING REST TABLE cpsc_recalls FROM ${LIVE} REQUEST (endpoint "https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=2025-06-01", method "get", response_type "json", http_encoding "URLENCODED") HEADER () BODY ()`;
  steps.push({ label: 'rest cpsc_recalls', sql: cpsc, redacted: cpsc, exists: liveTables.has('cpsc_recalls') });
  const fda = `CREATE LIGHTNING REST TABLE fda_food_recalls FROM ${LIVE} REQUEST (endpoint "${OPENFDA}", method "get", response_type "json", http_encoding "URLENCODED") HEADER () BODY ()`;
  steps.push({ label: 'rest fda_food_recalls', sql: fda, redacted: fda, exists: liveTables.has('fda_food_recalls') });

  console.log(apply ? '=== APPLY ===' : '=== DRY RUN (nothing will be changed; pass --apply to run) ===');
  let failed = 0;
  for (const s of steps) {
    if (s.exists) { console.log(`SKIP (already exists) ${s.label}`); continue; }
    console.log(`${apply ? 'RUN ' : 'WOULD RUN'} [${s.label}]\n  ${s.redacted}`);
    if (!apply) continue;
    try {
      const r = await z.runQuery(s.sql);
      console.log(`  ok (${r.ms} ms)`);
    } catch (e: any) {
      failed++;
      console.log(`  FAILED: ${String(e.message).replace(pw, '***').slice(0, 500)}`);
    }
  }
  if (failed) { console.log(`${failed} step(s) failed`); process.exit(1); }
}

main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });

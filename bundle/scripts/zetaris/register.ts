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
 *
 * Mac flip-on for the plan v3 tables (after `db:push` put them in Neon):
 *   npx tsx scripts/zetaris/register.ts --apply --replace=v_recall_orders,v_clawback_tx
 *   (those two views changed: they now read only purchase_items; the rest are new, so they need no --replace)
 * then `npm run zetaris:record`. Only a live --apply proves Zetaris accepts the exact view wording.
 */
import os from 'os';
import path from 'path';
import { loadEnv } from '../../server/env';
import { ZetarisClient } from '../../server/adapters/zetaris';
import { BUNDLE_TABLE_NAMES } from '../../shared/schema';

export interface Step { label: string; sql: string; redacted: string; exists: boolean }
export interface RegisterConfig { jdbcUrl: string; user: string; password: string }
type Asker = { runQuery(sql: string): Promise<{ rows: Record<string, unknown>[]; ms?: number }> };

export const REGISTER_DS = 'bundle_pg';
const DS = REGISTER_DS;
const LIVE = 'bundle_live';

/**
 * The newest saved grade per offer. Used by v_offer_verdicts and v_offer_audit so the two can never disagree.
 * (checked_at then id breaks ties when two grades share a timestamp.)
 */
const LATEST_CHECKS =
  '(SELECT offer_id, store, verdict, status, rule_citations, regions_excluded, expired, face_value_cents, true_value_cents, effort_minutes_estimate, steps_count, ' +
  'payout_wait_days_max, claim_window_days, fine_print_hash, checked_at, recall_status, ' +
  'ROW_NUMBER() OVER (PARTITION BY offer_id ORDER BY checked_at DESC, id DESC) AS rn FROM offer_checks) AS latest_checks';

export const VIEWS: Record<string, string> = {
  // Judge: offers only, no family columns.
  v_judge_offers:
    'SELECT id, title, store, min_age_days, max_age_days, trigger_keyword, value_cents, fine_print, source_url FROM offers',
  // Planner: family profile, including income (only this view carries it).
  v_planner_family:
    'SELECT id, name, birth_date, due_date, zip, state, employer, household_size, annual_income_cents, dcfsa_offered, data_connected FROM families',
  // Purchases (items 8, 9): purchase_items is the ONLY purchase source. Safe columns only: no input hash, extractor, line index or timestamps.
  v_purchase_items:
    'SELECT id, family_id, source, store, seller, purchased_on, product_name, brand, model_number, lot_code, upc, size_text, quantity, price_cents, confidence FROM purchase_items',
  // Clawback: priced purchase rows keyed by family id, shaped like the old card-transaction view so the agents' queries keep working. No income.
  v_clawback_tx:
    "SELECT CAST(id AS varchar) AS id, family_id, purchased_on AS date, COALESCE(store, seller, '') AS merchant, price_cents AS amount_cents, product_name AS category " +
    'FROM purchase_items WHERE price_cents IS NOT NULL AND purchased_on IS NOT NULL',
  // Recall checker: everything a family bought, with the structured codes it matches on first (UPC, model, lot). No income.
  v_recall_orders:
    'SELECT family_id, purchased_on, product_name AS item_text, source, price_cents, store, seller, brand, model_number, lot_code, upc, size_text, quantity FROM purchase_items',
  // Scout: public rules and offers only, no family data.
  v_scout_rules:
    "SELECT code AS ref, title, scope AS kind, amount_cents, source_url, 'rule' AS record_type FROM benefit_rules " +
    "UNION ALL SELECT CAST(id AS varchar) AS ref, title, store AS kind, value_cents AS amount_cents, source_url, 'offer' AS record_type FROM offers",
  // Saved verdicts (item 38): latest grade per offer, value-and-time grade, fingerprint, universal-rule flag. NO family data.
  // universal_rule = a rejection that cites a rule and does not depend on region or today's date, so it holds for every family.
  v_offer_verdicts:
    'SELECT offer_id, store, verdict, status, CAST(rule_citations AS varchar) AS rule_citations, true_value_cents, effort_minutes_estimate, steps_count, ' +
    'payout_wait_days_max, claim_window_days, fine_print_hash, ' +
    "CASE WHEN verdict = 'reject' AND CAST(rule_citations AS varchar) <> '[]' AND CAST(regions_excluded AS varchar) = '[]' AND expired = false THEN true ELSE false END AS universal_rule, " +
    `checked_at, recall_status FROM ${LATEST_CHECKS} WHERE rn = 1`,
  // Data product: per-brand totals only (latest grade per offer). No family data.
  v_offer_audit:
    "SELECT store, COUNT(*) AS offers_checked, SUM(CASE WHEN verdict <> 'approve' THEN 1 ELSE 0 END) AS offers_caught, " +
    "ROUND(SUM(CASE WHEN verdict <> 'approve' THEN 1 ELSE 0 END) * 1.0 / COUNT(*), 3) AS catch_rate, " +
    'ROUND(AVG(face_value_cents)) AS avg_face_value_cents, ROUND(AVG(true_value_cents)) AS avg_true_value_cents, ROUND(AVG(effort_minutes_estimate)) AS avg_effort_minutes ' +
    `FROM ${LATEST_CHECKS} WHERE rn = 1 GROUP BY store`,
  // V2 report card: the same per-store totals split by where the grade came from ('court' = our scans, 'user_audit' = a parent). NO family data.
  v_audit_by_source:
    "SELECT store, source, COUNT(*) AS offers_checked, SUM(CASE WHEN verdict <> 'approve' THEN 1 ELSE 0 END) AS offers_caught " +
    'FROM (SELECT offer_id, store, verdict, source, ROW_NUMBER() OVER (PARTITION BY offer_id ORDER BY checked_at DESC, id DESC) AS rn FROM offer_checks) AS latest_by_source ' +
    'WHERE rn = 1 GROUP BY store, source',
  // Rerouted reads (item 14): the family profile in live mode (no user id) and the Coach's reports (issues only).
  v_family_profile:
    'SELECT id, is_guest, name, birth_date, due_date, zip, state, employer, household_size, annual_income_cents, dcfsa_offered, data_connected FROM families',
  v_coach_feedback:
    "SELECT id, family_id, card_id, kind, note, created_at FROM feedback WHERE kind = 'issue'",
};

const OPENFDA =
  'https://api.fda.gov/food/enforcement.json?search=product_description:%22infant%20formula%22&limit=100';

function names(res: { rows: Record<string, unknown>[] }): Set<string> {
  const s = new Set<string>();
  for (const r of res.rows) for (const k of ['name', 'table_identifier']) if (r[k]) s.add(String(r[k]).toLowerCase());
  return s;
}

/** Ask Zetaris what already exists (read-only SHOW questions) and list every step with whether it can be skipped. */
export async function planSteps(z: Asker, cfg: RegisterConfig, replaceViews: Set<string> = new Set()): Promise<Step[]> {
  const dsExisting = names(await z.runQuery('SHOW DATASOURCES'));
  const liveDbs = names(await z.runQuery('SHOW LIGHTNING DATABASES'));
  const dsTables = dsExisting.has(DS) ? names(await z.runQuery(`SHOW DATASOURCE TABLES ${DS}`)) : new Set<string>();
  const dsViews = names(await z.runQuery('SHOW DATASOURCE VIEWS'));
  const liveTables = liveDbs.has(LIVE) ? names(await z.runQuery(`SHOW LIGHTNING TABLES ${LIVE}`)) : new Set<string>();

  const steps: Step[] = [];
  const dsSql = (pwText: string) =>
    `CREATE DATASOURCE ${DS} DESCRIBE BY "Bundle Neon" OPTIONS (jdbcdriver "org.postgresql.Driver", jdbcurl "${cfg.jdbcUrl}", username "${cfg.user}", password "${pwText}")`;
  steps.push({ label: 'datasource', sql: dsSql(cfg.password), redacted: dsSql('***'), exists: dsExisting.has(DS) });

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
  return steps;
}

/** Print (dry run) or run (apply) the steps. Returns how many failed. Never prints the password. */
export async function runSteps(
  z: Pick<Asker, 'runQuery'>, steps: Step[], apply: boolean, password: string, log: (line: string) => void = console.log,
): Promise<number> {
  log(apply ? '=== APPLY ===' : '=== DRY RUN (nothing will be changed; pass --apply to run) ===');
  let failed = 0;
  for (const s of steps) {
    if (s.exists) { log(`SKIP (already exists) ${s.label}`); continue; }
    log(`${apply ? 'RUN ' : 'WOULD RUN'} [${s.label}]\n  ${s.redacted}`);
    if (!apply) continue;
    try {
      const r = await z.runQuery(s.sql);
      log(`  ok (${r.ms ?? '?'} ms)`);
    } catch (e: any) {
      failed++;
      log(`  FAILED: ${(password ? String(e.message).split(password).join('***') : String(e.message)).slice(0, 500)}`);
    }
  }
  if (failed) log(`${failed} step(s) failed`);
  return failed;
}

async function main() {
  loadEnv();
  const apply = process.argv.includes('--apply');
  // --replace=v_judge_offers,... : re-run CREATE DATASOURCE VIEW for those views even though they exist,
  // so a changed definition replaces the old one. Only views named here are touched.
  const replaceViews = new Set(
    (process.argv.find((a) => a.startsWith('--replace='))?.slice('--replace='.length) ?? '').split(',').filter(Boolean),
  );
  const need = ['DATABASE_URL', 'ZETARIS_BASE_URL', 'ZETARIS_ORG_ID', 'ZETARIS_API_KEY'];
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing settings: ${missing.join(', ')}`);

  const db = new URL(process.env.DATABASE_URL!);
  const cfg: RegisterConfig = {
    jdbcUrl: `jdbc:postgresql://${db.hostname}:${db.port || 5432}${db.pathname}?sslmode=require`,
    user: decodeURIComponent(db.username),
    password: decodeURIComponent(db.password),
  };

  const z = new ZetarisClient({
    baseUrl: process.env.ZETARIS_BASE_URL!, orgId: process.env.ZETARIS_ORG_ID!,
    apiKey: process.env.ZETARIS_API_KEY!, timeoutMs: 60_000, sampleMode: false,
    // DDL results are not worth caching; keep them out of the repo.
    cacheDir: path.join(os.tmpdir(), 'bundle-zetaris-register'),
  });

  const steps = await planSteps(z, cfg, replaceViews);
  const failed = await runSteps(z, steps, apply, cfg.password);
  if (failed) process.exit(1);
}

// Run only when started as a script (tsx scripts/zetaris/register.ts), not when a test imports it.
if (/register\.ts$/.test(process.argv[1] ?? '')) {
  main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
}

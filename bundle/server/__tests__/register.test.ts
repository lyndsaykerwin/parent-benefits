/**
 * W2-ZREG: Zetaris registration plan. Checks the view definitions (no family data where there must be none,
 * purchase_items as the only purchase source, every column real), the dry-run/apply behaviour against a fake Zetaris,
 * and (when the local test Postgres exists) that each view's SQL really runs and picks the latest verdict per offer.
 * No network; no live keys.
 */
import { getTableColumns, getTableName } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { VIEWS, planSteps, runSteps, REGISTER_DS, type RegisterConfig } from '../../scripts/zetaris/register';

const CONFIG: RegisterConfig = {
  jdbcUrl: 'jdbc:postgresql://db.example:5432/neondb?sslmode=require', user: 'u', password: 'secret-pw',
};

function fakeZ(existing: Record<string, string[]> = {}) {
  const calls: string[] = [];
  const rows = (names: string[]) => ({ headers: ['name'], rows: names.map((name) => ({ name })), ms: 1 });
  return {
    calls,
    z: {
      async runQuery(sql: string) {
        calls.push(sql);
        if (sql === 'SHOW DATASOURCES') return rows(existing.datasources ?? []);
        if (sql === 'SHOW LIGHTNING DATABASES') return rows(existing.lightning ?? []);
        if (sql.startsWith('SHOW DATASOURCE TABLES')) return rows(existing.tables ?? []);
        if (sql === 'SHOW DATASOURCE VIEWS') return rows(existing.views ?? []);
        if (sql.startsWith('SHOW LIGHTNING TABLES')) return rows(existing.liveTables ?? []);
        return { headers: [], rows: [], ms: 2 };
      },
    },
  };
}

const allColumns = new Set<string>();
const allTables = new Set<string>();
for (const t of Object.values(schema)) {
  try {
    const name = getTableName(t as any);
    allTables.add(name);
    for (const c of Object.values(getTableColumns(t as any))) allColumns.add((c as any).name);
  } catch { /* not a table */ }
}
const SQL_WORDS = new Set((
  'select from where and or not as on join left union all distinct group by order desc asc limit case when then else end null is in ' +
  'cast varchar integer numeric int over partition row_number count sum avg round coalesce lower concat like true false ' +
  'bundle_pg rn having min max'
).split(' '));

function unknownWords(sql: string): string[] {
  const stripped = sql.replace(/'[^']*'/g, ' ');
  const aliases = new Set([...stripped.matchAll(/\bAS\s+([a-z_][a-z0-9_]*)/gi)].map((m) => m[1].toLowerCase()));
  const words = stripped.toLowerCase().match(/[a-z_][a-z0-9_]*/g) ?? [];
  return [...new Set(words)].filter((w) => !SQL_WORDS.has(w) && !aliases.has(w) && !allColumns.has(w) && !allTables.has(w));
}

describe('view definitions', () => {
  it('has every view the plan names', () => {
    for (const v of ['v_purchase_items', 'v_recall_orders', 'v_clawback_tx', 'v_offer_verdicts', 'v_offer_audit', 'v_family_profile', 'v_coach_feedback', 'v_judge_offers', 'v_planner_family', 'v_scout_rules']) {
      expect(Object.keys(VIEWS)).toContain(v);
    }
  });

  it('only mentions real tables and columns (no typos)', () => {
    for (const [name, sql] of Object.entries(VIEWS)) expect({ name, unknown: unknownWords(sql) }).toEqual({ name, unknown: [] });
  });

  it('reads only purchase_items for purchases (items 8 and 9): no transactions, no amazon_orders', () => {
    for (const v of ['v_purchase_items', 'v_recall_orders', 'v_clawback_tx']) {
      expect(VIEWS[v]).toMatch(/\bpurchase_items\b/);
      expect(VIEWS[v]).not.toMatch(/\b(transactions|amazon_orders)\b/);
    }
  });

  it('keeps the column names agents already query on v_clawback_tx and v_recall_orders', () => {
    for (const c of ['id', 'family_id', 'date', 'merchant', 'amount_cents', 'category']) expect(VIEWS.v_clawback_tx).toMatch(new RegExp(`\\b${c}\\b`));
    for (const c of ['family_id', 'purchased_on', 'item_text', 'source', 'price_cents']) expect(VIEWS.v_recall_orders).toMatch(new RegExp(`\\b${c}\\b`));
  });

  it('v_purchase_items exposes safe columns only (no hash, extractor, line index)', () => {
    expect(VIEWS.v_purchase_items).not.toMatch(/input_hash|extractor|line_index|created_at/);
    for (const c of ['upc', 'lot_code', 'model_number', 'brand', 'seller', 'size_text']) expect(VIEWS.v_purchase_items).toMatch(new RegExp(`\\b${c}\\b`));
  });

  it('v_offer_verdicts and v_offer_audit carry no family data', () => {
    for (const v of ['v_offer_verdicts', 'v_offer_audit']) {
      expect(VIEWS[v]).not.toMatch(/family|income|household|employer|\bzip\b/i);
      expect(VIEWS[v]).toMatch(/\boffer_checks\b/);
    }
  });

  it('v_offer_verdicts returns the latest grade per offer with the value-and-time fields', () => {
    const sql = VIEWS.v_offer_verdicts;
    expect(sql).toMatch(/ROW_NUMBER\(\) OVER \(PARTITION BY offer_id ORDER BY checked_at DESC/);
    for (const c of ['verdict', 'status', 'rule_citations', 'true_value_cents', 'effort_minutes_estimate', 'steps_count', 'payout_wait_days_max', 'claim_window_days', 'fine_print_hash', 'universal_rule']) {
      expect(sql).toMatch(new RegExp(`\\b${c}\\b`));
    }
  });

  it('v_family_profile has the family fields but no user id; v_coach_feedback is issues only', () => {
    expect(VIEWS.v_family_profile).not.toMatch(/user_id/);
    expect(VIEWS.v_family_profile).toMatch(/annual_income_cents/);
    expect(VIEWS.v_coach_feedback).toMatch(/kind = 'issue'/);
  });

  it('never ends with a semicolon (Zetaris takes one statement)', () => {
    for (const sql of Object.values(VIEWS)) expect(sql.trim().endsWith(';')).toBe(false);
  });
});

describe('planSteps / runSteps (fake Zetaris)', () => {
  it('registers the five new tables and creates the new views on a fresh Zetaris', async () => {
    const { z } = fakeZ();
    const steps = await planSteps(z, CONFIG);
    for (const t of ['purchase_items', 'offer_checks', 'run_results', 'tax_parameters', 'state_programs']) {
      const s = steps.find((x) => x.label === `table ${t}`);
      expect(s?.sql).toBe(`REGISTER DATASOURCE TABLE '${t}' FROM ${REGISTER_DS}`);
      expect(s?.exists).toBe(false);
    }
    for (const v of ['v_offer_verdicts', 'v_offer_audit', 'v_purchase_items', 'v_family_profile', 'v_coach_feedback']) {
      expect(steps.find((x) => x.label === `view ${v}`)?.sql).toBe(`CREATE DATASOURCE VIEW ${v} FROM ${REGISTER_DS} AS ${VIEWS[v]}`);
    }
  });

  it('skips what already exists and only re-creates views named by --replace', async () => {
    const { z } = fakeZ({
      datasources: [REGISTER_DS], tables: ['offer_checks', 'purchase_items'], views: ['v_clawback_tx', 'v_recall_orders', 'v_offer_audit'],
    });
    const steps = await planSteps(z, CONFIG, new Set(['v_clawback_tx']));
    const by = (l: string) => steps.find((s) => s.label === l)!;
    expect(by('table offer_checks').exists).toBe(true);
    expect(by('table run_results').exists).toBe(false);
    expect(by('view v_offer_audit').exists).toBe(true);
    expect(by('view v_recall_orders').exists).toBe(true);
    expect(by('view v_clawback_tx').exists).toBe(false); // replaced on request
    expect(by('datasource').exists).toBe(true);
  });

  it('dry run sends only SHOW questions and prints the password as ***', async () => {
    const { z, calls } = fakeZ();
    const steps = await planSteps(z, CONFIG);
    const lines: string[] = [];
    const failed = await runSteps(z, steps, false, CONFIG.password, (l) => lines.push(l));
    expect(failed).toBe(0);
    expect(calls.every((c) => c.startsWith('SHOW'))).toBe(true);
    const text = lines.join('\n');
    expect(text).toContain('DRY RUN');
    expect(text).not.toContain('secret-pw');
    expect(text).toContain('password "***"');
  });

  it('an empty password does not scramble error text', async () => {
    const steps = [{ label: 'x', sql: 'S', redacted: 'S', exists: false }];
    const lines: string[] = [];
    const failed = await runSteps({ runQuery: async () => { throw new Error('boom'); } }, steps, true, '', (l) => lines.push(l));
    expect(failed).toBe(1);
    expect(lines.join('\n')).toContain('FAILED: boom');
  });

  it('apply runs each missing step once and never drops or alters anything; failures are counted and redacted', async () => {
    const { z, calls } = fakeZ({ datasources: [REGISTER_DS] });
    const steps = await planSteps(z, CONFIG);
    const failing = {
      async runQuery(sql: string) {
        if (sql.startsWith('CREATE DATASOURCE VIEW v_offer_audit')) throw new Error('bad view secret-pw');
        return z.runQuery(sql);
      },
    };
    const lines: string[] = [];
    const failed = await runSteps(failing, steps, true, CONFIG.password, (l) => lines.push(l));
    expect(failed).toBe(1);
    expect(calls.some((c) => /\b(DROP|ALTER|DELETE|TRUNCATE)\b/i.test(c))).toBe(false);
    expect(calls.filter((c) => c.startsWith("REGISTER DATASOURCE TABLE 'offer_checks'"))).toHaveLength(1);
    expect(lines.join('\n')).not.toContain('secret-pw');
  });
});

// ---- Live local Postgres (skipped with a note when it is not running; use a database name unique to this chunk) ----
const TEST_URL = process.env.TEST_DATABASE_URL ?? 'postgres://bundle:bundle@127.0.0.1:5432/bundle_test_w2zreg';

describe('view SQL on the local test Postgres (the Neon side of each view)', () => {
  let client: import('pg').Client | null = null;

  beforeAll(async () => {
    try {
      const { Client } = await import('pg');
      const c = new Client({ connectionString: TEST_URL, connectionTimeoutMillis: 1500 });
      await c.connect();
      await c.query('select 1 from offer_checks limit 1');
      client = c;
    } catch {
      console.warn(`[register.test] local test Postgres not ready at ${TEST_URL}; skipping live view checks`);
    }
  });
  afterAll(async () => { await client?.end().catch(() => undefined); });

  it('every view runs', async () => {
    if (!client) return;
    for (const sql of Object.values(VIEWS)) {
      await expect(client.query(`SELECT * FROM (${sql}) AS v LIMIT 0`)).resolves.toBeDefined();
    }
  });

  it('v_offer_verdicts returns only the newest grade per offer; v_offer_audit counts it once', async () => {
    if (!client) return;
    const tag = `w2zreg_${Date.now()}`;
    const store = `Made-up Store ${tag}`;
    const ins = (hash: string, verdict: string, at: string, cites: string) => client!.query(
      `INSERT INTO offer_checks (offer_id, store, fine_print_hash, agent, verdict, status, checked_at, rule_citations, true_value_cents, effort_minutes_estimate)
       VALUES ($1, $2, $3, 'fact_checker', $4, 'agreed', $5, $6::jsonb, 1500, 10)`, [tag, store, hash, verdict, at, cites]);
    try {
      await ins('old', 'approve', '2026-10-01T00:00:00Z', '[]');
      await ins('new', 'reject', '2026-10-02T00:00:00Z', '["FP-07"]');
      const res = await client.query(`SELECT * FROM (${VIEWS.v_offer_verdicts}) AS v WHERE offer_id = $1`, [tag]);
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].fine_print_hash).toBe('new');
      expect(res.rows[0].universal_rule).toBe(true);
      const audit = await client.query(`SELECT * FROM (${VIEWS.v_offer_audit}) AS v WHERE store = $1`, [store]);
      expect(audit.rows).toHaveLength(1);
      expect(Number(audit.rows[0].offers_checked)).toBe(1);
    } finally {
      await client.query('DELETE FROM offer_checks WHERE offer_id = $1', [tag]);
    }
  });
});

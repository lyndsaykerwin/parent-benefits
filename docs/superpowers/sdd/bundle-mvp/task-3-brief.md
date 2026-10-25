### Task 3: Zetaris adapter and source registration

**Files:**
- Create: `server/adapters/zetaris.ts`, `scripts/zetaris/register.ts`, `data/sample/zetaris-cache/` (cached JSON results keyed by SQL hash)
- Test: `server/__tests__/zetaris.test.ts`

**Interfaces:**
- Produces:

```ts
export interface QueryResult { headers: string[]; rows: Record<string, string | number | null>[]; ms: number } // numeric-looking values coerced to number, '' and 'null' to null
export class ZetarisClient {
  constructor(opts: { baseUrl: string; orgId: string; apiKey: string; timeoutMs: number; sampleMode: boolean; cacheDir: string; fetchFn?: typeof fetch; trace?: TraceLogger })
  runQuery(sql: string): Promise<QueryResult>   // throws ZetarisUnavailable on timeout/5xx when no cache
}
export class ZetarisUnavailable extends Error {}
```

- Request: `POST {baseUrl}/api/proxy/sql-editor/sqls/run-query` with headers `Authorization: Bearer {apiKey}`, `X-Org-ID`, `X-Request-ID` (uuid), body `{sql, limit: 1000}`. The response shape `{headers, data: string[][]}` is mapped to `rows`.
- In sampleMode, or when a live call fails, read `cacheDir/<sha256(sql)>.json` if present. Live successes write the cache.

- [ ] Step 1: Write the tests with a fake `fetchFn`:
  - (a) maps `{headers:['a','b'],data:[['1','x']]}` to `rows[0].a === 1` (number) and `rows[0].b === 'x'`
  - (b) a timeout with no cache throws `ZetarisUnavailable`
  - (c) a timeout with a cache file returns the cached rows
  - (d) a SQL string ending in `;` is rejected with `Error('one statement, no trailing semicolon')`
- [ ] Step 2: Run `npm test -- zetaris`. Expected: FAIL.
- [ ] Step 3: Implement `ZetarisClient`.
- [ ] Step 4: Run `npm test -- zetaris`. Expected: PASS.
- [ ] Step 5: Write `scripts/zetaris/register.ts` with `--apply` (default prints SQL only). The statements, one per call:
  - `CREATE DATASOURCE bundle_pg DESCRIBE BY "Bundle Neon" OPTIONS (jdbcdriver "org.postgresql.Driver", jdbcurl "jdbc:postgresql://<neon-host>:5432/neondb?sslmode=require", username "<user>", password "<pw>")`, with values parsed from `DATABASE_URL`
  - `REGISTER DATASOURCE TABLE '<t>' FROM bundle_pg` for each Bundle table
  - `CREATE LIGHTNING DATABASE bundle_live DESCRIBE BY "Live recall feeds"`
  - `CREATE LIGHTNING REST TABLE cpsc_recalls FROM bundle_live REQUEST (endpoint "https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=2024-01-01", method "GET")`
  - `CREATE LIGHTNING REST TABLE fda_food_recalls FROM bundle_live REQUEST (endpoint "https://api.fda.gov/food/enforcement.json?search=product_description:%22infant%20formula%22&limit=100", method "GET")`
  - Optional, if its endpoint is confirmed: an NHTSA car-seat recall REST table in `bundle_live`
  - Per-agent views: `CREATE DATASOURCE VIEW v_judge_offers FROM bundle_pg AS SELECT id, title, store, min_age_days, max_age_days, value_cents, fine_print, source_url FROM offers` (no family columns), and `v_planner_family` (includes income), `v_clawback_tx` (transactions + family id, no income), `v_recall_orders` (amazon_orders + transactions merchant/description, no income), `v_scout_rules` (benefit_rules + offers, no family data)
- [ ] Step 6: **Go/no-go by Fri Oct 23 noon Boston.** Run `npx tsx scripts/zetaris/register.ts` (dry run), review, then run with `--apply`. Also check that `SELECT * FROM bundle_live.cpsc_recalls LIMIT 5` returns flattened product names (CPSC nests `Products[].Name`). If not, register a saved, flattened CSV copy as a file table and record that in `setup/zetaris-notes.md`. **Plan B, if JDBC to Neon fails:** export the curated tables and fixtures to CSV and register them as Zetaris file tables; private family tables stay in Neon and are joined in the app layer, with the limitation documented. Verify `SHOW DATASOURCES` lists `bundle_pg` and `SELECT count(*) AS n FROM bundle_pg.families` returns `3`. If the JDBC registration fails, record the error in `setup/zetaris-notes.md` and stop for review. This is the plan's biggest unknown.
- [ ] Step 7: Commit `feat: zetaris client with timeout+cache; source registration script`.


---
**Binding context (read too):** overrides.md, global-constraints.md, and the "Rulings" section of progress.md, all in this folder. Where they conflict with the text above, they win. Key rulings: guest only (no Firebase; "Reviewer mode" token instead of admin); the Receipt is split into `moneyBackCents` + `likelyBenefitsCents`; the court caps at 5 offers; reuse the existing Zetaris objects `bundle_pg` and `bundle_live.cpsc_recalls`; never drop the Neon table `spike0_amazon_orders`. Repo: /Users/lyndsay/Documents/hackathon/bundle (local `main`, never push).

**Task 3 specifics from the controller:**
- Spike 0 (read /Users/lyndsay/Documents/hackathon/setup/zetaris-notes.md first) already created datasource `bundle_pg` (Neon, `sslmode=require`) and `bundle_live.cpsc_recalls` (REST, 739 rows). `register.ts` must detect existing objects (`SHOW DATASOURCES`, `SHOW LIGHTNING DATABASES`, `SHOW LIGHTNING TABLES`) and skip or reuse them, never recreate them.
- CPSC product names are nested: `LATERAL VIEW explode(Products) AS p` and `p.Name`, **inside a subquery**. Putting LATERAL VIEW directly in a JOIN gives a misleading `mismatched input` error.
- Zetaris credentials: `ZETARIS_BASE_URL`, `ZETARIS_ORG_ID`, `ZETARIS_API_KEY` are in /Users/lyndsay/Documents/hackathon/setup/zetaris-getting-started/.env.local. Copy the three lines into /Users/lyndsay/Documents/hackathon/.secrets/bundle.env.local, appending them if they're missing (a private file outside the repo), so `loadEnv` picks them up. Never print the key.
- The reference implementation of the proxy request is /Users/lyndsay/Documents/hackathon/setup/zetaris-getting-started/scripts/zetaris_api.ts and query_zetaris.ts (Bearer key, X-Org-ID, X-Request-ID, body `{sql, limit}`). The response is `{headers, data, total, timeUsed}`.
- Lyndsay has approved creating Zetaris objects for Bundle: the datasource tables, `bundle_live` REST tables (openFDA), views, and DQ rules. Use dry-run first, then `--apply`. Look up DQ syntax in `setup/zetaris-getting-started/docs/guides/zetaris-lightning-sql-commands.md`. If DQ registration fails, document it and continue; the Fact-Checker's `no source` check is the backstop.
- Fill `data/sample/zetaris-cache/` by running, live, the actual queries later tasks need for the 3 seed families. That can wait for later tasks; for now, cache just the smoke queries you run.

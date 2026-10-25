# Task 3 report: Zetaris adapter and source registration

Status: DONE. Commit e7ecb97 (local main, BASE 4121fc9). Never pushed.

## TDD
- RED: `npm test -- zetaris` failed with `TS2307: Cannot find module '../adapters/zetaris'` (before implementation).
- GREEN: 6/6 zetaris tests pass (brief's a-d plus: cache written on live success and served in sampleMode with no network call; 5xx with no cache throws ZetarisUnavailable). Full suite 18/18; `tsc --noEmit` clean.

## Dry-run SQL (secrets redacted; actual output of `npx tsx scripts/zetaris/register.ts`)
SKIP datasource bundle_pg, SKIP lightning database bundle_live, SKIP cpsc_recalls (all Spike 0, reused). Would run:
```
CREATE DATASOURCE bundle_pg ... password "***"   (skipped, exists)
REGISTER DATASOURCE TABLE '<t>' FROM bundle_pg    x13 (users, families, transactions, amazon_orders, fsa_eligible_categories, store_policies, benefit_rules, offers, feedback, case_law_proposals, price_observations, zip_states, poverty_guidelines)
CREATE DATASOURCE VIEW v_judge_offers FROM bundle_pg AS SELECT id, title, store, min_age_days, max_age_days, value_cents, fine_print, source_url FROM offers
CREATE DATASOURCE VIEW v_planner_family FROM bundle_pg AS SELECT id, name, birth_date, due_date, zip, state, employer, household_size, annual_income_cents, dcfsa_offered, data_connected FROM families
CREATE DATASOURCE VIEW v_clawback_tx FROM bundle_pg AS SELECT id, family_id, date, merchant, amount_cents, category FROM transactions
CREATE DATASOURCE VIEW v_recall_orders FROM bundle_pg AS SELECT family_id, order_date AS purchased_on, title AS item_text, 'amazon' AS source, price_cents FROM amazon_orders UNION ALL SELECT family_id, date AS purchased_on, merchant AS item_text, 'card' AS source, amount_cents AS price_cents FROM transactions
CREATE DATASOURCE VIEW v_scout_rules FROM bundle_pg AS SELECT code AS ref, title, scope AS kind, amount_cents, source_url, 'rule' AS record_type FROM benefit_rules UNION ALL SELECT CAST(id AS varchar) AS ref, title, store AS kind, value_cents AS amount_cents, source_url, 'offer' AS record_type FROM offers
CREATE LIGHTNING REST TABLE fda_food_recalls FROM bundle_live REQUEST (endpoint "https://api.fda.gov/food/enforcement.json?search=product_description:%22infant%20formula%22&limit=100", method "get", response_type "json", http_encoding "URLENCODED") HEADER () BODY ()
```
`--apply`: every step ok on the first attempt (no errors, no retries).

## Live verification
- SHOW DATASOURCES -> bundle_pg (id 807).
- `SELECT count(*) AS n FROM bundle_pg.families` -> 3.
- v_judge_offers: 3 rows (Amazon/Target/Walmart offers). v_planner_family: maya/leo/ava with income. v_clawback_tx: maya Target rows. v_recall_orders: maya amazon + card rows (includes KEAWIS Crib Mattress). v_scout_rules: TRUMP_ACCOUNT etc. spike0_amazon_orders still 5 rows.
- `SELECT RecallID, p.Name FROM bundle_live.cpsc_recalls LATERAL VIEW explode(Products) AS p LIMIT 5` -> flattened product names (works; the brief's "flattened?" check passes, no CSV fallback needed).
- openFDA: raw `SELECT *` gives ONE row with `meta` and `results` (results is an array of records). Flatten works: `SELECT x.recall_number, x.product_description FROM bundle_live.fda_food_recalls LATERAL VIEW explode(results) t AS x` (inside a subquery) returns real infant-formula recalls (42 total in feed). `count(*)` on the raw table is 1, so later tasks must use the explode form.

## Decisions
- Reused bundle_pg and cpsc_recalls; the existing CPSC table's window starts 2025-06-01 (brief said 2024-01-01); not recreated.
- 4xx (rejected SQL) throws a plain Error and does NOT fall back to cache; timeouts, network errors and 5xx fall back to cache, else ZetarisUnavailable. In sampleMode a missing cache entry falls through to a live call.
- Only a trailing semicolon is rejected (so semicolons inside string literals are fine).
- `TraceLogger` does not exist yet; adapter defines a minimal `{log(entry)}` interface locally for the optional `trace` option. A later task should unify it.
- v_recall_orders and v_scout_rules are UNION ALL views (the brief's table has no "description" column; used merchant). Only v_planner_family carries income.
- Cache holds 8 smoke-query results (fake data only, no income) in data/sample/zetaris-cache/; the cache key is sha256 of the trimmed SQL (client trims before hashing).
- Copied the 3 ZETARIS_* lines into .secrets/bundle.env.local (outside the repo). A diff scan found no password or API key in the commit.

## Concerns
- NHTSA car-seat table skipped (endpoint unconfirmed). DQ rules skipped: need an activated USL table (extra setup); the Fact-Checker `no source` check is the backstop.
- openFDA returns dates as numbers (20200611), and the table is a single row until exploded.
- cpsc_recalls is a live uncached REST call (about 1-2 s warm); later tasks should batch/cache per run.
- Notes added to setup/zetaris-notes.md.

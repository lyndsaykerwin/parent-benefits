# Task 3 review (commit e7ecb97)

Spec: PASS. Critical 0, Important 0, Minor 5.

## Spec checks
- ZetarisClient interface, QueryResult, ZetarisUnavailable, constructor opts (fetchFn, trace): match brief.
- Request: POST /api/proxy/sql-editor/sqls/run-query, Authorization Bearer, X-Org-ID, X-Request-ID (uuid), body {sql, limit:1000}. Test asserts all.
- Coercion: numeric -> number, ''/'null' -> null; leading-zero and 16+ digit strings kept as text (sensible extra).
- Cache: sha256(trimmed sql) in cacheDir; written on live success; read in sampleMode and on timeout/5xx/network failure; ZetarisUnavailable otherwise. Trailing ';' rejected with exact message before any fetch.
- Tests a-d present plus two extras; real assertions, no hardcoded outputs.
- register.ts: dry-run default, --apply executes, one statement per call. I re-ran the dry run (read-only SHOW calls): every object, including all 5 views and fda_food_recalls, is SKIPped, so re-runs are idempotent. Never drops/alters.
- Views: v_judge_offers no family/income columns; v_clawback_tx no income; v_recall_orders no income; v_planner_family the only one with annual_income_cents; v_scout_rules no family data. OK.
- Secrets: grep for npg_|akiurs|AIza over repo finds nothing; cache JSON has no income; .secrets file is outside the repo. Password is redacted in printed SQL and in error text.
- Accepted rulings (DQ deferred, NHTSA skipped, cpsc_recalls reused) honoured; cpsc window 2025-06-01 vs brief's 2024-01-01 is a documented consequence of reuse.

## Minor
1. register.ts: `String(e.message).replace(pw, '***')` with an empty password would insert '***' at the start (harmless, cosmetic). Also only the first occurrence is replaced; use split/join.
2. If a caller passes `trace` and runs CREATE DATASOURCE, the password-bearing SQL would land in input_summary (first 200 chars; the password sits after that offset in practice, but fragile). register.ts correctly passes no trace. Consider masking `password "..."` in `trace()`.
3. Trace entry omits trace_id/timestamp/target_agent/confidence/retry_count; fine only if the future TraceLogger fills them. Local TraceLogger interface must be unified in the trace task (already noted by implementer).
4. Dry run writes SHOW results to an os.tmpdir cache; if Zetaris is down, a stale cached SHOW could make dry-run misreport what exists. Cosmetic (dry-run only).
5. sampleMode with a cache miss silently falls through to a live call. Matches brief wording ("or on failure") but means SAMPLE_MODE can hit the network when a seed query is not cached; later tasks must fill the cache for all seed-family queries.

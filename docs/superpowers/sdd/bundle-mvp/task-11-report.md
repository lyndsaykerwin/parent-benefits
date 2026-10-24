# Task 11 report: ingest

Status: DONE (parser + mapper; upload route deliberately skipped).

Built: server/ingest/plaid.ts (mapPlaidTxn, loadPlaidFixture), server/ingest/amazonCsv.ts (parseAmazonCsv, parseAmazonCsvWithStats returning {rows, skipped}), server/__tests__/ingest.test.ts (6 tests). scripts/seed.ts now loads transactions through loadPlaidFixture/mapPlaidTxn.
CSV parser accepts both the sample columns and Amazon export names (Order Date, Product Name, ASIN, Unit Price), handles quoted commas and $ signs; bad dates/prices/missing titles are skipped and counted.
No live Plaid routes or importPlaidTransactions (per ruling).

Why the Amazon upload route was skipped: every agent (clawback, etc.) reads transactions and orders through SQL sent to Zetaris, which reads the shared Neon tables, filtered by family id. An inline (non-persisted) family has no rows there, and rulings forbid writing uploads into shared tables. Making agents see in-memory rows would mean rewriting the agent SQL paths. Acceptable-outcome clause applied.

Tests: npm run check clean; npm test 15 suites / 155 tests pass (seed test ran against Neon). Note: RED step was effectively the missing-module failure; not run separately.

## Fix round 1
- Amazon row ids are now `<order id>-L<line number>` (unique even if an Order ID repeats); test with two lines sharing an Order ID.
- Plaid fallback id (when no transaction_id) is a hash of date, merchant, amount and index; mapPlaidTxn takes an optional index; fixture loader passes it.
- Both mappers throw if familyId is empty. Tests added for all three. check clean; ingest + seed tests pass.

# Task 11 review: ingest (Amazon CSV parser and Plaid-format mapper)

Reviewed: task-11-brief.md (with controller rulings), task-11-report.md, task-11-review-package.diff (commit 3907cd2), and the sample files in the repo (data/sample/amazon-orders.csv and data/sample/plaid-transactions.json). Read-only. I did not run the test suite, because the seed test writes to the shared Neon database.

## Spec compliance: PASS (with the controller rulings applied)

| Requirement | Result | Evidence |
|---|---|---|
| parseAmazonCsv(csv, familyId) returns rows with integer priceCents | Met | priceCents = Math.round(price * 100) in amazonCsv.ts |
| Malformed rows are skipped and counted | Met | parseAmazonCsvWithStats returns {rows, skipped}; test uses a bad line and expects skipped = 1 |
| Amazon Retail export column names accepted | Met | ALIASES map; test with "Order Date, Product Name, ASIN, Unit Price" |
| mapPlaidTxn(t, familyId) gives integer amountCents, Plaid positive = outflow | Met | amountCents = Math.round(amount * 100), sign kept (28.99 gives 2899) |
| merchant comes from merchant_name | Met | merchant = merchant_name, then name, then 'Unknown' |
| Seed uses mapPlaidTxn | Met | scripts/seed.ts calls loadPlaidFixture, which calls mapPlaidTxn |
| Live Plaid routes and importPlaidTransactions dropped | Met | none present (controller ruling) |
| Amazon upload route | Skipped | allowed by the controller ruling (optional) |
| Tests assert real behaviour | Met | expected values match the sample files: 89.99 gives 8999, fixture has 1 refund (negative), 3 Amazon rows |

Deviations from the brief (process, not behaviour):
- The commit message is "feat: plaid-format mapper and amazon csv parser". The brief asked for "feat: plaid sandbox and amazon csv ingest".
- The report says the red test run (step 2) was not run separately. The brief asked for it.

## Float-to-cents rounding: correct

Every dollars-to-cents conversion uses Math.round after multiplying by 100 (amazonCsv.ts, plaid.ts, seed.ts). This avoids errors like 28.999999999999996 turning into 28. Checked: 28.99, 0.29, and 1.15 all round correctly.

## CSV quoting: mostly correct

The splitter handles quoted commas ("Diapers, size 1") and doubled quotes. Limits are listed under Minor.

## Findings

### Critical: 0

### Important: 1
1. **Amazon order ID could collide if an Order ID column is present (latent).** If an uploaded export has an "Order ID" column (the alias "order id" is accepted), multi-item orders repeat the same ID. That would make the primary-key insert fail. Nothing reaches this path today, because the upload route is skipped. Fix before enabling upload: use the ID plus line number, or ASIN plus line number, as the key.

### Minor: 4
1. **Plaid fallback ID is not guaranteed unique.** If a transaction has no transaction_id, the ID is `familyId-date-cents`, so two same-day, same-amount transactions collide. The sample fixture has transaction_id on all 15 rows, so this does not fire today.
2. **Plaid fallback family ID can be empty.** loadPlaidFixture uses `family_id ?? ''`. A missing family ID would insert an empty string and break the foreign key. The fixture is complete today.
3. **CSV parsing is line-based, so two formats break.** A product name with a line break inside quotes splits into two rows. An unquoted price with a thousands comma ("$1,234.50" without quotes) shifts the columns. Both usually get skipped, but the second could in rare cases read a wrong value silently. Fix: a proper CSV parser library, or a quote-aware line splitter.
4. **parseAmazonCsv hides the skipped count.** Only parseAmazonCsvWithStats returns it. This meets the spec as written, but callers who need the count must use the second function.

## Verdict
Spec met (with the controller rulings). No blocking issues. Fix the Important item before the Amazon upload route is turned on. The report's claims (15 suites, 155 tests passing) were not re-run in this review.

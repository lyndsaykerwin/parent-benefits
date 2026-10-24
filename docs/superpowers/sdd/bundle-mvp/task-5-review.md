# Task 5 review: Fact-Checker

Spec compliance: PASS. Critical 0, Important 1, Minor 4.

## Spec checks
- Signature matches. Amount tolerance is 1 cent (2 fails). Reason contains 'amount mismatch' and corrected.amountCents is the true value. Deadline mismatch is covered with a corrected deadline. Empty sources returns exactly 'no source' with no query run.
- Independence: queries re-read by id on base tables or views and never use c.evidenceSql. A test asserts this.
- Traced as agent_name 'fact_checker' on every path (ok / blocked / error). Zetaris errors fail closed with 'could not verify'. Unknown claim types fail closed.
- No income reaches traces: the claim JSON goes through TraceLogger.redact, and no income column is queried.
- One statement per call, no trailing semicolon (a test covers this).
- Column and view names match scripts/zetaris/register.ts and shared/schema.ts: v_judge_offers (id, value_cents, max_age_days), v_clawback_tx (id, family_id, amount_cents), benefit_rules (code, amount_cents, window_end_days_from_birth). The tests stub the queries and nothing was run against live Zetaris.

## Findings

### Important
1. SQL string escaping handles only single quotes. `q()` doubles `'` but not backslashes. Zetaris is Spark-based, where `\'` inside a string literal is an escape. A value like `x\' OR 1=1 --` becomes `'x\'' OR 1=1 --'`, which can break out of the literal. Affected fields: claim.ref, claim.recallNumber, claim.txId and ctx.family.id.
   - Fix: in `q()`, escape backslashes first (`.replace(/\\/g,'\\\\')`), or reject values that don't match `/^[A-Za-z0-9_.:-]+$/` and fail closed. Add a test.

### Minor
1. Unverified fields pass silently. A card with a deadline fails to mismatch when the source has none (the source window is null, or the value is not typed as number). The same happens when the source amount is null and the card has one. Consider failing closed in those cases, or at least document it.
2. `intId('')` returns 0, so an empty offerId or recallId is queried as 0 and ends as 'not found'. This is harmless, but a clearer 'cannot verify' would be better.
3. The clawback check validates txAmountCents but not the card's own amountCents (the claimed refund). This is acceptable per the report, but the contract should state it.
4. The `bundle_pg.` and `bundle_live.` qualifiers, and the FDA `explode(results)` subquery, are unverified against live Zetaris (the report admits this). Run one live smoke test before Task 9 integrates.

## Verdict
Approve after fixing Important 1; it is a few lines and a test.

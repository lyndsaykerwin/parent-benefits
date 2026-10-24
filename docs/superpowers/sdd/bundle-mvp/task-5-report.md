# Task 5 report: Fact-Checker

Files: server/agents/factChecker.ts, server/__tests__/factChecker.test.ts. Commit: see `git log` ("feat: fact-checker agent").

TDD: test file written first; first run FAILED (module ../agents/factChecker not found, 0 tests). After implementing: 10/10 pass; full suite 59/59; `npm run check` clean.

## Claim contract (Tasks 6-8 producers MUST attach `claim.type`)
- rule: {type:'rule', ref: benefit_rules.code} -> reads bundle_pg.benefit_rules (amount_cents, window_end_days_from_birth); deadline = (birthDate ?? dueDate) + window_end days, ISO.
- offer: {type:'offer', offerId} -> bundle_pg.v_judge_offers (value_cents, max_age_days); deadline = anchor + max_age_days.
- recall: {type:'recall', recallId} -> bundle_live.cpsc_recalls by RecallID (existence); FDA: recallSource:'fda' + recallNumber (flattened in a subquery).
- clawback: {type:'clawback', txId, txAmountCents} -> bundle_pg.v_clawback_tx by id AND this family's id; transaction amount must match.
- Unknown type: fails closed ("cannot verify").

## Decisions
- Independent path: queries by id on base tables/views, never c.evidenceSql (a test asserts this).
- Amount tolerance 1 cent (diff of 2 fails). Deadline compared only when both card and source have one.
- Fail closed: empty sources -> reason exactly `no source` (no query run); Zetaris error -> `could not verify: ...` (status error); missing row -> `source not found`.
- corrected returns {amountCents} and/or {deadline} from the source; the caller (Task 9) applies it and counts the retry (max 2).
- Every verify logs agent_name 'fact_checker', action 'verify', status ok / blocked / error; target_agent = producing agent on failure. Claim JSON in trace input_summary is run through TraceLogger redaction.
- String values SQL-quoted (single quotes doubled); numeric ids validated as integers; no trailing semicolons.

## Concerns
- Task 9 / producers must set claim.type and the right keys, otherwise everything fails closed.
- Recall check proves the recall exists, not that the family's item matches it (that is the Recall Checker's LLM confirm step).
- Queries were stubbed; not run against live Zetaris (view columns taken from scripts/zetaris/register.ts).

## Fix round 1 (backslash escape)
Changes: `q()` no longer escapes quotes; it whitelists ids with /^[A-Za-z0-9_.:-]+$/ and throws, so verify returns {ok:false, reason:'invalid id'} (trace status blocked) without querying. Applies to rule ref, txId, recallNumber and family.id. `intId` now treats undefined/empty as invalid instead of Number('')=0 (no query for id 0). Tests: replaced the quote-escape test with one covering `A'B`, a trailing backslash, a space, empty ref, empty offerId, and a backslash family id; none run a query.
Command: `npx jest server/__tests__/factChecker.test.ts && npm run check`
Output: 11/11 passed; tsc clean.

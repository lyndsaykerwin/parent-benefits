# Task 6 report: Clawback Hunter and Recall Checker

Status: DONE. Commit 6d9d224 (local main, not pushed). `npm run check` clean; `npm test` 84/84 (9 suites).

## TDD evidence
- RED: clawback.test.ts and recall.test.ts failed to compile ("Cannot find module '../agents/recall'") before any implementation.
- factChecker extension: 3 new tests failed against the old factChecker.ts (git stash check: 3 failed, 11 passed), all 14 pass after.
- GREEN: clawback 11 tests, recall 10 tests, factChecker 14 tests.

## Live Zetaris results (scripts/zetaris/agents-live.ts, TODAY=2026-10-23), all verified OK by the Fact-Checker
- maya: fsa_reimbursement tx maya-tx-01 = 2899; price_adjustment maya-tx-02 = 2000 (8999 -> 6999, deadline 2026-10-23); dcfsa_childcare = 555000 (3 x 185000, verdict likely); 1 recall = CPSC 10560 KEAWIS Crib Mattress; itemsChecked 9.
- leo: 0 clawbacks; 0 recalls; itemsChecked 0.
- ava: 1 fsa_reimbursement (CVS infant Tylenol + saline, 1458); 0 recalls; itemsChecked 5. The 4Ever car seat price drop correctly NOT flagged (observed 2026-10-20, outside Target's 14-day window from 2026-09-20).
- No SQL was rejected except one of my own bugs (ORDER BY on a non-selected column under DISTINCT), fixed. The nested CPSC/openFDA SQL, array_intersect/filter token matching and datediff all worked live first time. Timings: maya ~6s clawbacks+recalls cold; one ava run 30s (cold FDA/CPSC fetch).
- 17 new cache files in data/sample/zetaris-cache/ (25 total) cover agent AND verify queries for all 3 families. Raw pair query for maya gave 6 pairs (1 true, 5 noise), ava 8 (all noise): the noise is what the model confirm step removes.

## Files
server/agents/clawback.ts, recall.ts, sql.ts (quoteId/quoteDate/quoteInt, addDays, today, fmtUsd, dupKey, col), explain.ts (LLM body with dollar-amount guard), factChecker.ts (extended), tests clawback/recall/factChecker, scripts/zetaris/agents-live.ts.

## Decisions
1. claim.type is the subtype ('fsa_reimbursement' | 'price_adjustment' | 'dcfsa_childcare') per the brief; every claim also carries txId + txAmountCents (dcfsa uses the latest payment) and dcfsa adds planYear. Old 'clawback' type still verifies.
2. verify() extended with all three subtypes. Price adjustment re-derives paid-minus-lowest-in-window and the deadline in code (independent of the agent's SQL date filter); DCFSA re-sums distinct payments in SQL, applies cap 750000 (exported DCFSA_CAP_CENTS), and requires family.dcfsaOffered.
3. SQL safety: factChecker's id-whitelist moved to sql.ts and reused; only family id, plan-year dates are interpolated. Item text, merchants, keywords are joined inside Zetaris, never interpolated. Unsafe family id returns [] without querying.
4. fsa_reimbursement verdict = 'verified' (purchase fact verified; text says "likely eligible"). Only DCFSA is 'likely' per brief. Price adjustment also 'verified'. Recall: 'verified' on exact name containment, 'likely' if only model-confirmed.
5. FSA matching includes HSA keywords (account <> 'DCFSA'); one candidate per transaction; dedupe merchant+date+amount; amount <= 0 skipped. DCFSA plan year = calendar year of TODAY.
6. Recall items = Amazon titles (v_recall_orders, source amazon) + card item descriptions (v_clawback_tx.category, amount > 0), because v_recall_orders' card half holds only merchant names ("Target"), useless for matching. Consequence: maya itemsChecked = 9 (3 Amazon + 6 distinct card items), NOT the brief's "= Amazon row count" (3). The controller's "distinct purchase items for the family" wording was followed. Easy revert: drop the card half in itemsSelect() in recall.ts.
7. Recall match in one Zetaris SQL (CPSC explode(Products) and openFDA explode(results) in subqueries, FDA numeric dates normalised to ISO): pair if exact containment, or >=2 significant shared words, or a non-generic brand word. Then askJson yes/no per pair (max 25 pairs, one card per recall). No model: only exact product-name containment is accepted.
8. revise() in both files re-runs the agent against source, returns the fresh candidate with retryCount+1, or null if it no longer exists.

## Concerns
- The model's "same product" answer is the judge: a false "no" on an exact KEAWIS match would drop the recall (tested). No real model key was configured in this run, so live bodies/confirm used the deterministic fallbacks; the model path is only exercised with FakeGenerator.
- FDA recall url is a generic FDA enforcement-report page (the feed has no per-recall URL).
- maya itemsChecked includes "Groceries" and "Daycare tuition" as items (fixture stores descriptions in the category column); real Plaid categories would be coarser.
- DCFSA "amount" is total eligible spend capped at 750000, not tax savings (per brief); card is verdict likely.
- Task 9 must treat clawback claim types as listed above when calling verify/revise.

## Fix round 1 (review: 2 Important + 1 minor)
Changes (server/agents/recall.ts, server/__tests__/recall.test.ts):
1. Exact product-name containment is accepted WITHOUT asking the model; the model is asked only for loose pairs. Fallback for loose pairs with no model is now simply "reject". Old test "model 'no' drops KEAWIS" replaced by one asserting KEAWIS is accepted (verdict verified) with no model prompt even when the model would say no; new test that a model-confirmed loose pair is only 'likely'.
2. Pair cap: exact pairs are all kept first; only loose pairs are capped at 25 (MAX_PAIRS). New test: 30 noise pairs ahead of the exact pair, KEAWIS still found.
3. itemsChecked rule (documented in code, NOT_A_PRODUCT): card item text counts only if it does not contain daycare/childcare/child care/tuition and is not a generic category (groceries, restaurants, dining, gas, fuel, utilities, rent, mortgage, insurance, transfer, payment). Amazon titles always count. New test checks the SQL carries the filter.
Commands/outputs: `npx jest recall clawback` 24/24; `npm run check` clean; `npm test` all green; `npx tsx scripts/zetaris/agents-live.ts` live: maya 1 recall (CPSC 10560 KEAWIS, verified, Fact-Checker OK), itemsChecked 7 (was 9; 3 Amazon + thermometer, Pack 'n Play, onesies, Pampers); ava itemsChecked 4 (was 5), 1 FSA 1458; leo 0/0. Clawback results unchanged and all verify OK.
Cache: recall item/pair SQL changed, so 6 stale cache files from the first commit were removed and the new ones added (24 files total).

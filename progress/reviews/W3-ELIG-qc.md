# W3-ELIG QC (commit 370e83e, branch worktree-agent-ad50db4cf5f777f87)

Verdict: PASS (no must-fixes). npm test: 658 passed, 10 skipped, 0 failed (47 suites passed, 1 skipped). `npx tsc --noEmit`: clean. Worktree clean afterwards (nothing to restore).

## A. Done check
- Only 3 files changed: benefits.ts, new eligibilityLawyer.ts, new eligibilityLawyer.test.ts. All owned. benefits.test.ts untouched (existing tests pass unchanged, so none loosened).
- Lawyer challenges only what it can disprove: state-scoped program with a window (kind "window") and a federal tax-credit with an amount whose title/condition mentions tax (kind "tax_year"). Everything else (Trump Account, insurance, others) untouched. Test line 84-91 proves this.
- "Check with your job" card (DCFSA): never added to `terms` (benefits.ts `if (!checkWithJob)`), so never challenged, stays verdict "info", no amount.
- Exactly one Zetaris question per run: `runEligibilityLoop` calls `ctx.z.runQuery(eligibilityCounterSql(state))` once for all challenged benefits; no question if nothing is challengeable. `revise()` re-plans with `eligibilityLoop:false` and carries the earlier result (no second question).
- Planner resolves: confirmed / dropped (window disagreement, window closed, amount disagreement) / unverified. Drops log `eligibility_drop` status blocked.
- No state names in agent code: state comes only from ctx.family.state / scope; stateAgnostic guard test passes in the full run.
- Honest degrade: on replay miss or error, every challenged card stays, body gets "Not yet verified: ..." (no $ sign), claim.eligibility='unverified', trace line status 'fallback' with the reason. Tested (test lines 154-158, 211-213).
- Workspace notes (claim, question, answer, verdict) and trace lines (challenge_benefits, eligibility_check, eligibility_drop, plan_benefits) posted; note posting is wrapped in try/catch.

## SQL check
- Columns used exist in migrations/0000_init_bundle_v3.sql: state_programs(state, year, code, amount_cents, window_start_days_from_birth, window_end_days_from_birth); tax_parameters(year, code, amount_cents). Both exist. UNION ALL branches have matching column count and types (NULL cast to integer). ORDER BY on aliases source/code/year after UNION is valid.
- Table path `bundle_pg.state_programs` / `bundle_pg.tax_parameters` follows the same pattern as the existing `bundle_pg.benefit_rules` query. Caveat: those two tables are raw tables on the data source, not registered views; no register.ts change was made. Existing benefits query also reads a raw table, so likely fine, but it is untested live: confirm on the Mac. `year` and `source` as bare names could clash in Zetaris's SQL dialect if it is strict (low risk; recall.ts already aliases `source`).
- Injection: `state` must match /^[A-Z]{2}$/ else becomes '' (empty result, so "unverified"). Safe. No family, income or job column read.
- Code mapping: FEDERAL_CHILD_TAX_CREDIT -> CHILD_TAX_CREDIT matches tax-parameters.json. State program codes match benefit rule codes (MA_PFML etc.).
- Note: SQL text differs per state, so the Mac re-record needs one replay per state (CA, MA, NY, plus uncovered-state text, which yields '' state and returns only tax rows).

## B. Honesty judgment: KEEP "likely" and keep counting dollars
- Rests on progress/tracking/TRACKING-oct24-wave3.md W3-ELIG "Offline" line 89: "Without a replay the loop must fall back honestly (keep the benefit as 'Not yet verified')". The plan's M9 says confirm or drop after one counter-question; it never says an unanswered question removes the card.
- Rationale: the amounts come from the stored rules table, same as before the loop. The loop adds no new risk; it only adds a visible caveat. Flipping to "info" would drop dollars from the total in every offline run until recorded and change all saved outputs. The only fixed "not in total" rule (M3) is the Dependent Care FSA card. The plain-words note keeps this honest.
- Optional hardening: the Fact-Checker or README could say totals include "not yet verified" cards when run offline. Nothing else needed.

## C. Tightness
- Owned files only; no hardcoded outputs, personal data or secrets. Tests build rows from the shipped sample JSON fixtures and a fake Zetaris; they are meaningful (confirm, drop for closed window, drop for disagreement, unverified for missing row, one-question count, DCFSA untouched, revise path).

## Must-fixes
None.

## Nice-to-haves
1. Open leftovers from tracker not done: the "coming soon" note for uncovered states is still trace-only (benefits.ts state_coverage log), no info card; the NY_PFL / CA_PFL `verified` flags in data/sample/state-programs.json not touched. Both are assigned to W3-ELIG; decide whether to do or defer.
2. Mac: record the new counter-question replay for each state (`benefits-live`), and verify on live that `year`/`source` column names are accepted.
3. `challengeBenefits` has unused `_family`/`_today` params (harmless).

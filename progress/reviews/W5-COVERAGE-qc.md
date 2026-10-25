# W5-COVERAGE QC: PASS (with 3 minor, non-blocking fixes)

Branch worktree-agent-a9ea57b976d7b1f5a @ 9c72794. Reviewed by independent QC, Oct 25.

## Verified
- Full suite twice, SAMPLE_MODE=true: 63 suites passed / 1 skipped, 984 passed / 11 skipped / 0 failed, both runs (about 34 s each; no flakes). tsc clean. build clean.
- eval exit 0: 8/8 traps, 0 false alarms, money-back maya 4899, ava 1458, leo 0 (0-row clawback queries). Generated files reverted with git checkout (logs, output_examples, zetaris-cache); tree clean.
- Loop rules vs real trace lines (maya sample log read line by line): eligibility counted only on BenefitsPlanner evaluate_offer retry>=1 "rule X (" lines (2 for maya, 1 for ava); the Court's eligibility-challenge line (court_debate/retrying/retry 1) is NOT counted as a rebuttal; every "offer N outcome ... no rebuttal needed" and "no saved grades yet" is not counted; recall_check counts once per recall card (input starts "recall card "). Real writers checked in source: finePrintCourt.ts:165 (rebuttal opener), :277 (saved grade reused), photo.ts:306/314 (retry vs clearer-photo, only the first counts), clawback.ts:175 (safety kill), factChecker send-back counted on FactChecker line only. Tests (loopsEndToEnd, 19) drive the REAL agents and prove "exactly once per round" including the double-line cases.
- eval.ts loop counts computed from the agent log via loopsOf (no literals); eval.test.ts asserts scoreboard == panel rules for eligibility, send-backs, rebuttals, recall checks.
- Test robustness: agentLogCoverage uses SAMPLE_MODE, a temp logs dir, in-memory/tmp memory, no DB, no Neon ids, no reliance on committed generated files. loopsEndToEnd uses tmp dirs + FakeGenerator. Fast, not flaky.
- Audit: 12 spot-checked items (streamRoutes.ts:60 + index.ts:18; offerChecks.ts writes no recall_status; photo.ts:306/314; photoRoutes.ts:80 with no client caller; orchestrator.ts:237-245 + runBudget.test.ts:46; defaultLoadFamily Neon read at orchestrator.ts:59-67; Extras.tsx demo card; clawback/eligibility/factChecker ranges; sample photo dirs only READMEs; logs git-ignored; docs files exist). All line evidence accurate; the "N/P" admissions are honest. No overclaim of "built" found.
- No SQL literals changed (diff touches no agent files at all).

## Fixes (minor)
1. Wording: panel label "Saved grades reused" also counts the newsroom "used N past grade(s)" CONTEXT line (finePrintCourt/newsroom.ts:121), which feeds the Judge but does not skip the AI. Either rename the label to "Saved grades used" or tighten the agentLoops regex to the "saved grade is reused" line only. (Offline it is 0 either way, so no number is wrong today.)
2. Spec says the joint "events + whitelist" check lives in this chunk; agentLogCoverage checks the parent POST body only, not the SSE route's card whitelist (streamRoutes.ts:23). Add one test that a streamed card_ready payload has none of the agent-log/SQL keys, or note it is covered by streamRoutes.test.ts.
3. eval.test.ts last assertion (eligibilityQuestions <= raw eligibility_check count) is weak; harmless, optional to drop or tighten.

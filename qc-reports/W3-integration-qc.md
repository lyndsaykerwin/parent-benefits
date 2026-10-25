# W3 integration QC (main @ cce546a), Oct 24

**Verdict: PASS with caveats** (counts exactly as expected; no leaks; no fake data; honest banner; Zetaris-backed content still empty until replays are recorded).

## 1. Build and tests
- `npx tsc --noEmit`: clean. `npm run build`: OK (vite + esbuild). `npm test`: did NOT hang (no --forceExit, ~10s). 848 passed, 11 skipped, 2 failed (55 suites pass, 2 fail, 1 skipped).
- Failure 1: eval.test.ts "has 6 traps..." -> expectationFailures: maya recall-cpsc-10560 missing, maya + leo benefit-ma_pfml missing, leo benefit-ma_child_tax_credit missing.
- Failure 2: sampleMode.test.ts "typed-in family gets checked cards..." -> banner is "Some sources didn't respond..." instead of null.
- Cause (from the maya trace, query_zetaris lines): every missing card traces to "No saved response for this query" for 3 query shapes only: (a) the benefit fact-check query `SELECT amount_cents, window_end_days_from_birth, scope FROM ...` (6 rejected; benefits dropped as "could not verify"), (b) the recall `SELECT * FROM (SELECT 'cpsc' AS recall_source...` (recall details), (c) `SELECT 'state_program' AS source, code, year...` (eligibility counter) plus the offer-grades read `SELECT offer_id, store, verdict...`. All other queries hit the sample cache. Not independently confirmed: the "Maya's KEAWIS date moved" part (recall-cpsc-10560 is missing because the recall query has no replay, which hides it either way). No failure traces to code logic.

## 2. Sample mode (SAMPLE_MODE=true, port 5071, REVIEWER_MODE_TOKEN=demo, stopped afterward; confirmed down)
- maya (MA): money back $48.99 (FSA thermometer, Pack 'n Play price drop deadline 2026-10-23 = a real price-match window), recall "all clear" (7 items), Trump Account + Child Tax Credit as "info" ("Not yet verified"), 4 offers (likely), 2 coming-soon, 1 blocked (Amazon membership).
- leo (MA, expecting): money back info, recall "connect your data", Trump Account/CTC "(after birth)" info, 3 offers, 2 coming-soon.
- ZIP 60601 guest (IL): same as leo minus "(after birth)"; no IL/MA/NY state card (correct: none leaked). No state-program card for any family at all, because the benefit queries lack replays, so "no card for another state's program" is only unit-test-covered here, not visible live.
- Offer cards: all `deadline: null` (no "Ends <due+1yr>" - fixed, was a W2 issue). Every offer body ends "Fits babies up to N months old." (4, 12 months seen).
- Recall "Matched on:" evidence line: NOT observable (no recall card produced without the recall replay); code path exists server/agents/recall.ts:227.
- family.state: present in GET /api/runs/:id and /api/families/maya/latest-run (`family: {name, birthDate, dueDate, state:"MA"}`). Note POST /api/run?wait=true returns only the result view (no `family`), so a client that relies on family.state from that response will not find it (the client reads it from run endpoints / result.stateNote).

## 3. Parent payload cleanliness
- run result (3 families), runs/:id, latest-run: grep for debate/trace/ruleText/scoreboard/agent-log/rebuttal/zetaris/reviewer/v_*/SELECT: zero hits.
- /api/photo/read (1x1 PNG): 200 `status: unavailable`, honest message, nothing else. /api/offer-audit (no store): 200 `status: none`; with `?store=Target`: 503 `unavailable` generic message (no internals; this is the missing replay).
- /api/runs/:id/agent-log: 403 no token, 403 wrong token, 200 with `x-reviewer-token: demo` (lines array, trace fields). /api/runs/:id/trace and /api/scoreboard: 403 without token.

## 4. Trace files (latest 3 logs/run_bundle_<runId>.jsonl: guest 39 lines, leo 75, maya 94)
- All lines parse; all have exactly the 10 fields.
- Present: query_zetaris, recall_hmem, evaluate_offer, court_debate (22-23 per run; 5 mention "rebuttal"), fact_check, reject_card. Fallbacks logged ("deal_hunter: model unavailable", "fine_print_lawyer: model unavailable").
- Absent: safety_kill, eligibility lines, correction lines, workspace_open, recall_record success. (Expected: no model, missing replays, and orchestrator not wired, see 5.)

## 5. Wiring gaps for W4-ORCH (built, not called by server/agents/orchestrator.ts)
Orchestrator imports only verify, clawback, recall, court, benefits, fallback (orchestrator.ts:11-18).
- ctx.workspace (H-MEM workspace; `workspace_open` log): defined server/agents/workspace.ts:72, used only by finePrintCourt.ts:200, newsroom.ts:109-156, factChecker.ts:287; orchestrator never sets ctx.workspace.
- ctx.offerChecks writer: types.ts:87, offerChecks.ts:49, read by newsroom.ts:137; never set in orchestrator or bundleDeps.
- checkWithCorrections: factChecker.ts:297; orchestrator still calls plain `verify` (orchestrator.ts:11).
- runEvents.emit: RunEventHub exported runEvents.ts:106, no caller anywhere outside tests (no SSE route or emits).
- runEligibilityLoop / eligibilityCounterSql: eligibilityLawyer.ts:51,158; only tests call it (the missing `'state_program'` replay is this query).
- safety_kill: clawback.ts:172 exists; fires only if clawback path runs with a model (not seen in sample).
- stateNote: shared/bundle.ts:53 and client/src/lib/tabs.ts:106-108 read it; no server code sets it (client falls back to the coming-soon card).
- valueScore on feed cards: shared/bundle.ts:9 field, client FeedCardView.tsx:44 renders it; server valueScore() (valueScore.ts:68) only used inside finePrintRules; no card gets `valueScore` in the payload.
- "Do this by <date>" for expecting families: benefits.ts:42 builds it, but the cards seen in sample for leo (expecting) say "after birth" only; no deadline sentence reachable until benefit queries replay.
- recallDetailsSql: recall.ts:89,260 is wired in recall.ts, but has no replay (Matched on: line unseen).

## 6. `npm run eval` (offline)
Exit 0, no crash. Traps: duplicate, refund, non_ma_family (and others) caught; scoreboard summary before restore: trapsCaught 5 of 6, runs 3, stable true. Expectation failures = the same 4 as in test 1 (maya recall-cpsc-10560, maya/leo ma_pfml, leo ma_child_tax_credit). moneyBack maya 4899, leo 0, ava 1458 (matches). Learning loop stored in memory; scout accepted 3, rejected 2 correctly (500000-cent Trump bonus; "no source").

## Must-fix
1. Record Zetaris replays for (a) benefit fact-check query with `scope`, (b) recallDetailsSql, (c) eligibilityCounterSql, (d) offer-audit/grades reads, via `npm run zetaris:record` (needs live keys; not done here per rules). Clears both failing tests and the eval failures.
2. No code must-fix found. Should-fix: POST /api/run?wait=true result lacks `family`/state (bundleRoutes.ts:226 returns view(...) only); consider including family.state if any client path reads it from there.

## Side effects
Eval/test runs modified logs/scoreboard.json and output_examples/learning/{approve,run1,run2}.jsonl; restored with git checkout. Nothing committed; tracked tree clean (only the untracked tracking/QC reports). New untracked run logs under logs/ are ignored.

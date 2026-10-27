# Build tracker: 2026-10-26 feedback round

Plan: plans/2026-10-26-feedback-round-plan.md (approved by Lyndsay Oct 26 with changes, recorded under "Decisions (settled Oct 26)").
Research: progress/reviews/2026-10-26-{comments-code-map,judging-regrade,outside-testing-options,deck-gap-review}.md

## Done conditions (derived from the plan; the plan has no explicit list)
1. Lane A items 1–8 visible in the app: plan auto-save line; Trump Account + MA 529 on Savings tab with SSN + Form 4547 steps; CTC wording; no parent-facing "Fine Print Court"; "How we checked" only on deal/money-back/recall cards; plain Account page (no "Meterless memory", tech details reviewer-only); email button opens email with a message; no flicker on "All checked" → straight to "We found $X".
2. Lane B: blocking rule as decided; false catches fixed (mobile phone, old dates, standard shipping, Babylist); every link shown to parents returns a live, correct page (checked by real page load); registry terms correct with sources; offer_checks saves value + model; checked_at time correct (manual ALTER, no db:push).
3. Lane C: car seat + stroller example labels shown at photo time; reader captures model number + manufacture date/lot; photo saved immediately and read in background with "Reading…" + done notice in Gear Locker; busy NVIDIA retried for minutes, not 10 s; garbled answer gets more than one retry; live real-AI read of both sample photos succeeds.
4. Lane D: tester entry code; "made-up details only" notice; working Render setup (render.yaml at repo root or documented manual setup); click-by-click steps for Lyndsay; CORS/host issues fixed.
5. Lane E: practice mode returns real results for any US state (spot check TX, IL + 3 others); README + metadata.json match today's app; key scan clean.
6. Lane F: deck rebuilt per deck-gap-review incl. photo → structured data headline slide, agent map, agent talk, both feedback loops, data-as-API; false/stale claims removed; PDF + PNGs rendered. No video work.
7. All tests pass (npm test, npm run test:v2, npm run check) with real output recorded here; integration QC clean; committed and pushed to main.

## Chunks
| Chunk | Scope | Owns | Depends on | Status |
|---|---|---|---|---|
| A | Screens and wording | client/src/** EXCEPT components/scan/**, the Gear Locker component, App.tsx and new gate files; shared/cardMeta.ts | — | qc-pass (re-QC 6/6 in lane-a-qc.md) |
| B | Fine print accuracy, links, offer_checks | server/offers/**, server/agents/ fine-print/court/fact-check/offerChecks/newsroom/workspace files, offer + registry seed data, shared/schema.ts offer_checks block only | — | qc-pass (16/16 sentences, lane-b-qc.md); README -> E3 |
| C | Photo reader | server/ingest/**, server/routes/photoRoutes.ts, server/adapters/llm.ts, client/src/components/scan/**, Gear Locker component, shared/schema.ts item_photos/purchase_items blocks only, data/sample/photos/** | — | building |
| D | Outside testers | render.yaml, server/index.ts, new server/middleware/testerCode.ts, new client gate component, client/src/App.tsx, setup/ render guide | — | qc-pass (re-QC 4/4 in lane-d-qc.md) |
| E1 | Practice mode all 50 states | Benefits Planner agent + Zetaris query/cache files, data/sample/zetaris-cache/**, related scripts | — | qc-pass (lane-e1-qc.md); low findings -> integration fixer |
| F | Slide deck | presentation/deck/** | A–C for screenshots | built (15 slides, PDF+PNGs); placeholders: 4 screenshots, mfg-date row s5, bg reading s6, DB row count s11, test count s14, tester link s15, speaker notes outline.md. Final pass after A–C/B land. |
| E3 | README, metadata.json, key scan | bundle/README.md, metadata.json, .env.example | A–F | pending |
| E2 | Saved Nightshift real-AI run | progress/reviews/nightshift-check.md, scoreboard | Lyndsay opens Nightshift | pending (needs Lyndsay) |
| D3 | Render service live | Render dashboard | D + Lyndsay pastes keys | pending (needs Lyndsay) |

## Decisions made
- Blocking rule: block only when the catch costs more than the offer is worth, or turns into a paid subscription needing a card; else "OK, with a catch".
- Trump Account + MA 529 → existing Savings tab. Render: existing account, always-on plan. No video work today. Fine print + photo get most effort.

## Open questions
- Unowned fix queued: bundle/server/routes/bundleRoutes.ts parentResult() drops stateNote (one line) -> give to integration fixer.
- After lane B lands: new offer sets may need `zetaris:record` re-run so practice mode replays them (E1 note). Optional: factChecker/savedVerdicts/newsroom one fixed question (B's files).

## Evidence log
- ~10:00 ET: all six lanes (A, B, C, D, E1, F) stopped mid-work on a Claude usage limit (reset 11:20 ET). Resumed at 14:03 ET from saved progress.
- 14:xx ET: Lane F built, report progress/reviews/2026-10-26-lane-f-build.md.
- Lane D built (report lane-d-build.md); QC dispatched.
- Lane E1 built (report lane-e1-build.md): TX/IL/WA/GA/AZ $0 -> $3,200 with no keys; 37 Zetaris questions recorded; QC dispatched.
- Lane E1 QC PASS: 8 states + DC $3,200 no keys, NY gets NY_PFL, MA/CA unchanged, live Zetaris 2 fixed questions OK. Low: factChecker.ts:99 use ruleCheckSql (B file), record.ts copied queries untested.
- Lane D QC FAIL: uppercase /API path skips gate; notice only on gate. Builder fixing.
- ~17:00 ET: second usage limit stopped B, C, D-fixes and QC-A (reset 19:00). 19:10 ET resumed B, C, D-fixes; QC-A held back to save usage, resume after.
- Lane A built (lane-a-build.md), QC-A in progress (paused).
- Lane B built (lane-b-build.md): links 19/19 OK, 13/14 real offers right, value+model saved, checked_at -> timestamptz by hand. Learning-loop demo moved to Subscribe & Save offer (free-box trap now blocked first run). QC-B dispatched.
- Queued for E3/integration: re-run zetaris:record + examples:regen after B and C; README learning-loop steps -> 'Amazon Subscribe & Save diaper discount'; client label for catch type ai_found_catch (A's files); bundleRoutes stateNote; factChecker.ts:99 ruleCheckSql.
- Lane D QC fixes done; re-QC dispatched.
- Lane D re-QC PASS 4/4.
- QC-A: 8/8 PASS; M1 (no Copy button), L1 memory wording, L2/L3, L4 dropped asserts -> sent to A builder with ai_found_catch label + stateNote fix.
- QC-B: 2-6 PASS, 1 partial (trial->paid missed, '$100 value' not read, AI reject w/o quote -> approve, false catches 'No credit card required', data windows Babylist/Amazon/Target). Sent to B builder. README.md:47,185 learning-loop text stale -> E3.
- A QC fixes done (1394/0 tests); re-QC dispatched.
- Lane A re-QC PASS 6/6.
- QC-B re-QC: all PASS except 2 trial wordings ('/mo', 'monthly after') -> sent to B builder; README M2 -> E3.
- Lane C built (lane-c-build.md): 24/24 live reads, bg reading, mfg date+lot, 2 example labels, backup vision model, temp 0 text. 5 cols added by hand + migrations/0003. Not done: recall.ts Zetaris view lacks date column. QC-C dispatched.
- Lane B final verify PASS 16/16.
- QC-C: 5/5 PASS live; M1 stuck 'Reading' after restart, M2 unbounded queue + lows -> sent to C builder; delete qc/test lane-c rows. zetaris-cache diffs are from E1 (14:03), fine.
- E3 (README, metadata, .env.example, re-record zetaris + examples, key scan) dispatched.

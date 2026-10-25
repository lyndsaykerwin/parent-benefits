# W5-COVERAGE: plan v3 coverage audit (Sun Oct 25, 2026)

Strict walk of every numbered item in `bundle-plan-v3.md` against the code in this worktree (after merging `claude/funny-darwin-ccrblc`). Paths are inside `bundle/` unless noted. Line numbers are from this checkout.

**Status words:** `BT` built + tested; `BU` built, untested (or tested only through a fake that cannot prove the real behaviour); `P` partial; `N` not built; `C` cut by Lyndsay (a recorded decision, so not a gap). `Mac` after a status means the finishing step needs her Mac or real keys (cannot be done in the cloud).

**Plain-English words:** a *replay* is a saved real answer from a past live run, stored in `data/sample/zetaris-cache/`; *sample mode* (`SAMPLE_MODE=true`) uses only those, so it runs with no keys. *Fake model* means a scripted stand-in for the AI, used in tests.

## 0. Bottom line (what is left)

**Not built (N):**
1. (Refreshed after merging W4-STREAM-SRV and W5-EVALS.) The server push route is now BUILT: `GET /api/runs/:runId/events` (`server/routes/streamRoutes.ts:60`, registered `server/routes/index.ts:18`, cards through the parent whitelist `streamRoutes.ts:23`, `streamRoutes.test.ts`). Only a real-browser end-to-end check of the live stream is untested (BU).
2. `offer_checks.recall_status / recall_ids / recall_checked_at` are never filled in: columns exist (`shared/schema.ts:~205`) and `v_offer_verdicts` selects `recall_status` (`scripts/zetaris/register.ts:~66`), but `buildOfferCheckRow` (`server/agents/offerChecks.ts:21-40`) writes none of them, so every row says "none found".
3. The plan's two cross-source Zetaris questions: "offers rated truly free whose product is not recalled" (`offer_checks` x CPSC/openFDA) and "which fine-print problems show up most in Report-issue clicks" (`offer_checks` x `feedback`). No SQL exists for either (`v_offer_audit` is per-brand totals only, `register.ts:69-74`; coach reads `v_coach_feedback` only).
4. "Misses become tests" (newsroom loop step 4): nothing turns a Fact-Checker catch or a missed trap into a new test case (`data/sample/fine-print-cases/cases.json` is read only by `finePrintRules.test.ts`).
5. Sample item photos and recorded vision answers: `data/sample/photos/` and `data/sample/vision-cache/` hold only a README. So the photo path cannot be shown offline until the Mac runs `npm run record-vision` (Mac). Credited CPSC notice photos (item 6) are not in the repo.
6. "Forget my items" button: the server route exists (`server/routes/photoRoutes.ts:80`) but no screen calls it (`grep -i forget client/src` is empty).
7. S3-DREAM (H-MEM dreaming script, should-do): no `scripts/hmem-dream.ts`.
8. Real Google sign-in for "Save your list" (should-do): only the labelled demo card (`client/src/pages/tabs/Extras.tsx:32`).
9. Every Mac/live step: Nightshift switch-on and 9am go/no-go, `register.ts --apply` for new views, `zetaris:record` for any new question, `record-vision`, `eval:live-model`, `examples:regen -- --live`, one real-run agent log showing each loop, video. All have a checklist (`docs/mac-flip-on-checklist.md`) but none are done.
10. Evidence/README/metadata: README honesty note (Meterless engines used and not used), judges' line, offline labels, and the filled-in numbers are still with W5-DOCS-README / W6-EVIDENCE (README today still says "memory" only: `README.md:4,44,145`). Deck: out of scope by Lyndsay's ruling (Oct 25).

**Partial (P):**
- Court speed (item 30): the Deal Hunter and Lawyer run side by side only in the rebuttal round (`finePrintCourt.ts:169-172`); the first round awaits them one after the other (`:127-128`), and offers are still judged one at a time (`:271`).
- Family profile read through Zetaris (item 14 / section 6 item 11): the Coach half is done (`coach.ts:44`, `v_coach_feedback`). The live-mode family read is NOT: `defaultLoadFamily` still reads Neon directly (`server/agents/orchestrator.ts:59-67`); `familyProfileSql` (`savedVerdicts.ts:34`) is recorded by `zetaris:record` but nothing calls it. So "Zetaris is the only way agents read data" is not yet fully true.
- Scoreboard: now BT after W5-EVALS (8/8 traps, fine-print catches/field accuracy, recall right/caught, photo "not measured offline", loop counts, subtler learning trap; `scripts/eval.ts`, `eval.test.ts`). Its loop counts now use the same rules as the owner panel (`shared/agentLoops.ts`; this commit), so the two cannot disagree. Remaining honest gap: real-AI scoreboard is a Mac step (`eval:live-model`).
- Plaid out "everywhere": a parent-visible "Connect your bank (Plaid)" coming-soon tile is still rendered (`client/src/lib/bundle.ts:138-156`, `client/src/pages/tabs/SavingsTab.tsx:25`, `CardDetail.tsx:59`); legacy `transactions` table keeps a `plaid` enum value (`shared/schema.ts:41`). Needs Lyndsay's call: keep as a roadmap tile or remove.
- Value Score "paid in 6-8 weeks" range and the saved-grade reuse can only be seen with fake data offline: the saved-verdict replay is recorded with zero rows (no real `offer_checks` rows exist yet), so a sample run always says "no saved grades yet" (`newsroom.ts:81-83`). Reuse and "past grades feed the next grading" are proven only with fakes (`newsroom.test.ts`, `loopsEndToEnd.test.ts`) until the Mac fills `offer_checks`.
- Vision model defaults (item 4): receipts default to the same Omni model, not Nano 12B (`llm.ts:439-440`; Nano only if `MODEL_VISION_RECEIPT` is set on purpose, `photo.test.ts` "which vision model a receipt uses"). Deliberate and tested, but differs from the plan's wording.

**Fixed in this chunk:** the owner panel's loop-spotting wording (see section 11).

## 1. Sign-off directives (plan lines 11-29)

| # | Item | Status | Evidence |
|---|---|---|---|
| 8 | Card-style sample rows rerouted to `purchase_items`; recall matching only on structured codes | BT | `register.ts:48-57` (`v_purchase_items`, `v_recall_orders`, `v_clawback_tx`); `recall.test.ts` "W2-PURCH" (:220-275) |
| 9 | Money-back cards only from `purchase_items` | BT | `clawback.ts:22-45`; `clawback.test.ts`; `factChecker.test.ts:164` |
| 10 | Daycare invoice card dropped | C (done) | `factChecker.test.ts:155` ("dcfsa_childcare is gone") |
| 20 | Neon results table must-do | BT (Neon write Mac) | `shared/schema.ts:212`; `bundleStore.ts:96-190`; `runResults.test.ts:63,89`; Postgres variants skipped without `TEST_DATABASE_URL` |
| 29 | Rebuttal round, max 1 | BT | `finePrintCourt.ts:160-190`; `finePrintCourt.test.ts:253-310`; `loopsEndToEnd.test.ts` loop 5 |
| 33 | Agent Workspace / Trace panel | BT | `client/src/pages/AgentWorkspace.tsx`; mounted `Feed.tsx:260`; route `agentLogRoutes.ts:106`; `AgentWorkspace.test.tsx` |
| 38 | Zetaris saved-verdict query | BT (replay has 0 rows) | `savedVerdicts.ts:27,106,122`; `register.ts:63-68`; `savedVerdicts.test.ts` |
| 40 | Photo intake retry loop | BT | `ingest/photo.ts:306,314`; `photo.test.ts:139-255`; `loopsEndToEnd.test.ts` loop 7 |
| 41 | Recall verification loop | BT | `factChecker.ts:216-250`; `factChecker.test.ts:406-470`; `loopsEndToEnd.test.ts` loop 8 |
| 44 | README/metadata honesty note on Meterless engines | N (with W5-DOCS-README) | `README.md:4,44,145,226,235`; `metadata.json:24` still "memory" only |
| Part 2 | Required agent trace log | BT | `trace.ts:150` (`toAgentLogLine`), `shared/agentLog.ts`; `agentLog.test.ts`; NEW `agentLogCoverage.test.ts` (6 families) |

## 2. Round 4c / 4b / 4 decisions (lines 31-66)

| Item | Status | Evidence |
|---|---|---|
| Newsroom loop visible (rounds, lessons, grades) | P | Built and unit-tested (`newsroom.ts:75-165`), but offline only with fakes; real rows need Mac (see 0) |
| Value-and-time grade replaces confidence | BT | `valueScore.ts:68`; `finePrintCourt.test.ts` Value Score tests; `FeedCardView.tsx` |
| Parent-tap tuning later | C (deferred) | not built by decision |
| Monday 3pm freeze, 300-s limit | BT | `orchestrator.ts:237-245`; `runBudget.test.ts:46` |
| Skip unchanged fingerprints | BT (fake data) | `savedVerdicts.ts:122`; `newsroom.test.ts:54-116` |
| Job question stays cut | C | FSA = "Check with your job" (`FeedCardView.tsx:62`) |
| Onboarding + Version B from her mocks | BT | `Onboarding.tsx:12-14,140-162`; `pages/tabs/*`; `Onboarding.test.tsx`, `tabs/__tests__` |
| Newsroom does not demote data product | BT | same rows feed `v_offer_audit` (`register.ts:69`) and the loop |
| Nightshift job spelled out | BT (Mac switch-on) | `llm.ts:62,267,415-445`; `llm.test.ts`; `checkModel.test.ts` |
| Photo first; email/barcode after hackathon | C | not built by decision |
| 3 onboarding gap answers | BT | FSA card, Google-only (demo card), coming-soon note `onboarding.ts:9` |
| Strategy 1 existing Matcher kept | BT | `benefits.ts:89` |
| Plaid out everywhere | P | tile remains, see section 0 |
| FDA recalls stay, finished filtered | BT | `recall.ts:74-128`; `recall.test.ts:177-205` |
| Zetaris only way agents read data | P | family read in live mode still Neon (`orchestrator.ts:59-67`) |

## 3. Section 1: Living Fine-Print Database

| Item | Status | Evidence |
|---|---|---|
| `offer_checks` table, no family column, all listed fields | BT | `shared/schema.ts:163-209`; `schema.test.ts`; `migrations/0000_init_bundle_v3.sql` |
| Registered in Zetaris | BT (Mac apply) | `register.ts:38,63-79`; `register.test.ts` |
| Code fills amounts/dates, AI only soft fields | BT | `finePrintRules.ts:145`; `finePrintRules.test.ts` |
| Saved-verdict query (item 38) | BT | see above |
| Cross-source: truly free x not recalled | N | no SQL (section 0 item 3) |
| Cross-source: Coach x `feedback` | N | same |
| Newsroom 1: ask Zetaris first, recall lessons | BT | `newsroom.ts:98-126`; `newsroom.test.ts:117-155` |
| Newsroom 2: unchanged fingerprint skips AI | BT | `savedVerdicts.ts:122`; `finePrintCourt.ts:272-283` |
| Newsroom 3: grades feed grading, helpful/wrong marks | BT | `newsroom.ts:141-165`; `factChecker.ts:~293-330`; `factChecker.test.ts:372-402`; `workspace.test.ts:193-230` |
| Newsroom 4: misses become tests | N | section 0 item 4 |
| Value Score + "worth your time" defaults | BT | `valueScore.ts:14-68`; `valueScore.test.ts`; `.env.example` |
| `payout_wait_days_min` | BT | `schema.ts` + `valueScore.ts:59` (`payoutWaitLabel`) |
| `v_offer_audit` + `GET /api/offer-audit` + OpenAPI + no family fields + rate limit | BT | `offerAuditRoutes.ts:87`; `docs/openapi/offer-audit.yaml`; `offerAudit.test.ts:33-150` |
| Recall status columns filled | N | section 0 item 2 |

## 4. Section 1b: loops and speed

| # | Loop / measure | Status | Evidence |
|---|---|---|---|
| Workspace in H-MEM, item-37 note shape | BT | `workspace.ts:17-142`; `workspace.test.ts`; created `orchestrator.ts:212` |
| 1 | Safety-value loop (kill before the Judge) | BT | `clawback.ts:149-176`; `clawback.test.ts:182-267`; `loopsEndToEnd.test.ts` loop 1 |
| 2 | Eligibility loop (1 Zetaris question) | BT | `eligibilityLawyer.ts:158-205`; `eligibilityLawyer.test.ts`; `loopsEndToEnd.test.ts` loop 2 |
| 3 | Judge-Fact-Checker targeted correction (max 2) | BT | `factChecker.ts:60,272-335`; `factChecker.test.ts:282-402`; `loopsEndToEnd.test.ts` loop 3 |
| 3b | "approve with a catch" after correction | BT | `finePrintCourt.ts:347-362` keeps `j.verdict` |
| 4 | Send-back for every agent; unchecked never sent back | BT | `orchestrator.ts:301`; `orchestrator.test.ts:351-401` |
| 5 | Court debate + one rebuttal | BT (real-AI rebuttal Mac) | see 29 above |
| 6 | Newsroom loop | P | see section 2 |
| 7 | Photo retry loop | BT | see 40 |
| 8 | Recall verification | BT | see 41 |
| 9 | Coach / learning loop | BT | `coach.ts`; `sampleMode.test.ts:50-100` |
| | Instant saved feed | BT | `bundleRoutes.ts:286`; `Feed.tsx:181`; `Feed.test.tsx` |
| | Fast-path swarm / progressive card streaming | BT (browser E2E BU) | events emitted `orchestrator.ts:310`; route `streamRoutes.ts:60`; client `stream.ts:187`; `streamRoutes.test.ts`, `stream.test.tsx` |
| | Deep loops push by SSE | BT | `streamRoutes.ts:60`; polling fallback kept (`poll.ts`) |
| | Status pills | BT | `stream.ts` pillLines; `Feed.tsx:59`; `Feed.test.tsx` |
| | Optimistic background checking | BT | saved cards first then streamed updates (`Feed.tsx:72` liveCards) |
| | Round caps (2/1/1), `MAX_OFFERS` | BT | `factChecker.ts:253`; `newsroom.ts:20`; `finePrintCourt.ts:8` |
| | Per-call time limit + one retry (`NIGHTSHIFT_TIMEOUT_SECONDS` 180, `MODEL_TIMEOUT_SECONDS` 90) | BT | `llm.ts:109,195,216,425,432`; `llm.test.ts` |
| | 300-s run budget | BT | `orchestrator.ts:237`; `runBudget.test.ts` |
| | Four makers side by side, Fact-Checker 4 at a time | BT | `orchestrator.ts:265,327` |
| | Court judges offers side by side (item 30) | P | section 0 |
| | Saved results survive restart | BT | see 20 |
| | Judge = Nemotron 3 Super, thinking off | BT (Mac) | `llm.ts:384-388,418,437` (`MODEL_JUDGE`, `MODEL_THINKING`) |

**Done condition for must-do 9 ("each loop shows up as rounds in the trace log of a sample run"):** offline sample runs show the eligibility loop and recall checks only. Rebuttal, send-back, photo retry, safety kill and saved-grade reuse cannot occur in a model-free, keyless sample run (they need AI answers, a photo, a planted recall or real `offer_checks` rows), so they are proven by `loopsEndToEnd.test.ts` (real agent code, fake model / made-up rows). A real-run log showing all of them is a Mac step.

## 5. Section 1c: agent trace log

| Item | Status | Evidence |
|---|---|---|
| Exactly 10 fields, her enums | BT | `shared/agentLog.ts`; `agentLog.test.ts` |
| One trace id per run (`bundle_<runId>`), file `logs/run_bundle_<runId>.jsonl`, stdout print | BT | `trace.ts:200-266`; `agentLogCoverage.test.ts` (6 families) |
| Translation rules / confidence rule / housekeeping out | BT | `trace.ts:55-150`; `agentLog.test.ts:51-135`; coverage test checks line count equals detailed events minus housekeeping |
| Zetaris/memory lines under the calling agent | BT | `orchestrator.ts` per-agent `withTrace`; `orchestrator.test.ts:337` |
| Redaction | BT | `trace.ts:44`; coverage test checks no income/password in any run |
| Reviewer-only route, parent never receives | BT | `agentLogRoutes.ts:106`; `agentLogRoutes.test.ts`; coverage test checks parent body |
| Real-run log in saved evidence | N (Mac) | `logs/*.jsonl` are git-ignored; only older-format `logs/sample/*.jsonl` are committed |

## 6. Section 2-3: Strategy 1, intake

| Item | Status | Evidence |
|---|---|---|
| Matcher story / Zetaris filters first | BT | `benefits.ts:24-165` |
| `purchase_items` table + `v_purchase_items` + exact-code joins | BT | `schema.ts:136`; `register.ts:48-57`; `recall.ts:33-60` |
| Photo path: `see()`, `MODEL_VISION`, field checks, UPC check digit, one retry, clearer-photo | BT | `llm.ts:242`; `photo.ts:50-332`; `photo.test.ts` |
| Photo privacy (EXIF strip, no storage, reject people) | BT | `client/src/lib/photoPrep.ts`; `photo.test.ts:256-283` |
| "Forget my items" | P | route yes, no button |
| Sample photos (credited) + saved vision answers | N (Mac) | section 0 item 5 |
| Made-up receipt rows so Savings stays filled | BT | `data/sample/purchase-items.json`; `ingest.test.ts` |
| Email receipts, barcode | C | after hackathon |
| Recall matching upgrade (codes first, "7 of 8") | BT | `recallMatch.ts`; `recallMatch.test.ts:58-188` (scored on all 781 saved recalls) |
| `no_false_recall` | BT | `recall.test.ts:206,351` |

## 7. Section 4-5: views and Zetaris work

| Item | Status | Evidence |
|---|---|---|
| Parent vs owner split, trimmed on the server | BT | `bundleRoutes.ts:88-110` (`parentCard`, `parentResult`); `bundleRoutes.test.ts`; `agentLogCoverage.test.ts` parent-leak check |
| Reviewer code gates Approve, traces, scoreboard | BT | `bundleRoutes.ts:278,325,335,348` |
| Per-helper Zetaris views | BT (Mac apply) | `register.ts` |
| Fact-Checker re-reads source incl. state | BT | `factChecker.ts:90-125`; `factChecker.test.ts:227-280` |
| Two direct reads through Zetaris | P | Coach yes; family profile no (section 0) |
| Judges' line / join wording | N (docs) | W5-DOCS-README |

## 8. Section 6: technical plan

| Item | Status | Evidence |
|---|---|---|
| 1 Owner view split | BT | above |
| 2 Nightshift code, fallback order, timeouts, LIVE_MODEL, model:check, labels | BT (switch-on Mac) | `llm.ts`; `scripts/check-model.ts`; `scripts/eval.ts:29-118` |
| 3 Any state, middle class | BT | `stateAgnostic.test.ts` (5 families, 3-digit ZIPs, swap test, no-state-in-code guard); `tax-parameters.json`, `state-programs.json`, `zip3-states.json` |
| 3b Uncovered state note | BT | `benefits.ts:19,134-135`; `orchestrator.ts:358`; `orchestrator.test.ts:419` |
| 4 Verdicts, 12 tests + 3 controls | BT | `cases.json`; `finePrintRules.test.ts:18-115` |
| 4b Ohio fix + learning demo on subtler trap | BT | W5-EVALS: subtler trap taught from existing offers (`scripts/eval.ts`); eval 8/8 |
| 4c Scoreboard additions | BT | W5-EVALS; loops use shared rules |
| 5 Recall safety, finished filter, matching, verification, formula lot line | BT | `recall.test.ts` |
| 6 Data intake | P | photo built, offline sample photos missing |
| 7 Onboarding + Version B | BT | `Onboarding.tsx`, `tabs/*`, tests; "+" on every tab `VersionB.tsx:57`; "I got this" `FeedCardView.tsx:115`; share bar `Extras.tsx:8`; "How we got this number" `Extras.tsx:46`; "savings and tax credits" `HomeTab.tsx:56` |
| 8 Regenerate evidence | N | W6-EVIDENCE |
| 9 Neon results table | BT | see 20 |
| 10 Trace log + panel | BT | section 5 |
| 11 Two reads through Zetaris | P | section 0 |

## 9. Section 7-9: onboarding wording, timeline, keys

| Item | Status | Evidence |
|---|---|---|
| Top row (3 questions, "1 of 3 / Last one"), due-date wording, sample family | BT | `Onboarding.tsx:12-14,64,119-162` |
| Checking screen then Version B Home | BT | `Feed.tsx` |
| Expecting families: free gifts lead, "after birth" wording | BT | `VersionB.tsx:38-42`; `benefits.ts:96-112` |
| ZIP: typed, no automatic location | BT | (no geolocation code; "Use my location" button not built, allowed by "at most") |
| Work screen cut | C | |
| Save your list = labelled demo | BT | `Extras.tsx:32` |
| Real Google sign-in / Better Auth | N (should-do) | |
| Timeline items needing Mac (Nightshift, record, eval live, video, freeze rehearsal, public repo, submit) | N (Mac/human) | `docs/mac-flip-on-checklist.md` |
| Year-one table (item 27) | BT (docs) | `docs/year-one-table.md` (note: about $6,040 of $9,210 source-checked) |
| Hosted site / paid hosting | C | |

## 10. Section 10 proposals (items 1-44)

1 (answered: photo first) C. 2 email "Use sample receipts" C (after hackathon). 3 seller/quantity kept BT (`schema.ts:136-160`). 4 vision defaults P (see 0). 5 barcode C. 6 CPSC sample photos N (Mac). 7 matching upgrade BT. 8 BT. 9 BT. 10 C (done). 11 fallback order BT. 12 Monday go/no-go N (Mac). 13 Judge model BT (setting). 14 two reads P. 15 judges' line N (docs). 16 join wording N (docs). 17 open CPSC recalls per brand in `v_offer_audit` (should-do) N (`register.ts:69-74` has no recall column). 18 C. 19 cut order BU (recorded in tracker only). 20 BT. 21 labelled demo BT, real sign-in N. 22 BT. 23 BT. 24 C. 25 N (Mac webcam check). 26 BT (Judge fills role). 27 BT. 28 C. 29 BT. 30 P. 31 BT (client and server push). 32 BT (`photo.ts:89`, `photo.test.ts:80-117`). 33 BT. 34 C (later). 35 BT (`eligibilityLawyer.test.ts` "never asks about work"). 36 BT (real CPSC/openFDA only). 37 BT. 38 BT. 39 BU. 40 BT. 41 BT. 42 BT. 43 N (should-do, S3-DREAM). 44 N (docs).

## 11. What this chunk changed (task 2: panel wording vs real log lines)

A sample run's real log lines (6 families, `agentLogCoverage.test.ts`) showed the old `loopsOf` (client `AgentWorkspace.tsx`) did not match reality:

| Old rule | What the real lines say | Effect |
|---|---|---|
| Rebuttal = any court line with `retry_count >= 1` or the word "rebuttal" | Every ordinary Court outcome ends "no rebuttal needed"; the eligibility challenge line is `court_debate`, `retrying`, retry 1; hunter/lawyer/rule lines in a real rebuttal also carry retry 1 | Every case counted as a rebuttal; one real rebuttal counted 4-5 times; the eligibility loop was mislabelled "rebuttal" |
| Saved verdict = text contains "saved grade/verdict" or "past grade" | Real line "no saved grades yet" (every sample run) | Counted as a reuse in every run |
| Recall check = recall card with "evidence" in its text | The word "evidence" is a JSON key in every recall claim | Counted every ordinary recall check, contradicting its own comment |
| Send-back = any `retry_request` + needs_revision | A correction writes two such lines (FactChecker, then the maker's "revise") | Doubled |
| Photo retry = any PhotoReader `retry_request` | A failed retry writes a second, rejected "clearer photo" line | Doubled |
| No kind for the eligibility loop or the safety kill | Both are real, built loops | Not shown |

Fix: the rules moved to `shared/agentLoops.ts` (one place for the panel and the tests), each loop counted once per round on the line that really marks it, and two kinds added (eligibility questions, deals stopped for safety). Proven by `server/__tests__/loopsEndToEnd.test.ts` (19 tests, real agent code into the same function) and `agentLogCoverage.test.ts` (46 tests, a real sample run for maya, leo, ava, noor, cal, fern), plus the rewritten `client/src/pages/__tests__/AgentWorkspace.test.tsx`.

**Scoreboard (refreshed):** scripts/eval.ts loopCountsOf used raw trace words (sendBacks counted the eligibility challenge, rebuttals counted hunter and lawyer lines, 2 per round). It now uses the shared rules on the run agent log (new fields photoRetries, savedGradesReused, safetyKills; corrections merged into sendBacks). eval.test.ts checks the scoreboard equals the panel rules.

**Loops covered with a fake model (cannot occur in a keyless offline run):** Court rebuttal round, Fact-Checker send-back that re-judges an offer (Court re-argues), photo retry (scripted vision model). **Covered with made-up rows and no model:** eligibility loop, recall verification, safety kill, saved-grade reuse. **Not covered at all offline:** the rebuttal and send-back with a REAL model (Mac `eval:live-model`).

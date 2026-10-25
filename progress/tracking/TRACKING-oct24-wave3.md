# Wave 3 dispatch map (Sat Oct 24, 2026)

Sources: `progress/tracking/bundle-plan-v3.build-tracker.md` (wave 3 section, hot-file table, M-items), `progress/handoffs/HANDOFF-local.md` (hand-off patches), `progress/tracking/TRACKING-oct24-wave2.md` (incl. Mac flip-on results), `qc-reports/W2-*.md`. Wave 2 is merged (6/6). All paths are inside `bundle/` unless noted. Nothing here changes the plan.

Plain-English words: "Zetaris replay" = a saved real Zetaris answer, stored under `data/sample/zetaris-cache/`, looked up by the exact text of the question (the SQL). Replays are only ever made by a live recording run on the Mac (`npm run zetaris:record` or the `*-live` scripts), never by hand. So if a chunk changes the text of a Zetaris SQL question, the old replay no longer matches and sample mode falls back honestly (empty/"unavailable") until someone re-records on the Mac.

Note on "done conditions": the tracker has no per-chunk "Done when"; they live in the M-items. Each chunk below quotes the M-item lines wave 3 must satisfy; "(derived)" lines were written for the tracker.

## Summary table

| Chunk | Goal | Changes Zetaris SQL text? (needs Mac re-record) | Live keys | Fully offline in SAMPLE_MODE=true? | Status |
|---|---|---|---|---|---|
| W3-COURT | Court rebuttal round, newsroom loop, `offer_checks` write-back | No, if it reuses W2-ZREG's `savedVerdicts.ts` queries verbatim (do not edit them). Flag if it needs a new/edited query | None to build; real-AI trace and Court replays are Mac | Yes (fake generator, fake Zetaris, local Postgres) | not started |
| W3-FACT | Targeted corrections, recall verification (loop 8), wrong-state block | Possibly: only if loop 8 reads the recall record through a NEW Zetaris query; prefer using the recall data already in the run (no new SQL) | None | Yes | not started |
| W3-SAFETY | Clawback Hunter and Recall Checker safety-value loop, recallMatch wiring, formula lot line | YES: wiring `recallMatch.ts` into `recall.ts` and the `COALESCE(p.store, p.seller)` fix change `itemsSql`/`pairsSql`/`priceSql`/`fsaSql` text. Mac re-record of those | None | Yes (planted recalled item, fake Zetaris); sample replays go stale until re-recorded | not started |
| W3-ELIG | Benefits Planner and Fine Print Lawyer eligibility loop (loop 2) | YES: the Planner's counter-question is a new Zetaris query (and any edit to existing benefits queries). New replay needed | None | Yes (fake Zetaris) | not started |
| W3-AUDIT | `GET /api/offer-audit`, OpenAPI file, no-family-fields test | YES (new): the endpoint's fixed question text is new/unrecorded (current recorded answer is 0 rows for `v_offer_audit` from `zetaris:record`; if the endpoint reuses that exact text from `savedVerdicts.ts` it does not change). S2 (CPSC per brand) changes the view and query: re-register (`--apply --replace=v_offer_audit`) plus re-record | None to build | Yes (fake Zetaris; honest fallback when no replay) | not started |
| W3-COACH | Coach reads reports through Zetaris | No: reuse `coachIssuesSql()` from `savedVerdicts.ts` unchanged (already recorded: 6 coach issues). Flag if text is edited | None | Yes (fake Zetaris) | not started |
| W3-PANEL | Owner View "How the agents worked together" panel + reviewer-only agent-log route | No | None | Yes | not started |
| W3-VERSIONB | Version B tabs with "+" on every tab, photo "+" button, extras, wording | No | None (photo button in sample mode says "needs the live model") | Yes (screen tests, screenshots) | not started |

---

## Chunk details

### W3-COURT: Fine Print Court rebuttal round + newsroom loop + `offer_checks` write-back
- **Goal:** one strict-max-1 rebuttal round, "approve with a catch" after correction, and the newsroom loop: reuse saved grades (no AI) and write one `offer_checks` row plus one H-MEM lesson after an agreed verdict.
- **Done conditions:**
  - M4 (verbatim): "a run fills `offer_checks`"; "a second offer from the same store uses the first one's grade (value, minutes, payout wait), and the trace shows which past grades and H-MEM lessons were used"; "the 12 tests and 3 controls pass offline (and are reported with real AI)"; "offers show a Value Score with both value and time".
  - M4 (derived): "`approve_with_catch` counts only the true value in totals; "probably not worth your time" follows the four labelled default settings; `payout_wait_days_min` shows "paid in 6-8 weeks" only when the fine print gives both ends."
  - M9 (verbatim part): "rebuttal max 1" shown as rounds in a sample-run trace log.
  - Sunday checkpoint (verbatim): "a disputed offer shows exactly one rebuttal round"; "a second offer's trace shows the past grades and H-MEM lessons used".
- **Owns:** `server/agents/finePrintCourt.ts`, new `server/agents/offerChecks.ts`, new `server/agents/newsroom.ts`, `server/agents/types.ts`, `server/__tests__/finePrintCourt.test.ts`, new `server/__tests__/newsroom.test.ts`, new `server/__tests__/offerChecks.test.ts`.
- **Wave-2 leftovers assigned:**
  - `canSkipAi` / agreed status (W2-ZREG QC nice-to-have 1): already satisfied in `savedVerdicts.ts` (`canSkipAi` returns null unless `status === 'agreed'`, line 123). W3-COURT must only write `agreed` rows and keep a test for it; do not edit `savedVerdicts.ts` (W2-ZREG's file, no owner in wave 3).
  - HANDOFF patch: `finePrintCourt.ts:55` set `OFFLINE_APPROVE_TEXT = "No flagged terms found. We couldn't fully check this offer's fine print."` (currently still "Offline screen: no flagged terms found. Not reviewed by the AI court."), update the test assertions (HANDOFF says lines 172/174).
  - HANDOFF patch: then remove `parentBody` in `server/routes/bundleRoutes.ts` (line 86; used at line 80). That file has no wave-3 owner, so this is a **hand-off patch the orchestrator applies after the court text change lands**, or W3-COURT may be given a one-time grant for those two spots (decision for orchestrator; default: hand-off patch).
  - Wire `AgentContext` workspace use (types.ts is W3-COURT's this wave); other chunks needing a new field on `AgentContext` send a hand-off patch.
- **Depends on:** W1-FP, W2-ZREG, W2-HMEM, W1-DB (all done). No other wave-3 chunk.
- **Live keys:** none to build. Mac: real-AI Court trace; Court replays (`court-live`) need re-recording only if Court's Zetaris text changes.
- **Offline in SAMPLE_MODE=true:** yes, fully. Saved-verdict query falls back to "no saved verdicts" if no replay (never hand-written).
- **Zetaris SQL:** no, as long as `savedVerdicts.ts` queries are reused as is.

### W3-FACT: Fact-Checker targeted corrections + recall verification loop (loop 8) + wrong-state block
- **Goal:** line-specific correction wording (max 2 rounds), recall alert needs evidence checked against the recall record, planted wrong-state card is blocked, confirm/correct signal marks lessons helpful or wrong.
- **Done conditions:**
  - M5 (verbatim): "Recall verification loop (loop 8): every recall alert has passed the Fact-Checker's check against the recall record; a planted match with no evidence produces no alert."
  - M3 (verbatim part): "The `state_agnostic` test passes for Maya (MA), Ava (OH), Noor (NY), Cal (CA) and Fern (FL), including the swap test, the "MA"/"Massachusetts" guard in agent code, and the Fact-Checker blocking a planted wrong-state card."
  - M9 (verbatim part): "send-back / targeted correction max 2 ... recall verification inside the 2-round cap".
- **Owns:** `server/agents/factChecker.ts`, `server/__tests__/factChecker.test.ts`.
- **Wave-2 leftovers assigned:**
  - Wrong-state block (left by W2-STATE; its `stateAgnostic.test.ts` does the rest; add the planted-card case to `stateAgnostic.test.ts` only as a hand-off patch since W3-FACT does not own it, or put the planted-card test inside `factChecker.test.ts`).
  - HANDOFF patch: log the final yes as `approve_card` / `approved` / target `ParentFeed` (the `factChecker.ts` half; the orchestrator half stays W4-ORCH). W2-PURCH QC confirms `dcfsa` claim removal is done; unknown claim types fail closed (keep).
  - Evidence line for every recall alert, not only code matches (W2-PURCH QC nice-to-have) is verified here as part of loop 8 (the producing side is W3-SAFETY).
- **Depends on:** W2-PURCH, W2-HMEM, W2-STATE (all done). Soft link to W3-SAFETY: the alert shape (evidence line field) comes from recall.ts; agree the field name in the brief (see overlap risks).
- **Live keys:** none. **Offline:** yes, fully.
- **Zetaris SQL:** not required. Existing `quoteInt(claim.itemId)` verification SQL against `v_purchase_items` stays as is. If the builder needs a new recall-record query, flag it in the report: needs a Mac re-record.

### W3-SAFETY: Clawback Hunter and Recall Checker safety-value loop (loop 1)
- **Goal:** before publishing a price drop or rebate, the Clawback Hunter asks the Recall Checker through the workspace; a CPSC/FDA recall kills the deal before the Judge ("do not encourage buying or claiming a rebate on this item").
- **Done conditions:**
  - M9 (verbatim part): "the safety-value loop kills a planted recalled item's deal before the Judge".
  - M5 (verbatim): "Matching checks exact codes first (UPC, model number, lot code) from `purchase_items` only, then brand + product type from a fixed list, sale dates, seller and size/model clash, with an evidence line on each alert; the known fixes ("sold in April 2026" dates; "pad/liner/insert") are in."; "Formula recall cards keep the "check the lot number on the can" line."; "The `no_false_recall` test passes (Maya's run does not show CPSC 10490 or 10453), offline and (on the Mac) with real AI."
  - M8 (verbatim): "the recall check finds a planted recalled item through Zetaris, with its evidence line".
- **Owns:** `server/agents/clawback.ts`, `server/agents/recall.ts`, `server/__tests__/clawback.test.ts`, `server/__tests__/recall.test.ts`.
- **Wave-2 leftovers assigned (all from W2-PURCH QC):**
  - Wire `server/agents/recallMatch.ts` (W1-RECALL matcher) into `recall.ts` (today imported by no agent).
  - Evidence line on every alert (exact-name and model-confirmed too).
  - "Check the lot number on the can" line for formula recalls (missing in all server code).
  - `COALESCE(p.store, p.seller)` in clawback joins so seller-only receipts get money-back cards.
  - Real recall records only (plan item 36); no invented recalls in tests beyond clearly planted made-up `purchase_items`.
- **Depends on:** W2-PURCH, W2-HMEM, W1-RECALL (done). Soft link to W3-FACT (alert evidence field name).
- **Live keys:** none to build. Mac: re-record (`zetaris:record` for `itemsSql`/`pairsSql`/`finishedFdaSql`/`fsaSql`/`priceSql`, then `agents-live`, `examples:regen -- --live`) after any SQL text change.
- **Offline:** yes (fake Zetaris + planted item). Sample-mode replays go stale after SQL changes; eval `maya`/`ava` money-back would show 0 until re-record, so keep the recorded SQL text unchanged where possible and batch all text changes into one re-record.
- **Zetaris SQL:** YES, changes expected (see Summary). Re-record on the Mac afterward; never hand-written.

### W3-ELIG: Benefits Planner and Fine Print Lawyer eligibility loop (loop 2)
- **Goal:** the Lawyer tries to disprove eligibility; one counter-question using only data we have; the Planner asks Zetaris and confirms or drops the benefit.
- **Done conditions:**
  - M9 (verbatim part): "the eligibility loop drops or confirms a benefit after one Zetaris counter-question".
  - M3 (verbatim parts that stay true): "No agent code names a state; every 3-digit ZIP prefix is loaded; an uncovered state shows federal programs plus "Support for your state's programs is coming soon", never an error."; "The Dependent Care FSA is a "Check with your job" card for every family (no dollar amount, not in the total)".
- **Owns:** `server/agents/benefits.ts`, new `server/agents/eligibilityLawyer.ts`, `server/__tests__/benefits.test.ts`, new `server/__tests__/eligibilityLawyer.test.ts`.
- **Wave-2 leftovers assigned:**
  - "Coming soon" card/state note: W2-STATE QC must-fix 1 is already fixed on main (`client/src/lib/onboarding.ts` now `COVERED_STATES = ['CA','MA','NY']`). Still open: `benefits.ts:124` logs the coming-soon note to the trace only; decide whether the server exposes it on the run result (needs a `shared/bundle.ts` field = W3-VERSIONB hand-off). Default: expose it as a normal info card so no new field is needed.
  - NY_PFL / CA_PFL `verified` flags in `data/sample/state-programs.json` (W2-STATE nice-to-have): the file is not owned by any wave-3 chunk; W3-ELIG may edit it for this purpose only (no other wave-3 chunk touches it).
  - Counter-question uses only item 35 data (state, due/birth date, ZIP, `tax_parameters`, `state_programs`).
- **Depends on:** W2-STATE, W2-HMEM (done).
- **Live keys:** none to build. Mac: record the new counter-question replay and re-record any edited benefits queries (`benefits-live`).
- **Offline:** yes (fake Zetaris). Without a replay the loop must fall back honestly (keep the benefit as "Not yet verified").
- **Zetaris SQL:** YES (new counter-question query; flag any edited existing query).

### W3-AUDIT: `GET /api/offer-audit` + OpenAPI
- **Goal:** a fixed, rate-limited, family-free data endpoint over `v_offer_audit`, with an OpenAPI file.
- **Done conditions:** M4 (verbatim): "`/api/offer-audit` answers, with its OpenAPI file." (derived): "with no family fields"; saved answers in sample mode, honest fallback when none recorded. S2 (derived, if time): "`/api/offer-audit` returns an open-recall count per brand from the live CPSC feed through Zetaris, still with no family fields, and the OpenAPI file describes it."
- **Owns:** new `server/routes/offerAuditRoutes.ts`, new `docs/openapi/offer-audit.yaml`, new `server/__tests__/offerAudit.test.ts`.
- **Wave-2 leftovers assigned:** route registration in `server/routes/index.ts` is a hand-off patch (orchestrator). If S2 is built, the view change lives in `scripts/zetaris/register.ts` (W2-ZREG file, no owner this wave): hand-off patch + Mac `register.ts --apply --replace=v_offer_audit`.
- **Depends on:** W2-ZREG (done). Soft link: reads rows that W3-COURT writes (offline test uses fake Zetaris, so no hard dependency).
- **Live keys:** none to build (Zetaris for recording). **Offline:** yes.
- **Zetaris SQL:** if it reuses the existing recorded `v_offer_audit` text exactly, no. Any new text (including S2) needs a Mac re-record. Default: reuse the recorded text.

### W3-COACH: Coach reads reports through Zetaris + CoachAI trace lines
- **Goal:** `listRecentIssues` goes through the Zetaris view `v_coach_feedback` instead of reading Neon directly.
- **Done conditions:** M12 (verbatim): "no agent reads agent input from Neon directly; the tests use a fake Zetaris for both reads; sample mode still works (falling back honestly until the saved answers are recorded)." (the family-profile read is W4-ORCH). M1 learning loop (verbatim part): "the learning loop (report twice, approve, run again, offer blocked) still passes end to end".
- **Owns:** `server/bundleStore.ts`, `server/agents/coach.ts`, `server/__tests__/coach.test.ts`.
- **Wave-2 leftovers assigned:** use `coachIssuesSql()` from `savedVerdicts.ts` as is (already live-recorded: 6 coach issues, W2 Mac results). The only caller, `server/routes/bundleRoutes.ts:305`, has no wave-3 owner: hand-off patch (orchestrator) to pass a Zetaris-backed reader into it, or add a store method that `bundleRoutes` already calls so no route edit is needed (preferred). Also note W2-RESULTS nice-to-have 4: after a restart, guest family ids 404 (info for W4-STREAM, not here).
- **Depends on:** W2-ZREG, W2-RESULTS (done).
- **Live keys:** none to build. **Offline:** yes (fake Zetaris; sample mode uses the recorded replay or falls back honestly).
- **Zetaris SQL:** no, unless the builder edits the text of `coachIssuesSql` (do not).

### W3-PANEL: Owner View Agent Workspace / Trace panel
- **Goal:** reviewer-only `GET /api/runs/:runId/agent-log` and a panel grouping log lines per card and loop beside the H-MEM workspace notes.
- **Done conditions:** M11 (verbatim part): "the owner view's Agent Workspace / Trace panel, behind the reviewer code, shows each loop's rounds for that run (send-backs, the rebuttal round, photo retries, recall verifications, saved verdicts reused); the parent view never shows it." M9 (verbatim part): "the Owner View Agent Workspace / Trace panel shows those rounds." Sunday checkpoint: "the trace panel shows the loops for a sample run".
- **Owns:** new `server/routes/agentLogRoutes.ts`, new `client/src/pages/AgentWorkspace.tsx`, new `client/src/pages/__tests__/AgentWorkspace.test.tsx`, new `server/__tests__/agentLogRoutes.test.ts`.
- **Wave-2 leftovers assigned:**
  - Route registration in `server/routes/index.ts` and the panel mount point (Owner view lives in `Feed.tsx`/`App.tsx`, owned by W3-VERSIONB) are hand-off patches: W3-PANEL exports the component and route; the orchestrator or W3-VERSIONB mounts it.
  - Note from W2 integration QC: `workspace_open` is defined in `workspace.ts:72` but nothing wires it (W4-ORCH); the panel must cope with its absence.
  - Test logs must come from real sample-mode runs inside the test (never hand-written files).
  - W2-HMEM nice-to-have 4: workspace redaction of `from_agent`/`to_agent`/`about` (file `server/agents/workspace.ts`, unowned this wave): optional hand-off patch.
- **Depends on:** W1-TRACE, W1-OWNER, W2-HMEM (done). Soft link: the panel is richer once W3-COURT/FACT/SAFETY/ELIG emit loop rounds, but it must pass on today's log lines; the full "loops visible" check is W5-COVERAGE.
- **Live keys:** none. **Offline:** yes. **Zetaris SQL:** no.

### W3-VERSIONB: Version B tabs with "+" on every tab
- **Goal:** the five-tab Version B screen (Home, Taxes, Savings, Insurance, Deals) from the mocks, "+" opens "take a photo", expecting-family variants and light extras.
- **Done conditions:**
  - M6 (verbatim): "Version B tabs Home, Taxes, Savings, Insurance, Deals, each with a "+" button that opens "take a photo"."; "Expecting families: Home leads with free gifts; deadlines say "starts at birth"."; "Light extras: "I got this" tick with "$ claimed" on Home, small share bar, "Save your list" card."; "Wording: "savings and tax credits" (not "cash") with "How we got this number"; Dependent Care FSA uses the "Check with your job" card; ZIP is typed (at most a "Use my location" button); no daycare invoice card."; "All numbers come from the real run; screen tests pass for both "expecting" and "baby's here"."
  - S4 (derived): record the Google sign-in estimate in the report; "if it is over 3 hours, the Save card ships as a labelled demo".
- **Owns:** `client/src/App.tsx`, `client/src/pages/Feed.tsx`, `client/src/lib/bundle.ts`, `client/src/components/AppShell.tsx`, `client/src/components/FeedCardView.tsx`, `client/src/components/ReceiptCard.tsx`, new `client/src/pages/tabs/`, new `client/src/components/AddPurchaseButton.tsx`, `shared/bundle.ts`, and their tests.
- **Wave-2 leftovers assigned:**
  - `client/src/lib/howWeChecked.ts` labels: the QC must-fix (point clawback/recall matchers at `v_purchase_items`) is already done on main (the matchers now include `v_purchase_items`). Remaining: verify labels against the current evidence SQL of the recall/clawback cards after W3-SAFETY merges (the file has no wave-3 owner; give it to W3-VERSIONB since it renders "How we got this number").
  - "Coming soon" state card: `FeedCardView.tsx` / `bundle.ts` already mention it; make sure the tabs show the federal-plus-"coming soon" message for uncovered states; any new run-result field (e.g. exposed coming-soon note) goes in `shared/bundle.ts` (W3-VERSIONB owns it this wave).
  - Value Score and "We caught these for you" on cards; "Check with your job" card.
  - Minor, from W2 integration QC: guest offer cards show a deadline a year after the due date (2027-12-20); maya/leo offers show "info" while guests show "likely". Report it; the cause is in agents (W3-COURT/W4-ORCH), not here.
  - Mount W3-PANEL's `AgentWorkspace` in the owner view (consumes W3-PANEL's export; a hand-off patch if W3-PANEL is not merged yet).
  - Checking screen hand-off from W1-ONB into Version B Home; photo "+" uses W2-PHOTO's route (`/api/photo/read`, already registered).
- **Depends on:** W1-ONB, W1-OWNER, W1-FP, W2-PHOTO, W2-RESULTS (done).
- **Live keys:** none (photo in sample mode says "photo reading needs the live model" until NVIDIA recording on the Mac). **Offline:** yes (screen tests + screenshots against `onboarding-design/project/Nav*.dc.html`). **Zetaris SQL:** no.

---

## Dependencies between wave-3 chunks

No hard dependencies: every chunk's real inputs are already merged. Soft links (agree interfaces up front, no ordering required):
- W3-SAFETY and W3-FACT: the recall-alert evidence-line field name and the "recall verification" workspace message type (W3-FACT checks what W3-SAFETY produces).
- W3-PANEL and W3-VERSIONB: panel component export versus its mount in `Feed.tsx`/`App.tsx`.
- W3-COURT and W3-AUDIT: `offer_checks` columns (fixed by W1-DB, so just read the schema).
- W3-COURT, W3-FACT, W3-SAFETY, W3-ELIG all post workspace notes through W2-HMEM's `workspace.ts` (read-only use; if one needs a new message type it goes as a hand-off patch).
- W3-COURT owns `server/agents/types.ts`; others needing an `AgentContext` change send a hand-off patch.

## Parallel groups

**File overlap check (declared owned files):** none of the eight chunks owns the same file, so all eight can run at once under the tracker's own rule. The hot-file table gives each wave-3 hot file exactly one owner (`factChecker.ts` FACT, `recall.ts`/`clawback.ts` SAFETY, `benefits.ts` ELIG, `finePrintCourt.ts`/`types.ts` COURT, `bundleStore.ts` COACH, `Feed.tsx`/`App.tsx`/`bundle.ts`/`shared/bundle.ts` VERSIONB).

Real risks come from files with NO wave-3 owner that several chunks need hand-off patches for (applied by the orchestrator after the wave, one at a time):
- `server/routes/index.ts` (AUDIT, PANEL register routes), `package.json`, `.env.example`.
- `server/routes/bundleRoutes.ts` (COURT parentBody removal, COACH issue read caller).
- `server/agents/savedVerdicts.ts`, `scripts/zetaris/register.ts` (shared Zetaris SQL text; AUDIT S2, any SQL edit).
- `server/agents/workspace.ts` (shared by FACT/SAFETY/ELIG/COURT/PANEL).
- `data/sample/state-programs.json` (ELIG only, by agreement).
- Test data: all chunks use the local Postgres test DB; give each worktree its own test database name or port (same caution as wave 2). Also `npm test` once hung 28 minutes in wave 2 (W2 integration QC; HANDOFF says a Postgres connection fix landed in `1a4c74b`); run with a timeout.
- The Zetaris cache directory `data/sample/zetaris-cache/` and `logs/scoreboard.json` / `output_examples/learning/*.jsonl` are rewritten by test/eval runs: builders must `git checkout` them before reporting (W2 integration QC did this).
- Several loop chunks all write to the same trace log and workspace conventions: same helper (`withTrace`), no schema change.

**Recommended batches (to keep the Zetaris re-record to a single Mac session and limit review load):**
- **Batch A (agent logic, run together, 5 chunks):** W3-COURT, W3-FACT, W3-SAFETY, W3-ELIG, W3-COACH. Their owned files are disjoint. W3-SAFETY and W3-ELIG are the two that change Zetaris SQL text; do one Mac re-record after both merge.
- **Batch B (screens and endpoints, run together, 3 chunks):** W3-VERSIONB, W3-PANEL, W3-AUDIT. Disjoint files; W3-PANEL mount in `Feed.tsx` lands with W3-VERSIONB or as an orchestrator hand-off patch right after.
- Batches A and B can also run at the same time (no shared owned files). If fewer helpers are wanted: Batch 1 = COURT, FACT, SAFETY, PANEL; Batch 2 = ELIG, COACH, AUDIT, VERSIONB.
- Cut order if time runs short (tracker): keep W3-FACT, then W3-SAFETY, then W4-STREAM, then W3-ELIG.

## Zetaris SQL changes, Mac re-record list (for after wave 3)

1. W3-SAFETY: `itemsSql`, `pairsSql`, `finishedFdaSql`, `fsaSql`, `priceSql` (recall/clawback queries) if text changes. Re-run `zetaris:record`, `agents-live`, then `examples:regen -- --live`.
2. W3-ELIG: new Planner counter-question query, plus any edited benefits query (`benefits-live`).
3. W3-AUDIT: endpoint query text, only if new; S2 also needs `register.ts --apply --replace=v_offer_audit`.
4. W3-FACT: only if a new recall-record query is introduced.
5. W3-COURT, W3-COACH: none, provided `savedVerdicts.ts` text is untouched (reviewer check: diff of `server/agents/savedVerdicts.ts` and `scripts/zetaris/register.ts` should be empty for these).

Until the Mac re-record happens, sample mode must keep working honestly (empty or "unavailable" results, never made-up replays); the five red replay tests noted in wave 2 (eval/sampleMode) were resolved by the live flip-on, so wave-3 SQL edits will re-open them.

## Status

| Chunk | Status |
|---|---|
| W3-COURT | merged (QC pass), commit efbea76; parentBody removed |
| W3-FACT | merged (QC pass), commit 882284f; 2 reds until re-record (eval.test.ts 6 traps; sampleMode.test.ts:104) |
| W3-SAFETY | merged (QC pass), commit e24b8ca; needs re-record (recallDetailsSql new; itemsSql/pairsSql stale after Maya date change) |
| W3-ELIG | merged (QC pass), commit ec65643; needs live record of eligibilityCounterSql for MA/NY/CA |
| W3-AUDIT | merged (QC pass), commit 3703b70; router registered in 11085e5 |
| W3-COACH | merged (QC pass), commit 1e1b006 |
| W3-PANEL | merged (QC pass), commit 2f5e090; router registered in 7adb291; mount pending VERSIONB |
| W3-VERSIONB | merged (QC pass), commit 095f1ab; panel mounted |

## Post-wave fixes
- Deadline fix: max_age_days is an eligibility limit, not an end date; cards say "Fits babies up to N months old." (merge 256d653)
- State patch: family state now sent to the client for the coming-soon card; whitelist test asserts exactly name/birthDate/dueDate/state (cce546a)

## Mac live re-record (wave 3)

- Neon: `npm run seed` only (no db:push, no SQL). Maya's KEAWIS crib mattress is 2025-03-10 in Neon.
- Zetaris views: `scripts/zetaris/register.ts` unchanged since wave 2 (no diff vs 62c5f24), so register was skipped.
- Recorded live with the existing scripts: `zetaris:record`, `agents-live`, `benefits-live`, `court-live` (twice: once with the Nemotron court, once with the model switched off so the planted free-box trap reaches the Fact-Checker query), `examples:regen -- --live` (run with the model switched off so the court is the offline screen, as the replay tests expect). Transient Zetaris thrift errors passed on retry after waiting.
- Tests: 848 passed, 2 failed, 11 skipped. tsc clean, build OK. Offline eval: 6/6 traps caught, 0 false alarms, learning flip OK; money back maya $48.99, leo $0, ava $14.58.
- OPEN (needs Lyndsay's decision): the 2 failures are `tabs.test.tsx` (sends every real card to one tab) and the "I got this" claims test. They hardcode the card id `clawback-fsa-4`, but re-seeding gave Maya's purchase row id 15 (Neon's counter keeps counting up), so the card is now `clawback-fsa-15`/`clawback-price-16`. Fix is either restart that counter and re-seed + re-record, or change the ids in those two tests. Not done: both need a go-ahead.

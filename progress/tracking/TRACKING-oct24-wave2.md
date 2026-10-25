# Wave 2 dispatch map (Sat Oct 24, 2026)

Source: `progress/tracking/bundle-plan-v3.build-tracker.md` (wave 2 section, hot-file table, M-items) and `progress/handoffs/HANDOFF-local.md`. Wave 1 is merged (7/7 QC-passed, 460 tests passing). All paths are inside `bundle/` unless noted. Nothing here changes the plan.

Note on "done conditions": the tracker gives no separate "Done when" line per chunk. Done conditions live in the M-items (must-do items); each chunk below quotes the lines of its M-item(s) that wave 2 has to satisfy. Lines the tracker marks "(derived)" are flagged.

## Summary table

| Chunk | Goal (one line) | Needs live keys? | Fully offline (SAMPLE_MODE=true)? | Status |
|---|---|---|---|---|
| W2-ZREG | Zetaris registration scripts, saved-verdict query (#38), `zetaris:record` command | Only for the Mac flip-on (Zetaris) | Yes for code and tests (local Postgres + fake Zetaris); real registration/recording is blocked on keys | merged (QC pass, commit 0e89f42) |
| W2-STATE | Any US state, middle-class rules, tax/state data, "Check with your job" | None to build; Mac recording run for Planner replay | Yes (fake Zetaris) | merged (QC pass), commit 8cd7015 |
| W2-PURCH | `purchase_items` as the only purchase source, drop daycare card and Plaid | None | Yes (fake Zetaris) | merged (QC pass; 4 replay tests red until live zetaris:record), commit 85009a1 |
| W2-PHOTO | Photo intake with NVIDIA vision, one retry loop (loop 7) | NVIDIA key only for recording saved vision answers | Yes (fake vision server); sample mode says "needs live model" until recorded | merged (QC pass, commit fb54a8e) |
| W2-HMEM | Shared agent workspace notes on Meterless H-MEM | None (H-MEM runs locally from `data/hmem`) | Yes | merged (QC pass, commit 9d98df0) |
| W2-RESULTS | Save finished runs to `run_results` (#20), run event hub | Neon only for the Mac `db:push` check | Yes (local Postgres + in-memory store) | merged (QC pass, commit f26c350) |

## Chunk details

### W2-ZREG: Zetaris registration scripts + saved-verdict query (#38) + record command
- **Goal:** register the new tables and safe views with Zetaris, add one exported saved-verdict SQL function, and a `zetaris:record` command that saves live answers.
- **Done conditions (verbatim, from M4 / M12):**
  - M4: "Zetaris answers the 'truly free and not recalled' question"
  - M4 (derived): "the saved-verdict query reads `offer_checks` through `v_offer_verdicts` (no family data) and falls back to 'no saved verdicts' in sample mode until a live recording exists"
  - M12: "no agent reads agent input from Neon directly; the tests use a fake Zetaris for both reads; sample mode still works (falling back honestly until the saved answers are recorded)." (the two views for the rerouted reads are built here; the agent-side switch is W3-COACH and W4-ORCH)
- **Owns:** `scripts/zetaris/register.ts`, new `scripts/zetaris/record.ts`, new `server/agents/savedVerdicts.ts`, new `server/__tests__/register.test.ts`, new `server/__tests__/savedVerdicts.test.ts`.
- **Depends on:** W1-DB (done), W1-TRACE (done). No wave-2 chunk dependencies. Reads the `purchase_items` column contract from W1-DB (not W2-PURCH).
- **Live keys/accounts:** Zetaris (register `--apply`, record). Neon not needed to build.
- **Offline build/test:** yes for everything except the real registration and recording. Mac flip-on: `register.ts --apply --replace=...`, `npm run zetaris:record`, commit new files in `data/sample/zetaris-cache/`. Saved answers are never hand-written. Open question 11: only a live `--apply` proves Zetaris accepts the view wording.
- **Hand-off patches for orchestrator:** the `zetaris:record` script entry in `package.json` (script name already reserved by W1-DB).

### W2-STATE: any-state, middle-class rules
- **Goal:** remove poverty/WIC, make every agent state-agnostic, seed tax and state-program data, load every 3-digit ZIP prefix.
- **Done conditions (verbatim, M3, all derived):**
  - "Poverty/WIC rule, table, query, tests and label are gone, and exact income is no longer read."
  - "`tax_parameters` and `state_programs` exist with year and source link per row, and are registered in Zetaris (registration on the Mac checklist)."
  - "No agent code names a state; every 3-digit ZIP prefix is loaded; an uncovered state shows federal programs plus 'Support for your state's programs is coming soon', never an error."
  - "The Dependent Care FSA is a 'Check with your job' card for every family (no dollar amount, not in the total); the employer box and `dcfsaOffered` are gone."
  - "The `state_agnostic` test passes for Maya (MA), Ava (OH), Noor (NY), Cal (CA) and Fern (FL), including the swap test, the 'MA'/'Massachusetts' guard in agent code, and the Fact-Checker blocking a planted wrong-state card." (the Fact-Checker blocking part is W3-FACT; W2-STATE does the rest)
  - "Deck slide 2 no longer uses the WIC statistic (slide change handed to Lyndsay or the deck owner)." (hand to Lyndsay, not code)
- **Owns:** `server/agents/benefits.ts`, `shared/schema.ts` (poverty table removal), `scripts/seed.ts`, `server/sampleZips.ts`, `data/sample/families.json`, `data/sample/fallback-rules.json`, new `data/sample/tax-parameters.json`, new `data/sample/state-programs.json`, new `data/sample/zip3-states.json`, `server/__tests__/benefits.test.ts`, `server/__tests__/seed.test.ts`, new `server/__tests__/stateAgnostic.test.ts`, `input_examples/` (new families).
- **Depends on:** W1-DB (done). Soft link: W2-ZREG registers the tables it seeds (no code dependency).
- **Live keys/accounts:** none to build. Offline replay of the new Planner questions needs a recording run (Mac list).
- **Offline build/test:** yes, fully, with a fake Zetaris.

### W2-PURCH: `purchase_items` as the only purchase source (#8, #9), daycare drop (#10), Plaid clean-up
- **Goal:** Recall Checker and Clawback Hunter read only `purchase_items`; remove card-style data, Plaid and the daycare card.
- **Done conditions (verbatim, M5 and M8 derived parts that fall in wave 2):**
  - M5: "Matching checks exact codes first (UPC, model number, lot code) from `purchase_items` only, then brand + product type from a fixed list, sale dates, seller and size/model clash, with an evidence line on each alert; the known fixes ('sold in April 2026' dates; 'pad/liner/insert') are in."
  - M5: "Formula recall cards keep the 'check the lot number on the can' line."
  - M5: "The `no_false_recall` test passes (Maya's run does not show CPSC 10490 or 10453), offline and (on the Mac) with real AI."
  - M8 (derived): "recall matching and money-back cards read only `purchase_items` (no agent reads `transactions` or `plaid-transactions.json`); the daycare invoice card and its data are gone; sample families still get money-back cards in sample mode."
  - M8: "the recall check finds a planted recalled item through Zetaris, with its evidence line" (full proof needs W2-ZREG's views; here against a fake Zetaris)
  - Tracker note: Maya's $48.99 money-back total will change; report the new number.
- **Owns:** `server/agents/recall.ts`, `server/agents/clawback.ts`, `server/agents/factChecker.ts`, `shared/bundle.ts`, `server/ingest/plaid.ts` (delete), new `server/ingest/purchaseItems.ts`, `data/sample/plaid-transactions.json` (delete), new `data/sample/purchase-items.json`, `server/__tests__/recall.test.ts`, `server/__tests__/clawback.test.ts`, `server/__tests__/factChecker.test.ts`, `server/__tests__/ingest.test.ts`.
- **Depends on:** W1-DB, W1-RECALL, W1-TRACE (all done). Reads family ids in `data/sample/families.json` (owned by W2-STATE) but does not edit it.
- **Live keys/accounts:** none.
- **Offline build/test:** yes, fully with a fake Zetaris.

### W2-PHOTO: photo intake with NVIDIA vision + photo retry loop (loop 7)
- **Goal:** photo upload to `purchase_items` rows with field checks, exactly one retry, then a "clearer photo / close-up" request; photo deleted after reading.
- **Done conditions (verbatim, M8):**
  - "the photo path puts rows into `purchase_items` (and, after the hackathon, each other path that is built);"
  - "the recall check finds a planted recalled item through Zetaris, with its evidence line;"
  - "no name, address, raw email or photo is stored anywhere."
  - (derived) "a bad first reading triggers exactly one retry to the vision model with what was wrong, then a 'clearer photo / close-up' request"
  - M9 (photo retry part): "photo retry max 1" shown as rounds in a sample-run trace log.
  - Sunday checkpoint: "a sample photo becomes a `purchase_items` row and a bad reading triggers one retry then a 'clearer photo' request"
- **Owns:** new `server/ingest/photo.ts`, new `server/routes/photoRoutes.ts`, new `client/src/lib/photoPrep.ts`, new `data/sample/photos/`, new `data/sample/vision-cache/` (written only by the recorder), new `scripts/record-vision.ts`, new `server/__tests__/photo.test.ts`, new `client/src/lib/__tests__/photoPrep.test.ts`.
- **Depends on:** W1-LLM (`see()`), W1-DB, W1-TRACE (all done). No wave-2 chunk dependency (inserts rows into `purchase_items` by the W1-DB table shape; the sample-family item rows are W2-PURCH's).
- **Live keys/accounts:** NVIDIA, only for `npm run model:check -- --vision` and `record-vision` (Mac). Open question 8: Nightshift vision routing undocumented, plan assumes NVIDIA direct.
- **Offline build/test:** yes, against a fake vision server (good reading; bad then good; bad twice leads to "clearer photo"). Sample mode shows "photo reading needs the live model" until a real recording exists (open question 7). Saved vision answers are never hand-written.
- **Hand-off patches for orchestrator:** register `photoRoutes` in `server/routes/index.ts`; `record-vision` script entry in `package.json`.

### W2-HMEM: shared workspace on Meterless H-MEM
- **Goal:** agents post and read notes per run and item through a shared workspace on H-MEM; lessons point at `offer_checks` rows; helpful/wrong feedback; every note copied to the trace.
- **Done conditions:** the tracker has no dedicated M-item line for this chunk. Closest verbatim lines: M4 "a second offer from the same store uses the first one's grade (value, minutes, payout wait), and the trace shows which past grades and H-MEM lessons were used" (finished in W3-COURT using this workspace), and M11 "the owner view's Agent Workspace / Trace panel ... shows each loop's rounds" (W3-PANEL). Scope check for this chunk: item 37 message format `{run_id, from_agent, to_agent, type, about, body, evidence_sql, round}`; "no AI extraction, dreaming or sleep during a run"; "each note copied as a trace line; ledger export unchanged".
- **Owns:** `server/adapters/memory.ts`, new `server/agents/workspace.ts`, `server/agents/types.ts` (add the workspace to `AgentContext`), `server/__tests__/memory.test.ts`, new `server/__tests__/workspace.test.ts`.
- **Depends on:** W1-TRACE (done).
- **Live keys/accounts:** none (H-MEM runs locally from `data/hmem`). Meterless's Sunday update may rename settings (open question 12).
- **Offline build/test:** yes, fully.

### W2-RESULTS: Neon results table (#20) + run event hub
- **Goal:** save every finished run to `run_results`, read it back after restart, and define the event hub W4 will use.
- **Done conditions (verbatim, M10):** "a run's result is still served after a server restart; a clean download with `SAMPLE_MODE=true` and no keys can run the sample families and read back their saved results; a test covers both."
- **Owns:** `server/bundleStore.ts`, `server/routes/bundleRoutes.ts`, `client/src/lib/bundle.ts`, new `server/agents/runEvents.ts`, new `server/__tests__/runResults.test.ts`, new `server/__tests__/runEvents.test.ts`.
- **Depends on:** W1-DB, W1-OWNER (both done). Hub contract is consumed later by W4-ORCH and W4-STREAM.
- **Live keys/accounts:** Neon only for the Mac `npm run db:push` (creates the 5 new tables incl. `run_results`).
- **Offline build/test:** yes, on local Postgres and the in-memory store (restart test).

## Hand-off patches from progress/handoffs/HANDOFF-local.md: which belong to wave 2

| Patch | Belongs to |
|---|---|
| Server ZIP list (`server/sampleZips.ts`): any US ZIP must work | **W2-STATE** (owns the file) |
| `server/agents/orchestrator.ts`: per-agent `withTrace(trace, agentName)` connection | Wave 4 (W4-ORCH), not wave 2 |
| `factChecker.ts` / orchestrator: log final yes as `approve_card` / `approved` / `ParentFeed` | Wave 4 (orchestrator part). Note: W2-PURCH owns `factChecker.ts` this wave, so it could carry the factChecker half; otherwise leave to W4-ORCH. Orchestrator decision needed. |
| `finePrintCourt.ts:55` `OFFLINE_APPROVE_TEXT` (+ test lines 172/174), then remove `parentBody` in `bundleRoutes.ts` | Court file is W3-COURT. The `bundleRoutes.ts` part touches a wave-2 file (W2-RESULTS owns it), but `parentBody` removal depends on the court change, so do it after W3-COURT or hand it to W2-RESULTS only if the court text change lands first. Not safe to include in wave 2 as is. |
| `scripts/eval.ts`: check `no_false_recall`, `no_terminated_fda` in `evals/expected.json` | Wave 5 (W5-EVALS) |
| `.env.example`: add new settings (Nightshift/model, `WORTH_*`, `EFFORT_*`, `TEST_DATABASE_URL`, `AGENT_LOG_STDOUT`) | Orchestrator, any time in wave 2 (not owned by a wave-2 chunk; W5-DOCS owns it in wave 5) |

New wave-2 registration patches the orchestrator applies after the wave (not from HANDOFF): route registration for `photoRoutes` in `server/routes/index.ts`, `package.json` scripts `zetaris:record` and `record-vision`, any new seed call in `scripts/seed.ts` is W2-STATE's own.

## Parallel groups

**Group A (all six can be built at the same time).** The owned-file lists have no overlap: ZREG = `scripts/zetaris/*`, `savedVerdicts.ts`; STATE = `benefits.ts`, `shared/schema.ts`, `seed.ts`, `sampleZips.ts`, `data/sample/{families,fallback-rules,tax-parameters,state-programs,zip3-states}.json`, `input_examples/`; PURCH = `recall.ts`, `clawback.ts`, `factChecker.ts`, `shared/bundle.ts`, `ingest/purchaseItems.ts`, `data/sample/purchase-items.json`; PHOTO = new `ingest/photo.ts`, `routes/photoRoutes.ts`, `photoPrep.ts`, `data/sample/photos|vision-cache`; HMEM = `adapters/memory.ts`, `workspace.ts`, `agents/types.ts`; RESULTS = `bundleStore.ts`, `bundleRoutes.ts`, `client/src/lib/bundle.ts`, `runEvents.ts`.

Cautions when running them together:
1. Use one separate worktree per chunk. All six use the local Postgres test DB (`npm run db:test`): give each worktree its own test database name or port, or tests can collide.
2. W2-PURCH adds `data/sample/purchase-items.json` keyed by the sample family ids, and W2-STATE edits `data/sample/families.json` (and adds new families). Tell PURCH to read family ids as they are on main and not touch `families.json`; STATE should not rename existing family ids. Any rows for the new families are added by the orchestrator after the wave.
3. Orchestrator applies registration patches (`routes/index.ts`, `package.json`, `.env.example`) after the wave, then runs `npx tsc --noEmit && npm test` on the merged result.

If fewer parallel helpers are wanted, a safe split into two batches is: batch 1 = W2-HMEM, W2-RESULTS, W2-ZREG, W2-PHOTO (all mostly new files); batch 2 = W2-STATE, W2-PURCH (touch existing agent code and sample data).

## Blocked on live keys/accounts (only for the final flip-on, not for building)

- W2-ZREG: Zetaris (register `--apply`, `zetaris:record`).
- W2-PHOTO: NVIDIA (`model:check -- --vision`, `record-vision`).
- W2-RESULTS: Neon (`db:push`).
- W2-STATE: a live recording run for the new Planner questions.
- W2-HMEM and W2-PURCH: nothing.
No wave-2 chunk is blocked from being built and tested offline.

## Integration patches applied (after W2-STATE merge, commit 8cd7015)

- a. DONE: `server/routes/index.ts` registers `createPhotoRouter()`.
- b. DONE: `record-vision` script added to `package.json` (`zetaris:record` already existed).
- c. DONE: receipt vision default is now `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` in `server/adapters/llm.ts` and `llm.test.ts`. Other mentions of the retired id are only in plan/research docs and a comment in `server/ingest/photo.ts` explaining the retirement; left as history.
- d. DONE: `.env.example` lists NIGHTSHIFT_*, MODEL_PROVIDER/JUDGE/THINKING/MAX_TOKENS/TIMEOUT_SECONDS, MODEL_VISION, MODEL_VISION_RECEIPT, LIVE_MODEL, RUN_DEADLINE_SECONDS, WORTH_*, EFFORT_*, AGENT_LOG_STDOUT, FRONTEND_URL, TEST_DATABASE_URL, RUN_DB_TESTS (names and blank placeholders only).
- e. DONE: root cause was the earlier `isLocalDatabaseUrl` test importing `server/db.ts` with a hard-coded port-5432 URL, and Jest caching that copy. Fix: that test defaults to TEST_DATABASE_URL, and the live test calls `jest.resetModules()` before importing `db`.
- f. DONE: `scripts/db-test-setup.sh` has a macOS path (Homebrew postgresql@16, `brew services start`, no sudo/postgres user) next to the Linux one.
- g. DONE: `SEED_FAMILY_IDS` now includes noor, cal, fern (`bundleRoutes` reads that list, so no separate whitelist); demoDate test extended. `scripts/eval.ts` FAMILIES left at the 3 trap families on purpose.
- h. DONE: `poverty_guidelines` label removed from `client/src/lib/howWeChecked.ts`.
- i. DONE: new migration `migrations/0001_drop_poverty_guidelines.sql` (`DROP TABLE IF EXISTS`) plus drizzle journal/snapshot. Not applied to Neon (only to a throwaway local scratch database, since deleted).

## Mac flip-on (live) results (Oct 24)

- Neon: `drizzle-kit push` created the 5 new tables (purchase_items, offer_checks, run_results, tax_parameters, state_programs). Its extra plan (drop NOT NULL on id/other columns, DROP SEQUENCE spike0_amazon_orders_id_seq) errored on the first id statement and changed nothing; no data lost, spike0_amazon_orders untouched (5 rows). benefit_rules.scope needed no DB change (TypeScript-only type). poverty_guidelines dropped by running migrations/0001 SQL directly. Do not use `db:push` again without checking its plan (it wants to drop NOT NULL constraints and the spike0 sequence).
- Seed: re-ran `npm run seed` (deletes only the 6 sample family ids and the reference tables, all sample data): 6 families, 11 purchase items, 8 benefit rules, 16 offers, 3 tax parameters, 4 state programs, 929 ZIP3 rows.
- Zetaris register: `--apply --replace=v_recall_orders,v_clawback_tx` all OK: 5 tables + 7 views (v_purchase_items, v_clawback_tx, v_recall_orders, v_offer_verdicts, v_offer_audit, v_family_profile, v_coach_feedback). ROW_NUMBER/CAST accepted (no rejection).
- Recorded live: `zetaris:record` (saved verdicts and offer audit return 0 rows, 6 family profiles, 6 coach issues), agents-live, benefits-live, court-live, `examples:regen -- --live` (all 6 families plus guest runs). A few first attempts hit transient Zetaris errors (thrift/ResultSet null) and succeeded on retry.
- Model: MODEL_FAST set to nvidia/nemotron-3-nano-omni-30b-a3b-reasoning; model:check nvidia fast OK, vision item and receipt OK (reasoning model check hit 429 rate limit; some suggested ids 404 on this account).
- Tests: eval.test.ts and sampleMode.test.ts loosenings reverted to strict; `npm test` 634 passed, 10 skipped, 0 failed. Offline eval: maya $48.99, leo $0, ava $14.58, scout 3 accepted / 2 rejected.

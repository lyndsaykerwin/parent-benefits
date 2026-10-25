# Bundle build tracker (draft, Sat Oct 24, 2026)

Companion to `bundle-plan-v3.md` (signed off Oct 24; Lyndsay's binding directives in `lyndsay-final-directives.md`). This file turns the plan into pieces of work ("chunks") that one coding helper (a "subagent", a separate AI worker) can each finish and test on its own. **Nothing here changes the plan.** If the two ever disagree, the plan wins.

**Status key:** pending → in progress → done (tests green and checked by the orchestrator, the main session that hands out chunks and checks their results) → or blocked (with the reason).

**Plain-English words used below:**
- **Wave:** a group of chunks that can run at the same time. Wave 2 starts only when wave 1 is finished and checked, and so on.
- **Owns:** the files only that chunk may change during its wave. No two chunks in the same wave own the same file.
- **Fake server:** a small stand-in program on the cloud machine that answers like the real service (Nightshift, NVIDIA, Zetaris), so code can be tested without keys.
- **Sample mode** (`SAMPLE_MODE=true`): the app runs on saved answers with no keys. Saved Zetaris answers come only from real recording runs; they are **never written by hand**.
- **Mac flip-on checklist:** the steps Lyndsay (or anyone with the keys) runs later to switch on the real services (`cloud-build-assessment.md` §4; the updated copy is made in chunk W5-DOCS).

---

## Done conditions

Copied **verbatim** from `bundle-plan-v3.md`. Lines marked **(derived)** were written for this tracker because the plan gives no "Done when" for that item; each is built only from what the plan already says.

### Must-do items (section 6 ranking numbers)

**M1. Owner view split** (plan section 6, item 1), including the Agent Workspace / Trace panel
- **Done when:** with no token, the API and UI never expose debate text, data-source names, memory rules, traces or Approve; with the token, all of those appear and Approve still works; a test checks the parent response has none of those fields; the learning loop (report twice, approve, run again, offer blocked) still passes end to end.
- Panel part: see M11.

**M2. Nightshift code and the real-AI rerun** (section 6, item 2)
- **Done when:** the scoreboard names the provider and model that answered (or says honestly which one did); the run-1 and run-2 learning traces are saved; no call runs past its limit; every README and slide line about "offline" or "real model" matches what was run.

**M3. Any-state, middle-class rules** (section 6, item 3) **(derived)**
- Poverty/WIC rule, table, query, tests and label are gone, and exact income is no longer read.
- `tax_parameters` and `state_programs` exist with year and source link per row, and are registered in Zetaris (registration on the Mac checklist).
- No agent code names a state; every 3-digit ZIP prefix is loaded; an uncovered state shows federal programs plus "Support for your state's programs is coming soon", never an error.
- The Dependent Care FSA is a "Check with your job" card for every family (no dollar amount, not in the total); the employer box and `dcfsaOffered` are gone.
- The `state_agnostic` test passes for Maya (MA), Ava (OH), Noor (NY), Cal (CA) and Fern (FL), including the swap test, the "MA"/"Massachusetts" guard in agent code, and the Fact-Checker blocking a planted wrong-state card.
- Deck slide 2 no longer uses the WIC statistic (slide change handed to Lyndsay or the deck owner).

**M4. Living Fine-Print Database and data product** (section 6, item 4)
- **Done when:**
  - the 12 tests and 3 controls pass offline (and are reported with real AI);
  - a run fills `offer_checks`;
  - Zetaris answers the "truly free and not recalled" question;
  - a second offer from the same store uses the first one's grade (value, minutes, payout wait), and the trace shows which past grades and H-MEM lessons were used;
  - offers show a Value Score with both value and time;
  - `/api/offer-audit` answers, with its OpenAPI file.
- **(derived, from section 1 and sign-off item 38/42):** the saved-verdict query reads `offer_checks` through `v_offer_verdicts` (no family data) and falls back to "no saved verdicts" in sample mode until a live recording exists; `approve_with_catch` counts only the true value in totals; "probably not worth your time" follows the four labelled default settings; `payout_wait_days_min` shows "paid in 6–8 weeks" only when the fine print gives both ends.

**M5. Recall safety and the product-matching upgrade** (section 6, item 5) **(derived)**
- Finished ("Terminated") FDA recalls are filtered out and the FDA feed stays in.
- The `no_false_recall` test passes (Maya's run does not show CPSC 10490 or 10453), offline and (on the Mac) with real AI.
- Matching checks exact codes first (UPC, model number, lot code) from `purchase_items` only, then brand + product type from a fixed list, sale dates, seller and size/model clash, with an evidence line on each alert; the known fixes ("sold in April 2026" dates; "pad/liner/insert") are in.
- Recall verification loop (loop 8): every recall alert has passed the Fact-Checker's check against the recall record; a planted match with no evidence produces no alert.
- Formula recall cards keep the "check the lot number on the can" line.

**M6. Onboarding + Version B screens from Lyndsay's mocks** (section 6, item 6; detail item 7; section 7) **(derived)**
- Top row: Main ("We're expecting / Baby's here" + "Try a sample family"), Date (birthday, or "When's your baby due?"), ZIP ("Found it: showing [State] programs plus federal ones"; any US ZIP; uncovered state message), Checking (real agent steps), then Version B Home. Never the middle row; no Work screen.
- Version B tabs Home, Taxes, Savings, Insurance, Deals, each with a "+" button that opens "take a photo".
- Expecting families: Home leads with free gifts; deadlines say "starts at birth".
- Light extras: "I got this" tick with "$ claimed" on Home, small share bar, "Save your list" card.
- Wording: "savings and tax credits" (not "cash") with "How we got this number"; Dependent Care FSA uses the "Check with your job" card; ZIP is typed (at most a "Use my location" button); no daycare invoice card.
- All numbers come from the real run; screen tests pass for both "expecting" and "baby's here".

**M7. Regenerate evidence** (section 6, item 8)
- **Done when:**
  - the committed files match the README numbers;
  - all tests are green;
  - a clean copy with no keys still runs the sample.
- **(derived, sign-off items 15, 16, 27, 44):** the README and `metadata.json` carry the Meterless honesty note, the approved judges' line and the cross-source join wording; a short, sourced year-one table is in the repo; offline-made evidence is labelled offline.

**M8. Data intake: photo path first** (section 6, item 6 "Data intake")
- **Done when:**
  - the photo path puts rows into `purchase_items` (and, after the hackathon, each other path that is built);
  - the recall check finds a planted recalled item through Zetaris, with its evidence line;
  - no name, address, raw email or photo is stored anywhere.
- **(derived, loop 7 and sign-off items 8, 9, 10):** a bad first reading triggers exactly one retry to the vision model with what was wrong, then a "clearer photo / close-up" request; recall matching and money-back cards read only `purchase_items` (no agent reads `transactions` or `plaid-transactions.json`); the daycare invoice card and its data are gone; sample families still get money-back cards in sample mode.

**M9. The agent loops, visible and fast** (section 1b)
**Agent loops (must-do item 9): done when** each loop that is built shows up as rounds in the trace log of a sample run (send-back / targeted correction max 2, rebuttal max 1, photo retry max 1, recall verification inside the 2-round cap); the safety-value loop kills a planted recalled item's deal before the Judge; the eligibility loop drops or confirms a benefit after one Zetaris counter-question; no run goes past 300 seconds; and the Owner View Agent Workspace / Trace panel shows those rounds.

**M10. Neon results table** (section 6, item 9)
- **Done when:** a run's result is still served after a server restart; a clean download with `SAMPLE_MODE=true` and no keys can run the sample families and read back their saved results; a test covers both.

**M11. Agent trace log (JSONL) and the Owner View Agent Workspace / Trace panel** (section 6, item 10)
- **Done when:** every run writes `logs/run_<trace_id>.jsonl` with one line per agent event, every line has exactly her 10 fields with values from her lists, and the same lines print to the screen log; a test checks this for a sample run; the owner view's Agent Workspace / Trace panel, behind the reviewer code, shows each loop's rounds for that run (send-backs, the rebuttal round, photo retries, recall verifications, saved verdicts reused); the parent view never shows it.

**M12. Route the two direct database reads through Zetaris** (section 6, item 11)
- **Done when:** no agent reads agent input from Neon directly; the tests use a fake Zetaris for both reads; sample mode still works (falling back honestly until the saved answers are recorded).

### Approved should-do items (all derived; the plan gives none a "Done when")

**S1. Onboarding extras** (round 2) **(derived):** anything beyond M6's light extras is built only after every must-do is done, and does not change M6's tests.

**S2. Open CPSC recalls per brand in `v_offer_audit`** (section 10, item 17; "yes if time") **(derived):** `/api/offer-audit` returns an open-recall count per brand from the live CPSC feed through Zetaris, still with no family fields, and the OpenAPI file describes it.

**S3. H-MEM "dreaming" between runs** (section 10, item 43; "only if time") **(derived):** a separate between-runs script groups grading lessons and keeps only those the engine's approval rule accepts; it never runs during a run and adds no time to a run.

**S4. Real Google sign-in for "Save your list"** (section 10, item 21) **(derived):** an estimate is recorded first; if it is over 3 hours, the Save card ships as a labelled demo; if built, sign-in is Better Auth on Neon, Google only.

### Timeline checkpoints (verbatim from the plan's section 8 "Done when" column)

- **Sat Oct 24:** Tests green; owner view behind the token; `state_agnostic` and recall tests pass; `offer_checks` and `run_results` tables exist; a sample run writes `logs/run_<trace_id>.jsonl` in her format
- **Sun Oct 25:** Fine-print tests green; a second offer's trace shows the past grades and H-MEM lessons used; endpoint answers with no family fields; a sample photo becomes a `purchase_items` row and a bad reading triggers one retry then a "clearer photo" request; a disputed offer shows exactly one rebuttal round; the trace panel shows the loops for a sample run; onboarding works on both paths; a first Nightshift trace names the provider and model
- **Mon Oct 26:** Scoreboard and traces saved with the real provider named; README matches files
- **Tue Oct 27:** Ready before 23:45 UTC

---

## Chunks

### Rules every chunk follows

1. **Read first:** `bundle-plan-v3.md` (the sections named in the chunk), `cloud-build-assessment.md`, and the code it owns. Use the `test-driven-development` skill: write the failing test first.
2. **Own only your files.** If you need a change in a file you don't own, put the exact change in your report as a "hand-off patch"; the orchestrator applies it after the wave.
3. **Shared ("hot") files have one owner per wave**, shown in the table below. Registration lines (adding a new router to `server/routes/index.ts`, a new script to `package.json`, a new setting to `.env.example`, a new seed call to `scripts/seed.ts`) are hand-off patches unless you own the file that wave.
4. **New web routes go in new files** under `server/routes/` (not into `bundleRoutes.ts`), so chunks don't collide.
5. **Every agent change writes Lyndsay's trace log fields** (plan section 1c) using the helper from W1-TRACE: her agent name, action, target, confidence rule and status.
6. **Never hand-write outputs.** No saved Zetaris answers, saved vision answers, scoreboards or trace logs written by hand. If a live run is needed, add it to the Mac flip-on list in your report.
7. **No real personal data.** Made-up families, made-up receipts, public CPSC photos only.
8. **Finish with** `cd bundle && npx tsc --noEmit && npm test` green, plus a report of 15 lines or fewer: what changed, test counts, hand-off patches, new settings, Mac flip-on steps.
9. **Do not commit or push.** The orchestrator decides when work is committed (see "Open questions").

### Hot files: one owner per wave

| File | Wave 1 | Wave 2 | Wave 3 | Wave 4 | Wave 5 | Wave 6 |
|---|---|---|---|---|---|---|
| `shared/schema.ts` | W1-DB | W2-STATE | — | — | — | — |
| `shared/bundle.ts` (card and run types) | W1-FP | W2-PURCH | W3-VERSIONB | W4-ORCH | — | — |
| `server/agents/types.ts` | W1-FP | W2-HMEM | W3-COURT | W4-ORCH | — | — |
| `server/agents/orchestrator.ts` | — | — | — | W4-ORCH | W5-COVERAGE | — |
| `server/agents/factChecker.ts` | — | W2-PURCH | W3-FACT | — | W5-COVERAGE | — |
| `server/agents/recall.ts` | W1-RECALL | W2-PURCH | W3-SAFETY | — | W5-COVERAGE | — |
| `server/agents/clawback.ts` | — | W2-PURCH | W3-SAFETY | — | W5-COVERAGE | — |
| `server/agents/benefits.ts` | — | W2-STATE | W3-ELIG | — | W5-COVERAGE | — |
| `server/agents/finePrintCourt.ts` | — | — | W3-COURT | — | W5-COVERAGE | — |
| `server/adapters/llm.ts` | W1-LLM | — | — | — | — | — |
| `server/adapters/zetaris.ts`, `server/adapters/memory.ts` | W1-TRACE | W2-HMEM (memory.ts only) | — | — | — | — |
| `server/routes/bundleRoutes.ts` | W1-OWNER | W2-RESULTS | — | — | — | — |
| `server/bundleStore.ts` | — | W2-RESULTS | W3-COACH | — | — | — |
| `client/src/pages/Feed.tsx` | W1-OWNER | — | W3-VERSIONB | W4-STREAM | — | — |
| `client/src/lib/bundle.ts` | — | W2-RESULTS | W3-VERSIONB | W4-STREAM | — | — |
| `client/src/App.tsx` | — | — | W3-VERSIONB | — | — | — |
| `package.json`, `package-lock.json` | W1-DB | orchestrator | orchestrator | orchestrator | orchestrator | — |
| `server/routes/index.ts`, `server/bundleDeps.ts`, `.env.example`, `scripts/seed.ts` | orchestrator (hand-off patches) | W2-STATE owns `scripts/seed.ts`; rest orchestrator | orchestrator | orchestrator | W5-DOCS owns `.env.example` | — |
| `scripts/eval.ts`, `scripts/regen-examples.ts`, `evals/expected.json` | W1-RECALL (`expected.json` only) | — | — | — | W5-EVALS | W6-EVIDENCE (run only) |

All paths are inside `bundle/` unless they start with the repo root.

### Wave 1: foundations (no dependencies; all 7 run at the same time)

**W1-LLM: Nightshift → Nemotron adapter, timeouts, retry, `LIVE_MODEL`, vision method**
- **Scope:** plan section 6 item 2 and section 1b "Keeping the loops fast". Provider chain Nightshift → NVIDIA Nemotron direct → saved offline text, kept as a setting (item 11); Nightshift labels and password file (`NIGHTSHIFT_TOKEN_FILE`); hard stop on the whole call (`NIGHTSHIFT_TIMEOUT_SECONDS` 180, `MODEL_TIMEOUT_SECONDS` 90), one retry for timeouts and server errors, bigger reply-length cap; a run-deadline wrapper (`RUN_DEADLINE_SECONDS` 300) that W4-ORCH wires in; `LIVE_MODEL=true` (real AI while Zetaris replays); `model:check --provider nightshift|nvidia` and `--vision`; each answer reports the provider and model that answered; a `see()` method for vision with `MODEL_VISION` and `MODEL_VISION_RECEIPT` settings (defaults from item 4); Judge model setting for Nemotron 3 Super with "thinking" off (item 13).
- **Owns:** `server/adapters/llm.ts`, `scripts/check-model.ts`, `server/__tests__/llm.test.ts`, `server/__tests__/checkModel.test.ts`, `server/__tests__/fallback.test.ts`, new `server/__tests__/helpers/fakeOpenAiServer.ts`.
- **Depends on:** nothing.
- **Cloud-testable:** fully, against the fake OpenAI-compatible server (proved in `cloud-build-assessment.md` §1: labels received, hung call cut off, 401 on wrong password, retry after a server error). The real Nightshift run is a Mac flip-on step.
- **Status:** qc-pass (merged; fixes: run clock per run, deadline label, token warning, honest provider label 166e43e; re-QC pass)

**W1-DB: local Postgres test setup + Neon schema for every new table**
- **Scope:** section 6 timeline Saturday; `cloud-build-assessment.md` item 21 and its database note. Switch to the standard `pg` library when `DATABASE_URL` points at this machine; a one-command local test database; new tables `purchase_items` (with `seller`, `quantity`, `input_hash`; section 3), `offer_checks` (every section 1 field including the value and time fields `true_value_cents`, `effort_minutes_estimate`, `steps_count`, `payout_wait_days_max`, `payout_wait_days_min`, `claim_window_days`, plus `status`, `rule_citations`, recall fields; no family column), `run_results` (section 6 item 9), `tax_parameters`, `state_programs`; all added to `BUNDLE_TABLE_NAMES`; generated setup SQL; `package.json` entries for `pg`, a `db:test` script and a `zetaris:record` script name (the script itself is W2-ZREG's).
- **Owns:** `shared/schema.ts`, `server/db.ts`, `drizzle.config.ts`, `package.json`, `package-lock.json`, `migrations/` (new), new `scripts/db-test-setup.sh`, new `server/__tests__/schema.test.ts`.
- **Depends on:** nothing.
- **Cloud-testable:** fully on the local Postgres 16 (`service postgresql start`). Applying to the real Neon (`npm run db:push`) is a Mac flip-on step.
- **Status:** qc-pass (merged b28ccb5; fixes: line_index dedupe, LOCALHOST)

**W1-TRACE: Lyndsay's JSONL trace logger**
- **Scope:** plan section 1c. Inside `TraceLogger.log()`, also write her 10-field line to `logs/run_<trace_id>.jsonl` (trace id `bundle_<runId>`) and print it to stdout; keep today's `run-<runId>.jsonl` unchanged. Her enums as fixed lists in a shared file; the translation rules from section 1c (agent names, actions, statuses, confidence rule, housekeeping lines kept out); a checker that rejects any line with a wrong field or value; `redact()` applied. Let the Zetaris and memory adapters take the calling agent's name (`withTrace(trace, agentName)`), so their lines are written under that agent.
- **Owns:** `server/agents/trace.ts`, new `shared/agentLog.ts`, `server/__tests__/trace.test.ts`, new `server/__tests__/agentLog.test.ts`, `server/adapters/zetaris.ts`, `server/adapters/memory.ts`, `server/__tests__/zetaris.test.ts`, `server/__tests__/memory.test.ts`.
- **Depends on:** nothing.
- **Cloud-testable:** fully (sample mode; tests read the file and capture stdout).
- **Status:** qc-pass (merged; fixes 35b9a1c re-QC pass)

**W1-OWNER: owner view split (server-side trimming + screens)**
- **Scope:** section 6 item 1 and section 4. The parent response is trimmed on the server; debate text, data-source names, memory rules, traces and Approve appear only with `x-reviewer-token`; the learning loop still passes end to end. The "Checking" screen shows only parent-safe step wording.
- **Owns:** `server/routes/bundleRoutes.ts`, `server/security.ts`, `server/__tests__/bundleRoutes.test.ts`, `server/__tests__/securityHeaders.test.ts`, `client/src/pages/Feed.tsx`, `client/src/pages/CardDetail.tsx`, `client/src/pages/Smarter.tsx`, `client/src/components/HowWeCheckedSections.tsx`, `client/src/lib/howWeChecked.ts` and their tests in `client/src/**/__tests__/`.
- **Depends on:** nothing.
- **Cloud-testable:** fully (Jest + Testing Library; the `agent-browser` skill for screenshots).
- **Status:** qc-pass (merged; scoreboard leak fixed 4e08239, re-QC pass)

**W1-FP: fine-print tests, verdicts and Value Score (pure rules, no agent wiring)**
- **Scope:** section 6 item 4 and section 1. Verdicts `approve`, `approve_with_catch`, `reject` (a code "reject" always overrides an AI "approve"); code rules for FP-01 to FP-12 and the 3 controls (`audit-ma-poverty-evals.md` 3b), including FP-07 auto-renew for every family (Ohio fix); fine-print fingerprint; Value Score (value + time to get it) and the "worth your time" rule with the four labelled default settings (`WORTH_MIN_VALUE_CENTS` 500, `WORTH_MAX_EFFORT_MINUTES` 30, `WORTH_EFFORT_VALUE_CENTS` 2000, `WORTH_MAX_PAYOUT_DAYS` 90) and `payout_wait_days_min` wording; card type fields for the Value Score.
- **Owns:** `server/agents/offerScreen.ts`, new `server/agents/finePrintRules.ts`, new `server/agents/valueScore.ts`, new `server/__tests__/finePrintRules.test.ts`, new `server/__tests__/valueScore.test.ts`, new `data/sample/fine-print-cases/` (made-up FP-01..12 + control offer texts), `shared/bundle.ts`, `server/agents/types.ts`.
- **Depends on:** nothing.
- **Cloud-testable:** fully offline (code rules decide). Real-AI results are reported later with the Mac rerun.
- **Status:** qc-pass (merged; adversarial fixes 65a5013, re-QC pass; known gap: fees written in words, e.g. 'five dollars and ninety-nine cents')

**W1-ONB: onboarding top row from the mocks**
- **Scope:** section 7 top row; mocks `onboarding-design/project/Main.dc.html`, `Date.dc.html`, `Zip.dc.html` (never the middle row; `Work.dc.html` is cut); `onboarding-spec.md` where still current (`onboarding-design/round4-mock-review.md` §3). Expecting / baby's here, due-date wording, typed ZIP with at most a "Use my location" button, uncovered-state message; hands off to the Checking screen.
- **Owns:** `client/src/pages/Onboarding.tsx`, new `client/src/pages/__tests__/Onboarding.test.tsx`, new `client/src/lib/onboarding.ts`.
- **Depends on:** nothing (the run request shape change, if any, is a hand-off patch for W2-RESULTS).
- **Cloud-testable:** fully (screen tests + `agent-browser` screenshots compared against the mocks).
- **Status:** qc-pass (merged; e43e129 re-QC pass). Any-US-ZIP on the server is W2-STATE

**W1-RECALL: recall safety + product-matching rules**
- **Scope:** section 6 item 5 and section 3 "Key finding". Finished-FDA filter; `no_false_recall` test; a pure matcher module (exact codes first: UPC, model number, lot code; then brand + product type from a fixed list, sale dates, seller, size/model clash; evidence line), scored on the saved 739 CPSC + FDA rows in `experiments/entity-resolution/data/` and the 14 new test cases.
- **Owns:** `server/agents/recall.ts` (filter only this wave), new `server/agents/recallMatch.ts`, `server/__tests__/recall.test.ts`, new `server/__tests__/recallMatch.test.ts`, `evals/expected.json`.
- **Depends on:** nothing.
- **Cloud-testable:** fully offline on the saved recall rows. The changed Zetaris view needs a recording run (Mac list).
- **Status:** qc-pass (merged; barcode fix e13507d re-QC pass; honest held-out = 7/8 first run)

### Wave 2: data, intake and memory (needs wave 1)

**W2-ZREG: Zetaris registration scripts + saved-verdict query (#38) + record command**
- **Scope:** section 1 ("The saved-verdict query"), section 3, section 5, `cloud-build-assessment.md` item 13. Register `purchase_items`, `offer_checks`, `tax_parameters`, `state_programs`; views `v_purchase_items` (safe columns), `v_recall_orders` and `v_clawback_tx` rebuilt on `purchase_items` only (items 8, 9), `v_offer_verdicts` (item 38: latest verdict, status, rule_citations, value-and-time grade, fingerprint, universal-rule flag; no family data), `v_offer_audit` (per-brand totals), and the two views for the rerouted reads (family profile; Coach's reports; item 14). The fixed saved-verdict SQL lives in one exported function. A `zetaris:record` command that runs the agents' questions live and saves the answers (it only works with keys). **Sample-mode fallback:** with no saved answer, the saved-verdict query returns "no saved verdicts" and agents grade fresh; never write a saved answer by hand.
- **Owns:** `scripts/zetaris/register.ts`, new `scripts/zetaris/record.ts`, new `server/agents/savedVerdicts.ts`, new `server/__tests__/register.test.ts`, new `server/__tests__/savedVerdicts.test.ts`.
- **Depends on:** W1-DB (table definitions), W1-TRACE (caller name on Zetaris lines).
- **Cloud-testable:** the Neon side of each view is checked on the local Postgres; dry-run output tested; fake Zetaris in tests. **Mac flip-on:** `register.ts --apply --replace=…`, then `npm run zetaris:record`, then commit the new files in `data/sample/zetaris-cache/`.
- **Status:** pending

**W2-STATE: any-state, middle-class rules**
- **Scope:** section 6 item 3 (all bullets except the Fact-Checker wrong-state block, which is W3-FACT). Remove poverty/WIC everywhere; seed `tax_parameters` (IRS 2026: Child Tax Credit $2,200; Dependent Care FSA $7,500) and `state_programs` (MA, NY, CA paid leave, MA child credit) with source link and year; every 3-digit ZIP prefix; "Check with your job" card; `plain_summary` wording; `state_agnostic` test with 5 made-up families; the uncovered-state message.
- **Owns:** `server/agents/benefits.ts`, `shared/schema.ts` (poverty table removal), `scripts/seed.ts`, `server/sampleZips.ts`, `data/sample/families.json`, `data/sample/fallback-rules.json`, new `data/sample/tax-parameters.json`, new `data/sample/state-programs.json`, new `data/sample/zip3-states.json`, `server/__tests__/benefits.test.ts`, `server/__tests__/seed.test.ts`, new `server/__tests__/stateAgnostic.test.ts`, `input_examples/` (new families).
- **Depends on:** W1-DB.
- **Cloud-testable:** fully with a fake Zetaris; offline replay of the new Planner questions needs a recording run (Mac list).
- **Status:** pending

**W2-PURCH: `purchase_items` as the only purchase source (#8, #9) + daycare drop (#10) + Plaid clean-up**
- **Scope:** sign-off items 8, 9, 10; section 3 ("It is the only purchase source"); sections 5 and 6 item 5. Recall Checker reads only structured codes from `v_purchase_items`; Clawback Hunter's money-back cards come only from `purchase_items` rows with prices; the Fact-Checker's clawback and FSA claim checks point at `purchase_items` rows instead of `transactions`; made-up photo/receipt item rows for the sample families (inputs, labelled made-up) and a loader; remove `server/ingest/plaid.ts`, `plaid-transactions.json`, the Connect tile wording and the daycare card.
- **Owns:** `server/agents/recall.ts`, `server/agents/clawback.ts`, `server/agents/factChecker.ts`, `shared/bundle.ts`, `server/ingest/plaid.ts` (delete), new `server/ingest/purchaseItems.ts`, `data/sample/plaid-transactions.json` (delete), new `data/sample/purchase-items.json`, `server/__tests__/recall.test.ts`, `server/__tests__/clawback.test.ts`, `server/__tests__/factChecker.test.ts`, `server/__tests__/ingest.test.ts`.
- **Depends on:** W1-DB, W1-RECALL, W1-TRACE.
- **Cloud-testable:** fully with a fake Zetaris. Maya's money-back total will change: report the new number; slides quote only the regenerated one.
- **Status:** pending

**W2-PHOTO: photo intake with NVIDIA vision + photo retry loop (loop 7)**
- **Scope:** section 3 (photo path, privacy) and section 1b loop 7; field rules from item 32. Upload route (size limit), phone-side location-data stripping and shrinking, reject rule (people, faces, addresses), field checks (required fields, UPC check digit, code shape, values found in the read text), exactly one retry told what was wrong, then a "clearer photo / close-up" request; rows written to `purchase_items` with `input_hash`; photo deleted after reading and never logged; "Forget my items". PhotoReader trace lines (`vision_extract`, `retry_request`). Sample photos: credited CPSC recall-notice photos (item 6) and made-up receipt images. **Sample mode:** replays saved vision answers that were recorded from a real model run (new `scripts/record-vision.ts`); until one is recorded, sample mode says plainly that photo reading needs the live model, and the sample families' made-up item rows (W2-PURCH) are used.
- **Owns:** new `server/ingest/photo.ts`, new `server/routes/photoRoutes.ts`, new `client/src/lib/photoPrep.ts`, new `data/sample/photos/`, new `data/sample/vision-cache/` (written only by the recorder), new `scripts/record-vision.ts`, new `server/__tests__/photo.test.ts`, new `client/src/lib/__tests__/photoPrep.test.ts`.
- **Depends on:** W1-LLM (`see()`), W1-DB, W1-TRACE.
- **Cloud-testable:** fully against a fake vision server (good reading, bad-then-good reading, bad-twice → "clearer photo"). **Mac flip-on:** `npm run model:check -- --vision`, then `record-vision` for the sample photos.
- **Status:** pending

**W2-HMEM: shared workspace on Meterless H-MEM**
- **Scope:** section 1b "The agent network and its shared workspace" and item 37's message format `{run_id, from_agent, to_agent, type, about, body, evidence_sql, round}`. Post and read notes per run and item; grading lessons pointing at `offer_checks` rows; "helpful"/"wrong" feedback on lessons; no AI extraction, dreaming or sleep during a run; each note copied as a trace line; ledger export unchanged.
- **Owns:** `server/adapters/memory.ts`, new `server/agents/workspace.ts`, `server/agents/types.ts` (add the workspace to `AgentContext`), `server/__tests__/memory.test.ts`, new `server/__tests__/workspace.test.ts`.
- **Depends on:** W1-TRACE.
- **Cloud-testable:** fully (H-MEM runs locally from `data/hmem`).
- **Status:** pending

**W2-RESULTS: Neon results table (#20) + run event hub**
- **Scope:** section 6 item 9. Save every finished run to `run_results`; read it back when a run is no longer in memory; clean-download replay in sample mode; a small run-event hub module (events: card ready, card updated, card removed, agent status) that W4-ORCH writes to and W4-STREAM reads from, defined here so both can be built in parallel later.
- **Owns:** `server/bundleStore.ts`, `server/routes/bundleRoutes.ts`, `client/src/lib/bundle.ts`, new `server/agents/runEvents.ts`, new `server/__tests__/runResults.test.ts`, new `server/__tests__/runEvents.test.ts`.
- **Depends on:** W1-DB, W1-OWNER.
- **Cloud-testable:** fully on the local Postgres and the in-memory store (restart test).
- **Status:** pending

### Wave 3: the agent loops, the data product and the screens (needs wave 2)

**W3-COURT: Fine Print Court rebuttal round + newsroom loop + `offer_checks` write-back**
- **Scope:** section 1b loop 5 (one rebuttal round, strictly max 1, only when the code screen and first arguments disagree; both sides asked side by side; offers judged a few at a time, item 30), loop 3's "approve with a catch" after correction, and the newsroom loop (section 1b): before grading, past grades from the saved-verdict query (W2-ZREG) and matching H-MEM lessons; skip unchanged fingerprints and universal-rule rejections (reuse the saved grade, no AI); after an agreed verdict, write one `offer_checks` row (verdict, status, rule_citations, value-and-time grade) and one H-MEM lesson; trace shows which past grades and lessons were used. FinePrintCourt trace lines (`court_debate`).
- **Owns:** `server/agents/finePrintCourt.ts`, new `server/agents/offerChecks.ts`, new `server/agents/newsroom.ts`, `server/agents/types.ts`, `server/__tests__/finePrintCourt.test.ts`, new `server/__tests__/newsroom.test.ts`, new `server/__tests__/offerChecks.test.ts`.
- **Depends on:** W1-FP, W2-ZREG, W2-HMEM, W1-DB.
- **Cloud-testable:** fully with the fake generator, fake Zetaris and local Postgres. "Second offer from the same store uses the first one's grade" is a test.
- **Status:** pending

**W3-FACT: Fact-Checker targeted corrections + recall verification loop (loop 8) + wrong-state block**
- **Scope:** section 1b loop 3 (line-specific correction wording, max 2 rounds), loop 8 (check each recall match against the recall record; no evidence, no alert), the planted wrong-state card block (section 6 item 3), and the confirm/correct signal that marks the lessons used as helpful or wrong. FactChecker trace lines (`fact_check`, `retry_request`, `approve_card`, `reject_card`).
- **Owns:** `server/agents/factChecker.ts`, `server/__tests__/factChecker.test.ts`.
- **Depends on:** W2-PURCH, W2-HMEM, W2-STATE.
- **Cloud-testable:** fully.
- **Status:** pending

**W3-SAFETY: Clawback Hunter ↔ Recall Checker safety-value loop (loop 1)**
- **Scope:** section 1b loop 1. Before publishing a price drop or rebate, the Clawback Hunter asks the Recall Checker through the workspace; a CPSC or FDA recall on the item kills the deal before the Judge with the reason "do not encourage buying or claiming a rebate on this item"; real recall records only (item 36). ClawbackHunter and RecallChecker trace lines.
- **Owns:** `server/agents/clawback.ts`, `server/agents/recall.ts`, `server/__tests__/clawback.test.ts`, `server/__tests__/recall.test.ts`.
- **Depends on:** W2-PURCH, W2-HMEM, W1-RECALL.
- **Cloud-testable:** fully (planted recalled item in made-up `purchase_items`).
- **Status:** pending

**W3-ELIG: Benefits Planner ↔ Fine Print Lawyer eligibility loop (loop 2)**
- **Scope:** section 1b loop 2. The Lawyer tries to disprove eligibility; a found condition goes back with one counter-question that uses only data we have (item 35: state, due/birth date, ZIP, `tax_parameters`, `state_programs`); the Planner asks Zetaris and confirms or drops. BenefitsPlanner trace lines.
- **Owns:** `server/agents/benefits.ts`, new `server/agents/eligibilityLawyer.ts`, `server/__tests__/benefits.test.ts`, new `server/__tests__/eligibilityLawyer.test.ts`.
- **Depends on:** W2-STATE, W2-HMEM.
- **Cloud-testable:** fully.
- **Status:** pending

**W3-AUDIT: `v_offer_audit` + `GET /api/offer-audit` + OpenAPI**
- **Scope:** section 1 "The data product". Fixed query, rate limit, saved answers in sample mode (fallback honest when none recorded), OpenAPI file, test that the answer never has family fields. **Should-do S2 (if time):** open CPSC recalls per brand.
- **Owns:** new `server/routes/offerAuditRoutes.ts`, new `docs/openapi/offer-audit.yaml`, new `server/__tests__/offerAudit.test.ts`.
- **Depends on:** W2-ZREG.
- **Cloud-testable:** fully with a fake Zetaris. Real data needs the Mac registration and recording.
- **Status:** pending

**W3-COACH: Coach reads reports through Zetaris (#14, part 2) + CoachAI trace lines**
- **Scope:** section 5 "Two direct database reads" (the Coach part; the family-profile part is W4-ORCH). `listRecentIssues` goes through the Zetaris view from W2-ZREG.
- **Owns:** `server/bundleStore.ts`, `server/agents/coach.ts`, `server/__tests__/coach.test.ts`.
- **Depends on:** W2-ZREG, W2-RESULTS.
- **Cloud-testable:** fully with a fake Zetaris; recording on the Mac list.
- **Status:** pending

**W3-PANEL: Owner View Agent Workspace / Trace panel (#33)**
- **Scope:** sections 1c and 4. Reviewer-only `GET /api/runs/:runId/agent-log`; a panel, "How the agents worked together", grouping her log lines per card and loop (send-backs, rebuttal round, photo retries, recall verifications, saved verdicts reused) next to the H-MEM workspace notes. Never in the parent view.
- **Owns:** new `server/routes/agentLogRoutes.ts`, new `client/src/pages/AgentWorkspace.tsx`, new `client/src/pages/__tests__/AgentWorkspace.test.tsx`, new `server/__tests__/agentLogRoutes.test.ts`.
- **Depends on:** W1-TRACE, W1-OWNER, W2-HMEM. (Its test logs come from real sample-mode runs inside the test, never from hand-written files.)
- **Cloud-testable:** fully.
- **Status:** pending

**W3-VERSIONB: Version B tabs with "+" on every tab**
- **Scope:** section 7; mocks `onboarding-design/project/NavApp.dc.html`, `NavTaxes.dc.html`, `NavSavings.dc.html`, `NavInsurance.dc.html`, `NavDeals.dc.html` (bottom row); Checking screen hand-off from W1-ONB into Version B Home; "+" on every tab opens "take a photo" (W2-PHOTO's route); expecting-family variants; "I got this" + "$ claimed"; share bar; "Save your list" card (labelled demo unless S4 is built); Value Score and "We caught these for you" on cards; "savings and tax credits" wording; "Check with your job" card. **Should-do S4:** record the Google sign-in estimate in the report.
- **Owns:** `client/src/App.tsx`, `client/src/pages/Feed.tsx`, `client/src/lib/bundle.ts`, `client/src/components/AppShell.tsx`, `client/src/components/FeedCardView.tsx`, `client/src/components/ReceiptCard.tsx`, new `client/src/pages/tabs/` (one file per tab), new `client/src/components/AddPurchaseButton.tsx`, `shared/bundle.ts`, and their tests.
- **Depends on:** W1-ONB, W1-OWNER, W1-FP, W2-PHOTO, W2-RESULTS.
- **Cloud-testable:** fully (screen tests + screenshots against the mocks).
- **Status:** pending

### Wave 4: putting the loops together and the fast screen (needs wave 3)

**W4-ORCH: orchestrator wiring for every loop + run deadline + family profile through Zetaris (#14, part 1)**
- **Scope:** section 1b ("The loops in one picture"). Order: saved-verdict query first (Zetaris FIRST) → workspace → loops 1 and 2 → Court (with rebuttal) → Fact-Checker (targeted corrections, recall verification) → write-back; photo items join the run through `purchase_items`; the 300-second run budget (remaining AI steps use saved offline text and say so); events written to the run-event hub; family profile in live mode read through Zetaris; Orchestrator trace lines.
- **Owns:** `server/agents/orchestrator.ts`, `server/agents/types.ts`, `shared/bundle.ts`, `server/__tests__/orchestrator.test.ts`, `server/__tests__/sampleMode.test.ts`, `server/__tests__/offlineGuarantee.test.ts`.
- **Depends on:** all of wave 3, W1-LLM (deadline wrapper), W2-RESULTS (event hub).
- **Cloud-testable:** fully in sample mode; "no run goes past 300 seconds" tested with a slow fake generator.
- **Status:** pending

**W4-STREAM: instant saved feed, streaming cards, status pills, optimistic checking**
- **Scope:** section 1b "Keeping the loops fast" table. Instant feed from `run_results` and saved verdicts; server-sent events from the run-event hub (fallback to today's once-a-second polling); cards appear most urgent first; status pills with live wording; optimistic background updates; a recall alert shows only after its evidence is checked. Never say "real-time".
- **Owns:** new `server/routes/streamRoutes.ts`, `client/src/pages/Feed.tsx`, `client/src/lib/bundle.ts`, `client/src/lib/poll.ts`, new `client/src/lib/stream.ts`, `client/src/lib/__tests__/poll.test.tsx`, new `client/src/lib/__tests__/stream.test.tsx`, new `server/__tests__/streamRoutes.test.ts`.
- **Depends on:** W2-RESULTS (event hub contract), W3-VERSIONB. Runs alongside W4-ORCH (tests use the hub with fake events; the joint check is in W5-COVERAGE).
- **Cloud-testable:** fully.
- **Status:** pending

### Wave 5: checking coverage, scoreboard and docs (needs wave 4)

**W5-COVERAGE: trace-log coverage audit across every agent + loop end-to-end tests**
- **Scope:** M9 and M11 done conditions. A test runs every sample family and checks: every line passes the section 1c checker; every built loop appears as rounds; retry counts stay within caps; each of her agent names appears where its agent ran; parent responses carry none of it. Fix any agent that logs incompletely (log calls only).
- **Owns:** new `server/__tests__/agentLogCoverage.test.ts`, new `server/__tests__/loopsEndToEnd.test.ts`, and log-call lines only in `server/agents/*.ts` (no other chunk is active on those files this wave).
- **Depends on:** W4-ORCH, W4-STREAM.
- **Cloud-testable:** fully.
- **Status:** pending

**W5-EVALS: evals and scoreboard updates**
- **Scope:** section 6 items 2, 4, 8. Scoreboard: fine-print catches found / total, false alarms on controls, field accuracy, photo metrics (made-up rate target 0), recall right/caught, the provider and model that answered, loop counts per run; learning demo moved to a subtler trap; examples regeneration script updated.
- **Owns:** `scripts/eval.ts`, `scripts/regen-examples.ts`, `evals/expected.json`, `server/__tests__/eval.test.ts`.
- **Depends on:** W4-ORCH.
- **Cloud-testable:** offline fully; the real-AI part is the Mac `eval:live-model` step.
- **Status:** pending

**W5-DOCS: README (with Meterless honesty note #44) + Mac flip-on checklist + settings file**
- **Scope:** section 6 item 8 and sign-off item 44; items 15, 16, 27. README: the Meterless note ("H-MEM: shared workspace, newsroom-loop lessons and case law. Markovian and World Model not used: …"), the approved judges' line, the cross-source join wording, how a clean download replays saved results, which evidence is offline. `metadata.json` engines field. A short year-one table with current, cited sources (web-checked). An updated Mac flip-on checklist: `model:check` both providers and `--vision`; reviewed SQL applied by hand with Lyndsay's OK (never `db:push`); `register.ts --apply --replace=…` (including `v_offer_verdicts`, rebuilt `v_recall_orders` and `v_clawback_tx`, the two rerouted-read views, `v_offer_audit`); `zetaris:record`; `record-vision`; 9am go/no-go; `eval:live-model`; `examples:regen`; keep one real-run `logs/run_<trace_id>.jsonl`. All new settings collected in `.env.example`.
- **Owns:** `README.md`, `metadata.json`, `.env.example`, `data/README.md`, new `docs/mac-flip-on-checklist.md`, new `docs/year-one-table.md`.
- **Depends on:** W4-ORCH (final setting names); can start drafting earlier.
- **Cloud-testable:** yes (links and commands checked against the code; numbers filled from W6-EVIDENCE).
- **Status:** pending

**S3-DREAM (should-do, only if time): H-MEM dreaming between runs**
- **Owns:** new `scripts/hmem-dream.ts`, new `server/__tests__/hmemDream.test.ts`. **Depends on:** W2-HMEM, W3-COURT. **Cloud-testable:** fully. **Status:** pending

**S4-SIGNIN (should-do, only if the W3-VERSIONB estimate is 3 hours or less): real Google sign-in**
- **Owns:** new `server/auth/`, new `client/src/lib/auth.ts`. **Depends on:** W3-VERSIONB. **Cloud-testable:** partly (Google sign-in itself needs real Google keys; Mac list). **Status:** pending

### Wave 6: offline evidence and the final check (needs wave 5)

**W6-EVIDENCE: regenerate offline evidence (labelled) + clean-download rehearsal**
- **Scope:** section 6 item 8 (offline part only). Run `npm run eval` and `examples:regen` in sample mode; refresh `output_examples/` (including `ava.json` after the Ohio fix), `logs/sample/`, `logs/scoreboard.json`; every file made offline is labelled offline. Then a clean copy with no keys: `SAMPLE_MODE=true npm test` and `SAMPLE_MODE=true npm run eval`. Fill README numbers from the files. The real-AI rerun and its trace log come later from the Mac.
- **Owns:** `output_examples/`, `logs/sample/`, `logs/scoreboard.json`, the README numbers section (hand-off from W5-DOCS).
- **Depends on:** all of wave 5.
- **Cloud-testable:** fully.
- **Status:** pending

### Wave summary

| Wave | Chunks (run at the same time) |
|---|---|
| 1 | W1-LLM, W1-DB, W1-TRACE, W1-OWNER, W1-FP, W1-ONB, W1-RECALL |
| 2 | W2-ZREG, W2-STATE, W2-PURCH, W2-PHOTO, W2-HMEM, W2-RESULTS |
| 3 | W3-COURT, W3-FACT, W3-SAFETY, W3-ELIG, W3-AUDIT, W3-COACH, W3-PANEL, W3-VERSIONB |
| 4 | W4-ORCH, W4-STREAM |
| 5 | W5-COVERAGE, W5-EVALS, W5-DOCS (+ should-dos S3-DREAM, S4-SIGNIN if time) |
| 6 | W6-EVIDENCE |

**Cut order if time runs short** (plan section 6, items 19 and 39): keep the targeted-correction loop (W3-FACT) → safety-value loop (W3-SAFETY) → instant saved feed and streaming cards (W4-STREAM) → eligibility loop (W3-ELIG) → status pills → server-sent-event push (fall back to polling). Set on Sunday midday from the chunks' estimates.

---

## Open questions

1. **Trace file name.** Her path is `logs/run_<trace_id>.jsonl` and her example id is `run_bundle_001`; taken literally that gives `run_run_bundle_001.jsonl`. Default chosen: trace id `bundle_<runId>`, so the file is `logs/run_bundle_<runId>.jsonl`. Confirm or change.
2. **Housekeeping events in her log.** Run start, ledger export and memory writes fit none of her nine actions. Default: they stay only in the existing detailed trace. Should they be forced into her log?
3. **"Fallback" and "error" statuses.** Her status list has neither. Default: fallback = success with "fallback:" in the summary; error = retrying (if a retry follows) or rejected, with "error:" in the summary.
4. **Confidence numbers.** Default rule in section 1c (code checks = 1.00; photo = share of field checks passed; lessons = H-MEM trust number). Confirm it reads honestly to judges.
5. **"Written to offer_checks via Zetaris."** Her example says this, but it is not confirmed that Zetaris can write to Neon. Default: code writes the row to Neon directly; agents read it back only through Zetaris (keeping "Zetaris is the only way agents read data" true); the log's target is `offer_checks`, and no log line claims a Zetaris write unless one happened.
6. **Maya's money-back number.** Moving money back to `purchase_items` (item 9) will change Maya's $48.99. The slides must quote the regenerated number.
7. **Photo saved answers.** Sample mode can only replay vision answers recorded from a real model, which needs the NVIDIA key (Mac, or this cloud environment if the key is added). Until then the photo button in sample mode says it needs the live model. Acceptable?
8. **Nightshift and photos.** Whether Nightshift can route pictures is not documented; the plan assumes NVIDIA direct for vision.
9. **"Worth your time" numbers** ($5; 30 minutes for under $20; 90 days) are agent-chosen defaults. Lyndsay can change them in settings.
10. **Committing the build.** Her standing rule for solo work is "merge directly to main", but this draft says chunks don't commit. The orchestrator should decide when and how each wave is committed and say so in plain English.
11. **Zetaris view wording.** Only a live `register.ts --apply` proves Zetaris accepts the new view definitions (`cloud-build-assessment.md` §2 group c, item 4).
12. **Nightshift's Sunday update** (pinning Nemotron, "thinking" off) may rename settings; they stay as settings.

## Decisions made

1. **All section 10 proposals are approved** except Lyndsay's ten changed items (sign-off); recorded in `bundle-plan-v3.md` (top, "Sign-off") with section 10 marked resolved. Frozen copy before the change: `plan-history/bundle-plan-v3-2026-10-24-signoff-before.md`.
2. **"Worth your time" defaults (labelled, adjustable):** `WORTH_MIN_VALUE_CENTS`=500, `WORTH_MAX_EFFORT_MINUTES`=30, `WORTH_EFFORT_VALUE_CENTS`=2000, `WORTH_MAX_PAYOUT_DAYS`=90; `payout_wait_days_min` added as optional.
3. **Her trace log is made from the existing trace, not instead of it.** `TraceLogger.log()` writes both files from one event; today's `run-<runId>.jsonl`, its API, tests and card links are unchanged.
4. **Trace log translation defaults** (trace id format, agent names, actions, statuses, confidence rule, housekeeping lines): plan section 1c.
5. **New names:** `run_results` (results table), `v_offer_verdicts` (saved-verdict view), `GET /api/runs/:runId/agent-log` (reviewer-only), `MODEL_VISION` / `MODEL_VISION_RECEIPT` (vision settings).
6. **Saved-verdict query fallback:** with no recorded answer, sample mode returns "no saved verdicts" and the agents grade every offer fresh. Never a hand-written answer.
7. **Card-style sample rows** (`transactions`, `plaid-transactions.json`) are no longer read by any agent; sample families get made-up photo/receipt item rows instead.
8. **File ownership:** one owner per file per wave; shared files follow the hot-file table; new routes go in new files; registration lines are hand-off patches applied by the orchestrator at the end of each wave, followed by a full test run.
9. **Product-matching upgrade is must-do** (item 7) and the two direct reads go through Zetaris (item 14, must-do, small).
10. **Cut order:** the build lead applies items 19 and 39 on Sunday midday and records the result here; Lyndsay can override.

# Waves 4–6 dispatch map (Sun Oct 25, 2026, cloud session)

Sources: `bundle-plan-v3.build-tracker.md` (waves 4–6, lines ~300–360), `HANDOFF-cloud.md`, `qc-reports/W3-integration-qc.md` (section 5 wiring gaps), `TRACKING-oct24-wave3.md` (format). All paths are inside `bundle/` unless noted. Line numbers are from `main` @ `3ba83e8`. Nothing here changes the plan.

Plain-English words:
- **Zetaris replay** = a saved real Zetaris answer in `data/sample/zetaris-cache/`, looked up by a fingerprint (SHA-256 hash) of the exact SQL text (`server/adapters/zetaris.ts:58`). Change one character of a question's SQL and its replay no longer matches; sample mode then falls back honestly ("unavailable"/empty) until a live re-record on the Mac.
- **Hand-off patch** = a small edit to a file the chunk does not own; the orchestrator applies it after the chunk merges.

## Baseline (this cloud session, no keys, SAMPLE_MODE=true)

- `npm ci`: OK. `SAMPLE_MODE=true npm test`: **850 passed, 11 skipped, 0 failed** (57 suites pass, 1 skipped). Matches the expected baseline.
- The 11 skipped need a local Postgres test database (`TEST_DATABASE_URL`): `server/__tests__/offerChecks.test.ts:54`, `seed.test.ts:13`, `runResults.test.ts:186`. Postgres binaries are present in this container, so `bundle/db-test-setup.sh` (Linux path) could enable them if a chunk needs it (W4-ORCH's real `offer_checks` writer).
- `npx tsc --noEmit`: clean. `npm run build`: OK.
- Afterwards `git checkout -- bundle/logs bundle/output_examples bundle/data/sample/zetaris-cache`; tree clean.
- Checked: the family-profile question `familyProfileSql(id)` (`server/agents/savedVerdicts.ts:34`) already has replays for all six sample families (maya, leo, ava, noor, cal, fern), so reading the family through Zetaris is replay-safe if the text is reused unchanged.

## Hard rules (every chunk)

1. Never run `npm run db:push`. Schema changes = reviewed SQL, by hand, only with Lyndsay's OK.
2. Never hand-write Zetaris replays. Keep SQL text unchanged where possible; tests stay strict.
3. No live Neon/Zetaris changes from this cloud session (no keys here anyway).
4. After any test/eval run: `git checkout -- bundle/logs bundle/output_examples bundle/data/sample/zetaris-cache` (except W6-EVIDENCE, which regenerates on purpose).
5. Tests must not depend on Neon serial ids. Never say "real-time" in parent text. Parent responses carry no trace/debate/SQL.
6. Reviewer check per chunk: `git diff main -- server/agents/savedVerdicts.ts scripts/zetaris/register.ts` empty, and grep the diff for changed SQL string literals.

## Summary table

| Chunk | Goal | Changes Zetaris SQL text? | Needs live keys / Mac? | Status |
|---|---|---|---|---|
| W4-ORCH | Wire every built loop into the orchestrator + run budget + events | **No, if** it reuses existing questions verbatim (`savedVerdictsSql`, `familyProfileSql`, `itemsSql`, `verify`'s SQL). Flag if any new orchestrator-level query is added | No to build. Real `offer_checks` write = local Postgres test only; live write is Mac | not started |
| W4-CARDS | Card payload fixes: Value Score on offer cards, parent whitelist, `family` on `?wait=true` | No | No | not started |
| W4-STREAM-SRV | Server-sent-events route over the run-event hub, parent-whitelisted | No | No | not started |
| W4-STREAM-UI | Instant saved feed, streaming cards, status pills, polling fallback | No | No | not started |
| W5-COVERAGE | Trace-log coverage audit + loop end-to-end tests; `loopsOf` wording re-check | No (log-call lines only) | No | not started |
| W5-EVALS | Scoreboard additions, subtler learning trap, regen script | **Possibly YES**: a new/changed trap offer changes the offer-id set, so `savedVerdictsSql` text changes (it lists offer ids) and court queries miss. Avoid by reusing an existing offer; else flag for Mac re-record | Real-AI part is Mac `eval:live-model` | not started |
| W5-DOCS-README | README (Meterless honesty note), `metadata.json`, `data/README.md` | No | No (numbers come from W6) | not started |
| W5-DOCS-MAC | Mac flip-on checklist, `.env.example`, cited year-one table | No | Web search for sources (fine in cloud) | not started |
| S3-DREAM (optional) | H-MEM dreaming between runs | No | No | not started |
| W6-EVIDENCE | Regenerate labelled offline evidence, fill README numbers | No (replay only; never `--live` here) | No | not started |
| W6-REHEARSE | Clean-download rehearsal (fresh clone, no keys) | No | No | not started |

---

## Chunk details

### W4-ORCH: orchestrator wiring for every loop + run budget + events (tracker #14 part 1)
- **Goal:** the run follows plan section 1b: saved verdicts first → workspace → loops → Court → Fact-Checker with targeted corrections → write-back; events go to the hub; 300-second budget; family profile through Zetaris in live mode.
- **Files / lines:**
  - `server/agents/orchestrator.ts`
    - imports 11–18: add `Workspace` (`workspace.ts:55`), `checkWithCorrections` (`factChecker.ts:297`), `runEvents` (`runEvents.ts:106`).
    - 193–196: build `ctx.workspace = new Workspace(runId, <H-MEM note store from memory>, trace)` (constructor logs `workspace_open`, `workspace.ts:62–70`); set `ctx.offerChecks` from `RunDeps` (new optional field) — absent in sample mode with no DB, and the trace says so (`types.ts:86`).
    - 211–216: per-agent `z.withTrace(trace, agentName)` / `memory.withTrace(trace, agentName)` (`zetaris.ts:53`, `memory.ts:27` already accept an agent name); emit `agent_status` working/done/failed per agent.
    - 227–277: replace `checkOne` + plain `verify` with `checkWithCorrections(c, ctx, (card, why) => REVISERS[...]/benefits.revise(card, why, ctx, deps.today), { lessonIds })` (lesson ids from the workspace). Keep the transient-retry and "unchecked → drop with banner" behaviour. `checkWithCorrections` already logs final yes as `approve_card` (target ParentFeed) and rejections as `reject_card`; remove the orchestrator's duplicate `send_back` lines. Emit `card_ready` / `card_removed` as cards settle.
    - 61–64 `toCard`: copy `valueScore` (hand-off from W4-CARDS; one line).
    - 118–126: remove the dead `dcfsa_childcare` branch (`eligibleSpendIds` 122 and `clawback-dcfsa-` filter 125); keep the receipt test numbers (Maya $48.99, Leo $0, Ava $14.58).
    - 280–289: set `stateNote: UNCOVERED_STATE_NOTE` (`benefits.ts:19`) on the result when no state rule matches (`benefits.ts:132` is where that is detected today; expose it via a return flag or `ctx` field, not by parsing the trace); `runEvents.finish(runId)` in a `finally`.
    - 300-second budget: `server/adapters/llm.ts:92–109,442` already has `RUN_DEADLINE_SECONDS` (default 300) and `withRunDeadline`; add a run-level guard so remaining AI steps use saved offline text and log "fallback: run deadline". Test with a slow fake generator.
  - `server/agents/types.ts` 73–88: `AgentContext` fields (e.g. `stateNote?`, event hub handle); `RunDeps` gets optional `offerChecks` and `events`.
  - `server/agents/benefits.ts` 40–42, 79, 110: "Do this by <date>" for expecting families should read "starts at birth"/"after birth" wording (no calendar date before birth). Text only; do not touch its SQL strings. Note `runEligibilityLoop` is already called at `benefits.ts:137` (the W3 QC note that "only tests call it" is out of date).
  - `server/bundleDeps.ts` 23 (`makeRealRunDeps`) and its `loadSeedFamily`: live mode reads the family through Zetaris with `familyProfileSql(id)` unchanged (replays exist for all six families); live mode passes `createOfferCheckWriter(db)` (`offerChecks.ts:45`). Sample mode keeps `data/sample/families.json` and no writer.
  - Tests: `server/__tests__/orchestrator.test.ts`, `sampleMode.test.ts`, `offlineGuarantee.test.ts` (+ new `runBudget.test.ts` if cleaner).
- **Acceptance tests:**
  - Sample run of maya/leo/ava: trace has `workspace_open`, `approve_card`, `correction` (planted wrong card), eligibility lines, per-agent names on `query_zetaris` lines.
  - A run with a fake hub records `agent_status` + `card_ready` events and ends with `finish` (also on a thrown agent).
  - Uncovered-state guest (ZIP 60601, IL): `result.stateNote` = the coming-soon note; MA/NY/CA: null.
  - Slow fake generator: run ends < 300 s (test with a short `RUN_DEADLINE_SECONDS`), with "fallback" lines and offline text.
  - Expecting family (leo): no "Do this by <date>" before birth.
  - Receipt numbers unchanged; full suite still 850+ pass / 0 fail; tsc + build clean; savedVerdicts/register diff empty.
- **Depends on:** waves 1–3 (merged). Soft: W4-CARDS (valueScore field on candidates), W4-STREAM-SRV (event names fixed by `runEvents.ts:14–18`, no change needed).
- **SQL text:** should not change. Risk spots: moving the saved-verdict read "first" must call `savedVerdictsSql` with the identical offer-id set the court uses today (the function sorts ids, so the same set gives the same text); do not add new orchestrator-level queries. If unavoidable → flag for Mac re-record.
- **Live:** real `offer_checks` insert is testable here only on local Postgres (`db-test-setup.sh`); Neon write and real-AI trace are Mac.

### W4-CARDS: card payload fixes (Value Score, whitelist, `family` on wait=true)
- **Goal:** offer cards carry `valueScore` to parents; `POST /api/run?wait=true` includes `family`; the SSE route can reuse the parent card filter.
- **Files / lines:**
  - `server/agents/finePrintCourt.ts` ~205–222 (offer candidate built from `j.check`) and ~313 (second builder): attach `valueScore: valueScore(j.check, worthSettings())` (`valueScore.ts:49,68`). No SQL edits (the `sql`/`evidenceSql` strings stay identical).
  - `server/routes/bundleRoutes.ts` 60: add `'valueScore'` to `PARENT_CARD_KEYS` (copy its fields explicitly, like `parentReceipt`); 76: `export` `parentCard` for W4-STREAM-SRV; 226–227: `?wait=true` returns `{ ...view(req, result), family: entry.family }` (name/birthDate/dueDate/state only — matches the whitelist test from cce546a).
  - Hand-off patch to W4-ORCH: `orchestrator.ts:61–64` `toCard` copies `valueScore`.
  - Tests: `server/__tests__/finePrintCourt.test.ts`, `server/__tests__/bundleRoutes.test.ts`.
- **Acceptance:** an approved offer card in sample mode has `valueScore` in both owner and parent views; parent whitelist test still lists exact keys (updated to include valueScore); `?wait=true` response has `family` with exactly the 4 fields; no trace/SQL in parent payload.
- **Depends on:** none (wave 3 merged). Must land before or with W4-ORCH's `toCard` line, and before W4-STREAM-SRV merges (export name `parentCard`).
- **SQL text:** No. **Live:** No.

### W4-STREAM-SRV: server-sent events over the run-event hub
- **Goal:** `GET /api/runs/:runId/events` streams hub events (replay after `Last-Event-ID`/`afterSeq`, then live, then closes on `finish`). Cards go through the parent whitelist unless the reviewer token is present (hub holds owner cards, `runEvents.ts:8–9`).
- **Files:** new `server/routes/streamRoutes.ts`, new `server/__tests__/streamRoutes.test.ts`. Hand-off patch: register in `server/routes/index.ts` (after line 19). Imports `parentCard` from `bundleRoutes.ts` (W4-CARDS export).
- **Acceptance:** test with `new RunEventHub()` + fake events: parent stream has no owner-only fields; reviewer stream has them; reconnect with last seq misses nothing; stream ends on finish; unknown run → 404 or empty-and-end; listener removed on client disconnect (`listenerCount` back to 0).
- **Depends on:** W4-CARDS (export). Runs alongside W4-ORCH (fake events).
- **SQL text:** No. **Live:** No.

### W4-STREAM-UI: instant saved feed, streaming cards, status pills
- **Goal:** the feed opens instantly from the saved run (`GET /api/families/:id/latest-run`, `bundleRoutes.ts:273`, from `run_results`), then streams new cards most-urgent-first, shows status pills ("Checking recalls…", never "real-time"), falls back to today's once-a-second polling (`client/src/lib/poll.ts:25`) if the stream fails; a recall alert appears only after its check passes (only `card_ready` after fact-check).
- **Files:** `client/src/pages/Feed.tsx` (polling at 7, 124–153), `client/src/lib/bundle.ts`, `client/src/lib/poll.ts`, new `client/src/lib/stream.ts`, `client/src/lib/__tests__/poll.test.tsx`, new `client/src/lib/__tests__/stream.test.tsx`.
- **Acceptance:** stream test with a fake EventSource: cards appear in kind order, pills change wording per `agent_status`, stream error → polling resumes, final state equals the polled result; no "real-time" anywhere in `client/src` (grep); screen tests for expecting + baby's-here still pass.
- **Depends on:** W3-VERSIONB (merged); event shape from `runEvents.ts:14–18`. No file overlap with W4-ORCH/CARDS/STREAM-SRV.
- **Note:** after a restart, guest family ids 404 on latest-run (W2-RESULTS nice-to-have 4) — show the normal checking screen, not an error.
- **SQL text:** No. **Live:** No.

### W5-COVERAGE: trace-log coverage audit + loop end-to-end tests
- **Goal:** M9/M11 done conditions. For every sample family, every agent-log line passes the section 1c checker; every built loop appears as rounds (send-back/correction ≤2, rebuttal ≤1, eligibility 1 question, recall verification, saved verdicts reused, safety kill); each named agent appears where it ran; parent payloads carry none of it.
- **Files:** new `server/__tests__/agentLogCoverage.test.ts`, new `server/__tests__/loopsEndToEnd.test.ts`; log-call lines only in `server/agents/*.ts`; re-check `client/src/pages/AgentWorkspace.tsx:48` `loopsOf` wording against real court/fact/safety trace lines (+ its test).
- **Acceptance:** both new suites pass offline; loops that cannot appear in sample mode without a model (e.g. Court rebuttal with real AI) are covered with a fake generator and listed as such; full suite green.
- **Depends on:** W4-ORCH, W4-CARDS, W4-STREAM-SRV (joint "events + whitelist" check lives here).
- **SQL text:** No — but log lines sit next to SQL in agent files; reviewer must confirm no SQL literal changed.
- **Live:** No.

### W5-EVALS: evals and scoreboard updates
- **Goal:** section 6 items 2, 4, 8. Scoreboard gains: fine-print catches found/total, false alarms on controls, field accuracy, photo metrics (made-up rate target 0; "not measured offline" when no vision replay), recall right/caught, provider+model that answered (already in `scripts/eval.ts:29–118`), loop counts per run. Learning demo moved to a subtler trap. `regen-examples.ts` also copies the agent log `logs/run_bundle_<runId>.jsonl` (today it copies only `run-<runId>.jsonl`, line ~43).
- **Files:** `scripts/eval.ts`, `scripts/regen-examples.ts`, `evals/expected.json`, `server/__tests__/eval.test.ts`.
- **Acceptance:** `SAMPLE_MODE=true npm run eval` exit 0, 6/6 traps (or new total), 0 false alarms, learning flip still works on the subtler trap; scoreboard fields present with honest nulls for unmeasured items; eval.test.ts green.
- **Depends on:** W4-ORCH (loop counts come from its trace lines).
- **SQL text:** **Possibly YES.** A subtler trap that uses a NEW offer or changes sample offers changes the offer-id set → `savedVerdictsSql` text changes and Court/Fact replays miss. Preferred: pick the subtler trap from offers already in the recorded sample data. If not possible, flag: needs `court-live` + `zetaris:record` + `examples:regen -- --live` on the Mac.
- **Live:** real-AI scoreboard = Mac `eval:live-model` (Nightshift/NVIDIA).

### W5-DOCS-README: README + metadata
- **Goal:** README with the Meterless honesty note (#44: "H-MEM: shared workspace, newsroom-loop lessons and case law. Markovian and World Model not used: …"), approved judges' line, cross-source join wording, how a clean download replays saved results, which evidence is offline. `metadata.json` engines field. README number slots left for W6.
- **Files:** `README.md` (Meterless mentions at 4, 44, 145, 226, 235 need updating — currently "memory" only, no workspace/newsroom), `metadata.json` (`sponsor_tech.meterless`, new engines field; `REPLACE-ME` URLs stay until Lyndsay has them), `data/README.md`.
- **Acceptance:** every command and file path in the README exists (script check against `package.json` and the tree); no claim beyond what the code does (e.g. no "Zetaris writes" — open question 5); numbers marked "filled by W6".
- **Decision flag for Lyndsay:** `CLAUDE.md` says "build in Cursor" (sponsor requirement?) but `metadata.json` says "Cursor was optional for this hackathon and was not used." Check `cursor-sponsor-overview.md`/`hackathon-overview.md` and decide the honest wording.
- **Depends on:** W4-ORCH (final setting names). Can draft now.
- **SQL text:** No. **Live:** No.

### W5-DOCS-MAC: Mac flip-on checklist + settings + year-one table
- **Goal:** `docs/mac-flip-on-checklist.md` (model:check both providers + `--vision`; reviewed schema SQL — **replace the tracker's `db:push` step with "apply reviewed SQL by hand with Lyndsay's OK"**; `register.ts --apply --replace=…` incl. `v_offer_verdicts`, `v_recall_orders`, `v_clawback_tx`, rerouted-read views, `v_offer_audit`; `zetaris:record`; `record-vision`; 9am go/no-go; `eval:live-model`; `examples:regen -- --live` with AI off; keep one real `logs/run_bundle_<runId>.jsonl`; Nightshift Sunday-update settings `NIGHTSHIFT_REASONING`, `NIGHTSHIFT_EXTRA_BODY`). All settings in `.env.example`. `docs/year-one-table.md` with current, web-checked, cited sources.
- **Files:** new `docs/mac-flip-on-checklist.md`, `.env.example`, new `docs/year-one-table.md`.
- **Acceptance:** every env var read in `server/` (grep `process.env.`) appears in `.env.example` with a plain-English comment and no real values; every checklist command exists in `package.json`; each table row has a source URL + access date.
- **Depends on:** W4-ORCH (setting names). Parallel with W5-DOCS-README (no shared files).
- **SQL text:** No. **Live:** No (web search only).

### S3-DREAM (optional, only if time)
- New `scripts/hmem-dream.ts`, new `server/__tests__/hmemDream.test.ts`. No shared files. No SQL. Cut first.

### W6-EVIDENCE: regenerate labelled offline evidence
- **Goal:** in sample mode (replays only, never `--live` here) run `npm run eval` and `npm run examples:regen`; refresh `output_examples/` (incl. `ava.json`), `logs/sample/`, `logs/scoreboard.json`; every file made offline is labelled offline; fill README numbers from the files.
- **Files:** `output_examples/`, `logs/sample/`, `logs/scoreboard.json`, README numbers section.
- **Acceptance:** each regenerated file has an offline label; README numbers equal the files (script check); `git diff data/sample/zetaris-cache` empty (no replay rewritten); money-back numbers match or the change is explained.
- **Depends on:** all of wave 5. **SQL:** No. **Live:** No. (The real-AI rerun and its trace are a later Mac step.)

### W6-REHEARSE: clean-download rehearsal
- **Goal:** fresh `git clone` into the scratchpad, no `.env`, `npm ci`, `SAMPLE_MODE=true npm test`, `SAMPLE_MODE=true npm run eval`, `npm run build`, start the app and load one sample family; follow the README literally.
- **Files:** none (report only; README fixes go back as a hand-off patch).
- **Acceptance:** all pass with no keys and no network to Zetaris/model; README steps worked as written.
- **Depends on:** W6-EVIDENCE merged and pushed. **SQL:** No. **Live:** No.

---

## Parallel groups (no two chunks in a group own the same file)

| Group | Chunks | Shared-file notes |
|---|---|---|
| **G1 (wave 4)** | W4-ORCH, W4-CARDS, W4-STREAM-UI | Disjoint. W4-CARDS → W4-ORCH one-line `toCard` hand-off. |
| **G2 (wave 4, after W4-CARDS merges)** | W4-STREAM-SRV | Needs `parentCard` export. Could start in G1 against the agreed export name and merge after W4-CARDS. |
| **G3 (wave 5)** | W5-COVERAGE, W5-EVALS, W5-DOCS-README, W5-DOCS-MAC (+ S3-DREAM) | Disjoint. W5-DOCS-* can start drafting during wave 4. |
| **G4 (wave 6, sequential)** | W6-EVIDENCE → W6-REHEARSE | |

Orchestrator-applied hand-off patches (one at a time, full test run after): `server/routes/index.ts` (stream route), `orchestrator.ts` `toCard` (if W4-CARDS lands after W4-ORCH), `package.json` scripts if any. Integration QC after wave 4 (joint ORCH+STREAM check) and after wave 5. Keep ≤5 worktrees started at once.

## Zetaris SQL change watch-list (Mac re-record only if any of these happen)

1. W5-EVALS: new or edited trap offer → `savedVerdictsSql` text changes → Mac `court-live`, `zetaris:record`, `examples:regen -- --live` (AI off).
2. W4-ORCH: any new orchestrator-level query, or calling `savedVerdictsSql` with a different offer-id set than the court uses → re-record.
3. Everything else: expected no change; reviewer diff check enforces it.

## Needs live keys / Mac (cannot be done in this cloud session)

- Any Zetaris re-record (`zetaris:record`, `agents-live`, `benefits-live`, `court-live`, `examples:regen -- --live`), `register.ts --apply` for view changes.
- Real `offer_checks` writes to Neon (local Postgres tests are fine here), any Neon schema/seed change (Lyndsay's yes each time).
- Nightshift (Mac `127.0.0.1:8088`), `eval:live-model`, `record-vision` (photo replays), one real-run agent log, demo video.
- Open from wave 3: `tabs.test.tsx` / "I got this" tests hardcoded `clawback-fsa-4` vs re-seeded ids (TRACKING-oct24-wave3 "OPEN") — currently passing in this checkout; re-check after any re-seed.

## Status

| Chunk | Status |
|---|---|
| W4-ORCH | not started |
| W4-CARDS | not started |
| W4-STREAM-SRV | not started |
| W4-STREAM-UI | not started |
| W5-COVERAGE | not started |
| W5-EVALS | not started |
| W5-DOCS-README | not started |
| W5-DOCS-MAC | not started |
| S3-DREAM | optional |
| W6-EVIDENCE | not started |
| W6-REHEARSE | not started |

## Rulings from Lyndsay (Oct 25)
- Cursor: no longer needed. Leave metadata.json and CLAUDE.md as they are; W5-DOCS-README must not flag or change the Cursor wording.
- $9,210 year-one total (QC W5-DOCS-MAC): only ~$6,040 independently source-checked (see bundle/docs/year-one-table.md). W5-DOCS-README and any demo text must say "estimated from our research; about $6,040 source-checked", not a flat $9,210. Deck is out of scope (Lyndsay: not now) — list it for her morning.
- Meterless safety (research, qc-reports/meterless-safety-research.md): app uses Meterless for H-MEM memory + Nightshift routing only; Scout Intent (safety) was cut on Oct 21 (build-plan.md:76). Rules require >=1 Meterless engine + Nightshift primary — met. README must list Scout Intent as not used and say injection checks are our own code. CLAUDE.md wording ("memory + safety") left for Lyndsay. Optional Fix B (Scout checking step, ~3-5h) NOT built — her call.

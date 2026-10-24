# Task 14 report: submission packaging

Commit: e3bd70a (local main, not pushed, repo not public).

## Done
- SAMPLE_MODE boots with no secrets and no database: families from data/sample/families.json; Zetaris answered from the saved replay cache (cache-first when no Zetaris keys; with keys + SAMPLE_MODE it stays live and re-captures); in-memory store (zip prefix map in new server/sampleZips.ts, shared with scripts/seed.ts); LLM falls back to deterministic text with empty MODEL_API_KEY.
- Gap found and fixed: Zetaris and memory calls were NOT in run traces. Added `ZetarisClient.withTrace` and `BundleMemory.withTrace`; the orchestrator wires them per run. Saved traces now contain zetaris `query_cached` lines (maya 25, leo 18, ava 17) and memory lines (5 each).
- TRUST_PROXY=1 flag, default port 5050, npm scripts `eval` and `seed`.
- Files: README.md (13 sections), data/README.md, docs/architecture.md (mermaid), metadata.json, LICENSE (MIT + pre-existing credits), .env.example (SAMPLE_MODE=true, DATABASE_URL commented out), input_examples/ (maya, leo, ava, custom-family), output_examples/ (4 saved SAMPLE_MODE runs + existing learning/), logs/sample/ (4 traces, un-ignored via .gitignore), server/__tests__/sampleMode.test.ts.

## Clean-setup test (clone to /tmp/bundle-clean-15348/bundle; no ../.secrets there; temp dir removed afterwards)
1. git clone; cp .env.example .env (SAMPLE_MODE=true); npm ci
2. npm run dev: /api/health answering after 1.1 s (log: "serving on port 5050")
3. POST /api/run?wait=true: leo = 14 cards, maya = 17 cards (>= 9). ava via production build (`npm run build && npm start`) = 11 cards. The no-wait call returns {runId}.
4. `npm run eval` in the clean clone ran with no secrets: 6/6 traps, 0 false alarms, 100% sourced, learning run1 approved, run2 blocked.

## Checks
- `git grep -nE 'npg_|AIza|akiurs|BEGIN PRIVATE KEY'` (working tree and index): no output.
- Also compared every value (12+ chars) in ../.secrets/* against tracked files: no leak.
- npm run check clean; npm test 21 suites / 195 tests pass.
- Output examples and traces contain no income.

## Decisions
- Template commit: README cites 6af369a (imported as b2bc3be) per the progress ruling, and notes the brief's a9542c2.
- output_examples are real SAMPLE_MODE runs (replayed Zetaris, offline fallbacks); README says so. The saved scoreboard is offline-fallback (llmMode in the file), stated honestly.
- custom-family example deliberately shows the cache-miss path: banner + never-empty feed (9 cards). A sample-mode limit, documented.
- Capture timestamps for the Zetaris cache come from file times (2026-10-23, 10:18-14:18 local); the cache files carry none.
- LICENSE copyright line is "Bundle contributors" (owner name unknown).
- metadata.json schema is a guess (flagged inside the file).

## Lyndsay must do
- Check metadata.json against the HackOS spec (ask in #help desk); fill repo, video, slides and live-demo links (REPLACE-ME placeholders); set team name.
- Decide the LICENSE copyright holder name.
- Mon Oct 26: record video and slides. Tue Oct 27: make repo public, open link in a logged-out window, submit on HackOS.
- Optional: a live-model scoreboard run (needs MODEL_API_KEY + model ids) if she wants the README to claim real-AI results.
- Post-hackathon: delete Zetaris cluster/key, reset Neon password.

## Concerns
- docs/zetaris-notes.md lives in the parent hackathon folder, not the repo; README does not link it.
- Poverty-guideline figures remain unverified (pre-existing note).

## Fix round 1
- I1: README failure table now says one retry for the known transient error (purchases query, thrift/resultset), then saved response, else skip the agent.
- I2: README header, tech table, section 13 and metadata.json now say "NVIDIA-hosted models (supported, not exercised in the saved results)".
- data/README.md notes cache capture times are file modification times.

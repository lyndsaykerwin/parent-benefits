# Pre-submission prep report (2026-10-23)

Repo: /Users/lyndsay/Documents/hackathon/bundle (local main, nothing pushed). Status: done.

## Commits
- 3fbb012 docs: Cursor wording (also contains ALL README edits: NVIDIA key section, Deploy section, RUN_DB_TESTS note, section-8 note)
- f054c02 feat: scripts/check-model.ts, scripts/regen-examples.ts, npm scripts model:check / eval:live-model / examples:regen, scoreboard llmMode = nvidia:<reasoning>+<fast>, unit tests
- 49d4dd2 test: seed test needs RUN_DB_TESTS=1 (and DATABASE_URL); prints a skip message otherwise
- 52a13f0 deploy: render.yaml

## Decisions
- Cursor: replaced in README (2 places) and metadata.json. Repo docs had no Cursor text. Files OUTSIDE the repo still mention Cursor (hackathon/CLAUDE.md, plans/build-plan.md, cursor-sponsor-overview.md); not touched.
- check-model: reasoning prefers ultra, then super, then any other non-nano Nemotron; fast prefers nano. Embedding/reward/vision/guard models are never suggested. Highest id in a tier wins. `--write` edits only the MODEL_REASONING / MODEL_FAST lines of ../.secrets/bundle.env.local (appends if missing). Key is never printed. Exit 2 with no key; exit 1 if the list call or either test message fails.
- llmMode: NvidiaGenerator now exposes `models`; llmModeOf returns `nvidia:<reasoning>+<fast>`. With a key but no model ids the app falls back to offline and the label stays "offline-fallback" (honest).
- examples:regen did not exist; added. It runs input_examples/*.json through the real POST /api/run code and rewrites output_examples/*.json and logs/sample/*.jsonl. Default replays saved Zetaris answers (it deletes ZETARIS_* from its own process env); `-- --live` goes live. Verified once, then reverted the regenerated files so saved evidence is unchanged. (First attempt went live to Zetaris because keys are in the secrets file and rewrote the replay cache; I reverted that with git checkout before any commit.)
- render.yaml: build is `npm ci --include=dev && npm run build` (differs from the requested plain `npm ci`): with NODE_ENV=production plain npm ci skips vite/esbuild and the build would fail. Plan is `starter` (always-on). Also sets NODE_VERSION=24 and optional MODEL_* as sync:false. No account created.

## Verification
- npm run check: clean. npm test: 24 suites passed, 1 skipped (seed), 223 tests passed, 8 skipped (seed, intended).
- `git grep -nE 'npg_|AIza|akiurs|BEGIN PRIVATE KEY'`: no output.
- model:check with no key exits 2 with a clear message. Live NVIDIA calls NOT tested (no key): pickModels is tested against a fake /models payload; the HTTP path is untested.

## Concerns
- The NVIDIA /models response shape is assumed OpenAI-style ({data:[{id}]}).
- README section 8 still says saved runs are offline; update after a real-model run.
- Commit 3fbb012 is mislabeled (holds all README work).

## Fix round 1 (review: llmMode could overclaim a real model)
- NvidiaGenerator counts `stats {ok, failed}`. llmModeOf: ok>0 and failed=0 -> `nvidia:<ids>`; ok>0 and failed>0 -> `nvidia-partial:<ids>`; ok=0 -> `offline-fallback`. Scoreboard gains `llmCalls {ok, failed}` (null for non-NVIDIA); a --learning merge also records `learningLlmMode` / `learningLlmCalls`.
- `eval --require-model` (used by `npm run eval:live-model`, both steps) runs a pre-flight: no key/ids -> exit 2, failed tiny call to either model -> exit 1, both before any file is written. Pre-flight calls are not counted in the stats. Verified: with no key it exits 2 and the repo is untouched.
- check-model `--write` now saves only after both test calls succeed, via temp file + rename keeping the file's permissions (0600 for a new file).
- Tests added (checkModel.test.ts): counts, three labels, pre-flight failures/pass, atomic write. check clean; full npm test passes (1 suite skipped = seed); secrets grep empty.

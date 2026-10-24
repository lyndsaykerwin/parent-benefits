# Prep review (b0171e6..HEAD), 2026-10-23

Spec: all four requested changes are present. Verdict: spec compliant, with 1 Important quality gap and a few Minor ones.
Ran only checkModel.test.ts: 8/8 pass. Read-only otherwise (secrets file inspected for key NAMES only).

## Spec
1. Cursor wording: exact sentence in README (2 places) and metadata.json; no other Cursor text in the repo (only CSS "cursor-" classes). OK.
2. check-model: GET {base}/models, ultra > super > other non-nano for MODEL_REASONING, nano for MODEL_FAST, embed/reward/vision excluded; tiny chat call per model with timing; exit 2 without key; unit tests. npm scripts model:check, eval:live-model, examples:regen exist; README section present. OK.
3. render.yaml + Deploy section: NODE_ENV=production, SAMPLE_MODE=true, TRUST_PROXY=1, plan starter, PORT comes from Render (server reads PORT). `npm ci --include=dev` is the right call: with NODE_ENV=production plain `npm ci` skips vite/esbuild and `npm run build` fails. Good deviation, documented. NODE_VERSION=24 matches engines >=24. OK.
4. Seed test opt-in via RUN_DB_TESTS=1 (and DATABASE_URL), prints a skip line. OK.

## Named risks
- Env-file updater: line-anchored regex, function replacer (so `$` in values is safe), other lines untouched, CRLF not an issue (file has 0 CR), file mode 0600 preserved by writeFileSync on an existing file. Cannot corrupt other lines. Caveats (Minor): not atomic (crash mid-write could truncate the secrets file; no backup), `export KEY=` lines would not match and a duplicate gets appended, only the first duplicate is replaced.
- Key never logged: only ids, timings, status code/text, and a 40-char model reply are printed. Request headers are never printed (fetch errors give only message). Remaining theoretical path: SDK error text from the server could echo a masked key fragment; low risk. OK.
- Eval labeling: label is by generator class, not by what happened. See Important 1.

## Findings
### Critical
None.

### Important
1. eval honesty: `llmModeOf` returns `nvidia:<ids>` whenever an NvidiaGenerator exists, even if every call failed (bad ids, timeout, rate limit) and askJson/court silently used offline fallbacks. The scoreboard would then claim a real-model run that was actually offline text. Fix: have NvidiaGenerator count successes/failures (or have eval do a pre-flight call and record counts) and report `nvidia:<ids>` only if calls succeeded, else `nvidia-failed:<ids>` / `offline-fallback`; or make `eval:live-model` abort when MODEL_API_KEY/ids are missing or a pre-flight call fails.

### Minor
2. `npm run eval:live-model` with no key still runs and overwrites logs/scoreboard.json as offline. Honest label, but the name promises a live model. Fix: exit with a clear error if createGenerator() returns UnavailableGenerator.
3. `--write` saves ids before the test calls; a failed test leaves unverified ids saved. Fix: write only after both tests pass (and write via temp file + rename).
4. README says `eval:live-model` "then the learning demo"; the second command (`--learning`) just re-runs/merges the learning part already done by the first. Harmless double run; could be dropped.
5. Commit 3fbb012 is mislabeled (holds all README work); cosmetic.
6. Untested: real /models response shape and the HTTP path (no key). Reasonable assumption of OpenAI-style {data:[{id}]}.

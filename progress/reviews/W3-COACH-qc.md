# W3-COACH QC report (branch worktree-agent-aa5ac74d3b9737061, commit dffdd7b)

Verdict: PASS. No must-fixes.

Checks run (in the worktree, bundle/): `npm test` = 644 passed, 10 skipped, 0 failed. `npx tsc --noEmit` = clean. `git status` clean afterwards (no test-rewritten files).

## A. Done check
- Zetaris read: `fetchRecentIssues` (coach.ts) calls `z.runQuery(coachIssuesSql(...))` using the exported function from savedVerdicts.ts. savedVerdicts.ts and scripts/zetaris/register.ts are not in the diff (text unchanged, so no Mac re-record needed).
- Always-ask-50-then-trim: asks `coachIssuesSql(Math.max(limit, 50))`. `ZETARIS_ISSUE_READ = 50` equals `COACH_ISSUE_LIMIT = 50` in scripts/zetaris/record.ts:24, which is the limit the recording used (record.ts:31). The replay key is a SHA-256 of the SQL text, so the question matches the recording. Then filters kind==='issue' and `.slice(0, limit)` (newest first, as SQL is ORDER BY id DESC). Test asserts the asked SQL equals `coachIssuesSql(50)` for limit 2 and 40. A sample-mode test with the real ZetarisClient against data/sample/zetaris-cache passes, so the recorded replay does match.
- Missing replay: test with a nonexistent cache dir rejects with ZetarisUnavailable. DrizzleStore test deletes DATABASE_URL and still passes, proving no Neon read. In the route (bundleRoutes.ts:305) the throw is caught, logged, and the feedback is still saved.
- Writes: `addFeedback` in DrizzleStore is unchanged (still Neon insert).
- M1 learning loop in sample mode: bundleDeps.ts:45 builds `new MemoryStore(zipStateMap())` with no reader, so report-twice -> proposal runs from the in-memory list; the existing bundleRoutes/runResults/eval tests pass. No route edit was needed (store-method approach, as the tracker preferred).
- Judgement on the sample-mode choice: CORRECT. The recorded replay is a frozen snapshot of 6 past reports; if sample mode read it, a parent's new reports would never show up and "report twice -> proposal" would break (M1). The in-memory list is not Neon, so M12's "no agent reads agent input from Neon directly" holds. M12's "sample mode still works" is satisfied. The replay path is still exercised in tests with the real client. Residual gap (acceptable): in sample mode the app itself never goes through Zetaris for this read; the live path is covered by fake-Zetaris tests only until the Mac flip-on.

## B. Tightness
- Files changed: bundle/server/bundleStore.ts, bundle/server/agents/coach.ts, bundle/server/__tests__/coach.test.ts. All owned. No package/route/SQL edits.
- No hardcoded outputs, personal data or secrets (env names only; test rows are synthetic fake-Zetaris rows; the replay test reads the recorded cache).
- Tests are meaningful (exact SQL, trim, kind filter, null note, error pass-through, no-Neon proof, replay, honest missing-replay).
- No dead code found.

## Nice-to-haves
1. coach.test.ts: new imports sit mid-file (lines ~71 and ~74) and `fetchRecentIssues` is imported separately from the top import; merge into the top imports.
2. `zetarisFromEnv` (bundleStore.ts) duplicates env wiring that probably exists elsewhere (e.g. scripts/bundleDeps); consider sharing at W4-ORCH.
3. `toDate` swallows unparseable dates to null silently; fine for the Coach, just noting.
4. When a Mac flip-on happens, run one live report-twice check through DrizzleStore + real Zetaris to confirm a just-saved report is visible via the view immediately.

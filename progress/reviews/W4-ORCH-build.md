# W4-ORCH build report (Oct 25)

**What changed (plain English):** the main run coordinator (`bundle/server/agents/orchestrator.ts`) now actually uses the pieces built in wave 3 that were sitting unused.

- Shared notebook: every run opens one `Workspace` (Meterless H-MEM) and gives it to all agents (`workspace_open` now appears in the trace).
- Saved grades: `ctx.offerChecks` comes from `RunDeps.offerChecks`; `bundleDeps.makeRealRunDeps` supplies a writer over the real database (opened only when a grade is saved; none in SAMPLE_MODE).
- Fact-check: `checkWithCorrections` replaces plain `verify` (line-specific corrections, final yes logged as `approve_card`, `reject_card`, `correction`). The benefits reviser is `(c, why) => benefits.revise(c, why, ctx, today)`. Saved lesson ids come from the new `finePrintCourt.lessonIdsFor` (backed by `Newsroom.lessonIdsFor`). `MAX_RETRIES` still works via a new `maxRounds` option on `checkWithCorrections`. The one-retry for transient Thrift errors is kept.
- Eligibility loop: `planBenefits` already runs `runEligibilityLoop` (benefits.ts), and `revise` skips it, so it is NOT run again in the orchestrator (no double-run, no new Zetaris SQL).
- Live events: `runEvents.emit` for agent status (working/done/failed per agent plus fact_checker), `card_ready` per approved card, `card_removed` per dropped card; `runEvents.finish(runId)` in a `finally`. `RunDeps.events` lets tests inject a hub.
- `stateNote: UNCOVERED_STATE_NOTE` when the planner read the rules and none match the family's state (`ctx.stateCovered === false`); a failed planner sets nothing.
- `toCard` copies `valueScore`; the court sets it on fresh cards (merged with W4-CARDS, which also sets it on saved-grade cards; duplicate line removed in the merge).
- `withTrace(trace, agentName)` per agent for Zetaris and memory.
- Removed the dead `dcfsa_childcare` / `clawback-dcfsa-` receipt branch (money back is already an explicit list of claim types).
- Expecting families: card text now says "Going by your due date, plan to do this by about <date>. The date moves if your baby arrives early or late." instead of "Do this by <date>".

**Not done (by instruction):** `POST /api/run?wait=true` including `family` (bundleRoutes.ts) is left to W4-CARDS. No Zetaris SQL changed or added. No replays written. No `db:push`.

**Tests added/changed:** orchestrator wiring tests (workspace, offerChecks, withTrace names, corrections, lessons, events, stateNote, valueScore), benefits wording tests, newsroom `lessonIdsFor`/valueScore test, agent-log tests (a real run now has a workspace backend and notes). Shared test helper `server/__tests__/helpers/fakeChecker.ts` for suites that automock the fact-checker.

**Results (after merging claude/funny-darwin-ccrblc):** SAMPLE_MODE=true npm test: 899 passed, 11 skipped, 0 failed. tsc clean. build OK. Offline eval: 6/6 traps, 0 false alarms, stable, learning flip (blocked after learning), money back Maya 4899, Leo 0, Ava 1458, expectationFailures [].

## Follow-ups (after QC)
- Run budget guard: RunDeps.budgetMs (default RUN_DEADLINE_SECONDS, else 300 s) and injectable now(). Once over, no new checks or corrections start; checked cards stay, stand-ins fill the rest, banner set, "fallback: run deadline" logged once, events finish. Tests: runBudget.test.ts.
- Court-grade writer: makeOfferCheckWriter() returns nothing when SAMPLE_MODE=true even with LIVE_MODEL. Test: offerCheckWriterGuard.test.ts.
- Expecting-family AI prompt now says "Going by the due date, the deadline is about <date>".
- Re-run: 906 passed / 11 skipped / 0 failed, tsc clean, build OK, eval unchanged (6/6, 0 false alarms, 4899/0/1458, learning flip).

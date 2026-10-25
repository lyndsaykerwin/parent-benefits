# W4-ORCH QC (Oct 25) - Verdict: PASS (2 minor follow-ups)

Run in worktree (2f26985): npm test 899 pass / 11 skip / 0 fail; tsc clean; build OK; eval 6/6 traps, 0 false alarms, expectationFailures [], money back maya 4899 / leo 0 / ava 1458, learning flip OK. Generated files reverted.

Checks
1. Wiring: workspace (one shared, workspace_open), offerChecks from RunDeps, checkWithCorrections with revise + court lesson ids, eligibility loop NOT re-run (planBenefits runs it once), events + finish(runId) in outer finally (covers thrown run), stateNote via ctx.stateCovered===false (no trace parsing), toCard copies valueScore, withTrace(trace, agent) per agent, approve_card logged by checker, dcfsa branch removed, expecting-family wording changed, ?wait=true returns family (bundleRoutes.ts:244). All present and tested.
2. runEvents: only orchestrator imports it; no route exposes events yet, so no parent leak. W4-STREAM-SRV must whitelist (cards in card_ready are full owner cards via toCard).
3. SQL: no *Sql/SELECT lines in agent diff; savedVerdicts.ts and scripts/ untouched; no replays changed; no schema change. Writer is undefined when sample mode (bundleDeps, `sample = isSampleMode() && !opts.live`), opens DB lazily.
4. checkWithCorrections: bounded by maxRounds (MAX_RETRIES, default 2); one transient re-check; reviser throws caught -> card dropped; worker loop catches and emits card_removed.
5. Merge: bundleRoutes.test.ts just adds fakeChecker import/call (fine); finePrintCourt valueScore single set at line 223, no duplicate.

Follow-ups (non-blocking)
1. 300-second run budget guard from TRACKING (slow-generator test, "fallback: run deadline" lines) was not built or mentioned in the build report; only the pre-existing per-call deadline exists. Confirm it is deferred or give it a chunk.
2. The writer's sample-mode guard lives only in makeRealRunDeps; with SAMPLE_MODE + opts.live (eval:live-model) it would write. Add a guard in the writer or court if that should never happen.
3. Minor: benefits.ts:116 AI facts string still says "Deadline: <date>" for unborn (prompt-side only).

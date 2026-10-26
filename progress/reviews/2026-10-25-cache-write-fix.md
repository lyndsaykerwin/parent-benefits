# Stop real-mode runs from rewriting the saved Zetaris answers (Oct 25, Mac)

**Status: fixed and green. Nothing committed.** `npm test` passed twice in a row: 1203 passed, 11 skipped, 0 failed (81 test files passed, 1 skipped). `npm run check` (the type check) is clean.

## 1. Why real mode rewrote `data/sample/zetaris-cache/`

The folder holds recorded Zetaris answers that practice mode and the tests play back.

- **The exact line:** in `bundle/server/adapters/zetaris.ts`, `runQuery()` called `this.writeCache(text, res)` after **every** successful live query.
  - Every app run in real mode (`SAMPLE_MODE=false`) therefore saved its answers into the shared sample folder.
  - The same was true of the Coach, the offer-audit route and `npm run eval -- --live`.
- **What it caused today:**
  - The deliberate re-record ran at 19:40.
  - Then real-mode runs at 19:45–19:46 (logs `run-live_*` and `run-maya-38608bba…`) rewrote 24 files.
  - Most of those rewrites changed only the `ms` timing number. That is where the stray modified files came from.
  - A few rewrites changed real data, such as the report-card answer.

**The fix: only a deliberate recording may write.** I wrote the tests first and watched them fail.

- `ZetarisOptions` has a new setting, `record` (off by default). The client saves an answer only when `record` is on.
  - Live runs still *read* the folder as a backup when Zetaris is down.
- `record: true` is set only by:
  - `scripts/zetaris/record.ts` (`npm run zetaris:record`)
  - `court-live.ts`, `agents-live.ts` and `benefits-live.ts`
  - `examples:regen -- --live`, which sets `ZETARIS_RECORD=true`. `makeZetarisClient` honours that setting only outside practice mode.
- **Tests:**
  - `zetaris.test.ts`: a live run without `record` writes nothing and leaves an existing file untouched; the copies made by `withTrace` keep the setting; the record path still writes.
  - `sampleMode.test.ts`: `makeZetarisClient` records only with `ZETARIS_RECORD=true`, and never in practice mode.
  - `savedVerdicts.test.ts`: the two tests that act out a recording run now pass `record: true`.
- `scripts/eval.ts`: I corrected a comment. `--live` no longer "refreshes" the saved answers.

## 2. Saved answers: re-recorded, but "7 offers, 3 had a catch" cannot come back

- **The 19:40 recording was overwritten.** Its report-card file, `f5fda7f7…json`, had been rewritten at 19:46:34 by a real-mode run.
- **I re-ran the recording:**
  - `npm run zetaris:record`: all 10 questions ok.
  - `npm run examples:regen`: practice mode, all 7 families.
  - I did **not** run `db:push`.
- **The report card now reads "12 offers, 7 had a catch":** Amazon 3/2, Babylist 1/1, Enfamil 2/2, Pampers 2/0, Similac 1/1, Target 1/0, Walmart 2/1.
  - This is the true answer from Zetaris now. Those real-mode runs also saved new court grades into Neon (the app's online database).
  - "7 offers, 3 had a catch" is no longer what the live data says.
  - That earlier file was never committed to git, so it cannot be restored. **The coordinator should decide whether 12/7 is acceptable for the demo.**
- **Clean-up of timing-only changes:** for 29 files the only difference from the last commit was the `ms` timing number. I put those back to the committed version, so no data changed.
- **6 changes remain, all real data:**
  - `f5fda7f7` (report card, new file)
  - `78a2ecc5` (offer audit)
  - `94a664fc` (saved grades, all offers)
  - `f684fa20` (coach issue reports)
  - `9714eeb5` and `93cbf5ba` (saved grades for smaller groups of offers)
- **A caveat on the last two:** real-mode runs wrote them, at 19:19 and 19:45. The record script doesn't ask those exact questions. Their rows match the fresh 19:50 recording, so I kept them.
- **Checked:** no cache file changed during the final two test runs.

## 3. Tests and the eval flake (root cause found and fixed)

- **First pair of runs, before the flake fix:**
  - Run 1: 2 failed.
  - Run 2: 3 failed.
  - 2 of these were the `savedVerdicts` tests above.
  - The other was `eval.test` "stable across 3 runs", which failed only some of the time.
- **Root cause:** `BundleMemory.recallRules` and `recallLessons` (`server/adapters/memory.ts`) asked H-MEM for its top 25 matches. Only *after* that did they throw away workspace notes.
  - H-MEM is the Meterless memory library.
  - Workspace notes are the short messages agents post to each other during a run.
- **Why that mattered:** every run posts many notes that quote the same fine print. Each note is saved with its run's id.
  - As runs pile up, these notes fill the top 25.
  - Tiny timing differences in H-MEM's "how recent" score then decided whether the learned rule `mem-28` made the cut.
  - When it didn't, the trap offer 1328 was approved instead of blocked. A filler card then appeared and the run's result changed.
  - The same thing would happen in a long-running live server.
- **The fix:** ask H-MEM with a run id that no run uses (`NO_RUN_NOTES`). H-MEM's own filter then drops every run note *before* ranking. Rules, lessons and family facts carry no run id, so they are unaffected.
- **New tests in `memory.test.ts`:** 48 look-alike notes no longer push out a rule or a lesson. Both tests failed before the fix.
- **Proof:**
  - A throwaway repro test (since deleted) ran learning + 3×3 runs 6 times per pass. Before the fix, 3 of 4 passes were unstable. After it, 5 of 5 passes were stable.
  - `eval` + `agentLogCoverage` ran 5 times: 59/59 each time.
- **Final:** `npm test` ×2, both with 1203 passed, 11 skipped, 0 failed. `npm run check` is clean.

## Files changed (code)

`bundle/server/adapters/zetaris.ts`, `bundle/server/adapters/memory.ts`, `bundle/server/bundleDeps.ts`, `bundle/scripts/zetaris/{record,court-live,agents-live,benefits-live}.ts`, `bundle/scripts/regen-examples.ts`, `bundle/scripts/eval.ts` (comment), tests: `bundle/server/__tests__/{zetaris,sampleMode,savedVerdicts,memory}.test.ts`.

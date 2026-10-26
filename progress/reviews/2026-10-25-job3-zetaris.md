# Job 3: Zetaris re-recording for the offer report card (Oct 25, Mac)

**Status: blocked partway. The report card is still empty in practice mode.** Nothing committed.

## What blocks it
- The report card reads a Zetaris view (a saved question) called `v_audit_by_source`. It counts offers by where the grade came from: our scans or a parent's audit.
- That view needs a `source` column on the `offer_checks` table in Neon (the app's online database).
- Neon does not have that column yet. I checked read-only: `column "source" does not exist`. The `item_photos` and `claims` tables are missing too.
- They are added by the database change `0002_v2_foundation` (handoff step 1: `cd bundle && npm run db:push`). I read the change: it only adds things (2 new tables, 7 new columns, existing data untouched).
- When I tried to run `npm run db:push`, Claude Code's safety check refused it as a change to a shared resource. **Lyndsay needs to run it or approve it.**
- Without it, `register --apply` would fail for the new view, so I did not run register, `zetaris:record` or `examples:regen`. Re-recording now would also not fill the report card.

## What was done
1. **Register dry run** (no changes): `npx tsx scripts/zetaris/register.ts`. Still to create: view `v_audit_by_source`, plus tables `item_photos` and `claims`. Everything else already exists, including the `cpsc_recalls` live table.
2. **The CPSC recall query works against live Zetaris (read-only).** The query is in `server/ingest/gearRecall.ts`. 739 CPSC recalls in total. Searches for "crib", "stroller" and "Fisher" found 11, 7 and 1 matches. "Graco" found 0. It needs no registering, because it uses the existing `bundle_live.cpsc_recalls` table.
3. **Fixed a gap: the record script never asked the report-card question.** Even after register, `npm run zetaris:record` would not have saved the answer, so the report card would have stayed empty.
   - Added `offerAuditBySourceSql()` to `buildQuestions` in `bundle/scripts/zetaris/record.ts`.
   - Updated the matching test in `bundle/server/__tests__/savedVerdicts.test.ts` (20/20 pass).
4. **Browser check and screenshot skipped:** there are no real grades to show yet.

## Tests (`npm test`)
- 1172 passed, 5 failed, 11 skipped (80 test files: 78 passed, 1 failed, 1 skipped).
- All 5 failures are in `server/__tests__/agentLogCoverage.test.ts`. The offline runs now show 5 "saved verdict" lines where the test expects 0.
- **The failures are not from this job.** I made a clean copy of the last commit and ran the test there. It passed 46/46 with each of these added:
  - my `record.ts` change
  - the local zetaris-cache files
  - the other helper's `auditStore.ts`, `liveSearch.ts` and `offerRoutes.ts`
  - the `.secrets` file
  - `data/hmem`
  - the new vision-cache and photo files
- The cause is something else in the live folder. Other helpers are still editing files, so that folder kept changing while I tested. Re-run the test after they finish.

## Next steps, in order (Mac)
1. `cd bundle && npm run db:push`. Only adds things.
2. `npx tsx scripts/zetaris/register.ts --apply`. Creates `v_audit_by_source`, `item_photos` and `claims` in Zetaris.
3. `npm run zetaris:record`, then `npm run examples:regen`.
4. In Neon there are no rows with source `user_audit` yet. Until a parent audit is saved in live mode, every row will be source `court` (our own scans). The report card will show only "our scans" numbers.

---

## Restart (after the coordinator fixed Neon; I did not run db:push)

**Status: done. The report card now shows real grades in practice mode.** Nothing committed.

1. **`register.ts --apply`:** created `item_photos`, `claims` and the view `v_audit_by_source` in Zetaris. All ok; everything else was skipped because it already exists.
2. **`npm run zetaris:record`:** all 10 questions ok, including the new "offer report card (by source)" one. It recorded 5 rows, one per store, all with source `court` (our own scans). No parent audits are in Neon yet.
3. **`npm run examples:regen`:** rewrote `output_examples/*.json` and `logs/sample/*` for all 7 sample families.
4. **Browser check** (practice mode, port 5053, agent-browser, sample family Maya, Deals tab):
   - The card reads "We've graded 7 offers. 3 had a catch." Amazon 2, Babylist 1, Pampers 2, Target 1, Walmart 1.
   - This matches the recorded Zetaris answer and `/api/offers/report-card` exactly.
   - Screenshot: `progress/reviews/2026-10-25-job3-zetaris.png`. Server and browser stopped.
5. **Nothing hardcoded:** searching the app code for those numbers finds nothing. They come only from the recorded file in `data/sample/zetaris-cache/` (the new file is `f5fda7f7…json`).

## Tests after re-recording: 1184 passed, 8 failed, 11 skipped
- **6 failures** in `server/__tests__/agentLogCoverage.test.ts`:
  - The 5 from before, plus Maya, plus the "one Court outcome line per offer" check.
- **2 new failures** in `server/__tests__/eval.test.ts`:
  - "8 traps, stable across 3 runs"
  - "learning demo flips the trap offer"

**Root cause (proved):** the saved-grade answers now hold real grades.
- Three recorded "saved verdicts" answers changed from 0 rows to 4, 5 and 7 rows of real grades for offers 1313 onward. Live Neon now holds grades in `offer_checks`.
- In practice mode, the Fine Print Court (the agent that grades offers) sees those saved grades. It reuses each one ("the saved grade is reused (no AI)") instead of judging the offer again.
- So every family except Ava now logs 4–5 "saved_verdict" loop lines and 0–1 "offer N outcome" lines.
- The tests were written when those answers were empty. They assume practice mode has "no saved grades yet".

**Proof:**
- A clean copy of the last commit with the new recorded answers fails the same 8 tests.
- Putting back only those 3 saved-verdict files makes `eval` and `agentLogCoverage` pass 59/59.
- The code is fine, and neither my `record.ts` change nor the live-search helper's files are involved.

**Decision for Lyndsay or the coordinator:**
- **(a)** Update the tests to expect saved-grade reuse in practice mode. This shows off the "learn from past grades" loop in the demo.
- **(b)** Keep the old empty saved-verdict answers: restore those 3 files with `git checkout`. Keep the new report-card file. Practice mode then behaves as before.
- **(c)** Record the saved-verdict answers but have the eval use its own empty set.

Not done yet: the earlier 5 failures appeared before re-recording. I could not reproduce them from a clean copy then, because the folder was changing under parallel edits. They are now fully explained by the cause above.

---

## Test fix (coordinator's mixed decision); old answer files not restored

**Status: all green.** `npm test`: 81 test files passed, 1 skipped; 1194 tests passed, 11 skipped, 0 failed. `npm run check` (type check) is clean. Nothing committed.

- **Eval: option (c), the eval gets its own empty set of saved grades.**
  - In `bundle/scripts/eval.ts`, `makeEvalZetaris({ freshVerdicts: true })` makes the saved-grades question (`v_offer_verdicts`) answer "none yet". Every other question still replays from the recorded answers.
  - The per-agent copies of the Zetaris connection that `withTrace` makes get the same treatment. The first try missed them, because each agent gets its own copy.
  - Both `server/__tests__/eval.test.ts` and `npm run eval` use it, so the scoreboard and the test agree.
  - No checks were loosened: 8 of 8 traps, and the learning demo flips the trap offer to blocked. 13 of 13 pass.
- **Agent-log test: option (a), the test now expects the real practice-mode behaviour** (`server/__tests__/agentLogCoverage.test.ts`).
  - Checks per family:
    - The saved-grades read line is one of the known answers.
    - Every reuse line belongs to the Court, names one offer, and uses the exact "saved grade is reused (no AI)" wording.
    - Reuse lines are not repeated, and never outnumber the grades the read found. When none were found, there are none.
  - The "one Court outcome line per offer" check became: every offer in court has exactly one line, either a fresh outcome or a reuse.
    - No offer is both judged and reused.
    - The number of lines equals the "N offer(s) in play" count.
    - Fresh outcome lines still read "no rebuttal needed" and are not counted as rebuttals.
    - Across the families, both paths must appear.
  - 46 of 46 pass.
- **Not touched:** `liveSearch.ts`, `offerRoutes.ts` and `auditStore.ts`.

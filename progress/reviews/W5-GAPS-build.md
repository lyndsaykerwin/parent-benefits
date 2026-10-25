# W5-GAPS build report (Oct 25, 2026)

Paths are inside `bundle/`. No Zetaris SQL text changed, no schema change, nothing pushed, no live writes.

## Done
1. **Family profile through Zetaris.** `server/agents/orchestrator.ts`: new `familyFromRow`, `loadFamilyViaZetaris` (uses the existing `familyProfileSql` unchanged), and `defaultLoadFamily(id, {z, neon, log})`. If Zetaris fails or has no row, the log says so in plain words and it falls back to Neon (live) or the sample file (SAMPLE_MODE). Wired in `server/bundleDeps.ts` (`makeSeedFamilyLoader`; with no Zetaris settings outside SAMPLE_MODE it logs and reads Neon). Sample mode now reads the recorded replay. Test `familyViaZetaris.test.ts`: all six families (maya, leo, ava, noor, cal, fern) come back from the replay identical to `families.json`, with zero cache-miss trace lines, so no re-recording of replay or trace files is needed.
2. **"Forget my items".** `forgetMyItems` in `client/src/lib/photoPrep.ts` calls the existing `POST /api/photo/forget`. `ForgetItemsCard` in `client/src/pages/tabs/Extras.tsx`, shown on the Home tab: plain confirm box ("cannot be undone", Keep / Yes, delete), success text with the count, "nothing saved" text, red failure text with retry. Tests: `photoPrep.test.tsx` (3 new), `tabs/__tests__/ForgetItemsCard.test.tsx` (5).
3. **recall_status / recall_ids / recall_checked_at: NOT DONE, stopped on purpose.** The columns exist (`shared/schema.ts:206-208`) but the court has no per-offer recall answer. Its only recall data comes from the family's own purchases (`findRecalledItems`), and writing those recall ids into `offer_checks` would put family-linked data in a table that must have none. Checking an offer's product against CPSC/openFDA is the audit's missing cross-source question and needs new Zetaris SQL, which was off-limits. Left untouched; `none_found` default still applies. Needs Lyndsay's call (new question + replay recording on the Mac).
4. **Saved-grades label.** `shared/agentLoops.ts`: `saved_verdict` now counts only the "saved grade is reused (no AI)" line; the "used N past grade(s)" context line no longer counts. The label "Saved grades reused" is now accurate. Scoreboard and panel share `loopsOf`, so they still agree. `loopsEndToEnd.test.ts` test rewritten: context-only grades count 0 while the AI still runs.
5. **Streamed card whitelist.** `streamRoutes.test.ts` did not cover real orchestrator cards, so added one test: a real SAMPLE_MODE maya run emits into a hub (owner cards do carry a trace id), then the stream route output has only whitelisted keys, link-only sources, and no traceId / SQL / agent-log words.

## Checks
- `SAMPLE_MODE=true npm test` twice: 65 suites passed (1 skipped), 1000 passed / 11 skipped (baseline 984, +16). tsc clean. build OK.
- `SAMPLE_MODE=true npx tsx scripts/eval.ts`: 8/8 traps, 0 false alarms, money back maya 4899, leo 0, ava 1458.
- `db-test-setup.sh` does not exist in this checkout and item 3 was not built, so no local-Postgres offerChecks run.
- Generated files (logs, output_examples, zetaris-cache) restored with git checkout.
- Plaid tile untouched.

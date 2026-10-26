# Job 5: saving live-search finds to the shared list (Oct 25, 2026)

## What was missing
The handoff (`progress/handoffs/2026-10-25-v2-cloud-handoff.md`) said: "Not built: saving live-search finds into `offer_checks`
(only parent audits are saved)". Live search (Tavily, a web-search service) found offers and graded them with the Fine Print
Court, but the grades were thrown away after the screen showed them.

## What it does now
- When live search finds an offer, the full AI court ran (not the rule-only backup), both sides agreed, and no hidden orders
  for the AI were found, the grade is saved to the `offer_checks` table: the same rule parent audits follow (R2 in
  `plans/v2-build-plan.md`). It then counts in `/api/offer-audit` and the Zetaris views (the "shared list").
- **Marked by source.** No database change was needed. The spec only allows `source` = `court` (our own checks) or
  `user_audit` (a parent). Search finds use `source = 'court'` and are told apart by the existing `agent` column, set to
  `live_search` (court scans say `fine_print_court`). Their offer id is `live-<12 characters>`, built from the page address
  and the same as the card's id.
- **No repeats.** If the same page with the same fine print is already saved, nothing new is written. If the page's fine print
  changed, it is saved as a new grade, and the views read only the newest grade for each offer.
- **Blocked offers** (an agreed "reject") are saved too, so they count as "caught", but they are still not shown as new cards.
- **Safe without a database.** In practice mode (`SAMPLE_MODE=true`) the search never runs, so nothing is saved. With no
  `DATABASE_URL`, saves go to the same temporary in-memory copy parent audits use. If a save fails, the parent still gets
  the cards. Search finds never change parent counts or the "instant verdict" that parents get on a repeat audit.

## Files
- `bundle/server/offers/auditStore.ts`: new `saveLiveFind(row)` (answers true when saved, false when already saved), plus
  `LIVE_SEARCH_AGENT`. It refuses rows that are not court-sourced, agreed and free of hidden orders. Both the memory copy and
  the database copy have it (the database copy checks first, then inserts).
- `bundle/server/offers/liveSearch.ts`: optional `store` setting, `liveOfferId(url)`, save step inside `gradeResult`.
- `bundle/server/routes/offerRoutes.ts`: hands the existing audit store to live search.
- `bundle/server/__tests__/liveFinds.test.ts` (new, 9 tests, written first and seen failing before the code).

## Checks
- New tests plus `offerRoutes.test.ts`: 28 of 28 pass.
- `npm run check` (the TypeScript type check): clean, no errors.
- Full `npm test`: 1173 passed, 6 failed, 11 skipped (1190 in total). The 6 failures are not from this job:
  - 5 in `agentLogCoverage.test.ts` ("saved_verdict" count and court outcome lines). They fail the same way with my three files
    put back to their last saved versions. That test replays the Zetaris sample cache (`bundle/data/sample/zetaris-cache/`),
    which another helper is changing right now.
  - 1 in `runEval` ("has 8 traps"). It passes when run alone, and it does not use any file I changed.
- Not tested against the real Neon database. The database copy was tested with a stand-in database.

## Notes for the orchestrator
- While I worked, another helper edited `liveSearch.ts` (added `PERSONAL_PAGE_HOSTS` to skip my.babylist.com). Their change is
  still there. Small thing: their new comment block sits between `storeForUrl`'s old comment and the function, so the old
  comment now sits above `PERSONAL_PAGE_HOSTS` instead.
- `server/__tests__/savedVerdicts.test.ts` shows as changed, but I did not change it.
- Nothing was committed.

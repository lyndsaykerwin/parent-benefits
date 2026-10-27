# Lane E1: practice mode works for every state (Oct 26)

## The problem, in plain English
Practice mode (`SAMPLE_MODE=true`, no keys) doesn't call Zetaris. Instead it replays saved answers, and each saved answer is filed under the exact wording of its question. The Benefits Planner's question named the family's state (`... WHERE scope = 'federal' OR scope = 'TX'`), so a saved answer only existed for states someone had recorded (CA, FL, MA, NY, OH). A Texas family's question had no saved answer, so the planner failed. The screen then said "Some sources didn't respond" and showed $0 of benefits. The Fine Print Lawyer's double-check question named the state in the same way.

## The fix
- **Benefits Planner** (`bundle/server/agents/benefits.ts`): `rulesSql()` is now one fixed question that fetches every rule for every state. The planner keeps federal rules plus the family's own state in code. `screenRule` still blocks other states' rules as a second guard. Also added `ruleCheckSql(code)`: the Fact-Checker's exact question for one rule, so the recording script can save an answer for every rule code.
- **Fine Print Lawyer** (`bundle/server/agents/eligibilityLawyer.ts`): `eligibilityCounterSql()` is now one fixed question, with a `state` column added to its answer. The new `rowsForState()` keeps only the family's state in code.
  - Zetaris quirk found live: `CAST(NULL AS varchar)` inside this UNION (a query that stacks two tables' answers together) fails with a parser error (`LightningDdlParseException ... expecting 'METADATA'`). So the tax rows use the label `'federal' AS state` instead.
- **Recording script** (`bundle/scripts/zetaris/record.ts`) now also records every question a typed-in family can trigger. None of these questions name a family or a state:
  - the all-states rules question
  - the all-states double-check question
  - the Fact-Checker's re-check of every rule code (8) and every offer (16)
  - the saved-grade question for every set of general offers a baby's age can pick (`generalOfferSets`)
- Other per-family questions I checked:
  - Recalls and money-back skip typed-in families, because those families have no purchases.
  - The court's offer list is already one fixed question.
  - The Coach's question is fixed (newest 50).
  - The family profile is only asked for saved families.

## Recordings made (live Zetaris, Oct 26)
- `register` dry run: everything, including `v_audit_by_source`, already exists, so nothing needed applying.
- `npm run zetaris:record`: 37 questions, 0 failures. The saved-answer folder went from 211 to 219 files: 8 new and 30 updated.
- `npm run examples:regen` (replay mode): all 7 examples regenerated. Every one has the same cards and totals as the committed version, and no banner.

## Before and after: typed-in families, no keys (curl `POST /api/run?wait=true` on port 5065)
| State (ZIP) | Before | After |
|---|---|---|
| TX (75201) | banner "Some sources didn't respond", $0 | no banner, $3,200 (Child Tax Credit $2,200 + Trump Account $1,000 + insurance deadline 2026-11-09) |
| IL (60601) | banner, $0 | no banner, $3,200 |
| WA (98101) | not run | no banner, $3,200 |
| GA (30303) | not run | no banner, $3,200 |
| AZ (85004) | not run | no banner, $3,200 |
| MA (02446) | $3,640, MA credit + MA leave | same: $3,640, same cards |
| CA (94110) | not run | no banner, $3,200 + California Paid Family Leave card |

Other ages, also with no keys: a 6-month-old in TX gets $3,200 (the insurance window has closed, as expected), and a due date in IL gets $3,200. Neither shows a banner.

**Report card in practice mode:** fixed. `GET /api/offers/report-card` returns `status: found` with 7 brands (for example Amazon: 4 checked, 3 caught), and `/api/offer-audit` also returns `found`.

**Real mode (live Zetaris, nothing saved):**
- TX: 6 live queries. Federal cards only, all fact-checked "verified", Child Tax Credit "confirmed", and the state is correctly marked as not covered.
- MA: 8 live queries. MA credit and MA leave both verified, and MA leave is confirmed.

## Tests
- New: `bundle/server/__tests__/allStatesReplay.test.ts` (58 tests).
  - Each question is the same text for all 50 states + DC.
  - The planner and the Lawyer filter by state in code.
  - The recording script includes every question.
  - `ruleCheckSql` matches the Fact-Checker's actual question.
  - All 51 states + DC replay from the saved folder with real dollars, nothing marked "not yet verified", and every card checkable offline.
- Updated for the new question wording: `benefits.test.ts`, `eligibilityLawyer.test.ts`, `savedVerdicts.test.ts`.
- `npm run test:v2`: 22/22 pass.
- `npm test`, before the photo lane's mid-edit: 1332 pass. The 11 failures were all in court and offer tests (`finePrintCourt`, `loopsEndToEnd` loop 5, `offerRoutes`) from other lanes' in-progress fee and court changes. None were in my files.
- `npm test`, latest run: 1251 pass and 12 fail. 7 more suites now fail to compile because of `server/ingest/photo.ts` (another lane, mid-edit).
- `npm run check`: fails only on `server/ingest/photo.ts` (lines 389 and 514), which belongs to another lane.

## Blockers and follow-ups for other owners
1. **`server/routes/bundleRoutes.ts` `parentResult()` drops `stateNote`.** The "Support for your state's programs is coming soon" note is worked out (it's in the trace for TX) but never reaches the screen. One-line fix: add `...(r.stateNote ? { stateNote: r.stateNote } : {})`.
2. `server/agents/factChecker.ts` could call `ruleCheckSql(code)` instead of its inline copy of the same text. A test already guards against the two drifting apart.
3. `savedVerdicts.ts` and `newsroom.ts` (offers lane): the saved-grade question still depends on which offers a family's age picks. The recording now covers every set a typed-in family can get. Making it one fixed question (fetch all, filter in code) would remove the dependency entirely.
4. `server/ingest/photo.ts` type errors break `npm run check` and 7 test suites (photo lane).

Nothing is committed. My server on port 5065 is stopped.

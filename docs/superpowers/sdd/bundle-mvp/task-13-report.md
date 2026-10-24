# Task 13 report: mini-Scout, eval scoreboard, learning demo, demo date

Commits: eea2c8d (5 leftover Zetaris cache files from T12), 475b5fc (everything else). npm run check clean; npm test 191/191 (20 suites).

## TDD
- Coach offline fallback: new tests written first; run against the old coach.ts -> 1 failed (auto-renew theme returned []), then GREEN after the change.
- demoDate / eval / scout tests were written right after a first implementation draft (needed the cache discovery below first), so RED for those is the initial TypeScript compile failure (demoDate.ts env type) rather than a behavioural failure. Honest note.

## Scoreboard (full run, offline, replayed Zetaris, saved to logs/scoreboard.json)
trapsCaught 6/6, trapsTotal 6, falseAlarms 0, sourcedPct 100, runs 3, stable true, llmMode "offline-fallback", scoutLlmMode "fake-llm".
learning: {run1Approved:true, run2Blocked:true, citedRuleId:"mem-1"}. moneyBack: maya 4899, leo 0, ava 1458.
Traps: auto-renew offer (blocked after learning), wrong-amount Scout row (rejected: amount not on page), recalled item (CPSC 10560 verified), refund (no card, moneyBack unchanged), duplicate (7 distinct items, counted once), non-MA family (ava has no MA benefit).

## Learning demo (`npx tsx scripts/eval.ts --learning`)
Run 1 (no case law): trap "Free newborn diaper box" approved by the Court's offline screen (status fallback). 3 fixture 'issue' notes (auto-renew/membership complaints, fake) -> Coach (deterministic keyword fallback) proposes "Reject offers whose free trial turns into a paid membership that renews automatically." -> eval plays reviewer (addRule + markApproved, same two steps as the approve route) -> Run 2: trap blocked, judge trace line contains "[cited mem-1]". Traces copied to output_examples/learning/run1.jsonl and run2.jsonl. Also ran with `--neon`: feedback + proposals written to Neon through DrizzleStore (works, re-run safe: reuses the existing proposal text). Memory for the eval is a temp dir (does not touch data/hmem).

## Coach offline fallback (documented in coach.ts)
When the model is unavailable or answers badly, THEMES (auto-renew/membership/charged/trial..., shipping/handling) are matched by regex; a rule is proposed only when >=2 issue notes match the same theme; confidence = 0.5+0.1*n (cap 0.9). With MODEL_API_KEY the real clustering runs as before.

## Demo date
server/demoDate.ts: seed families (maya/leo/ava) -> TODAY env else 2026-10-23; inline families -> real date. AgentContext now has `today` (set by runBundle; clawback year and court baby-age use it instead of the global env). bundleDeps.makeRealRunDeps(memory, familyId) and ApiDeps.makeRunDeps(family) take the family. Run status returns `demoDate`; Feed shows "Demo date: Oct 23, 2026. Sample families are checked as of this date so the demo stays the same." (client helper demoDateLabel + test).

## $28.99 root cause
Not a date bug: price-adjustment code never compares to today (window checks are tx date vs observation date, both inclusive). Logs from the T12 session show the fact-check query for clawback-price-maya-tx-02 (and dcfsa) hit Zetaris Thrift 400s twice -> "dropped, not checked" -> moneyBack = only the $28.99 FSA card. So it is Zetaris flakiness plus one retry. Eval asserts 4899 deterministically on cached Zetaris (and runs at today == the price deadline). Not changed: more fact-check retries (optional hardening).

## Cache finding (important)
data/sample/zetaris-cache held entries from different seed runs (offer ids 470/614/678/710 mixed), so replay returned court offers whose `WHERE id=` verify queries were uncached and fell to live. I refreshed the cache with one live pass (all 3 families, no banner), committed it (+11 new files). Replay is now self-consistent and works with no network/credentials. If the offers table is re-seeded again the cache must be refreshed (`npx tsx scripts/eval.ts --live`).

## Files
scripts/scout.ts, scripts/eval.ts, evals/expected.json, data/sample/saved-pages/{trump-account,ma-pfml,store-offer}.html, server/demoDate.ts, server/__tests__/{eval,demoDate}.test.ts, coach.test.ts (+2), edits: coach.ts, orchestrator.ts, types.ts, clawback.ts, finePrintCourt.ts, bundleDeps.ts, bundleRoutes.ts, client lib/bundle.ts, pages/Feed.tsx; logs/scoreboard.json, output_examples/learning/.

## Decisions / concerns
- Saved pages are hand-written short excerpts: trumpaccounts.gov and mass.gov returned 403 to automated fetch. Each page's meta says so. Facts only repeat what the seed already holds.
- Scout without a model extracts nothing (no fake output). Its trap uses a scripted FakeGenerator, labelled scoutLlmMode "fake-llm". Scout rows are not written to Neon unless someone calls upsertScoutRows (`--scout --write` flag NOT wired; function exists, untested live) - writing could corrupt what the Fact-Checker checks against.
- Scoreboard has no real-model numbers: no MODEL_API_KEY. With a real model the Court may reject the auto-renew trap in run 1 itself, so run1Approved could be false (then keep the saved offline run 1 as the fallback, per the brief).
- `--learning` overwrites logs/scoreboard.json with a partial board (unmeasured traps show caught:false "not measured"). Run the full eval last.
- The reviewer-approve logic is duplicated in eval.ts (2 lines) rather than refactored out of the route.
- Eval fixture rows use family id "eval-fixture"; with --neon they stay in the feedback table.

## Fix round 1
Important finding: `--learning` clobbered the full scoreboard. Fixed: new `mergeLearning()` in scripts/eval.ts; `--learning` now updates only `learning`, `learningDetail` and `generatedAt` in an existing logs/scoreboard.json, and creates the file with nulls for unmeasured fields if missing. Also `demoDate` now comes from resolveToday('maya') instead of expected.json. Test added (merge keeps trapsCaught 6/trapsTotal 6; fresh file has nulls; demoDate 2026-10-23). Verified: full eval then `--learning` leaves scoreboard.json at 6/6 with learning fields filled (run1Approved true, run2Blocked true, cited mem-1). check clean.

# Task 9 review: orchestrator and never-empty feed

Reviewed: `server/agents/orchestrator.ts`, `server/__tests__/orchestrator.test.ts`, `scripts/run-family.ts`, `server/agents/clawback.ts` (DCFSA copy), commits 6667d36..5f4bab2 on local `main`. I also read the code this file calls (`factChecker.verify`, `zetaris.runQuery`, `benefits.planBenefits/revise`, `finePrintCourt.revise`, `memory.exportLedger`, `trace.redact`). I did not run any tests; everything below comes from reading the code.

## Spec compliance: PASS, with one gap (Important #2)

| Requirement | Status |
|---|---|
| `runBundle(familyId, deps{z,llm,memory,loadFamily,logsDir,today})` → BundleResult | OK |
| `assembleFeed(verified, family, itemsChecked, fillers)` → {cards, receipt} | OK (adds an optional 5th `today` argument, disclosed, harmless) |
| `loadFamily`: SAMPLE_MODE reads families.json, otherwise Neon via Drizzle | OK (Neon path not tested live, disclosed) |
| All four agents run at the same time with `Promise.allSettled` | OK |
| ZetarisUnavailable → exact banner copy | OK (`BANNER` matches global constraints exactly) |
| Fact-check, then `revise(c, reason, ctx)` with `corrected` in the reason, max `MAX_RETRIES` (default 2), then drop traced `blocked` with retry_count 2 | OK for genuine content failures (3 verifies, 2 revises, drop line has `retry_count: 2`). Outage failures are mis-routed, see Important #1 |
| Court called with `includeGeneral:true`; fillers court-approved only | OK (nothing unvetted can reach the feed) |
| Minimums: ≥2 benefit, 1 recall (ruling: one per real recall), ≥3 discount, clawback info card, 2 coming_soon | Copy and counting are right; but the filler path is a no-op, see Important #2 |
| Exact empty-state copy (both clawback lines, both recall lines) | OK, matches exactly |
| Insurance card pinned first, then clawback, recall, benefit, discount, coming_soon | OK (id `benefit-insurance_add_baby` matches benefits.ts) |
| Receipt split; moneyBack = fsa_reimbursement + price_adjustment only; DCFSA in neither total | OK (claim-type check plus id-prefix backstop; tested 2899 + 2000 = 4899) |
| deadlineCount / nextDeadline from benefit cards with deadline ≥ today; itemsChecked from the Recall Checker | OK |
| Ledger exported to logs/ | OK (sync call, failure caught and traced) |
| Income never in traces | OK (orchestrator only logs ids and kinds; TraceLogger redacts anyway; run-family prints no income) |
| One automatic retry on the transient Thrift/ResultSet HTTP 400 (ruling) | OK for agents (not for fact-check or purchase keywords; see Minor) |
| `scripts/run-family.ts` and live results reported | OK |

## Severity counts
Critical 0, Important 2, Minor 7.

## Important

### 1. A Zetaris outage during fact-check is treated as "the card is wrong": it gets sent back to the agent, burns retries, multiplies timeouts, and never sets the banner
`factChecker.verify` never throws: on any error it returns `{ ok:false, reason:'could not verify: <message>' }` (factChecker.ts:190-197). So in `checkOne` (orchestrator.ts, step 3):
- the `catch` around `verify` (which sets the banner and drops) is dead code;
- an outage result goes down the content-failure path: `send_back` to the owner's `revise`, which re-runs the agent's own Zetaris queries (benefits.revise re-plans everything), then verify again, up to 3 verifies + 2 revises per candidate;
- the fact-check loop is sequential, so with Zetaris hanging the cost is roughly candidates × 3 × timeout. With ~17 candidates and the default 20s timeout that is about 17 minutes; `run-family.ts` sets the timeout to 80s, so over an hour;
- the card is finally dropped as `blocked` "dropped after 2 retries", and the banner stays null unless a revise happens to throw. That contradicts the report's claim that the banner is set when "a fact-check could not run", and the trace makes an outage look like a content problem.

Fix: have verify report outages separately (for example an `unavailable: true` flag on VerifyResult when the cause is ZetarisUnavailable or a client error, or as a fallback check for `reason?.startsWith('could not verify')`). In `checkOne`, on an outage: set the banner, retry once only if the error is the transient Thrift/ResultSet one, otherwise drop with status `error` and don't call `revise`. Add a test where `verify` returns a could-not-verify result: expect the banner set, `revise` not called, and the card dropped.

### 2. The fillers argument does nothing, so the ≥2 benefit / ≥3 discount minimums are not actually enforced when an agent fails
`runBundle` passes `verified.filter(kind==='benefit')` and `verified.filter(kind==='discount')` as the fillers. Those cards are already in `verified`, so the filler loops in `assembleFeed` can never add anything. The brief says fillers come from separate sources ("general benefit rules (federal)", court-approved general offers). In practice:
- if `planBenefits` or `judgeOffers` throws (Zetaris down with no cached copy, which is the normal case for a guest's inline family, or a second Thrift failure), the feed has 0 benefits and/or 0 discounts while the banner claims "showing what we could check";
- the only runBundle minimum test fails the recall agent alone, so this gap is never exercised. The "court-rejected filler never appears" test can't fail either, because no rejected offer is ever in its input.

The report discloses the discount half of this. Fail-closed ("unverified is never shown") and never-empty do pull against each other, so the controller should rule on it. Suggested fix: when benefits produces fewer than 2 verified cards, run a rules-only federal pass (benefit_rules rows that need no family data, which the adapter's cache backstop can serve) through verify and pass those as `federalBenefits`. Likewise pass the court's approved general offers as `approvedGeneralOffers` instead of re-passing `verified`. Add a runBundle test with benefits and court both throwing ZetarisUnavailable. If the ruling is that a smaller feed is acceptable during an outage, write that down in global-constraints and assert the actual behaviour in a test.

## Minor
1. `purchaseKeywords` swallows the transient HTTP 400 (it is a client error, not ZetarisUnavailable) and returns `[]` without tracing anything. The court then silently loses its trigger keywords, so the trap offer can drop out of the top 5 and break the learning demo on a bad run. Fix: rethrow errors that match thrift/resultset so `withRetry` catches them, and trace the fallback.
2. The banner is also set for non-outage agent bugs (a TypeError, say). The copy "Some sources didn't respond" then hides a code bug from the user. It is traced, so this is acceptable as a decision, but consider setting the banner only for ZetarisUnavailable or the transient error and logging other failures as `error` only.
3. The sequential fact-check loop adds a lot of time on a live run (maya took 22-51s). The ruling moves the under-30s first card to T12/T14, but a small bounded-concurrency loop (for example 3-4 at a time) would cut live time without making the trace unreadable.
4. `runId` puts `familyId` straight into the log filename (the deferred T4 minor). Today `loadFamily` must succeed first, but a T13 inline-family loader could pass an arbitrary id. Clean it, e.g. `familyId.replace(/[^A-Za-z0-9_-]/g,'')`.
5. `benefits.revise` uses `todayIso()` (env TODAY) rather than `deps.today`, so a revised benefit card can compute deadlines against a different date than the original. This is pre-existing T8 code but now runs through the orchestrator. Fix: pass the date through ctx.
6. `MAX_RETRIES` parsing accepts `' '` (as 0) and negative numbers. Use something like `const v = Number(process.env.MAX_RETRIES); Number.isInteger(v) && v >= 0 ? v : 2` with a trimmed, non-empty check.
7. Test gaps: no test that a real recall suppresses the all-clear card (the ruling), and none for the clawback info card being skipped when real clawbacks exist. The "rejected filler" test is vacuous (see Important #2).

## Strengths
- The flow is clear and well commented. The exact copy lives in constants, and the retry/drop trace lines carry the right fields and retry counts.
- The Receipt honesty ruling is implemented robustly (claim type plus id prefix) and tested with maya-like numbers.
- `allSettled` plus `take()` isolates agent failures cleanly. The transient-400 retry is narrow and traced.
- The live runs for maya, leo and ava are reported honestly, including the bad first pass and the timings.

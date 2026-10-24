# Task 9 report: orchestrator and never-empty feed

Commits: 6667d36 (feat) and b13cdd7 (refreshed Zetaris replay cache). Local main, not pushed.
Tests: npm run check clean; npm test 12 suites / 123 tests pass (11 new in server/__tests__/orchestrator.test.ts).

## TDD
RED: first run of orchestrator.test.ts failed (module server/agents/orchestrator did not exist). GREEN after implementing; one test expectation I had miscomputed was corrected (fillers are not added when 5 benefits are already verified).
Tests cover: empty-state copy (leo), data-connected no clawback copy, "We checked 23 items: all clear.", ordering with insurance pinned first, split receipt math, no duplicate fillers, ZetarisUnavailable on recalls -> banner + minimums, ledger export, court-only discounts and includeGeneral:true, fail 3x -> dropped after 2 retries with trace status blocked retry_count 2 (and the reason incl. corrected values reaches revise), fixed-by-revise kept, one retry on transient Thrift error.
Agents are stubbed with jest.mock (module-level), so runBundle's signature stayed exactly as in the brief.

## Live results (real Zetaris, no model key so LLM paths used fallbacks; TODAY=2026-10-23)
| family | cards by kind | receipt | banner | elapsed |
|---|---|---|---|---|
| maya | clawback 3, recall 1, benefit 6, discount 5, coming_soon 2 (17) | moneyBack 559899c, likelyBenefits 364000c, deadlines 3, next 2026-11-02, itemsChecked 7 | none | 51.6s (22.0s on a warm run) |
| leo | clawback 1 (info), recall 1 (no-purchases copy), benefit 5, discount 5, coming_soon 2 (14) | moneyBack 0, likelyBenefits 364000c, deadlines 2, next 2027-01-06, itemsChecked 0 | none | 6.6s |
| ava | clawback 1, recall 1 (all clear, 4 items), benefit 2, discount 5, coming_soon 2 (11) | moneyBack 1458c, likelyBenefits 320000c, deadlines 0, next null, itemsChecked 4 | none | 9.2s (51.0s cold) |
Minimums hold for all three (benefit>=2, recall 1, discount>=3, clawback card present, coming_soon 2). Insurance card pinned first for maya and leo; ava has none (her 30-day window closed 2026-09-23). Maya's real recall: KEAWIS Crib Mattress (CPSC 10560).
First live pass (before the retry fix) hit transient Zetaris failures: maya all four queries failed at once ("HTTP 400 Could not create ResultSet" / Thrift TTransportException), leo's clawback failed once. The feed still met minimums and showed the banner (the never-empty design worked), but cards were thin. Re-runs were clean. leo's first run took 128s.

## Files
server/agents/orchestrator.ts (runBundle, assembleFeed, defaultLoadFamily, BANNER, COPY); server/__tests__/orchestrator.test.ts; scripts/run-family.ts (prints kinds, receipt, banner, elapsed, card list; no income). The second commit adds refreshed/new files in data/sample/zetaris-cache (replay material for SAMPLE_MODE).

## Decisions (owner unavailable)
- assembleFeed gets an optional 5th arg `today` (default current date) for deadline counting; signature otherwise as briefed.
- Fillers: runBundle passes already-verified benefit and court-approved discount cards as the fillers, so nothing unvetted can appear; court output also goes through fact-check (offer claims). assembleFeed dedupes by card id.
- "Exactly 1 recall card": all real recalls are kept (never hide a safety recall); the all-clear / no-purchases card is added only when there are none. Same for real clawbacks.
- Banner is set for ZetarisUnavailable and, additionally, for any agent failure or a fact-check that could not run (unverified cards are dropped, never shown).
- Retry of a Zetaris Thrift/ResultSet hiccup once after 1.5s (live evidence above); adapter not changed.
- Court purchase keywords come from the recall item list (itemsSql): full item texts plus words. Age uses deps.today (not env TODAY).
- Fact-check loop runs sequentially (readable trace, gentler on Zetaris); attempt count is bounded by MAX_RETRIES (default 2). Drop line: agent orchestrator, action drop, status blocked, retry_count = retries used.
- Feed order: insurance pinned, then clawback, recall, benefit, discount, coming_soon.
- runId = familyId + timestamp + random; trace to logsDir/run-<id>.jsonl; ledger to logsDir/ledger-<id>.jsonl.
- defaultLoadFamily: SAMPLE_MODE=true reads data/sample/families.json; else Neon via Drizzle (lazy import so no DATABASE_URL is needed in sample mode). The Neon path is untested live (no DATABASE_URL used in this run).
- run-family.ts forces SAMPLE_MODE=true only for loading the family; Zetaris is live.

## Concerns
- Zetaris transient 400s (Thrift/ResultSet) appear under load; maya took 51s on two runs (first card well over 30s target) and leo once 128s. Spec asks for first card under 30s via streaming: not addressed here (runBundle returns all at once); Task 12/14 should stream or use SAMPLE_MODE replay for the demo.
- Fewer than 3 discounts is possible if the court rejects offers: fillers cannot pad with unvetted offers (documented).
- ava deadlineCount 0 is correct (windows closed), not a bug.
- No interface mismatches with other agents.

## Addendum: Receipt honesty ruling
moneyBackCents now counts only fsa_reimbursement and price_adjustment clawbacks. The dcfsa_childcare card stays kind clawback / verdict likely, keeps its capped amountCents for display, and its body (clawback.ts, fallback and model facts) says up to $X of daycare can be paid with pre-tax dollars through the family's dependent-care FSA, "eligible spend, not money back". It is excluded from both moneyBackCents and likelyBenefitsCents (assembleFeed). New test asserts 2899 + 2000 = 4899 with the DCFSA card present. Live maya re-run: moneyBackCents 4899, likelyBenefitsCents 364000, no banner, 13.1s. npm run check clean; 124 tests pass.

## Fix round 1
- I-1: factChecker.verify now returns `unavailable: true` when the check could not run (one added assertion in factChecker.test). Orchestrator: outage sets the banner, never calls revise, drops the card with trace status `error` (one verify call per card); a transient Thrift/ResultSet error gets one retry first.
- I-2: new server/agents/fallback.ts + data/sample/fallback-rules.json and fallback-offers.json (generated from the seed by scripts/gen-fallback.ts; source URLs kept; trigger offers incl. the trap excluded). Benefit fillers reuse a new pure `screenRule` exported from benefits.ts (planBenefits now uses it too). Fillers are verdict `info`, body ends "Not yet verified: some sources didn't respond.", never counted in the Receipt, never repeat a rule/offer already shown, only used when <2 benefits / <3 discounts.
- Minors: fact-checks run 4 at a time (order kept); purchaseKeywords retries the transient error; benefits.revise takes a `today` arg (orchestrator passes deps.today); runId sanitised to [A-Za-z0-9_-]; MAX_RETRIES must be a non-negative integer else 2.
- Tests: 4 new orchestrator tests (outage, benefits+court both failing with minimums/info/excluded totals, transient fact-check retry, MAX_RETRIES/filename). Orchestrator, factChecker, benefits files pass; npm run check clean; full npm test 128/128.
- Live maya: first re-run hit Zetaris Thrift 400s on all queries (even after the retry): feed still 9 cards with minimums met, banner shown, fallbacks used (18s). Second run clean: 17 cards, moneyBack 4899, likelyBenefits 364000, no banner, but 170.8s (Zetaris slow). Zetaris instability under load is the main live risk; the demo should use SAMPLE_MODE replay.

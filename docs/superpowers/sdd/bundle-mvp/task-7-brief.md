### Task 7: Fine Print Court (discounts)

**Files:** Create `server/agents/finePrintCourt.ts`. Test `server/__tests__/finePrintCourt.test.ts`.

**Interfaces:**
- Produces: `judgeOffers(ctx, input: { ageDays: number; purchaseKeywords: string[]; includeGeneral: boolean }): Promise<Candidate[]>`. The orchestrator computes `ageDays` (negative if unborn) and `purchaseKeywords` from the clawback/recall views. With `includeGeneral`, offers with `triggerKeyword=''` are judged too, so feed fillers have always passed the court.
  - It selects offers matched by baby age (`minAgeDays ≤ ageDays ≤ maxAgeDays`) and purchase `triggerKeyword` from `bundle_pg.v_judge_offers`.
  - For each offer: Deal Hunter argues for (fast model), Fine Print Lawyer argues against (fast model), Judge rules (reasoning model). The Judge's prompt includes `memory.recallRules(offer.finePrint)` as cited case law.
  - The ruling is a `CourtRuling`. If the LLM fails, the ruling is `{verdict:'reject', citedRuleIds:[], reason:'court unavailable'}`. Rejected offers are traced with `status:'blocked'` and excluded.

- [ ] Step 1: Write the tests (FakeGenerator scripted):
  - an offer whose `finePrint` contains `$40 shipping subscription` is rejected when the Judge responds `{"verdict":"reject",...}`
  - with memory holding the rule `free + >$5 shipping is not free`, the Judge prompt (captured by the fake) contains that rule text
  - each offer produces exactly 3 LLM calls and 3 trace lines (`deal_hunter`, `fine_print_lawyer`, `judge`)
- [ ] Step 2: Run. Expected: FAIL. Step 3: implement. Step 4: run. Expected: PASS. Step 5: commit `feat: fine print court`.


---
**Binding context (read too):** overrides.md, global-constraints.md, and the "Rulings" section of progress.md, all in this folder. Where they conflict with the text above, they win. Key rulings: guest only (no Firebase; "Reviewer mode" token instead of admin); the Receipt is split into `moneyBackCents` + `likelyBenefitsCents`; the court caps at 5 offers; reuse the existing Zetaris objects `bundle_pg` and `bundle_live.cpsc_recalls`; never drop the Neon table `spike0_amazon_orders`. Repo: /Users/lyndsay/Documents/hackathon/bundle (local `main`, never push).

**Controller specifics:** judge at most **5** offers per call (rank by relevance: trigger matches first, then general). `includeGeneral` adds offers with `trigger_keyword=''`. The ruling type is `CourtRuling` (types.ts). If the LLM fails, the ruling is `reject` with reason `court unavailable`. The Judge prompt must quote the recalled case-law rules with their ids and confidence. Export `revise` too (it re-judges with the reason added). The trap offer (auto-renewing paid membership after a 30-day "free" trial) is the learning-demo case: the Lawyer may raise it, and only memory-held case law should make the Judge consistently reject it. Don't hard-code a rejection for it.
- **Fact-Checker contract (from Task 5):** read server/agents/factChecker.ts. Every Candidate must set `claim.type` and the keys verify() reads (rule: `ref`; offer: `offerId`; recall: `recallId`; clawback: `txId` + `txAmountCents`). If a clawback subtype (price_adjustment, dcfsa_childcare) can't be verified by the current verify(), extend verify() in factChecker.ts with tests in the same task.

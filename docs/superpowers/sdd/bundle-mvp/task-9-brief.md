### Task 9: Orchestrator and never-empty feed

**Files:** Create `server/agents/orchestrator.ts`. Test `server/__tests__/orchestrator.test.ts`.

**Interfaces:**
- Consumes: Tasks 4–8
- Produces:
  - `runBundle(familyId: string, deps: { z: ZetarisClient; llm: Generator; memory: BundleMemory; loadFamily: (id: string) => Promise<Family>; logsDir: string; today: string }): Promise<BundleResult>`
  - `assembleFeed(verified: Candidate[], family: Family, itemsChecked: number, fillers: { approvedGeneralOffers: Candidate[]; federalBenefits: Candidate[] }): { cards: FeedCard[]; receipt: BundleReceipt }`
  - `loadFamily` reads Neon via Drizzle; in SAMPLE_MODE it reads `data/sample/families.json`
- Flow:
  1. Load the family.
  2. Run clawback, recall, court and benefits concurrently. Each is wrapped so `ZetarisUnavailable` sets `banner = "Some sources didn't respond: showing what we could check."`
  3. Fact-check each candidate. On failure, call the owning agent's `revise(c, reason, ctx)` (if `corrected` is present it is passed in the reason) and re-verify. Each attempt is a retry. Max `MAX_RETRIES`.
  4. `assembleFeed`.
  5. Export the H-MEM ledger to `logs/`.
- `assembleFeed` enforces the Global Constraints minimums, filling from:
  - general benefit rules (federal)
  - court-approved general offers (`fillers.approvedGeneralOffers`; never unvetted)
  - the clawback info copy
  - the recall all-clear / no-purchases copy
  - two fixed coming-soon tiles: `Pre-filled applications` and `We'll watch for price drops`
- The receipt sums `amountCents` of `clawback` and `benefit` cards with verdict `verified|likely`.

- [ ] Step 1: Write the tests:
  - `assembleFeed([], leoFamily, 0, fillers)` gives ≥2 benefit, 1 recall with body `Connect your data to safety-check your items.`, ≥3 discount, 1 clawback with body `No money to claw back yet. Connect a card or upload Amazon orders.`, 2 coming_soon
  - a family with `dataConnected:true` and no clawbacks gets `Nothing to claw back: you're doing great.`
  - all-clear with `itemsChecked:23` gives `We checked 23 items: all clear.`
  - `runBundle` with a stub Zetaris that throws `ZetarisUnavailable` for recalls still returns a result with `banner` set and the minimums met
  - a filler offer the court rejected never appears in the feed
  - a candidate failing fact-check 3 times is dropped after 2 retries, with a trace line `status:'blocked'`, `retry_count:2`
- [ ] Step 2: Run. Expected: FAIL. Step 3: implement. Step 4: run. Expected: PASS. Step 5: commit `feat: orchestrator with fact-check loop and never-empty feed`.


---
**Binding context (read too):** overrides.md, global-constraints.md, and the "Rulings" section of progress.md, all in this folder. Where they conflict with the text above, they win. Key rulings: guest only (no Firebase; "Reviewer mode" token instead of admin); the Receipt is split into `moneyBackCents` + `likelyBenefitsCents`; the court caps at 5 offers; reuse the existing Zetaris objects `bundle_pg` and `bundle_live.cpsc_recalls`; never drop the Neon table `spike0_amazon_orders`. Repo: /Users/lyndsay/Documents/hackathon/bundle (local `main`, never push).

**Controller specifics:**
- The Receipt is split: `moneyBackCents` = sum of verified/likely `clawback` amounts; `likelyBenefitsCents` = sum of verified/likely `benefit` amounts; `deadlineCount` and `nextDeadline` come from benefit cards with deadlines ≥ today; `itemsChecked` comes from the Recall Checker.
- Feed order: the `INSURANCE_ADD_BABY` card (if present) is **pinned first**, then clawback, recall, benefit, discount, coming_soon.
- Call `judgeOffers(ctx, {ageDays, purchaseKeywords, includeGeneral:true})`. Fillers may only use court-approved offers. Court cap: 5.
- `today` = `deps.today` (the caller passes the `TODAY` env or the current ISO date).
- Run the agents concurrently (`Promise.allSettled`); `ZetarisUnavailable` sets the banner (exact copy in global constraints).
- The H-MEM ledger is exported to `logs/` at the end of a run.
- Also write a tiny script, `scripts/run-family.ts <familyId>`, that runs `runBundle` live and prints a summary (card kinds and counts, the Receipt, elapsed time) without printing income. Run it for maya, leo and ava, and report the results and timings. If `MODEL_API_KEY` is empty, the LLM falls back; that's expected.

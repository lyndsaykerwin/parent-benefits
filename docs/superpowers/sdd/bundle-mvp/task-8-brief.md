### Task 8: Benefits Planner

**Files:** Create `server/agents/benefits.ts`. Test `server/__tests__/benefits.test.ts`.

**Interfaces:**
- Produces: `planBenefits(ctx, today: string): Promise<Candidate[]>`.
  - It reads `bundle_pg.benefit_rules` and `bundle_pg.v_planner_family`.
  - It computes `deadline = anchor + windowEndDaysFromBirth`, where `anchor` is `birthDate`, or `dueDate` for unborn babies (titles suffixed ` (after birth)`).
  - It excludes rules whose deadline is before `today` and `MA` rules when `state !== 'MA'`.
  - `WIC_SCREEN` applies only when `annualIncomeCents ≤ 185% FPL` for `householdSize`, using 2026 HHS guidelines (stored as a rule row, not hard-coded).

- [ ] Step 1: Write the tests (`today = '2026-10-23'`):
  - maya (born 2026-10-03) gets `INSURANCE_ADD_BABY` with deadline `2026-11-02`, `TRUMP_ACCOUNT` at `100000` cents, and `MA_CHILD_TAX_CREDIT` at `44000`
  - ava (OH) has no MA cards
  - leo (due 2026-12-07) gets `INSURANCE_ADD_BABY` with deadline `2027-01-06`, and its title contains `(after birth)`
  - a family born 2026-06-01 has no `INSURANCE_ADD_BABY`
  - ava (OH, born 60 days ago) still gets ≥2 benefit candidates (`TRUMP_ACCOUNT`, `FEDERAL_CHILD_TAX_CREDIT`)
- [ ] Step 2: Run. Expected: FAIL. Step 3: implement. Step 4: run. Expected: PASS. Step 5: commit `feat: benefits planner`.


---
**Binding context (read too):** overrides.md, global-constraints.md, and the "Rulings" section of progress.md, all in this folder. Where they conflict with the text above, they win. Key rulings: guest only (no Firebase; "Reviewer mode" token instead of admin); the Receipt is split into `moneyBackCents` + `likelyBenefitsCents`; the court caps at 5 offers; reuse the existing Zetaris objects `bundle_pg` and `bundle_live.cpsc_recalls`; never drop the Neon table `spike0_amazon_orders`. Repo: /Users/lyndsay/Documents/hackathon/bundle (local `main`, never push).

**Controller specifics:** `today` comes from the caller (the orchestrator passes the `TODAY` env or the real date). `WIC_SCREEN` uses the `poverty_guidelines` table (2026, household size), with threshold 185%. Skip it when income is null. `FEDERAL_CHILD_TAX_CREDIT` has no window (deadline null), so it always qualifies. `TRUMP_ACCOUNT` qualifies when the birth or due date falls in 2025-01-01..2028-12-31. Export `revise`. All amounts come from the rules table, never the LLM; the LLM only writes `body` text, via `askJson` with a deterministic fallback.
- **Fact-Checker contract (from Task 5):** read server/agents/factChecker.ts. Every Candidate must set `claim.type` and the keys verify() reads (rule: `ref`; offer: `offerId`; recall: `recallId`; clawback: `txId` + `txAmountCents`). If a clawback subtype (price_adjustment, dcfsa_childcare) can't be verified by the current verify(), extend verify() in factChecker.ts with tests in the same task.

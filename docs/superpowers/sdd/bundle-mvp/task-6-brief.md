### Task 6: Clawback Hunter and Recall Checker

**Files:** Create `server/agents/clawback.ts`, `server/agents/recall.ts`. Test `server/__tests__/clawback.test.ts`, `recall.test.ts`.

**Interfaces:**
- Produces:
  - Every candidate-producing agent (Tasks 6–8) also exports `revise(c: Candidate, reason: string, ctx): Promise<Candidate | null>`. It re-derives the candidate from source data with the reason in scope; `null` means give up.
  - `findClawbacks(ctx): Promise<Candidate[]>`, with three kinds in `claim.type`: `'fsa_reimbursement' | 'price_adjustment' | 'dcfsa_childcare'`
  - `checkRecalls(ctx): Promise<{ candidates: Candidate[]; itemsChecked: number }>`
  - Both build SQL against `bundle_pg.v_clawback_tx`, `bundle_pg.v_recall_orders`, `bundle_pg.fsa_eligible_categories`, `bundle_pg.store_policies`, `bundle_pg.price_observations`, `bundle_pg.amazon_orders`, `bundle_live.cpsc_recalls`, `bundle_live.fda_food_recalls`
  - The LLM writes only `body` (an explanation, via `askJson`, with deterministic fallback text)

- [ ] Step 1: Write the tests (stub Zetaris rows modelled on the fixtures):
  - maya gets an `fsa_reimbursement` of `2899` and a `dcfsa_childcare` candidate
  - the refund and the duplicate do not produce candidates
  - a family with no transactions gets `[]`
  - `checkRecalls` for maya returns 1 recall candidate and `itemsChecked` equal to her Amazon row count
  - for leo it returns `{candidates:[], itemsChecked:0}`
- [ ] Step 2: Run. Expected: FAIL. Step 3: implement (dedupe on `merchant+date+amountCents`; skip `amountCents <= 0`; title match via `lower(title) LIKE '%' || lower(product_name) || '%'` against CPSC). Step 4: run. Expected: PASS. Step 5: commit `feat: clawback hunter and recall checker`.


---
**Binding context (read too):** overrides.md, global-constraints.md, and the "Rulings" section of progress.md, all in this folder. Where they conflict with the text above, they win. Key rulings: guest only (no Firebase; "Reviewer mode" token instead of admin); the Receipt is split into `moneyBackCents` + `likelyBenefitsCents`; the court caps at 5 offers; reuse the existing Zetaris objects `bundle_pg` and `bundle_live.cpsc_recalls`; never drop the Neon table `spike0_amazon_orders`. Repo: /Users/lyndsay/Documents/hackathon/bundle (local `main`, never push).

**Controller specifics:**
- Also export `revise(c, reason, ctx): Promise<Candidate | null>` from both clawback.ts and recall.ts.
- Recall matching must not be plain `LIKE` only. Use SQL to pull candidate pairs where a brand token or ≥2 significant title tokens match `p.Name` (CPSC via `LATERAL VIEW explode(Products) AS p` inside a subquery; openFDA via `LATERAL VIEW explode(results)` inside a subquery, normalising its numeric dates), then confirm each pair with a cheap LLM yes/no through `askJson`. If the LLM is unavailable, the fallback accepts only exact product-name containment. The KEAWIS fixture must match; ordinary items must not.
- `itemsChecked` = the number of distinct purchase items examined for the family.
- Clawback: FSA reimbursement = a purchase paid on a regular card whose title/merchant matches `fsa_eligible_categories.keyword`. Price adjustment = a purchase at a store with `store_policies.adjustment_window_days` where a `price_observations` row for the same keyword is lower and observed within the window after purchase; amount = the difference. DCFSA childcare = daycare payments, only when `dcfsa_offered`; amount = the sum of payments in the plan year, capped at 750000 cents, card verdict `likely`.
- Run each new query live once against Zetaris for maya/ava/leo, so results land in `data/sample/zetaris-cache/` (SAMPLE_MODE needs them). Keep tests on stubs.
- **Fact-Checker contract (from Task 5):** read server/agents/factChecker.ts. Every Candidate must set `claim.type` and the keys verify() reads (rule: `ref`; offer: `offerId`; recall: `recallId`; clawback: `txId` + `txAmountCents`). If a clawback subtype (price_adjustment, dcfsa_childcare) can't be verified by the current verify(), extend verify() in factChecker.ts with tests in the same task.

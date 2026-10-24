### Task 5: Fact-Checker

**Files:** Create `server/agents/factChecker.ts`. Test `server/__tests__/factChecker.test.ts`.

**Interfaces:**
- Consumes: `AgentContext`, `Candidate`
- Produces: `verify(c: Candidate, ctx: AgentContext): Promise<{ ok: boolean; reason: string | null; corrected: Partial<Candidate> | null }>`. It re-runs an *independent* Zetaris query for `c.claim` (amount, recall id or deadline) and compares. It fails when the amount differs by more than 1 cent, the deadline differs, or `sources` is empty.

- [ ] Step 1: Write the tests with a stub `z.runQuery`:
  - a candidate claiming `amountCents: 2899` with the re-query returning `2899` gives `ok:true`
  - a re-query returning `2499` gives `ok:false` with reason containing `amount mismatch` and `corrected.amountCents === 2499`
  - `sources: []` gives `ok:false` with reason `no source`
- [ ] Step 2: Run. Expected: FAIL. Step 3: implement. Step 4: run. Expected: PASS. Step 5: commit `feat: fact-checker agent`.


---
**Binding context (read too):** overrides.md, global-constraints.md, and the "Rulings" section of progress.md, all in this folder. Where they conflict with the text above, they win. Key rulings: guest only (no Firebase; "Reviewer mode" token instead of admin); the Receipt is split into `moneyBackCents` + `likelyBenefitsCents`; the court caps at 5 offers; reuse the existing Zetaris objects `bundle_pg` and `bundle_live.cpsc_recalls`; never drop the Neon table `spike0_amazon_orders`. Repo: /Users/lyndsay/Documents/hackathon/bundle (local `main`, never push).

**Controller specifics:** `Candidate`/`AgentContext` come from server/agents/types.ts (Task 4); `ZetarisClient.runQuery` returns number-coerced rows. Query the per-agent views (`bundle_pg.v_clawback_tx`, `v_recall_orders`, `v_judge_offers`, `v_planner_family`, `v_scout_rules`) and the base tables as needed. One statement per call, no trailing semicolon. Log every verify via `ctx.trace.log` with `agent_name:'fact_checker'`. The verification query must be **independent** of the producing agent's SQL (a different query path, e.g. re-reading the source row by id), not a re-run of `c.evidenceSql`. Deadlines are compared as ISO date strings.

### Task 13: Scout, evals and learning demo

**Files:** Create `scripts/scout.ts`, `scripts/eval.ts`, `data/sample/saved-pages/*.html` (10 saved official/offer pages), `evals/expected.json`. Test `server/__tests__/eval.test.ts`.

**Interfaces:**
- `scout(pagesDir): Promise<{ rules: BenefitRuleRow[]; offers: OfferRow[] }>`: the LLM extracts rows, each requiring `sourceUrl`; the Fact-Checker's `no source` rule rejects any without it. Output is written via upsert. Seed rows remain the fallback.
- `runEval(): Promise<Scoreboard>`, where `Scoreboard = { trapsCaught: number; trapsTotal: number; falseAlarms: number; sourcedPct: number; runs: number; stable: boolean; learning: { run1Approved: boolean; run2Blocked: boolean; citedRuleId: string | null } }`. It runs `runBundle` for the 3 seed families 3 times and compares to `evals/expected.json`. Traps: the shipping-trap offer, a wrong-amount Scout row, the recalled item, the refund, the duplicate, the non-MA family.
- Learning demo: `scripts/eval.ts --learning`:
  1. Run 1. The shipping-trap offer is approved (no case law yet).
  2. Inject 3 fixture `issue` feedback rows, run the Coach, and auto-approve with the admin flag.
  3. Run 2. The trap is rejected and the Judge's trace cites the rule id.
  4. Write `logs/scoreboard.json`, and copy run 1 and run 2 traces to `output_examples/learning/` (a saved real run 1 is the demo fallback if the live model rejects the trap in run 1).

- [ ] Step 1: Write the test: `runEval` with FakeGenerator fixtures returns `trapsTotal === 6` and `sourcedPct === 100`; the `--learning` path flips the trap offer from approved (run 1) to blocked (run 2).
- [ ] Step 2: Run. Expected: FAIL. Step 3: implement. Step 4: run. Expected: PASS. Step 5: commit `feat: scout, eval scoreboard, learning demo`.


---
**Binding context (read too):** overrides.md, global-constraints.md, and the "Rulings" section of progress.md, all in this folder. Where they conflict with the text above, they win. Key rulings: guest only (no Firebase; "Reviewer mode" token instead of admin); the Receipt is split into `moneyBackCents` + `likelyBenefitsCents`; the court caps at 5 offers; reuse the existing Zetaris objects `bundle_pg` and `bundle_live.cpsc_recalls`; never drop the Neon table `spike0_amazon_orders`. Repo: /Users/lyndsay/Documents/hackathon/bundle (local `main`, never push).

**Controller specifics:** the mini-Scout reads exactly 3 saved pages (the Trump Account, MA PFML, and one store offer) into `data/sample/saved-pages/`. The trap offer is the seeded "free newborn diaper box" with an auto-renewing paid membership. The learning demo uses the real LLM when `MODEL_API_KEY` is set; otherwise it uses a FakeGenerator scripted to approve in run 1 and cite the rule in run 2, labelled `fake-llm` in the scoreboard. Never present fake output as real. `Scoreboard.learning` = `{run1Approved, run2Blocked, citedRuleId}`.

- **Demo date ruling (from the controller):** seed families use `DEMO_TODAY=2026-10-23` unless `TODAY` is set; inline families use the real date; seed-family feeds show "Demo date: Oct 23, 2026". Implement this here: in bundleDeps/route wiring and the Feed header, with a test.

- **Also (controller):** commit the 5 uncommitted Zetaris cache files from Task 12. Investigate the open question in progress.md: a live maya run once showed moneyBack $28.99 with no price-adjustment card, although today equals its deadline. The eval must assert maya moneyBack = 4899 deterministically (cached Zetaris, fake LLM); fix the root cause if it is an inclusive-date bug.

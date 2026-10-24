# Task 8: Benefits Planner report

Status: DONE. Commit: see `git log -1` on local main ("feat: benefits planner"). Not pushed.

## TDD
- RED: `npx jest server/__tests__/benefits.test.ts` failed to run (module `../agents/benefits` did not exist).
- GREEN: 12/12 pass. One copy fix along the way (fallback text must say "likely eligible"). Full suite: 11 suites, 112 tests pass; `npm run check` (tsc) clean.
- Tests cover the brief's cases (today 2026-10-23): maya (INSURANCE_ADD_BABY 2026-11-02, TRUMP_ACCOUNT 100000, MA_CHILD_TAX_CREDIT 44000), ava no MA cards and >=2 cards, leo 2027-01-06 with "(after birth)", born 2026-06-01 has no insurance card. Extras: deadline == today kept, Trump Account year range edges, WIC at/over/unknown/table-driven/no-row, income never in trace or card text, LLM body accepted / rejected on foreign dollar figure / no model, unsafe id, verify() passes each card, revise().

## Live run (Zetaris, scripts/zetaris/benefits-live.ts)
All cards verify() OK, 0 failures. About 0.8-1.4 s per family.
- maya (MA): DCFSA_LIFE_EVENT (2026-11-02), FEDERAL_CHILD_TAX_CREDIT 220000, INSURANCE_ADD_BABY (2026-11-02), MA_CHILD_TAX_CREDIT 44000, MA_PFML (2027-10-03), TRUMP_ACCOUNT 100000.
- leo (MA, due): FEDERAL_CTC 220000, INSURANCE_ADD_BABY (2027-01-06), MA_CTC 44000, MA_PFML (2027-12-07), TRUMP_ACCOUNT 100000; all titles end "(after birth)". No DCFSA (employer has none).
- ava (OH): FEDERAL_CTC 220000, TRUMP_ACCOUNT 100000 (insurance window closed 2026-09-23; no MA).
- No family is under 185% FPL, so WIC_SCREEN does not appear for the three seeds (covered by unit tests).
- Results cached: 12 new files in data/sample/zetaris-cache/ (rules, family view rows, poverty rows, verify queries). They contain the fake seed incomes (view row), which is allowed (fake data) but incomes are in cache JSON.

## Files
- server/agents/benefits.ts (planBenefits, revise, rulesSql/familySql/povertySql)
- server/__tests__/benefits.test.ts
- scripts/zetaris/benefits-live.ts

## Decisions
- Cards: kind 'benefit', verdict 'likely', claim {type:'rule', ref: code}, id `benefit-<code>`. Amount/deadline from benefit_rules only; LLM writes body via shared explain() with fallback. No Fact-Checker change needed.
- "(after birth)" suffix applies to every card for an unborn baby (literal reading of brief), not just windowed ones.
- Rule-specific predicates in code: TRUMP_ACCOUNT anchor in 2025-01-01..2028-12-31; DCFSA_LIFE_EVENT needs dcfsa_offered; MA scope needs state MA; WIC income*100 <= annual_cents*185 using poverty_guidelines row (year 2026, household size). Missing poverty row or null income: WIC skipped (never guessed). Household size > 8 has no row so is skipped.
- Dates/state from ctx.family (matches what verify() anchors on); income, household size, dcfsa flag from v_planner_family.
- Deadline equal to today is kept. Window start is ignored (all windows start at 0).
- revise uses sql.today() (TODAY env or real date) since its signature has no today.
- Income never passed into trace summaries or LLM facts.

## Concerns
- Rule codes unknown to the code (new rows) get a generic card by scope; fine for the seed.
- Fallback body is used in every live run (no model key); real LLM text path only tested with fakes.

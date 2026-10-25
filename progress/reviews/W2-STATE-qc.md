# W2-STATE QC (commit c97b60b)

Verdict: PASS with 2 must-fixes (small). Tests: 502 passed, 8 skipped (matches). `npx tsc --noEmit`: clean.

## A. Done check
- Poverty/WIC gone (rule, table, query, fallback rule, schema, seed); income never read in benefits.ts; sample families income null. PASS. (client/src/lib/howWeChecked.ts:52 still has a poverty_guidelines label regex: harmless, not owned.)
- tax_parameters / state_programs JSON: every row has year and https .gov source plus verified flag; test enforces. PASS. Unverified rows are prefixed "UNVERIFIED" in stored rows.
- No state names in agent code: test guards MA/Massachusetts/NY/CA/OH/FL in server/agents; grep confirms. PASS.
- ZIP3: 928 prefixes, all 50 states + DC; spot checks 010 MA, 303 GA, 606 IL, 750 TX, 973 OR, 350 AL, 850 AZ, 005 NY all correct. PASS.
- Uncovered state: federal cards still returned. The "coming soon" text exists in the server only as a trace line (benefits.ts:124); no card or API field carries it. The visible version is in client/src/lib/onboarding.ts (not owned). See must-fix 1.
- "Check with your job" card: amount null, no deadline, verdict 'info', fixed text (no model); not in totals. PASS.
- state_agnostic test: 5 families, swap test, state-name guard. PASS. (Fact-Checker planted-card part belongs to W3-FACT.)

## B. Test loosening
- eval.test.ts: NARROW. Filters only failures whose text contains "expected card benefit-ma_pfml is missing" / "benefit-ma_child_tax_credit is missing", and requires falseAlarms to equal exactly that count. Anything else still fails. It can hide only a genuine loss of those two MA cards in the eval until re-recorded. Keep.
- sampleMode.test.ts: BROADER than needed. Banner may be null or the "Some sources didn't respond" text, and `likelyBenefitsCents >= 0` is always true (vacuous). It could hide a real regression in the benefit path. Recommendation: keep eval loosening; tighten sampleMode (assert the exact banner text, drop the `>= 0` line or assert cards of kind 'benefit' include FEDERAL_CHILD_TAX_CREDIT) while keeping the TODO to restore after `zetaris:record`. Do not revert to known-red tests: that blocks the merge check for every other chunk.

## C. Data accuracy (web-checked 2026-10-24)
- Federal CTC $2,200 (2026): correct (statute set by 2025 law, indexed after 2025; several sources agree). Cited IRS URL rp-25-32.pdf is the inflation-adjustment notice; better to also link irs.gov/credits-deductions/individuals/child-tax-credit. No wrong figure.
- Dependent Care FSA $7,500 (MFS $3,750) for 2026: correct per secondary sources; I could not open an IRS page. Not shown to users anyway.
- MA child credit $440, tax year 2024 and later: correct, https://www.mass.gov/info-details/massachusetts-child-and-family-tax-credit (updated 2025-12-23). Note: it applies to a child under 13, per eligible individual.
- NY PFL: bonding within the first 12 months after birth, up to 12 weeks (paidfamilyleave.ny.gov). 365-day window is correct; builder can flip verified to true citing that page.
- CA PFL: EDD FAQ says bonding benefits only in the first year after birth, up to 8 weeks in a 12-month period (https://edd.ca.gov/en/disability/faq_pfl_benefits_payments/). 365 correct; can flip to verified with that URL. Also CA now also says 8 weeks (matches data).
- No wrong figures found.

## D. Tightness
- Only owned files plus the declared eval.test.ts and sampleMode.test.ts edits (also fallback.ts, a file not on the owned list but required by the screenRule signature change; declared in the diff, fine).
- Sample families made-up; incomes null. No secrets, no hardcoded outputs (card amounts come from the seeded rows).
- Tests are meaningful (planner run against all-states rule list, so the planner's own filter is tested).
- scripts/seed.ts still imports ingest/plaid (W2-PURCH will delete it): expect a trivial merge conflict in seed.ts and seed.test.ts.

## Must-fix
1. client/src/lib/onboarding.ts:7 COVERED_STATES = ['MA'] but data now covers MA, NY, CA: NY and CA families will wrongly see "coming soon". Not W2-STATE owned: orchestrator/onboarding owner should derive from state-programs.json or add NY, CA. Also decide whether the server should expose the note on the run result (benefits.ts:124 is trace only).
2. server/__tests__/sampleMode.test.ts:~104-110: tighten the loosened assertions (see B).

## Nice to have
- Flip NY_PFL and CA_PFL `verified` to true with the URLs above (data/sample/state-programs.json); drop the UNVERIFIED prefix.
- Lyndsay: deck slide 2 WIC statistic still needs replacing (not code).

# Task 2 report: schema, shared types, seed data

Status: DONE_WITH_CONCERNS. Commit f246083 on bundle `main` (local only).

## Implemented
- `shared/schema.ts`: users (unchanged, no `role` per rulings) + families, transactions, amazon_orders, fsa_eligible_categories, store_policies, benefit_rules, offers, feedback, case_law_proposals, price_observations, zip_states, poverty_guidelines. All explicit snake_case. Exports `BUNDLE_TABLE_NAMES`.
- `shared/bundle.ts`: types per brief, with the split `BundleReceipt` (`moneyBackCents`, `likelyBenefitsCents`, ...).
- `drizzle.config.ts`: `tablesFilter` = Bundle's 13 tables only. `tsconfig.json` now includes `scripts/**`.
- `scripts/seed.ts`: `seed()` (idempotent; one DB transaction; clears and refills only Bundle tables; seed families deleted by id so others survive). Also runnable: `npx tsx scripts/seed.ts` (run from repo root).
- `data/sample/`: families.json, plaid-transactions.json (Plaid shape, dollars, positive = spend), amazon-orders.csv, README.md (lists every planted trap).
- Seed content: 3 families (fixed dates as specified); 16 offers (5 general incl. the trap "Free newborn diaper box" by made-up store Cuddle & Co, flagged in a code comment and README); 7 benefit rules with the specified values; 12 FSA categories; 3 store policies (Target 14, Best Buy 15, Costco 30); 2 price observations (Target Graco Pack 'n Play $69.99 vs maya's $89.99 purchase); zip_states (MA 010-027, OH 430-459, plus NY/CA/TX/NH and default `000 -> US`); poverty_guidelines 2026 (verified at aspe.hhs.gov: 1=$15,960 ... 8=$55,720; household 4 = $33,000).
- Traps in fixtures: Target "Frida baby thermometer" 2899; Graco playard (price drop); Carter's refund (-2400); duplicate Walgreens diapers; Bright Horizons monthly x3; Amazon KEAWIS Crib Mattress (real CPSC recall 10560).

## TDD
- RED: `npm test -- seed` failed: "Cannot find module '../../scripts/seed'".
- GREEN: `npm test`: 2 suites, 10 tests pass. `npm run check` clean.

## drizzle-kit push plan (printed, then aborted at the prompt; stdin closed)
CREATE TABLE for all 13 Bundle tables (amazon_orders, benefit_rules, case_law_proposals, families, feedback, fsa_eligible_categories, offers, poverty_guidelines, price_observations, store_policies, transactions, users, zip_states), then:
`DROP SEQUENCE "public"."spike0_amazon_orders_id_seq";`
No DROP TABLE, but that sequence belongs to Lyndsay's `spike0_amazon_orders` (tablesFilter does not filter sequences). I did NOT run it. Instead I applied only the 13 CREATE TABLE statements from the plan in one transaction via a throwaway script (deleted). Verified spike0_amazon_orders still exists.

## Decisions
- Test runs the real seed() against Neon's Bundle tables (repeatable; no data outside Bundle tables is touched). Chose this over a rollback/fresh-schema because Zetaris must read the same tables later.
- Dates are Postgres `date` (string mode); transaction product text goes in `category` (no description column in the brief).
- `seed()` does not clear feedback / case_law_proposals so demo learning data survives re-seeding.
- seed.ts avoids `import.meta` (ts-jest compiles to CJS) and reads `data/sample` relative to cwd.

## Concerns
1. **`npm run db:push` will always propose `DROP SEQUENCE spike0_amazon_orders_id_seq`.** Never confirm it. Future schema changes: apply the CREATE/ALTER statements manually, or drop/rename spike0 table's sequence concern in the controller's hands. Interactive prompt means it is safe to abort.
2. Offer/FSA/store-policy `sourceUrl`s were hand-curated and not each fetched; the Cuddle & Co URL is a placeholder (example.com). The Fact-Checker should re-verify.
3. Brief's step "Task 1 `users` has no role" honored; no admin column.

## Fix round 1
- Added two tests to server/__tests__/seed.test.ts: (a) Walgreens duplicate pair (2 rows, distinct ids), 3 Bright Horizons rows at 185000, Pack 'n Play purchase 8999, KEAWIS order (maya, 8999), Pack 'n Play price observation 6999 (< 8999) and non-empty price-observation sourceUrls; (b) fixed ISO dates for maya/leo/ava and poverty rows (8+, year 2026, aspe.hhs.gov source).
- Fixed stray semicolon inside the trailing comment at scripts/seed.ts:11 (it was line 11, not 357).
- Command: npm run check (clean); npx jest server/__tests__/seed.test.ts --maxWorkers=1 -> 8 passed, 8 total.
- Commit: 4121fc9 test: guard all planted traps, fixed dates and source URLs in seed test

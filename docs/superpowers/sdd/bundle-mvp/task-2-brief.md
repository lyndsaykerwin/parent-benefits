### Task 2: Schema, shared types and seed data

**Files:**
- Modify: `shared/schema.ts`
  - add `role` to `users`: text enum `['parent','admin']`, default `'parent'`
  - add tables `families`, `transactions`, `amazonOrders`, `fsaEligibleCategories`, `storePolicies`, `benefitRules`, `offers`, `feedback`, `caseLawProposals`, `priceObservations`
- Create: `shared/bundle.ts`, `scripts/seed.ts`, `data/sample/plaid-transactions.json`, `data/sample/amazon-orders.csv`
- Test: `server/__tests__/seed.test.ts`

**Interfaces:**
- Produces, in `shared/bundle.ts`:

```ts
export type CardKind = 'clawback' | 'recall' | 'discount' | 'benefit' | 'coming_soon';
export type Verdict = 'verified' | 'likely' | 'all_clear' | 'info' | 'blocked';
export interface Source { label: string; url: string }
export interface FeedCard {
  id: string; kind: CardKind; title: string; body: string;
  amountCents: number | null; deadline: string | null; // ISO date
  verdict: Verdict; sources: Source[]; traceId: string;
}
export interface BundleReceipt { totalCents: number; deadlineCount: number; nextDeadline: string | null; itemsChecked: number }
export interface BundleResult { familyId: string; runId: string; receipt: BundleReceipt; cards: FeedCard[]; banner: string | null }
export interface Family {
  id: string; userId: string | null; isGuest: boolean; name: string;
  birthDate: string | null; dueDate: string | null; zip: string; state: string;
  employer: string; householdSize: number; annualIncomeCents: number | null;
  dcfsaOffered: boolean; dataConnected: boolean;
}
```

- Table columns (key ones):
  - `transactions(id, familyId, date, merchant, amountCents, category, source 'plaid'|'fixture')`
  - `amazonOrders(id, familyId, orderDate, title, asin, upc, priceCents)`
  - `fsaEligibleCategories(id, keyword, category, account 'FSA'|'HSA'|'DCFSA', sourceUrl)`
  - `storePolicies(id, store, adjustmentWindowDays, sourceUrl)`
  - `benefitRules(id, code, title, scope 'federal'|'MA', amountCents, windowStartDaysFromBirth, windowEndDaysFromBirth, condition, sourceUrl)`
  - `offers(id, title, store, minAgeDays, maxAgeDays, triggerKeyword, valueCents, finePrint, sourceUrl)`
  - `feedback(id, familyId, cardId, kind 'got_it'|'issue', note, createdAt)`
  - `caseLawProposals(id, text, sourceFeedbackIds, confidence, status 'proposed'|'approved'|'rejected', memoryId)`
  - `priceObservations(id, store, keyword, priceCents, observedAt, sourceUrl)`: sample price checks that power the price-adjustment clawback
- `seed()` inserts 3 families:
  - `maya` (MA, born 20 days ago, Plaid fixture + Amazon CSV, DCFSA offered)
  - `leo` (MA, due in 45 days, no data)
  - `ava` (Ohio ZIP 43215, born 60 days ago, Plaid fixture only)
- Curated rows, each with a `sourceUrl`:
  - ≥15 offers, including ≥4 general offers (`triggerKeyword=''`, `minAgeDays=-280`, `maxAgeDays=365`) so unborn families can reach 3 discounts, and the shipping-trap offer
  - a `zip_states` table (zip3 prefix → state) covering MA, OH and a default
  - ≥7 benefit rules: `TRUMP_ACCOUNT` $1,000 federal (birth 2025–2028); `FEDERAL_CHILD_TAX_CREDIT` $2,200 federal (no deadline window; guarantees a second benefit card for non-MA families past day 30); `INSURANCE_ADD_BABY` window 0–30; `DCFSA_LIFE_EVENT` 0–30; `MA_CHILD_TAX_CREDIT` $440 (MA); `MA_PFML` (MA); `WIC_SCREEN` (federal, condition income ≤185% FPL)
  - ≥10 FSA categories, ≥3 store policies

- [ ] Step 1: Write the test: after `seed()` against a test schema, `families` has ids `maya, leo, ava`; `benefitRules` includes `FEDERAL_CHILD_TAX_CREDIT`; every `benefitRules`/`offers`/`fsaEligibleCategories` row has a non-empty `sourceUrl`; `ava.state === 'OH'`.
- [ ] Step 2: Run `npm test -- seed`. Expected: FAIL.
- [ ] Step 3: Add the tables, types, fixtures and `seed(): Promise<void>`. The fixtures must include traps:
  - one FSA-eligible purchase (`Target, "Frida baby thermometer", 2899`)
  - one price-drop item within window
  - one refund (negative amount)
  - one duplicate transaction
  - one Amazon item whose title matches a real CPSC recalled product
  - daycare payments (`Bright Horizons`, monthly)
- [ ] Step 4: apply reviewed SQL by hand, only with Lyndsay's OK — never run `db:push` (Neon), then `npx tsx scripts/seed.ts`, then `npm test -- seed`. Expected: PASS.
- [ ] Step 5: Commit `feat: bundle schema, shared types, seed families and fixtures`.


---
**Binding context (read too):** overrides.md, global-constraints.md, and the "Rulings" section of progress.md, all in this folder. Where they conflict with the text above, they win. Key rulings: guest only (no Firebase; "Reviewer mode" token instead of admin); the Receipt is split into `moneyBackCents` + `likelyBenefitsCents`; the court caps at 5 offers; reuse the existing Zetaris objects `bundle_pg` and `bundle_live.cpsc_recalls`; never drop the Neon table `spike0_amazon_orders`. Repo: /Users/lyndsay/Documents/hackathon/bundle (local `main`, never push).

**Task 2 specifics from the controller:**
- Task 1 slimmed `users` to `id, display_name, created_at`, and there's no auth. Do NOT add `role` (rulings replace it with the Reviewer-mode token).
- `BundleReceipt` in `shared/bundle.ts` = `{ moneyBackCents: number; likelyBenefitsCents: number; deadlineCount: number; nextDeadline: string | null; itemsChecked: number }`.
- `Family.annualIncomeCents` is `number | null`.
- Seed families use **fixed ISO dates**: maya `birthDate 2026-10-03`; leo `dueDate 2026-12-07`; ava `birthDate 2026-08-24`, ZIP 43215, state `OH`. Write `data/sample/families.json` with the same 3 families (SAMPLE_MODE reads it later).
- Offers: ≥15, including ≥4 general offers (`triggerKeyword=''`, `minAgeDays=-280`, `maxAgeDays=365`) and the **trap offer**: title like "Free newborn diaper box", with fine print saying it auto-enrolls you in a paid $29.99/month membership after a 30-day trial. Use real store/brand-style names, but mark the trap clearly in a code comment and in `data/sample/README.md` as a planted test case.
- Add a `zip_states` table (`zip3 text primary key, state text`) seeded with MA prefixes (010–027), OH 430–459, and a few others.
- Every `pgTable` uses explicit snake_case table and column names.
- Drizzle `tablesFilter` in drizzle.config.ts must list only Bundle's tables (never `spike0_amazon_orders`). Run `npx drizzle-kit push` and paste its printed plan into your report. If it proposes dropping anything, abort and report BLOCKED. If auto mode refuses the push, report DONE_WITH_CONCERNS with the exact command, and the controller will run it.
- The test for `seed()` may run against the real Neon DB, inside a transaction that rolls back, or against fresh tables. Choose and document. Never delete Lyndsay's data outside Bundle's tables.
- Benefit rule values (each with a sourceUrl):
  - `TRUMP_ACCOUNT` 100000 cents, federal, condition "born 2025-01-01..2028-12-31", source trumpaccounts.gov
  - `FEDERAL_CHILD_TAX_CREDIT` 220000, federal, no window
  - `INSURANCE_ADD_BABY` window 0–30 days, federal, amount null
  - `DCFSA_LIFE_EVENT` 0–30, federal
  - `MA_CHILD_TAX_CREDIT` 44000, MA
  - `MA_PFML` MA, window 0–365, amount null
  - `WIC_SCREEN` federal, condition "income <= 185% FPL"
  - also a row holding the 2026 HHS poverty guideline values (e.g. a `poverty_guidelines(household_size, annual_cents)` table: 48 contiguous states, 2026), with the source URL. Look up the official 2026 numbers at aspe.hhs.gov and cite them; if you can't verify, use 2025's and say so.

# Data notes

Plain-English summary: **every family and purchase in this project is made up.** The recalls, benefit rules
and store policies are real public facts, entered or fetched by hand and kept small on purpose.

## What is real and what is made up

| Kind | Real or made up |
|---|---|
| Families (maya, leo, ava), bank-style transactions, Amazon orders | Made up. Income figures are invented and never appear in logs. |
| Recalls (CPSC, FDA) | Real, from the government feeds below. |
| Benefit rules, FSA categories, store return/price policies, offers | Real public programmes and policies, summarised by hand with a source link each. |
| One offer ("Free newborn diaper box", Cuddle & Co) | **Made up on purpose** as a trap: it quietly turns into a paid membership. Its URL is a placeholder. |
| Saved Scout pages in `data/sample/saved-pages/` | **Hand-written short excerpts** (not copies) of public pages, with the source URL in each file and the capture date 2026-10-23. The live sites blocked automated download. |
| Zetaris replay cache in `data/sample/zetaris-cache/` | **Saved real Zetaris responses** (113 files) over the made-up family data and the real recall feeds. Captured 2026-10-23 between about 10:18 and 14:18 (US Eastern) by running the agents live. |

## Sources

| Source | Link | Licence / terms | What we used | Records | Rebuild | Limits |
|---|---|---|---|---|---|---|
| CPSC recalls (US Consumer Product Safety Commission) | https://www.saferproducts.gov/RestWebServices/Recall?format=json | US government data, free to use | Recalls since 2025-06-01, read live through Zetaris table `bundle_live.cpsc_recalls` | 739 when captured (2026-10-23) | `npx tsx scripts/zetaris/register.ts` (creates the Zetaris table; needs Zetaris keys) | A recall is matched to a purchase by brand and model words, then confirmed by a second check. Titles on real receipts are messy, so a miss is possible. |
| openFDA food enforcement (infant formula) | https://api.fda.gov/food/enforcement.json | openFDA data is public domain (CC0) | First 100 results for "infant formula", through `bundle_live.fda_food_recalls` | 42 matches when captured | Same script as above | Capped at 100 results. Dates arrive as numbers and are normalised in the Recall Checker. |
| Benefit rules | Each rule links its own page (IRS, healthcare.gov, mass.gov, USDA, trumpaccounts.gov) | Public government pages, summarised by hand | 7 rules in `scripts/seed.ts` (`BENEFIT_RULES`), also `data/sample/fallback-rules.json` | 7 | `npm run seed` (needs DATABASE_URL) | Amounts and windows are as of 2026-10-23 and can change. The Fact-Checker needs a source link on every card. |
| Offers (registry gifts, rewards, trap) | The store page linked on each offer | Public marketing pages, summarised by hand | `OFFERS` in `scripts/seed.ts`, also `data/sample/fallback-offers.json` | 16 (15 real programmes, 1 planted trap) | `npm run seed` | Offer terms change often. Only one hand-checked snapshot; the Scout reads 3 saved pages as a demo of auto-refresh. |
| FSA/HSA categories | fsastore.com and IRS Publications 502/503 | Public pages, summarised by hand | 12 keyword rules (`FSA_CATEGORIES`) | 12 | `npm run seed` | Keyword matching, so unusual product names can be missed. |
| Store price-adjustment policies | Each store's help page | Public pages, summarised by hand | Target 14 days, Best Buy 15, Costco 30 | 3 | `npm run seed` | Policies change. Prices in `price_observations` are made-up saved observations. |
| Poverty guidelines 2026 | https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines | US government data | WIC screening income check | 8 household sizes | `npm run seed` | Figures were not independently re-verified. |
| ZIP prefix to state | Hand-written | n/a | MA, OH, NY, CA, TX, NH prefixes only (`server/sampleZips.ts`) | 164 prefixes | Edit the file | Other states are rejected with "Enter a valid US ZIP code". |

## Sample inputs (made up)

- `data/sample/families.json`: 3 families. `maya` (MA, baby born 2026-10-03), `leo` (MA, due 2026-12-07, no data connected), `ava` (OH, born 2026-08-24).
- `data/sample/plaid-transactions.json`: 15 bank-style transactions (Plaid's field shape).
- `data/sample/amazon-orders.csv`: 3 orders, for maya.
- Planted test cases and what a correct run does with each: see `data/sample/README.md`.

## Demo date

The sample families only make sense around 2026-10-23 (a price-adjustment window, a 30-day insurance window).
They therefore run at that **demo date** unless the `TODAY` setting overrides it, and the app labels it.
A family you type in uses the real date.

## Why a cache, and what it means for SAMPLE_MODE

Zetaris answers are saved by the exact SQL text. With `SAMPLE_MODE=true` and no Zetaris keys, the three sample
families replay these saved real responses, so a judge can run everything with no keys. A new family you type in
asks different SQL, misses the cache, and the app shows its "some sources didn't respond" banner with a safe,
never-empty feed (see `output_examples/custom-family.json`). With real keys the same code queries Zetaris live.

## Re-capturing the cache

With Zetaris keys in `.env`: `npx tsx scripts/run-family.ts maya` (and `leo`, `ava`). Every live query is written to
`data/sample/zetaris-cache/`.

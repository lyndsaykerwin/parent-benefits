# Zetaris notes — Spike 0: Neon × live CPSC recalls in one query

**Date:** 2026-10-23 · **Verdict: GO** — Zetaris joined Lyndsay's private Neon Postgres table with the live CPSC recall feed in a single SQL statement and returned the correct recalled item.

## Plain-English summary

We wanted to know if Zetaris can act as Bundle's "data door": look at a family's private purchase list (stored in our Neon database) and at the government's live recall list (CPSC = US Consumer Product Safety Commission, which publishes recalls through a public web feed) **at the same time**, in one question, and find the overlap. It can. One query found that the fake family "maya" bought a KEAWIS Crib Mattress that CPSC recalled on 2026-01-15. It took about 2–6 seconds.

All family data here is **fake** (made up for the test). The recall is **real**.

## What worked (all on the first or second try)

| Step | Result |
|---|---|
| Pick a real recall | RecallID **10560**, RecallNumber 26191, 2026-01-15, product "KEAWIS Crib Mattress" — https://www.cpsc.gov/Recalls/2026/Yixing-Trading-Recalls-KEAWIS-Crib-Mattresses-Due-to-Risk-of-Serious-Injury-or-Death-from-Entrapment-and-Suffocation-Violates-Mandatory-Standard-for-Crib-Mattresses |
| Neon table + 5 fake rows | Done (via Node `pg`) |
| Zetaris → Neon connection | Worked on the **first attempt** with plain `sslmode=require`. The SNI/`endpoint=` workaround was **not** needed. |
| Register Neon table + count | `count(*) = 5` ✔ |
| Live CPSC REST table | Worked. CPSC returns a bare top-level JSON array (the repo's docs listed this shape as "untested"); Zetaris accepted it. 739 rows = 739 from curl ✔ |
| THE JOIN | 1 correct row, no false matches ✔ |

## Exact SQL used (one statement per call, no trailing semicolon)

Neon (run with Node `pg`, not Zetaris):

```sql
CREATE TABLE IF NOT EXISTS spike0_amazon_orders(id serial primary key, family_id text, order_date date, title text, price_cents int)

INSERT INTO spike0_amazon_orders(family_id, order_date, title, price_cents) VALUES
  ('maya','2026-03-02','Pampers Swaddlers Newborn Diapers, 84 count',2999),
  ('maya','2026-03-10','KEAWIS Crib Mattress, Dual-Sided Firm Baby Mattress',8999),
  ('maya','2026-04-05','Hatch Rest Sound Machine and Night Light',5999),
  ('maya','2026-05-18','Dr. Brown''s Natural Flow Anti-Colic Bottles, 4 pack',2499),
  ('maya','2026-06-21','Burt''s Bees Baby Organic Cotton Sleep Sack',2795)
```

Zetaris:

```sql
CREATE DATASOURCE bundle_pg DESCRIBE BY "Bundle Neon" OPTIONS (jdbcdriver "org.postgresql.Driver", jdbcurl "jdbc:postgresql://ep-muddy-mode-b4h78pwd.c-6.us-east-2.aws.neon.tech:5432/neondb?sslmode=require", username "neondb_owner", password "***")

REGISTER DATASOURCE TABLE 'spike0_amazon_orders' FROM bundle_pg

SELECT count(*) AS n FROM bundle_pg.spike0_amazon_orders          -- 5

CREATE LIGHTNING DATABASE bundle_live DESCRIBE BY "Live recall feeds"

CREATE LIGHTNING REST TABLE cpsc_recalls FROM bundle_live REQUEST (endpoint "https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=2025-06-01", method "get", response_type "json", http_encoding "URLENCODED") HEADER () BODY ()

SELECT count(*) AS n FROM bundle_live.cpsc_recalls                 -- 739
```

The password was built into the statement inside a script from the secrets file and never printed or saved.

### The join

```sql
SELECT o.family_id, o.order_date, o.title AS ordered_item, o.price_cents,
       r.RecallID, r.RecallNumber, r.recall_date, r.recall_title, r.recall_url, r.recalled_product
FROM bundle_pg.spike0_amazon_orders o
JOIN (SELECT RecallID, RecallNumber, substr(RecallDate,1,10) AS recall_date, Title AS recall_title,
             URL AS recall_url, p.Name AS recalled_product
      FROM bundle_live.cpsc_recalls LATERAL VIEW explode(Products) AS p) r
  ON lower(o.title) LIKE concat('%', lower(r.recalled_product), '%')
WHERE o.family_id = 'maya'
```

**Result (1 row):**

| family_id | order_date | ordered_item | price_cents | RecallID | RecallNumber | recall_date | recall_title | recall_url | recalled_product |
|---|---|---|---|---|---|---|---|---|---|
| maya | 2026-03-10 | KEAWIS Crib Mattress, Dual-Sided Firm Baby Mattress | 8999 | 10560 | 26191 | 2026-01-15 | Yixing Trading Recalls KEAWIS Crib Mattresses Due to Risk of Serious Injury or Death from Entrapment and Suffocation; Violates Mandatory Standard for Crib Mattresses | https://www.cpsc.gov/Recalls/2026/Yixing-Trading-Recalls-KEAWIS-Crib-Mattresses-... | KEAWIS Crib Mattress |

**Timings (wall clock, measured from our laptop):**

| Run | Wall clock | Zetaris-reported |
|---|---|---|
| 1st | 6.38 s | 6,185 ms |
| 2nd | 2.05 s | 1,900 ms |

The first run is slower most likely because connections were "warming up" (Neon's database may also have been waking from sleep). The CPSC table is **not cached**: the repo docs say an uncached Lightning REST table calls the source again on each query, so both runs read the live feed.

## Nested-data finding

`Products` comes through **nested** — an array (a list) of records: `array<struct<CategoryID, Description, Model, Name, NumberOfUnits, Type>>`. The same goes for Hazards, Remedies, Retailers, Manufacturers, Images, ProductUPCs and so on. Top-level fields (RecallID bigint, RecallNumber, RecallDate, Title, URL, Description) are flat strings.

What works for getting at product names:
- `Products[0].Name` (first product only) ✔
- `Products.Name` (returns the list of all names) ✔
- `LATERAL VIEW explode(Products) AS p` then `p.Name` (one row per product; best for joins) ✔ — 739 rows, matches curl.

## Errors seen (verbatim)

1. Putting `LATERAL VIEW` inside parentheses in a JOIN fails to parse:
   ```
   LightningDdlParseException: mismatched input 'o' expecting 'METADATA'(line 1, pos 7)
   ```
   Fix: wrap the explode in a subquery `(SELECT ... FROM t LATERAL VIEW explode(...) AS p) r` (used above). The error message is misleading — it does not point at the real problem.
2. One unfiltered `SELECT count(*) ... LATERAL VIEW explode(Products)` hit our helper script's 30-second client timeout once (`The read operation timed out`). Re-run moments later: 0.95 s. Treat as a one-off; the helper's 30 s limit (`scripts/zetaris_api.py`) is tight for live REST calls.

## Things to know for the real build

- **Text matching is naive.** `LIKE '%product name%'` worked here because the fake order title contained the exact recalled name. Real Amazon titles won't line up so neatly; Bundle will need fuzzier matching (brand + model, UPC barcodes where available, or an AI "is this the same product?" check).
- **Feed size:** recalls since 2025-06-01 = 739 records, ~2.2 MB per call. Fine for a demo. For heavier use, consider `CACHE TABLE bundle_live.cpsc_recalls` (with a note that the data is then a snapshot), or a narrower date window.
- **Objects left on the Zetaris cluster:** datasource `bundle_pg` (with registered table `spike0_amazon_orders`), Lightning database `bundle_live` with REST table `cpsc_recalls`. Per the repo docs, REST tables and Lightning databases can only be removed in the Zetaris Data Explorer (the web UI).
- **Left in Neon:** table `spike0_amazon_orders` (5 fake rows).
- The Neon password exists only in `.secrets/bundle.env.local` (checked by scanning the project and scratch folders).

## Task 3 (Oct 23): Bundle objects registered

Run with `npx tsx scripts/zetaris/register.ts` (dry run) then `--apply` from `bundle/`; re-runnable, skips what exists. All succeeded on the first attempt.

- **Datasource `bundle_pg`:** reused from Spike 0. Registered the 13 Bundle tables (`users`, `families`, `transactions`, `amazon_orders`, `fsa_eligible_categories`, `store_policies`, `benefit_rules`, `offers`, `feedback`, `case_law_proposals`, `price_observations`, `zip_states`, `poverty_guidelines`). `SELECT count(*) AS n FROM bundle_pg.families` = 3.
- **Views (`CREATE DATASOURCE VIEW ... FROM bundle_pg`), queried as `bundle_pg.<view>`:** `v_judge_offers` (no family columns), `v_planner_family` (the only one with income), `v_clawback_tx` (no income), `v_recall_orders` (Amazon titles UNION ALL card merchants; columns `family_id, purchased_on, item_text, source, price_cents`), `v_scout_rules` (benefit_rules UNION ALL offers; columns `ref, title, kind, amount_cents, source_url, record_type`).
- **`bundle_live.cpsc_recalls`:** reused as is (window starts 2025-06-01, not 2024-01-01 as the brief says). `LATERAL VIEW explode(Products) AS p` inside a subquery returns product names.
- **`bundle_live.fda_food_recalls`:** created (infant formula, `limit=100`; 42 matches). Zetaris loads it as ONE row with columns `meta` and `results`, where `results` is an array of records. Flatten it the same way as CPSC, inside a subquery: `SELECT x.recall_number, x.product_description FROM bundle_live.fda_food_recalls LATERAL VIEW explode(results) t AS x`. Dates like `recall_initiation_date` come back as numbers (20200611).
- **Not done:** the optional NHTSA car-seat table (endpoint not confirmed). Data-quality rules (`REGISTER DQ`) need an activated USL table (Zetaris's "unified semantic layer"), which is extra setup; skipped. The Fact-Checker's `no source` check is the backstop.
- **Left alone:** `spike0_amazon_orders` (still registered, 5 rows).

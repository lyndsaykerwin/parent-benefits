# Sample data

Everything here is **made up** (fake families, fake purchases). Only the recall
and the public rules referenced in the database are real.

- `families.json`: the three seed families. `maya` (MA, baby born 2026-10-03),
  `leo` (MA, due 2026-12-07, no data), `ava` (Ohio 43215, born 2026-08-24).
- `plaid-transactions.json`: bank-style purchases in the shape Plaid uses
  (positive amount = money out, negative = money in). Used for maya and ava.
- `amazon-orders.csv`: Amazon order history for maya only.

## Planted test cases (traps on purpose)

These exist so the agents have something real to catch. They are not mistakes.

| Where | Trap | What a correct run does |
|---|---|---|
| maya transactions | Target "Frida baby thermometer" $28.99 | flags as likely FSA/HSA-eligible |
| maya transactions | Target "Graco Pack 'n Play" $89.99, with a lower saved price | finds a price-adjustment refund inside Target's 14-day window |
| maya transactions | Carter's onesies refund (negative amount) | does not count a refund as spending |
| maya transactions | Walgreens diapers listed twice, same day and amount | counts it once |
| maya transactions | Bright Horizons monthly payments | recognizes daycare, suggests Dependent Care FSA |
| maya Amazon orders | KEAWIS Crib Mattress | matches a real CPSC recall (RecallID 10560) |
| offers table | "Free newborn diaper box" from Cuddle & Co | **trap offer**: fine print auto-enrolls you in a $29.99/month membership after 30 days; Fine Print Court must reject it |

Sources in the database were curated by hand; the Fact-Checker re-verifies them.
`Cuddle & Co` is a made-up store and its source URL is a placeholder.

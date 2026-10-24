### Task 11: Ingest (Plaid sandbox and Amazon CSV)

**Files:** Create `server/ingest/plaid.ts`, `server/ingest/amazonCsv.ts`, plus routes `POST /api/ingest/plaid/link-token`, `POST /api/ingest/plaid/exchange`, `POST /api/ingest/amazon` (multipart). Test `server/__tests__/ingest.test.ts`.

**Interfaces:**
- Produces:
  - `parseAmazonCsv(csv: string, familyId: string): AmazonOrderRow[]`. Columns follow Amazon's `Retail.OrderHistory` export: `Order Date, Product Name, ASIN, Unit Price`. Bad rows are skipped and counted.
  - `importPlaidTransactions(familyId, accessToken, plaidClient): Promise<number>`, using Plaid `transactionsSync` with sandbox credentials `PLAID_CLIENT_ID`/`PLAID_SECRET`/`PLAID_ENV=sandbox`.
  - Both set `families.dataConnected = true`.
- Until Plaid keys exist, `data/sample/plaid-transactions.json` is in Plaid's transaction shape and imported via the same mapper, `mapPlaidTxn(t: PlaidTxn, familyId): TransactionRow`.

- [ ] Step 1: Write the tests:
  - `parseAmazonCsv` on the fixture returns N rows with `priceCents` integers, and skips a malformed line
  - `mapPlaidTxn({amount: 28.99, merchant_name:'Target', date:'2026-10-10'})` gives `amountCents: 2899`, `merchant:'Target'` (Plaid's positive amount means an outflow)
- [ ] Step 2: Run. Expected: FAIL. Step 3: implement. Step 4: run. Expected: PASS. Step 5: commit `feat: plaid sandbox and amazon csv ingest`.


---
**Binding context (read too):** overrides.md, global-constraints.md, and the "Rulings" section of progress.md, all in this folder. Where they conflict with the text above, they win. Key rulings: guest only (no Firebase; "Reviewer mode" token instead of admin); the Receipt is split into `moneyBackCents` + `likelyBenefitsCents`; the court caps at 5 offers; reuse the existing Zetaris objects `bundle_pg` and `bundle_live.cpsc_recalls`; never drop the Neon table `spike0_amazon_orders`. Repo: /Users/lyndsay/Documents/hackathon/bundle (local `main`, never push).

**Controller specifics:** drop the Plaid link-token and exchange routes and `importPlaidTransactions` (live Plaid is "coming soon"). Keep `mapPlaidTxn` and the fixture loader. The Amazon CSV upload is **optional**: implement `parseAmazonCsv` plus its route only if it fits comfortably. Uploads attach only to an inline (non-persisted) run or a seed family's in-memory session; don't write uploaded rows into the shared seed families.

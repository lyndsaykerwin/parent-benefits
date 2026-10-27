# Lane F: deck rebuild (Oct 26, 2026)

**What changed:** `presentation/deck/bundle-deck.html` now has 15 slides (it had 12). It follows `progress/reviews/2026-10-26-deck-gap-review.md`.
**Old copy saved:** `presentation/deck/old-versions/bundle-deck-2026-10-24.html` and `.pdf`.
**Rendered with:** `zsh presentation/deck/render.sh`. This made `bundle-deck.pdf` (3.8 MB) and `slides/slide-01.png` to `slide-15.png`. I looked at every PNG. I fixed two layout problems: cards on slides 8 and 9 stretched down to the footer. Nothing overflows or overlaps now.
**Nothing committed:** the changes are only on this Mac. Nothing was saved to git.
**New images:** `img/item-graco-sample-label.png` and `img/receipt-made-up-baby-mart.png`, copied from `bundle/data/sample/photos/`. Both pictures are made up.

## Slides and the judging criterion each one serves

| # | Slide | Criterion |
|---|---|---|
| 1 | Title: "Your first 100 days, checked." | Demo, Product |
| 2 | The problem: $441 FSA, ~40% of car seats fixed, $20.4k first-year cost, 2026 rule changes | Impact |
| 3 | Maya's five places: gear + receipts, employer, IRS + MA, CPSC/FDA/NHTSA, deal fine print | Impact, Track 1 fit |
| 4 | Product: one screen, 4 card kinds, 3 phone slots | Product & UX |
| 5 | **Headline:** photo → data, shown as before and after (label → field table, receipt → 3 rows) | Innovation |
| 6 | One photo, four jobs (recall check, money back, Gear Locker, later runs), plus other ways data gets in | Innovation, Impact |
| 7 | Agent map (diagram) | Technical |
| 8 | How they talk: 3 channels + 6 real workspace notes | Technical, clear logs |
| 9 | Deals get a real argument: the offer 1318 debate with its rebuttal round, plus the safety gate, counter-question and send-back | Technical (agents challenge each other) |
| 10 | Loop 1: rulings and parent reports → case_law_proposals → H-MEM rules → Judge (diagram) + mem-28 proof | Innovation, Sponsor tech |
| 11 | Loop 2: Living Fine-Print Database → views → reuse, report card, public API (diagram) | Innovation, Impact |
| 12 | Zetaris: the current recall SQL + 5 roles ("without it: zero personalized cards") | Sponsor tech, what's unique |
| 13 | Meterless: 4 H-MEM roles + Nightshift; Scout Intent named as not used | Sponsor tech, what's unique |
| 14 | Stack + scoreboard 8/8, 0 false alarms, 100% sourced; tests; fails safe | Technical, reliability |
| 15 | Next: email receipts and barcode scanning (not built), pre-filled forms, open API, every state | Future |

## Claims checked against code or logs

- **Agent names and roles:** `bundle/server/agents/*.ts` (orchestrator, clawback, recall, benefits, eligibilityLawyer, finePrintCourt, newsroom, factChecker, coach). `MAX_OFFERS = 5` is in finePrintCourt.ts:14. The 300-second budget is in orchestrator.ts:303.
- **Note types** claim/question/answer/correction/verdict: workspace.ts:17. `MAX_REBUTTALS = 1`: newsroom.ts:21. `MAX_CORRECTION_ROUNDS = 2`: factChecker.ts:254. `safetyGate`: clawback.ts:148.
- **Real AI debate for offer 1318:** `bundle/logs/run-ava-1fcffa7e-1729-4c39-a47f-1dd23aadbc26.jsonl`, Oct 25 04:29 UTC. The Judge rejected, citing the $29.99/month membership. A rebuttal round followed and the Deal Hunter conceded. The outcome was "reject, disputed", and the grade was not saved.
  - The log does **not** record which AI provider answered, so the slide just says "AI on" and never says "Nemotron".
- **Workspace notes on slide 8:** `bundle/logs/run_bundle_ava-6d675925-….jsonl` (Oct 25 23:51), quoted word for word and trimmed. That run's court debate used the plain-code backup, so slide 8 shows the Clawback/Recall and Lawyer/Planner exchanges, not court quotes.
- **FactChecker send-back:** it has 0 lines in the saved logs. The slides say "tested, not yet seen in saved logs".
- **Confidence formula** `0.5 + 0.1 × reports, max 0.9`: coach.ts:58. Coach needs 2+ reports. The approve route is bundleRoutes.ts:516. The "Binding case law" prompt is finePrintCourt.ts:135.
- **Scoreboard:** 8/8 traps, 0 false alarms, 100% sourced, 3 runs, mem-28, 0 wrongly blocked. Source: `bundle/logs/scoreboard.json`. It ran in offline (practice) mode, and the slides say so.
- **Photo fields** (modelNumber, lotCode, upc, priceCents), the UPC check digit, and "every code must appear in the text the AI read": `ingest/photo.ts`.
  - Recorded answers are in `bundle/data/sample/vision-cache/*.json`: SAMPLE-1042, SMP-0315, UPC 0 12345 67890 5; receipt items $12.99, $8.49, $24.99, dated 2026-10-20.
  - The NHTSA list has 69 recalls: gearRecall.ts:2. The money-back check for receipts: photoRoutes.ts:73.
  - "Has: …" gear memory: photoRoutes.ts:104. Gear Locker route: photoRoutes.ts:124.
- **Recall SQL:** the `pairsSql` function in recall.ts:43. It reads v_purchase_items × CPSC UNION ALL FDA, matching on UPC, lot code or model number. The FactChecker's own question (`SELECT value_cents, max_age_days FROM bundle_pg.v_judge_offers WHERE id = 1318`) appears in the logs.
- **The offer_checks table** has no family column (`shared/schema.ts`). It saves "agreed" grades only (offerChecks.ts).
  - Public route: offerAuditRoutes.ts:87. The response is `{status, brands:[{store, offersChecked, offersCaught, catchRate,…}]}`.
  - OpenAPI file (a standard machine-readable description of the API): `bundle/docs/openapi/offer-audit.yaml`.
  - Report card and Audit-a-deal routes: offerRoutes.ts:78 and :91. "Another parent already checked this offer": AuditDeal.tsx:22.
- **Size of the fine-print database:** the recorded Zetaris answer `data/sample/zetaris-cache/78a2ecc5….json` has 12 offers, 7 brands, 7 caught. Per-brand counts were copied from it. Dollar averages are null, so no dollar figures are shown.
- **Stack:** React 18 and Express 4 (package.json). Provider order is Nightshift → NVIDIA (llm.ts:6). Tavily is used in liveSearch.ts. `explain.ts` throws away AI text that contains invented dollar figures.
- **Tests:** "1,194 pass / 0 fail" comes from the Oct 26 handoff note, not from a test run I did. It is marked to re-check.
- **Removed:**
  - the "[Stat]" placeholder (replaced with the BabyCenter $20.4k first-year cost from `research/research-boston-baby-benefits.html`)
  - bank card, Amazon and Plaid as data sources
  - the `amazon_orders` query
  - "argues over every claim" (now "checks every claim, argues over every deal")
  - the old 6/6 and mem-1 numbers
  - notes that wrongly said everything ran offline only
- **Renamed:** "Fine Print Court" is now "Fine Print" everywhere a parent would see it. The internal agent name FinePrintCourt appears once, on slide 7.

## Placeholders to fill in

Each one is a yellow dashed box (class `todo`) or has a `data-slot` / `data-update` tag in the HTML, so it is easy to find.

- `data-slot="screenshot-title"` (slide 1), plus `screenshot-onboarding`, `screenshot-results` and `screenshot-how-we-checked` (slide 4).
  - These still show Oct 23 screenshots. The Oct 23 onboarding screen shows "Connect a card / Upload Amazon orders", so **it must be replaced**.
- `data-update="photo-mfg-date"` (slide 5): the manufacture date row is marked "being added Oct 26".
- `data-update="photo-background-reading"` (slide 6): reading photos in the background is described as a design, not yet live.
- `data-update="offer-checks-row-count"` (slide 11): `[___] deals · [___] brands`. Fill this in after today's re-grading.
- `data-update="test-count"` (slide 14): re-run the tests and confirm 1,194.
- `data-update="demo-link"` (slide 15): add the tester link.
- **Not changed:** `outline.md` (the speaker notes) still describes the old 12 slides.

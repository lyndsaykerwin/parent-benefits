# Bundle: the plan in plain English (v3, round 4, Sat Oct 24, 2026)

A short version of the full plan, `bundle-plan-v3.md`. If the two ever disagree, the plan wins. Submission is due Tue Oct 27 at 23:45 UTC (7:45pm Boston); our target is 5pm Boston. **Only Lyndsay's decisions are written in as decided.** Every suggestion from an agent or research file is marked **open proposal** and lives in plan section 10.

## What Bundle is

A phone website for new parents in any US state who are expecting or whose baby just arrived. It shows one calm page: money they can get back, benefits with deadlines, safety recalls on things they bought, and deals that are truly worth it. Behind that page, a team of AI helpers (`agents`) looks things up, argues over tricky offers, and double-checks every number before a parent sees it. All data in the demo is made up.

## The headline idea: the Living Fine-Print Database (Strategy 2, decided, must-do)

**In one line:** the agents' own conclusions about offers become a new data source that Zetaris searches next to the government sources.

- **What gets saved.** Each time the Fact-Checker and the Fine Print Court judge an offer, they save one row to a table called `offer_checks` in our online database (`Neon`). (In the Court, a Deal Hunter argues for an offer, a Fine Print Lawyer argues against it, and a Judge rules.) A row holds the offer, its hidden strings ("$8 shipping", "renews at $29.99/month"), what it takes to claim it (account, app, mail-in, phone call, steps, minutes), the product's recall status and when that was checked, the value and score, the exact quote from the fine print, and a **fingerprint**: a short code made from the exact wording, so any change in wording is noticed (`fine_print_hash`). The table has **no family column**.
- **Stored as real rows, never loose files**, and added as a searchable source in Zetaris with its "add this table" command (`REGISTER DATASOURCE TABLE`).
- **Numbers come from code.** Code fills dollars, dates and yes/no flags. The AI fills only soft fields like the summary, and code checks them. Every dollar figure must appear in the quoted fine print or be computed from it.
- **Questions across two sources at once.** Example: "Which offers did our agents rate truly free, where the product hasn't been recalled since we checked?" This joins `offer_checks` with the live recall lists from the product-safety agency (`CPSC`) and the FDA's public data service (`openFDA`).
- **The automatic learning loop (needs no users):**
  1. Before grading a new offer, agents ask Zetaris what they already found about the same store, brand or wording, and use it. One finding becomes an answer for other offers.
  2. When an offer's fingerprint changes, it is checked again.
  3. When agents get one wrong (caught by a fine-print test or the Fact-Checker), that case becomes a new test.
- **Value Score for parents:** "Worth $40 after strings attached" instead of "20% off": true value (face value minus hidden costs), an effort badge (low/medium/high) and the list of catches. Effort is not turned into dollars, since that would need a made-up hourly rate.
- **Three verdicts:** approve, "approve with a catch" (`approve_with_catch`), reject. A code "reject" always beats an AI "approve." There are 12 fine-print tests (hidden shipping, expired, mail-in rebate, auto-renew, minimum purchase, fine print that tries to give the AI orders (`prompt injection`), and more) plus 3 good offers that must still pass.
- **The data product (decided, must-do):** one read-only web address, `GET /api/offer-audit?store=...`. It runs a fixed question against a saved Zetaris view with per-brand totals only (`v_offer_audit`: catch rate, true vs. advertised value, effort), caps requests per minute (`rate limit`), and ships with an **OpenAPI description**: the standard file that tells any program or AI agent how to use it. A test checks the answer never contains family fields. Estimate: 2–3 hours.
- **Pitch slide only:** selling this data, and "Points Guy"-style brand report cards (Strategy 3). No brand portal is built. A plug-in that lets AI agents use the tool (`MCP server`) comes later.

## Strategy 1: the Virtual Household Profile (decided: the existing Matcher, story told better)

Nothing is built differently. The Matcher asks Zetaris one question combining the family's stage, date and state with the rules and approved offers. The pitch line: *"Zetaris does the filtering, so the AI gets a short, already-checked list instead of the family's whole history: fewer tokens, lower cost, less room to make things up."* (A token is a small chunk of text; AI services charge per token.)

## Getting purchases in: three paths into one table (decided)

1. **Forward email receipts** to a Bundle address on the agents' **Agentmail** inbox (an email service whose inbox a program can read). Code keeps only item rows and throws away everything else (names, addresses, card digits, raw text), then deletes the email. A "Use sample receipts" button sends made-up receipts through the same reader.
2. **Scan a barcode** with the phone camera (`barcode-detector` library, which works on every phone), with a "type the numbers instead" backup. Product names come from Open Food Facts, then UPCitemdb, and every answer is saved.
3. **Take a photo** of an item's label, a formula can's bottom, or a paper receipt. An NVIDIA model that can read pictures (`vision model`) turns it into a row. Candidates: `nemotron-nano-12b-v2-vl`, `nemotron-3-nano-omni-30b-a3b-reasoning`, `nemotron-3.5-super-vl-120b-a12b`. The phone strips hidden location data (`EXIF`) first, the AI must reject photos showing people or addresses, and the photo is deleted right after reading.

All three land in one table, `purchase_items`, which Zetaris sees only through a safe-columns view (`v_purchase_items`) and joins with the live recall lists.

**The key finding (live feeds checked Oct 24):** model numbers, lot codes and barcode numbers usually hide in the recall *text*, not the official fields. CPSC's model-number field is empty in all 739 recalls since June 2025, but about 50 of 86 baby recalls write it in the description ("Model No.: RV001 is printed on a label under the walker's seat"). Only 22 of 739 fill in the barcode number (`UPC`). For formula, 31 of 42 FDA recalls list the UPC and 36 of 42 list lot codes (the batch number on the can). So a photo of a label or can bottom gives exact matches, and barcode works well for formula. Matching checks exact codes first (UPC, model number, lot code), then brand and product words.

**FDA recalls stay.** Only the 17 of 42 *finished* ones (`Terminated`) are filtered out, so no parent gets a scary card about a recall that ended years ago.

## Zetaris and the other sponsor tech

- **Zetaris** (required "data door"): one database question (`SQL`) reads several separate places at once. It stays the only way agents read data. Each helper gets its own filtered window (`privacy views`); the deal Judge never sees family data. Two places still read the database directly (family profile; the Coach reading reports); routing them through Zetaris is an open proposal. Without Zetaris, the app can't make a single personal card.
- **Meterless:** its memory engine (`H-MEM`) stores approved rules the Judge must cite. **Nightshift** (Meterless's app that turns Lyndsay's Mac into a private AI server) is the main AI route and hands hard steps to **NVIDIA Nemotron**.
- **Nightshift plan (decided):** all the code is built and tested in the cloud against a fake Nightshift server (already proven to work: it gets the right labels, cuts off stuck calls, refuses a wrong password, retries a server error). Lyndsay switches it on at her Mac later with the checklist in `cloud-build-assessment.md` §4. Live AI runs and the video happen only on the Mac; a fresh download replays saved answers (`SAMPLE_MODE=true`), and the README says so.
- **Parent feedback is not the focus** (no users at launch). The Coach and learning demo already built stay as they are.

## Onboarding (decided)

The **top row** of mocks: "We're expecting / Baby's here" (or "Try a sample family"), then the birthday or due date, then ZIP ("Found it: showing [State] programs plus federal ones"; uncovered states see "Support for your state's programs is coming soon"), then a "Checking" screen showing real agent steps. Then **Version B**: bottom tabs Home, Taxes, Savings, Insurance, Deals, with a **"+" on every tab** opening the three intake paths. Expecting families get the same tabs (Home leads with free gifts; deadlines say "starts at birth"). Light extras: an "I got this" tick, a small share bar, a "Save your list" card. Never the middle row.

## Build status and timeline

**Starting point:** the app runs end to end on made-up families with 268 tests passing; the Zetaris recall join already works. **Must-do list:** owner view split (agent internals behind a reviewer code), Nightshift code and real-AI rerun, any-state middle-class rules, the Living Fine-Print Database with `/api/offer-audit`, recall safety (finished-FDA filter and a "no false recall" test), onboarding, fresh evidence, and the three intake paths. **Honest hours:** about 75–90 hours of coding-agent work, against roughly 40 clock hours to Monday's 3pm Boston code freeze, with several agents working at once. The cut order is Lyndsay's call and is not set.

**Sat:** Nightshift code, new tables, owner view, any-state rules, recall safety. **Sun:** fine-print database, offer-audit endpoint, intake, onboarding; evening Nightshift switch-on at the Mac. **Mon:** Zetaris registration, real-AI rerun, 3pm freeze, video. **Tue:** final check, submit.

## Still open

Plan **section 10** lists 28 open proposals, none decided. Among them: how real each intake path is by Oct 27, which vision model is default, the Nightshift backup order and a Monday go/no-go, promoting the product-matching upgrade, where the money-back helper gets purchases, how to count Zetaris joins on slides, a new line for judges, and the cut order. Read section 10 before treating any of these as settled.

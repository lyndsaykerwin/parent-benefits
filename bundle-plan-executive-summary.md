# Bundle: the plan in plain English (v3, round 4b, Sat Oct 24, 2026)

A short version of the full plan, `bundle-plan-v3.md`. If the two ever disagree, the plan wins. Submission is due Tue Oct 27 at 23:45 UTC (7:45pm Boston); our target is 5pm Boston. **Only Lyndsay's decisions are written in as decided.** Every suggestion from an agent or research file is marked **open proposal** and lives in plan section 10.

## What Bundle is

A phone website for new parents in any US state who are expecting or whose baby just arrived. It shows one calm page: money they can get back, benefits with deadlines, safety recalls on things they bought, and deals that are truly worth it. Behind that page, a team of AI helpers (`agents`) looks things up, argues over tricky offers, and double-checks every number before a parent sees it. All data in the demo is made up.

## The headline idea: the Living Fine-Print Database (Strategy 2, decided, must-do)

**In one line:** the agents' own conclusions about offers become a new data source that Zetaris searches next to the government sources.

- **What gets saved.** Each time the Fact-Checker and the Fine Print Court judge an offer, they save one row to a table called `offer_checks` in our online database (`Neon`). (In the Court, a Deal Hunter argues for an offer, a Fine Print Lawyer argues against it, and a Judge rules.) A row holds the offer, its hidden strings ("$8 shipping", "renews at $29.99/month"), what it takes to claim it (account, app, mail-in, phone call, steps, minutes), the product's recall status and when that was checked, the value and score, the exact quote from the fine print, and a **fingerprint**: a short code made from the exact wording, so any change in wording is noticed (`fine_print_hash`). The table has **no family column**.
- **Stored as real rows, never loose files**, and added as a searchable source in Zetaris with its "add this table" command (`REGISTER DATASOURCE TABLE`).
- **Numbers come from code.** Code fills dollars, dates and yes/no flags. The AI fills only soft fields like the summary, and code checks them. Every dollar figure must appear in the quoted fine print or be computed from it.
- **Questions across two sources at once.** Example: "Which offers did our agents rate truly free, where the product hasn't been recalled since we checked?" This joins `offer_checks` with the live recall lists from the product-safety agency (`CPSC`) and the FDA's public data service (`openFDA`).
- **Value Score for parents:** "Worth $40 after strings attached" instead of "20% off": true value (face value minus hidden costs), an effort badge (low/medium/high) and the list of catches. Effort is not turned into dollars, since that would need a made-up hourly rate.
- **Three verdicts:** approve, "approve with a catch" (`approve_with_catch`), reject. A code "reject" always beats an AI "approve." There are 12 fine-print tests (hidden shipping, expired, mail-in rebate, auto-renew, minimum purchase, fine print that tries to give the AI orders (`prompt injection`), and more) plus 3 good offers that must still pass.
- **The data product (decided, must-do):** one read-only web address, `GET /api/offer-audit?store=...`. It runs a fixed question against a saved Zetaris view with per-brand totals only (`v_offer_audit`: catch rate, true vs. advertised value, effort), caps requests per minute (`rate limit`), and ships with an **OpenAPI description**: the standard file that tells any program or AI agent how to use it. A test checks the answer never contains family fields. Estimate: 2–3 hours.
- **Pitch slide only:** selling this data, and "Points Guy"-style brand report cards (Strategy 3). No brand portal is built. A plug-in that lets AI agents use the tool (`MCP server`) comes later.

## How the agents work together: the loops (decided by Lyndsay; plan section 1b)

Judges mark down agents that run once in a straight line and reward agents that check each other, send work back and try again. Lyndsay's goal: truly teamwork-based agents without a slow screen or a big AI bill. A **loop** means one agent's work goes back with a reason and comes back changed; every loop has a hard limit so it always ends.

- **Shared workspace ("bus"). PLANNED.** A shared whiteboard where Clawback Hunter, Recall Checker and Benefits Planner post ideas and questions; ideas go to the Fine Print Court, then the Fact-Checker. Today agents share one run context and trace log (`AgentContext`) but don't message each other.
- **Clawback Hunter ↔ Recall Checker (safety-value). PLANNED.** Before showing a price drop or rebate, ask "is this item recalled?"; if a real CPSC or FDA recall exists, the deal is killed before the Judge.
- **Benefits Planner ↔ Fine Print Lawyer (eligibility). PLANNED.** The Lawyer tries to disprove a benefit (timing, conditions, income caps) and sends back a counter-question ("ask Zetaris for X first").
- **Judge ↔ Fact-Checker (targeted correction), max 2 rounds. BUILT in basic form:** wrong cards already go back to whichever agent made them, with the reason and corrected values, and the Court re-judges (`orchestrator.ts` lines 225–261, `finePrintCourt.ts` lines 187–197). Line-by-line correction wording is planned.
- **Fine Print Court debate. BUILT, one round.** Deal Hunter for, Fine Print Lawyer against, Judge rules citing approved rules from memory (`case law`). No rebuttal round yet (open proposal).
- **Photo check. PLANNED.** Code checks what the vision model read (required fields, barcode check digit, code shape); one retry told what was wrong; then ask the parent for a close-up.
- **Recall check. PLANNED.** The Fact-Checker verifies each recall match against the recall record; no evidence, no alert.
- **Database loop. PLANNED (must-do).** When Judge and Fact-Checker agree, save the verdict to `offer_checks` with `status`, `confidence` and `rule_citations`. Next run, agents ask Zetaris first and skip offers already rejected by a rule that applies to everyone, or whose wording fingerprint hasn't changed. Parent taps raise or lower a `confidence_score`; below a set level the offer is debated again (Lyndsay's point; section 10 notes it pulls against "no users at launch", while the fingerprint re-check works without users). Misses become new tests.
- **Coach learning. BUILT, small.** Parent reports → proposed rule → owner approval → the Judge must use it next run.

**Keeping it fast (Lyndsay's design).** Live Zetaris runs have taken 13–171 seconds, and today each AI call stops at 20 seconds with no second try, and the feed appears only when the whole run ends. Her design: **show the last verified feed instantly** (from the saved results); a **1–2 second fast path** (simple rule checks, active recalls) **streams high-confidence cards** first, urgent recalls at once; the **deep loops keep running in the background** and push updates ("New savings verified!") using **server-sent events** (`SSE`, a one-way push from server to browser; `WebSockets`, a two-way live line, is the alternative); **status pills** ("Recall Checker cross-referencing CPSC feeds…"); background checks then add, update or remove cards. All planned; the "Checking" screen already shows real agent steps by asking the server once a second. **Speed limits behind the scenes:** round caps (corrections 2, photo retry 1, fixed debate rounds, 5 offers per run: built except the photo cap); a time limit plus one retry on every AI call and a 300-second limit per run (`RUN_DEADLINE_SECONDS`; planned, must-do); the four agents already run at the same time; Zetaris filters first so the AI gets short lists (built); skip the AI when a saved verdict still applies (planned); a fast model for the debate and a bigger one for the Judge (built); saved answers in sample mode (built).

## Strategy 1: the Virtual Household Profile (decided: the existing Matcher, story told better)

Nothing is built differently. The Matcher asks Zetaris one question combining the family's stage, date and state with the rules and approved offers. The pitch line: *"Zetaris does the filtering, so the AI gets a short, already-checked list instead of the family's whole history: fewer tokens, lower cost, less room to make things up."* (A token is a small chunk of text; AI services charge per token.)

## Getting purchases in: photo first (decided)

1. **Take a photo: the priority for the hackathon.** Photo of an item's label, a formula can's bottom, or a paper receipt. An NVIDIA model that can read pictures (`vision model`) turns it into a row, checked by the photo loop above. Candidates: `nemotron-nano-12b-v2-vl`, `nemotron-3-nano-omni-30b-a3b-reasoning`, `nemotron-3.5-super-vl-120b-a12b` (default is open). The phone strips hidden location data (`EXIF`) first, the AI must reject photos showing people or addresses, and the photo is deleted right after reading.
2. **Forward email receipts: kept for after the hackathon (Lyndsay's decision).** Design kept: receipts go to the agents' **Agentmail** inbox (an email service whose inbox a program can read); code keeps only item rows, throws away names, addresses, card digits and raw text, then deletes the email; a "Use sample receipts" button.
3. **Scan a barcode: kept for after the hackathon (Lyndsay's decision).** Design kept: `barcode-detector` library, a "type the numbers instead" backup, product names from Open Food Facts then UPCitemdb, every answer saved.

All paths land in one table, `purchase_items`, which Zetaris sees only through a safe-columns view (`v_purchase_items`) and joins with the live recall lists.

**The key finding (live feeds checked Oct 24):** model numbers, lot codes and barcode numbers usually hide in the recall *text*, not the official fields. CPSC's model-number field is empty in all 739 recalls since June 2025, but about 50 of 86 baby recalls write it in the description ("Model No.: RV001 is printed on a label under the walker's seat"). Only 22 of 739 fill in the barcode number (`UPC`). For formula, 31 of 42 FDA recalls list the UPC and 36 of 42 list lot codes (the batch number on the can). So a photo of a label or can bottom gives exact matches. Matching checks exact codes first (UPC, model number, lot code), then brand and product words.

**FDA recalls stay.** Only the 17 of 42 *finished* ones (`Terminated`) are filtered out, so no parent gets a scary card about a recall that ended years ago.

## Zetaris and the other sponsor tech

- **Zetaris** (required "data door"): one database question (`SQL`) reads several separate places at once. It stays the only way agents read data. Each helper gets its own filtered window (`privacy views`); the deal Judge never sees family data. Two places still read the database directly (family profile; the Coach reading reports); routing them through Zetaris is an open proposal. Without Zetaris, the app can't make a single personal card.
- **Meterless:** its memory engine (`H-MEM`) stores approved rules the Judge must cite. **Nightshift** (Meterless's app that turns Lyndsay's Mac into a private AI server) is the main AI route and hands hard steps to **NVIDIA Nemotron**.
- **Nightshift plan (decided):** all the code is built and tested in the cloud against a fake Nightshift server (already proven: it gets the right labels, cuts off stuck calls, refuses a wrong password, retries a server error). Lyndsay switches it on at her Mac with the checklist in `cloud-build-assessment.md` §4. Live AI runs and the video happen only on the Mac; a fresh download replays saved answers (`SAMPLE_MODE=true`), and the README says so.
- **Parent feedback is not the focus** (no users at launch). The Coach and learning demo already built stay as they are.

## Onboarding (decided)

The **top row** of mocks: "We're expecting / Baby's here" (or "Try a sample family"), then the birthday or due date, then ZIP ("Found it: showing [State] programs plus federal ones"), then a "Checking" screen showing real agent steps. Then **Version B**: bottom tabs Home, Taxes, Savings, Insurance, Deals, with a **"+" on every tab** opening "take a photo" (the other two paths join after the hackathon). Expecting families get the same tabs (Home leads with free gifts; deadlines say "starts at birth"). Light extras: an "I got this" tick, a small share bar, a "Save your list" card. Never the middle row.

**Confirmed gap answers (round 4b):** the Dependent Care FSA (a work benefit for paying childcare with pre-tax money) is a gentle "Check with your job" card with no dollar amount; sign-in is Google only (`Better Auth` on Neon); a state we don't cover yet shows "Support for your state's programs is coming soon".

## Build status and timeline

**Starting point:** the app runs end to end on made-up families with 268 tests passing; the Zetaris recall join and the send-back and debate loops already work. **Must-do list:** owner view split (agent internals behind a reviewer code), Nightshift code and real-AI rerun (with time limits and retries), any-state middle-class rules, the Living Fine-Print Database with `/api/offer-audit`, recall safety (finished-FDA filter and a "no false recall" test), onboarding, fresh evidence, **the photo intake path**, and **the agent loops and fast screen made real** (Lyndsay's design; hours not yet estimated). **Honest hours:** about 75–90 hours of coding-agent work before parking email and barcode (which saves roughly 14–17 hours), against roughly 40 clock hours to Monday's 3pm Boston code freeze, with several agents working at once. The cut order is Lyndsay's call and is not set.

**Sat:** Nightshift code with time limits, new tables, owner view, any-state rules, recall safety. **Sun:** fine-print database, offer-audit endpoint, photo intake with its check loop, the agent-to-agent loops and recall check, streaming cards and status pills, onboarding; evening Nightshift switch-on at the Mac. **Mon:** Zetaris registration, real-AI and vision rerun, a saved trace showing each loop, 3pm freeze, video. **Tue:** final check, submit.

## Still open

Plan **section 10** lists open proposals, none decided (item 1, intake, is now answered). Among them: which vision model is default, the Nightshift backup order and a Monday go/no-go, which Nemotron the Judge uses, promoting the product-matching upgrade, where the money-back helper gets purchases, how to count Zetaris joins on slides, a new line for judges, the cut order, and new in round 4b: a court rebuttal round, judging offers side by side, the photo check rules, an owner-view panel showing the loops, the agents' message format, the saved-verdict query, a cut order for the loop work, and two flags: the eligibility loop can't use job data (the work question is cut), so it must ask about state, dates and ZIP; and the safety loop uses only real CPSC and FDA recalls.

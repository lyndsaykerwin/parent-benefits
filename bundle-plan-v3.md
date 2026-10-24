# Bundle plan v3 (Fri Oct 23, 2026; updated Sat Oct 24, round 4)

Submission: Tue Oct 27, 23:45 UTC (7:45pm Boston; our target is 5pm Boston). Earlier versions are frozen in `plan-history/`: Oct 23 (`bundle-plan-v3-2026-10-24-before-update.md`), round 1 (`...-round1.md`), round 2 (`...-round2.md`) and round 3 (`...-round3.md`).

**How to read this plan.** Only Lyndsay's recorded decisions are written into the body. Every suggestion from an agent, a research file or a grading file sits in **section 10, "Open proposals for Lyndsay"**, and the body does not assume any of them. Where round 3 had written a suggestion in as if it were accepted, the round-2 wording is back.

Where her decisions are recorded: `TRACKING-oct24-plan-update.md` (rounds 1–2), `onboarding-design/gap-answers.md` (top "Lyndsay's decisions" block, Oct 24), `TRACKING-oct24-round4.md` (round-4 feedback, onboarding answers and "Lyndsay's correction").

## Round 4: what Lyndsay decided (Oct 24 evening)

1. **Strategy 2, the "Living Fine-Print Database", is a headline innovation and a must-do** (section 1).
2. **The data product:** the offer-grading data is served through one read-only web address, `GET /api/offer-audit`, with an OpenAPI description. This was decided in round 2 with no "if time" condition. It is a must-do and is in the timeline. Selling the data and "Points Guy"-style brand report cards (Strategy 3) are a pitch slide only, with no brand portal. MCP comes later.
3. **Strategy 1, the "Virtual Household Profile", is the existing Matcher, kept as it is.** The story is told better (section 2).
4. **Parent feedback is not the focus.** There are no users at launch. The Coach and learning demo already built stay as they are, but parent taps are not the main loop.
5. **Data comes in three ways:** forwarded email receipts, barcode scanning, and photos (of items or paper receipts) read by NVIDIA vision models. All three land in one purchase-items table (section 3). How real each path will be by Oct 27 is **not decided** (section 10).
6. **Plaid is out everywhere. The work-benefits question is cut everywhere.** Plaid is the service apps use to read bank and card purchases.
7. **FDA recalls stay.** Only *finished* ("Terminated") FDA recalls are filtered out, because a parent shouldn't get a scary card about a recall that ended years ago.
8. **Zetaris stays the only way agents read data.**
9. **Onboarding:** the top row of mocks, then Version B (bottom tabs). Never the middle row. Her answers on the "+" button, expecting families and the light checklist/share/save are in section 7.
10. **Nightshift:** all the code is built and tested in the cloud against a fake Nightshift server. Lyndsay switches it on at her Mac later (section 6, item 2).

Still standing from rounds 1–2 (`TRACKING-oct24-plan-update.md`): middle-class parents, not low-income (poverty, WIC, SNAP and Medicaid dropped); no Massachusetts hardcoding; deeper fine-print checks; no confidence-score bands; Neon (not Supabase) is the database; no Redis; never say "real-time"; Meterless = memory engines, not fine-print reading; store price feeds cut; brand audit = data only, no brand screens. From `gap-answers.md`: every US ZIP works, with "Support for your state's programs is coming soon"; the work question is dropped and the Dependent Care FSA becomes a gentle "Check with your job" card; accounts use Better Auth on Neon, Google only; bottom tabs with the 5 tabs in the mock.

---

## 1. Headline innovation: the Living Fine-Print Database (Strategy 2)

**The idea in one line:** the agents' own conclusions become a new data source that Zetaris searches alongside the government sources.

**What gets saved.** Every time the Fact-Checker and the Fine Print Court judge an offer, they save **one row per judged offer** to a Neon table called `offer_checks`. (The Fine Print Court is where the Deal Hunter argues for an offer, the Fine Print Lawyer argues against it, and the Judge rules. The original plan called this judging role the "Parent Panel".) A row holds:
- the offer;
- the **hidden strings** ("$8 shipping", "renews at $29.99/month");
- what it takes to claim: **sign-up and effort** (account, app, mail-in, phone call, steps, minutes);
- **recall status** of the product, and when that was last checked;
- the **value** and **score**;
- the **evidence quote** (the exact words from the fine print);
- the **fine-print fingerprint**, a short code computed from the exact wording, so any change in wording is noticed.

**No family data.** The table has no family column.

**It is stored as rows in Neon, never as loose JSON files.** (JSON is a machine-readable text format.) It is registered in Zetaris with `REGISTER DATASOURCE TABLE`, the Zetaris command that adds a table as a source it can search.

**Full field list** (kept from round 3; still **no family column**):
- **Identity:** `offer_id`, `store`, `source_url`, `fine_print_hash` (the wording fingerprint), `checked_at`, `agent`, `model`.
- **Money:** `face_value_cents`, `hidden_cost_cents`, `true_value_cents`, `min_purchase_cents`, `auto_renew`, `renewal_price_cents`.
- **Dates:** `deadline_date`, `expired`, `claim_window_days`, `payout_wait_days_max`.
- **Effort:** `steps_count`, `effort_level`, `effort_minutes_estimate`, plus yes/no flags such as `mail_in`, `needs_receipt`, `needs_phone_call`, `account_required`.
- **Availability:** `limited_stock`, `regions_excluded`.
- **Judgment:** `catch_types`, `verdict`, `catch_summary`, `evidence_quote`, `injection_detected`.
- **Added for Strategy 2 (Lyndsay's "recall status"):** `recall_status` (none found / open recall / finished), `recall_ids`, `recall_checked_at`.

Code fills the dollar amounts, dates and flags. The AI fills only the soft fields (summary, effort level), and code checks them. Every dollar figure must appear in the exact quoted fine print or be computed by code from it.

**Cross-source questions this makes possible.** These are questions that combine rows from two different places in one go:
- *"Which offers did our agents rate truly free, where the product hasn't been recalled since we checked?"* This joins `offer_checks` with the live CPSC and openFDA recall feeds. (CPSC is the Consumer Product Safety Commission. openFDA is the FDA's public data service. FDA recalls stay in; only finished ones are filtered out.)
- The Coach asks: *"Which fine-print problems show up most in 'Report issue' clicks?"* This joins `offer_checks` with the `feedback` table. (The Coach is the agent that suggests new rules from parent reports.)

**This is the plan's systematic feedback loop.** It runs automatically and needs no users:
1. **Before grading a new offer,** the agents ask Zetaris for past findings on the same store, the same brand or the same wording, and use them. A finding about one offer becomes an answer for the others.
2. **When an offer's wording fingerprint changes,** the offer is checked again.
3. **When the agents get one wrong** (caught by a fine-print test or the Fact-Checker), the case becomes a new test.

**Value Score (shown to parents):** "Worth $40 after strings attached" instead of "20% off". That is the true dollar value (face value minus hidden costs), an effort badge (low, medium or high) and the list of catches, with "How we scored this" in plain words. Effort is not turned into dollars, because that would need a made-up hourly rate.

**The data product (decided, must-do):** one read-only web address, `GET /api/offer-audit?store=...`. It runs a fixed query against the Zetaris view `v_offer_audit` (per-brand totals only: catch rate, average true vs. advertised value, average effort), is rate-limited (capped at a number of requests per minute), and uses saved answers in sample mode. It comes with an **OpenAPI description**, the standard file that tells any program or AI agent how to call it, plus a test that the answer never contains family fields. Protection rules are already designed in `architecture.md` (lines 368–372) and `research-matching-and-agent-api.md` (Question 2).

**Future (pitch slide only):** sell this data, and offer brand report cards in the style of "The Points Guy" (Strategy 3). There is no brand portal. An MCP server (the standard plug-in that lets AI agents use a tool) comes "later".

## 2. Strategy 1, the Virtual Household Profile: the existing Matcher, story told better

Nothing is built differently. The Matcher (the "front desk" in the original plan) asks Zetaris one question that combines the family's profile (stage, birth or due date, state) with the rules and approved offers. The pitch line:

> *"Zetaris does the filtering, so the AI gets a short, already-checked list instead of the family's whole history: fewer tokens, lower cost, less room to make things up."*

(A **token** is a small chunk of text. AI services charge by the token, and fewer tokens also means fewer chances for the AI to invent things.)

---

## 3. Getting purchases in: three paths into one table

Lyndsay's decision (round 4). Sources: `research-email-receipts.md`, `research-photo-barcode-intake.md`, `cloud-build-assessment.md`.

**The three paths:**
1. **Forward email receipts** to a Bundle address on the agents' existing **Agentmail** inbox. Agentmail is an email service that gives a program its own inbox it can read through code.
2. **Scan a barcode** with the phone camera.
3. **Take a photo** of an item (the label under a baby walker, the bottom of a formula can) or of a **paper receipt**. An NVIDIA vision model (an AI that can read pictures) turns it into a tidy row of facts.

**Vision models named in the research** (all on build.nvidia.com):
- `nvidia/nemotron-nano-12b-v2-vl`: built for receipts and labels.
- `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`: reads labels and understands the object. Turn "thinking" off.
- `nvidia/nemotron-3.5-super-vl-120b-a12b`: NVIDIA's newest big vision model, for messy photos. Announced Oct 15, 2026, and not yet tested by us.

Which one is the default is open (section 10).

**One table for everything: `purchase_items` in Neon.** It replaces the separate `receipt_items` table from round 3, so the "one structured purchase-items table" decision covers all three paths.
- Columns: `family_id`, `source` (`email`, `barcode`, `photo_item`, `photo_receipt`), `store`, `purchased_on`, `product_name`, `brand`, `model_number`, `lot_code`, `upc`, `size_text`, `price_cents`, `confidence`, `extractor`, `input_hash` (a fingerprint that stops the same receipt or photo being counted twice), `created_at`.
- It is registered in Zetaris behind a **safe-columns view**, `v_purchase_items`: a saved query that shows agents only the harmless columns.
- It is joined against the live CPSC and openFDA recalls (FDA recalls stay in; only finished ones are filtered out), and, as Lyndsay asked, against offers and benefit rules. The exact offer and benefit-rule queries are still to be designed.

**Key finding (research, live feeds checked Oct 24).** Model numbers and formula lot codes and UPCs live in the recall *text*, so photos of labels and can bottoms unlock exact matches. (A UPC is the 12-digit number under a barcode. A lot code is the batch number printed on a formula can.)
- **CPSC model numbers:** the official model-number field is empty in all 739 recalls since June 2025. But about 50 of the 86 baby recalls write the model number in the description, for example *"Model No.: RV001 is printed on a label under the walker's seat."* A photo of that label is what captures it.
- **CPSC UPCs:** only 22 of 739 recalls fill in the UPC field (1 of 86 baby recalls), so barcodes rarely match CPSC on their own.
- **openFDA formula recalls:** 31 of 42 write the UPC in the product description, and 36 of 42 list lot codes. So **barcode → formula recall** works well, and **photo of the can bottom → lot code → exact recall** is even more precise.
- **Finished FDA recalls:** 17 of the 42 formula recalls are finished ("Terminated") and are filtered out, so no parent gets a scary card about a recall that ended years ago.

**How matching uses this.** Exact codes are checked first: UPC, model number, then lot code, each a "contains this exact code" check that Zetaris can do. Brand and product-type words come second.

**Barcode, in brief.** A normal photo button opens the phone camera, and the `barcode-detector` library reads the code on every phone. iPhone Safari has no built-in reader turned on. There is always a "type the numbers instead" backup. Product lookups run from our server (Open Food Facts first, then UPCitemdb), and every answer is saved so the demo never depends on those services.

**Email, in brief** (`research-email-receipts.md`):
- Code keeps only item rows and throws the rest of each email away: raw text, addresses, names, phone numbers, card digits, tracking links. It also drops any email that isn't a receipt.
- Read emails are deleted from Agentmail.
- A "Use sample receipts" button feeds made-up receipts through the same reader, because the project rule is no real personal data.
- This replaces the "Upload Amazon orders" tile. The Amazon reader code stays, because the sample families load from it.
- Roadmap only: a guide for setting up a Gmail auto-forward rule. Full "Connect Gmail" waits, because Google classes inbox reading as "restricted", which needs a paid outside security review every 12 months.

**Photo privacy:**
- The phone strips hidden location data (EXIF, the hidden details inside every photo) and shrinks the photo before upload.
- The AI is sent only the photo, never family details, and must reject any photo showing people, faces or addresses.
- The photo is deleted right after reading. It never goes into a log, trace or Meterless memory.
- A "Forget my items" button deletes the family's rows.

**Effort from the research** (information, not a ranking):
- Email, sample version: 5.5–6.5 hours, plus 2–3 hours for the live inbox.
- Barcode: about 6–8 hours.
- Photos (item and receipt): about 9–12 hours.
- Tests for barcode and photos: 2–3 hours.
- Shared pieces (table, view, exact-code joins) are counted once.

Everything except real-phone camera checks, the first live model answers and the Zetaris registration can be built and tested in the cloud.

**Not decided:** how real each path is by Oct 27 (section 10).

---

## 4. What the parent sees vs. what the owner sees

| | Parent view (simple, calm; Version B bottom tabs) | Owner view ("Behind the scenes") |
|---|---|---|
| Headline | Home: money back, benefits you likely qualify for, deadlines, items safety-checked | Same, plus the scoreboard (traps caught, before vs. after learning, match accuracy, fine-print accuracy) |
| Cards | Title, amount, source links, a short "We checked this" line. Offers show a Value Score ("worth $40 after strings attached", effort badge, catches) | Same cards, plus the Zetaris data sources used for each |
| Purchases | A "+" button on every tab opens: forward receipts, scan a barcode, take a photo | Which item rows came from email, barcode or photo, and how sure each reader was |
| Recalls | "Recall alert" for confirmed matches, with a "Not mine" button. Each alert shows its evidence and what to check on the item | Every pair considered, including "considered and rejected" with the reason |
| Rejected items | "We caught these for you": a plain-language list of offers and claims we stopped, including expired offers | The Fine Print Court debate and Fact-Checker send-backs in full, plus the `offer_checks` rows and the past findings the agents used |
| Learning | Parents tap "I got this" (with $ claimed on Home) / "Report issue" | Meterless memory and case law, with the Approve button; proposed vs. approved rules |
| Proof | Nothing technical | Full trace of every agent step, including which AI provider and model actually answered |
| Access | Anyone | Reviewer code only (the existing reviewer token), shown to judges in the demo |

## 5. Where Zetaris does the work

Zetaris is the required "data door": one question in SQL (a database language) can read several separate data stores. Zetaris must join several real sources in one question. How to count and word the joins on slides is an open proposal (section 10).

| Helper | The question it asks Zetaris | What gets combined | Where you see it |
|---|---|---|---|
| Recall Checker | Which of this family's purchased items are on a recall list? | Item rows (sample orders + `purchase_items`, through `v_purchase_items`) + live CPSC and openFDA recall feeds (FDA recalls stay; only finished ones are filtered out) | Recall card; "We checked 7 items" |
| Fine-Print Database (Strategy 2) | What have we already found about this store, brand or wording? Which "truly free" offers' products haven't been recalled since we checked? | `offer_checks` + offers + live CPSC/openFDA recalls; for the Coach, `offer_checks` + `feedback`. No family data | Value Score; "We caught these"; `/api/offer-audit` |
| Matcher / Benefits Planner (Strategy 1) | Which programs and offers fit this family, by when? | Family profile + benefit rules (federal and state rows) + `tax_parameters` (IRS 2026: Child Tax Credit $2,200 per child; Dependent Care FSA $7,500) + `state_programs` (MA, NY, CA paid family leave) + full ZIP-to-state table | Taxes, Insurance and Home cards |
| Clawback Hunter | Which purchases are FSA-eligible or inside a store's price-drop window? | Today: card-style sample rows (`v_clawback_tx`) + FSA-eligible list + store policies. **Its purchase source depended on Plaid, which is now removed: open question** (section 10) | Savings "money back" cards |
| Fact-Checker | Is this exact dollar amount, date **and state** right? (asks a separate question) | Re-reads the source row, including its state | Blocks or sends back wrong cards, including a wrong-state card |
| Privacy views | — | Each helper gets its own filtered view (the deal Judge never sees family data; agents read `v_purchase_items`, never the raw table) | Owner view: "Data sources" per card |

**Two direct database reads (from `audit-round4.md` section A).** Every agent search goes through Zetaris, except two places where agent input is read from Neon directly:
1. The family profile, loaded in live mode (`server/agents/orchestrator.ts:48-55`).
2. The Coach reading parents' reports (`server/bundleStore.ts:76-79`).

Routing both through Zetaris is an open proposal (section 10).

**Honest note on sources:**
- CPSC and openFDA are live outside feeds (FDA recalls stay in; only finished ones are filtered out).
- Receipt, barcode and photo items are read from made-up inputs and copied into Neon.
- IRS and state leave figures are official numbers stored as rows with their source link and year, checked Oct 24 (`audit-ma-poverty-evals.md` section 2b). A person should confirm the MA leave figure on mass.gov before it goes on a slide.

Remove Zetaris and the app can't produce a single personal card. **Line for judges (round-2 wording, restored):** "Zetaris finds the candidate pairs across private and public data in one question; the AI decides the hard cases." (Zetaris has no built-in fuzzy matching, meaning it can't match "close enough" spellings.) A replacement line is an open proposal (section 10).

---

## 6. Technical plan (for the CTO)

**Starting point:**
- Repo `bundle/`, with 268 tests passing (8 skipped).
- `SAMPLE_MODE=true` is always offline by design.
- The Zetaris join of Neon with CPSC already works.
- The reviewer token already gates Approve.
- No Redis: agents write results to Neon and screens read from Neon.

**Ranking** (round 2, plus Lyndsay's round-4 decisions):
- **Must-do:**
  1. Owner view split.
  2. Nightshift code (built in the cloud) and the real-AI rerun.
  3. Any-state, middle-class rules.
  4. **Living Fine-Print Database:** fine-print tests, `offer_checks`, the feedback loop, the Value Score, the `v_offer_audit` view **and `GET /api/offer-audit` with its OpenAPI description**.
  5. Recall safety: the finished-FDA-recall filter and the `no_false_recall` test.
  6. Onboarding (top row + Version B).
  7. Regenerate evidence.
  8. Data intake, three paths. How real each path is by Oct 27 is open.
- **Should-do (round 2):** the product-matching upgrade (brand + product type + date and seller rules); onboarding extras.
- **Moved out in round 2:** NVIDIA embeddings for the memory; confidence-score bands (dropped by decision); no extra polish on the "Checking" screen.
- **Cut (recorded decisions):** Plaid; the work-benefits question; brand screens and brand portal; MCP server (pitch slide, "later"); store price feeds; Redis; poverty, WIC, SNAP and Medicaid; the middle row of mocks. Also carried from round 2: NeMo Guardrails (NVIDIA's add-on safety filter) and paid hosting.
- **Cut order: not decided — Lyndsay decides.**

**1. Owner view split** (must-do)
- **Goal:** the parent view shows only the tabs, cards, a one-line "We checked this" per card, and "We caught these for you". Everything agent-internal moves behind an owner entry point.
- **Key areas:** `client/`; the run/trace API in `server/` (a parent-safe response vs. the full one); the `x-reviewer-token` check.
- **Done when:** with no token, the API and UI never expose debate text, data-source names, memory rules, traces or Approve; with the token, all of those appear and Approve still works; a test checks the parent response has none of those fields; the learning loop (report twice, approve, run again, offer blocked) still passes end to end.
- **Risk:** leaks through the API. The parent response must be trimmed on the server, not just hidden in the screen.

**2. Nightshift → Nemotron: build in the cloud, switch on at the Mac** (must-do; Lyndsay's round-4 decision)
- **Goal:** real AI text for the court debate, explanations and Coach rules comes through Nightshift (Meterless's app that turns the Mac into a private AI server), which passes the hard steps to NVIDIA's Nemotron. Both sponsor rules are met: Nightshift is primary, NVIDIA contributes.
- **Built and tested in the cloud against a fake Nightshift server:**
  - the adapter in `server/adapters/llm.ts` (the file that talks to the AI service);
  - a fallback path to NVIDIA direct and to the saved offline text;
  - the timeout and retry fix: a hard stop on the whole call, one retry for timeouts and server errors, a bigger reply-length cap, and a whole-run time limit;
  - the `LIVE_MODEL` switch (real AI while Zetaris answers are replayed from saved files);
  - `model:check --provider nightshift|nvidia`;
  - scoreboard labels that name the provider and model.

  The fake server was proven on this machine (`cloud-build-assessment.md` §1): it receives the Nightshift labels, cuts off hung calls, returns "not allowed" for a wrong password, and retries a server error. Estimate: 4–5 hours.
- **The fallback order and a Monday go/no-go time are open proposals** (section 10). The code keeps the order as a setting.
- **Lyndsay switches it on at her Mac** using the flip-on checklist in `cloud-build-assessment.md` §4:
  - Nightshift setup steps A–F (`research-nightshift-setup.md` §2);
  - put `NIGHTSHIFT_TOKEN_FILE` in `.secrets/bundle.env.local`;
  - run `model:check` for both providers;
  - after Meterless's Sunday Oct 25 update, pin Nemotron and turn "thinking" off;
  - run `SAMPLE_MODE=true LIVE_MODEL=true npm run eval:live-model`.
- **Where it runs:** the cloud machine and any hosted site cannot reach the Mac, so live AI runs and the video happen on the Mac. A fresh download replays saved traces, and the README says so.
- **Done when:** the scoreboard names the provider and model that answered (or says honestly which one did); the run-1 and run-2 learning traces are saved; no call runs past its limit; every README and slide line about "offline" or "real model" matches what was run.
- **Risk:** the Sunday update could slip or rename settings (they are kept as settings, not built into the code); the score may drop and we report what it is.

**3. Any state, middle-class rules** (must-do; about half a day; `audit-ma-poverty-evals.md` sections 1c, 1d, 2)
- **Remove poverty/WIC:** delete the rule, the table, the query, the tests and the label; stop reading exact income.
- **New tables:** `tax_parameters` (IRS 2026 figures with year and link) and `state_programs` (MA, NY, CA paid family leave, plus the existing MA child credit), both registered in Zetaris.
- **Code never names a state.** Rule scope is "federal" or any 2-letter state, and card wording comes from a `plain_summary` column. Every 3-digit ZIP prefix is loaded. An uncovered state shows federal programs plus "Support for your state's programs is coming soon" (Lyndsay's wording, `gap-answers.md`). Never an error.
- **Work question cut (decided):** the Dependent Care FSA becomes a gentle "Check with your job" card for every family: no dollar amount, not in the total, never "your employer offers" (`gap-answers.md` decision 2). This replaces today's always-"yes" setting (`dcfsaOffered`). The employer box is removed.
- **New `state_agnostic` test** (replaces `non_ma_family`), with 5 fake families: Maya (MA), Ava (OH), Noor (NY), Cal (CA), Fern (FL). It checks that every card's rule is federal or the family's state, that federal cards match the date rules, that results are never empty, the swap test, a guard against "MA"/"Massachusetts" in agent code, and that the Fact-Checker blocks a planted wrong-state card. Also replace the WIC statistic on deck slide 2.

**4. Living Fine-Print Database and data product** (must-do; section 1)
- **New verdicts:** `approve`, `approve_with_catch` (worth it, but the parent sees the catch and the total counts only the true value), and `reject`. A code "reject" always overrides an AI "approve".
- **12 fine-print tests** (FP-01 to FP-12: shipping fee on "free", shipping costing more than the item, expired, about to expire, mail-in rebate, phone call and forms, auto-renew, minimum purchase, limited stock or regions, required account or app, true value after several strings, prompt injection), **plus 3 controls** that must still be approved (`audit-ma-poverty-evals.md` 3b).
- **Ohio fix:** FP-07 rejects the auto-renew trap for every family. Regenerate `output_examples/ava.json`. The learning demo moves to a subtler trap.
- **`offer_checks`:** the table and fields from section 1, written by the Fact-Checker and the Court, registered in Zetaris.
- **Feedback loop:** past findings looked up through Zetaris before grading; re-check when the fingerprint changes; misses become tests.
- **Value Score** on offers.
- **`v_offer_audit` and `GET /api/offer-audit` + OpenAPI:**
  - a fixed query and rate limit, with saved answers in sample mode;
  - a test that the response has no family fields;
  - estimate: 2–3 hours (`cloud-build-assessment.md` #15).
- **Scoreboard:** fine-print catches found / total, false alarms on controls, field accuracy.
- **Done when:**
  - the 12 tests and 3 controls pass offline (and are reported with real AI);
  - a run fills `offer_checks`;
  - Zetaris answers the "truly free and not recalled" question;
  - a second offer from the same store uses the first one's finding;
  - offers show a Value Score;
  - `/api/offer-audit` answers, with its OpenAPI file.

**5. Recall safety and product matching**
- **Must-do (about 2 hours):**
  - filter out finished ("Terminated") FDA recalls only, so a parent never gets a scary card about a recall that ended years ago (the FDA feed stays in);
  - add the `no_false_recall` test (Maya's run must not show CPSC 10490 or 10453);
  - run it offline and with real AI.
- **Product-matching upgrade (should-do, per round 2; promoting it is an open proposal):**
  - "Fields + hard rules": brand + product type from a fixed list, sale dates, seller, FDA status (finished recalls filtered out), and size or model clash, with an evidence line on each alert.
  - New for round 4: exact-code checks (UPC, model number, lot code) from barcode and photo items, checked first.
  - Test result to quote (`entity-resolution-test.md`): on fresh cases, **7 of 8 real recalls found, with 1 wrong alarm**. Today's matcher found 0 of 12 without AI and 2 of 12 with it.
  - Known fixes: "sold in April 2026" dates; "pad/liner/insert" in the type list.
  - Key areas: `server/agents/recall.ts`, `v_recall_orders` in `scripts/zetaris/register.ts`, `evals/expected.json`.
- **Plaid removal touches this:** `recall.ts:38` and `v_recall_orders` read card-style sample rows today. What happens to those sample rows is open (section 10).
- Formula recalls keep the "check the lot number on the can" line.

**6. Data intake** (section 3)
- **Shared pieces:**
  - the `purchase_items` table;
  - the `v_purchase_items` view;
  - the `v_recall_orders` change;
  - the exact-code joins;
  - the `register.ts` update.
- **Email:**
  - fake receipt emails in `bundle/data/sample/receipts/`;
  - the reader `server/ingest/emailReceipt.ts`, with per-store rules and an AI fallback that sees only item lines;
  - the "Use sample receipts" button;
  - privacy tests;
  - the live Agentmail inbox: polling (checking for new mail on a timer), an allowlist so only our own test address gets in, and delete after reading.
- **Barcode:**
  - a photo button with `barcode-detector`;
  - a type-it-in backup;
  - UPC check-digit validation;
  - server lookups with saved answers;
  - sample barcode images.
- **Photo:**
  - a `see()` method and a `MODEL_VISION` setting in `llm.ts`;
  - location-data stripping and shrinking on the phone;
  - the reject rule;
  - saved answers;
  - sample label photos and made-up receipt images.
- **Tests:** field accuracy, made-up rate (target 0), recall alerts right and caught, rejects (`research-photo-barcode-intake.md` §6).
- **Done when:**
  - each path that is built puts rows into `purchase_items`;
  - the recall check finds a planted recalled item through Zetaris, with its evidence line;
  - no name, address, raw email or photo is stored anywhere.
- **How real each path is: open (section 10).**

**7. Onboarding** (must-do; section 7). Key areas: `client/src/pages/Onboarding.tsx`, the Version B tab screens, and the run request in `server/routes/bundleRoutes.ts`. Estimates (`cloud-build-assessment.md`): top row 4–5 hours, Version B 5–7 hours.

**8. Regenerate evidence** (must-do)
- **What:** the scoreboard, saved examples and learning traces reflect the real model, the any-state rules, the fine-print tests, `offer_checks`, the intake paths built and the new views.
- **Key areas:** `npm run eval`, `eval:live-model`, `examples:regen`, `output_examples/`, `logs/`, README section 8.
- **Slides:**
  - Strategy 1 and 2 lines;
  - Strategy 3 / sell-the-data / MCP "later";
  - roadmap (Gmail auto-forward guide, "Connect Gmail", registry import);
  - Maya's money back is $48.99;
  - no WIC statistic.
- **Done when:**
  - the committed files match the README numbers;
  - all tests are green;
  - a clean copy with no keys still runs the sample.

**Zetaris saved answers.** Any new or changed Zetaris question needs one live recording run (with keys) before the offline replay can show it (`cloud-build-assessment.md` §2). Saved answers are never written by hand.

## 7. Onboarding (Lyndsay's decisions)

**Top row of mocks, then Version B. Never the middle row.**

**Top row (3 questions; progress "1 of 3", "2 of 3", "Last one"):**
1. **Main:** "We're expecting / Baby's here", plus "Try a sample family".
2. **Date:** the baby's birthday, or **the due date for expecting families** ("When's your baby due?"). The due date is in her mocks; the builder swaps the wording on the same screen.
3. **ZIP:** "Found it: showing [State] programs plus federal ones". Any US ZIP works, and an uncovered state gets "Support for your state's programs is coming soon".
4. **Checking:** the run's real agent steps. It then opens **Version B Home**, not the middle-row list ("Try a sample family" goes there too).

The Work screen is cut.

**Version B (bottom navigation: Home, Taxes, Savings, Insurance, Deals):**
- **Add purchases:** a **"+" button on every tab** opens the three intake paths (forward receipts, scan a barcode, take a photo).
- **Expecting families** get the same tabs, adjusted:
  - Home leads with free gifts;
  - deadlines say "starts at birth" instead of "10 days left".
- **Light versions of the middle-row extras:**
  - an "I got this" tick on cards, with "$ claimed" on Home;
  - a small share bar;
  - a "Save your list" card on Home.
- **Accounts:** Better Auth on Neon, Google only (`gap-answers.md` decision 3). How much real sign-in is built by Oct 27 is open.
- **Wording:**
  - The mock's Taxes tab shows the Dependent Care FSA as "Through work, 10 days left". It must use the decided "Check with your job" card instead (no dollars).
  - The big number's "cash" wording is an open proposal.

All numbers come from the real run, never typed into the page. Full screen spec: `onboarding-spec.md` (parts of it are out of date; see `onboarding-design/round4-mock-review.md` §3).

## 8. Timeline

**Honest hours vs. time left (information only, not a decision).**
- **Work estimate:** `cloud-build-assessment.md` puts the whole build at **about 75–90 hours of coding-agent work** (written before the photo research). The photo research then put barcode at 6–8 hours and photos at 9–12 hours, against that file's 4–6 hours each.
- **Time left:** many pieces are independent, so several agents can work at once. From Saturday evening to a Monday 3pm Boston code freeze is roughly 40 hours on the clock.
- **Mac-only:** the Nightshift switch-on, the real-AI rerun and the video need Lyndsay at the Mac.
- **Cut order: not decided — Lyndsay decides.**

| Day | What happens | Done when |
|---|---|---|
| Sat Oct 24 | **Lyndsay:** Nightshift setup steps A–F if possible; look at section 10. **Build (cloud):** Nightshift adapter + fake-server tests; local database setup with every new table (`purchase_items`, `offer_checks` with the Strategy 2 fields, `tax_parameters`, `state_programs`); owner view split; any-state rules + work-question cut + Plaid clean-up; recall safety (finished-FDA filter, `no_false_recall`) | Tests green; owner view behind the token; `state_agnostic` and recall tests pass; `offer_checks` table exists |
| Sun Oct 25 | **Build:** fine-print tests, verdicts, Value Score, feedback loop, `v_offer_audit`, **`GET /api/offer-audit` + OpenAPI**; intake shared pieces and the paths Lyndsay chooses; onboarding top row + Version B. **Sunday evening (Mac):** after the Nightshift update, flip-on checklist steps 1–8 (`cloud-build-assessment.md` §4) | Fine-print tests green; endpoint answers with no family fields; onboarding works on both paths; a first Nightshift trace names the provider and model |
| Mon Oct 26 | **Mac:** register new tables in Zetaris, record saved answers, real-AI rerun (`eval:live-model`), `examples:regen`. **Build:** evidence and README. **Code freeze 3pm Boston**, then a clean-copy rehearsal. Video in the evening, on the Mac | Scoreboard and traces saved with the real provider named; README matches files |
| Tue Oct 27 | Final fresh-download test; make the repo public; submit; target 5pm Boston | Ready before 23:45 UTC |

## 9. Not changing / out of scope, and keys

**Not changing:**
- Agents, Fact-Checker send-backs, Fine Print Court, the never-empty feed, the Receipt split, the learning loop and Coach (as built), Meterless memory (H-MEM, our required engine), trace logs, `POST /api/run`, `SAMPLE_MODE`.
- Firebase stays unused. Paid hosting: none; test locally (`render.yaml` stays for later).

**Out of scope:**
- No real inboxes, photos or personal data: receipts, barcodes and photos in the demo are made up or public, and the live inbox only accepts our own test address.
- Insurance and medical emails.
- Zetaris data-quality rules (the Fact-Checker's "no source" rule is the backstop).

**Keys:**

| Service | Status |
|---|---|
| Zetaris | Ready (Neon and live recall feeds connected) |
| Neon | Ready (the database; not Supabase) |
| Meterless Nightshift | On Lyndsay's Mac; setup in `research-nightshift-setup.md` §2; token location goes in `NIGHTSHIFT_TOKEN_FILE` |
| NVIDIA | Key available; inside Nightshift, and as `MODEL_API_KEY` for direct calls and vision models |
| Agentmail | The agents' existing account; key only in the git-ignored env file |
| Barcode lookups | Open Food Facts needs no key; UPCitemdb free trial is rate-limited |

Keys go only in the git-ignored env file (or inside Nightshift), never in the repo, slides or video.

---

## 10. Open proposals for Lyndsay

Nothing below is in the plan until you say yes. Each item gives a recommendation and why.

1. **How real each intake path is by Oct 27.** *Proposal:* build email forwarding plus "Use sample receipts" for real; barcode and photo work end to end on made-up sample items, labelled "Demo". *Why:* all three can be built and tested in the cloud, but barcode and photo add about 15–20 hours together (`research-photo-barcode-intake.md` §7).
2. **Live Agentmail inbox as the first email piece to drop if short on time.** *Proposal:* yes, keep "Use sample receipts" either way. *Why:* the sample version is the part judges can run without keys.
3. **Keep "seller" and quantity on item rows.** *Proposal:* keep seller. *Why:* the matcher's seller rule needs it, and it isn't personal data.
4. **Which NVIDIA vision model is the default.** *Proposal:* Nemotron 3 Nano Omni as the default, Nano 12B v2 VL for receipts, and try 3.5 Super VL as an upgrade. *Why:* Omni reads labels and objects and is tested by others; Super VL is 9 days old.
5. **Barcode: one photo, or also a live camera scanner.** *Proposal:* one photo first. *Why:* it works on every phone; the live scanner adds 1.5–2 hours and needs real-phone testing.
6. **Use CPSC recall-notice photos (credited) as sample item photos.** *Proposal:* yes. *Why:* they show the real "Model No" labels, and they are public government images, not personal data.
7. **Promote the product-matching upgrade from should-do to must-do.** *Proposal:* yes. *Why:* every intake path feeds it, and today's matcher finds 0 of 12 recalls without AI.
8. **What happens to the card-style sample rows now that Plaid is out.** The Clawback Hunter's money-back cards and today's recall view read them. *Proposal:* stop feeding them into recall matching, and point the Clawback Hunter at `purchase_items` for money back. *Why:* a bank line never names the product, so in recall matching it can only cause wrong alarms.
9. **Clawback money-back cards: their purchase source depended on Plaid (now removed).** *Proposal:* same as item 8, using receipt and photo item rows with prices. *Why:* without some purchase source the Savings tab's money-back cards go empty.
10. **Daycare demo and daycare invoice.** The daycare demo depended on a Plaid line, now removed. *Proposal:* drop the daycare-invoice card for the hackathon. *Why:* your FSA decision is a "Check with your job" card with no dollar amount, so an invoice adds little.
11. **Nightshift fallback order.** *Proposal:* Nightshift → NVIDIA Nemotron direct → saved offline text. *Why:* keeps NVIDIA in every real run and never leaves the demo blank.
12. **Monday 9am Boston go/no-go on Nightshift.** *Proposal:* yes; if Nemotron isn't answering through Nightshift by then, rerun with NVIDIA direct, labelled. *Why:* leaves time for the rerun and video before the 3pm freeze.
13. **Which Nemotron for the Judge.** *Proposal:* Nemotron 3 Super with "thinking" off. *Why:* slowness is our main AI failure.
14. **Route the two direct database reads through Zetaris** (family profile; the Coach's reports). *Proposal:* yes. *Why:* makes "Zetaris is the only way agents read data" fully true; the views and tables are already registered, so it's a small fix.
15. **Replace the judges' line "the AI decides the hard cases".** *Proposal:* "Zetaris finds candidate matches across private and public data in one question. Code rules make the safety decisions and show their evidence. The AI argues over fine print, explains, and fills gaps the rules can't, and code can overrule it." *Why:* in the design, rules decide alerts; a judge reading the code would spot the mismatch.
16. **How to count Zetaris joins on slides.** *Proposal:* name the real cross-source joins (purchases × live recalls; `offer_checks` × live recalls), plus per-helper views, rather than "four joins". *Why:* only questions that combine two different places count as cross-source; an exact count is safer with technical judges.
17. **Add open CPSC recalls per brand to `v_offer_audit`.** *Proposal:* yes if time (1–2 hours). *Why:* gives the brand report card a safety column.
18. **Parent taps feed Meterless memory confidence** ("I got this", "Report issue", "Not mine", "Returned it"). *Proposal:* a small add-on, not the main loop. *Why:* it shows the memory engine doing visible work for 1–2 hours, without depending on users.
19. **Set a cut order.** *Proposal:* decide Sunday midday, once coding agents have given estimates for the unestimated pieces. *Why:* the work exceeds the time; a known order beats cutting in a panic.
20. **Neon results table** (saved results survive a restart). *Proposal:* should-do. *Why:* the judges' default path is saved replay; no file estimates it.
21. **How much real Google sign-in to build for "Save your list"** (your recorded accounts decision). *Proposal:* get an estimate first; if over 3 hours, ship the Save card as a labelled demo. *Why:* `gap-answers.md` puts all four onboarding gaps at 12–16 hours.
22. **"Cash" wording in the big number.** *Proposal:* "savings and tax credits", plus a "How we got this number" link. *Why:* the $1,000 goes into an account and tax credits arrive next spring.
23. **Location pre-fill on the ZIP screen** (the mock says "Filled in from your location"). *Proposal:* the parent types a ZIP; at most a "Use my location" button. *Why:* avoids a browser permission box that needs its own explainer screen.
24. **Hosted site at all.** *Proposal:* stay local; GitHub, offline replay and the video are enough. *Why:* a host can't reach the Mac, and a public tunnel would expose the Nightshift token.
25. **Phone-camera testing.** *Proposal:* test barcode and photo with the Mac's webcam at `localhost`. *Why:* phones only allow the camera on secure pages, and a hosted site isn't decided.
26. **The "Parent Panel" name in Strategy 2.** *Proposal:* the Fine Print Court's Judge fills that role; don't build a separate panel. *Why:* the panel was never built, and the Court already saves the judgment.
27. **Year-one "what a middle-class family can get back" table in the repo.** *Proposal:* yes, short and sourced. *Why:* judges discount value claims without sources.
28. **NVIDIA embeddings stay out** (moved out in round 2 to make room for Plaid, which is now gone). *Proposal:* keep them out. *Why:* Nemotron and the vision models are NVIDIA's real jobs now.

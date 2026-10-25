# Bundle plan v3 (Fri Oct 23, 2026; updated Sat Oct 24, round 4c)

Submission: Tue Oct 27, 23:45 UTC (7:45pm Boston; our target is 5pm Boston). Earlier versions are frozen in `plans/old-versions/`: Oct 23 (`bundle-plan-v3-2026-10-24-before-update.md`), round 1 (`...-round1.md`), round 2 (`...-round2.md`) and round 3 (`...-round3.md`).

**How to read this plan.** Only Lyndsay's recorded decisions are written into the body. Every suggestion from an agent, a research file or a grading file sits in **section 10, "Open proposals for Lyndsay"**, and the body does not assume any of them. Where round 3 had written a suggestion in as if it were accepted, the round-2 wording is back.

Where her decisions are recorded: `progress/tracking/TRACKING-oct24-plan-update.md` (rounds 1–2), `design/onboarding/gap-answers.md` (top "Lyndsay's decisions" block, Oct 24), `progress/tracking/TRACKING-oct24-round4.md` (round-4 feedback, onboarding answers, "Lyndsay's correction", "round 4b" and "round 4c").

Section numbers are unchanged from round 4 so other files' references still work; the new loops section is numbered **1b**.

## Round 4c: what Lyndsay decided (Oct 24, latest)

1. **The newsroom loop is the visible feedback loop in this draft.** Like a newsroom: reporters (the maker agents) file, the editor (the Fact-Checker) checks, and the archive (`offer_checks`) shapes how the next story is written. The agents' detailed grade of every offer (how valuable it is, how long it takes to get that value, and the other grade fields) is saved to `offer_checks` and fed back, through Zetaris and Meterless memory, into how they grade the next offers (sections 1 and 1b).
2. **An offer is graded on its value and the time it takes to get that value; both together decide whether it is "worth your time".** The Value Score reads like "Worth $40 after strings attached · about 15 minutes · paid within 8 weeks" (section 1). This value-and-time grade replaces the per-offer "confidence score" from her loops feedback. The exact "worth your time" rule (any cut-off) is not decided: open proposal, section 10, item 42.
3. **Parent taps tuning confidence come later,** not in this draft's build (recorded as decided-later in section 10, item 34). Parent feedback is still not the focus.
4. **Monday 3pm Boston code freeze:** decided.
5. **The agent loops (section 1b) and the 300-second run limit are must-do:** decided.
6. **Skip offers whose wording fingerprint hasn't changed** (reuse the saved grade, no AI): decided.
7. **The job (work-benefits) question stays cut.**
8. **Building the new onboarding and the Version B screens from her mocks** (`design/onboarding/project/`: the top row, then the bottom row) **is a must-do build item** (section 6, must-do item 6 and detail item 7; section 7; timeline, Sunday).
9. **The newsroom loop does not supersede or demote the data product.** The same `offer_checks` rows feed both the agents' future grading and `v_offer_audit` + `GET /api/offer-audit` with its OpenAPI description (must-do, on Sunday's timeline); selling the data and "Points Guy" report cards stay a pitch slide (sections 1 and 1b).
10. **Nightshift's job is spelled out in plain English** (section 1b, "Nightshift's job"): Meterless's Mac app that is Bundle's AI switchboard, passing every AI question to NVIDIA's Nemotron with her key stored inside it; separate from Meterless memory (H-MEM). Unconfirmed setup details are marked there.

**Applied from her round-4c question** ("isn't Meterless memory supposed to handle the shared workspace and loops?"): Meterless's memory engine (H-MEM) becomes the agents' shared workspace and the newsroom loop's memory, while plain code still decides which agent goes next and enforces round caps and time limits (section 1b; findings in `research-meterless-workspace.md`).

## Round 4b: what Lyndsay decided (Oct 24, later)

1. **Photo first.** Taking a photo (of an item's label, a formula can's bottom, or a paper receipt) that an NVIDIA vision model turns into a tidy row of facts is **the priority way purchases get in for the hackathon**. Forwarded email receipts and barcode scanning are **not dropped**: they are **kept for after the hackathon (Lyndsay's decision)**, with their design left intact in sections 3 and 6 so she can return to them. This answers the old section 10 question "how real each path is by Oct 27".
2. **Three onboarding gap answers are confirmed decisions:** the Dependent Care FSA (a work benefit that lets parents pay childcare with pre-tax money) is a gentle "Check with your job" card; sign-in is Google only; an uncovered state shows "Support for your state's programs is coming soon".
3. **The agents' loops must be a visible, prominent part of the plan,** because the judges score agent teamwork with loops (section 1b), **and the loops must be kept fast** (section 1b, "Keeping the loops fast").
4. **Her agent-loops and latency design** (`plans/lyndsay-directives/lyndsay-feedback-agent-loops-latency.md`, binding): a shared workspace ("bus") between agents; three agent-to-agent loops (Clawback Hunter ↔ Recall Checker safety-value loop, Benefits Planner ↔ Fine Print Lawyer eligibility loop, Judge ↔ Fact-Checker targeted-correction loop, max 2); an instant saved feed, a 1–2 second fast path that streams high-confidence cards, deep loops in the background pushing updates, agent status pills and optimistic background checking; and the database loop (saved verdicts with `status`, `confidence`, `rule_citations`; Zetaris first; parent taps tune `confidence_score`). All in section 1b. *Updated in round 4c:* parent-tap tuning moves to later, and the saved per-offer `confidence` is replaced by the value-and-time grade (round 4c, items 2–3).

## Round 4: what Lyndsay decided (Oct 24 evening)

1. **Strategy 2, the "Living Fine-Print Database", is a headline innovation and a must-do** (section 1).
2. **The data product:** the offer-grading data is served through one read-only web address, `GET /api/offer-audit`, with an OpenAPI description. This was decided in round 2 with no "if time" condition. It is a must-do and is in the timeline. Selling the data and "Points Guy"-style brand report cards (Strategy 3) are a pitch slide only, with no brand portal. MCP comes later.
3. **Strategy 1, the "Virtual Household Profile", is the existing Matcher, kept as it is.** The story is told better (section 2).
4. **Parent feedback is not the focus.** There are no users at launch. The Coach and learning demo already built stay as they are, but parent taps are not the main loop.
5. **Data comes in three ways:** forwarded email receipts, barcode scanning, and photos (of items or paper receipts) read by NVIDIA vision models. All three land in one purchase-items table (section 3). *Updated in round 4b:* photo is the priority path for the hackathon; email and barcode are kept for after the hackathon.
6. **Plaid is out everywhere. The work-benefits question is cut everywhere.** Plaid is the service apps use to read bank and card purchases.
7. **FDA recalls stay.** Only *finished* ("Terminated") FDA recalls are filtered out, because a parent shouldn't get a scary card about a recall that ended years ago.
8. **Zetaris stays the only way agents read data.**
9. **Onboarding:** the top row of mocks, then Version B (bottom tabs). Never the middle row. Her answers on the "+" button, expecting families and the light checklist/share/save are in section 7.
10. **Nightshift:** all the code is built and tested in the cloud against a fake Nightshift server. Lyndsay switches it on at her Mac later (section 6, item 2).

Still standing from rounds 1–2 (`progress/tracking/TRACKING-oct24-plan-update.md`): middle-class parents, not low-income (poverty, WIC, SNAP and Medicaid dropped); no Massachusetts hardcoding; deeper fine-print checks; no confidence-score bands; Neon (not Supabase) is the database; no Redis; never say "real-time"; Meterless = memory engines, not fine-print reading; store price feeds cut; brand audit = data only, no brand screens. From `gap-answers.md` (confirmed again in round 4b): every US ZIP works, with "Support for your state's programs is coming soon"; the work question is dropped and the Dependent Care FSA becomes a gentle "Check with your job" card; accounts use Better Auth on Neon, Google only; bottom tabs with the 5 tabs in the mock.

---

## 1. Headline innovation: the Living Fine-Print Database (Strategy 2)

**The idea in one line:** the agents' own conclusions become a new data source that Zetaris searches alongside the government sources.

**What gets saved.** Every time the Fact-Checker and the Fine Print Court judge an offer, they save **one row per judged offer** to a Neon table called `offer_checks`. (The Fine Print Court is where the Deal Hunter argues for an offer, the Fine Print Lawyer argues against it, and the Judge rules. The original plan called this judging role the "Parent Panel".) A row holds:
- the offer;
- the **hidden strings** ("$8 shipping", "renews at $29.99/month");
- what it takes to claim: **sign-up and effort** (account, app, mail-in, phone call, steps, minutes);
- **recall status** of the product, and when that was last checked;
- the **grade**: the true **value** after strings attached and the **time to get that value** (effort minutes, steps, wait for the payout, claim window);
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

**This is the plan's systematic feedback loop: "the newsroom loop"** (named in round 4c; the visible loop in this draft; section 1b). It runs automatically and needs no users:
1. **Before grading a new offer,** the agents ask Zetaris for past grades on the same store, the same brand or the same wording (true value, effort minutes, steps, payout wait, claim window, catches) and recall the matching grading lessons from Meterless memory (section 1b). A finding about one offer becomes an answer for the others: if this store's last mail-in rebates took about 15 minutes and paid within 8 weeks, the new one starts from that and the agents check what differs.
2. **When an offer's wording fingerprint changes,** the offer is checked again. If it hasn't changed, the saved grade is reused and the AI is skipped (decided, round 4c).
3. **When the agents get one wrong** (caught by a fine-print test or the Fact-Checker), the case becomes a new test.

**One set of rows, two jobs (Lyndsay, round 4c: the newsroom loop does not replace or demote the data product).** The same `offer_checks` rows feed **both**:
- **the newsroom loop**: the agents' future grading (above, and section 1b); and
- **the data product** (decided, must-do, on Sunday's timeline): the Zetaris view `v_offer_audit` and the read-only `GET /api/offer-audit` with its OpenAPI description (below). Selling the data and "Points Guy"-style brand report cards stay a pitch slide.

**Value Score (shown to parents): the value and the time to get it (Lyndsay, round 4c).** An offer is graded on two things, and **both together decide whether it is worth your time**:
- **Value:** the true dollar value after strings attached (`true_value_cents`, face value minus hidden costs).
- **Time to get that value:** the parent's effort (`effort_minutes_estimate`, `steps_count`), the wait for the money (`payout_wait_days_max`) and how long they have to claim it (`claim_window_days`).

Example: **"Worth $40 after strings attached · about 15 minutes, 3 steps · paid within 8 weeks"** instead of "20% off", with the list of catches, an effort badge (`effort_level`: low, medium or high) and "How we scored this" in plain words. All these fields are already in `offer_checks`. Time is shown next to the value, not turned into dollars (that would need a made-up hourly rate). The rule for when an offer counts as "not worth your time" (any cut-off) is **not decided**: open proposal, section 10, item 42. A range such as "paid in 6–8 weeks" would need a new shortest-wait field (also item 42).

**The data product (decided, must-do):** one read-only web address, `GET /api/offer-audit?store=...`. It runs a fixed query against the Zetaris view `v_offer_audit` (per-brand totals only: catch rate, average true vs. advertised value, average effort), is rate-limited (capped at a number of requests per minute), and uses saved answers in sample mode. It comes with an **OpenAPI description**, the standard file that tells any program or AI agent how to call it, plus a test that the answer never contains family fields. Protection rules are already designed in `plans/architecture.md` (lines 368–372) and `research/research-matching-and-agent-api.md` (Question 2).

**Future (pitch slide only):** sell this data, and offer brand report cards in the style of "The Points Guy" (Strategy 3). There is no brand portal. An MCP server (the standard plug-in that lets AI agents use a tool) comes "later".

## 1b. How the agents work together: the loops

**Lyndsay's decisions** (round 4b, plus her agent-loops and latency feedback in `plans/lyndsay-directives/lyndsay-feedback-agent-loops-latency.md`, which is binding). Her goal, in her words: *truly agentic* (agents negotiate, hand work to each other, cross-examine and refine offers in feedback loops) **without ruining speed, how responsive the screen feels, or AI spend**. That means moving from a straight-line pipeline to an **event-driven, multi-tier** design: agents react to messages from each other ("event-driven"), and quick checks run first while deeper checks run behind them ("multi-tier").

**Why it matters for scoring:** the judges mark down agents that "run once in a straight line" (A passes to B, B passes to C) and reward agents that "loop, critique, retry, branch and revise" (`strong-submission-examples.md` §3 and §14, `weak-submission-examples.md` lines 168, 645 and 704, `hackathon-overview.md` line 114 "No feedback loops"). The re-grade credits our Fact-Checker send-back loop by name (`progress/reviews/regrade-2026-10-24.md` lines 61 and 133). A **loop** here means one agent's output goes back to another agent (or the same one) with a reason, and the result changes because of it. Every loop has a hard cap on rounds so it always ends.

### The agent network and its shared workspace

- **Shared workspace ("bus"), Lyndsay's design, held in Meterless memory (round 4c).** A shared memory and state area that every agent reads and writes during a run, like a team whiteboard. Clawback Hunter, Recall Checker and Benefits Planner post **candidate ideas** ("this item may be owed $12 back") to it; they go to the **Fine Print Court** (Deal Hunter, Fine Print Lawyer, Judge), then to the **Fact-Checker**, the cross-examiner. Agents also post questions to each other on it (the loops below).
- **Which parts Meterless does, and which are plain code** (answering Lyndsay's round-4c question "isn't Meterless memory supposed to handle these?"; details in `research-meterless-workspace.md`):
  - **Meterless H-MEM is the whiteboard. PLANNED.** Every message an agent posts (a claim, question, answer, correction or verdict) is saved as an H-MEM note for that run, with its `source` (which agent, which evidence), the engine's own trust number (`confidence`, 0 to 1) and the item it is about. Agents read the notes about their item before acting. H-MEM's guide is written for this ("a Planner agent's decision is retrievable by a Verifier agent"). Every note also lands in H-MEM's append-only audit log (the "trust ledger", a log nothing is deleted from), already exported each run to `logs/ledger-<run>.jsonl`, so judges can see who said what and why.
  - **Meterless H-MEM also holds the newsroom loop's grading lessons** across runs (see "The newsroom loop" below). **PLANNED.**
  - **Plain code (the orchestrator, the code that runs the agents in order)** decides which agent works next, delivers each question to the right agent, enforces the round caps and the 300-second run limit, and pushes updates to the screen. No Meterless engine routes messages or keeps time.
  - **Hard numbers stay in Neon, read through Zetaris.** H-MEM holds notes and lessons; dollars, minutes and days live in `offer_checks`, so Zetaris stays the only way agents read data.
  - **Speed:** H-MEM runs inside our own server and matches notes without an AI call, so it adds milliseconds, not seconds. Left out of the run to stay fast: H-MEM's AI-based note extraction and its between-run "dreaming" and "sleep" jobs (they add AI calls; dreaming between runs is an open proposal, section 10, item 43). Not used: the Markovian engine (for very long single tasks; our AI steps are short) and the World Model engine (it overlaps with Zetaris + `offer_checks`).
- **What is built today:** H-MEM is in the code (copied in under its open-source licence in `bundle/vendor/hmem/`, wrapped by `server/adapters/memory.ts`) and does one job: approved rules ("case law") the Judge must cite (`finePrintCourt.ts` line 87). Its "was this note right?" feedback is built and tested (`memory.test.ts`) but no agent calls it yet. Every agent already shares one run context (`AgentContext` in `bundle/server/agents/types.ts` lines 13–24: the family, the Zetaris connection, the AI, Meterless memory and one shared trace log), and the Court posts its rejected offers to a shared list (`ctx.blocked`). There is **no message passing between agents yet**: the orchestrator passes work along (`orchestrator.ts` lines 208–261). **Status of the workspace: PLANNED** (the message format is an open proposal, section 10, item 37).

**Nightshift's job (separate from Meterless memory).** Nightshift is Meterless's free Mac app that acts as Bundle's **AI switchboard**. Every AI question the agents ask (the court arguments, the Judge's ruling, explanations, the Coach's rule wording) goes to one address on Lyndsay's Mac (`http://127.0.0.1:8088/v1`). Nightshift passes the hard questions to **NVIDIA's Nemotron** models, using Lyndsay's NVIDIA key, which is stored **inside Nightshift** (never in our code). That makes Nightshift the "primary AI provider" the Meterless rule asks for, and puts NVIDIA to work in the same request. It is a **different thing from Meterless memory (H-MEM)**: Nightshift answers AI questions; H-MEM stores what the agents learned (approved rules, shared findings, grading lessons). In the cloud, the code talks to a **stand-in Nightshift** (a fake server used for tests); Lyndsay switches the real one on at her Mac (section 6, item 2). If Nightshift doesn't answer, Bundle falls back to NVIDIA directly, then to saved offline text (the order is an open proposal, section 10, item 11). **Not yet confirmed** (`research-nightshift-setup.md`, section 6 "Unconfirmed"): the exact menu for adding the NVIDIA key, the Mac folder that holds Nightshift's password file (`proxy-token`), how to pin one exact Nemotron model and turn "thinking" off (Meterless said this arrives Sunday), whether replies name the real model that answered, and the NVIDIA credit amount and rate limit.

### The loops, and how real each one is (code checked Oct 24)

**Lyndsay's three agent-to-agent loops:**

1. **Clawback Hunter ↔ Recall Checker: the safety-value loop. PLANNED.**
   - Before publishing a price drop or rebate on an item, the Clawback Hunter asks the Recall Checker: "Any active flags on this item?"
   - If a CPSC or FDA recall exists on it, the deal is **killed before it reaches the Judge**, with the reason "do not encourage buying or claiming a rebate on this item".
   - It uses only real CPSC and openFDA recall records (see the section 10 note). Finished FDA recalls are already filtered out.
   - Today the two agents don't talk: `clawback.ts` never looks at recalls.
2. **Benefits Planner ↔ Fine Print Lawyer: the eligibility loop. PLANNED.**
   - The Planner sends a benefit's terms to the Fine Print Lawyer, who **tries to disprove eligibility** (timing, conditions, income caps).
   - If it finds a condition, the benefit goes back to the Planner with a **counter-question**, for example "ask Zetaris for X before approving". The Planner asks Zetaris and either confirms or drops the benefit.
   - Which counter-questions are allowed with the data we have is flagged in section 10 (the work question is cut).
   - Today the Lawyer only argues about offers (`finePrintCourt.ts` lines 71–84); `benefits.ts` never calls it.
3. **Judge ↔ Fact-Checker: the targeted-correction loop. BUILT (basic form); targeted wording PLANNED.**
   - Instead of just dropping a card, the Fact-Checker sends a **specific correction** back to the Court ("math mistake on line 2: recalculate the net savings"); the Court re-runs with that error added; **at most 2 rounds**, then the card is dropped.
   - **Built:** the general send-back loop already does this for every agent, including the Court: a wrong card goes back with the reason and the corrected values (`orchestrator.ts` lines 225–261, `checkOne`; `MAX_RETRIES` default 2), and the Court re-argues and re-judges with the reason added (`finePrintCourt.ts` lines 187–197). Each round is a `send_back` line in the trace.
   - **Planned:** the line-by-line correction wording, and letting a corrected offer come back as "approve with a catch" (today the Court's re-judge keeps only "approve").

**Other loops** (4, 5 and 9 kept from before; 6 is Strategy 2, the newsroom loop; 7 and 8 are open proposals):

4. **Fact-Checker send-back for every agent. BUILT.** As in loop 3, for all four maker agents (Clawback Hunter, Recall Checker, Benefits Planner, Fine Print Court). A card that **couldn't be checked** (source down) is never sent back: it gets one retry after a 1.5-second pause, then is dropped with an honest banner.
5. **Fine Print Court debate. BUILT (one round).** Deal Hunter argues for, Fine Print Lawyer argues against, and the Judge reads both plus the **case law** (approved rules recalled from Meterless memory) and rules, citing the rule ids it relied on; if the AI answer is missing or badly shaped, a code screen applies the case law (`finePrintCourt.ts` lines 71–119). **Checked: there are no rebuttal rounds today**; adding one is an open proposal (section 10, item 29).
6. **The newsroom loop (Living Fine-Print Database). PLANNED (must-do; the visible feedback loop in this draft; details in "The newsroom loop" below).**
7. **Photo intake loop. PLANNED; open proposal (added by an agent in round 4b, not in Lyndsay's feedback; section 10, item 40).** The photo path itself is her round-4b priority.
   - The vision model reads the photo and returns fields (product name, brand, model number, lot code, UPC, size, price).
   - **Code checks the fields:** required fields are present; a UPC has 12 digits and a correct check digit (the last digit that proves the others were read right); a model number or lot code looks like a code, not a sentence; every value appears in what the model says it read. (Exact limits: section 10, item 32.)
   - If a check fails, the vision model is **asked again once, told exactly what was wrong**. **At most 1 retry.**
   - If still unclear, the parent is asked for a **clearer photo or a specific close-up** ("the label under the seat", "the bottom of the can").
8. **Recall verification loop. PLANNED; open proposal (added by an agent in round 4b; section 10, item 41).** The Recall Checker proposes a match; the Fact-Checker checks it against the recall record (the exact code or the recall's words); missing evidence sends it back, inside the same 2-round cap; no evidence, no alert.
9. **Coach / learning loop. BUILT (small).** Parent "Report issue" taps → the Coach proposes a rule when 2 or more reports share a theme (`coach.ts` lines 57–63) → the owner approves → the rule goes into Meterless memory → next run the Judge must cite it. Proven by `server/__tests__/sampleMode.test.ts`.

### The newsroom loop (the database loop: Lyndsay's point 3, with `offer_checks` from section 1; named and made the visible loop in round 4c)

Like a newsroom: the maker agents file, the Fact-Checker edits, and the archive (`offer_checks`) shapes how the next offer is graded. It needs no users.

1. **Saved grading. PLANNED (must-do).** When the Judge and the Fact-Checker **agree**, the full grade is written to the Neon table `offer_checks`: the `verdict` and `status`, `rule_citations` (the case-law ids the Judge cited), and the **value-and-time grade** (`true_value_cents`, `effort_minutes_estimate`, `steps_count`, `payout_wait_days_max`, `claim_window_days`), with the catches and the other section 1 fields. *Round 4c:* this grade replaces the per-offer `confidence` score from her loops feedback. Nothing else needs a per-offer confidence; the only trust number left is H-MEM's own rating of each grading lesson (item 3), which the engine uses to rank lessons and is never shown to parents.
2. **Ask Zetaris first. PLANNED (must-do).** The next run's agents query Zetaris before reasoning. An offer rejected for Family A by a **universal rule** (one that doesn't depend on the family, like "auto-renews into a paid plan") is skipped for Family B, with no AI debate needed. An offer whose wording fingerprint is unchanged reuses its saved grade (decided, round 4c); a changed fingerprint means a fresh check.
3. **Grades feed the next grading. PLANNED (must-do).** Before the Court grades a new offer, it gets (a) past grades for the same store, brand or kind of catch from `offer_checks` through Zetaris (for example, "this store's mail-in rebates: about 15 minutes, paid within 8 weeks") and (b) the matching **grading lessons** from Meterless H-MEM. After each saved grade, one short lesson is added to H-MEM, pointing at its `offer_checks` row. When the Fact-Checker confirms or corrects a grade, the lessons that were used get H-MEM's "helpful" or "wrong" feedback (built into the engine), so their trust number rises or falls and better lessons come first next time. The trace shows which past grades and lessons were used for each offer.
4. **Misses become tests. PLANNED (must-do).** When the agents get one wrong (caught by a fine-print test or the Fact-Checker), the case becomes a new test.

**Later (decided in round 4c, not in this draft's build):** parent taps ("I got this" / "Report issue") tuning a confidence number, with a fresh Court debate below a set level (her point 3.3).

**The same rows also feed the data product (round 4c).** The newsroom loop does not replace or demote it: the `offer_checks` rows the agents learn from are the same rows behind the Zetaris view `v_offer_audit` and the read-only `GET /api/offer-audit` with its OpenAPI description (decided, must-do, on Sunday's timeline; section 1). Selling the data and "Points Guy"-style brand report cards stay a pitch slide.


### The loops in one picture (words only)

```
 Photo ─> Vision model ─> code checks fields ─fail─> vision model again (max 1) ─still unclear─> "closer photo, please"
                                │ pass
                                v
                        purchase_items
                                │
 Zetaris FIRST: saved verdicts in offer_checks? ──yes, universal rule / same fingerprint──> reuse, skip the AI
                                │ no
                                v
 ┌─────── shared workspace ("bus") in Meterless H-MEM ───────┐
 │ Clawback Hunter ⇄ Recall Checker   (recall? kill the deal) │
 │ Benefits Planner ⇄ Fine Print Lawyer (counter-question ->  │
 │                                       ask Zetaris)         │
 └──────────────────────────┬────────────────────────────────┘
                            v
       Fine Print Court: Deal Hunter (for) vs Fine Print Lawyer (against) -> Judge (cites case law)
                            v
       Fact-Checker ──wrong──> targeted correction back to the maker / Court (max 2) ──> dropped
                            │ agree
                            v
       Card streams to the parent  +  offer_checks row (verdict, rule_citations, value + time grade)
                            │
       NEWSROOM LOOP: past grades (Zetaris) + grading lessons (Meterless H-MEM) -> grading the next offer
       Fact-Checker confirms / corrects -> the lessons used are marked helpful / wrong in H-MEM
       (later, not this draft: parent taps tune a confidence number)
       "Report issue" -> Coach -> owner approves -> Meterless memory -> Judge's case law
```

### Keeping the loops fast (Lyndsay's latency design, plus the speed limits already in the plan)

**The problem:** loops mean more AI calls, and slowness is our main AI failure. Live Zetaris runs have taken **13 to 171 seconds** with occasional errors (`plans/architecture.md` line 204 and line 426); in the one real-AI run the Judge timed out or broke format 4 of 5 times (`progress/reviews/regrade-2026-10-24.md` line 61; `plans/plan-grade-future-state.md` risk 3). Today each AI call stops at **20 seconds** (a setting borrowed from the data sources) and **gets no retry after a timeout** (`research-nightshift-setup.md` §3a; `llm.ts` line 132). Today's screen asks the server for progress once a second and shows the whole feed only when the run ends (`client/src/pages/Feed.tsx` lines 105–126); finished results are kept in the server's memory only (lost on restart) and in the browser tab (`client/src/lib/bundle.ts` lines 283–296).

**Lyndsay's design: show something instantly, then improve it in the background.**

| Layer | What the parent sees | Status |
|---|---|---|
| **Instant saved feed (under 0.1 s)** | The last verified feed appears at once, from the last run's write-back to Neon (read through Zetaris) | **Planned.** Today only the same browser tab can re-show a finished run |
| **Fast-path swarm (1–2 s)** | Single-pass rule checks and active recalls run first and **stream "high confidence" cards** onto the screen; a high-priority recall alert is pushed at once | **Planned** |
| **Deep loops in the background** | The Court debate, Fact-Checker retries and the Zetaris write-back keep running; results arrive as live updates ("New savings verified!") | **Planned.** Delivery by **server-sent events (SSE)**, a one-way push from server to browser over a normal web connection: preferred, because updates only flow one way and it needs no extra server. **WebSockets** (a two-way live connection) is the alternative |
| **Progressive card streaming** | Cards appear one by one as each finishes, most urgent first | **Planned** |
| **Agent status pills** | Small live labels: "Recall Checker cross-referencing CPSC feeds…", "Fine Print Lawyer examining FSA eligibility terms…", "Judge checking H-MEM memory…" | **Partly built:** the "Checking" screen already shows real agent steps from the trace, polled once a second (`Feed.tsx`). The pill wording and live push are planned |
| **Optimistic background checking** | Saved cards show first; background checks then add, update or remove cards (an "optimistic" screen shows the likely answer first and corrects it if needed) | **Planned.** Safety rule from the plan still holds: a recall alert is shown only after its evidence is checked |

**Speed limits behind the scenes:**

| Measure | Status |
|---|---|
| **Hard caps on rounds:** send-back / targeted correction max 2; photo retry max 1; debate rounds fixed (one today); max 5 offers go to court per run (`MAX_OFFERS`, `finePrintCourt.ts` line 8) | Send-back and offer caps **built**; photo cap **planned, open proposal** (section 10, item 40); rebuttal round open (section 10, item 29) |
| **Time limit on every AI call, plus one retry** for timeouts and server errors (`NIGHTSHIFT_TIMEOUT_SECONDS` 180, `MODEL_TIMEOUT_SECONDS` 90) | **Planned** (must-do, section 6 item 2). Zetaris calls already have a time limit and one retry for their known hiccup (`orchestrator.ts` lines 156–166) |
| **Time budget for the whole run:** after 300 seconds, remaining AI steps use saved offline text and say so (`RUN_DEADLINE_SECONDS`) | **Planned** (must-do, decided in round 4c; section 6 item 2) |
| **Agents run at the same time:** the four maker agents run side by side and one failing never stops the rest; the Fact-Checker checks 4 cards at a time | **Built** (`orchestrator.ts` lines 208–213 and 262–273). Inside the Court, offers are still judged one after another (section 10, item 30) |
| **Zetaris filters first,** so the AI gets a short, already-checked list | **Built** (Strategy 1, section 2) |
| **Skip the AI when nothing changed:** reuse an `offer_checks` verdict when the fingerprint is unchanged or a universal rule already rejected the offer | **Planned** (newsroom loop, must-do; the fingerprint skip decided in round 4c) |
| **Shared workspace in Meterless H-MEM costs milliseconds:** it runs inside our server and matches notes without an AI call; H-MEM's AI-based extraction, dreaming and sleep stay out of the run | **Planned** (section 1b, workspace) |
| **Small fast model for simple steps, bigger model for the Judge:** the debate arguments already ask for the "fast" model (`finePrintCourt.ts` line 77); the Judge uses the "reasoning" model | **Built.** Which Nemotron the Judge uses is open (section 10, item 13) |
| **Saved answers in sample mode:** `SAMPLE_MODE=true` replays recorded Zetaris answers and offline text | **Built** |


## 2. Strategy 1, the Virtual Household Profile: the existing Matcher, story told better

Nothing is built differently. The Matcher (the "front desk" in the original plan) asks Zetaris one question that combines the family's profile (stage, birth or due date, state) with the rules and approved offers. The pitch line:

> *"Zetaris does the filtering, so the AI gets a short, already-checked list instead of the family's whole history: fewer tokens, lower cost, less room to make things up."*

(A **token** is a small chunk of text. AI services charge by the token, and fewer tokens also means fewer chances for the AI to invent things.)

---

## 3. Getting purchases in: three paths into one table

Lyndsay's decision (round 4), with the priority set in round 4b. Sources: `research-email-receipts.md`, `research-photo-barcode-intake.md`, `progress/reviews/cloud-build-assessment.md`.

**The three paths:**
1. **Take a photo: the PRIORITY path for the hackathon (round 4b).** A photo of an item (the label under a baby walker, the bottom of a formula can) or of a **paper receipt**. An NVIDIA vision model (an AI that can read pictures) turns it into a tidy row of facts, checked by code in the photo intake loop (section 1b, loop 4).
2. **Forward email receipts: kept for after the hackathon (Lyndsay's decision).** Receipts go to a Bundle address on the agents' existing **Agentmail** inbox. Agentmail is an email service that gives a program its own inbox it can read through code. The design below stays intact.
3. **Scan a barcode: kept for after the hackathon (Lyndsay's decision).** The phone camera reads the barcode. The design below stays intact.

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

**Barcode, in brief (kept for after the hackathon).** A normal photo button opens the phone camera, and the `barcode-detector` library reads the code on every phone. iPhone Safari has no built-in reader turned on. There is always a "type the numbers instead" backup. Product lookups run from our server (Open Food Facts first, then UPCitemdb), and every answer is saved so the demo never depends on those services.

**Email, in brief** (kept for after the hackathon; `research-email-receipts.md`):
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
- Photos (item and receipt): about 9–12 hours. **Hackathon priority.** If Lyndsay approves the photo intake loop (open proposal, section 10, item 40), its field checks and one retry are part of this.
- Email, sample version: 5.5–6.5 hours, plus 2–3 hours for the live inbox. *After the hackathon.*
- Barcode: about 6–8 hours. *After the hackathon.*
- Tests for barcode and photos: 2–3 hours (the photo share is in scope now).
- Shared pieces (table, view, exact-code joins) are counted once, and are needed for photos.

Everything except real-phone camera checks, the first live model answers and the Zetaris registration can be built and tested in the cloud.

**Decided (round 4b):** photo first; email and barcode kept for after the hackathon, design intact.

---

## 4. What the parent sees vs. what the owner sees

| | Parent view (simple, calm; Version B bottom tabs) | Owner view ("Behind the scenes") |
|---|---|---|
| Headline | Home: money back, benefits you likely qualify for, deadlines, items safety-checked | Same, plus the scoreboard (traps caught, before vs. after learning, match accuracy, fine-print accuracy) |
| Cards | Title, amount, source links, a short "We checked this" line. Offers show a Value Score (value and time: "worth $40 after strings attached · about 15 minutes · paid within 8 weeks", effort badge, catches) | Same cards, plus the Zetaris data sources used for each |
| Purchases | A "+" button on every tab opens "take a photo" for the hackathon; forward receipts and scan a barcode are kept for after the hackathon | Which item rows came from which path, how sure the reader was, and any photo retries or "clearer photo" requests (loop 4) |
| Recalls | "Recall alert" for confirmed matches, with a "Not mine" button. Each alert shows its evidence and what to check on the item | Every pair considered, including "considered and rejected" with the reason |
| Rejected items | "We caught these for you": a plain-language list of offers and claims we stopped, including expired offers | The Fine Print Court debate and Fact-Checker send-backs in full (the loops of section 1b), plus the `offer_checks` rows and the past findings the agents used |
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

**Two direct database reads (from `progress/reviews/audit-round4.md` section A).** Every agent search goes through Zetaris, except two places where agent input is read from Neon directly:
1. The family profile, loaded in live mode (`server/agents/orchestrator.ts:48-55`).
2. The Coach reading parents' reports (`server/bundleStore.ts:76-79`).

Routing both through Zetaris is an open proposal (section 10).

**Honest note on sources:**
- CPSC and openFDA are live outside feeds (FDA recalls stay in; only finished ones are filtered out).
- Receipt, barcode and photo items are read from made-up inputs and copied into Neon.
- IRS and state leave figures are official numbers stored as rows with their source link and year, checked Oct 24 (`progress/reviews/audit-ma-poverty-evals.md` section 2b). A person should confirm the MA leave figure on mass.gov before it goes on a slide.

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
  4. **Living Fine-Print Database:** fine-print tests, `offer_checks`, the newsroom loop, the Value Score (value and time to get it), the `v_offer_audit` view **and `GET /api/offer-audit` with its OpenAPI description**.
  5. Recall safety: the finished-FDA-recall filter and the `no_false_recall` test.
  6. **Onboarding + Version B screens, built from Lyndsay's mocks** (`design/onboarding/project/`: the top row of onboarding questions, then the bottom row's Version B tabs; never the middle row). Confirmed must-do in round 4c; details in item 7 below and section 7.
  7. Regenerate evidence.
  8. Data intake: **the photo path first** (round 4b), with the shared pieces (the photo intake loop is an open proposal, section 10 item 40). Email forwarding and barcode are kept for after the hackathon (Lyndsay's decision), not must-do.
  9. **The agent loops, visible and fast** (section 1b, Lyndsay's design): the shared workspace (in Meterless H-MEM); her three agent-to-agent loops; the newsroom loop (the photo and recall loops are open proposals, section 10 items 40–41); the fast screen (instant saved feed, fast-path streaming, background updates by server-sent events, status pills, optimistic checking); and the speed limits (per-call time limit and retry and the 300-second run budget (must-do, decided in round 4c) are already in item 2; the `offer_checks` skip is in item 4). Hours for this are **not yet estimated**.
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

  The fake server was proven on this machine (`progress/reviews/cloud-build-assessment.md` §1): it receives the Nightshift labels, cuts off hung calls, returns "not allowed" for a wrong password, and retries a server error. Estimate: 4–5 hours.
- **The fallback order and a Monday go/no-go time are open proposals** (section 10). The code keeps the order as a setting.
- **Lyndsay switches it on at her Mac** using the flip-on checklist in `progress/reviews/cloud-build-assessment.md` §4:
  - Nightshift setup steps A–F (`research-nightshift-setup.md` §2);
  - put `NIGHTSHIFT_TOKEN_FILE` in `.secrets/bundle.env.local`;
  - run `model:check` for both providers;
  - after Meterless's Sunday Oct 25 update, pin Nemotron and turn "thinking" off;
  - run `SAMPLE_MODE=true LIVE_MODEL=true npm run eval:live-model`.
- **Where it runs:** the cloud machine and any hosted site cannot reach the Mac, so live AI runs and the video happen on the Mac. A fresh download replays saved traces, and the README says so.
- **Done when:** the scoreboard names the provider and model that answered (or says honestly which one did); the run-1 and run-2 learning traces are saved; no call runs past its limit; every README and slide line about "offline" or "real model" matches what was run.
- **Risk:** the Sunday update could slip or rename settings (they are kept as settings, not built into the code); the score may drop and we report what it is.

**3. Any state, middle-class rules** (must-do; about half a day; `progress/reviews/audit-ma-poverty-evals.md` sections 1c, 1d, 2)
- **Remove poverty/WIC:** delete the rule, the table, the query, the tests and the label; stop reading exact income.
- **New tables:** `tax_parameters` (IRS 2026 figures with year and link) and `state_programs` (MA, NY, CA paid family leave, plus the existing MA child credit), both registered in Zetaris.
- **Code never names a state.** Rule scope is "federal" or any 2-letter state, and card wording comes from a `plain_summary` column. Every 3-digit ZIP prefix is loaded. An uncovered state shows federal programs plus "Support for your state's programs is coming soon" (Lyndsay's wording, `gap-answers.md`). Never an error.
- **Work question cut (decided):** the Dependent Care FSA becomes a gentle "Check with your job" card for every family: no dollar amount, not in the total, never "your employer offers" (`gap-answers.md` decision 2). This replaces today's always-"yes" setting (`dcfsaOffered`). The employer box is removed.
- **New `state_agnostic` test** (replaces `non_ma_family`), with 5 fake families: Maya (MA), Ava (OH), Noor (NY), Cal (CA), Fern (FL). It checks that every card's rule is federal or the family's state, that federal cards match the date rules, that results are never empty, the swap test, a guard against "MA"/"Massachusetts" in agent code, and that the Fact-Checker blocks a planted wrong-state card. Also replace the WIC statistic on deck slide 2.

**4. Living Fine-Print Database and data product** (must-do; section 1)
- **New verdicts:** `approve`, `approve_with_catch` (worth it, but the parent sees the catch and the total counts only the true value), and `reject`. A code "reject" always overrides an AI "approve".
- **12 fine-print tests** (FP-01 to FP-12: shipping fee on "free", shipping costing more than the item, expired, about to expire, mail-in rebate, phone call and forms, auto-renew, minimum purchase, limited stock or regions, required account or app, true value after several strings, prompt injection), **plus 3 controls** that must still be approved (`progress/reviews/audit-ma-poverty-evals.md` 3b).
- **Ohio fix:** FP-07 rejects the auto-renew trap for every family. Regenerate `output_examples/ava.json`. The learning demo moves to a subtler trap.
- **`offer_checks`:** the table and fields from section 1, written by the Fact-Checker and the Court, registered in Zetaris.
- **The newsroom loop:** past grades looked up through Zetaris and grading lessons recalled from Meterless H-MEM before grading; the Fact-Checker's confirm or correct marks those lessons helpful or wrong; skip unchanged fingerprints, re-check changed ones; misses become tests.
- **Value Score** on offers: value and time to get it ("worth $40 after strings attached · about 15 minutes · paid within 8 weeks").
- **`v_offer_audit` and `GET /api/offer-audit` + OpenAPI:**
  - a fixed query and rate limit, with saved answers in sample mode;
  - a test that the response has no family fields;
  - estimate: 2–3 hours (`progress/reviews/cloud-build-assessment.md` #15).
- **Scoreboard:** fine-print catches found / total, false alarms on controls, field accuracy.
- **Done when:**
  - the 12 tests and 3 controls pass offline (and are reported with real AI);
  - a run fills `offer_checks`;
  - Zetaris answers the "truly free and not recalled" question;
  - a second offer from the same store uses the first one's grade (value, minutes, payout wait), and the trace shows which past grades and H-MEM lessons were used;
  - offers show a Value Score with both value and time;
  - `/api/offer-audit` answers, with its OpenAPI file.

**5. Recall safety and product matching**
- **Must-do (about 2 hours):**
  - filter out finished ("Terminated") FDA recalls only, so a parent never gets a scary card about a recall that ended years ago (the FDA feed stays in);
  - add the `no_false_recall` test (Maya's run must not show CPSC 10490 or 10453);
  - run it offline and with real AI.
- **Product-matching upgrade (should-do, per round 2; promoting it is an open proposal):**
  - "Fields + hard rules": brand + product type from a fixed list, sale dates, seller, FDA status (finished recalls filtered out), and size or model clash, with an evidence line on each alert.
  - New for round 4: exact-code checks (UPC, model number, lot code) from barcode and photo items, checked first.
  - Test result to quote (`research/entity-resolution-test.md`): on fresh cases, **7 of 8 real recalls found, with 1 wrong alarm**. Today's matcher found 0 of 12 without AI and 2 of 12 with it.
  - Known fixes: "sold in April 2026" dates; "pad/liner/insert" in the type list.
  - Key areas: `server/agents/recall.ts`, `v_recall_orders` in `scripts/zetaris/register.ts`, `evals/expected.json`.
- **Plaid removal touches this:** `recall.ts:38` and `v_recall_orders` read card-style sample rows today. What happens to those sample rows is open (section 10).
- Formula recalls keep the "check the lot number on the can" line.

**6. Data intake** (section 3). **Order (round 4b): shared pieces and Photo now; Email and Barcode kept for after the hackathon (Lyndsay's decision), designs kept below unchanged.**
- **Shared pieces:**
  - the `purchase_items` table;
  - the `v_purchase_items` view;
  - the `v_recall_orders` change;
  - the exact-code joins;
  - the `register.ts` update.
- **Email (kept for after the hackathon):**
  - fake receipt emails in `bundle/data/sample/receipts/`;
  - the reader `server/ingest/emailReceipt.ts`, with per-store rules and an AI fallback that sees only item lines;
  - the "Use sample receipts" button;
  - privacy tests;
  - the live Agentmail inbox: polling (checking for new mail on a timer), an allowlist so only our own test address gets in, and delete after reading.
- **Barcode (kept for after the hackathon):**
  - a photo button with `barcode-detector`;
  - a type-it-in backup;
  - UPC check-digit validation;
  - server lookups with saved answers;
  - sample barcode images.
- **Photo (PRIORITY, round 4b):**
  - a `see()` method and a `MODEL_VISION` setting in `llm.ts`;
  - location-data stripping and shrinking on the phone;
  - the reject rule;
  - **the photo intake loop** (section 1b, loop 7; open proposal, section 10 item 40): code checks on the fields (required fields, UPC check digit, model-number and lot-code shape, values found in the label text), one retry to the vision model with what was wrong, then a "clearer photo / close-up of the label or can bottom" request to the parent;
  - saved answers;
  - sample label photos and made-up receipt images.
- **Tests:** field accuracy, made-up rate (target 0), recall alerts right and caught, rejects (`research-photo-barcode-intake.md` §6), plus a test that a bad first reading triggers exactly one retry and then the "clearer photo" request.
- **Done when:**
  - the photo path puts rows into `purchase_items` (and, after the hackathon, each other path that is built);
  - the recall check finds a planted recalled item through Zetaris, with its evidence line;
  - no name, address, raw email or photo is stored anywhere.
- **How real each path is: decided in round 4b (photo first).**

**7. Onboarding + Version B UI** (must-do, confirmed in round 4c; section 7). Built from Lyndsay's mocks in `design/onboarding/project/`: the top row first, then the bottom row (Version B). Key areas: `client/src/pages/Onboarding.tsx`, the Version B tab screens, and the run request in `server/routes/bundleRoutes.ts`. Estimates (`progress/reviews/cloud-build-assessment.md`): top row 4–5 hours, Version B 5–7 hours.

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

**Zetaris saved answers.** Any new or changed Zetaris question needs one live recording run (with keys) before the offline replay can show it (`progress/reviews/cloud-build-assessment.md` §2). Saved answers are never written by hand.

## 7. Onboarding (Lyndsay's decisions)

**Top row of mocks, then Version B. Never the middle row.**

**Top row (3 questions; progress "1 of 3", "2 of 3", "Last one"):**
1. **Main:** "We're expecting / Baby's here", plus "Try a sample family".
2. **Date:** the baby's birthday, or **the due date for expecting families** ("When's your baby due?"). The due date is in her mocks; the builder swaps the wording on the same screen.
3. **ZIP:** "Found it: showing [State] programs plus federal ones". Any US ZIP works, and an uncovered state gets "Support for your state's programs is coming soon".
4. **Checking:** the run's real agent steps. It then opens **Version B Home**, not the middle-row list ("Try a sample family" goes there too).

The Work screen is cut.

**Version B (bottom navigation: Home, Taxes, Savings, Insurance, Deals):**
- **Add purchases:** a **"+" button on every tab** opens the intake paths: "take a photo" for the hackathon; forward receipts and scan a barcode are kept for after the hackathon (round 4b).
- **Expecting families** get the same tabs, adjusted:
  - Home leads with free gifts;
  - deadlines say "starts at birth" instead of "10 days left".
- **Light versions of the middle-row extras:**
  - an "I got this" tick on cards, with "$ claimed" on Home;
  - a small share bar;
  - a "Save your list" card on Home.
- **Accounts:** Better Auth on Neon, Google only (`gap-answers.md` decision 3, confirmed in round 4b). How much real sign-in is built by Oct 27 is open.
- **Wording:**
  - The mock's Taxes tab shows the Dependent Care FSA as "Through work, 10 days left". It must use the decided "Check with your job" card instead (no dollars).
  - The big number's "cash" wording is an open proposal.

All numbers come from the real run, never typed into the page. Full screen spec: `plans/onboarding-spec.md` (parts of it are out of date; see `design/onboarding/round4-mock-review.md` §3).

## 8. Timeline

**Honest hours vs. time left (information only, not a decision).**
- **Work estimate:** `progress/reviews/cloud-build-assessment.md` puts the whole build at **about 75–90 hours of coding-agent work** (written before the photo research). The photo research then put barcode at 6–8 hours and photos at 9–12 hours, against that file's 4–6 hours each. With email and barcode moved to after the hackathon (round 4b), roughly 14–17 hours of intake work leave the hackathon build; the loop and speed work in section 1b adds some back (not yet estimated).
- **Time left:** many pieces are independent, so several agents can work at once. From Saturday evening to the Monday 3pm Boston code freeze (decided, round 4c) is roughly 40 hours on the clock.
- **Mac-only:** the Nightshift switch-on, the real-AI rerun and the video need Lyndsay at the Mac.
- **Cut order: not decided — Lyndsay decides.**

| Day | What happens | Done when |
|---|---|---|
| Sat Oct 24 | **Lyndsay:** Nightshift setup steps A–F if possible; look at section 10. **Build (cloud):** Nightshift adapter + fake-server tests, including the per-call time limit, one retry and the 300-second run budget (section 1b, "Keeping the loops fast"); local database setup with every new table (`purchase_items`, `offer_checks` with the Strategy 2 fields, `tax_parameters`, `state_programs`); owner view split; any-state rules + work-question cut + Plaid clean-up; recall safety (finished-FDA filter, `no_false_recall`) | Tests green; owner view behind the token; `state_agnostic` and recall tests pass; `offer_checks` table exists |
| Sun Oct 25 | **Build:** fine-print tests, verdicts, Value Score, the newsroom loop (grades saved to `offer_checks` and fed back through Zetaris and Meterless H-MEM; the skip for unchanged fingerprints and universal rules), Lyndsay's three agent-to-agent loops and the shared workspace in H-MEM, the fast screen (saved feed, streaming cards by server-sent events, status pills), `v_offer_audit`, **`GET /api/offer-audit` + OpenAPI**; intake shared pieces and **the photo path** (its intake loop only if Lyndsay approves proposal 40; email and barcode kept for after the hackathon); the recall verification loop (only if she approves proposal 41); **onboarding top row + Version B screens from her mocks (must-do)**. **Sunday evening (Mac):** after the Nightshift update, flip-on checklist steps 1–8 (`progress/reviews/cloud-build-assessment.md` §4) | Fine-print tests green; a second offer's trace shows the past grades and H-MEM lessons used; endpoint answers with no family fields; a sample photo becomes a `purchase_items` row (and, if proposal 40 is approved, a bad reading triggers one retry then a "clearer photo" request); onboarding works on both paths; a first Nightshift trace names the provider and model |
| Mon Oct 26 | **Mac:** register new tables in Zetaris, record saved answers, real-AI rerun (`eval:live-model`) with the first live vision-model answers, `examples:regen`. **Build:** evidence and README, including a saved trace that shows each built loop (the newsroom loop, send-backs, the debate, and photo retry if proposal 40 is approved). **Code freeze 3pm Boston (decided)**, then a clean-copy rehearsal. Video in the evening, on the Mac | Scoreboard and traces saved with the real provider named; README matches files |
| Tue Oct 27 | Final fresh-download test; make the repo public; submit; target 5pm Boston | Ready before 23:45 UTC |

## 9. Not changing / out of scope, and keys

**Not changing:**
- Agents (extended, not replaced, by the loops in section 1b), Fact-Checker send-backs, Fine Print Court, the never-empty feed, the Receipt split, the learning loop and Coach (as built), Meterless memory (H-MEM, our required engine), trace logs, `POST /api/run`, `SAMPLE_MODE`.
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

1. ~~How real each intake path is by Oct 27.~~ **Answered by Lyndsay (round 4b): photo first; email and barcode kept for after the hackathon.** Kept here so the numbering of other items doesn't change.
2. **Live Agentmail inbox as the first email piece to drop if short on time.** *Now parked with email (after the hackathon).* *Proposal for when email returns:* yes, keep "Use sample receipts" either way. *Why:* the sample version is the part judges can run without keys.
3. **Keep "seller" and quantity on item rows.** *Proposal:* keep seller. *Why:* the matcher's seller rule needs it, and it isn't personal data.
4. **Which NVIDIA vision model is the default.** *Proposal:* Nemotron 3 Nano Omni as the default, Nano 12B v2 VL for receipts, and try 3.5 Super VL as an upgrade. *Why:* Omni reads labels and objects and is tested by others; Super VL is 9 days old.
5. **Barcode: one photo, or also a live camera scanner.** *Now parked with barcode (after the hackathon).* *Proposal for when barcode returns:* one photo first. *Why:* it works on every phone; the live scanner adds 1.5–2 hours and needs real-phone testing.
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
18. ~~Parent taps feed Meterless memory confidence.~~ **Answered by Lyndsay (round 4c): parent taps come later, not in this draft's build.** Kept here so numbering doesn't change.
19. **Set a cut order.** *Proposal:* decide Sunday midday, once coding agents have given estimates for the unestimated pieces. *Why:* the work exceeds the time; a known order beats cutting in a panic.
20. **Neon results table** (saved results survive a restart). *Proposal:* should-do. *Why:* the judges' default path is saved replay; no file estimates it.
21. **How much real Google sign-in to build for "Save your list"** (your recorded accounts decision). *Proposal:* get an estimate first; if over 3 hours, ship the Save card as a labelled demo. *Why:* `gap-answers.md` puts all four onboarding gaps at 12–16 hours.
22. **"Cash" wording in the big number.** *Proposal:* "savings and tax credits", plus a "How we got this number" link. *Why:* the $1,000 goes into an account and tax credits arrive next spring.
23. **Location pre-fill on the ZIP screen** (the mock says "Filled in from your location"). *Proposal:* the parent types a ZIP; at most a "Use my location" button. *Why:* avoids a browser permission box that needs its own explainer screen.
24. **Hosted site at all.** *Proposal:* stay local; GitHub, offline replay and the video are enough. *Why:* a host can't reach the Mac, and a public tunnel would expose the Nightshift token.
25. **Phone-camera testing.** *Proposal:* test photo (and later barcode) with the Mac's webcam at `localhost`. *Why:* phones only allow the camera on secure pages, and a hosted site isn't decided.
26. **The "Parent Panel" name in Strategy 2.** *Proposal:* the Fine Print Court's Judge fills that role; don't build a separate panel. *Why:* the panel was never built, and the Court already saves the judgment.
27. **Year-one "what a middle-class family can get back" table in the repo.** *Proposal:* yes, short and sourced. *Why:* judges discount value claims without sources.
28. **NVIDIA embeddings stay out** (moved out in round 2 to make room for Plaid, which is now gone). *Proposal:* keep them out. *Why:* Nemotron and the vision models are NVIDIA's real jobs now.

**New in round 4b (from the loops and speed work in section 1b):**

29. **Add one rebuttal round to the Fine Print Court.** Each side answers the other's argument once before the Judge rules. *Proposal:* yes, fixed at one round, and only for offers where the code screen and the first arguments disagree. *Why:* a real back-and-forth is what judges look for in "critique loops"; limiting it to disputed offers keeps the extra AI calls (2 per offer) small.
30. **Judge the court's offers at the same time, and run the Deal Hunter and Fine Print Lawyer side by side.** Today offers are judged one after another and the two arguments are asked one after the other (`finePrintCourt.ts` lines 92–93 and 174–175). *Proposal:* yes, with a limit of a few at once. *Why:* the arguments don't depend on each other, so this cuts the Court's waiting time roughly in half or more with no change in results.
31. ~~Show cards on the screen as they finish (streaming).~~ **Answered by Lyndsay's latency feedback: progressive card streaming is in her design** (section 1b). Kept here so numbering doesn't change.
32. **Photo field-check rules for the photo intake loop.** *Proposal:* required fields = product name plus at least one code (UPC, model number or lot code) or a brand; a UPC must pass its check digit; a code must be 3–20 letters/digits with at most a few dashes or spaces. *Why:* these are the checks code can do without the AI, so they decide the single retry; the exact limits should be tuned on the sample photos.
33. **Where the loops show for judges.** *Proposal:* a "How the agents worked together" panel in the owner view listing each loop's rounds for the run (send-backs, debate, photo retries), drawn from the existing trace lines. *Why:* the judges look for "where retries and feedback loops occur" (`strong-submission-examples.md` §2); the trace already records them.
34. ~~Parent taps tuning `confidence_score` vs. her earlier decision.~~ **Decided later (Lyndsay, round 4c):** parent-tap confidence tuning is not in this draft's build; it comes later. The newsroom loop (section 1b) is the visible loop now. Kept here so numbering doesn't change.
35. **Eligibility loop: which counter-questions the Lawyer may ask.** *Flag, not resolved:* her example uses job tenure and start date, but the work question is cut, so Bundle doesn't have that data. The Lawyer's counter-questions must use data we do have: state, due or birth date, ZIP, and the stored rule tables (`tax_parameters`, `state_programs`). *Example:* "Your state's paid-leave rule needs the baby born or placed within the last 12 months: ask Zetaris for the family's birth date and the state's window before approving." Anything needing job data stays on the "Check with your job" card.
36. **Safety-value loop: real recall records only.** *Flag, not resolved:* the loop may only use real CPSC and openFDA recall records (finished FDA recalls filtered out). There is no "pending review" or rumour source, and none should be invented.
37. **Message format for the shared workspace.** Lyndsay was offered a JSON event schema (a fixed shape for the messages agents send each other). *Proposal:* one shape for every message, `{run_id, from_agent, to_agent, type (claim / question / answer / correction / verdict), about (card or offer id), body, evidence_sql, round}`, stored as trace lines in Neon. *Why:* the trace already records agent steps, so the bus and the judges' trace stay one thing. *(Round 4c: the workspace notes live in Meterless H-MEM, section 1b; the same shape works as an H-MEM note, with the trace line as a copy.)*
38. **The Zetaris question that pulls saved verdicts.** *Proposal:* one fixed query per run that reads `offer_checks` for the offers in play, returning the latest `verdict`, `status`, `rule_citations`, the value-and-time grade (`true_value_cents`, `effort_minutes_estimate`, `steps_count`, `payout_wait_days_max`, `claim_window_days`), `fine_print_hash` and whether the cited rule is universal, through a view with no family data. *Why:* it powers both the instant saved feed and the "skip the AI" step; it needs one live recording run for sample mode.
39. **Cut order for the loop and screen work.** *Proposal:* if time runs short, keep in this order: the targeted-correction loop (mostly built) → safety-value loop → instant saved feed and streaming cards → eligibility loop → status pills → server-sent-event push (fall back to today's once-a-second polling). *Why:* it keeps what judges score (visible loops) first and the screen polish last. Lyndsay decides.
40. **Photo intake loop (section 1b, loop 7).** Added by an agent in round 4b, not in Lyndsay's feedback. *Proposal:* code checks what the vision model read, one retry told what was wrong, then ask the parent for a close-up (exact rules: item 32). *Why:* photo is her priority path, and a misread label would give a wrong recall match; it is also a visible loop for judges.
41. **Recall verification loop (section 1b, loop 8).** Added by an agent in round 4b, not in Lyndsay's feedback. *Proposal:* the Fact-Checker checks each recall match against the recall record inside the existing 2-round cap; no evidence, no alert. *Why:* a false recall alert scares a parent and breaks trust.

**New in round 4c:**

42. **The "worth your time" rule, and a payout range.** Lyndsay decided that value and time together decide "worth your time"; the cut-off is not decided. *Proposal (numbers for Lyndsay to set):* show value and time side by side on every approved offer, and label an offer "probably not worth your time" only when the true value is under **$X**, or the effort is over **Y minutes** for under **$Z**, or the payout wait is over **W days**, using fields already in `offer_checks`, tuned on the 12 fine-print tests. *Note:* a value-per-minute cut-off would act like an hourly rate, which round 2 avoided. *Also:* "paid in 6–8 weeks" needs a new shortest-wait field (`payout_wait_days_min`); without it the card says "paid within 8 weeks". *Why:* a clear rule turns the numbers into a verdict a parent can trust.
43. **Run H-MEM's "dreaming" between runs.** Dreaming groups related grading lessons and proposes a general one ("drugstore mail-in rebates usually pay in 6–10 weeks"); the engine's own approval rule keeps only well-supported ones. *Proposal:* only if time, as a between-runs script, never during a run. *Why:* more visible Meterless work for judges at no cost to speed.
44. **Say which Meterless engines we used, and why not the others, in the README and `metadata.json`.** *Proposal:* "H-MEM: shared workspace, newsroom-loop lessons and case law. Markovian and World Model not used: our AI steps are short, and Zetaris + `offer_checks` already hold shared facts." *Why:* the sponsor overview asks teams to name the engines and where; honesty about what isn't used reads well with technical judges.

# Bundle plan v3 (Fri Oct 23, 2026; updated Sat Oct 24, sign-off)

Submission: Tue Oct 27, 23:45 UTC (7:45pm Boston; our target is 5pm Boston). Earlier versions are frozen in `plan-history/`: Oct 23 (`bundle-plan-v3-2026-10-24-before-update.md`), round 1 (`...-round1.md`), round 2 (`...-round2.md`) round 3 (`...-round3.md`) and the last version before sign-off (`...-signoff-before.md`).

**How to read this plan.** Only Lyndsay's recorded decisions are written into the body. **At sign-off (Oct 24) she approved every proposal in section 10, with her own versions of ten of them** (`lyndsay-final-directives.md`, binding). Those approved proposals are now written into the body, the must-do and should-do lists and the timeline; section 10 is marked "resolved Oct 24 (sign-off)" and kept for the record. She is signed off: the build goes ahead and is checked to our standards without waiting for more feedback.

Where her decisions are recorded: `TRACKING-oct24-plan-update.md` (rounds 1–2), `onboarding-design/gap-answers.md` (top "Lyndsay's decisions" block, Oct 24), `TRACKING-oct24-round4.md` (round-4 feedback, onboarding answers, "Lyndsay's correction", "round 4b" and "round 4c"), and `lyndsay-final-directives.md` (sign-off, Oct 24). The build checklist is `bundle-plan-v3.build-tracker.md`.

Section numbers are unchanged from round 4 so other files' references still work; the loops section is numbered **1b** and the new agent trace log section is **1c**. Section 10's item numbers are unchanged.

## Sign-off: what Lyndsay decided (Oct 24, final)

Source: `lyndsay-final-directives.md` (binding).

1. **All open proposals in section 10 are approved,** except the ten below, where her version replaces the proposal. Items that were already answered (1, 18, 31, 34) stay as answered.
2. **Her versions (Part 1, "updated agent decision grid"):**
   - **#8 Card-style sample rows (left over from Plaid):** fully rerouted to photo and receipt item rows (`purchase_items`). Recall matching relies **strictly** on structured photo/receipt items (UPC, model number, lot codes); no unclear bank text is ever matched.
   - **#9 Clawback money-back source:** money-back cards come **only** from `purchase_items` (photos and receipts). This keeps the Savings tab filled without bank data and gives a clean sample-mode dataset that gives the same answer every run.
   - **#10 Daycare invoice demo card:** **dropped completely.**
   - **#20 Neon results table:** **must-do** (upgraded from should-do). Judges must be able to run and check the outputs from a clean download (`SAMPLE_MODE=true` replay).
   - **#29 Rebuttal round in the Fine Print Court:** yes, **strictly capped at 1 round** (a critique loop, not a straight line).
   - **#33 Loops visible to judges in the Owner View:** **must-do**: an **Agent Workspace / Trace panel** that shows the loops and retries.
   - **#38 Zetaris saved-verdict query on `offer_checks`:** implement it (sponsor tech: Zetaris searches the saved results the agents produced).
   - **#40 Photo intake retry loop (loop 7):** yes.
   - **#41 Fact-Checker recall verification loop (loop 8):** yes.
   - **#44 README honesty note on the Meterless engines we don't use:** yes.
3. **Required agent trace log (Part 2):** every agent event is written, in her fixed format, to `logs/run_<trace_id>.jsonl` and printed to the screen log. Full format and how it fits today's trace: section 1c. Her example numbers are illustrative only; real logs come from real runs and are never hand-written.

**Where a proposal left a number for Lyndsay to fill in,** the plan uses the proposal's own recommended default when it gave one; otherwise it sets a **clearly labelled default that can be changed in settings** (item 42's "worth your time" numbers, section 1; the trace log's open details, section 1c). These defaults are listed in the build tracker's "Decisions made".

## Round 4c: what Lyndsay decided (Oct 24, latest)

1. **The newsroom loop is the visible feedback loop in this draft.** Like a newsroom: reporters (the maker agents) file, the editor (the Fact-Checker) checks, and the archive (`offer_checks`) shapes how the next story is written. The agents' detailed grade of every offer (how valuable it is, how long it takes to get that value, and the other grade fields) is saved to `offer_checks` and fed back, through Zetaris and Meterless memory, into how they grade the next offers (sections 1 and 1b).
2. **An offer is graded on its value and the time it takes to get that value; both together decide whether it is "worth your time".** The Value Score reads like "Worth $40 after strings attached · about 15 minutes · paid within 8 weeks" (section 1). This value-and-time grade replaces the per-offer "confidence score" from her loops feedback. The exact "worth your time" rule was left open; at sign-off it uses labelled, adjustable defaults (section 1, "Value Score"; section 10, item 42).
3. **Parent taps tuning confidence come later,** not in this draft's build (recorded as decided-later in section 10, item 34). Parent feedback is still not the focus.
4. **Monday 3pm Boston code freeze:** decided.
5. **The agent loops (section 1b) and the 300-second run limit are must-do:** decided.
6. **Skip offers whose wording fingerprint hasn't changed** (reuse the saved grade, no AI): decided.
7. **The job (work-benefits) question stays cut.**
8. **Building the new onboarding and the Version B screens from her mocks** (`onboarding-design/project/`: the top row, then the bottom row) **is a must-do build item** (section 6, must-do item 6 and detail item 7; section 7; timeline, Sunday).
9. **The newsroom loop does not supersede or demote the data product.** The same `offer_checks` rows feed both the agents' future grading and `v_offer_audit` + `GET /api/offer-audit` with its OpenAPI description (must-do, on Sunday's timeline); selling the data and "Points Guy" report cards stay a pitch slide (sections 1 and 1b).
10. **Nightshift's job is spelled out in plain English** (section 1b, "Nightshift's job"): Meterless's Mac app that is Bundle's AI switchboard, passing every AI question to NVIDIA's Nemotron with her key stored inside it; separate from Meterless memory (H-MEM). Unconfirmed setup details are marked there.

**Applied from her round-4c question** ("isn't Meterless memory supposed to handle the shared workspace and loops?"): Meterless's memory engine (H-MEM) becomes the agents' shared workspace and the newsroom loop's memory, while plain code still decides which agent goes next and enforces round caps and time limits (section 1b; findings in `research-meterless-workspace.md`).

## Round 4b: what Lyndsay decided (Oct 24, later)

1. **Photo first.** Taking a photo (of an item's label, a formula can's bottom, or a paper receipt) that an NVIDIA vision model turns into a tidy row of facts is **the priority way purchases get in for the hackathon**. Forwarded email receipts and barcode scanning are **not dropped**: they are **kept for after the hackathon (Lyndsay's decision)**, with their design left intact in sections 3 and 6 so she can return to them. This answers the old section 10 question "how real each path is by Oct 27".
2. **Three onboarding gap answers are confirmed decisions:** the Dependent Care FSA (a work benefit that lets parents pay childcare with pre-tax money) is a gentle "Check with your job" card; sign-in is Google only; an uncovered state shows "Support for your state's programs is coming soon".
3. **The agents' loops must be a visible, prominent part of the plan,** because the judges score agent teamwork with loops (section 1b), **and the loops must be kept fast** (section 1b, "Keeping the loops fast").
4. **Her agent-loops and latency design** (`lyndsay-feedback-agent-loops-latency.md`, binding): a shared workspace ("bus") between agents; three agent-to-agent loops (Clawback Hunter ↔ Recall Checker safety-value loop, Benefits Planner ↔ Fine Print Lawyer eligibility loop, Judge ↔ Fact-Checker targeted-correction loop, max 2); an instant saved feed, a 1–2 second fast path that streams high-confidence cards, deep loops in the background pushing updates, agent status pills and optimistic background checking; and the database loop (saved verdicts with `status`, `confidence`, `rule_citations`; Zetaris first; parent taps tune `confidence_score`). All in section 1b. *Updated in round 4c:* parent-tap tuning moves to later, and the saved per-offer `confidence` is replaced by the value-and-time grade (round 4c, items 2–3).

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

Still standing from rounds 1–2 (`TRACKING-oct24-plan-update.md`): middle-class parents, not low-income (poverty, WIC, SNAP and Medicaid dropped); no Massachusetts hardcoding; deeper fine-print checks; no confidence-score bands; Neon (not Supabase) is the database; no Redis; never say "real-time"; Meterless = memory engines, not fine-print reading; store price feeds cut; brand audit = data only, no brand screens. From `gap-answers.md` (confirmed again in round 4b): every US ZIP works, with "Support for your state's programs is coming soon"; the work question is dropped and the Dependent Care FSA becomes a gentle "Check with your job" card; accounts use Better Auth on Neon, Google only; bottom tabs with the 5 tabs in the mock.

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
- **Dates:** `deadline_date`, `expired`, `claim_window_days`, `payout_wait_days_max`, `payout_wait_days_min` (optional; added at sign-off, item 42).
- **Effort:** `steps_count`, `effort_level`, `effort_minutes_estimate`, plus yes/no flags such as `mail_in`, `needs_receipt`, `needs_phone_call`, `account_required`.
- **Availability:** `limited_stock`, `regions_excluded`.
- **Judgment:** `catch_types`, `verdict`, `catch_summary`, `evidence_quote`, `injection_detected`.
- **Added for Strategy 2 (Lyndsay's "recall status"):** `recall_status` (none found / open recall / finished), `recall_ids`, `recall_checked_at`.

Code fills the dollar amounts, dates and flags. The AI fills only the soft fields (summary, effort level), and code checks them. Every dollar figure must appear in the exact quoted fine print or be computed by code from it.

**The saved-verdict query (approved at sign-off, section 10 item 38; must-do).** One fixed Zetaris question per run reads `offer_checks` for the offers in play, through a view with no family data (`v_offer_verdicts`), and returns the latest `verdict`, `status`, `rule_citations`, the value-and-time grade (`true_value_cents`, `effort_minutes_estimate`, `steps_count`, `payout_wait_days_max`, `claim_window_days`), `fine_print_hash` and whether the cited rule is universal. It powers both the instant saved feed and the "skip the AI" step: Zetaris searching the saved results the agents produced. In sample mode it replays a saved answer; that saved answer comes only from one live recording run (on the Mac flip-on checklist), never written by hand. Until it is recorded, sample mode falls back to "no saved verdicts" and the agents grade every offer fresh.

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

Example: **"Worth $40 after strings attached · about 15 minutes, 3 steps · paid within 8 weeks"** instead of "20% off", with the list of catches, an effort badge (`effort_level`: low, medium or high) and "How we scored this" in plain words. All these fields are already in `offer_checks`. Time is shown next to the value, not turned into dollars (that would need a made-up hourly rate). **"Worth your time" rule (approved at sign-off, section 10 item 42; the numbers are labelled defaults because the proposal left them blank).** Value and time are always shown side by side on every approved offer. An offer is labelled **"probably not worth your time"** only when **any** of these is true, using fields already in `offer_checks`:
- the true value is under **$5** (setting `WORTH_MIN_VALUE_CENTS`, default 500); or
- the effort is over **30 minutes** (`WORTH_MAX_EFFORT_MINUTES`, default 30) for a true value under **$20** (`WORTH_EFFORT_VALUE_CENTS`, default 2000); or
- the payout wait is over **90 days** (`WORTH_MAX_PAYOUT_DAYS`, default 90).

These four numbers are **defaults chosen by the planning agent, not by Lyndsay**; they live in settings, are tuned on the 12 fine-print tests, and she can change them at any time. There is no value-per-minute cut-off, because that would act like an hourly rate, which round 2 avoided. A new optional shortest-wait field, `payout_wait_days_min`, is added to `offer_checks`: when the fine print gives both ends, the card says "paid in 6–8 weeks"; otherwise it says "paid within 8 weeks".

**The data product (decided, must-do):** one read-only web address, `GET /api/offer-audit?store=...`. It runs a fixed query against the Zetaris view `v_offer_audit` (per-brand totals only: catch rate, average true vs. advertised value, average effort; plus, if time, open CPSC recalls per brand, section 10 item 17, should-do), is rate-limited (capped at a number of requests per minute), and uses saved answers in sample mode. It comes with an **OpenAPI description**, the standard file that tells any program or AI agent how to call it, plus a test that the answer never contains family fields. Protection rules are already designed in `architecture.md` (lines 368–372) and `research-matching-and-agent-api.md` (Question 2).

**Future (pitch slide only):** sell this data, and offer brand report cards in the style of "The Points Guy" (Strategy 3). There is no brand portal. An MCP server (the standard plug-in that lets AI agents use a tool) comes "later".

## 1b. How the agents work together: the loops

**Lyndsay's decisions** (round 4b, plus her agent-loops and latency feedback in `lyndsay-feedback-agent-loops-latency.md`, which is binding). Her goal, in her words: *truly agentic* (agents negotiate, hand work to each other, cross-examine and refine offers in feedback loops) **without ruining speed, how responsive the screen feels, or AI spend**. That means moving from a straight-line pipeline to an **event-driven, multi-tier** design: agents react to messages from each other ("event-driven"), and quick checks run first while deeper checks run behind them ("multi-tier").

**Why it matters for scoring:** the judges mark down agents that "run once in a straight line" (A passes to B, B passes to C) and reward agents that "loop, critique, retry, branch and revise" (`strong-submission-examples.md` §3 and §14, `weak-submission-examples.md` lines 168, 645 and 704, `hackathon-overview.md` line 114 "No feedback loops"). The re-grade credits our Fact-Checker send-back loop by name (`regrade-2026-10-24.md` lines 61 and 133). A **loop** here means one agent's output goes back to another agent (or the same one) with a reason, and the result changes because of it. Every loop has a hard cap on rounds so it always ends.

### The agent network and its shared workspace

- **Shared workspace ("bus"), Lyndsay's design, held in Meterless memory (round 4c).** A shared memory and state area that every agent reads and writes during a run, like a team whiteboard. Clawback Hunter, Recall Checker and Benefits Planner post **candidate ideas** ("this item may be owed $12 back") to it; they go to the **Fine Print Court** (Deal Hunter, Fine Print Lawyer, Judge), then to the **Fact-Checker**, the cross-examiner. Agents also post questions to each other on it (the loops below).
- **Which parts Meterless does, and which are plain code** (answering Lyndsay's round-4c question "isn't Meterless memory supposed to handle these?"; details in `research-meterless-workspace.md`):
  - **Meterless H-MEM is the whiteboard. PLANNED.** Every message an agent posts (a claim, question, answer, correction or verdict) is saved as an H-MEM note for that run, with its `source` (which agent, which evidence), the engine's own trust number (`confidence`, 0 to 1) and the item it is about. Agents read the notes about their item before acting. H-MEM's guide is written for this ("a Planner agent's decision is retrievable by a Verifier agent"). Every note also lands in H-MEM's append-only audit log (the "trust ledger", a log nothing is deleted from), already exported each run to `logs/ledger-<run>.jsonl`, so judges can see who said what and why.
  - **Meterless H-MEM also holds the newsroom loop's grading lessons** across runs (see "The newsroom loop" below). **PLANNED.**
  - **Plain code (the orchestrator, the code that runs the agents in order)** decides which agent works next, delivers each question to the right agent, enforces the round caps and the 300-second run limit, and pushes updates to the screen. No Meterless engine routes messages or keeps time.
  - **Hard numbers stay in Neon, read through Zetaris.** H-MEM holds notes and lessons; dollars, minutes and days live in `offer_checks`, so Zetaris stays the only way agents read data.
  - **Speed:** H-MEM runs inside our own server and matches notes without an AI call, so it adds milliseconds, not seconds. Left out of the run to stay fast: H-MEM's AI-based note extraction and its between-run "dreaming" and "sleep" jobs (they add AI calls; dreaming between runs is approved as a should-do, only if time, as a between-runs script: section 10, item 43). Not used: the Markovian engine (for very long single tasks; our AI steps are short) and the World Model engine (it overlaps with Zetaris + `offer_checks`).
- **What is built today:** H-MEM is in the code (copied in under its open-source licence in `bundle/vendor/hmem/`, wrapped by `server/adapters/memory.ts`) and does one job: approved rules ("case law") the Judge must cite (`finePrintCourt.ts` line 87). Its "was this note right?" feedback is built and tested (`memory.test.ts`) but no agent calls it yet. Every agent already shares one run context (`AgentContext` in `bundle/server/agents/types.ts` lines 13–24: the family, the Zetaris connection, the AI, Meterless memory and one shared trace log), and the Court posts its rejected offers to a shared list (`ctx.blocked`). There is **no message passing between agents yet**: the orchestrator passes work along (`orchestrator.ts` lines 208–261). **Status of the workspace: PLANNED.** Message format (approved at sign-off, section 10 item 37): one shape for every message, `{run_id, from_agent, to_agent, type (claim / question / answer / correction / verdict), about (card or offer id), body, evidence_sql, round}`, saved as an H-MEM note, with a copy as a trace line (section 1c).

**Nightshift's job (separate from Meterless memory).** Nightshift is Meterless's free Mac app that acts as Bundle's **AI switchboard**. Every AI question the agents ask (the court arguments, the Judge's ruling, explanations, the Coach's rule wording) goes to one address on Lyndsay's Mac (`http://127.0.0.1:8088/v1`). Nightshift passes the hard questions to **NVIDIA's Nemotron** models, using Lyndsay's NVIDIA key, which is stored **inside Nightshift** (never in our code). That makes Nightshift the "primary AI provider" the Meterless rule asks for, and puts NVIDIA to work in the same request. It is a **different thing from Meterless memory (H-MEM)**: Nightshift answers AI questions; H-MEM stores what the agents learned (approved rules, shared findings, grading lessons). In the cloud, the code talks to a **stand-in Nightshift** (a fake server used for tests); Lyndsay switches the real one on at her Mac (section 6, item 2). If Nightshift doesn't answer, Bundle falls back to NVIDIA directly, then to saved offline text (order approved at sign-off, section 10 item 11; kept as a setting). **Not yet confirmed** (`research-nightshift-setup.md`, section 6 "Unconfirmed"): the exact menu for adding the NVIDIA key, the Mac folder that holds Nightshift's password file (`proxy-token`), how to pin one exact Nemotron model and turn "thinking" off (Meterless said this arrives Sunday), whether replies name the real model that answered, and the NVIDIA credit amount and rate limit.

### The loops, and how real each one is (code checked Oct 24)

**Lyndsay's three agent-to-agent loops:**

1. **Clawback Hunter ↔ Recall Checker: the safety-value loop. PLANNED.**
   - Before publishing a price drop or rebate on an item, the Clawback Hunter asks the Recall Checker: "Any active flags on this item?"
   - If a CPSC or FDA recall exists on it, the deal is **killed before it reaches the Judge**, with the reason "do not encourage buying or claiming a rebate on this item".
   - It uses only real CPSC and openFDA recall records (approved rule, section 10 item 36: no "pending review" or rumour source, and none is invented). Finished FDA recalls are already filtered out.
   - It checks only structured item rows from `purchase_items` (UPC, model number, lot code), never bank text (sign-off, item 8).
   - Today the two agents don't talk: `clawback.ts` never looks at recalls.
2. **Benefits Planner ↔ Fine Print Lawyer: the eligibility loop. PLANNED.**
   - The Planner sends a benefit's terms to the Fine Print Lawyer, who **tries to disprove eligibility** (timing, conditions, income caps).
   - If it finds a condition, the benefit goes back to the Planner with a **counter-question**, for example "ask Zetaris for X before approving". The Planner asks Zetaris and either confirms or drops the benefit.
   - Counter-questions may use only data we have (approved rule, section 10 item 35): state, due or birth date, ZIP, and the stored rule tables (`tax_parameters`, `state_programs`). Anything needing job data stays on the "Check with your job" card (the work question is cut).
   - Today the Lawyer only argues about offers (`finePrintCourt.ts` lines 71–84); `benefits.ts` never calls it.
3. **Judge ↔ Fact-Checker: the targeted-correction loop. BUILT (basic form); targeted wording PLANNED.**
   - Instead of just dropping a card, the Fact-Checker sends a **specific correction** back to the Court ("math mistake on line 2: recalculate the net savings"); the Court re-runs with that error added; **at most 2 rounds**, then the card is dropped.
   - **Built:** the general send-back loop already does this for every agent, including the Court: a wrong card goes back with the reason and the corrected values (`orchestrator.ts` lines 225–261, `checkOne`; `MAX_RETRIES` default 2), and the Court re-argues and re-judges with the reason added (`finePrintCourt.ts` lines 187–197). Each round is a `send_back` line in the trace.
   - **Planned:** the line-by-line correction wording, and letting a corrected offer come back as "approve with a catch" (today the Court's re-judge keeps only "approve").

**Other loops** (4, 5 and 9 kept from before; 6 is Strategy 2, the newsroom loop; 7 and 8 approved at sign-off):

4. **Fact-Checker send-back for every agent. BUILT.** As in loop 3, for all four maker agents (Clawback Hunter, Recall Checker, Benefits Planner, Fine Print Court). A card that **couldn't be checked** (source down) is never sent back: it gets one retry after a 1.5-second pause, then is dropped with an honest banner.
5. **Fine Print Court debate. BUILT (one round).** Deal Hunter argues for, Fine Print Lawyer argues against, and the Judge reads both plus the **case law** (approved rules recalled from Meterless memory) and rules, citing the rule ids it relied on; if the AI answer is missing or badly shaped, a code screen applies the case law (`finePrintCourt.ts` lines 71–119). **Checked: there are no rebuttal rounds today.** **Rebuttal round: approved at sign-off (section 10 item 29), PLANNED, must-do, strictly capped at 1 round:** each side answers the other's argument once before the Judge rules, only for offers where the code screen and the first arguments disagree (about 2 extra AI calls per disputed offer). The Deal Hunter and Fine Print Lawyer are asked side by side, and the Court's offers are judged a few at a time (approved, section 10 item 30).
6. **The newsroom loop (Living Fine-Print Database). PLANNED (must-do; the visible feedback loop in this draft; details in "The newsroom loop" below).**
7. **Photo intake loop. PLANNED; approved at sign-off (section 10, item 40); must-do with the photo path.** The photo path itself is her round-4b priority.
   - The vision model reads the photo and returns fields (product name, brand, model number, lot code, UPC, size, price).
   - **Code checks the fields:** required fields are present; a UPC has 12 digits and a correct check digit (the last digit that proves the others were read right); a model number or lot code looks like a code, not a sentence; every value appears in what the model says it read. (Approved limits, section 10 item 32: required fields = product name plus at least one code (UPC, model number or lot code) or a brand; a UPC must pass its check digit; a code is 3–20 letters/digits with at most a few dashes or spaces; tuned on the sample photos.)
   - If a check fails, the vision model is **asked again once, told exactly what was wrong**. **At most 1 retry.**
   - If still unclear, the parent is asked for a **clearer photo or a specific close-up** ("the label under the seat", "the bottom of the can").
8. **Recall verification loop. PLANNED; approved at sign-off (section 10, item 41); must-do.** The Recall Checker proposes a match; the Fact-Checker checks it against the recall record (the exact code or the recall's words); missing evidence sends it back, inside the same 2-round cap; no evidence, no alert.
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
                        purchase_items  (the only purchase source for recalls and money back)
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
       Fine Print Court: Deal Hunter (for) vs Fine Print Lawyer (against)
                         -> one rebuttal each, only if disputed (max 1) -> Judge (cites case law)
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

 Every step above -> one line in logs/run_<trace_id>.jsonl (section 1c) -> Owner View Agent Workspace / Trace panel
```

### Keeping the loops fast (Lyndsay's latency design, plus the speed limits already in the plan)

**The problem:** loops mean more AI calls, and slowness is our main AI failure. Live Zetaris runs have taken **13 to 171 seconds** with occasional errors (`architecture.md` line 204 and line 426); in the one real-AI run the Judge timed out or broke format 4 of 5 times (`regrade-2026-10-24.md` line 61; `plan-grade-future-state.md` risk 3). Today each AI call stops at **20 seconds** (a setting borrowed from the data sources) and **gets no retry after a timeout** (`research-nightshift-setup.md` §3a; `llm.ts` line 132). Today's screen asks the server for progress once a second and shows the whole feed only when the run ends (`client/src/pages/Feed.tsx` lines 105–126); finished results are kept in the server's memory only (lost on restart) and in the browser tab (`client/src/lib/bundle.ts` lines 283–296).

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
| **Hard caps on rounds:** send-back / targeted correction max 2; photo retry max 1; debate rounds fixed (one today); max 5 offers go to court per run (`MAX_OFFERS`, `finePrintCourt.ts` line 8) | Send-back and offer caps **built**; photo cap (max 1) and rebuttal round (max 1) **planned, approved at sign-off** (section 10, items 40 and 29) |
| **Time limit on every AI call, plus one retry** for timeouts and server errors (`NIGHTSHIFT_TIMEOUT_SECONDS` 180, `MODEL_TIMEOUT_SECONDS` 90) | **Planned** (must-do, section 6 item 2). Zetaris calls already have a time limit and one retry for their known hiccup (`orchestrator.ts` lines 156–166) |
| **Time budget for the whole run:** after 300 seconds, remaining AI steps use saved offline text and say so (`RUN_DEADLINE_SECONDS`) | **Planned** (must-do, decided in round 4c; section 6 item 2) |
| **Agents run at the same time:** the four maker agents run side by side and one failing never stops the rest; the Fact-Checker checks 4 cards at a time | **Built** (`orchestrator.ts` lines 208–213 and 262–273). Inside the Court, offers are still judged one after another; judging a few at a time and asking both sides side by side is **planned, approved** (section 10, item 30) |
| **Zetaris filters first,** so the AI gets a short, already-checked list | **Built** (Strategy 1, section 2) |
| **Skip the AI when nothing changed:** reuse an `offer_checks` verdict when the fingerprint is unchanged or a universal rule already rejected the offer | **Planned** (newsroom loop, must-do; the fingerprint skip decided in round 4c) |
| **Shared workspace in Meterless H-MEM costs milliseconds:** it runs inside our server and matches notes without an AI call; H-MEM's AI-based extraction, dreaming and sleep stay out of the run | **Planned** (section 1b, workspace) |
| **Saved results survive a restart:** each finished run is saved to a Neon results table, so a clean download can replay and check outputs | **Planned, must-do** (sign-off, item 20; section 6, item 9) |
| **Small fast model for simple steps, bigger model for the Judge:** the debate arguments already ask for the "fast" model (`finePrintCourt.ts` line 77); the Judge uses the "reasoning" model | **Built.** The Judge uses Nemotron 3 Super with "thinking" off (approved, section 10 item 13; kept as a setting) |
| **Saved answers in sample mode:** `SAMPLE_MODE=true` replays recorded Zetaris answers and offline text | **Built** |


**Agent loops (must-do item 9): done when** each loop that is built shows up as rounds in the trace log of a sample run (send-back / targeted correction max 2, rebuttal max 1, photo retry max 1, recall verification inside the 2-round cap); the safety-value loop kills a planted recalled item's deal before the Judge; the eligibility loop drops or confirms a benefit after one Zetaris counter-question; no run goes past 300 seconds; and the Owner View Agent Workspace / Trace panel shows those rounds.

## 1c. Agent trace log (JSONL) (Lyndsay's required format, sign-off Oct 24)

**What it is, in plain English.** A diary every agent writes as it works. Each time an agent does something (asks Zetaris, reads a photo, argues, checks a fact, asks for a retry, approves or rejects a card), it writes one line. Each line is one small JSON record (JSON is a machine-readable text format; "JSONL" means one JSON record per line). Judges can open the file and follow exactly who did what, in what order, and why.

### Her required format (verbatim from `lyndsay-final-directives.md`, Part 2)

Every event appended to `logs/run_<trace_id>.jsonl` and printed to stdout. One JSON object per line:
- timestamp: ISO-8601 UTC
- trace_id: string (e.g. run_bundle_001)
- agent_name: Orchestrator | PhotoReader | ClawbackHunter | RecallChecker | BenefitsPlanner | FinePrintCourt | FactChecker | CoachAI
- action: query_zetaris | vision_extract | evaluate_offer | court_debate | fact_check | retry_request | recall_hmem | approve_card | reject_card
- input_summary: brief summary of input passed to the agent
- output_summary: brief summary of findings/decision/text
- target_agent: next agent or API endpoint
- confidence: number 0.00–1.00
- retry_count: integer 0, 1, 2
- status: success | retrying | needs_revision | rejected | approved

("Printed to stdout" means also shown in the server's running text log, the window where the server prints messages.)

Her example run (abridged in her file): Orchestrator query_zetaris (offer_checks saved verdicts: 0 found) → PhotoReader vision_extract (formula label: SKU, lot, brand; code validation passed) → ClawbackHunter evaluate_offer ($15 price drop; safety check sent to RecallChecker) → RecallChecker query_zetaris (SKU × openFDA via Zetaris; no active recall on lot) → FinePrintCourt court_debate (Deal Hunter vs Lawyer; Judge recalled rule mem-04 from Meterless H-MEM; needs_revision) → FactChecker fact_check (math error; recalculation requested; retry_count 1) → FinePrintCourt court_debate (recalculated net $5.50; citation verified) → FactChecker approve_card (approved; written to offer_checks via Zetaris; target ParentFeed).

**Her example's values are illustrative only.** Real logs come only from real runs (sample-mode replays or live runs, each labelled as such) and are never hand-written or edited.

### How it fits the trace we already have (code checked Oct 24)

**What exists today.** `bundle/server/agents/trace.ts` (`TraceLogger`) already writes one JSON line per agent step, and **its field names are already the same ten as hers**. Lines go to `bundle/logs/run-<runId>.jsonl` (a dash, one file per run), with incomes and passwords masked by `redact()`. The orchestrator creates one logger per run and shares it with every agent through `AgentContext.trace` (`orchestrator.ts` line 189); Zetaris queries and Meterless memory calls are also logged, through `withTrace` (`orchestrator.ts` lines 191–192). The screen reads the file through `GET /api/runs/:runId/trace` (`server/routes/bundleRoutes.ts` lines 155–164), which the "Checking" screen polls once a second (`client/src/pages/Feed.tsx`). `scripts/eval.ts` copies the learning-demo traces (run1, approve, run2), saved traces sit in `logs/sample/`, and Meterless's trust ledger is exported separately to `logs/ledger-<runId>.jsonl`. Cards point back to their trace line by its id (`finePrintCourt.ts` lines 124 and 138).

**Where today's lines differ from her format:**

| Field | Today | Her format |
|---|---|---|
| `trace_id` | a new random id for **every line** (cards use it to point at a line) | one id for the **whole run** |
| `agent_name` | lowercase labels: `orchestrator`, `zetaris`, `memory`, `clawback`, `recall`, `benefits`, `fine_print_court`, `deal_hunter`, `fine_print_lawyer`, `judge`, `fact_checker`, `coach`, `explain` | her 8 names |
| `action` | free labels (`start`, `query_cached`, `verify`, `send_back`, `explain`, …) | her 9 actions |
| `status` | `ok`, `retry`, `blocked`, `fallback`, `error` | `success`, `retrying`, `needs_revision`, `rejected`, `approved` |
| `confidence` | often empty (`null`) | always a number 0.00–1.00 |
| file and screen | `logs/run-<runId>.jsonl`; not printed to the server log | `logs/run_<trace_id>.jsonl`; printed to stdout |

**Recommendation: add her log next to today's trace, made from the same events, so nothing breaks.** The existing trace keeps working unchanged (its tests, the card links, the trace API, the eval copies and the saved sample traces). Inside `TraceLogger.log()`, the same event is also turned into one line in her format, appended to `logs/run_<trace_id>.jsonl` and printed to stdout. One event, two files: they can never disagree, and judges get her exact format. Agents pass a little more context when they log (which of her agent names and actions it is, and who it goes to next), so the translation is not guesswork.

**How events translate (defaults; the build tracker lists them under "Decisions made"):**
- **trace_id:** one per run, `bundle_<runId>`, so the file is `logs/run_bundle_<runId>.jsonl`. This follows her file path exactly and avoids a doubled "run_run_" in the name. *Labelled default.*
- **agent_name:** `orchestrator` → Orchestrator; photo reading → PhotoReader; `clawback` → ClawbackHunter; `recall` → RecallChecker; `benefits` → BenefitsPlanner; `fine_print_court`, `deal_hunter`, `fine_print_lawyer`, `judge` → FinePrintCourt (the speaker is named in `output_summary`); `fact_checker` → FactChecker; `coach` → CoachAI. Zetaris and memory calls are written under the agent that made them (the adapters are told the caller's name); `explain` lines go under the agent whose card is being explained.
- **action:** Zetaris queries → `query_zetaris`; photo reading → `vision_extract`; a maker agent weighing an offer, benefit or refund → `evaluate_offer`; arguments, rebuttals and the Judge's ruling → `court_debate`; the Fact-Checker's checks → `fact_check`; send-backs, targeted corrections, photo retries and Zetaris retries → `retry_request`; Meterless memory reads (case law, workspace notes, grading lessons) → `recall_hmem`; the final yes/no on a card → `approve_card` / `reject_card`.
- **status:** `ok` → success; `retry` → retrying; a send-back or targeted correction → needs_revision; `blocked` or a final no → rejected; a final yes → approved. Her list has no "fallback" or "error": a fallback is written as success with `output_summary` starting "fallback:", and an error as retrying (if a retry follows) or rejected (if not), with `output_summary` starting "error:". *Labelled default.*
- **confidence:** never made up. The Fact-Checker's exact match against the source row and other pure code rules = 1.00; a photo reading = the share of code field checks it passed (for example 3 of 4 = 0.75); a grading lesson = H-MEM's own trust number; an AI step with nothing measured = the share of code checks on its answer that passed. This is a trace number for judges only, never shown to parents, and it does not bring back the per-offer confidence score that round 4c replaced with the value-and-time grade. *Labelled default.*
- **retry_count:** 0, 1 or 2, matching the round caps (send-back max 2, rebuttal max 1, photo retry max 1).
- **target_agent:** the next agent in her list, or an endpoint such as `offer_checks`, `ParentFeed` or `/api/offer-audit`.
- **Housekeeping lines** that fit none of her nine actions (run start, ledger export, memory writes) stay only in the existing detailed trace. *Labelled default; Lyndsay can ask for them to be added.*
- **Privacy:** the same `redact()` masking applies. No photo, name, address or raw email ever goes into either log (section 3, "Photo privacy").

**The Owner View reads it.** The Agent Workspace / Trace panel (must-do, sign-off item 33; section 6 item 10) reads `logs/run_<trace_id>.jsonl` through a new reviewer-only web address (`GET /api/runs/:runId/agent-log`, behind the existing reviewer code) and groups the lines into "How the agents worked together": each loop's rounds per card (send-backs, the rebuttal round, photo retries, recall verifications, saved verdicts reused), next to the H-MEM workspace notes. The parent view never receives it. The saved evidence for judges includes at least one log from a real run that shows every built loop.

## 2. Strategy 1, the Virtual Household Profile: the existing Matcher, story told better

Nothing is built differently. The Matcher (the "front desk" in the original plan) asks Zetaris one question that combines the family's profile (stage, birth or due date, state) with the rules and approved offers. The pitch line:

> *"Zetaris does the filtering, so the AI gets a short, already-checked list instead of the family's whole history: fewer tokens, lower cost, less room to make things up."*

(A **token** is a small chunk of text. AI services charge by the token, and fewer tokens also means fewer chances for the AI to invent things.)

---

## 3. Getting purchases in: three paths into one table

Lyndsay's decision (round 4), with the priority set in round 4b. Sources: `research-email-receipts.md`, `research-photo-barcode-intake.md`, `cloud-build-assessment.md`.

**The three paths:**
1. **Take a photo: the PRIORITY path for the hackathon (round 4b).** A photo of an item (the label under a baby walker, the bottom of a formula can) or of a **paper receipt**. An NVIDIA vision model (an AI that can read pictures) turns it into a tidy row of facts, checked by code in the photo intake loop (section 1b, loop 4).
2. **Forward email receipts: kept for after the hackathon (Lyndsay's decision).** Receipts go to a Bundle address on the agents' existing **Agentmail** inbox. Agentmail is an email service that gives a program its own inbox it can read through code. The design below stays intact.
3. **Scan a barcode: kept for after the hackathon (Lyndsay's decision).** The phone camera reads the barcode. The design below stays intact.

**Vision models named in the research** (all on build.nvidia.com):
- `nvidia/nemotron-nano-12b-v2-vl`: built for receipts and labels.
- `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`: reads labels and understands the object. Turn "thinking" off.
- `nvidia/nemotron-3.5-super-vl-120b-a12b`: NVIDIA's newest big vision model, for messy photos. Announced Oct 15, 2026, and not yet tested by us.

**Default (approved, section 10 item 4):** Nemotron 3 Nano Omni for item labels, Nano 12B v2 VL for receipts, and 3.5 Super VL tried as an upgrade. All kept as settings (`MODEL_VISION`, `MODEL_VISION_RECEIPT`).

**One table for everything: `purchase_items` in Neon.** It replaces the separate `receipt_items` table from round 3, so the "one structured purchase-items table" decision covers all three paths.
- Columns: `family_id`, `source` (`email`, `barcode`, `photo_item`, `photo_receipt`), `store`, `seller` (kept, approved, section 10 item 3), `quantity`, `purchased_on`, `product_name`, `brand`, `model_number`, `lot_code`, `upc`, `size_text`, `price_cents`, `confidence`, `extractor`, `input_hash` (a fingerprint that stops the same receipt or photo being counted twice), `created_at`.
- It is registered in Zetaris behind a **safe-columns view**, `v_purchase_items`: a saved query that shows agents only the harmless columns.
- It is joined against the live CPSC and openFDA recalls (FDA recalls stay in; only finished ones are filtered out), and, as Lyndsay asked, against offers and benefit rules. The exact offer and benefit-rule queries are still to be designed.
- **It is the only purchase source the agents use (sign-off, items 8 and 9).** The Recall Checker matches only its structured codes (UPC, model number, lot code), never bank text; the Clawback Hunter's money-back cards come only from its rows with prices. The old card-style sample rows (`transactions`, `plaid-transactions.json`) are no longer read by any agent, and the views that read them (`v_recall_orders`, `v_clawback_tx`) are rebuilt on `purchase_items`. Sample families get made-up photo and receipt item rows so the Savings tab stays filled in sample mode.

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
- Photos (item and receipt): about 9–12 hours. **Hackathon priority.** The photo intake loop (approved, section 10 item 40) and its field checks and one retry are part of this.
- Email, sample version: 5.5–6.5 hours, plus 2–3 hours for the live inbox. *After the hackathon.*
- Barcode: about 6–8 hours. *After the hackathon.*
- Tests for barcode and photos: 2–3 hours (the photo share is in scope now).
- Shared pieces (table, view, exact-code joins) are counted once, and are needed for photos.

Everything except real-phone camera checks, the first live model answers and the Zetaris registration can be built and tested in the cloud.

**Decided (round 4b):** photo first; email and barcode kept for after the hackathon, design intact. **Approved at sign-off for when they return:** keep "Use sample receipts" even if the live inbox is dropped (item 2); barcode starts with one photo, not a live scanner (item 5). **For the hackathon:** credited CPSC recall-notice photos are used as sample item photos (item 6); camera testing uses the Mac's webcam at `localhost` (item 25).

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
| Agent Workspace / Trace panel (must-do, sign-off item 33) | Nothing | "How the agents worked together": each loop's rounds for the run (send-backs, the rebuttal round, photo retries, recall verifications, saved verdicts reused), read from `logs/run_<trace_id>.jsonl` (section 1c) and the H-MEM workspace notes |
| Access | Anyone | Reviewer code only (the existing reviewer token), shown to judges in the demo |

## 5. Where Zetaris does the work

Zetaris is the required "data door": one question in SQL (a database language) can read several separate data stores. Zetaris must join several real sources in one question. On slides, name the real cross-source joins (purchases × live recalls; `offer_checks` × live recalls) plus the per-helper views, rather than a number like "four joins" (approved, section 10 item 16).

| Helper | The question it asks Zetaris | What gets combined | Where you see it |
|---|---|---|---|
| Recall Checker | Which of this family's purchased items are on a recall list? | Structured item rows from `purchase_items` only (UPC, model number, lot code; through `v_purchase_items`; sign-off item 8) + live CPSC and openFDA recall feeds (FDA recalls stay; only finished ones are filtered out) | Recall card; "We checked 7 items" |
| Fine-Print Database (Strategy 2) | Saved-verdict query (item 38): what have we already found about this store, brand or wording? Which "truly free" offers' products haven't been recalled since we checked? | `offer_checks` + offers + live CPSC/openFDA recalls; for the Coach, `offer_checks` + `feedback`. No family data | Value Score; "We caught these"; `/api/offer-audit` |
| Matcher / Benefits Planner (Strategy 1) | Which programs and offers fit this family, by when? | Family profile + benefit rules (federal and state rows) + `tax_parameters` (IRS 2026: Child Tax Credit $2,200 per child; Dependent Care FSA $7,500) + `state_programs` (MA, NY, CA paid family leave) + full ZIP-to-state table | Taxes, Insurance and Home cards |
| Clawback Hunter | Which purchases are FSA-eligible or inside a store's price-drop window? | `purchase_items` rows with prices only (photos and receipts; sign-off item 9; `v_clawback_tx` rebuilt on them) + FSA-eligible list + store policies. Card-style sample rows are no longer read | Savings "money back" cards |
| Fact-Checker | Is this exact dollar amount, date **and state** right? (asks a separate question) | Re-reads the source row, including its state | Blocks or sends back wrong cards, including a wrong-state card |
| Privacy views | — | Each helper gets its own filtered view (the deal Judge never sees family data; agents read `v_purchase_items`, never the raw table) | Owner view: "Data sources" per card |

**Two direct database reads (from `audit-round4.md` section A).** Every agent search goes through Zetaris, except two places where agent input is read from Neon directly:
1. The family profile, loaded in live mode (`server/agents/orchestrator.ts:48-55`).
2. The Coach reading parents' reports (`server/bundleStore.ts:76-79`).

**Approved at sign-off (section 10 item 14): route both through Zetaris** (must-do, small; section 6 item 11), so "Zetaris is the only way agents read data" is fully true.

**Honest note on sources:**
- CPSC and openFDA are live outside feeds (FDA recalls stay in; only finished ones are filtered out).
- Receipt, barcode and photo items are read from made-up inputs and copied into Neon.
- IRS and state leave figures are official numbers stored as rows with their source link and year, checked Oct 24 (`audit-ma-poverty-evals.md` section 2b). A person should confirm the MA leave figure on mass.gov before it goes on a slide.

Remove Zetaris and the app can't produce a single personal card. **Line for judges (round-2 wording, restored):** "Zetaris finds the candidate pairs across private and public data in one question; the AI decides the hard cases." (Zetaris has no built-in fuzzy matching, meaning it can't match "close enough" spellings.) **Replacement line approved at sign-off (section 10 item 15)**, used from now on in the README, slides and video: "Zetaris finds candidate matches across private and public data in one question. Code rules make the safety decisions and show their evidence. The AI argues over fine print, explains, and fills gaps the rules can't, and code can overrule it."

---

## 6. Technical plan (for the CTO)

**Starting point:**
- Repo `bundle/`, with 268 tests passing (8 skipped).
- `SAMPLE_MODE=true` is always offline by design.
- The Zetaris join of Neon with CPSC already works.
- The reviewer token already gates Approve.
- No Redis: agents write results to Neon and screens read from Neon.

**Ranking** (round 2, Lyndsay's round-4 decisions, and her sign-off on Oct 24):
- **Must-do:**
  1. Owner view split, including the **Agent Workspace / Trace panel** (sign-off item 33; section 6 item 10).
  2. Nightshift code (built in the cloud) and the real-AI rerun, with the approved fallback order (item 11), the Monday 9am go/no-go (item 12) and Nemotron 3 Super for the Judge (item 13).
  3. Any-state, middle-class rules.
  4. **Living Fine-Print Database:** fine-print tests, `offer_checks`, **the Zetaris saved-verdict query** (sign-off item 38), the newsroom loop, the Value Score (value and time to get it) with the "worth your time" rule (item 42, labelled defaults), the `v_offer_audit` view **and `GET /api/offer-audit` with its OpenAPI description**.
  5. Recall safety: the finished-FDA-recall filter and the `no_false_recall` test, **plus the product-matching upgrade** (promoted from should-do, approved section 10 item 7).
  6. **Onboarding + Version B screens, built from Lyndsay's mocks** (`onboarding-design/project/`: the top row of onboarding questions, then the bottom row's Version B tabs; never the middle row). Confirmed must-do in round 4c; details in item 7 below and section 7.
  7. Regenerate evidence, including the README's Meterless honesty note (sign-off item 44), the approved judges' line (item 15), the cross-source join wording (item 16) and a short, sourced year-one "what a middle-class family can get back" table (item 27).
  8. Data intake: **the photo path first** (round 4b), with the shared pieces and **the photo intake loop** (loop 7, approved at sign-off, item 40). `purchase_items` becomes the only purchase source for recall matching and money-back cards (sign-off items 8 and 9); the daycare invoice card is dropped (item 10). Email forwarding and barcode are kept for after the hackathon (Lyndsay's decision), not must-do.
  9. **The agent loops, visible and fast** (section 1b, Lyndsay's design): the shared workspace (in Meterless H-MEM, approved message format, item 37); her three agent-to-agent loops; the **one rebuttal round** in the Court (item 29, max 1) and the side-by-side Court (item 30); the newsroom loop; the photo and recall verification loops (loops 7 and 8, approved, items 40–41); the fast screen (instant saved feed, fast-path streaming, background updates by server-sent events, status pills, optimistic checking); and the speed limits (per-call time limit and retry and the 300-second run budget (must-do, decided in round 4c) are already in item 2; the `offer_checks` skip is in item 4). Hours for this are **not yet estimated**.
  10. **Neon results table** (upgraded to must-do at sign-off, item 20): finished runs survive a restart and replay from a clean download (section 6, item 9).
  11. **Agent trace log (JSONL)** in Lyndsay's required format, written by every agent and read by the Owner View panel (sign-off Part 2; section 1c; section 6, item 10).
  12. **Route the two direct database reads through Zetaris** (approved, item 14; small; section 6, item 11).
- **Should-do:** onboarding extras (round 2); open CPSC recalls per brand in `v_offer_audit` (approved "yes if time", item 17); H-MEM "dreaming" as a between-runs script, never during a run (approved "only if time", item 43); real Google sign-in for "Save your list" (approved: estimate first; if over 3 hours, ship the Save card as a labelled demo, item 21). *(The product-matching upgrade moved up to must-do item 5.)*
- **Moved out in round 2:** NVIDIA embeddings for the memory; confidence-score bands (dropped by decision); no extra polish on the "Checking" screen.
- **Cut (recorded decisions):** Plaid; the daycare invoice card (sign-off item 10); the work-benefits question; brand screens and brand portal; MCP server (pitch slide, "later"); store price feeds; Redis; poverty, WIC, SNAP and Medicaid; the middle row of mocks. Also carried from round 2: NeMo Guardrails (NVIDIA's add-on safety filter) and paid hosting (stay local; approved, item 24). NVIDIA embeddings stay out (approved, item 28).
- **Cut order (approved, items 19 and 39):** set on Sunday midday once coding agents have estimated the unestimated pieces. For the loop and screen work, keep in this order if time runs short: the targeted-correction loop (mostly built) → safety-value loop → instant saved feed and streaming cards → eligibility loop → status pills → server-sent-event push (falling back to today's once-a-second polling). Since Lyndsay is signed off, the build lead applies this order and records it in the build tracker; she can override it at any time.

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
- **Fallback order (approved, item 11):** Nightshift → NVIDIA Nemotron direct → saved offline text, kept as a setting. **Monday 9am Boston go/no-go (approved, item 12):** if Nemotron isn't answering through Nightshift by then, rerun with NVIDIA direct, labelled as such. **Judge model (approved, item 13):** Nemotron 3 Super with "thinking" off.
- **Every AI call writes trace log lines** (section 1c) naming the provider and model that answered.
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
- **The newsroom loop:** past grades looked up through Zetaris and grading lessons recalled from Meterless H-MEM before grading; the Fact-Checker's confirm or correct marks those lessons helpful or wrong; skip unchanged fingerprints, re-check changed ones; misses become tests.
- **Value Score** on offers: value and time to get it ("worth $40 after strings attached · about 15 minutes · paid within 8 weeks").
- **`v_offer_audit` and `GET /api/offer-audit` + OpenAPI:**
  - a fixed query and rate limit, with saved answers in sample mode;
  - a test that the response has no family fields;
  - estimate: 2–3 hours (`cloud-build-assessment.md` #15).
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
- **Product-matching upgrade (must-do; promoted at sign-off, item 7):**
  - "Fields + hard rules": brand + product type from a fixed list, sale dates, seller, FDA status (finished recalls filtered out), and size or model clash, with an evidence line on each alert.
  - New for round 4: exact-code checks (UPC, model number, lot code) from barcode and photo items, checked first.
  - Test result to quote (`entity-resolution-test.md`): on fresh cases, **7 of 8 real recalls found, with 1 wrong alarm**. Today's matcher found 0 of 12 without AI and 2 of 12 with it.
  - Known fixes: "sold in April 2026" dates; "pad/liner/insert" in the type list.
  - Key areas: `server/agents/recall.ts`, `v_recall_orders` in `scripts/zetaris/register.ts`, `evals/expected.json`.
- **Plaid removal touches this (decided at sign-off, item 8):** `recall.ts:38` and `v_recall_orders` read card-style sample rows today. They are rerouted fully to `purchase_items`: recall matching uses only structured codes (UPC, model number, lot code) from photo and receipt rows; no bank text is matched.
- **Recall verification loop (loop 8, approved, item 41):** the Fact-Checker checks each proposed match against the recall record inside the 2-round cap; no evidence, no alert.
- Formula recalls keep the "check the lot number on the can" line.

**6. Data intake** (section 3). **Order (round 4b): shared pieces and Photo now; Email and Barcode kept for after the hackathon (Lyndsay's decision), designs kept below unchanged.**
- **Shared pieces:**
  - the `purchase_items` table;
  - the `v_purchase_items` view;
  - the `v_recall_orders` change (rebuilt on `purchase_items` only, item 8);
  - the `v_clawback_tx` change (rebuilt on `purchase_items` rows with prices, item 9), and made-up photo and receipt item rows for the sample families so money-back cards still appear in sample mode;
  - the daycare invoice card and its sample data removed (item 10);
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
  - **the photo intake loop** (section 1b, loop 7; approved at sign-off, item 40; field rules from item 32): code checks on the fields (required fields, UPC check digit, model-number and lot-code shape, values found in the label text), one retry to the vision model with what was wrong, then a "clearer photo / close-up of the label or can bottom" request to the parent;
  - saved answers;
  - sample label photos (credited CPSC recall-notice photos, approved item 6) and made-up receipt images;
  - vision model defaults from item 4, kept as settings.
- **Tests:** field accuracy, made-up rate (target 0), recall alerts right and caught, rejects (`research-photo-barcode-intake.md` §6), plus a test that a bad first reading triggers exactly one retry and then the "clearer photo" request.
- **Done when:**
  - the photo path puts rows into `purchase_items` (and, after the hackathon, each other path that is built);
  - the recall check finds a planted recalled item through Zetaris, with its evidence line;
  - no name, address, raw email or photo is stored anywhere.
- **How real each path is: decided in round 4b (photo first).**

**7. Onboarding + Version B UI** (must-do, confirmed in round 4c; section 7; sign-off answers on wording, ZIP and sign-in are in section 7). Built from Lyndsay's mocks in `onboarding-design/project/`: the top row first, then the bottom row (Version B). Key areas: `client/src/pages/Onboarding.tsx`, the Version B tab screens, and the run request in `server/routes/bundleRoutes.ts`. Estimates (`cloud-build-assessment.md`): top row 4–5 hours, Version B 5–7 hours.

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
- **Also in the README and `metadata.json` (sign-off item 44):** "H-MEM: shared workspace, newsroom-loop lessons and case law. Markovian and World Model not used: our AI steps are short, and Zetaris + `offer_checks` already hold shared facts." Offline-made evidence is labelled as offline; nothing is presented as a live run unless it was one.

**9. Neon results table** (must-do, upgraded at sign-off, item 20)
- **Goal:** every finished run is saved to a Neon table (`run_results`: run id, family id (sample families only), trace id, started and finished times, status, whether it was sample mode, and the full result), so results survive a server restart and the instant saved feed has something to show. The server reads it back when a run is no longer in memory.
- **Key areas:** `shared/schema.ts` (add the table and add its name to `BUNDLE_TABLE_NAMES`), `server/bundleStore.ts`, `server/routes/bundleRoutes.ts` (today runs live only in an in-memory list, `runs`, line 57), `client/src/lib/bundle.ts`.
- **Done when:** a run's result is still served after a server restart; a clean download with `SAMPLE_MODE=true` and no keys can run the sample families and read back their saved results; a test covers both.

**10. Agent trace log (JSONL) and the Owner View Agent Workspace / Trace panel** (must-do, sign-off item 33 and Part 2; section 1c)
- **Goal:** every agent writes Lyndsay's required log lines; the owner view shows the loops and retries from them.
- **Key areas:** `server/agents/trace.ts` (add the second writer), every agent file in `server/agents/`, `server/adapters/zetaris.ts` and `server/adapters/memory.ts` (pass the calling agent's name), `server/routes/bundleRoutes.ts` (a reviewer-only route for the log), the owner view in `client/`.
- **Done when:** every run writes `logs/run_<trace_id>.jsonl` with one line per agent event, every line has exactly her 10 fields with values from her lists, and the same lines print to the screen log; a test checks this for a sample run; the owner view's Agent Workspace / Trace panel, behind the reviewer code, shows each loop's rounds for that run (send-backs, the rebuttal round, photo retries, recall verifications, saved verdicts reused); the parent view never shows it.

**11. Route the two direct database reads through Zetaris** (must-do, small; approved, item 14)
- **What:** the family profile in live mode (`server/agents/orchestrator.ts:48-55`) and the Coach's reports (`server/bundleStore.ts:76-79`) are read through Zetaris views instead of straight from Neon. Each new question needs one live recording run before sample mode can replay it (Mac flip-on checklist).
- **Done when:** no agent reads agent input from Neon directly; the tests use a fake Zetaris for both reads; sample mode still works (falling back honestly until the saved answers are recorded).

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
- **Add purchases:** a **"+" button on every tab** opens the intake paths: "take a photo" for the hackathon; forward receipts and scan a barcode are kept for after the hackathon (round 4b).
- **Expecting families** get the same tabs, adjusted:
  - Home leads with free gifts;
  - deadlines say "starts at birth" instead of "10 days left".
- **Light versions of the middle-row extras:**
  - an "I got this" tick on cards, with "$ claimed" on Home;
  - a small share bar;
  - a "Save your list" card on Home.
- **Accounts:** Better Auth on Neon, Google only (`gap-answers.md` decision 3, confirmed in round 4b). How much real sign-in is built (approved, item 21): get an estimate first; if over 3 hours, ship the "Save your list" card as a labelled demo (should-do).
- **Wording:**
  - The mock's Taxes tab shows the Dependent Care FSA as "Through work, 10 days left". It must use the decided "Check with your job" card instead (no dollars).
  - The big number says **"savings and tax credits"**, not "cash", with a "How we got this number" link (approved, item 22).
  - The ZIP screen: the parent types a ZIP; at most a "Use my location" button, no automatic location pre-fill (approved, item 23).
  - No daycare invoice card (sign-off item 10).

All numbers come from the real run, never typed into the page. Full screen spec: `onboarding-spec.md` (parts of it are out of date; see `onboarding-design/round4-mock-review.md` §3).

## 8. Timeline

**Honest hours vs. time left (information only, not a decision).**
- **Work estimate:** `cloud-build-assessment.md` puts the whole build at **about 75–90 hours of coding-agent work** (written before the photo research). The photo research then put barcode at 6–8 hours and photos at 9–12 hours, against that file's 4–6 hours each. With email and barcode moved to after the hackathon (round 4b), roughly 14–17 hours of intake work leave the hackathon build; the loop and speed work in section 1b adds some back (not yet estimated).
- **Time left:** many pieces are independent, so several agents can work at once. From Saturday evening to the Monday 3pm Boston code freeze (decided, round 4c) is roughly 40 hours on the clock.
- **Mac-only:** the Nightshift switch-on, the real-AI rerun and the video need Lyndsay at the Mac.
- **Cut order:** set Sunday midday from the agents' estimates, using the approved order for loop and screen work (section 6; items 19 and 39).

| Day | What happens | Done when |
|---|---|---|
| Sat Oct 24 | **Lyndsay:** signed off (section 10 resolved); Nightshift setup steps A–F if possible. **Build (cloud):** Nightshift adapter + fake-server tests, including the per-call time limit, one retry and the 300-second run budget (section 1b, "Keeping the loops fast"); **the agent trace log writer (section 1c)**; local database setup with every new table (`purchase_items`, `offer_checks` with the Strategy 2 fields and `payout_wait_days_min`, `run_results`, `tax_parameters`, `state_programs`); owner view split; any-state rules + work-question cut + Plaid clean-up (including the daycare card removal); recall safety (finished-FDA filter, `no_false_recall`) | Tests green; owner view behind the token; `state_agnostic` and recall tests pass; `offer_checks` and `run_results` tables exist; a sample run writes `logs/run_<trace_id>.jsonl` in her format |
| Sun Oct 25 | **Build:** fine-print tests, verdicts, Value Score with the "worth your time" defaults, **the Zetaris saved-verdict query (item 38)**, the newsroom loop (grades saved to `offer_checks` and fed back through Zetaris and Meterless H-MEM; the skip for unchanged fingerprints and universal rules), Lyndsay's three agent-to-agent loops and the shared workspace in H-MEM, **the one rebuttal round** and the side-by-side Court, the fast screen (saved feed from `run_results`, streaming cards by server-sent events, status pills), `v_offer_audit`, **`GET /api/offer-audit` + OpenAPI**; intake shared pieces, **the photo path and its intake loop (loop 7)**, `purchase_items` as the only source for recalls and money back; **the recall verification loop (loop 8)** and the product-matching upgrade; the two direct reads routed through Zetaris; **the Owner View Agent Workspace / Trace panel**; **onboarding top row + Version B screens from her mocks (must-do)**. **Midday:** set the cut order from the agents' estimates. **Sunday evening (Mac):** after the Nightshift update, flip-on checklist steps 1–8 (`cloud-build-assessment.md` §4) | Fine-print tests green; a second offer's trace shows the past grades and H-MEM lessons used; endpoint answers with no family fields; a sample photo becomes a `purchase_items` row and a bad reading triggers one retry then a "clearer photo" request; a disputed offer shows exactly one rebuttal round; the trace panel shows the loops for a sample run; onboarding works on both paths; a first Nightshift trace names the provider and model |
| Mon Oct 26 | **Mac:** 9am Boston go/no-go on Nightshift (item 12); register new tables and views in Zetaris (including the saved-verdict view and the two rerouted reads), record saved answers, real-AI rerun (`eval:live-model`) with the first live vision-model answers, `examples:regen`. **Build:** evidence and README (with the Meterless honesty note, item 44), including a saved trace log (`logs/run_<trace_id>.jsonl`, from a real run) that shows each built loop (the newsroom loop, send-backs, the debate and its rebuttal round, photo retry, recall verification). **Code freeze 3pm Boston (decided)**, then a clean-copy rehearsal. Video in the evening, on the Mac | Scoreboard and traces saved with the real provider named; README matches files |
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

## 10. Proposals: resolved Oct 24 (sign-off)

**Resolved Oct 24 (sign-off).** Lyndsay approved every proposal below, except the ten she changed (`lyndsay-final-directives.md`, Part 1): her versions of #8, #9, #10 (dropped), #20 (must-do), #29 (one rebuttal round), #33 (must-do trace panel), #38, #40, #41 and #44 are recorded at the top of this plan ("Sign-off") and in the item itself. Every approved item is now written into the body, the must-do and should-do lists and the timeline. The list is kept, with its original wording, for the record; each item's outcome is shown in **[brackets]**. Item numbers are unchanged.

1. ~~How real each intake path is by Oct 27.~~ **Answered by Lyndsay (round 4b): photo first; email and barcode kept for after the hackathon.** Kept here so the numbering of other items doesn't change.
2. **[Approved for when email returns, after the hackathon; section 3.]** **Live Agentmail inbox as the first email piece to drop if short on time.** *Now parked with email (after the hackathon).* *Proposal for when email returns:* yes, keep "Use sample receipts" either way. *Why:* the sample version is the part judges can run without keys.
3. **[Approved: `seller` and `quantity` kept on `purchase_items`; section 3.]** **Keep "seller" and quantity on item rows.** *Proposal:* keep seller. *Why:* the matcher's seller rule needs it, and it isn't personal data.
4. **[Approved; section 3.]** **Which NVIDIA vision model is the default.** *Proposal:* Nemotron 3 Nano Omni as the default, Nano 12B v2 VL for receipts, and try 3.5 Super VL as an upgrade. *Why:* Omni reads labels and objects and is tested by others; Super VL is 9 days old.
5. **[Approved for when barcode returns, after the hackathon; section 3.]** **Barcode: one photo, or also a live camera scanner.** *Now parked with barcode (after the hackathon).* *Proposal for when barcode returns:* one photo first. *Why:* it works on every phone; the live scanner adds 1.5–2 hours and needs real-phone testing.
6. **[Approved; section 6 item 6.]** **Use CPSC recall-notice photos (credited) as sample item photos.** *Proposal:* yes. *Why:* they show the real "Model No" labels, and they are public government images, not personal data.
7. **[Approved: must-do item 5.]** **Promote the product-matching upgrade from should-do to must-do.** *Proposal:* yes. *Why:* every intake path feeds it, and today's matcher finds 0 of 12 recalls without AI.
8. **[Changed by Lyndsay: reroute fully to `purchase_items`; recall matching uses only structured photo/receipt codes (UPC, model number, lot code), never bank text; sections 3, 5, 6.]** **What happens to the card-style sample rows now that Plaid is out.** The Clawback Hunter's money-back cards and today's recall view read them. *Proposal:* stop feeding them into recall matching, and point the Clawback Hunter at `purchase_items` for money back. *Why:* a bank line never names the product, so in recall matching it can only cause wrong alarms.
9. **[Changed by Lyndsay: money-back cards come only from `purchase_items` (photos and receipts); sections 3, 5, 6.]** **Clawback money-back cards: their purchase source depended on Plaid (now removed).** *Proposal:* same as item 8, using receipt and photo item rows with prices. *Why:* without some purchase source the Savings tab's money-back cards go empty.
10. **[Changed by Lyndsay: dropped completely; section 6 "Cut".]** **Daycare demo and daycare invoice.** The daycare demo depended on a Plaid line, now removed. *Proposal:* drop the daycare-invoice card for the hackathon. *Why:* your FSA decision is a "Check with your job" card with no dollar amount, so an invoice adds little.
11. **[Approved; sections 1b and 6 item 2.]** **Nightshift fallback order.** *Proposal:* Nightshift → NVIDIA Nemotron direct → saved offline text. *Why:* keeps NVIDIA in every real run and never leaves the demo blank.
12. **[Approved; section 6 item 2 and timeline, Monday.]** **Monday 9am Boston go/no-go on Nightshift.** *Proposal:* yes; if Nemotron isn't answering through Nightshift by then, rerun with NVIDIA direct, labelled. *Why:* leaves time for the rerun and video before the 3pm freeze.
13. **[Approved; sections 1b and 6 item 2.]** **Which Nemotron for the Judge.** *Proposal:* Nemotron 3 Super with "thinking" off. *Why:* slowness is our main AI failure.
14. **[Approved: must-do item 12; section 6 item 11.]** **Route the two direct database reads through Zetaris** (family profile; the Coach's reports). *Proposal:* yes. *Why:* makes "Zetaris is the only way agents read data" fully true; the views and tables are already registered, so it's a small fix.
15. **[Approved; section 5 and must-do item 7.]** **Replace the judges' line "the AI decides the hard cases".** *Proposal:* "Zetaris finds candidate matches across private and public data in one question. Code rules make the safety decisions and show their evidence. The AI argues over fine print, explains, and fills gaps the rules can't, and code can overrule it." *Why:* in the design, rules decide alerts; a judge reading the code would spot the mismatch.
16. **[Approved; section 5.]** **How to count Zetaris joins on slides.** *Proposal:* name the real cross-source joins (purchases × live recalls; `offer_checks` × live recalls), plus per-helper views, rather than "four joins". *Why:* only questions that combine two different places count as cross-source; an exact count is safer with technical judges.
17. **[Approved as should-do (if time); section 1.]** **Add open CPSC recalls per brand to `v_offer_audit`.** *Proposal:* yes if time (1–2 hours). *Why:* gives the brand report card a safety column.
18. ~~Parent taps feed Meterless memory confidence.~~ **Answered by Lyndsay (round 4c): parent taps come later, not in this draft's build.** Kept here so numbering doesn't change.
19. **[Approved: set Sunday midday with item 39's order; section 6.]** **Set a cut order.** *Proposal:* decide Sunday midday, once coding agents have given estimates for the unestimated pieces. *Why:* the work exceeds the time; a known order beats cutting in a panic.
20. **[Changed by Lyndsay: MUST-DO; section 6 item 9.]** **Neon results table** (saved results survive a restart). *Proposal:* should-do. *Why:* the judges' default path is saved replay; no file estimates it.
21. **[Approved as should-do; section 7.]** **How much real Google sign-in to build for "Save your list"** (your recorded accounts decision). *Proposal:* get an estimate first; if over 3 hours, ship the Save card as a labelled demo. *Why:* `gap-answers.md` puts all four onboarding gaps at 12–16 hours.
22. **[Approved; section 7.]** **"Cash" wording in the big number.** *Proposal:* "savings and tax credits", plus a "How we got this number" link. *Why:* the $1,000 goes into an account and tax credits arrive next spring.
23. **[Approved; section 7.]** **Location pre-fill on the ZIP screen** (the mock says "Filled in from your location"). *Proposal:* the parent types a ZIP; at most a "Use my location" button. *Why:* avoids a browser permission box that needs its own explainer screen.
24. **[Approved; section 6 "Cut".]** **Hosted site at all.** *Proposal:* stay local; GitHub, offline replay and the video are enough. *Why:* a host can't reach the Mac, and a public tunnel would expose the Nightshift token.
25. **[Approved; section 3.]** **Phone-camera testing.** *Proposal:* test photo (and later barcode) with the Mac's webcam at `localhost`. *Why:* phones only allow the camera on secure pages, and a hosted site isn't decided.
26. **[Approved: no separate panel is built; the Judge fills that role.]** **The "Parent Panel" name in Strategy 2.** *Proposal:* the Fine Print Court's Judge fills that role; don't build a separate panel. *Why:* the panel was never built, and the Court already saves the judgment.
27. **[Approved; must-do item 7.]** **Year-one "what a middle-class family can get back" table in the repo.** *Proposal:* yes, short and sourced. *Why:* judges discount value claims without sources.
28. **[Approved; section 6 "Cut".]** **NVIDIA embeddings stay out** (moved out in round 2 to make room for Plaid, which is now gone). *Proposal:* keep them out. *Why:* Nemotron and the vision models are NVIDIA's real jobs now.

**New in round 4b (from the loops and speed work in section 1b):**

29. **[Changed by Lyndsay: yes, strictly capped at 1 round (a critique loop); must-do item 9; section 1b loop 5.]** **Add one rebuttal round to the Fine Print Court.** Each side answers the other's argument once before the Judge rules. *Proposal:* yes, fixed at one round, and only for offers where the code screen and the first arguments disagree. *Why:* a real back-and-forth is what judges look for in "critique loops"; limiting it to disputed offers keeps the extra AI calls (2 per offer) small.
30. **[Approved; must-do item 9.]** **Judge the court's offers at the same time, and run the Deal Hunter and Fine Print Lawyer side by side.** Today offers are judged one after another and the two arguments are asked one after the other (`finePrintCourt.ts` lines 92–93 and 174–175). *Proposal:* yes, with a limit of a few at once. *Why:* the arguments don't depend on each other, so this cuts the Court's waiting time roughly in half or more with no change in results.
31. ~~Show cards on the screen as they finish (streaming).~~ **Answered by Lyndsay's latency feedback: progressive card streaming is in her design** (section 1b). Kept here so numbering doesn't change.
32. **[Approved; section 1b loop 7.]** **Photo field-check rules for the photo intake loop.** *Proposal:* required fields = product name plus at least one code (UPC, model number or lot code) or a brand; a UPC must pass its check digit; a code must be 3–20 letters/digits with at most a few dashes or spaces. *Why:* these are the checks code can do without the AI, so they decide the single retry; the exact limits should be tuned on the sample photos.
33. **[Changed by Lyndsay: MUST-DO, an Agent Workspace / Trace panel in the Owner View showing loops and retries; sections 1c, 4, 6 item 10.]** **Where the loops show for judges.** *Proposal:* a "How the agents worked together" panel in the owner view listing each loop's rounds for the run (send-backs, debate, photo retries), drawn from the existing trace lines. *Why:* the judges look for "where retries and feedback loops occur" (`strong-submission-examples.md` §2); the trace already records them.
34. ~~Parent taps tuning `confidence_score` vs. her earlier decision.~~ **Decided later (Lyndsay, round 4c):** parent-tap confidence tuning is not in this draft's build; it comes later. The newsroom loop (section 1b) is the visible loop now. Kept here so numbering doesn't change.
35. **[Approved as a rule; section 1b loop 2.]** **Eligibility loop: which counter-questions the Lawyer may ask.** *Flag, not resolved:* her example uses job tenure and start date, but the work question is cut, so Bundle doesn't have that data. The Lawyer's counter-questions must use data we do have: state, due or birth date, ZIP, and the stored rule tables (`tax_parameters`, `state_programs`). *Example:* "Your state's paid-leave rule needs the baby born or placed within the last 12 months: ask Zetaris for the family's birth date and the state's window before approving." Anything needing job data stays on the "Check with your job" card.
36. **[Approved as a rule; section 1b loop 1.]** **Safety-value loop: real recall records only.** *Flag, not resolved:* the loop may only use real CPSC and openFDA recall records (finished FDA recalls filtered out). There is no "pending review" or rumour source, and none should be invented.
37. **[Approved; section 1b workspace.]** **Message format for the shared workspace.** Lyndsay was offered a JSON event schema (a fixed shape for the messages agents send each other). *Proposal:* one shape for every message, `{run_id, from_agent, to_agent, type (claim / question / answer / correction / verdict), about (card or offer id), body, evidence_sql, round}`, stored as trace lines in Neon. *Why:* the trace already records agent steps, so the bus and the judges' trace stay one thing. *(Round 4c: the workspace notes live in Meterless H-MEM, section 1b; the same shape works as an H-MEM note, with the trace line as a copy.)*
38. **[Changed by Lyndsay: implement (Zetaris searches the agents' saved results); must-do item 4; section 1.]** **The Zetaris question that pulls saved verdicts.** *Proposal:* one fixed query per run that reads `offer_checks` for the offers in play, returning the latest `verdict`, `status`, `rule_citations`, the value-and-time grade (`true_value_cents`, `effort_minutes_estimate`, `steps_count`, `payout_wait_days_max`, `claim_window_days`), `fine_print_hash` and whether the cited rule is universal, through a view with no family data. *Why:* it powers both the instant saved feed and the "skip the AI" step; it needs one live recording run for sample mode.
39. **[Approved; section 6 "Cut order".]** **Cut order for the loop and screen work.** *Proposal:* if time runs short, keep in this order: the targeted-correction loop (mostly built) → safety-value loop → instant saved feed and streaming cards → eligibility loop → status pills → server-sent-event push (fall back to today's once-a-second polling). *Why:* it keeps what judges score (visible loops) first and the screen polish last. Lyndsay decides.
40. **[Changed by Lyndsay: yes; must-do item 8; section 1b loop 7.]** **Photo intake loop (section 1b, loop 7).** Added by an agent in round 4b, not in Lyndsay's feedback. *Proposal:* code checks what the vision model read, one retry told what was wrong, then ask the parent for a close-up (exact rules: item 32). *Why:* photo is her priority path, and a misread label would give a wrong recall match; it is also a visible loop for judges.
41. **[Changed by Lyndsay: yes; must-do item 5 and 9; section 1b loop 8.]** **Recall verification loop (section 1b, loop 8).** Added by an agent in round 4b, not in Lyndsay's feedback. *Proposal:* the Fact-Checker checks each recall match against the recall record inside the existing 2-round cap; no evidence, no alert. *Why:* a false recall alert scares a parent and breaks trust.

**New in round 4c:**

42. **[Approved; the numbers were left blank, so labelled adjustable defaults are set in section 1 ($5; 30 minutes for under $20; 90 days) and `payout_wait_days_min` is added.]** **The "worth your time" rule, and a payout range.** Lyndsay decided that value and time together decide "worth your time"; the cut-off is not decided. *Proposal (numbers for Lyndsay to set):* show value and time side by side on every approved offer, and label an offer "probably not worth your time" only when the true value is under **$X**, or the effort is over **Y minutes** for under **$Z**, or the payout wait is over **W days**, using fields already in `offer_checks`, tuned on the 12 fine-print tests. *Note:* a value-per-minute cut-off would act like an hourly rate, which round 2 avoided. *Also:* "paid in 6–8 weeks" needs a new shortest-wait field (`payout_wait_days_min`); without it the card says "paid within 8 weeks". *Why:* a clear rule turns the numbers into a verdict a parent can trust.
43. **[Approved as should-do (only if time, between runs).]** **Run H-MEM's "dreaming" between runs.** Dreaming groups related grading lessons and proposes a general one ("drugstore mail-in rebates usually pay in 6–10 weeks"); the engine's own approval rule keeps only well-supported ones. *Proposal:* only if time, as a between-runs script, never during a run. *Why:* more visible Meterless work for judges at no cost to speed.
44. **[Changed by Lyndsay: yes; must-do item 7; section 6 item 8.]** **Say which Meterless engines we used, and why not the others, in the README and `metadata.json`.** *Proposal:* "H-MEM: shared workspace, newsroom-loop lessons and case law. Markovian and World Model not used: our AI steps are short, and Zetaris + `offer_checks` already hold shared facts." *Why:* the sponsor overview asks teams to name the engines and where; honesty about what isn't used reads well with technical judges.

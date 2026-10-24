# Bundle: future-state grade of the plan (Sat Oct 24, 2026)

**What this grades:** `bundle-plan-v3.md` (round 2, with the product-matching section filled in), scored **as if every must-do and should-do in it were built and working**. It does not grade today's app (that is `regrade-2026-10-24.md`: 53 today, about 74 projected under the morning plan).

**Lyndsay's ground rules for this grade:** focus on hard-to-reverse choices (innovation, technical approach, impact, real use of sponsor tech). Skip mechanical submission items (public repo, video upload, metadata links). Measure against `hackathon-overview.md` §4, §13, §14 and the quality bar in `strong-submission-examples.md` / `weak-submission-examples.md`. Decisions already made in `TRACKING-oct24-plan-update.md` (keep Plaid, Neon not Supabase, no poverty/WIC angle, no confidence bands, no Redis, MCP later) are not re-argued; one is flagged where it carries real risk, with the reason.

**Words used a lot here**
- **Agent:** one AI helper with one job, run as its own step in code.
- **Orchestrator:** the "manager" code that starts the agents and collects their results.
- **Fan-out:** the manager starts several agents at once, each doing its own thing, then gathers results. The opposite of agents deciding, mid-run, who should do what next.
- **Fallback:** a pre-written or rule-based answer used when the AI doesn't respond.
- **Trace:** the step-by-step log of one run, one line per agent step.
- **Cross-source join:** one database question that combines rows from two or more separate systems (for example, our Neon database plus the government's live recall feed).
- **Replay / cache:** saving a real answer once, then playing it back later so the app works without keys.
- **Nightshift:** Meterless's app that turns a Mac into a private AI server for other apps. **Nemotron:** NVIDIA's family of AI models. **H-MEM:** Meterless's memory engine.

---

## 1. Summary (5 lines)

1. **Future-state score: 77 / 100** (likely range 70 to 81). That is about 3 points above the regrade's projection (`regrade-2026-10-24.md` §3, 74), mostly because of round 2: any-state rules, 12 fine-print tests with controls, and a recall matcher backed by a fair test.
2. **The plan's best decisions are hard to copy and judges will credit them:** code decides money and safety while the AI advises; "approve, with a catch" with a true-value number; a recall matcher that shows its evidence; and the honest line "Bank data tells us where you shop. Order history tells us what you bought."
3. **The biggest gap is structural:** judges will run the no-keys sample mode, and in that mode every AI step is a fallback. Real AI only ever runs on Lyndsay's Mac (Nightshift lives at `127.0.0.1`, "this same computer"). So the judges' own run shows a keyword screen, not the Court.
4. **The second gap is the agent pattern itself:** a fixed fan-out of four agents plus a Fact-Checker send-back. The strong examples show agents that change the plan mid-run (a Planner re-plans, a Source Mapper adds a missing source). Bundle has the ingredients for this but doesn't use them.
5. **Top 3 fixes:** (1) record the real Nightshift → Nemotron answers and replay them in sample mode; (2) add a "coverage gap" branch where the Recall Checker notices card spending with no item list and asks for order history; (3) make the Amazon order upload a real step (the code already exists).

---

## 2. Score per criterion (future state)

| Criterion (weight) | Score | Regrade projected (for comparison) | Why |
|---|---|---|---|
| **Impact (30)** | **22** | 21 | See 2a |
| **Technical (20)** | **15** | 15 | See 2b |
| **Innovation (15)** | **12** | 11 | See 2c |
| **Demo (15)** | **12** | 12 | See 2d (graded on what the plan lets you show, assuming a competent video) |
| **Product & UX (10)** | **8** | 8 | See 2e |
| **Sponsor Tech (10)** | **8** | 7 | See 2f |
| **Total (100)** | **77** | 74 | Range 70 to 81 |

### 2a. Impact: 22 / 30

**Credit:**
- Clear user (a new parent, any US state, middle-class) and a clear Track 1 fit ("Solving Fragmented Intelligence", `hackathon-overview.md` §6): private purchases joined with live CPSC and openFDA recall feeds in one question (`bundle-plan-v3.md` §3; `architecture.md` §2).
- Any-state rules with no Massachusetts in code, a guard test, and a "swap test" (change a data row, the card changes with no code edit) (`bundle-plan-v3.md` §4 item 4; `audit-ma-poverty-evals.md` §1c-1d). This removes the regrade's main Impact complaint ("a real parent outside Massachusetts gets federal benefits and offers only").
- Money comes from code and is fact-checked; benefit figures are official 2026 numbers with source links (`audit-ma-poverty-evals.md` §2b).
- The Value Score is now defined (true value = face value minus hidden costs, plus an effort badge and a list of catches) (`bundle-plan-v3.md` §4 item 5), which answers the regrade's objection that it had no formula.

**Held back by:**
- **A real parent still can't get the two headline features.** Recalls need item-level data (`entity-resolution-test.md` §1), the Amazon upload is still a "coming soon" tile (`bundle-plan-v3.md` §6), and Plaid connect is limited to demo families (§4 item 3). A typed-in family gets benefits and offers, not recalls or money back.
- **Plaid adds less than it seems.** Bank lines carry only store, amount and date (`entity-resolution-test.md` §1). That is enough for Dependent Care FSA daycare bills and "baby spending", but FSA-eligible items and store price-drop windows also need item names, so most "money back" still depends on order data.
- **The value claim must be in the submission.** The WIC statistic is being removed and the ~$9,210 figure lives outside the repo (`regrade-2026-10-24.md` red flag 12). The plan says "replace with a checked middle-class one" but doesn't name it.

### 2b. Technical: 15 / 20

**Credit:**
- Code-over-AI authority: a code "reject" always beats an AI "approve" (`bundle-plan-v3.md` §4 item 5), which closes the regrade's red flag 5 and makes prompt injection testable (FP-12).
- A serious test plan: 12 fine-print tests plus 3 "must still approve" controls, the 5-family `state_agnostic` test, `no_false_recall`, a test that the parent payload hides agent internals, a test that the brand audit answer has no family fields (`bundle-plan-v3.md` §4 items 1, 4, 5, 6).
- Recall matching is backed by a fair held-out test (7 of 8 found, 1 wrong alarm, on cases written after the rules were frozen) and the plan quotes that number, not the flattering 12 of 12 (`entity-resolution-test.md` §3; `bundle-plan-v3.md` §4 item 6).
- The owner view is trimmed on the server, not just hidden in the screen (§4 item 1).

**Held back by:**
- **The judges' run is offline.** `SAMPLE_MODE` replays real Zetaris answers but uses fallbacks for every AI step (`architecture.md` §8). Real AI is only in committed trace files from Lyndsay's Mac. The strong-vs-weak table says the ideal is "real logic, with sample mode for inputs only" (`strong-submission-examples.md` §14).
- **Live run time has no ceiling.** Nightshift calls can wait up to 180 seconds each, Nemotron reasoning models are slow, and live Zetaris took 13 to 171 seconds. A run makes many AI calls (up to 15 for the Court alone plus up to 25 recall checks, `architecture.md` §7h). There's no overall run deadline in the plan (`architecture.md` §7d names the gap).
- **Privacy views are still a convention**, not locked by database permissions (`architecture.md` §7f); the plan doesn't schedule the read-only login.
- **The Court's reliability with a real model is unproven.** The only real-AI runs so far had the Judge fail 4 of 5 times and the AI matcher hang (`regrade-2026-10-24.md` red flag 3; `entity-resolution-test.md` §3). The Sunday Nightshift update targets this, but it's outside your control.

### 2c. Innovation: 12 / 15

**Credit:**
- Fine Print Court with three verdicts, including "approve, with a catch," where the Receipt counts only the true value. Most deal apps say yes or no.
- Parent reports become "case law" in H-MEM that changes the next run's ruling, with a human approving each rule.
- `offer_checks` as a growing, family-free dataset with a wording fingerprint (`fine_print_hash`, which notices when a brand edits its terms) that doubles as a brand audit product (`audit-ma-poverty-evals.md` §3d). That's a two-sided idea (parents and brands) most entries won't have.
- An evidence-first recall alert ("brand ✓, type ✓, bought inside the sale window ✓, check the label for model ...") instead of a confidence number.

**Held back by:**
- **The collaboration pattern is familiar.** Four agents run side by side, then a checker sends wrong cards back. Judges want "agents delegate tasks dynamically based on context" and "planner, executor and evaluator iterate together" (`hackathon-overview.md` §4). There's no step where one agent's finding changes which agent runs next.
- **The AI's own contribution may look small.** With code overriding the Judge, code filling dollar fields, and rules raising recall alerts, a skeptical judge may ask "what does the AI do that code doesn't?" The plan doesn't show which fine-print catches only the AI made.

### 2d. Demo: 12 / 15

The plan gives strong moments to show: onboarding in 5 taps, a Recall alert with its evidence line, "We caught these for you," the owner view with the Court debate, and run 2 blocking a trap because of a learned rule. Held back by: Plaid's standard test bank shows coffee and airline purchases, not baby items (`bundle-plan-v3.md` §4 item 3), and the live run may be too slow to show uncut. (Recording, length and upload are mechanical and not graded here.)

### 2e. Product & UX: 8 / 10

One question per screen, any ZIP works with a calm "We don't have [State] programs yet" note, the work-benefits answer is actually used, a single calm list, and a Value Score in plain words (`bundle-plan-v3.md` §4 item 7, §8; `onboarding-spec.md`). Held back by: "Connect a card" leads to generic purchases for most parents, and the Amazon tile is "coming soon," so the most useful action on the page doesn't work yet.

### 2f. Sponsor Tech: 8 / 10

- **Zetaris:** load-bearing; every agent reads through it; the purchases × live recalls join is genuinely cross-source; `offer_checks` registered as its own source (`architecture.md` §2). But the plan's "four joins" are mostly tables in the same Neon database (`tax_parameters`, `state_programs`, ZIP table, `offer_checks` all live in Neon). Only the recall join crosses systems. A careful judge will notice.
- **Meterless:** Nightshift as the main AI with Nemotron behind it matches the strong example almost word for word ("All model calls ... run through Meterless ... The agents reason with NVIDIA Nemotron, reached through Meterless", `strong-submission-examples.md` §5). H-MEM is load-bearing for learning but thin: it uses a stand-in "hash" matcher and `feedback()` isn't wired to parent taps (`research-nightshift.md` §5).
- **NVIDIA:** a real job (Nemotron answers the hard steps) **if** Nemotron is reachable through Nightshift. With the one fallback (Nightshift's own models), NVIDIA drops to zero, because NVIDIA embeddings were moved out. Score would be 7 in that case.

---

## 3. Top 5 hard-to-reverse risks or gaps, each with a fix

These are ordered by how many points they put at risk and how hard they are to change after Monday's 3pm code freeze.

### Risk 1: judges never see the real AI run (Technical, Innovation, Sponsor Tech)
**Why it's hard to reverse:** Nightshift lives on your Mac, and the hosted site can't reach it (`bundle-plan-v3.md` §4 item 2). `SAMPLE_MODE` uses fallbacks for every AI step (`architecture.md` §8). After the freeze, the judges' default experience is locked in as "keyword screen and two pre-written rule sentences," the exact thing the regrade's judge quote mocks (`regrade-2026-10-24.md` §3, Innovation row).
**Fix:** when you do the Monday real-AI rerun, **save every Nightshift answer** (keyed by a fingerprint of the question), the same way Zetaris answers are already saved in `data/sample/zetaris-cache`. Then make `SAMPLE_MODE` replay those saved real answers first, and only use the fallback when no saved answer exists. Label each one on the owner view: "recorded Nightshift → Nemotron answer, Oct 26." Judges then see the real Court debate on their own computer, with no keys. About 3 to 4 hours. It must be built **before** the Monday rerun, or the answers aren't captured.

### Risk 2: the agent pattern is a fixed fan-out (Innovation, Technical)
**Why it's hard to reverse:** the orchestrator's shape decides what the traces can ever show (`architecture.md` §3). Judges are told to look for "dynamic delegation" and "branching" (`hackathon-overview.md` §14; `strong-submission-examples.md` §3), and the Track 1 strong example has a Source Mapper that "adds a source when coverage is missing" (`strong-submission-examples.md` §9, SupplyLens).
**Fix:** add two small, real branches, both built from things the plan already has:
- **Coverage-gap branch (the Track 1 move).** When the Recall Checker sees Plaid card lines at baby stores (Amazon, Target, buybuy BABY) with no matching order rows (the plan's store + amount + date link, `bundle-plan-v3.md` §4 item 6), it logs `coverage_gap` and hands a request back to the orchestrator, which adds an "Add your Amazon orders to check these 4 purchases for recalls" card. One agent's finding decides what happens next, and it's visible in the trace.
- **Evidence send-back in the Court.** The plan already says every dollar figure must appear in the quoted fine print (§4 item 5). Make that a loop: if the code can't find the Lawyer's `evidence_quote` word for word in the fine print, the Lawyer is sent back once to quote again. That's a critique loop between AI and code, the pattern in the strong trace (`strong-submission-examples.md` §4).
About 3 to 4 hours for both. Promote at least the coverage-gap branch into the must-do list.

### Risk 3: Plaid is in, but the item data that recalls need is "coming soon" (Impact, Demo). This is the one round-2 decision flagged.
**Not re-arguing "keep Plaid."** The risk is narrower: Plaid costs half a day, forces slow live Zetaris runs (`bundle-plan-v3.md` §4 item 3), and on its own can't power recalls (`entity-resolution-test.md` §1). If the custom test-bank user can't carry baby purchases, the demo shows coffee and airline charges, which reads as "integration for its own sake" (`weak-submission-examples.md` §4).
**Fix:**
- **Answer the plan's open question "yes": make the Amazon order upload a real onboarding or results-page step.** The upload code already exists (`server/ingest/amazonCsv.ts`, per `entity-resolution-test.md` §4). This is what lets a real parent get recall checks, and it turns Plaid from a side feature into half of the "where you shop + what you bought" story.
- **Decide by Sunday noon whether the Plaid custom test user works.** If yes, give it lines that match a sample family's orders and one daycare bill, so the bank-to-order link and the Dependent Care FSA card both show on camera. If no, demo Plaid only through the daycare card and say plainly the test bank is generic.

### Risk 4: Zetaris "four joins" is an overclaim (Sponsor Tech, credibility)
**Why it's hard to reverse:** the plan, deck and video will all repeat the "four joins" framing (`bundle-plan-v3.md` §3). But only the recall join crosses separate systems; the Benefits Planner, Fact-Checker and `offer_checks` joins all read tables in one Neon database (`architecture.md` §2, Zetaris; `regrade-2026-10-24.md` red flag 9). The weak examples warn that overclaims damage "credibility across every criterion" (`weak-submission-examples.md` §4).
**Fix:** say it accurately: "one live cross-source join (your purchases × government recall feeds), plus governed per-agent views over our rules and the agents' own scorecard." Then do the two cheap things that make the governance claim true: give Zetaris a **read-only** Neon login, and test whether a view can be granted to a role (`architecture.md` §7f, effort M). If grants don't work, the slide says "views are the boundary; permission grants are the production step."

### Risk 5: a slow, uncapped live run, and an AI whose unique value isn't shown (Technical, Innovation)
**Why it's hard to reverse:** the Monday rerun produces the evidence everything else cites. If it takes 20 minutes, times out halfway, or shows the code catching everything, that's what's frozen.
**Fix:**
- Add an **overall run deadline** (for example 3 minutes) and a **per-run AI call budget** (for example 60 calls); after either, the remaining steps use fallbacks and say so (`architecture.md` §7d, §7h; effort S to M). Send only the Judge and Lawyer to Nemotron; send short tasks to `meterless/fast`.
- In the scoreboard, report each fine-print test as **"caught by code / caught by AI / missed."** The hassle test (FP-06), the true-value-after-several-strings test (FP-11) and spotting injection (FP-12) are where the AI should beat code. Showing that answers "what does the AI do?" and protects the Innovation score.

---

## 4. What would most raise the score with 3 days left

Ranked by points per hour. The regrade already warned the must-do list is over budget (`regrade-2026-10-24.md` §5), and round 2 added Plaid, 12 tests and the any-state work, so these fixes should **replace** lower-value work, not add to it.

| # | Change | Points (future state) | Effort | Replaces / cut instead |
|---|---|---|---|---|
| 1 | Save and replay real Nightshift answers in sample mode (Risk 1) | +3 to +4 (Technical, Innovation, Sponsor, Demo) | 3–4 h, before Monday's rerun | Brand audit web address (keep the Zetaris view) |
| 2 | Coverage-gap branch plus Court evidence send-back (Risk 2) | +2 to +3 (Innovation, Technical, Impact) | 3–4 h | Onboarding extras |
| 3 | Amazon order upload as a real step (Risk 3) | +2 (Impact, Product) | 2–3 h (code exists) | Product-matching extras beyond brand + type + date |
| 4 | Run deadline, call budget, "code / AI / missed" scoreboard column (Risk 5) | +1 to +2 (Technical, Innovation) | 2 h | AI soft fields in `offer_checks` |
| 5 | Honest Zetaris wording plus read-only Neon login (Risk 4) | protects 1–2 points | 1–2 h | nothing; do it during the README pass |

With 1 to 4 done, a realistic future-state score is about **82 to 85**.

**What to protect, not trade away:** code-over-AI authority, the 12 fine-print tests with their 3 controls, the `state_agnostic` test, the held-out matching number (7 of 8), and the "bank vs. order" line. These are the parts judges can't find elsewhere.

---

## 5. Where the plan is weaker than the strong-submission examples

| Strong example says | Bundle's plan | Gap |
|---|---|---|
| "Planner sends the Retriever back for usage data only if billing data doesn't explain the churn" (dynamic delegation, `strong-submission-examples.md` §3) | Four agents always run; no agent decides what runs next | No dynamic delegation (Risk 2) |
| SupplyLens's Source Mapper "adds a source when coverage is missing"; the Conflict Critic sends disagreeing records back (`strong-submission-examples.md` §9, Track 1) | The bank-to-order link exists only as a "where possible" note; a missing item list is silent | Track 1's signature move is missing, though the data for it is already planned |
| Strong trace: a source times out, the agent retries with a narrower query and recovers (`strong-submission-examples.md` §4) | One retry on a known Zetaris hiccup; AI timeouts go straight to fallback | Recovery is "give up gracefully," not "try a different way" |
| "Real logic, with sample mode for inputs only" (`strong-submission-examples.md` §14) | Sample mode replaces the AI with fallbacks | Judges' own run shows no real AI (Risk 1) |
| "Runs in minutes, without a local GPU" (`strong-submission-examples.md` §15) | Sample mode does; the real-AI path needs Lyndsay's Mac | Fine for the rules, but real-AI proof exists only as saved files |
| Sponsor explanation: every model call through Meterless on Nemotron, a bigger model for hard steps and a smaller one for planning (`strong-submission-examples.md` §5) | Same setup, if Nemotron is reachable through Nightshift; otherwise NVIDIA does nothing | One outside dependency (the Sunday Nightshift update) decides the NVIDIA story |
| The Evaluator "uses Zetaris directly to check claims" (`strong-submission-examples.md` §5, "What was unique") | Bundle's Fact-Checker already does this, with send-backs (`architecture.md` §3) | **Bundle matches or beats the example here**; say it this plainly in the README |
| Memory "of past decisions changes the current one" (TriageDesk, `strong-submission-examples.md` §9) | H-MEM case law changes run 2's ruling | **Matches**, though thin: a stand-in matcher, and parent taps don't adjust rule confidence |

**Decisions checked and not flagged:** Neon instead of Supabase, no Redis, dropping poverty/WIC, and dropping confidence bands are all sound. The evidence-line matcher is a better answer to "is this my product?" than a number would be (`entity-resolution-test.md` §4). Dropping WIC costs nothing shown in the demo (`audit-ma-poverty-evals.md` summary item 3), as long as the deck gets a checked middle-class statistic in its place.

# Bundle: system flow chart (words only)

Written Sat Oct 24, 2026; updated later that day from `bundle-plan-v3.md` rounds 4b and 4c (section 1b, the agents' loops, and section 3, photo-first intake), `plans/lyndsay-directives/lyndsay-feedback-agent-loops-latency.md` (Lyndsay's agent-loops and speed design, binding), `research-meterless-workspace.md`, `research-nightshift-setup.md`, `progress/tracking/TRACKING-oct24-round4.md`, `research-photo-barcode-intake.md`, `research-email-receipts.md`, `progress/reviews/cloud-build-assessment.md` and the code in `bundle/`.

**The one rule for this page:** anything marked **(planned)** is in the plan but not in the code yet, so it must not be claimed as working. Anything without that mark is in the code today. **(planned, if time)** means a "should-do" that may be cut. **(proposal)** means an agent's suggestion that Lyndsay has not decided yet (plan section 10); it is not in the plan. **(later)** or **"kept for after the hackathon"** means Lyndsay kept the design but it will not be built before Oct 27.

**The five charts:** 1, the whole system; 2, how the agents work together (the network and its loops); 3, keeping it fast; 4, getting a purchase in from a photo; 5, the newsroom loop (the Living Fine-Print Database, the automatic feedback loop, which also feeds the data product).

## Chart 1: the whole system

```text
ZONE 1: USER INPUT   (every family, date, ZIP, receipt, barcode and photo is made up)

+----------------------+  +----------------------------------------------+  +--------------------+
| A. Onboarding        |  | B. "+" Add purchases   (planned)             |  | C. Parent taps     |
|    answers           |  |    one "+" button on every tab               |  |    (small side     |
|                      |  |                                              |  |    input, not the  |
| 1. "We're expecting" |  | B1 Take a photo = the PRIORITY path for      |  |    main loop)      |
|    or "Baby's here", |  |    the hackathon (Lyndsay, round 4b): an     |  |                    |
|    or "Try a sample  |  |    item label (under a walker), a formula    |  | "I got this" and   |
|    family" (1 tap)   |  |    can bottom, or a paper receipt            |  | "Report issue"     |
| 2. baby's birthday,  |  |    (see Chart 4)                             |  | on a card          |
|    or due date if    |  |                                              |  |                    |
|    expecting         |  | Kept for after the hackathon (Lyndsay's      |  | "Not mine" on a    |
| 3. ZIP: any US ZIP   |  | decision; design kept, not built now):       |  | recall alert       |
|                      |  | B2 forward email receipts to Agentmail       |  | (planned)          |
| redesign: top row    |  | B3 scan a barcode with the phone camera      |  |                    |
| of mocks, then       |  |                                              |  | later (decided):   |
| bottom tabs          |  | every path lands in ONE table:               |  | taps tuning a      |
| (planned)            |  | purchase_items (see ZONE 4)                  |  | confidence number  |
|                      |  |                                              |  | (not this draft)   |
+----------+-----------+  +---+------------------------------------------+  +---------+----------+
           |                  |                                                       |
           | [1]              | [4] photo   ([2] email, [3] barcode:                  | [5] on to
           |                  |              kept for after the hackathon)            |
           v                  v                                                       v ZONE 6
+==============================================================================================+
| ZONE 2: GUARDRAILS   (checks that run before and around the AI)                              |
|                                                                                              |
| Input checks     ZIP must be 5 digits, dates must be real and in range, HTML is stripped,    |
|                  only plain ids, numbers and dates ever go into a database question          |
| Photos           the phone strips a photo's hidden location data and shrinks it; the AI      |
| (planned)        sees only the photo (never family details) and must reject any photo        |
|                  showing people, faces or addresses; code checks every field it reads        |
|                  (Chart 4); keep ONLY item facts: store, date, product, brand, model         |
|                  no., lot code, UPC, size, price; the photo is deleted right after           |
|                  reading, never kept in logs, traces or memory. "Forget my items"            |
|                  deletes a family's rows                                                     |
| Email receipts   kept for after the hackathon (design kept): keep only item rows, drop       |
| (later)          the raw email, names, addresses, card digits; read emails deleted;          |
|                  the inbox accepts only our own test address                                 |
| Privacy views    each agent reads its own "safe columns" view: the deal Judge sees no        |
|                  family data, income is masked in logs. Agents read v_purchase_items,        |
|                  never the raw purchase_items table (planned)                                |
| Fine-print data  offer_checks has NO family column; GET /api/offer-audit never returns a     |
| (planned)        family field, and a test checks that                                        |
| Code can         the Fact-Checker sends back or drops wrong cards; an explanation that       |
| overrule the AI  invents a dollar figure is thrown away; the Judge may cite only rule ids    |
|                  memory really returned; no AI answer on a recall = no alert;                |
|                  a code "reject" always beats an AI "approve" (planned)                      |
| Sample mode      SAMPLE_MODE=true: no keys, saved real Zetaris answers, saved AI text        |
| No real data     made-up families, receipts, barcodes and photos; keys never in the repo     |
+======================+=======================================================================+
                       |
                       | [6]
                       v
+--------------------------------------------------+        +-----------------------------------+
| ZONE 3: AGENT SYSTEM  (a network; see Chart 2)   |        | ZONE 4: ZETARIS = THE DATA DOOR   |
|                                                  |  [7]   |                                   |
| Photo reader (planned, priority; Chart 4):       | <====> | One SQL question can reach:       |
|    NVIDIA vision model [9] -> code checks the    |  SQL   |  - Neon database: families,       |
|    fields -> rows saved to purchase_items        |  asks  |    purchases, benefit rules,      |
|                                                  |  and   |    offers, store policies,        |
| 1. Orchestrator: loads the family; asks          |  rows  |    parent reports (feedback)      |
|    Zetaris for saved verdicts FIRST and skips    |  back  |  - purchase_items, through the    |
|    offers already graded (planned, Chart 5);     |        |    safe-columns view              |
|    starts the maker agents at the same time      |        |    v_purchase_items (planned)     |
|                                                  |        |  - offer_checks: a source the     |
| 2. Shared workspace ("bus") in Meterless H-MEM   |        |    AGENTS made, added with        |
|    (planned; today one shared run context):      |        |    REGISTER DATASOURCE TABLE      |
|    a. Clawback Hunter: money back on things      |        |    (planned); asked FIRST on      |
|       already bought (FSA, price drops);         |        |    every run (Chart 5)            |
|       which purchase rows it reads is an         |        |  - tax_parameters and             |
|       open question                              |        |    state_programs (planned)       |
|    b. Recall Checker: purchase items vs.         |        |  - live CPSC recall feed          |
|       recalls; exact codes first (UPC, model     |        |  - live openFDA recalls: only     |
|       no., lot code) (planned); brand + type     |        |    finished ("Terminated") ones   |
|       + date matcher (planned, if time)          |        |    filtered out (planned)         |
|    c. Benefits Planner (Strategy 1, the          |        |                                   |
|       Matcher): programs and deadlines for       |        | Cross-source joins:               |
|       any US state (any-state = planned)         |        | J1 (built): family purchases in   |
|    a <-> b safety-value loop (planned):          |        |    Neon x live CPSC + FDA         |
|       recall on the item? the deal is killed     |        |    recalls, in one question.      |
|       before it reaches the Judge                |        |    Planned: purchase_items        |
|    c <-> Fine Print Lawyer eligibility loop      |        |    (safe view) x live recalls,    |
|       (planned): the Lawyer tries to disprove    |        |    by exact code first            |
|       it; a counter-question -> ask Zetaris      |        | J2 (planned): offer_checks x      |
|    -> candidate cards go to the Court            |        |    live recalls = "truly free     |
|                                                  |        |    and not recalled since we      |
| 3. Fine Print Court: Deal Hunter (for) <->       |        |    checked"                       |
|    Fine Print Lawyer (against) -> the Judge      |        | J3 (planned): offer_checks x      |
|    rules, citing case law (one round, built)     |        |    feedback = Coach's "which      |
|                                                  |        |    fine-print problems show up    |
| 4. Fact-Checker: re-reads each card's source     |        |    most in Report issue?"         |
|    by a different question; wrong -> targeted    |        | Everything else: one filtered     |
|    correction back to the Court or maker         |        | view per agent.                   |
|    agent, max 2, then dropped (basic send-       |        +-----------------------------------+
|    back built; targeted wording planned)         |
|                                                  |
| 5. Assemble: never-empty feed + Receipt total    |        +-----------------------------------+
|    (only checked cards count); cards stream      | -----> | ZONE 6: METERLESS'S JOB           |
|    in (planned, Chart 3); Judge + Fact-          |  [8] AI|                                   |
|    Checker agree -> one row per judged offer     |  calls | Nightshift = the AI switchboard   |
|    to offer_checks (planned). The same rows      |        | on Lyndsay's Mac: every AI        |
|    feed BOTH the newsroom loop (the agents'      |        | question from the agents goes     |
|    next grading, Chart 5) AND the data           |        | there; it passes it to NVIDIA     |
|    product (v_offer_audit + offer-audit          |        | Nemotron with her NVIDIA key,     |
|    address, must-do; Zone 8)                     |        | kept inside Nightshift. It is     |
|                                                  |        | the primary AI provider. Code     |
| Explain: writes each card's plain-English line   | <----- | built and tested in the cloud     |
| Coach (after a run): groups "Report issue"       |  [11]  | against a stand-in; switched on   |
|    notes and proposes a rule (needs 2+ alike)    |  rules | at the Mac (planned)              |
| Scout (side script): reads saved web pages for   |  recall|                                   |
|    new rules and offers; rejects unsourced rows  |        | H-MEM memory engine (separate     |
|                                                  |        | from Nightshift; stores what the  |
|                                                  |        | agents learned). Built: approved  |
|                                                  |        | rules the Judge recalls before    |
|                                                  |        | ruling. Planned: the shared       |
|                                                  |        | workspace notes and the newsroom  |
|                                                  |        | loop's grading lessons, with      |
|                                                  |        | right/wrong feedback (Chart 5)    |
+------------------------+-------------------------+        +-----------------+-----------------+
                         |                                                    |
                         | [12] checked cards                                 | [10] hard questions
                         v                                                    v
+--------------------------------------------------+        +-----------------------------------+
| ZONE 7: EVALS  (automatic scoring)               |        | ZONE 5: NVIDIA'S JOB              |
|                                                  |        |                                   |
| Built: npm run eval = 3 sample families x 3 runs |        | Vision models read photos [9]     |
|  - scoreboard: 6 planted traps, false alarms,    |        | (planned; default model = open):  |
|    % of cards with a source, same answer every   |        |  - nemotron-nano-12b-v2-vl:       |
|    run, before/after learning                    |        |    paper receipts and labels      |
|  - honesty label says which AI was used; latest  |        |  - nemotron-3-nano-omni-30b-a3b-  |
|    saved run = "offline-fallback" (no real AI)   |        |    reasoning: label + object,     |
|  - 268 unit and screen tests                     |        |    "thinking" off                 |
| Planned:                                         |        |  - nemotron-3.5-super-vl-120b-    |
|  - 12 fine-print trap tests (FP-01 to FP-12),    |        |    a12b: messy photos, not yet    |
|    incl. a prompt injection; 3 controls that     |        |    tested by us                   |
|    must still pass; scored: catches found,       |        | photo -> one purchase-item row:   |
|    false alarms, field accuracy                  |        | store, product, brand, model      |
|  - misses become new tests (Chart 5)             |        | no., lot code, UPC, size, price,  |
|  - no_false_recall; state_agnostic test with     |        | how sure it is; code checks it    |
|    5 made-up families in 5 states                |        | (Chart 4)                         |
|  - photo intake tests: field accuracy, made-up   |        |                                   |
|    rate (target 0), planted recalled item        |        | Nemotron through Nightshift       |
|    caught; proposal (plan item 40): 1 retry,     |        | (planned) [10]:                   |
|    then a "clearer photo" request                |        |  - Court debate + Judge ruling    |
|  - real-AI rerun, scored and labelled apart      |        |  - plain-English explanations     |
|    from the offline replay                       |        |  - "same product?" on loose       |
|                                                  |        |    recall pairs (max 25)          |
|                                                  |        |  - Coach's proposed rules         |
|                                                  |        |                                   |
|                                                  |        | Backup if Nightshift is down:     |
|                                                  |        | Nemotron direct, then saved       |
|                                                  |        | offline text (order kept as a     |
|                                                  |        | setting; this order = proposal)   |
|                                                  |        | Today: wired to NVIDIA, but every |
|                                                  |        | saved result is offline           |
+------------------------+-------------------------+        +-----------------------------------+
                         |
                         | [13] results + scores
                         v
+--------------------------------------------------+
| ZONE 8: OUTPUT                                   |
|                                                  |
| Parent view                                      |
|  - feed + Receipt: money back, benefits,         |
|    deadlines, items checked; every card has a    |
|    source link                                   |
|  - fast screen (planned, Chart 3): last saved    |
|    feed at once, then cards stream in with       |
|    agent status pills                            |
|  - "We caught these for you": offers the         |
|    Court rejected                                |
|  - Value Score on offers (planned): VALUE and    |
|    TIME to get it decide "worth your time":      |
|    "worth $40 after strings attached · about     |
|    15 minutes · paid within 8 weeks", effort     |
|    badge, catches, "How we scored this"          |
|  - Recall alert, with evidence line: brand,      |
|    type, code and sale dates (evidence =         |
|    planned)                                      |
|                                                  |
| Owner view, behind the reviewer code (planned    |
|    split; today only Approve needs the code):    |
|    agent debate and loop rounds, data sources    |
|    per card, offer_checks rows and past          |
|    findings used, memory rules, full trace,      |
|    scoreboard                                    |
|                                                  |
| Data product (planned, must-do):                 |
|    GET /api/offer-audit = one read-only web      |
|    address with an OpenAPI description; reads    |
|    the Zetaris view v_offer_audit (per-brand     |
|    totals only), rate-limited, saved answers     |
|    in sample mode, never family fields           |
|    Fed by the SAME offer_checks rows as the      |
|    newsroom loop; the loop does not replace it   |
|                                                  |
| Pitch slide only: selling this data later, and   |
|    brand report cards ("Points Guy" style)       |
+------------------------+-------------------------+
                         |
                         | [14] parent taps a card ---> back to C (side input; tuning = later)
                         v
```

## How to read this

- **Boxes** are parts of the system. **Zones** are the eight areas the judges asked about.
- **Arrows** (`-->`, `v`, `^`, `<====>`, `<->`) show which way information moves; `<->` means the two sides talk back and forth. The number or letter in square brackets, like `[7]` or `[b]`, matches a line in the walkthrough under that chart.
- **(planned)** = in the plan, not built yet. **(planned, if time)** = a "should-do" that may be cut. **(proposal)** = not decided by Lyndsay. **(later)** = kept for after the hackathon. No mark = in the code today.
- **Zetaris**: the required sponsor "data door". One SQL question (SQL is the standard language for asking a database questions) can read several separate places at once without copying them. A **cross-source join** is one question that combines rows from two different places.
- **Neon**: Bundle's own online database. **CPSC** (Consumer Product Safety Commission) and **openFDA** (the FDA's public data service): the US government's product and food recall lists, read live. A **finished ("Terminated")** FDA recall is one that ended; only those are filtered out, so no parent gets a scary card about an old recall.
- **purchase_items**: the one table every purchase lands in, whichever way it came in. **v_purchase_items**: its **safe-columns view**, a saved query that shows agents only the harmless columns.
- **offer_checks**: the table of the agents' own grades of offers (the "Living Fine-Print Database", Strategy 2). **REGISTER DATASOURCE TABLE**: the Zetaris command that adds a table as a source it can search.
- **Shared workspace ("bus")**: a shared memory and state area every agent reads and writes during a run, like a team whiteboard; agents post ideas and questions to each other on it. It is held in Meterless H-MEM (planned); plain code still decides which agent goes next and enforces caps and time limits. **Maker agents**: the agents that propose cards (Clawback Hunter, Recall Checker, Benefits Planner, Fine Print Court).
- **Case law**: rules that a reviewer approved, stored in Meterless memory, which the Judge must cite. A **universal rule** is one that doesn't depend on the family (like "auto-renews into a paid plan").
- **Wording fingerprint**: a short code computed from an offer's exact fine print, so any change in wording is noticed. Offers whose fingerprint hasn't changed are skipped (decided, round 4c).
- **The newsroom loop**: the visible feedback loop in this draft (round 4c). Like a newsroom: the maker agents file, the Fact-Checker edits, and the archive (`offer_checks`) shapes how the next offer is graded. The same rows also feed the data product (`v_offer_audit` and `GET /api/offer-audit`, must-do); the loop does not replace it.
- **Value-and-time grade**: an offer is graded on its true value after strings attached and the time to get it (effort minutes, steps, payout wait, claim window); both together decide "worth your time" (decided, round 4c; the exact cut-off is a proposal).
- **UPC**: the 12-digit number under a barcode; its last digit is a **check digit** that proves the others were read right. **Model no.**: the model number on a product label. **Lot code**: the batch number printed on a formula can.
- **Meterless**: the required sponsor for memory. **H-MEM** is its memory engine: it stores what the agents learned (approved rules, shared findings, grading lessons).
- **Nightshift's job**: Meterless's Mac app, Bundle's AI switchboard. Every AI question from the agents goes to it; it passes the question to NVIDIA's Nemotron with Lyndsay's NVIDIA key, kept inside Nightshift. It is the "primary AI provider" for the Meterless rule, and separate from H-MEM. In the cloud the code talks to a stand-in; Lyndsay switches it on at her Mac. Not yet confirmed: the menu for adding the key, how to pin one model with "thinking" off, whether replies name the real model (`research-nightshift-setup.md`).
- **Nemotron**: NVIDIA's family of AI models. A **vision model** is an AI that can read pictures. **Agentmail**: an email service that gives a program its own inbox.
- **Server-sent events (SSE)**: a one-way push from the server to the browser over a normal web connection, so new results appear without the screen asking. **WebSockets**: a two-way live connection (the alternative).
- **OpenAPI description**: the standard file that tells any program or AI agent how to call a web address. **Read-only** means it can only hand data out, never change it.
- **Agent**: one AI helper with one job, run as its own step in code.

## Walkthrough (one line per arrow)

1. **[1]** The parent answers three questions (expecting or born, birthday or due date, ZIP), or taps a sample family; the answers go through the input checks. The top-row redesign is planned.
2. **[2]** (later) Forwarded email receipts to an Agentmail inbox: kept for after the hackathon (Lyndsay's decision), so no arrow is drawn; the design stays in plan sections 3 and 6.
3. **[3]** (later) Barcode scanning: kept for after the hackathon, same as [2].
4. **[4]** (planned, the hackathon priority) A photo of an item label, a formula can bottom or a paper receipt is cleaned on the phone (location data stripped, shrunk) before upload. Chart 4 shows its steps.
5. **[5]** Parent taps are a small side input: today "Report issue" goes via the Coach and a reviewer's Approve into Meterless memory (Chart 5, side box). Taps tuning a confidence number come later (decided, round 4c; not in this draft).
6. **[6]** Clean inputs start a run: the photo reader writes item rows to `purchase_items`; the Orchestrator asks Zetaris for saved verdicts first (planned), then starts the maker agents at once.
7. **[7]** Every agent, and the Fact-Checker, gets its data only by asking Zetaris, each through its own filtered view; the eligibility loop's counter-questions are also Zetaris questions (planned). The cross-source joins: purchases x live recalls (built for sample purchases; `purchase_items` planned), and `offer_checks` x live recalls and `offer_checks` x parent reports (planned).
8. **[8]** When an agent needs words or a judgment (debate, ruling, explanation, "same product?"), it asks the AI. Planned: the question goes to Nightshift; today the AI adapter falls back to saved text.
9. **[9]** (planned) Photos go straight to an NVIDIA vision model (using the NVIDIA key, not through Nightshift), which turns each one into one tidy purchase-item row; code checks the row before it is saved (Chart 4).
10. **[10]** (planned) Nightshift passes the hard text questions to NVIDIA's Nemotron. If Nightshift is down, the backup is Nemotron direct, then saved offline text (the exact order is a proposal; the code keeps it as a setting).
11. **[11]** Before each ruling, the Judge recalls approved rules from H-MEM and must cite their ids; made-up ids are thrown away.
12. **[12]** Cards that pass the Fact-Checker are assembled into the feed and the Receipt; when the Judge and the Fact-Checker agree, the judged offer also becomes a row in `offer_checks` (planned; Chart 5). The same rows feed both the newsroom loop (the agents' next grading) and the data product. Evals score these runs against an answer key.
13. **[13]** The results, plus the scoreboard, reach the parent view, the owner view and (planned, must-do) the read-only `GET /api/offer-audit` address.
14. **[14]** A parent tap goes back to input C. It is a small side input; confidence tuning from taps comes later. The visible loop is the newsroom loop in Chart 5.

## Chart 2: how the agents work together (the network and its loops)

This is Lyndsay's design (plan section 1b): instead of a straight line (A passes to B, B passes to C), the agents share a workspace, question each other and send work back with a reason. Every loop has a hard cap on rounds so it always ends.

```text
(the bus and loops 1-2 = planned; the Court and the send-back = built; see the marks)

+----------------------------------------------------------------------------------------------+
| ZETARIS FIRST (planned): is there a saved verdict in offer_checks for this offer?            |
| Same wording fingerprint, or already rejected by a universal rule -> reuse it, skip          |
| the AI (Chart 5). Otherwise the work goes into the shared workspace below.                   |
+----------------------------------------------+-----------------------------------------------+
                                               |
                                               | [a] work to do
                                               v
+==============================================================================================+
| SHARED WORKSPACE ("BUS") in Meterless H-MEM  (planned; today: one shared run context)        |
| every message = an H-MEM note (source, trust number, audit log) + a trace line:              |
| who asked whom, and why. Plain code (the orchestrator) picks who goes next and               |
| enforces the round caps and time limits                                                      |
|                                                                                              |
| +----------------------+                   +----------------------+                          |
| | Clawback Hunter      | [b] "any active   | Recall Checker       |  LOOP 1, safety-value    |
| | money back on things | flags on this     | purchase items vs.   |  (planned): a real       |
| | already bought (FSA, | item?"            | live CPSC + openFDA  |  CPSC/FDA recall on      |
| | price drops)         | ------------->    | recalls, exact codes |  the item kills the      |
| |                      | <-------------    | first                |  deal before the Judge   |
| +----------------------+ [c] "yes: recall" +----------------------+                          |
|                                                                                              |
| +----------------------+                   +----------------------+                          |
| | Benefits Planner     | [d] benefit terms | Fine Print Lawyer    |  LOOP 2, eligibility     |
| | (the Matcher):       | ------------->    | (eligibility role;   |  (planned): the Lawyer   |
| | programs and         | <-------------    | the same Lawyer as   |  tries to disprove it;   |
| | deadlines, any       | [e] counter-      | in the Court)        |  Planner asks Zetaris,   |
| | US state             | question          |                      |  then confirms or drops  |
| +----------------------+                   +----------------------+                          |
|                                                                                              |
| all three makers post CANDIDATE cards ("this item may be owed $12 back") here                |
+==============================================+===============================================+
                                               |
                                               | [f] candidate cards
                                               v
+----------------------------------------------+
| FINE PRINT COURT (built, one round)          |
| Deal Hunter argues for <-> Fine Print        | <-----------+
| Lawyer argues against -> the Judge rules,    |             |  LOOP 3, targeted correction
| citing case law recalled from Meterless      |             |  (Judge <-> Fact-Checker):
| H-MEM; a code "reject" always wins (planned) |             |  "math mistake on line 2:
+-----------------------+----------------------+             |  recalculate the net savings"
                        |                                    |  goes back to the Court or the
                        | [g]                                |  maker agent; max 2 rounds,
                        v                                    |  then the card is dropped.
+----------------------------------------------+             |  Built: basic send-back with
| FACT-CHECKER (the cross-examiner, built)     |             |  reason + corrected values.
| re-reads each card's source by a             | ------------+  Planned: line-by-line wording;
| different question: is the $, date and       |  [h] wrong     "approve with a catch" kept.
| state right?                                 |
+-----------------------+----------------------+
                        |
                        | [i] agree
                        v
+----------------------------------------------------------------------------------------------+
| card streams to the parent (Chart 3)  +  one offer_checks row: verdict, rule citations,      |
| value + time grade. The row feeds the NEWSROOM LOOP (next grading) AND the data              |
| product (v_offer_audit + GET /api/offer-audit) (Chart 5)                                     |
+----------------------------------------------------------------------------------------------+
```

- **[a]** (planned) Zetaris is asked first. If an offer's saved verdict still holds (same wording fingerprint, or a universal rule already rejected it), the AI is skipped; everything else goes into the workspace.
- **Workspace** (planned) The workspace is held in Meterless H-MEM: every message is saved as a note with its source, a trust number and an audit-log entry, so agents read each other's findings and judges can see who said what. Plain code (the orchestrator) still decides who goes next and enforces the round caps and the 300-second limit (`research-meterless-workspace.md`). Today there is no message bus: every agent shares one run context (the family, the Zetaris connection, the AI, memory and one shared trace log) and the Court posts rejected offers to a shared list, but the orchestrator passes work along. The message format is a proposal (plan section 10, item 37).
- **[b] [c]** Loop 1, safety-value (planned): before publishing a price drop or rebate, the Clawback Hunter asks the Recall Checker "any active flags on this item?"; a real CPSC or openFDA recall kills the deal before it reaches the Judge. Only real recall records are used (finished FDA recalls are filtered out). Today the two agents don't talk.
- **[d] [e]** Loop 2, eligibility (planned): the Benefits Planner sends a benefit's terms to the Fine Print Lawyer, who tries to disprove eligibility (timing, conditions, income caps). If it finds a condition, it sends back a counter-question ("ask Zetaris for X before approving"); the Planner asks Zetaris and confirms or drops the benefit. Counter-questions may use only data Bundle has (state, due or birth date, ZIP, stored rule tables), because the work question is cut (plan section 10, item 35).
- **[f]** All the makers' candidate cards go to the Fine Print Court.
- **[g]** The Court (built, one round): the Deal Hunter argues for, the Fine Print Lawyer argues against, and the Judge rules citing case law. There are no rebuttal rounds today (adding one is a proposal).
- **[h]** Loop 3, targeted correction (Judge <-> Fact-Checker): a wrong card goes back to the Court or the maker agent with the reason, at most 2 rounds, then it is dropped. **Built:** the basic send-back, with the reason and the corrected values, for every maker agent; each round is a `send_back` line in the trace. **Planned:** the line-by-line correction wording, and letting a corrected offer come back as "approve with a catch". A card that couldn't be checked (source down) is never sent back: one retry after 1.5 seconds, then dropped with an honest banner. (Proposal, plan item 41: the Fact-Checker also checks each recall match against the recall record; no evidence, no alert.)
- **[i]** When they agree, the card streams to the parent (Chart 3) and one `offer_checks` row is saved with the verdict, rule citations and the value-and-time grade (Chart 5). That row feeds both the newsroom loop and the data product.

## Chart 3: keeping it fast

Loops mean more AI calls, and slowness is the main AI risk: live Zetaris runs have taken 13 to 171 seconds, and today the screen shows the whole feed only when the run ends. Lyndsay's design: **show something at once, then improve it in the background.**

```text
(mostly planned: each box says what is built)

    Parent opens the feed
              |
              | [k1]
              v
+----------------------------------------+            +----------------------------------------+
| 1. INSTANT SAVED FEED (under 0.1 s)    |            | 2. FAST-PATH SWARM (1-2 s)             |
| the last checked feed, from the last   |  [k2]      | single-pass rule checks and active     |
| run's write-back to Neon, read         |  and, at   | recalls run first and stream "high     |
| through Zetaris (planned; today only   |  the same  | confidence" cards; a high-priority     |
| the same browser tab can re-show a     |  time:     | recall alert is pushed at once         |
| finished run)                          |            | (planned)                              |
+-------------+--------------------------+            +-------------------+--------------------+
              |                                                           |
              | [k3] saved cards                                          | [k4] sure cards
              |                         meanwhile, behind them:           |
              v                                                           v
+----------------------------------------+          +------------------------------------------+
| 4. THE SCREEN                          |          | 3. DEEP LOOPS IN THE BACKGROUND          |
| - cards appear one by one, most        | <------- | Court debate, Fact-Checker corrections,  |
|   urgent first (planned)               | [k5]     | the two agent-to-agent loops and the     |
| - optimistic: saved cards show first;  | live     | write-back to offer_checks keep running  |
|   background checks then add, update   | updates  | (planned; the Court and the basic        |
|   or remove cards (planned)            | (SSE)    | send-back are built). Results are        |
| - a recall alert shows only after its  |          | PUSHED as live updates ("New savings     |
|   evidence is checked                  |          | verified!") by server-sent events        |
| - agent status pills: "Recall Checker  |          | (SSE: a one-way push from server to      |
|   cross-referencing CPSC feeds...",    |          | browser over a normal web connection;    |
|   "Fine Print Lawyer examining FSA     |          | WebSockets = the alternative). If        |
|   eligibility terms...", "Judge        |          | time runs out: fall back to today's      |
|   checking H-MEM memory..."            |          | once-a-second asking (proposal)          |
|   PARTLY BUILT: the Checking screen    |          |                                          |
|   shows real agent steps from the      |          |                                          |
|   trace, asking the server once a      |          |                                          |
|   second; pill wording and live push   |          |                                          |
|   are planned                          |          |                                          |
+----------------------------------------+          +---------------------------+--------------+
                                                                                |
                                                                                | [k6] written back
                                                                                v
                                                  offer_checks in Neon, read through Zetaris:
                                                  it becomes the NEXT run's instant saved
                                                  feed (box 1) and its "skip the AI" list

+----------------------------------------------------------------------------------------------+
| SPEED LIMITS BEHIND THE SCENES                                                               |
| BUILT:   send-back max 2 rounds; max 5 offers to court per run; the four maker               |
|          agents run side by side (one failing never stops the rest); the                     |
|          Fact-Checker checks 4 cards at a time; Zetaris filters first so the AI              |
|          gets a short list; a small fast model for the debate, a bigger one for              |
|          the Judge; SAMPLE_MODE replays saved answers; Zetaris calls have a time             |
|          limit and one retry                                                                 |
| PLANNED: photo retry max 1 (proposal, plan item 40); every AI call gets a time limit + retry |
|          (must-do); a 300-second budget for the whole run, then saved offline                |
|          text that says so (must-do); skip the AI when an offer_checks verdict               |
|          still holds (must-do)                                                               |
+----------------------------------------------------------------------------------------------+
```

- **[k1]** (planned) The last checked feed appears at once, read from the last run's write-back. Today only the same browser tab can re-show a finished run (results live in the server's memory and the tab).
- **[k2]** (planned) At the same time, a fast first pass (quick rule checks and active recalls) streams the "high confidence" cards in 1–2 seconds; an urgent recall alert is pushed straight away.
- **[k3] [k4]** Saved cards and fast cards land on the screen, most urgent first (planned).
- **[k5]** (planned) The slower loops keep running behind the screen and push their results as live updates by server-sent events. If time runs short, the screen falls back to today's once-a-second asking (cut order = proposal, plan item 39).
- **Status pills (partly built):** today's "Checking" screen already shows real agent steps from the trace, asking the server once a second; the pill wording ("Recall Checker cross-referencing CPSC feeds...") and the live push are planned.
- **[k6]** (planned) The deep loops' verdicts are written to `offer_checks`, which becomes the next run's instant feed and its "skip the AI" list (Chart 5).
- **Speed limits:** the BUILT and PLANNED lines in the bottom box come from the plan's speed-limits table (section 1b). Safety rule kept: a recall alert is shown only after its evidence is checked.

## Chart 4: getting a purchase in from a photo (the hackathon priority)

```text
(planned: the round-4b priority path; none of it is in the code yet. The check, retry and
 close-up steps are an agent's proposal, plan section 10 item 40, not yet decided)

+------------------------+       +--------------------------+       +--------------------------+
| 1. Parent taps "+"     |       | 2. The phone strips      |       | 3. NVIDIA vision model   |
|    and takes a photo:  | [p1]  |    hidden location data  | [p2]  |    (NVIDIA key, not via  |
|    item label, can     | ----> |    and shrinks it;       | ----> |    Nightshift) reads it: |
|    bottom, or paper    |       |    the AI never sees     |       |    product, brand, model |
|    receipt             |       |    family details        |       |    no., lot code, UPC,   |
|                        |       |                          |       |    size, price           |
+------------------------+       +--------------------------+       +-------------+------------+
                                                                                  |
                                                                                  | [p3]
                                                                                  v
+--------------------------+       +--------------------------+       +--------------------------+
| 6. STILL UNCLEAR: ask    |       | 5. ASK AGAIN ONCE: the   |       | 4. CODE CHECKS THE       |
|    the parent for a      | [p5]  |    vision model is told  | [p4]  |    FIELDS: required ones |
|    clearer photo or a    | <---- |    exactly what was      | <---- |    present; a UPC has 12 |
|    close-up ("the label  | still |    wrong (max 1 retry),  | fail  |    digits and a right    |
|    under the seat", "the | wrong |    then code checks      |       |    check digit; a code   |
|    bottom of the can")   |       |    again                 |       |    looks like a code;    |
|                          |       |                          |       |    every value was       |
|                          |       |                          |       |    really read           |
+--------------------------+       +--------------------------+       +-------------+------------+
                                                                                  |
                                                                                  | [p6] pass
                                                                                  v
+----------------------------------------------------------------------------------------------+
| 7. One row saved to purchase_items (source = photo_item or photo_receipt, with               |
|    how sure the reader was); the photo is deleted. Then the Recall Checker                   |
|    matches exact codes against live recalls through Zetaris                                  |
+----------------------------------------------------------------------------------------------+

+----------------------------------------------------------------------------------------------+
| KEPT FOR AFTER THE HACKATHON (Lyndsay's decision; design kept in plan sections 3 and 6,      |
| not built now):                                                                              |
|  - forward email receipts to a Bundle address on Agentmail; only item rows kept              |
|  - scan a barcode with the phone camera (or type the numbers); Open Food Facts,              |
|    then UPCitemdb; every answer saved                                                        |
| Both would land in the same purchase_items table.                                            |
+----------------------------------------------------------------------------------------------+
```

- **[p1]** The parent taps "+" (on every tab) and takes a photo of an item label (like the one under a walker's seat), a formula can bottom or a paper receipt.
- **[p2]** The phone strips the photo's hidden location data and shrinks it; the AI is sent only the photo and must reject any photo showing people, faces or addresses.
- **[p3]** The NVIDIA vision model (which one is the default is open) reads the fields.
- **[p4]** Code checks the fields; if a check fails, the model is asked again once, told exactly what was wrong (exact check rules: plan section 10, item 32).
- **[p5]** If it's still unclear, the parent is asked for a clearer photo or a specific close-up.
- **[p6]** A row that passes is saved to `purchase_items`, the photo is deleted (never kept in a log, trace or memory), and the Recall Checker can match the exact codes (UPC, model number, lot code) against live recalls. Research found that model numbers and formula lot codes live in the recall text, so label and can-bottom photos unlock exact matches.
- **Kept for after the hackathon:** forwarded email receipts and barcode scanning (Lyndsay's decision); their design stays intact in plan sections 3 and 6.

## Chart 5: the newsroom loop (the Living Fine-Print Database, the automatic feedback loop)

This is the plan's systematic feedback loop (Strategy 2, a must-do), named **the newsroom loop** in round 4c and the visible loop in this draft. It runs on its own and needs no users: the agents' detailed grade of each offer (value, and time to get it) becomes a data source that makes the next grading faster and better. **The same `offer_checks` rows also feed the data product** (`v_offer_audit` and `GET /api/offer-audit` with its OpenAPI description, must-do, on Sunday's timeline); the loop does not replace or demote it.

```text
(planned, must-do: none of this loop is in the code yet, except the built side box)

+-------------------------+     +--------------------------+     +-----------------------------+
| 1. New offer to grade   |     | 2. ASK ZETARIS FIRST:    |     | 3. Court + Fact-Checker     |
|    (offers table; the   | [a] |    past grades (value,   | [b] |    judge it (Chart 2):      |
|    Scout reads saved    | --> |    minutes, payout wait) | --> |    Deal Hunter for, Lawyer  |
|    web pages)           |     |    in offer_checks + H-  | NO  |    against, Judge rules;    |
|                         |     |    MEM grading lessons   |     |    code fills $, dates and  |
|                         |     |    [j] YES, same wording |     |    flags; approve / approve |
|                         |     |    fingerprint or a      |     |    with catch / reject (a   |
|                         |     |    universal rule:       |     |    code reject always wins) |
|                         |     |    reuse it, skip the AI |     |                             |
+-------------------------+     +-------------+------------+     +--------------+--------------+
                                              |                                 |
                                              | [f] the NEXT                    | [c] Judge and
                                              ^     offer asks                  |     Fact-Checker
                                              |                                 v     AGREE
+-------------------------+     +-------------+------------+     +-----------------------------+
| 6. Cross-source answer: |     | 5. New Zetaris source:   |     | 4. One row per judged       |
|    offer_checks x live  | [e] |    REGISTER DATASOURCE   | [d] |    offer in offer_checks    |
|    CPSC + openFDA       | <-- |    TABLE adds            | <-- |    (Neon): verdict, rules;  |
|    recalls: "truly free |     |    offer_checks next to  |     |    VALUE: true value;       |
|    and not recalled     |     |    the recall feeds:     |     |    TIME: effort minutes,    |
|    since we checked"    |     |    agents' conclusions   |     |    steps, payout wait,      |
|                         |     |    become searchable     |     |    claim window; strings,   |
|                         |     |                          |     |    recall status, quote,    |
|                         |     |                          |     |    wording fingerprint.     |
|                         |     |                          |     |    NO family column         |
+------------+------------+     +--------------------------+     +--------------+--------------+
             |                                                                  |
             | [g]                                                              | [h]
             v                                                                  v
+-------------------------+     +--------------------------+     +-----------------------------+
| 7. Value Score for      |     | Side boxes (small):      |     | 8. Re-check, new tests      |
|    parents: VALUE + TIME|     |                          |     |    - wording fingerprint    |
|    decide "worth your   |     | BUILT: "Report issue"    |     |      changed: back to 3,    |
|    time": "worth $40    |     | -> Coach proposes a rule |     |      judged again           |
|    after strings        |     | -> reviewer Approves ->  |     |    - a miss (caught by a    |
|    attached · about 15  |     | H-MEM -> the Judge       |     |      fine-print test or     |
|    minutes · paid within|     | cites it next run        |     |      the Fact-Checker)      |
|    8 weeks" + catches.  |     |                          |     |      becomes a new test     |
|    SAME ROWS also feed  |     | PLANNED: H-MEM grading   |     |      every run must pass    |
|    the data product:    |     | lessons; Fact-Checker    |     |                             |
|    v_offer_audit + GET  |     | marks them helpful or    |     |                             |
|    /api/offer-audit     |     | wrong; better ones come  |     |                             |
|    (OpenAPI, must-do, no|     | first next time          |     |                             |
|    family fields)       |     | LATER (decided): taps    |     |                             |
|                         |     | tune a confidence no.    |     |                             |
+-------------------------+     +--------------------------+     +-----------------------------+
```

- **[a]** A new offer arrives from the offers table (the Scout adds new ones from saved web pages, and rejects any without a source).
- **[b]** Before reasoning, the agents ask Zetaris for past grades on the same store, the same brand or the same wording (true value, effort minutes, steps, payout wait, claim window) and recall matching grading lessons from Meterless H-MEM (planned). **[j]** If the offer was already graded and its wording fingerprint is unchanged, or a universal rule already rejected it (for example for another family), the saved verdict is reused and the AI debate is skipped (decided, round 4c). Otherwise (new, or new wording) it goes to step 3.
- **[c]** The Fine Print Court argues and the Judge rules; the Fact-Checker re-checks (Chart 2). Code fills every dollar amount, date and yes/no flag from the exact fine print; the AI fills only soft fields (summary, effort level), and code checks them.
- **[d]** When the Judge and the Fact-Checker agree, one row per judged offer is saved to `offer_checks` in Neon with the verdict, `status`, `rule_citations` (the case-law ids the Judge cited) and the value-and-time grade (`true_value_cents`, `effort_minutes_estimate`, `steps_count`, `payout_wait_days_max`, `claim_window_days`), plus the strategy-2 fields (the value-and-time grade replaces a per-offer confidence score): never loose files, and never a family column.
- **[e]** `REGISTER DATASOURCE TABLE` makes `offer_checks` a Zetaris source next to the live CPSC and openFDA feeds, so one question can ask "which offers did our agents rate truly free, where the product hasn't been recalled since we checked?"
- **[f]** The next offer's step 2 reads these rows: this is the newsroom loop closing. After each saved grade, one short grading lesson also goes into H-MEM; when the Fact-Checker confirms or corrects a later grade, the lessons used are marked helpful or wrong, so better ones rank first (planned).
- **[g]** The answers become the parent's Value Score (value and time: "worth $40 after strings attached · about 15 minutes · paid within 8 weeks", effort badge, list of catches, "How we scored this") and feed the read-only `GET /api/offer-audit` address with its OpenAPI description (planned, must-do; per-brand totals only, never family fields). Pitch slide only: selling this data later, and brand report cards in the style of "The Points Guy".
- **[h]** If an offer's wording fingerprint changes, it goes back to step 3 and is judged again. When the agents get one wrong (caught by a fine-print test or the Fact-Checker), the case becomes a new test.
- **Side box, built today:** the Coach groups parent "Report issue" notes and proposes a rule only when 2+ agree; nothing changes until a reviewer taps Approve; the rule goes into Meterless H-MEM, and on the next run the Judge cites it and blocks the trap (proven in `bundle/output_examples/learning/`). Planned: the Coach also asks Zetaris "which fine-print problems show up most in Report issue clicks?" (`offer_checks` x parent reports).
- **Side box, planned:** grading lessons in H-MEM, marked helpful or wrong by the Fact-Checker (step [f]).
- **Side box, later (decided in round 4c, not this draft):** parent taps ("I got this" / "Report issue") tuning a confidence number, with a fresh Court debate below a set level (Lyndsay's point 3.3).

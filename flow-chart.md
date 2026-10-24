# Bundle: system flow chart (words only)

Written Sat Oct 24, 2026, from `bundle-plan-v3.md` (round 3), `architecture.md`, `research-email-receipts.md`, `research-nightshift-setup.md`, `onboarding-spec.md` and the code in `bundle/`.

**The one rule for this page:** anything marked **(planned)** is in the plan but not in the code yet, so it must not be claimed as working. Anything without that mark is in the code today. **(planned, if time)** means a "should-do" that may be cut.

## Chart 1: the whole system

```text
ZONE 1: USER INPUT   (every family, date, ZIP, purchase and receipt is made up)

+--------------------+  +--------------------+  +--------------------+  +--------------------+
| A. Onboarding      |  | B. Bank link       |  | C. Forwarded       |  | D. Parent taps     |
|    answers         |  |    (planned)       |  |    receipts        |  |    on a card       |
|                    |  |                    |  |    (planned)       |  |                    |
| expecting or born, |  | Plaid practice     |  | Agentmail forward  |  | "I got this" and   |
| birth or due date, |  | bank. Gives store, |  | address, or the    |  | "Report issue"     |
| ZIP, work benefits |  | amount and date    |  | "Use sample        |  |                    |
| (or a sample       |  | only, never the    |  | receipts" button   |  | "Not mine" and     |
| family in one tap) |  | product name       |  |                    |  | "Returned it"      |
|                    |  |                    |  |                    |  | (planned)          |
| one question per   |  |                    |  |                    |  |                    |
| screen (planned)   |  |                    |  |                    |  |                    |
+---------+----------+  +---------+----------+  +---------+----------+  +---------+----------+
          |                       |                       |                       |
          | [1]                   | [2]                   | [3]                   | [4] on to
          v                       v                       v                       v ZONE 6
+==============================================================================================+
| ZONE 2: GUARDRAILS   (checks that run before and around the AI)                              |
|                                                                                              |
|  Input checks     ZIP must be 5 digits, dates must be real and in range, HTML is stripped,   |
|                   only plain ids, numbers and dates ever go into a database question         |
|  Receipts         keep ONLY item rows: store, date, product, brand, size, price.             |
|  (planned)        Drop the raw email, names, addresses, phone, card digits, tracking links   |
|                   and any email that is not a receipt. The AI sees item lines only, never    |
|                   the whole email. Emails are deleted after reading                          |
|  Bank lines       used for money-back jobs only; kept OUT of recall matching (planned)       |
|  Privacy views    each agent reads its own "safe columns" view: the deal Judge sees no       |
|                   family data, only the Planner's view has income, income is masked in logs. |
|                   Agents read receipts via v_purchase_items, never the raw table (planned)   |
|  Code can         the Fact-Checker sends back or drops wrong cards; an explanation that      |
|  overrule the AI  invents a dollar figure is thrown away; the Judge may cite only rule ids   |
|                   memory really returned; no AI answer on a recall = no alert;               |
|                   a code "reject" always beats an AI "approve" (planned)                     |
|  Sample mode      SAMPLE_MODE=true: no keys, saved real Zetaris answers, saved AI text       |
|  No real data     made-up families; Plaid practice bank only; receipt inbox accepts only     |
|                   our own test address (planned); keys never stored in the repo              |
+==============================================================================================+
                       |
                       | [5]
                       v
+--------------------------------------------------+        +-----------------------------------+
| ZONE 3: AGENT SYSTEM  (one job each, in order)   |        | ZONE 4: ZETARIS = THE DATA DOOR   |
|                                                  |  [6]   |                                   |
| 1. Orchestrator: loads the family, starts the    | <====> | One SQL question can reach:       |
|    four agents at the same time                  |  SQL   |  - Neon database: families,       |
|                                                  |  asks  |    purchases, benefit rules,      |
| 2. Four agents, side by side:                    |  and   |    offers, store policies         |
|  a. Clawback Hunter: money back on things        |  rows  |  - live CPSC recall feed          |
|     already bought (FSA, price drops, daycare)   |  back  |  - live openFDA formula recalls   |
|  b. Recall Checker: purchases vs. recalls        |        |  - receipt_items, offer_checks,   |
|  c. Benefits Planner: programs and deadlines     |        |    tax and state-leave tables     |
|  d. Fine Print Court: Deal Hunter argues for,    |        |    (planned)                      |
|     Fine Print Lawyer argues against, the Judge  |        |                                   |
|     rules (rejects go to "We caught these")      |        | THE cross-source join (built):    |
|                                                  |        | family purchases in Neon x live   |
| 3. Fact-Checker: re-reads each card's source by  |        | CPSC + FDA recalls, in one        |
|    a different question; sends it back (max 2    |        | question. Everything else is one  |
|    times) or drops it                            |        | filtered view per agent.          |
|                                                  |        | 2nd join: brand audit x open      |
| 4. Assemble: never-empty feed + Receipt total    |        | recalls (planned, if time)        |
|    (only checked cards count)                    |        +-----------------------------------+
|                                                  |
| Explain: writes each card's plain-English line   |        +-----------------------------------+
| Coach (after a run): groups "Report issue" notes |  [7]   | ZONE 6: METERLESS'S JOB           |
|    and proposes a rule (needs 2+ alike)          | -----> |                                   |
| Scout (side script): reads saved web pages for   |  AI    | Nightshift = AI switchboard       |
|    new rules and offers; rejects unsourced rows  |  calls | (planned): every AI question goes |
|                                                  |        | to one address on Lyndsay's Mac;  |
| Planned: receipt reader (code, small AI          | <----- | Nightshift picks the model        |
|    fallback) and the brand + type + date matcher |  [10]  |                                   |
|    inside the Recall Checker                     | rules  | H-MEM memory engine (built):      |
+-------------------------+------------------------+ recall | stores reviewer-approved rules    |
                          |                                 | learned from parent reports; the  |
                          | [11] checked cards              | Judge recalls them before ruling  |
                          v                                 | Taps move a rule's confidence;    |
+--------------------------------------------------+        | "Returned it" skips the alert     |
| ZONE 7: EVALS  (automatic scoring)               |        | next run (planned)                |
|                                                  |        +-----------------+-----------------+
| Built: npm run eval = 3 sample families x 3 runs |                          |
|  - scoreboard: 6 planted traps, false alarms,    |                          | [8] hard
|    % of cards with a source, same answer every   |                          v questions
|    run, before/after learning                    |        +-----------------------------------+
|  - honesty label says which AI was used; latest  |        | ZONE 5: NVIDIA'S JOB              |
|    saved run = "offline-fallback" (no real AI)   |        |                                   |
|  - 268 unit and screen tests                     |        | Nemotron answers through          |
| Planned:                                         |        | Nightshift (planned):             |
|  - 12 fine-print trap tests, incl. a prompt      |        |  - Court debate + Judge's ruling  |
|    injection; 3 controls that must still pass    |        |  - plain-English explanations     |
|  - no_false_recall; 14 new matcher cases;        |        |  - "same product?" on loose       |
|    5-family any-state test                       |        |    recall pairs (max 25)          |
|  - real-AI rerun, scored and labelled apart      |        |  - Coach's proposed rules         |
|    from the offline replay                       |        |  - unknown-store receipt lines    |
+-------------------------+------------------------+        |                                   |
                          |                                 | [9] fallback order:               |
                          | [12] results + scores           | Nightshift -> Nemotron direct     |
                          |                                 | -> saved offline text             |
                          |                                 | Today: wired to NVIDIA, but every |
                          |                                 | saved result is offline           |
                          v                                 +-----------------------------------+
+----------------------------------------------------------+
| ZONE 8: OUTPUT                                           |
|                                                          |
| Parent view                                              |
|  - feed + Receipt: money back, benefits, deadlines,      |
|    items checked; every card has a source link           |
|  - "We caught these for you": offers the Court rejected  |
|  - Value Score on offers: true dollar value, effort      |
|    badge, list of catches (planned)                      |
|  - Recall alert, with evidence line: brand OK, type OK,  |
|    bought inside the sale dates (evidence = planned)     |
|                                                          |
| Owner view, behind the reviewer code (planned split;     |
|    today only Approve needs the code): agent debate,     |
|    data sources per card, memory rules, full trace,      |
|    scoreboard                                            |
|                                                          |
| Brand audit: read-only web address, per-brand totals     |
|    only, no family data (planned, if time)               |
+---------------------------+------------------------------+
                            |
                            | [13] parent taps a card ---> back to D (see Chart 2)
                            v
```

## How to read this

- **Boxes** are parts of the system. **Zones** are the eight areas the judges asked about.
- **Arrows** (`-->`, `v`, `<====>`) show which way information moves. The number in square brackets, like `[6]`, matches a line in the walkthrough below.
- **(planned)** = in the plan, not built yet. **(planned, if time)** = a "should-do" that may be cut. No mark = in the code today.
- **Zetaris**: the required sponsor "data door". One SQL question (SQL is the standard language for asking a database questions) can read several separate places at once without copying them.
- **Neon**: Bundle's own online database. **CPSC** and **openFDA**: the US government's product and food recall lists, read live.
- **Meterless**: the required sponsor for memory. **H-MEM** is its memory engine; **Nightshift** is its app that turns a Mac into a private AI switchboard.
- **Nemotron**: NVIDIA's family of AI models. **Plaid**: the service apps use to read bank purchases; Bundle uses only its practice mode with fake banks. **Agentmail**: an email service that gives a program its own inbox.
- **Agent**: one AI helper with one job, run as its own step in code.

## Walkthrough (one line per arrow)

1. **[1]** The parent answers a few questions (or taps a sample family); the answers go through the input checks.
2. **[2]** (planned) A Plaid practice bank adds store-level purchases; they are used for money back, never for recall matching.
3. **[3]** (planned) Forwarded or sample receipts are read; only item rows are kept, the rest of each email is thrown away.
4. **[4]** Parent taps are checked, then feed Meterless memory: today "Report issue" goes via the Coach and a reviewer's Approve; direct tap-to-memory is planned (see Chart 2).
5. **[5]** Clean inputs start a run: the Orchestrator launches four agents at once.
6. **[6]** Every agent, and the Fact-Checker, gets its data only by asking Zetaris, each through its own filtered view; the Recall Checker's question is the one that joins private purchases with live recall feeds.
7. **[7]** When an agent needs words or a judgment (debate, ruling, explanation, "same product?"), it sends the question to Nightshift (planned; today the call goes to the AI adapter, which falls back to saved text).
8. **[8]** (planned) Nightshift passes the hard questions to NVIDIA's Nemotron.
9. **[9]** (planned) If Nightshift is down, Nemotron is asked directly; if that fails too, the agent uses its saved offline text.
10. **[10]** Before each ruling, the Judge recalls approved rules from H-MEM and must cite their ids; made-up ids are thrown away.
11. **[11]** The Fact-Checker's surviving cards are assembled into the feed and the Receipt; evals score these runs against an answer key.
12. **[12]** The results, plus the scoreboard, reach the parent view and the owner view.
13. **[13]** The parent taps a card, which feeds the learning loop below.

## Chart 2: the learning loop (how parent feedback changes the next run)

```text
+----------------------+     [a]      +----------------------+     [b]      +--------------------+
| Parent taps          | -----------> | Coach agent          | -----------> | Reviewer (with the |
| "Report issue" on    |              | groups the notes;    |  proposed    | reviewer code)     |
| an offer card        |              | proposes a rule only |  rule        | taps Approve       |
|                      |              | when 2+ agree        |              | (people decide)    |
+----------------------+              +----------------------+              +---------+----------+
                                                                                      |
                                                                                      | [c]
                                                                                      v
+----------------------+     [e]      +----------------------+     [d]      +--------------------+
| Next run: the trap   | <----------- | Judge recalls the    | <----------- | Meterless H-MEM    |
| offer is blocked and | "rejected,   | rule before ruling   |  rule with   | stores the rule,   |
| moved to "We caught  |  citing      | and must cite its id |  its id      | with a confidence  |
| these for you"       |  mem-1"      |                      |              | score and a log    |
+----------------------+              +----------------------+              +---------+----------+
                                                                                      ^
                                                                                      | [f]
                                                                                      | (planned)
+---------------------------------------------------------------+                     |
| Parent taps "I got this" / "Report issue" on a card that      |---------------------+
| cited a rule: the rule's confidence goes up or down.          |
| Parent taps "Not mine" / "Returned it" on a recall: memory    |
| saves the item's row id (never receipt text), and the next    |
| run says "skipped: you told us you returned this". (planned)  |
+---------------------------------------------------------------+
```

- **[a]** Parent "Report issue" notes are saved; the Coach reads them as data, never as orders.
- **[b]** The Coach only proposes; nothing changes until a person approves.
- **[c]** Approve writes the rule into Meterless H-MEM.
- **[d]** On the next run, the Judge asks memory for matching rules before ruling.
- **[e]** The trap offer is blocked, citing the rule; this is proven in the saved learning traces (`bundle/output_examples/learning/`).
- **[f]** (planned) Everyday taps adjust each rule's confidence, shown in the owner view, and recall taps silence a dismissed alert.

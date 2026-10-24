# Bundle: system flow chart (words only)

Written Sat Oct 24, 2026; updated the same evening from `bundle-plan-v3.md` (round 4), `TRACKING-oct24-round4.md` ("Lyndsay's correction"), `research-photo-barcode-intake.md`, `research-email-receipts.md`, `cloud-build-assessment.md` and the code in `bundle/`.

**The one rule for this page:** anything marked **(planned)** is in the plan but not in the code yet, so it must not be claimed as working. Anything without that mark is in the code today. **(planned, if time)** means a "should-do" that may be cut. **(proposal)** means an agent's suggestion that Lyndsay has not decided yet (plan section 10); it is not in the plan.

## Chart 1: the whole system

```text
ZONE 1: USER INPUT   (every family, date, ZIP, receipt, barcode and photo is made up)

+----------------------+  +----------------------------------------------+  +--------------------+
| A. Onboarding        |  | B. "+" Add purchases   (planned)             |  | C. Parent taps     |
|    answers           |  |    one "+" button on every tab, 3 paths:     |  |    (small side     |
|                      |  |                                              |  |    input, not the  |
| 1. "We're expecting" |  | B1 Forward     B2 Scan a      B3 Photo of    |  |    main loop)      |
|    or "Baby's here", |  |    email          barcode        an item     |  |                    |
|    or "Try a sample  |  |    receipts       with the       label       |  | "I got this" and   |
|    family" (1 tap)   |  |    to a Bundle    phone          (under a    |  | "Report issue"     |
| 2. baby's birthday,  |  |    address on     camera, or     walker),    |  | on a card          |
|    or due date if    |  |    Agentmail,     type the       a formula   |  |                    |
|    expecting         |  |    or "Use        numbers        can bottom, |  | "Not mine" on a    |
| 3. ZIP: any US ZIP   |  |    sample         in             or a paper  |  | recall alert       |
|                      |  |    receipts"                     receipt     |  | (planned)          |
| redesign: top row    |  |                                              |  |                    |
| of mocks, then       |  | all three land in ONE table:                 |  |                    |
| bottom tabs          |  | purchase_items (see ZONE 4)                  |  |                    |
| (planned)            |  |                                              |  |                    |
+----------+-----------+  +---+--------------+--------------+------------+  +---------+----------+
           |                  | [2]          | [3]          | [4]                     |
           | [1]              | email        | barcode      | photo                   | [5] on to
           v                  v              v              v                         v ZONE 6
+==============================================================================================+
| ZONE 2: GUARDRAILS   (checks that run before and around the AI)                              |
|                                                                                              |
| Input checks     ZIP must be 5 digits, dates must be real and in range, HTML is stripped,    |
|                  only plain ids, numbers and dates ever go into a database question          |
| Receipts and     keep ONLY item rows: store, date, product, brand, model no., lot code,      |
| photos           UPC, size, price. Drop faces, addresses, names, phone, card digits,         |
| (planned)        tracking links and the raw email. Non-receipt emails are dropped; read      |
|                  emails are deleted. The phone strips a photo's hidden location data and     |
|                  shrinks it; the AI sees only the photo (never family details) and must      |
|                  reject any photo showing people, faces or addresses; the photo is deleted   |
|                  right after reading, never kept in logs, traces or memory.                  |
|                  "Forget my items" deletes a family's rows                                   |
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
| No real data     made-up families, receipts, barcodes and photos; the receipt inbox          |
|                  accepts only our own test address (planned); keys never in the repo         |
+======================+=======================================================================+
                       |
                       | [6]
                       v
+--------------------------------------------------+        +-----------------------------------+
| ZONE 3: AGENT SYSTEM  (one job each, in order)   |        | ZONE 4: ZETARIS = THE DATA DOOR   |
|                                                  |  [7]   |                                   |
| Intake readers (planned):                        | <====> | One SQL question can reach:       |
|  - email: per-store rules, small AI fallback     |  SQL   |  - Neon database: families,       |
|    that sees item lines only                     |  asks  |    purchases, benefit rules,      |
|  - barcode: Open Food Facts, then UPCitemdb,     |  and   |    offers, store policies,        |
|    every answer saved                            |  rows  |    parent reports (feedback)      |
|  - photo: sent to an NVIDIA vision model         |  back  |  - purchase_items, through the    |
|    [9]; the row comes back checked by code       |        |    safe-columns view              |
|  -> rows saved to purchase_items                 |        |    v_purchase_items (planned)     |
|                                                  |        |  - offer_checks: a source the     |
| 1. Orchestrator: loads the family, starts the    |        |    AGENTS made, added with        |
|    four agents at the same time                  |        |    REGISTER DATASOURCE TABLE      |
|                                                  |        |    (planned)                      |
| 2. Four agents, side by side:                    |        |  - tax_parameters and             |
|  a. Clawback Hunter: money back on things        |        |    state_programs (planned)       |
|     already bought (FSA, price drops);           |        |  - live CPSC recall feed          |
|     which purchase rows it reads is an           |        |  - live openFDA recalls: only     |
|     open question                                |        |    finished ("Terminated") ones   |
|  b. Recall Checker: purchase items vs.           |        |    filtered out (planned)         |
|     recalls; exact codes first (UPC, model       |        |                                   |
|     no., lot code) (planned); brand + type +     |        | Cross-source joins:               |
|     date matcher (planned, if time)              |        | J1 (built): family purchases in   |
|  c. Benefits Planner (Strategy 1, the            |        |    Neon x live CPSC + FDA         |
|     Matcher): programs and deadlines for         |        |    recalls, in one question.      |
|     any US state (any-state = planned)           |        |    Planned: purchase_items        |
|  d. Fine Print Court: Deal Hunter argues for,    |        |    (safe view) x live recalls,    |
|     Fine Print Lawyer argues against, the        |        |    by exact code first            |
|     Judge rules; looks up past findings          |        | J2 (planned): offer_checks x      |
|     first (planned, see Chart 2)                 |        |    live recalls = "truly free     |
|                                                  |        |    and not recalled since we      |
| 3. Fact-Checker: re-reads each card's source by  |        |    checked"                       |
|    a different question; sends it back (max 2    |        | J3 (planned): offer_checks x      |
|    times) or drops it                            |        |    feedback = Coach's "which      |
|                                                  |        |    fine-print problems show up    |
| 4. Assemble: never-empty feed + Receipt total    |        |    most in Report issue?"         |
|    (only checked cards count); Court +           |        | Everything else: one filtered     |
|    Fact-Checker save one row per judged offer    |        | view per agent.                   |
|    to offer_checks (planned)                     |        |                                   |
|                                                  |        |                                   |
| Explain: writes each card's plain-English line   |        |                                   |
| Coach (after a run): groups "Report issue"       |        |                                   |
|    notes and proposes a rule (needs 2+ alike)    |        |                                   |
| Scout (side script): reads saved web pages for   |        |                                   |
|    new rules and offers; rejects unsourced rows  |        |                                   |
|                                                  |        +-----------------------------------+
|                                                  |
|                                                  |
|                                                  |        +-----------------------------------+
|                                                  |        | ZONE 6: METERLESS'S JOB           |
|                                                  | -----> |                                   |
|                                                  |  [8] AI| Nightshift = AI switchboard on    |
|                                                  |  calls | Lyndsay's Mac: every AI question  |
|                                                  |        | goes to one address, Nightshift   |
|                                                  | <----- | picks the model. Code built and   |
|                                                  |  [11]  | tested in the cloud against a     |
|                                                  |  rules | fake Nightshift; switched on at   |
|                                                  | recall | the Mac (planned)                 |
|                                                  |        |                                   |
|                                                  |        | H-MEM memory engine (built):      |
|                                                  |        | stores reviewer-approved rules    |
|                                                  |        | learned from parent reports; the  |
|                                                  |        | Judge recalls them before ruling  |
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
|  - misses become new tests (Chart 2)             |        | no., lot code, UPC, size, price,  |
|  - no_false_recall; state_agnostic test with     |        | how sure it is                    |
|    5 made-up families in 5 states                |        |                                   |
|  - intake tests: field accuracy, made-up rate    |        | Nemotron through Nightshift       |
|    (target 0), planted recalled item caught      |        | (planned) [10]:                   |
|  - real-AI rerun, scored and labelled apart      |        |  - Court debate + Judge ruling    |
|    from the offline replay                       |        |  - plain-English explanations     |
|                                                  |        |  - "same product?" on loose       |
|                                                  |        |    recall pairs (max 25)          |
|                                                  |        |  - Coach's proposed rules         |
|                                                  |        |  - unknown-store receipt lines    |
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
|  - "We caught these for you": offers the         |
|    Court rejected                                |
|  - Value Score on offers (planned):              |
|    "worth $40 after strings attached" = true     |
|    dollar value, effort badge, list of           |
|    catches, "How we scored this"                 |
|  - Recall alert, with evidence line: brand,      |
|    type, code and sale dates (evidence =         |
|    planned)                                      |
|                                                  |
| Owner view, behind the reviewer code (planned    |
|    split; today only Approve needs the code):    |
|    agent debate, data sources per card,          |
|    offer_checks rows and past findings used,     |
|    memory rules, full trace, scoreboard          |
|                                                  |
| Data product (planned, must-do):                 |
|    GET /api/offer-audit = one read-only web      |
|    address with an OpenAPI description; reads    |
|    the Zetaris view v_offer_audit (per-brand     |
|    totals only), rate-limited, saved answers     |
|    in sample mode, never family fields           |
|                                                  |
| Pitch slide only: selling this data later, and   |
|    brand report cards ("Points Guy" style)       |
+------------------------+-------------------------+
                         |
                         | [14] parent taps a card ---> back to C (small side loop, Chart 2)
                         v
```

## How to read this

- **Boxes** are parts of the system. **Zones** are the eight areas the judges asked about.
- **Arrows** (`-->`, `v`, `^`, `<====>`) show which way information moves. The number in square brackets, like `[7]`, matches a line in the walkthrough below.
- **(planned)** = in the plan, not built yet. **(planned, if time)** = a "should-do" that may be cut. **(proposal)** = not decided by Lyndsay. No mark = in the code today.
- **Zetaris**: the required sponsor "data door". One SQL question (SQL is the standard language for asking a database questions) can read several separate places at once without copying them. A **cross-source join** is one question that combines rows from two different places.
- **Neon**: Bundle's own online database. **CPSC** (Consumer Product Safety Commission) and **openFDA** (the FDA's public data service): the US government's product and food recall lists, read live. A **finished ("Terminated")** FDA recall is one that ended; those are filtered out so no parent gets a scary card about an old recall.
- **purchase_items**: the one table every purchase lands in, whichever way it came in. **v_purchase_items**: its **safe-columns view**, a saved query that shows agents only the harmless columns.
- **offer_checks**: the table of the agents' own grades of offers (the "Living Fine-Print Database", Strategy 2). **REGISTER DATASOURCE TABLE**: the Zetaris command that adds a table as a source it can search.
- **UPC**: the 12-digit number under a barcode. **Model no.**: the model number on a product label. **Lot code**: the batch number printed on a formula can.
- **Meterless**: the required sponsor for memory. **H-MEM** is its memory engine; **Nightshift** is its app that turns a Mac into a private AI switchboard.
- **Nemotron**: NVIDIA's family of AI models. A **vision model** is an AI that can read pictures. **Agentmail**: an email service that gives a program its own inbox.
- **OpenAPI description**: the standard file that tells any program or AI agent how to call a web address. **Read-only** means it can only hand data out, never change it.
- **Agent**: one AI helper with one job, run as its own step in code.

## Walkthrough (one line per arrow)

1. **[1]** The parent answers three questions (expecting or born, birthday or due date, ZIP), or taps a sample family; the answers go through the input checks. The top-row redesign is planned.
2. **[2]** (planned) Forwarded email receipts (or "Use sample receipts") arrive in the Agentmail inbox; only item rows are kept, the rest of each email is thrown away.
3. **[3]** (planned) A barcode photo (or typed numbers) gives a UPC; the server looks the product up and saves the answer.
4. **[4]** (planned) A photo of an item label, a formula can bottom or a paper receipt is cleaned on the phone (location data stripped, shrunk) before upload.
5. **[5]** Parent taps are a small side input: today "Report issue" goes via the Coach and a reviewer's Approve into Meterless memory (Chart 2, side box).
6. **[6]** Clean inputs start a run: intake readers write item rows to `purchase_items`, and the Orchestrator launches the four agents at once.
7. **[7]** Every agent, and the Fact-Checker, gets its data only by asking Zetaris, each through its own filtered view. The cross-source joins: purchases x live recalls (built for sample purchases; `purchase_items` planned), and `offer_checks` x live recalls and `offer_checks` x parent reports (planned).
8. **[8]** When an agent needs words or a judgment (debate, ruling, explanation, "same product?"), it asks the AI. Planned: the question goes to Nightshift; today the AI adapter falls back to saved text.
9. **[9]** (planned) Photos go straight to an NVIDIA vision model (using the NVIDIA key, not through Nightshift), which turns each one into one tidy purchase-item row; code checks the row before it is saved.
10. **[10]** (planned) Nightshift passes the hard text questions to NVIDIA's Nemotron. If Nightshift is down, the backup is Nemotron direct, then saved offline text (the exact order is a proposal; the code keeps it as a setting).
11. **[11]** Before each ruling, the Judge recalls approved rules from H-MEM and must cite their ids; made-up ids are thrown away.
12. **[12]** The Fact-Checker's surviving cards are assembled into the feed and the Receipt; each judged offer also becomes a row in `offer_checks` (planned; see Chart 2). Evals score these runs against an answer key.
13. **[13]** The results, plus the scoreboard, reach the parent view, the owner view and (planned) the read-only `GET /api/offer-audit` address.
14. **[14]** A parent tap goes back to input C. It is a small side loop; the main loop is the automatic one in Chart 2.

## Chart 2: the Living Fine-Print Database (the automatic feedback loop)

This is the plan's systematic feedback loop (Strategy 2). It runs on its own and needs no users: the agents' own conclusions become a data source that makes the next grading better.

```text
(planned: none of this loop is in the code yet)

+-------------------------+       +--------------------------+       +-----------------------------+
| 1. New offer to grade   |  [a]  | 2. Look up past findings |  [b]  | 3. Court + Fact-Checker     |
|    (offers table; the   | ----> |    through Zetaris: same | ----> |    judge it: Deal Hunter    |
|    Scout reads saved    |       |    store, same brand or  |  past |    for, Lawyer against,     |
|    web pages)           |       |    same wording, in      | finds |    Judge rules; code fills  |
|                         |       |    offer_checks          |       |    $, dates and flags;      |
|                         |       |                          |       |    approve / approve with   |
|                         |       |                          |       |    catch / reject (a code   |
|                         |       |                          |       |    reject always wins)      |
+-------------------------+       +------------+-------------+       +--------------+--------------+
                                               ^                                    |
                                               | [f] the NEXT                       | [c]
                                               |     offer asks                     |
                                               |                                    v
+-------------------------+       +------------+-------------+       +-----------------------------+
| 6. Cross-source answer  |  [e]  | 5. New Zetaris source    |  [d]  | 4. One row per judged       |
|    offer_checks x live  | <---- |    REGISTER DATASOURCE   | <---- |    offer in offer_checks    |
|    CPSC + openFDA       |       |    TABLE adds            | saved |    (Neon): offer, hidden    |
|    recalls: "truly free |       |    offer_checks next to  |       |    strings ("$8 shipping"), |
|    and not recalled     |       |    the government recall |       |    sign-up + effort, recall |
|    since we checked"    |       |    feeds: agents' own    |       |    status, value, score,    |
|                         |       |    conclusions become    |       |    evidence quote, wording  |
|                         |       |    searchable data       |       |    fingerprint. NO family   |
|                         |       |                          |       |    column; never loose JSON |
+------------+------------+       +--------------------------+       +--------------+--------------+
             |                                                                      |
             | [g]                                                                  | [h]
             v                                                                      v
+-------------------------------+   +----------------------------+   +-----------------------------+
| 7. Value Score for parents:   |   | Small side box (built):    |   | 8. Re-check, new tests      |
|    "worth $40 after strings   |   | parent "Report issue" ->   |   |    - wording fingerprint    |
|    attached" + effort badge   |   | Coach proposes a rule ->   |   |      changed: back to 3,    |
|    + catches. The same data   |   | reviewer Approves -> H-MEM |   |      judged again           |
|    feeds GET /api/offer-audit |   | -> Judge cites it next run |   |    - a miss (caught by a    |
|    (OpenAPI, no family        |   |                            |   |      fine-print test or     |
|    fields)                    |   |                            |   |      the Fact-Checker)      |
|                               |   |                            |   |      becomes a new test     |
|                               |   |                            |   |      every run must pass    |
+-------------------------------+   +----------------------------+   +-----------------------------+
```

- **[a]** A new offer arrives from the offers table (the Scout adds new ones from saved web pages, and rejects any without a source).
- **[b]** Before grading, the agents ask Zetaris what was already found about the same store, the same brand or the same wording, and use it. A finding about one offer becomes an answer for the others.
- **[c]** The Fine Print Court argues and the Judge rules; the Fact-Checker re-checks. Code fills every dollar amount, date and yes/no flag from the exact fine print; the AI fills only soft fields (summary, effort level), and code checks them.
- **[d]** One row per judged offer is saved to `offer_checks` in Neon: never loose files, and never a family column.
- **[e]** `REGISTER DATASOURCE TABLE` makes `offer_checks` a Zetaris source next to the live CPSC and openFDA feeds, so one question can ask "which offers did our agents rate truly free, where the product hasn't been recalled since we checked?"
- **[f]** The next offer's step 2 reads these rows: this is the loop closing.
- **[g]** The answers become the parent's Value Score ("worth $40 after strings attached": true dollar value, effort badge, list of catches, "How we scored this") and feed the read-only `GET /api/offer-audit` address with its OpenAPI description (planned, must-do; per-brand totals only, never family fields). Pitch slide only: selling this data later, and brand report cards in the style of "The Points Guy".
- **[h]** Each row's wording fingerprint (a short code computed from the exact wording) is compared over time: if the wording changes, the offer goes back to step 3. When the agents get one wrong (caught by a fine-print test or the Fact-Checker), the case becomes a new test.
- **Side box (built today):** the Coach groups parent "Report issue" notes and proposes a rule only when 2+ agree; nothing changes until a reviewer taps Approve; the rule goes into Meterless H-MEM, and on the next run the Judge cites it and blocks the trap (proven in `bundle/output_examples/learning/`). Planned: the Coach also asks Zetaris "which fine-print problems show up most in Report issue clicks?" (`offer_checks` x parent reports).

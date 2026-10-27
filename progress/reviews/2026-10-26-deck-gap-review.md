# Deck gap review and new outline (Oct 26, 2026)

Research only: the deck has not been edited. Submission is due Oct 27, 23:45 UTC.
Everything below was checked against the code in `bundle/server/` and the saved logs in `bundle/logs/`, not against the docs.

Words used here:
- **API**: a web address other programs can ask for data (instead of a person clicking a screen).
- **View**: a saved database question that shows only some columns, like a window onto a table.
- **Trace / log line**: one line the app writes for every step an agent takes, so a judge can replay what happened.
- **Fallback**: the plain-code backup the app uses when the AI service does not answer.

---

## 1. What the deck is now

- **Format:** one HTML file, `presentation/deck/bundle-deck.html` (12 `<section class="slide">` blocks, 16:9). `presentation/deck/render.sh` uses Chrome in the background to make `bundle-deck.pdf` and one PNG per slide in `presentation/deck/slides/`. Images live in `presentation/deck/img/`. Design rules: `design-system.md`; speaker notes: `outline.md`.
- **Last edited:** Oct 24, 18:48. Since then the app changed a lot (V2 build, photo reading, live offer search, Audit-a-deal, report card, agent workspace). The deck describes the Oct 23 app.
- **Slide count now: 12. Proposed: 15** (can be cut to 13; see section 6).

## 2. What judges score (from `hackathon-resources/hackathon-overview.md` sections 12 to 14)

| Criterion | Points | What it means for the deck |
|---|---:|---|
| Impact | 30 | A real problem for real users, and value you can see |
| Technical | 20 | Architecture, reliability, how well it is built |
| Innovation | 15 | Original, creative approach (judges asked for creative ways of adding data) |
| Demo | 15 | Clearly shows it working |
| Product & UX | 10 | Easy to use |
| Sponsor Tech | 10 | Zetaris and Meterless doing real work, not bolted on |

Judges "prioritise": multiple agent interactions, agents that challenge or improve each other, outputs refined through iteration, branching, clear logs. They "avoid overvaluing": single-agent systems dressed up as many, hardcoded demo paths, **unsupported claims of value**.
Required deck content: problem and users, solution, agent workflow/architecture, tech stack, how Zetaris and Meterless were used, what was unique about that use, product visuals, future enhancements. The strong example (`strong-submission-examples.md` section 7) puts "the architecture diagram **and the feedback loops**" on one slide.

---

## 3. What the code really does (verified)

### 3a. The agents (who exists and what each does)

The run is started by `runBundle` in `server/agents/orchestrator.ts`. Four agents run side by side, then every card goes through the Fact-Checker.

| Agent (name in logs) | File | What it does | Talks to |
|---|---|---|---|
| **Orchestrator** (plain code, not AI) | `agents/orchestrator.ts` | Loads the family through Zetaris, runs the four agents at once, sends every card to the Fact-Checker (4 at a time), drops what fails, fills a never-empty feed, 300-second run budget, writes the trace | everyone |
| **ClawbackHunter** | `agents/clawback.ts` | Money back: FSA/HSA-eligible purchases and store price drops inside the store's adjustment window. Reads only `purchase_items` (via view `v_purchase_items`) joined in Zetaris to `fsa_eligible_categories`, `store_policies`, `price_observations` | **asks RecallChecker** before publishing a deal ("safety gate", `safetyGate`, line 148): a recalled item's deal is killed (`safety_kill`) |
| **RecallChecker** | `agents/recall.ts`, `agents/recallMatch.ts` | One Zetaris question joins the family's purchases with the live CPSC and FDA recall feeds (`pairsSql`); then plain-code matching rules decide which pairs are real (UPC, model number, lot code first, then brand + product type + dates) | FactChecker; answers ClawbackHunter |
| **BenefitsPlanner** | `agents/benefits.ts` | Benefit rules + baby's birth/due date + state → dated deadlines and amounts | challenged by the eligibility Lawyer |
| **Fine Print Lawyer (eligibility)** | `agents/eligibilityLawyer.ts` | Tries to disprove a benefit the Planner found by asking Zetaris one counter-question (state program window, or tax table for the baby's year). Benefit is confirmed, dropped, or kept with "Not yet verified" | BenefitsPlanner |
| **FinePrintCourt** = three speakers | `agents/finePrintCourt.ts` | For each offer (max 5 per run): **Deal Hunter** argues for, **Fine Print Lawyer** argues against, **Judge** rules using recalled case law. Plain-code fine-print rules (`finePrintRules.ts`, 12 traps) run alongside; the stricter answer wins | Newsroom, H-MEM, FactChecker |
| **Newsroom** (part of the court) | `agents/newsroom.ts` | Before grading: asks Zetaris for grades already saved (`v_offer_verdicts`) and H-MEM for past "lessons". Unchanged wording with an agreed grade → skip the AI and reuse. After an agreed verdict: writes one `offer_checks` row and one H-MEM lesson | Zetaris, H-MEM |
| **FactChecker** | `agents/factChecker.ts` | The gate. Re-checks each card's amount/date with its own Zetaris query (offers, rules, purchases); no source link = no card. If an amount or date is wrong it sends the card back to its owner with a line-by-line note (max 2 rounds), then drops it. Marks the H-MEM lessons the card used as helpful or wrong | every producing agent; ParentFeed |
| **Explain** (helper, not an agent) | `agents/explain.ts` | The AI writes only the card's sentence; any dollar figure the AI invents throws the text away | used by 3 agents |
| **CoachAI** | `agents/coach.ts` (called from `POST /api/feedback`, not inside a run) | Reads parents' "Report issue" notes (through Zetaris view `v_coach_feedback`); when 2+ reports share a theme it proposes a rule. Also: same card marked "Not relevant" by 2+ families → proposes re-checking eligibility | case_law_proposals table → human reviewer → H-MEM |
| **PhotoReader** (name in logs; code is `ingest/photo.ts`) | `ingest/photo.ts`, `routes/photoRoutes.ts` | NVIDIA vision model reads a label or receipt photo into fields; plain code checks every field; one retry told exactly what was wrong; then "send a clearer photo" | writes `purchase_items` that the other agents read |
| **Live offer search** | `offers/liveSearch.ts` | Tavily web search of trusted baby-offer sites; every result goes through the same court; agreed grades saved to `offer_checks` | FinePrintCourt |
| **Audit-a-deal** | `offers/dealAudit.ts` | A parent pastes fine print or a screenshot; same court grades it | FinePrintCourt |
| Scout (script only) | `scripts/scout.ts` | Offline helper that reads saved pages into rule rows; not part of a run | — |

Not real agents, so do not draw them as such: "Newsroom" is a step inside the court; "Explain" is a helper; "PhotoReader" is code plus one vision-model call with a code checker (still a fair "agent" label since it retries on feedback, but it is not inside the orchestrated run).

### 3b. How the agents talk to each other (the real message flow)

Three channels, all real:
1. **Direct hand-offs in code** (orchestrator → agent → FactChecker → `revise()` back to the owner).
2. **The shared workspace** (`agents/workspace.ts`), one per run, stored in Meterless H-MEM. Agents post typed notes: `claim`, `question`, `answer`, `correction`, `verdict`, each with `from_agent` and `to_agent`. Example from the court: Deal Hunter → Judge `claim`; Judge → Deal Hunter `question` (rebuttal); Judge → FactChecker `verdict`; FactChecker → ClawbackHunter `correction`. Shown in the app's Agent Workspace panel and in `GET /api/runs/:runId/agent-log`.
3. **The 10-field log** (`agents/trace.ts`) with `target_agent`. Real targets: FactChecker `approve_card` → `ParentFeed`; FactChecker `correction` → the owning agent (e.g. `ClawbackHunter`); Zetaris lines → `Zetaris`; memory lines → `Meterless H-MEM`; court lines default → `FactChecker`.

Real message flow for one run:
```
Orchestrator ──(family via Zetaris)──► 4 agents at once
  ClawbackHunter ──"is this item recalled?"──► RecallChecker ──(no / kill deal)
  BenefitsPlanner ◄──counter-question via Zetaris── Fine Print Lawyer (confirm / drop / "not yet verified")
  FinePrintCourt: Newsroom reads saved grades (Zetaris) + lessons (H-MEM)
       Deal Hunter ─claim─► Judge ◄─claim─ Fine Print Lawyer
       Judge ⇄ code screen disagree? ─► 1 rebuttal round ─► Judge rules again
       Judge ─verdict─► FactChecker ; agreed grade ─► offer_checks + H-MEM lesson
All cards ─► FactChecker (own Zetaris query) ─wrong amount/date─► owner revises (max 2) ─► approve → ParentFeed / drop
FactChecker ─helpful/wrong─► H-MEM lesson trust number
```

Evidence in saved logs (`bundle/logs/`, 760 files): 578 `court_debate` lines; a **real AI court with a rebuttal round** on Oct 25 04:29 UTC (family Ava, offer 1318: code screen said approve, Judge said reject, both sides rebutted, Deal Hunter conceded, Judge rejected citing the $29.99/month auto-enrol). 209 `reuse_saved_grade`, 148 `saved_verdicts`, 76 `lesson_feedback`, 50 `rule_recalled`, 55 `workspace_open`, eligibility `challenge_benefits` lines. **0 `correction` lines**: the FactChecker send-back works in tests (`factChecker.test.ts`, `loopsEndToEnd.test.ts`) but never fired in a saved run (because the agents' numbers come from SQL, they are rarely wrong).

### 3c. Feedback loop among agents (inside one run, and run to run)

- **Court debate → rebuttal → stricter answer wins** (`judgeOne`): the AI Judge and a plain-code fine-print screen both grade. If they disagree, one rebuttal round (cap `MAX_REBUTTALS = 1`), then the Judge rules again. A code "reject" always stands. If they still disagree, the grade is marked "disputed" and **not saved**.
- **Fact-check → send back → retry** (`checkWithCorrections`): a wrong amount/date goes back to its owner with exactly which line is wrong, up to 2 rounds, then dropped. "Could not check" (source down) is never sent back; it is dropped with a banner.
- **Safety gate**: ClawbackHunter asks RecallChecker before publishing a deal.
- **Eligibility counter-question**: Lawyer challenges Planner through one Zetaris question.
- **Lessons get graded**: the FactChecker marks each H-MEM lesson the court used as helpful (passed first time) or wrong (needed correction); its trust number moves (`workspace.feedbackLesson`).
- **Parent feedback → rule → future grading** (`POST /api/feedback` → `coach.proposeRules` → `case_law_proposals` table, status `proposed` → reviewer clicks Approve (`POST /api/case-law/:id/approve`, needs reviewer token) → `memory.addRule` stores it in H-MEM with confidence 0.5 + 0.1 per report (max 0.9) → next run the Judge's prompt lists it as "Binding case law (cite the ids)"; offline, the code screen matches it by shared keywords). Eval proof: run 1 approved the auto-renew offer, run 2 blocked it citing `mem-28`, 0 other offers wrongly blocked (`logs/scoreboard.json`, Oct 25).

### 3d. Feedback loop on aggregated data (the "Living Fine-Print Database")

- **Table `offer_checks`** (`shared/schema.ts` line 171): one row per graded offer: store, source link, fine-print fingerprint, face value, hidden cost, true value, auto-renew, renewal price, deadline, payout wait, steps, effort minutes, mail-in, receipt needed, catch types, verdict, rule citations, evidence quote, injection flag, `source` (`court` or `user_audit`). **No family column**, and the writer refuses anything not "agreed" by both sides (`offerChecks.ts`).
- **Who writes it:** the court during runs (Newsroom `writeBack`), live offer search (`liveSearch.ts`, agent `live_search`), and parent audits (`dealAudit.ts`, source `user_audit`), each only when the full AI court ran and both sides agreed.
- **How it is reused:**
  1. Next run, the Newsroom asks Zetaris (`v_offer_verdicts`, newest grade per offer) and **skips the AI** when the wording fingerprint is unchanged, or when a family-independent rule already rejected it (`canSkipAi`).
  2. Past grades for the same store go into the Judge's prompt as context.
  3. A second parent auditing the same offer gets the saved verdict instantly ("Another parent already checked this offer").
  4. Per-brand totals power the in-app **Offer report card** (`GET /api/offers/report-card`, view `v_audit_by_source`, split by court vs parent).
- **As an API (the "data product")**: `GET /api/offer-audit?store=Amazon` (`routes/offerAuditRoutes.ts`), read through Zetaris view `v_offer_audit` (per-brand: offers checked, offers caught, catch rate, average face/true value, average effort minutes). Public, read-only, rate-limited, every field copied one by one so no family data can leak; returns "none" or 503 rather than inventing rows. **A real OpenAPI description exists**: `bundle/docs/openapi/offer-audit.yaml` (OpenAPI = a standard machine-readable description of an API). Also `POST /api/offers/audit` (Audit-a-deal) and `POST /api/run` (start a run; returns the trace).
- **Parent feedback table** `feedback` (kinds `got_it`, `issue`, `not_relevant`) + `claims` table; read by the Coach through Zetaris view `v_coach_feedback`.

**Honest status of the data loop (real vs aspirational):**

| Piece | Status |
|---|---|
| Table, writer, "agreed only" rule, no family column | Real, tested |
| Skip-the-AI reuse in runs | Real (209 reuse lines in logs) but mostly from **sample-mode replays**, not live production data |
| Live rows in Neon | **13 rows, all from live search** (none from runs, none from parent audits) |
| Dollar values | **Blank in every row.** Likely cause (not confirmed): `buildOfferCheckRow` saves `check.faceValueCents`, which is read from the fine-print text only; live search passes the headline price as `valueCents` to the court but that number is never copied into the row. So a fine print with no "$" leaves all value columns empty. Average value columns in `v_offer_audit` are therefore null |
| Model name | **Blank in every row**: `buildOfferCheckRow` has a `model` parameter that no caller passes (`offerChecks.ts`, `liveSearch.ts` line 210, `dealAudit.ts` line 151) |
| Timestamp | Newest row about 4 h off (probably a time-zone bug) |
| Recorded API answer | The saved Zetaris answer for `v_offer_audit` shows 7 stores, 12 offers, 7 with a catch (Amazon 2/3, Babylist 1/1, Enfamil 2/2, Pampers 0/2, Similac 1/1, Target 0/1, Walmart 1/2), all `court` source, avg values null |
| Tavily finds quality | Earlier report: live finds are "mostly not real offers" |
| "API for others" (brands, apps, regulators) | **Aspirational.** Runs on localhost only; no hosting, no keys, no users |

So the deck can show the loop as **built and working, with a small real dataset (12 offers, 7 brands)**, and must not claim it is a large or populated database.

### 3e. Photo → structured data (the requested headline feature)

Real path, traced in code:
1. Parent taps **Scan gear or a receipt** (`client/src/components/scan/`), takes a photo of a product label or a paper receipt.
2. `POST /api/photo/read` (`routes/photoRoutes.ts`) → `readPhoto` (`ingest/photo.ts`). The photo goes to the NVIDIA vision model through `see()` in `adapters/llm.ts`.
3. **Plain code checks every field** (`checkReading`): real date, store name on receipts, one product per item photo, UPC check digit must add up, model/lot code shape, and **every code must appear in the text the model says it read** (so the AI cannot invent a model number). Only known product fields are copied, so card numbers, names and addresses cannot get through. A "not a label/receipt" photo is rejected.
4. **One retry** with the exact problems listed (`buildRetryPrompt`); then "please send a clearer photo". A gear photo with no model number and no barcode → "We couldn't find a model number. Try the white label." (never guesses).
5. Rows saved to **`purchase_items`** (product name, brand, model number, lot code, UPC, size, store, date, price, quantity, confidence, `extractor` = vision-model / sample-cache, source `photo_item` or `photo_receipt`, fingerprint so the same photo is not saved twice). A small thumbnail or the receipt picture (location data stripped) goes to **`item_photos`**. The full photo is wiped from memory.
6. **Immediately**: recall check per item (`ingest/gearRecall.ts`): car seats against NHTSA's 69 car-seat recalls (a saved file), everything else against CPSC through Zetaris (live mode only). Receipts also get an FSA/HSA-eligible check (`moneyBackFor`). Answer is "found", "No recalls found" or "could not check", never "safe".
7. **Gear Locker** (`GET /api/families/:familyId/gear`) lists saved gear and receipts with pictures. Gear is also written into the family's H-MEM memory ("Has: Infant Car Seat").
8. **Later runs**: the same `purchase_items` rows are what ClawbackHunter (FSA money back, price-drop refunds) and RecallChecker read through Zetaris. `purchase_items` is now the **only** purchase source agents read.

Before/after for the slide (from the real recording, `data/sample/vision-cache/`, Oct 25, NVIDIA): a made-up Graco car-seat label → `productName: Infant Car Seat · brand: Graco · modelNumber: SAMPLE-1042 · lotCode: SMP-0315 · upc: 012345678905`; a made-up "MADE-UP BABY MART" receipt → 3 rows: INFANT DIGITAL THERMO $12.99, NASAL ASPIRATOR $8.49, NEWBORN DIAPERS 84CT $24.99, date 2026-10-20.

Honest limits: NVIDIA's free vision service is often full ("16/16" busy) and the app gives up after about 10 s with "The photo reader is busy right now"; one garbled answer gets only one retry. Recordings exist for the two sample photos only (4 files: each photo as a file and as the browser uploads it). In practice mode, any other photo gets a clearly labelled fictional practice answer.

**Other creative data-input paths already in the app** (for the same slide):

| Input | Real? | Where |
|---|---|---|
| Photo of a product label (car seat, gear) | Real (live NVIDIA vision; recorded for the sample) | `ingest/photo.ts` |
| Photo of a paper receipt | Real, same path | `ingest/photo.ts` |
| Paste fine print, or a **screenshot** of fine print, into Audit-a-deal | Real; screenshot is read by the vision model, then the court grades it; agreed results join the shared database | `offers/dealAudit.ts`, `components/AuditDeal.tsx` |
| Live web search of trusted offer sites (Tavily) | Real; results go through the court | `offers/liveSearch.ts` |
| Parent taps: Got it / Not relevant / Report issue | Real; feeds the Coach and future grading | `POST /api/feedback` |
| Five onboarding answers (stage, date, ZIP, household, insurance) | Real; typed-in families work for any ZIP | onboarding |
| Live government feeds (CPSC, openFDA) via Zetaris; NHTSA car-seat file | Real (NHTSA is a saved snapshot) | `agents/recall.ts`, `ingest/gearRecall.ts` |
| Email receipts, barcode scan | **Not built.** Only labels in the `purchase_items.source` list, used by made-up sample rows | `ingest/purchaseItems.ts` |
| Plaid bank connection, Amazon order upload | **No longer used.** Tables and an Amazon CSV parser exist, but no agent reads them (comment in `ingest/purchaseItems.ts`) | — |

---

## 4. Slide-by-slide review of the current deck

| # | Current slide | Verdict | Why (criterion) | What to change |
|---|---|---|---|---|
| 1 | Title: "Your first 100 days, checked." + Receipt phone | **Change** | Demo/Product: first impression | Subtitle says agents "argue over every claim": only offers are argued; say "check every claim". Add "Snap a label or receipt" to the one-liner. New real screenshot. |
| 2 | Problem: $441 FSA, ~40% car seats fixed, 2026 rule changes | **Change (urgent)** | Impact 30 | **Placeholder text is still on the slide**: "[Stat]", "[New stat here — replaces WIC stat]", "[New source — replaces WIC citation]". Fill it (e.g. a recall or benefits-take-up stat from `research/research-boston-baby-benefits.html`) or delete the third tile. Re-check the Trump Account and 30-day insurance window facts flagged in the deck README. |
| 3 | User: Maya's family, "scattered across five places" (bank, Amazon, employer, IRS+MA, CPSC+FDA) | **Change** | Impact, Track 1 fit | Bank card spending and Amazon order history are **no longer read by any agent**. Replace with: photos of gear and receipts, employer benefits, IRS + state rules, CPSC/FDA/NHTSA recalls, deal fine print. Keep Maya and the 10-days-left countdown. |
| 4 | Solution: Onboarding → Receipt → Feed | **Keep, refresh** | Product & UX 10 | Re-shoot with the V2 app (tabs, buckets, scan button). Remove "Useful with no bank connected. Connecting data is the upgrade" (bank connect no longer exists); say "Snapping a receipt is the upgrade". |
| 5 | Five kinds of cards | **Change / shrink** | Product | Fine but now crowded out by better material. Merge into slide 4 or the photo slide. "Every discount survived Fine Print Court" is not quite true: filler offers are labelled "Not yet verified". |
| 6 | Architecture: newsroom of agents wired to one data door | **Change (rebuild)** | Technical 20, Innovation | Good bones. Missing: Fine Print Lawyer's eligibility challenge, safety gate (Clawback asks Recall), Newsroom reuse, shared workspace, PhotoReader, Live search, Audit-a-deal, offer_checks. "Neon: card txns, orders" is stale. "models: NVIDIA-hosted, supported" undersells: NVIDIA vision now runs live, and Meterless Nightshift is the first-choice AI router on the Mac. Split into an agent map (slide 6) and a message-flow slide (7). |
| 7 | "Nothing reaches a parent until it survives the court" | **Change** | Judges prioritise agents challenging each other | Uses the old offline screenshot and "Saved runs used the offline backup". There is now a **real AI debate with a rebuttal round** in the logs (Oct 25, offer 1318). Show that transcript plus the Fact-Checker gate. Confirm which model answered before claiming "Nemotron" (the trace names the provider). |
| 8 | Zetaris: one SQL question across private and public data | **Change** | Sponsor Tech 10 | The query shown joins `bundle_pg.amazon_orders`; today's code joins `v_purchase_items` (which includes photo rows) with CPSC **and FDA** (`pairsSql`). Update the query and say a snapped photo becomes a row Zetaris can join to a live recall feed. Add the other real Zetaris roles: per-agent views (Judge sees no family data), FactChecker's own query, Newsroom reading saved grades, the public audit view. Recall number #26191 vs internal cpsc-10560: pick one. |
| 9 | Meterless H-MEM: Run 2 is smarter than run 1 | **Keep, update** | Sponsor Tech, Innovation | Mechanism is right. Update `mem-1` → `mem-28` (latest eval), confidence formula (0.5 + 0.1 per report, max 0.9), and add the second Meterless role: the per-run shared workspace and graded lessons. Drop "offline only" note if a live run is captured. |
| 10 | Take either one away and Bundle stops working | **Keep, tighten** | "What was unique" is a required deck item | Good framing. Add Nightshift (Meterless AI routing) as used, and say honestly that Scout Intent is not used. |
| 11 | Stack + scoreboard ("6/6 traps") | **Change** | Technical, reliability | Scoreboard is now **8/8 traps, 0 false alarms, 3 stable runs** (Oct 25), still offline mode. Add NHTSA, Tavily, NVIDIA vision. Say "1,194 tests pass" (Oct 25 handoff; re-verify). Keep "Code does math, AI explains" (it is true: `explain.ts` throws away invented dollar figures). |
| 12 | Next: from "found" to "done" | **Change** | Future enhancements | "Live bank + Amazon connect, Today: Plaid-format sample data" is stale. Replace with: email receipts and barcode scan (named in the code, not built), more states, opening the offer audit API to others, scheduled re-checks. Add the hosted demo link if there is one. |

**Add (not in the deck at all):**
- Photo → structured data (requested headline; Innovation 15).
- How agents talk to each other (Technical; judges prioritise multi-agent interaction and traceability).
- The Living Fine-Print Database + the offer audit API (Innovation, Impact: value beyond one family).
- A real trace excerpt with `target_agent` (judges prioritise clear logs).

---

## 5. Claims in the deck that the code does not back up

| Slide | Claim | Problem | Fix |
|---|---|---|---|
| 2 | "[Stat] [New stat here…]" | Placeholder text shipped in the deck and PDF | Fill or delete |
| 1 | "A team of AI agents argues over every claim" | Only offers are debated; benefits get one counter-question; money back and recalls are fact-checked, not argued | "checks every claim; argues over every deal" |
| 3, 6 | Bank card spending, Amazon order history, "Neon: card txns, orders" as sources | No agent reads them any more; `purchase_items` is the only purchase source | Replace with photos/receipts |
| 4, 12 | "No bank connected… Connecting data is the upgrade"; "Today: Plaid-format sample data" | Bank connect is gone from the agent path | Rephrase around scanning |
| 8 | Query joins `amazon_orders` | Old Spike 0 query; current code joins `v_purchase_items` with CPSC + FDA | Show the current join, labelled |
| 6 | "Fact-Checker re-checks every dollar and date with its own Zetaris query" | True for offers, benefits, money back. Recall cards are checked against the recall text already read in the run (no new query) | "re-checks every dollar and date" (drop "own query" or limit it) |
| 6, 7 | "Wrong number? Send back (max 2 retries)" shown as something that happens | Built and unit-tested, but **never fired in any of 760 saved logs** | Say "built and tested"; do not show it as a demo moment unless you trigger it |
| 6, 10 | "Each agent sees only its own governed view" | Mostly true (Judge view has no family data; only the Planner view has income), but ClawbackHunter and RecallChecker share `v_purchase_items` | "Agents read through limited views; the Judge never sees family data" |
| 5 | "Discounts… Each one survived Fine Print Court" | Filler offers are "not yet verified" stand-ins | "Checked discounts survived the court; unchecked ones say so" |
| 7, 9, 10, 11 | "Saved runs used offline fallbacks… did not exercise NVIDIA" | Now **understated**: real AI court runs exist (Oct 25) and NVIDIA vision ran for the recordings | Update once the provider in the trace is confirmed |
| 11 | "6/6 planted traps"; `mem-1` | Out of date: 8/8, `mem-28` | Update |
| 9 | "confidence 0.8" | Correct only for 3 reports (formula 0.5 + 0.1 × reports) | Show the formula or the real number |

Nothing in the current deck claims the offer database or API, so no false claim there yet. When adding it: **do not show dollar averages** (they are empty) and **do not imply other companies use the API**.

---

## 6. Proposed new deck outline (15 slides; cut to 13 by merging 7 into 6 and 13 into 11–12)

| # | Slide | Content | Visual | Criterion |
|---|---|---|---|---|
| 1 | **Bundle. Your first 100 days, checked.** | Track 1 badge; "Snap a label or receipt. Agents check every claim, argue over every deal." | Real Receipt screenshot | Demo, Product |
| 2 | **The problem** | $441 lost per FSA holder; ~40% recalled car seats fixed; 2026 rule changes. Placeholder fixed | 3 stat tiles | Impact |
| 3 | **Who it's for (Maya, day 20)** | Five scattered places: gear and receipts, employer benefits, IRS + MA rules, recall feeds (CPSC, FDA, NHTSA), deal fine print | Five source cards → one family | Impact, Track 1 |
| 4 | **One screen, everything she's owed** | Onboarding → Receipt → feed buckets; cards show their work | 3 real V2 phone screenshots | Product & UX |
| 5 | **NEW: Snap it. We turn it into data.** (headline) | Photo of a car-seat label or receipt → NVIDIA vision → code checks every field (UPC check digit, code must appear in the read text, no personal data) → one retry → rows in `purchase_items` → instant recall + FSA check → Gear Locker → feeds money-back and recall agents on every run. Side strip: other inputs (paste or screenshot fine print into Audit-a-deal, live deal search, parent taps, 5-question onboarding). Honest footnote: free NVIDIA vision is often busy; demo uses recorded answers for two made-up sample photos | **Before/after**: photo on the left, field table on the right (product, brand, model, lot, UPC, price, date), arrows to "Recall check: No recalls found (69 NHTSA car-seat recalls checked)" and "FSA-eligible" | Innovation 15 (judges asked), Product |
| 6 | **NEW: The agent team** | Agent map: Orchestrator; ClawbackHunter, RecallChecker, BenefitsPlanner (+ eligibility Lawyer), FinePrintCourt (Deal Hunter, Lawyer, Judge, with Newsroom); FactChecker gate; CoachAI (between runs); PhotoReader, Live search, Audit-a-deal as inputs. One line each, plus "can block?" | **Diagram 1: agent map** | Technical 20 |
| 7 | **NEW: How they talk** | Three channels: hand-offs, shared workspace notes (claim / question / answer / correction / verdict, stored in H-MEM), and the trace with `target_agent`. Show 5 real log lines from the Oct 25 run (Deal Hunter claim → Judge → rebuttal → verdict → FactChecker → ParentFeed) | **Diagram 2: message flow** + real trace excerpt | Technical, "clear logs" |
| 8 | **Loop 1: agents check agents (inside one run)** | Court + code screen disagree → 1 rebuttal → stricter answer wins; disputed grades never saved. Safety gate: ClawbackHunter asks RecallChecker. Lawyer's counter-question to the Planner. FactChecker send-back (max 2), then drop. Real example: offer 1318 rejected after rebuttal | **Diagram 3a: checking loop** | Judges prioritise "challenge, validate, improve", "refined through iteration" |
| 9 | **Loop 2: parents teach the court (between runs)** | Report issue → Coach groups 2+ reports → proposal in `case_law_proposals` → human approves → H-MEM rule with source + confidence → Judge must cite it. Run 1 approved, run 2 blocked citing `mem-28`, 0 collateral blocks. FactChecker also grades lessons helpful/wrong | **Diagram 3b: learning loop** | Innovation, Sponsor Tech (Meterless) |
| 10 | **NEW: Loop 3: every grade makes the next one faster (the Living Fine-Print Database)** | One row per agreed grade in `offer_checks`, no family column; written by runs, live search and parent audits; next time: same wording → reuse, no AI; second parent gets instant answer; per-brand report card. Opened as an API: `GET /api/offer-audit` with an OpenAPI description. Real numbers: 12 offers, 7 brands, 7 caught (sample recording). Honest line: "small and new; dollar values not yet captured" | **Diagram 4: data → API** + a small brand table | Innovation, Impact (value beyond one family) |
| 11 | **Zetaris: the data door** | Current recall join (purchases incl. photo rows × CPSC + FDA, live, no copy). Limited views per agent; FactChecker's own query; Newsroom reads saved grades; public audit view. Spike 0 numbers (739 recalls, ~2 s) if still true | SQL snippet + views list | Sponsor Tech |
| 12 | **Meterless: memory that changes outcomes** | H-MEM: case law with confidence, run workspace, graded lessons, family memory (gear). Nightshift as AI router (if the Mac check passes). Not used: Scout Intent (say so) | Rule card + ledger line | Sponsor Tech |
| 13 | **What's unique: take either away and it breaks** | Keep current slide 10, tightened | Two columns | Required "unique" item |
| 14 | **Built to be checked: stack and results** | Stack (React + Express, Neon, Zetaris, H-MEM, NVIDIA Nemotron + vision, Tavily, CPSC/openFDA/NHTSA). 8/8 traps, 0 false alarms, 100% sourced, 1,194 tests. Fails safe list. Honest "offline eval" note unless a live eval is run | Scoreboard | Technical, reliability |
| 15 | **Next: from found to done** | Email receipts and barcode scan (named in the code, not built); pre-filled applications; every state; scheduled re-checks; the audit API for other parent apps; success-fee pricing | 4 tiles | Future |

### Diagrams needed (4 to 5)
1. **Agent map** (slide 6): boxes for each agent, grouped as inputs → producers → court → gate → feed, with Zetaris below and H-MEM to the side. Mark which can block.
2. **Message flow** (slide 7): a left-to-right sequence for one offer and one money-back card, labelled with the real note types and `target_agent` values.
3. **Two feedback loops** (slides 8 and 9): 3a a tight inner loop (debate → rebuttal → fact-check → send-back → retry, with caps 1 and 2); 3b an outer loop (parent → Coach → reviewer → H-MEM → Judge → next run).
4. **Data → API** (slide 10): many runs / parent audits / live search → `offer_checks` (no family column) → Zetaris view `v_offer_audit` → three uses: skip-the-AI reuse, in-app report card, public `GET /api/offer-audit`.
5. **Photo before/after** (slide 5): picture on the left, field table on the right, then the two checks it triggers.

---

## 7. Things to do before the deck is final (outside the deck itself)

1. Fix `offer_checks` blanks if possible: pass the model name into `buildOfferCheckRow`, and save the headline price when the fine print has no "$" (check the cause first). Otherwise the slide must say values are not captured yet.
2. Capture fresh real screenshots: scan sheet, photo result, receipt result, Gear Locker, Audit-a-deal result, report card, Agent Workspace panel (the `design/v2/screens/` images are mockups, not the real app).
3. Confirm which model answered the Oct 25 court run (trace / scoreboard provider label) before writing "Nemotron".
4. Optionally run one live eval (`npm run eval` with a model key) so slides 11 and 14 can drop the "offline" caveat.
5. Optionally trigger one real FactChecker send-back so slide 8 can show it, or keep it as "built and tested".
6. Re-run Zetaris `register` + `zetaris:record` so the report card shows in practice mode (handoff Oct 26).
7. Keep the demo video in step: `presentation/demo-video/video-script.md` was last updated Oct 25 and should get a 15-second photo-scan moment.

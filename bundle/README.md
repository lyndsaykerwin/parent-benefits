# bundle. Your first 100 days, checked.

**Track:** Track 1: Solving Fragmented Intelligence
**Sponsor technology:** Zetaris (one SQL "data door" over scattered sources), Meterless H-MEM (shared agent memory and workspace), Meterless Nightshift (AI switchboard, Mac only), NVIDIA Nemotron and vision models
**Built with:** Claude Code (Cursor was optional for this hackathon and was not used)
**Live demo:** https://bundle-app-qs47.onrender.com
**Run with no keys:** `cp .env.example .env && npm ci && npm run dev`, then open http://localhost:5050 (`SAMPLE_MODE=true` is already set)

---

## 1. Problem

A baby costs about **$20,400 in the first year** (BabyCenter survey, cited in our research file
`../research/research-boston-baby-benefits.html`). Money, benefits and safety warnings that could offset that are
scattered across systems that never talk to each other:

- **Tax credits and government benefits.** The $2,200 federal Child Tax Credit, the $1,000 Trump Account starter
  deposit, state paid family leave and state child credits each live on a different site, with their own rules and deadlines.
- **Employer benefit windows.** Adding a newborn to health insurance, or joining a Dependent Care FSA (a work account
  that pays childcare costs before tax), usually has a 30- to 60-day deadline after the birth.
- **Fine print on "free" offers.** Registry discounts and welcome boxes can hide auto-renewing memberships or shipping fees.
- **Money back on purchases.** Thermometers, nasal aspirators and similar items can be paid back from an FSA/HSA
  (tax-free health accounts), and some stores refund a price drop within 14 to 30 days. Parents rarely know which.
- **Recalls.** Recall records are split across CPSC (consumer products), FDA (food and medicine) and NHTSA (car seats).
  Only **42% of parents** said they returned the registration card for their latest car seat
  ([Safe Kids Worldwide, 2015](https://www.safekids.org/node/8977)), so many never hear about a recall.

No single tool joins these sources for one family. Bundle does, and shows where every answer came from.
It prepares; it does not give advice. Wording is "likely eligible", never "eligible".

**Every family, purchase and card in the sample data is made up.** The recalls, benefit rules and store policies are
real public facts; see [`data/README.md`](data/README.md).

## 2. Agent team

| Agent | What it does | Can block or retry? |
|---|---|---|
| **Orchestrator** | Runs the agents side by side; one failing never stops the rest; the feed is never empty | Keeps going and shows a banner |
| **PhotoReader** | Reads a photo of a gear label or a receipt into structured data (brand, model number, UPC, date made, prices) with an NVIDIA vision model | Retries an unreadable photo; says "Could not check that photo" instead of guessing |
| **Clawback Hunter** | Finds money that can come back: FSA/HSA-eligible spending, store price-drop refunds, Dependent Care FSA | Asks the Recall Checker before publishing; revises when sent back |
| **Recall Checker** | Checks purchases against CPSC and FDA recalls (through Zetaris) and car seats against NHTSA's car-seat recall list | Revises when sent back; shows "Not checked for recalls" when it cannot check, never "safe" |
| **Benefits Planner** | Likely benefits and deadlines from the birth or due date and the family's state | A lawyer agent challenges each benefit with one counter-question; the Planner confirms or drops it |
| **Fine Print Court** | A deal hunter argues for an offer, a fine-print lawyer argues against, a judge rules. A Value Score weighs true value against the minutes of effort | **Yes: rejects offers** (auto-renew traps, hidden fees, membership required) |
| **Fact-Checker** | Re-asks Zetaris for every dollar amount and deadline, and needs a source link on every card | **Yes: sends a card back up to 2 times, then drops it and logs why** |
| **Coach** | Turns parents' "report an issue" feedback into a proposed rule; a reviewer approves it into memory | Proposes only |

## 3. Why this is an agent system, not a chain

```
  Family (stage, date, ZIP)        Photo of gear label or receipt
            │                                  │
            │                            PhotoReader
            ▼                                  ▼
  ┌──────────────────────────────────────────────────────┐
  │  Agents, side by side                                │      ┌──────────────────────┐
  │   Clawback Hunter ──asks──► Recall Checker           │◄────►│ Meterless H-MEM      │
  │   Benefits Planner ◄─challenge─► lawyer              │      │ workspace notes and  │
  │   Fine Print Court: hunter vs lawyer, judge rules    │      │ learned rules        │
  └──────────────────────────┬───────────────────────────┘      └──────────▲───────────┘
            ▲                │ cards                                       │
            │ sends back     ▼                                             │ approved rule
  ┌─────────┴────────────────────────────┐                                 │
  │ Fact-Checker (re-asks Zetaris)       │                       Coach ────┘
  └──────────────────────────┬───────────┘                         ▲
                             ▼                                     │
                        Parent feed ───────── parent feedback ─────┘

  Every agent and the Fact-Checker read data through Zetaris:
  one SQL door over Neon Postgres + live CPSC and FDA recall feeds
```

Full diagram: [`docs/architecture.md`](docs/architecture.md).

1. **Agents ask each other.** Before the Clawback Hunter publishes a money-back card, it posts a `question` note
   asking the Recall Checker whether the item is recalled (`server/agents/clawback.ts`).
2. **Debate over fine print.** In the Fine Print Court a deal hunter argues for an offer and a fine-print lawyer
   argues against it; a judge rules, and code rules can overrule the AI.
3. **The Fact-Checker gate.** It re-runs its own Zetaris query for each claim. If the dollar amount or deadline does
   not match, it sends a `correction` note back to the agent that made the card.
4. **Learning from parents.** When 2 or more parents report the same problem, the Coach proposes a rule (for example
   "Reject offers whose savings depend on keeping a subscription active"). A reviewer approves it, it is saved in
   Meterless H-MEM, and the next run's judge must cite it. Run 1 approves a trap offer; run 2 blocks it.
5. **Saved grades are reused.** The court's finished grades are saved to our database and read back through Zetaris
   (`v_offer_verdicts`), so an offer whose wording has not changed is not re-judged on the next run. Offers pasted into
   "Audit a deal" are graded the same way.

## 4. Tech stack

| Part | Technology | Role |
|---|---|---|
| Data door | **Zetaris** (REST API) | One SQL layer over our Neon Postgres database and live CPSC and FDA recall feeds |
| Memory | **Meterless H-MEM** (open source, in `vendor/hmem`, Apache-2.0) | Learned rules, the per-run agent workspace, and "what Bundle remembers" about a family's saved gear |
| AI switchboard | **Meterless Nightshift** (Mac app) | First choice for AI calls (the default `MODEL_PROVIDER=auto`) when running on the same Mac; the hosted demo calls NVIDIA directly because a website cannot reach a Mac |
| Models | **NVIDIA** Nemotron (text) and vision models | Reached directly (an "OpenAI-compatible endpoint": a standard web address AI services share); the hosted demo uses NVIDIA |
| Database | Neon Postgres via Drizzle | Families, purchases, feedback, saved offer grades (live mode) |
| Web search | Tavily | Finds new offers on the web for the court to check (live mode only) |
| Server | Node 24, Express, TypeScript | Runs the agents and streams results to the app as they finish |
| App | React, Vite, Tailwind, Wouter | Mobile-first web app |
| Built with | Claude Code | AI coding assistant |

## 5. Quick start

Needs **Node 24 or newer** (`node -v` to check; get it from nodejs.org). No GPU, no keys, no database for sample mode.

```bash
git clone <this repository's address>
cd parent-benefits/bundle
cp .env.example .env     # SAMPLE_MODE=true is already set
npm ci                   # about 20 seconds; the "vulnerabilities" warning can be ignored
npm run dev              # ready when it prints "serving on port 5050"
```

Open http://localhost:5050 and tap "Try a sample family". The scrolling JSON lines in the terminal are the agents'
activity log, not errors.

Other commands:

```bash
npm test         # unit tests, about 1.5 minutes
npm run check    # type check
npm run eval     # the answer-key evals; scroll to the end for "trapsCaught": 8, "falseAlarms": 0
npm run build && npm start   # production build
```

`npm test` and `npm run eval` rewrite some saved files (`logs/scoreboard.json`, `output_examples/learning/`).
Undo with `git checkout -- logs output_examples`.

**Live mode (real keys).** Copy `.env.example` to `.env` (never commit it) and set `SAMPLE_MODE=false`,
`DATABASE_URL`, `ZETARIS_BASE_URL`, `ZETARIS_ORG_ID`, `ZETARIS_API_KEY`, and either Nightshift
(`NIGHTSHIFT_TOKEN_FILE`) or NVIDIA (`MODEL_API_KEY`, `MODEL_REASONING`, `MODEL_FAST`). Then `npm run seed`.
Never run `npm run db:push`. Mac-only steps: [`docs/mac-flip-on-checklist.md`](docs/mac-flip-on-checklist.md).

**Hosting (Render).** Root folder `bundle`; build `npm ci --include=dev && npm run build` (`--include=dev` is needed
because production mode otherwise skips the build tools); start `npm start`; set `NODE_ENV=production`,
`TRUST_PROXY=1`, `NODE_VERSION=24` and the keys in Render's dashboard.

## 6. Sponsor technology: what each one really does

**Zetaris.** Agents read their data through Zetaris, not straight from Postgres or the recall sites
(`server/adapters/zetaris.ts`). The key cross-source question **joins a family's private purchase list with the live
government recall feeds in one SQL statement** (`bundle_pg` with `bundle_live.cpsc_recalls` and
`bundle_live.fda_food_recalls`, in `pairsSql` in `server/agents/recall.ts`); fixed matching rules in `recallMatch.ts`
then decide which pairs are real. The Clawback Hunter joins the family's purchases (`v_purchase_items`) with FSA
categories, store policies and price observations. Views narrow what an agent sees: the court and the Fact-Checker read
offers through `v_judge_offers`, which holds no family data (views are defined in `scripts/zetaris/register.ts`).
Every query is a line in the run's trace.

**Meterless H-MEM.** Runs inside our server in every mode, offline too. It stores the rules parents teach Bundle (with
a confidence number and an append-only history log), which the Fine Print Court must recall and cite
(`server/adapters/memory.ts`, `server/agents/finePrintCourt.ts`). Each run also opens a shared workspace where agents
post `claim`, `question`, `answer`, `correction` and `verdict` notes (`server/agents/workspace.ts`). Not used:
Meterless's Scout Intent, Markovian and World Model engines.

**Meterless Nightshift and NVIDIA.** With `MODEL_PROVIDER=auto`, AI calls go to Nightshift first (only reachable on
the Mac it runs on), then NVIDIA directly, then fixed offline text. Money amounts and recall decisions are always
computed by code, never by the AI. Tested live on Oct 27, 2026 with `npm run model:check -- --provider nightshift`:
Nightshift answered in 0.6 to 2.4 seconds, using a small model running on the Mac (Llama 3.2 1B); no NVIDIA models
were reachable through Nightshift on this Mac, so NVIDIA is called directly. Results:
[`progress/reviews/nightshift-check.md`](../progress/reviews/nightshift-check.md).

## 7. Sample inputs and how to reproduce

Six made-up families in `input_examples/` (saved results in `output_examples/`). The main three:

- **Maya** (`maya`): baby born 2026-10-03, Massachusetts (02139). 7 purchases checked, $48.99 money back (an
  FSA-eligible thermometer and a price drop), a recall alert on a crib mattress, Massachusetts paid family leave.
- **Leo** (`leo`): baby due 2026-12-07, Massachusetts (02446). No purchases connected: benefits and deadlines only.
- **Ava** (`ava`): baby born 2026-08-24, Ohio (43215). Shows out-of-state filtering: no Massachusetts-only cards.

```bash
curl -s -XPOST 'localhost:5050/api/run?wait=true' \
  -H 'content-type: application/json' \
  -d '{"familyId":"maya"}'
```

Or type your own: `{"zip":"02446","birthDate":"2026-10-10"}`. Without `?wait=true` the call returns a `runId`
right away; read the agents' trace at `GET /api/runs/:runId/trace`. The sample families run on a fixed demo date,
2026-10-23, so their deadlines make sense (change it with `TODAY=YYYY-MM-DD`).

**Photos for testing** (live mode or the live demo), in `data/sample/photos/`:
`item-britax-recall-sample-label.png` (scan as **Gear**: a car seat on NHTSA recall 12C004000) and
`receipt-maple-moon-sample.png` (scan as **A receipt**: FSA-eligible items mixed with everyday ones). Both are drawn
samples and say so.

**Try the learning loop (2 minutes, no keys).** Set `REVIEWER_MODE_TOKEN=demo` in `.env` and restart. Run maya and
find the "Free newborn diaper box" card (a planted trap: it turns into a paid membership). Report it twice ("Report
issue" in the app), open "Bundle got smarter", enter Reviewer mode with `demo` and approve the rule. Run maya again:
the card is gone and the trace shows the judge citing the new rule. Scripted version: `npm run eval -- --learning`.

## 8. Proof: logs and scoreboard

Every Zetaris query, memory call and agent step is one JSON line in `logs/` (saved examples in `logs/sample/`).
`npm run eval` saves `logs/scoreboard.json`:

| Measure | Result |
|---|---|
| Planted traps caught | **8 of 8** (auto-renew offer, wrong-amount benefit row, recalled crib mattress, duplicate purchase, out-of-state family, a subtle subscription trap taught by the learning demo, and two look-alike recall checks) |
| False alarms | **0** |
| Cards with a source | **100%** |
| Money back found | Maya $48.99, Leo $0.00, Ava $14.58 |
| Learning demo | Run 1 approves the trap offer; run 2 blocks it, citing the reviewer-approved rule |

**Honesty note:** the saved scoreboard, examples and traces were produced offline (`llmMode: "offline-fallback"`):
Zetaris answers replayed from saved real responses, and fixed text instead of an AI model. They show the mechanism,
not AI quality. The live demo runs with real Zetaris, Neon and NVIDIA models.

## 9. Data honesty and safety

- **Never a false "safe".** If a recall source cannot be reached, the app says "Not checked for recalls". A clean
  result says "No recalls found", with how many records were checked.
- **Photo privacy.** Hidden photo details (EXIF: GPS location, time, phone model) are removed twice: on the phone and
  again on the server (`server/ingest/imageClean.ts`). "Forget my items" deletes a family's saved gear.
- **Made-up data only.** All family names, ZIP codes and purchases are fictional. No income in logs.
- **Abuse limits.** 10 runs per visitor per 10 minutes; typed-in families are never saved.

## 10. Limitations

- Sample mode replays saved Zetaris answers, so only the sample families run fully offline.
- Offline, the Fine Print Court is a plain rule screen, and the Coach picks from two pre-written rule sentences.
- Benefit amounts and windows were hand-checked as of 2026-10-23 and can go stale.
- No real bank or store connections; purchases come from receipt photos or the sample data.
- "Likely eligible" is a screening, not a decision.

## 11. Pre-existing components (not built during Oct 22-27)

- Starter setup files and standard buttons came from the VibeCode template (MIT, a free-to-reuse licence); none of
  Bundle's features came from it.
- **Meterless H-MEM reference implementation** (Apache-2.0), copied unchanged into `vendor/hmem` (see its NOTICE).
- **Zetaris getting-started** query patterns.
- Pre-Oct-22 research and planning.

Everything else (agents, orchestrator, Fact-Checker, court, Coach, photo reading, evals, app, sample data) was built
in the hackathon window.

Licence: MIT (see `LICENSE`).

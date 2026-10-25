# Bundle

> **Track:** Track 1: Solving Fragmented Intelligence
> **Sponsor technology:** Zetaris (SQL data door), Meterless (H-MEM memory engine; Nightshift as the AI switchboard on the Mac), NVIDIA-hosted models (supported; not in the saved results)
> **How it was built:** Built with Claude Code. Cursor was optional for this hackathon and was not used.
> **Run with no keys:** `cp .env.example .env && npm ci && npm run dev`, then `POST /api/run` on port 5050

## 1. What Bundle does (in plain English)

New parents are owed money, benefits and safety information that is scattered across a dozen places: a tax credit on
one government site, a leave programme on another, a refund window buried in a store's help page, a crib-mattress
recall on a federal safety feed. Nobody has time to line these up, and many "free" baby offers hide a paid
membership in the fine print.

Bundle is a small team of AI helpers ("agents": programs that each do one job and hand work to the next) that, for one
family, **find, check and prepare** these things, show where every answer came from, and learn from parent feedback.
It prepares; it does not give advice. Wording is "likely eligible", never "eligible".

- A **Benefits Planner** lists likely benefits and deadlines from the baby's birth or due date.
- A **Clawback Hunter** finds money that can come back (a price drop inside a store's adjustment window, spending that a flexible-spending account could have covered).
- A **Recall Checker** compares what the family bought with government recall lists.
- A **Fine Print Court** argues over "free" offers and rejects the ones with hidden catches.
- A **Fact-Checker** sends back, or drops, any card with no source or a wrong dollar amount or date.
- When parents report a problem, a **Coach** proposes a rule, a reviewer approves it, and the next run changes because of it.

**Year-one money figure.** Our research file estimates the first year's value for a middle-class Boston family at about
$9,210, not counting paid leave. Say it as: **"estimated from our research; about $6,040 independently source-checked."**
The checked rows (federal Child Tax Credit, Massachusetts Child and Family Tax Credit, the Trump Account deposit and
Dependent Care FSA tax savings) and their sources are in [`docs/year-one-table.md`](docs/year-one-table.md); the rest
comes from `../research-boston-baby-benefits.html`, which cites its own sources. Amounts are estimates, not promises.

**Every family, purchase and card in the sample data is fictional.** The recalls, benefit rules and store policies
are real public facts; see [`data/README.md`](data/README.md).

The approved one-line summary of who does what: *Zetaris finds candidate matches across private and public data in
one question. Code rules make the safety decisions and show their evidence. The AI argues over fine print,
explains, and fills gaps the rules can't, and code can overrule it.*

## 2. Agents

| Agent | Responsibility | Can block or retry? |
|---|---|---|
| Orchestrator | Runs the agents side by side; one failing never stops the rest; builds a never-empty feed | Yes (keeps going, shows a banner) |
| Clawback Hunter | Finds money that can come back: FSA/HSA-eligible spend, store price-adjustment refunds, daycare for a Dependent Care FSA | Revises when sent back |
| Recall Checker | Checks purchases against live government recall feeds through Zetaris | Revises when sent back |
| Benefits Planner | Likely benefits and deadlines from birth or due date | Revises when sent back |
| Fine Print Court | Deal hunter proposes, fine-print lawyer attacks, judge rules (max 5 offers per run) | **Yes: rejects offers** |
| Fact-Checker | Every card needs a source link, correct dollars and dates | **Yes: sends back up to 2 times, then drops the card and logs it** |
| Coach | Turns "report an issue" feedback into proposed rules; a reviewer approves them into memory. **Offline (no model), the Coach does not write rules:** when 2 or more reports share a theme it proposes one of two pre-written rule sentences (`THEMES` in `server/agents/coach.ts`: auto-renewing membership, shipping fee). With a model it clusters and words the rule itself | Proposes only |
| Scout (script) | Reads 3 saved pages and proposes benefit rows; rows not written on the page are rejected | Scout's own checks (and the Fact-Checker's no-source rule) reject; the saved run uses a scripted stand-in model |

What makes this more than a chain: the agents share one memory (learned rules), the Fact-Checker can send work back
or drop it, the Court can block an offer, sources can fail and the run still finishes, and a rule learned in run 1
changes the outcome of run 2. Diagram: [`docs/architecture.md`](docs/architecture.md).

## 3. Tech stack

| Part | Technology |
|---|---|
| Server | Node 24, Express, TypeScript |
| App | React, Vite, Tailwind (mobile first, 375px) |
| Data door | **Zetaris**: one SQL layer over a Neon Postgres database and live public recall feeds |
| Memory | **Meterless H-MEM** (Meterless's open-source memory engine, copied into `vendor/hmem` under Apache-2.0 and run inside our own server) |
| AI switchboard | **Meterless Nightshift** (a Mac app; first choice for AI calls when it is running; see section 14) |
| Models | NVIDIA Nemotron models, reached through Nightshift or directly (an "OpenAI-compatible endpoint" is a standard web address AI services share). Not exercised in the saved results |
| Database | Neon Postgres via Drizzle (live mode only) |
| Built with | Claude Code (AI coding assistant) |
| Logging | One JSON line per event in `logs/run-<id>.jsonl` |

## 4. Quick start

Needs Node 24 or newer. No GPU. **No keys for the sample run.**

### Option A: sample mode, no keys

`SAMPLE_MODE=true` (already set in `.env.example`) means the app runs from saved sample families and saved Zetaris answers, and never calls Zetaris or an AI model.

```bash
cp .env.example .env     # SAMPLE_MODE=true is already set
npm ci
npm run dev              # http://localhost:5050
```

Starts in a few seconds. Open http://localhost:5050 for the app, or call the API below.

Other commands:

```bash
npm test         # unit tests. The one live-database test (it reseeds Neon) is skipped unless you run RUN_DB_TESTS=1 npm test
npm run check    # type check
npm run eval     # the evals (answer key) and prints the scoreboard
npm run build && npm start   # production build
```

### Option B: real keys (live mode)

Everything the app can be told is listed, with plain-English comments and safe placeholders, in
[`.env.example`](.env.example). Copy it to `.env` (git-ignored) and fill in only what you have:

1. `SAMPLE_MODE=false`.
2. Database: `DATABASE_URL` (a Neon Postgres address), then `npm run seed` to fill the benefit rules and offers.
3. Zetaris: `ZETARIS_BASE_URL`, `ZETARIS_ORG_ID`, `ZETARIS_API_KEY`.
4. AI, either or both: Nightshift on a Mac (`NIGHTSHIFT_TOKEN_FILE`, plus the model names in `.env.example`), and/or NVIDIA direct (`MODEL_API_KEY`, `MODEL_REASONING`, `MODEL_FAST`). `MODEL_PROVIDER` picks the order (`auto` is Nightshift, then NVIDIA, then offline text).

Never commit `.env`. Never run `npm run db:push`: database changes here are applied as reviewed SQL, by hand, with the
owner's OK. Mac-only steps (Nightshift, recording new Zetaris answers) are in [`docs/mac-flip-on-checklist.md`](docs/mac-flip-on-checklist.md).

### Running the live-database test (opt-in)

`server/__tests__/seed.test.ts` clears and refills Bundle's own tables in Neon, so it never runs by accident. A normal `npm test` prints "Skipping seed.test.ts..." and moves on. To run it on purpose (needs `DATABASE_URL`):

```bash
RUN_DB_TESTS=1 npm test -- seed
```

### When you have an AI key (Nightshift or NVIDIA)

Put the key in `.env` (or the private settings file the server also reads; never commit it), then run these three commands in order:

```bash
npm run model:check -- --write   # 1. asks NVIDIA which Nemotron models your key can use, saves MODEL_REASONING and MODEL_FAST, sends one tiny test message to each and prints how long it took
npm run eval:live-model          # 2. the full eval, then the learning demo, with the real model; the scoreboard's llmMode names who really answered, e.g. "nightshift:<model ids>" or "nvidia-direct:<model ids>" ("mixed:" with counts if both did), instead of "offline-fallback"
npm run examples:regen           # 3. re-runs the saved example families into output_examples/ and logs/sample/ (replays the saved Zetaris answers; add -- --live to ask Zetaris live)
```

`model:check` stops with an error if there is no key or a model does not answer. Without `--write` it only suggests the two model ids. After step 3, update the "Every saved run here is offline" note in section 8 to match, and review the diff before committing.

### Deploy (Render)

`render.yaml` in the repo root describes the web service (build `npm ci --include=dev && npm run build`, start `npm start`; `--include=dev` is needed because with `NODE_ENV=production` plain `npm ci` skips the build tools). Nothing is created until you connect the repo on render.com and pick this file.

- **Use an always-on paid instance** (not the free tier): free instances go to sleep after inactivity and take about a minute to wake, which looks broken to a judge. `render.yaml` asks for the `starter` plan.
- **Environment variables** (already in `render.yaml`): `NODE_ENV=production`, `SAMPLE_MODE=true`, `TRUST_PROXY=1`.
- **Leave out** all `ZETARIS_*` keys and `DATABASE_URL` so the host replays the saved answers (see the hosting checklist below). Optional: `FRONTEND_URL`, `REVIEWER_MODE_TOKEN`, and `MODEL_API_KEY` / `MODEL_REASONING` / `MODEL_FAST` for real model text (enter secrets in Render's dashboard; `render.yaml` marks them `sync: false`).
- Health check: `/`.

### Hosting checklist (for a public demo)

1. `SAMPLE_MODE=true`. In this mode the app is always offline (it never calls Zetaris or the model and never writes the saved answers), even if keys are present on the host. Still, leave the keys off a public host.
2. `NODE_ENV=production`. `npm start` sets it for you; if your host starts the app another way, set it yourself. In production the app trusts one proxy hop so each visitor gets their own rate limit (`TRUST_PROXY=0` turns that off).
3. `npm ci && npm run build && npm start`. Optional: `FRONTEND_URL` (the site's own address, for CORS) and `REVIEWER_MODE_TOKEN` if you want Approve to work for visitors.
4. Check it from two different networks (e.g. a laptop and a phone on mobile data): both should be able to run a sample family, and each gets its own limits.

## 5. Usage

```bash
curl -s -XPOST 'localhost:5050/api/run?wait=true' \
  -H 'content-type: application/json' \
  -d @input_examples/leo.json
```

Request (a sample family, or type your own: `{"zip":"02446","birthDate":"2026-10-10"}`; a birth date must be within the last 2 years, a due date within the next 10 months):

```json
{ "familyId": "leo" }
```

Response (abridged; full files in `output_examples/`):

```json
{
  "runId": "leo-34c1e1b4-...",
  "cards": [
    { "kind": "benefit", "title": "Federal Child Tax Credit", "amountCents": 220000, "verdict": "likely",
      "sources": [{ "label": "Federal Child Tax Credit", "url": "https://www.irs.gov/credits-deductions/individuals/child-tax-credit" }] }
  ],
  "receipt": { "moneyBackCents": 0, "likelyBenefitsCents": 364000, "deadlineCount": 2, "nextDeadline": "2027-01-06", "itemsChecked": 0 }
}
```

Without `?wait=true` the call returns `202 {runId}` right away; poll `GET /api/runs/:runId`, and read the agents' trace
at `GET /api/runs/:runId/trace`. Other routes: `GET /api/scoreboard`, `POST /api/feedback`, `GET /api/case-law`.
Money is integer cents, computed in code, never by the model.

## 6. Sample mode (honest version)

`SAMPLE_MODE=true` (the default in `.env.example`) lets you run with **no keys and no database**:

- The three families come from `data/sample/families.json` (made up).
- **Zetaris is answered from saved real responses** (`data/sample/zetaris-cache/`, 126 files, captured 2026-10-23 by running the agents live against Zetaris). Nothing is pre-written: the agents still run their queries, the fact-checks and the court. See `data/README.md`.
- **Without `MODEL_API_KEY`, the model-written parts fall back to deterministic text.** The Fine Print Court uses a plain screen (rejects offers matching a learned rule's keywords, a stated shipping/handling fee over $5 or a fee that "may apply", or fine print that says Prime/a membership is required; trace status `fallback`). Its approvals say so: "Offline screen: no flagged terms found. Not reviewed by the AI court." It does not catch a free trial that auto-renews into a paid plan until a parent-reported rule teaches it (that is the learning demo). Explanations use fixed text.
- Memory is H-MEM running locally (folder `data/hmem`, created on first run).
- The sample families run on a fixed **demo date, 2026-10-23**, so their deadlines make sense. Change it with `TODAY=YYYY-MM-DD`. A family you type in uses the real date.
- A family you type in is never saved, so it has no purchases or card data: Clawback and Recall skip their lookups (the Receipt then says "Connect your data to safety-check items", never "all clear"). Benefits and the Fine Print Court still run on the saved shared data (benefit rules, the offers table), so a typed-in family gets checked benefit cards and court-judged offers with no banner (`output_examples/custom-family.json`). Anything that was never saved in the replay cache fails safely: the failure handling shows a banner and "Not yet verified" stand-ins, which sit in their own section, outside the Receipt, and never under "Deals that passed Fine Print Court".
- `SAMPLE_MODE=true` is always offline: it never calls live Zetaris or the model and never writes `data/sample/zetaris-cache/`, whatever keys are in your environment or private settings file. To capture new live answers, turn SAMPLE_MODE off.

### Try the learning loop (2 minutes, no keys)

This is the main idea: parents' feedback becomes a rule in memory that changes the next run. Reviewer mode is **off** unless you set a code, so first:

1. In `.env` set `REVIEWER_MODE_TOKEN=demo`, then restart `npm run dev`.
2. Run the maya sample (tap "Try as guest" in the app, or `curl -s -XPOST 'localhost:5050/api/run?wait=true' -H 'content-type: application/json' -d '{"familyId":"maya"}'`). Note the **"Free newborn diaper box"** card under the deals (its id is in the response; this is the planted trap: a "free" box that turns into a paid membership).
3. Report it twice (in the app: open the card, "Report issue"; or the API, using that card's id):
   `curl -s -XPOST localhost:5050/api/feedback -H 'content-type: application/json' -d '{"familyId":"maya","cardId":"<that card id>","kind":"issue","note":"free box turned into a paid monthly membership"}'` (send it two times).
4. `curl -s localhost:5050/api/case-law` shows the proposed rule (or open "Bundle got smarter" in the app).
5. Approve it: `curl -s -XPOST localhost:5050/api/case-law/<proposal id>/approve -H 'x-reviewer-token: demo'` (in the app: "Bundle got smarter", open Reviewer mode, enter `demo`, tap "Approve rule").
6. Run maya again: the card is gone, and the run's trace (`GET /api/runs/<runId>/trace`) shows the judge blocking it and citing the new `mem-…` rule.
7. The rule lives in `data/hmem/` (git-ignored). Delete that folder to reset.

Offline, the proposal wording comes from one of two pre-written sentences (see the Coach row above). The same flow, scripted, is `npm run eval -- --learning` (writes `output_examples/learning/run1.jsonl` and `run2.jsonl`). `server/__tests__/sampleMode.test.ts` runs these exact steps.

Live mode: set `SAMPLE_MODE=false`, `DATABASE_URL`, the `ZETARIS_*` values and `MODEL_*` values, then `npm run seed`.
Secrets go only in `.env` (git-ignored). `.env.example` holds placeholders.

## 7. How failures are handled

| What fails | What happens |
|---|---|
| A Zetaris query errors or times out | One retry for one known transient error (the purchases query, errors mentioning thrift or resultset); then a saved response if one exists (logged as `fallback`); otherwise that agent is skipped, the others finish, and the feed shows a banner |
| An agent throws | The orchestrator logs `agent_failed` and continues |
| The model is unavailable | Deterministic text and a plain court screen (its approvals are labelled "Offline screen ... Not reviewed by the AI court"); logged as `fallback` |
| A claim has no source, or a wrong amount or date | Fact-Checker sends it back (max 2), then drops it and logs the drop |
| Too little to show | The feed is never empty: fixed minimums of benefits, one recall card, discounts, and two "coming soon" tiles (pre-filled applications, price-drop watching) |
| Abuse | Rate limit of 10 runs per IP per 10 minutes; at most 2 runs at once per IP and 5 at once overall; typed-in families are never saved |

## 8. Proof: logs and the scoreboard

- Every Zetaris query, memory call and agent step is one JSON line (fields: `timestamp, trace_id, agent_name, action, input_summary, output_summary, target_agent, confidence, retry_count, status`). Saved runs: `logs/sample/` (maya, leo, ava, custom-family). Live runs write `logs/run-<id>.jsonl`.
- `npm run eval` prints the scoreboard and saves `logs/scoreboard.json`. Result of `SAMPLE_MODE=true npm run eval` on 2026-10-25 (demo date 2026-10-23; it exits 0). <!-- TODO W6: refresh these numbers once W6 regenerates the evidence -->

| Measure | Result |
|---|---|
| Planted traps caught | **6 of 6** in the saved file (auto-renew offer, wrong-amount Scout row, recalled crib mattress, refund, duplicate purchase, out-of-state family). The current eval checks **8 traps**: those six minus the retired refund trap, plus a subtler subscription-savings trap taught by the learning demo and two recall checks (look-alike products get no recall card; finished FDA recalls get none). <!-- TODO W6: replace with the regenerated 8-of-8 scoreboard --> |
| False alarms | **0** |
| Cards with a source | **100%** |
| Stable across 3 sample runs | yes |
| Money back found | Maya $48.99, Leo $0.00, Ava $14.58 |
| Learning demo | Run 1 approves the "free trial that auto-renews" offer; a reviewer-approved rule is stored in memory; run 2 **blocks** it and cites that rule (`mem-1`) |
| Who answered | `llmMode: "offline-fallback"`, Scout `fake-llm` (no real AI model) |

  **Every saved run here is offline** (`llmMode: "offline-fallback"`, Scout `fake-llm`): no real AI model was used for the scoreboard, the examples or the traces. Offline, the Fine Print Court's debate lines are "model unavailable" and the Coach picks from two pre-written rule sentences once 2 or more reports share a theme (see the Coach row in §2), so the learning demo shows the *mechanism* (feedback, then memory, then a changed outcome), not AI-written rules. A real-model run can be added with `npm run eval:live-model` once a model key is available (see "When you have an NVIDIA key" in section 4). The learning traces are in `output_examples/learning/`: `run1.jsonl`, `approve.jsonl` (the reviewer's approval: the `memory add_rule` call) and `run2.jsonl` (`memory recall_rules` returns the rule, then the judge blocks the offer and cites it).

## 9. Folder map

| Hackathon suggestion | Here |
|---|---|
| `app/agents/` | `server/agents/` |
| `app/orchestration/` | `server/agents/orchestrator.ts`, `server/bundleDeps.ts` |
| `app/adapters/` | `server/adapters/` (`zetaris.ts`, `memory.ts`, `llm.ts`), sample data in `data/sample/` |
| `input_examples/` | `input_examples/` (4 requests) |
| `output_examples/` | `output_examples/` (4 saved SAMPLE_MODE runs + learning traces) |
| `logs/` | `logs/` (`logs/sample/` committed) |
| UI | `client/` |

`output_examples/` are real saved responses from `SAMPLE_MODE=true` runs (replayed Zetaris, offline fallbacks), not live results. The maya and ava examples are **before learning** (the trap box is still approved); `output_examples/learning/run2.jsonl` shows it blocked after a parent-taught rule.

## 10. Data and licences

See [`data/README.md`](data/README.md): each source, licence, record count, how to rebuild it, and limits. All families
and purchases are made up. No real personal data and no income in logs.

## 11. Limitations

- Sample mode replays saved Zetaris answers, so only the three sample families run fully offline.
- The saved scoreboard, examples and traces used offline fallbacks; model quality is not measured there, and the offline Coach reuses two pre-written rule sentences.
- Offline, the Fine Print Court is a plain screen, not a judgement: it catches stated fees and membership requirements, not everything.
- Benefit amounts and windows are hand-checked as of 2026-10-23 and can go stale. Poverty-guideline figures were not independently re-verified.
- Offers are one hand-checked snapshot; the Scout demo reads only 3 saved, hand-written page excerpts.
- No real bank or retailer connections; the sample purchase data is a made-up fixture. The Amazon upload is optional.
- "Likely eligible" is a screening, not a determination.
- Zetaris data-quality rules were not set up; the Fact-Checker's "no source" rule is the enforced backstop.

## 12. Pre-existing components (not built during Oct 22-27)

- **VibeCode starter template** by Colin Matthews (MIT), upstream commit 6af369a (the task notes cite a9542c2, the Firebase-era commit; we used the later guest-only HEAD). Imported in commit `b2bc3be`, then trimmed (auth, payments and chat removed). It provides the Express/React/Drizzle skeleton.
- **Meterless H-MEM reference implementation** (Apache-2.0), vendored unchanged in `vendor/hmem` (see its NOTICE).
- **Zetaris getting-started** patterns (query client shape, REST table recipe).
- **Pre-Oct-22 research and planning** (benefit research, plans).

Everything else (agents, orchestrator, Fact-Checker, court, Coach, Scout, evals, UI, seed data, sample cache) was built in the hackathon window.

## 13. Sponsor tech: what each one really does

- **Zetaris (a SQL "data door": one place to ask questions that span several scattered data sources).** Agents read their data through Zetaris and not straight from Postgres or the recall sites (`server/adapters/zetaris.ts`); a run reads the family profile through Zetaris too (`familyProfileSql` in `server/agents/savedVerdicts.ts`), falling back to our Neon database (via Drizzle, our database toolkit) if Zetaris cannot answer; feedback is stored through Drizzle in live mode, and the court's finished grades are saved to our own database by `server/agents/offerChecks.ts` (we do not write through Zetaris). The real cross-source join: **one question joins a family's private purchase list with live government recall feeds** (our Postgres `bundle_pg` x `bundle_live.cpsc_recalls` and `bundle_live.fda_food_recalls`), written in `pairsSql` in `server/agents/recall.ts`; fixed matching rules in `recallMatch.ts` then decide which pairs are real. Other reads go through registered views (`v_purchase_items`, `v_judge_offers`, `v_offer_verdicts`, `v_clawback_tx`, `v_recall_orders` and others). The objects are defined in `scripts/zetaris/register.ts` and every query is a trace line. In sample mode answers come from saved real Zetaris responses (`data/sample/zetaris-cache/`), replayed by the exact SQL text.
- **Meterless H-MEM (Meterless's open-source memory engine).** Stores the rules parents teach Bundle (with a confidence number and an append-only history log, "the ledger"); the Fine Print Court recalls them and must cite them (`server/adapters/memory.ts`, `server/agents/finePrintCourt.ts`; the engine is `vendor/hmem/`). The run also exports the ledger to `logs/ledger-<runId>.jsonl` (`server/agents/orchestrator.ts`). Each run also opens a shared "workspace" in H-MEM where agents leave notes for each other (`server/agents/workspace.ts`) and the court reuses grading "lessons" (`server/agents/newsroom.ts`); see section 14.
- **Meterless Nightshift (a Meterless Mac app we use as the AI switchboard).** First choice for every AI question when it is running on the same Mac (`server/adapters/llm.ts`, setting `MODEL_PROVIDER`). It passes the hard questions to NVIDIA Nemotron using a key kept inside Nightshift. Details and fallbacks: section 14.
- **NVIDIA:** Nemotron models, reached through Nightshift or directly with `MODEL_API_KEY` (`server/adapters/llm.ts`); everything degrades to offline text. No live model run is included in the saved scoreboard or examples.
- **Claude Code:** the AI coding assistant this project was built with. Cursor was optional for this hackathon and was not used.

## 14. Meterless honesty note

What actually runs through Meterless, and what does not. "Fallback" means the app keeps working with a plainer substitute and says so in its trace.

**Meterless H-MEM: runs in every mode, offline too.** It is a library copied into this repo and run inside our server (no Meterless service is called). It does real work today: approved rules from parent feedback are stored in it and recalled by the Fine Print Court (the `recall_hmem` trace lines), and the learning demo (`npm run eval -- --learning`) shows a rule changing the next run. Engines used: **H-MEM only**, for case law, plus the workspace notes and newsroom-loop lessons described below. **Not used: Meterless's Markovian and World Model engines.** Our AI steps are short, and Zetaris plus our saved-grades table already hold the shared facts. H-MEM's AI-based extraction and "dreaming" are also not used in a run.

**Workspace and newsroom lessons: wired into every run.** The orchestrator opens one shared workspace per run (logged as `workspace_open`), where agents post `claim`, `question`, `answer`, `correction` and `verdict` notes into H-MEM. The Fine Print Court reads earlier saved grades through Zetaris and past lessons from H-MEM, skips the AI when an offer's wording is unchanged, and an "offer-check writer" saves its finished grades to our own database (`server/agents/offerChecks.ts`). The Fact-Checker uses `checkWithCorrections`: it sends a card back with a note, the owning agent revises, and the Fact-Checker marks a lesson helpful or wrong, which raises or lowers its confidence. A whole run has a 300-second budget (`RUN_DEADLINE_SECONDS`); past it, no new checking starts and the feed still finishes. You can see all of this in a run's trace (`GET /api/runs/:runId/trace`, or the Agent Workspace panel in the app) as `recall_hmem` and workspace lines.

**What Meterless is used for, and what is not.** Used: **H-MEM** (memory) and **Nightshift** (AI routing, Mac only). **Not used:** Meterless's **Scout Intent** (its safety gatekeeper that checks for prompt injection and issues signed permission slips), **Markovian** and **World Model**. Our injection checks (text written to trick the AI) are our own code (`server/agents/finePrintRules.ts`), not a Meterless product; the Scout script (`scripts/scout.ts`) is our own page reader and only shares the name. Details: `../qc-reports/meterless-safety-research.md`.

**Meterless Nightshift: runs only on Lyndsay's Mac.** Nightshift listens at `http://127.0.0.1:8088/v1` on that computer, so a cloud server, a hosted demo or a judge's machine cannot reach it. With `MODEL_PROVIDER=auto` the order is:

| Situation | Who answers AI questions |
|---|---|
| Mac, Nightshift running, token file readable (`NIGHTSHIFT_TOKEN_FILE`) | **Nightshift**, which forwards to NVIDIA Nemotron. Each call is traced with the provider and model that answered. |
| Nightshift missing or a call to it fails, and `MODEL_API_KEY`, `MODEL_REASONING` and `MODEL_FAST` are set | **NVIDIA direct** (`integrate.api.nvidia.com`). |
| Neither is available, `MODEL_PROVIDER=offline`, `SAMPLE_MODE=true` (unless `LIVE_MODEL=true`), or the 300-second run limit has passed | **Offline deterministic text**: fixed sentences, and a plain rule-based screen instead of the AI court ("Offline screen: ... Not reviewed by the AI court"). |

What the saved evidence shows: the committed scoreboard, `output_examples/` and `logs/sample/` were all produced **offline** (`llmMode: "offline-fallback"`); none of it passed through Nightshift or NVIDIA. Zetaris replays were recorded with the AI off on purpose. A Mac check on Oct 24 reached Nemotron through Nightshift (see `../HANDOFF-cloud.md`), and the full-AI scoreboard run is a Mac step (`npm run eval:live-model`, see `docs/mac-flip-on-checklist.md`). Until that is run and its output saved, do not read any saved result here as showing a live model. <!-- TODO W6: update this paragraph if a live Nightshift run is saved -->

Even with a live model, money amounts and recall decisions are computed by code rules, not by the AI, and code can overrule the AI.

## 15. Streaming and the saved feed

The app shows a saved feed instantly and updates it as the agents finish, with a status pill for each agent.

- `GET /api/runs/:runId/events` streams the run as server-sent events (a one-way, long-open web connection): `agent_status`, `card_ready`, `card_updated`, `card_removed`, then `end` (`server/routes/streamRoutes.ts`).
- Parents only ever receive events passed through the parent whitelist: cards are copied through the same safe-fields filter as everywhere else, only known agent names and their states are sent, and free-text labels and removal reasons stay owner-only.
- If the stream is missing or breaks, the app quietly falls back to asking `GET /api/runs/:runId` once a second (`client/src/lib/stream.ts`, `client/src/lib/poll.ts`). You can also poll `GET /api/runs/:runId/trace` by hand to watch the agents' steps.

**Forget my items.** The Extras tab has a "Forget my items" button (with a plain-English confirm step) that deletes the products saved from a family's photos (`POST /api/photo/forget`).

## 16. Try it yourself

Needs Node 24 or newer. No keys, no database:

```bash
cd bundle
cp .env.example .env     # SAMPLE_MODE=true is already set
npm ci
SAMPLE_MODE=true npm run dev        # starts on http://localhost:5050
```

In a second terminal:

```bash
curl -s -o /dev/null -w '%{http_code}\n' localhost:5050/    # 200 means the app is up
curl -s -XPOST 'localhost:5050/api/run?wait=true' -H 'content-type: application/json' -d '{"familyId":"leo"}'
```

Open http://localhost:5050 and tap "Try as guest" to see the app. Stop the server with Ctrl+C. Run the checks with `SAMPLE_MODE=true npm test` and `npm run check`. Never run `npm run db:push`.

Licence: MIT (see `LICENSE`).

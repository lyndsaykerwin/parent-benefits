# Bundle

> **Track:** Track 1: Solving Fragmented Intelligence
> **Sponsor technology:** Zetaris (SQL data door), Meterless H-MEM (memory), NVIDIA-hosted models (supported, not exercised in the saved results)
> **How it was built:** Built with Claude Code. Cursor was optional for this hackathon and was not used.
> **Run with no keys:** `cp .env.example .env && npm ci && npm run dev`, then `POST /api/run` on port 5050

## 1. Problem

New parents are owed money, benefits and safety information that is scattered across a dozen places: a tax credit on
one government site, a leave programme on another, a refund window buried in a store's help page, a crib-mattress
recall on a federal safety feed. Nobody has the time to line these up, and many "free" baby offers hide a paid
membership in the fine print.

Bundle's agents **find, check and prepare** these for one family, show where each answer came from, and learn from
parent feedback. (Bundle prepares; it does not give advice. Wording is "likely eligible", never "eligible".)

Example year-one value for a Boston family is in `research-boston-baby-benefits.html` (project research, not part of the app).

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
| Memory | **Meterless H-MEM** reference implementation (vendored in `vendor/hmem`, Apache-2.0) |
| Models | NVIDIA-hosted models (supported, not exercised in the saved results), via an OpenAI-compatible endpoint |
| Database | Neon Postgres via Drizzle (live mode only) |
| Built with | Claude Code (AI coding assistant) |
| Logging | One JSON line per event in `logs/run-<id>.jsonl` |

## 4. Setup

Needs Node 24 or newer. No GPU. No keys for the sample run.

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

### Running the live-database test (opt-in)

`server/__tests__/seed.test.ts` clears and refills Bundle's own tables in Neon, so it never runs by accident. A normal `npm test` prints "Skipping seed.test.ts..." and moves on. To run it on purpose (needs `DATABASE_URL`):

```bash
RUN_DB_TESTS=1 npm test -- seed
```

### When you have an NVIDIA key

Put the key in `../.secrets/bundle.env.local` as `MODEL_API_KEY=...` (never commit it), then run these three commands in order:

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
| Too little to show | The feed is never empty: fixed minimums of benefits, one recall card, discounts, and two "coming soon" tiles |
| Abuse | Rate limit of 10 runs per IP per 10 minutes; at most 2 runs at once per IP and 5 at once overall; typed-in families are never saved |

## 8. Proof: logs and the scoreboard

- Every Zetaris query, memory call and agent step is one JSON line (fields: `timestamp, trace_id, agent_name, action, input_summary, output_summary, target_agent, confidence, retry_count, status`). Saved runs: `logs/sample/` (maya, leo, ava, custom-family). Live runs write `logs/run-<id>.jsonl`.
- `npm run eval` prints the scoreboard and saves `logs/scoreboard.json`. Latest saved result (demo date 2026-10-23):

| Measure | Result |
|---|---|
| Planted traps caught | **6 of 6** (auto-renew offer, wrong-amount Scout row, recalled crib mattress, refund, duplicate purchase, out-of-state family) |
| False alarms | **0** |
| Cards with a source | **100%** |
| Learning demo | Run 1 approves the "free trial that auto-renews" offer; a reviewer-approved rule is stored in memory; run 2 **blocks** it and cites that rule (`mem-1`) |

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
- No real bank or retailer connections; the Plaid-shaped data is a fixture. The Amazon upload is optional.
- "Likely eligible" is a screening, not a determination.
- Zetaris data-quality rules were not set up; the Fact-Checker's "no source" rule is the enforced backstop.

## 12. Pre-existing components (not built during Oct 22-27)

- **VibeCode starter template** by Colin Matthews (MIT), upstream commit 6af369a (the task notes cite a9542c2, the Firebase-era commit; we used the later guest-only HEAD). Imported in commit `b2bc3be`, then trimmed (auth, payments and chat removed). It provides the Express/React/Drizzle skeleton.
- **Meterless H-MEM reference implementation** (Apache-2.0), vendored unchanged in `vendor/hmem` (see its NOTICE).
- **Zetaris getting-started** patterns (query client shape, REST table recipe).
- **Pre-Oct-22 research and planning** (benefit research, plans).

Everything else (agents, orchestrator, Fact-Checker, court, Coach, Scout, evals, UI, seed data, sample cache) was built in the hackathon window.

## 13. Sponsor tech

- **Zetaris:** the one door for all data. Agents read all their data through Zetaris and never touch Postgres or the recall sites directly (`server/adapters/zetaris.ts`); only the app shell loads a saved family profile and stores feedback, through Drizzle, in live mode. The key trick: **one query joins a private purchase list with a live government recall feed** (`bundle_pg` x `bundle_live.cpsc_recalls`). Registered objects: `scripts/zetaris/register.ts`. Every query is a trace line.
- **Meterless H-MEM:** stores rules learned from parent feedback (long-term memory with confidence and an append-only ledger); the Fine Print Court recalls them. `server/adapters/memory.ts`.
- **NVIDIA:** NVIDIA-hosted models (supported, not exercised in the saved results) for explanations and court reasoning (`server/adapters/llm.ts`); everything degrades to offline text. No live model run is included in the saved scoreboard or examples.
- **Claude Code:** the AI coding assistant this project was built with. Cursor was optional for this hackathon and was not used.

Licence: MIT (see `LICENSE`).

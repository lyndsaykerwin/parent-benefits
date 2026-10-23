# Bundle

> **Track:** Track 1: Solving Fragmented Intelligence
> **Sponsor technology:** Zetaris (SQL data door), Meterless H-MEM (memory), NVIDIA-hosted models (supported, not exercised in the saved results), built in Cursor
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
| Coach | Turns "report an issue" feedback into proposed rules; a reviewer approves them into memory | Proposes only |
| Scout (script) | Reads 3 saved pages and proposes benefit rows; rows not written on the page are rejected | Fact-Checker rejects |

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
| Built in | Cursor |
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
npm test         # unit tests
npm run check    # type check
npm run eval     # the evals (answer key) and prints the scoreboard
npm run build && npm start   # production build
```

## 5. Usage

```bash
curl -s -XPOST 'localhost:5050/api/run?wait=true' \
  -H 'content-type: application/json' \
  -d @input_examples/leo.json
```

Request (a sample family, or type your own: `{"zip":"02446","birthDate":"2026-10-10"}`):

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
- **Zetaris is answered from saved real responses** (`data/sample/zetaris-cache/`, 113 files, captured 2026-10-23 by running the agents live against Zetaris). Nothing is pre-written: the agents still run their queries, the fact-checks and the court. See `data/README.md`.
- **Without `MODEL_API_KEY`, the model-written parts fall back to deterministic text.** The Fine Print Court uses a plain screen (rejects offers matching a learned rule's keywords or an explicit shipping/handling fee over $5; trace status `fallback`). Explanations use fixed text.
- Memory is H-MEM running locally (folder `data/hmem`, created on first run).
- The sample families run on a fixed **demo date, 2026-10-23**, so their deadlines make sense. Change it with `TODAY=YYYY-MM-DD`. A family you type in uses the real date.
- A family you type in asks new SQL that isn't in the cache, so you will see the banner "Some sources didn't respond" and a safe, never-empty feed (`output_examples/custom-family.json`). That is the failure handling working, and it is also a limit of sample mode. Add Zetaris keys and the same code queries live.

Live mode: set `SAMPLE_MODE=false`, `DATABASE_URL`, the `ZETARIS_*` values and `MODEL_*` values, then `npm run seed`.
Secrets go only in `.env` (git-ignored). `.env.example` holds placeholders.

## 7. How failures are handled

| What fails | What happens |
|---|---|
| A Zetaris query errors or times out | One retry for one known transient error (the purchases query, errors mentioning thrift or resultset); then a saved response if one exists (logged as `fallback`); otherwise that agent is skipped, the others finish, and the feed shows a banner |
| An agent throws | The orchestrator logs `agent_failed` and continues |
| The model is unavailable | Deterministic text and a plain court screen; logged as `fallback` |
| A claim has no source, or a wrong amount or date | Fact-Checker sends it back (max 2), then drops it and logs the drop |
| Too little to show | The feed is never empty: fixed minimums of benefits, one recall card, discounts, and two "coming soon" tiles |
| Abuse | Rate limit of 10 runs per IP per 10 minutes; typed-in families are never saved |

## 8. Proof: logs and the scoreboard

- Every Zetaris query, memory call and agent step is one JSON line (fields: `timestamp, trace_id, agent_name, action, input_summary, output_summary, target_agent, confidence, retry_count, status`). Saved runs: `logs/sample/` (maya, leo, ava, custom-family). Live runs write `logs/run-<id>.jsonl`.
- `npm run eval` prints the scoreboard and saves `logs/scoreboard.json`. Latest saved result (demo date 2026-10-23):

| Measure | Result |
|---|---|
| Planted traps caught | **6 of 6** (auto-renew offer, wrong-amount Scout row, recalled crib mattress, refund, duplicate purchase, out-of-state family) |
| False alarms | **0** |
| Cards with a source | **100%** |
| Learning demo | Run 1 approves the "free trial that auto-renews" offer; a reviewer-approved rule is stored in memory; run 2 **blocks** it and cites that rule (`mem-1`) |

  This saved scoreboard was produced with the offline fallbacks (`llmMode: "offline-fallback"`, Scout `fake-llm`), not a live model. The learning traces are in `output_examples/learning/`.

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

`output_examples/` are real saved responses from `SAMPLE_MODE=true` runs (replayed Zetaris, offline fallbacks), not live results.

## 10. Data and licences

See [`data/README.md`](data/README.md): each source, licence, record count, how to rebuild it, and limits. All families
and purchases are made up. No real personal data and no income in logs.

## 11. Limitations

- Sample mode replays saved Zetaris answers, so only the three sample families run fully offline.
- The saved scoreboard used offline fallbacks; model quality is not measured there.
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

- **Zetaris:** the one door for all data. Agents never talk to Postgres or the recall sites directly; they send SQL to Zetaris (`server/adapters/zetaris.ts`). The key trick: **one query joins a private purchase list with a live government recall feed** (`bundle_pg` x `bundle_live.cpsc_recalls`). Registered objects: `scripts/zetaris/register.ts`. Every query is a trace line.
- **Meterless H-MEM:** stores rules learned from parent feedback (long-term memory with confidence and an append-only ledger); the Fine Print Court recalls them. `server/adapters/memory.ts`.
- **NVIDIA:** NVIDIA-hosted models (supported, not exercised in the saved results) for explanations and court reasoning (`server/adapters/llm.ts`); everything degrades to offline text. No live model run is included in the saved scoreboard or examples.
- **Cursor:** the build tool.

Licence: MIT (see `LICENSE`).

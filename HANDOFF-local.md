# Handoff: cloud → local (Sat Oct 24, 3pm Boston)

Cloud work stopped at 3pm Boston as Lyndsay asked. Everything below is saved on GitHub and merged into `main`.

## Where things are
- **Plan (signed off):** `bundle-plan-v3.md` (sign-off block at top; trace log = section 1c). Summary: `bundle-plan-executive-summary.md`. Flow chart: `flow-chart.md`. Lyndsay's directives: `lyndsay-final-directives.md`.
- **Build tracker (source of truth for build status):** `bundle-plan-v3.build-tracker.md` — done conditions, 26 chunks in 6 waves, status per chunk.

## Wave 1 (foundations): built, QC'd by separate agents, merged
Each chunk: builder → independent done check + tightness check → fixer → re-check. Full suite on the merged result: see the last line of this file.

| Chunk | What it does now | QC notes |
|---|---|---|
| W1-DB | Local Postgres test DB (`npm run db:test`), `pg` driver for local addresses, new tables: purchase_items (dedupe per receipt line), offer_checks (value + time fields, no family column), run_results, tax_parameters, state_programs | Fixed: receipt-line dedupe, LOCALHOST detection |
| W1-TRACE | Lyndsay's 10-field JSONL log to `logs/run_bundle_<runId>.jsonl` + stdout; old trace unchanged | Fixed: honest confidence (fallbacks 0.5), crashes logged as rejected, warnings instead of silent drops, quiet in tests |
| W1-OWNER | Parent responses whitelisted on the server; debates, traces, rule text, scoreboard, Approve need `x-reviewer-token` | Fixed: scoreboard leaked rule text; receipt now whitelisted |
| W1-FP | Code rules for FP-01..12 + 3 controls, verdicts approve / approve_with_catch / reject (code reject beats AI approve), fingerprint, Value Score = value + time to get it, worth-your-time settings | Fixed: S&H fees, prompt injection, auto-bill, negation, month-name dates; one rule set shared with offerScreen. Known gap: fees written in words ("five dollars and ninety-nine cents") |
| W1-ONB | Onboarding top row from the mocks (expecting / baby's here / sample family → due date or birthday → ZIP), "1 of 3" | Fixed: only MA shown as covered; honest message when the server can't check a state yet |
| W1-RECALL | Only finished ("Terminated") FDA recalls filtered (FDA feed stays); no_false_recall; pure matcher (UPC, model no., lot code, brand + type, dates, seller, evidence line) | Fixed: partial barcodes, phone numbers, brand check on model match. Honest held-out score to quote: **7 of 8, 0 false alarms (first run)** |
| W1-LLM | Nightshift → NVIDIA Nemotron direct → saved text; per-call time limit + one retry; run clock reset per run; LIVE_MODEL switch; vision `see()`; scoreboard label names the provider that actually answered | See status line at the bottom |

## Hand-off patches still to apply (files owned by later chunks)
- `server/agents/orchestrator.ts` (W4-ORCH): give each agent its own traced Zetaris/memory connection (`withTrace(trace, agentName)`) so log lines name the right agent.
- `factChecker.ts` / orchestrator: log the final yes as `approve_card` / `approved` / target `ParentFeed`.
- `finePrintCourt.ts:55`: `OFFLINE_APPROVE_TEXT = "No flagged terms found. We couldn't fully check this offer's fine print."` (+ test lines 172/174); then remove `parentBody` in bundleRoutes.ts.
- `scripts/eval.ts` (W5-EVALS): check the new `no_false_recall` and `no_terminated_fda` entries in `evals/expected.json`.
- `.env.example`: add the new settings (Nightshift/model settings from W1-LLM, `WORTH_*`, `EFFORT_*`, `TEST_DATABASE_URL`, `AGENT_LOG_STDOUT`).
- Server ZIP list (`server/sampleZips.ts`): any US ZIP must work — that's W2-STATE.

## What's left (not started)
Waves 2–6 in the tracker: W2 (Zetaris registration + saved-verdict query #38, any-state rules, purchase_items rerouting #8/#9, photo intake with NVIDIA vision + retry loop, H-MEM shared workspace, results persistence #20), W3 (Court rebuttal round, Fact-Checker targeted correction, safety-value + eligibility loops, offer audit endpoint + OpenAPI, Coach, trace panel #33, Version B tabs UI), W4 (orchestrator wiring, streaming/cached feed/status pills), W5 (coverage, evals, README incl. Meterless honesty note #44), W6 (evidence regeneration, offline + labelled).

## Mac flip-on steps so far
1. `cd bundle && npm ci` (adds `pg`).
2. Put `NIGHTSHIFT_TOKEN_FILE=<path to proxy-token>` and `MODEL_API_KEY` in `.secrets/bundle.env.local`.
3. `npm run model:check -- --provider nightshift`, then `-- --provider nvidia`, then `-- --vision`.
4. `npm run db:push` against Neon (creates the 5 new tables; asks before applying).
5. Record the new `finishedFdaSql()` Zetaris query once with live keys (until then sample mode keeps finished FDA rows and logs it).
6. After Meterless's Sunday update: set `NIGHTSHIFT_REASONING` and the thinking-off option (`NIGHTSHIFT_EXTRA_BODY`).

## How to resume locally
`git pull origin main`, open `bundle-plan-v3.build-tracker.md`, and continue with wave 2 using the same rule: builders in separate worktrees, separate QC agents, fixers, re-QC, merge only on pass.

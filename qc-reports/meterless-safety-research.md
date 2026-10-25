# Meterless "safety": what was promised, what exists, what to do

Research date: Sun Oct 25, 2026. Read-only; no code changed.

## 1. What was promised

- **CLAUDE.md:** "Meterless (memory + safety) ... must do real work."
- **learning-brief.md:48, :113:** maps "safety checks" to Meterless Engines, specifically **Scout Intent**. Scout is a gatekeeper that runs before an agent acts. It checks for prompt injection (text written to trick the AI) and personal data, then issues a signed "execution contract" (a tamper-proof permission slip).
- **project-plan.md:31 (Oct 21):** "Scout Intent to block risky actions until the parent approves."
- **build-plan.md:76 (later plan):** Scout Intent moved to **"Coming soon (not built)"**: "comes as a written blueprint only and would take 8–12 hours to build."
- **bundle-plan-v3.md item 44 (signed off Oct 24) / tracker W5-DOCS:** the README must say "H-MEM: shared workspace, newsroom-loop lessons and case law. Markovian and World Model not used." The plan does **not** promise Scout. Note that the approved wording also leaves out Scout Intent, so the "not used" list is incomplete.
- **Judging rules:** hackathon-overview.md:39, :103 say Meterless integration is required; :348 says Sponsor Tech is worth 10 points; :377 counts "bolted on" against you. architecture.md:79 quotes the Oct 24 posted rule: "Implement **at least one** Meterless Engine (H-MEM, Markovian, World Model, or Scout Intent) in a working feature. Use Meterless Nightshift as its primary AI provider." Safety is **not** a separate requirement. research-nightshift.md:165-173 already concluded "met, with H-MEM".

## 2. What Meterless does in the code today (bundle/)

| Piece | What it does | Where |
|---|---|---|
| H-MEM engine (vendored copy, Apache-2.0) | Memory store, retrieval, trust ledger | `vendor/hmem/src/*`; wrapped in `server/adapters/memory.ts:17-137` |
| Learned rules (case law) | A rule approved by a reviewer is saved in H-MEM | `server/routes/bundleRoutes.ts:358` → `memory.ts:41` (`addRule`) |
| Rules recalled before rulings | The Fine Print Court looks up matching rules | `server/agents/finePrintCourt.ts:120` → `memory.ts:54` |
| Agents' shared workspace | Notes the agents leave for each other during a run | `server/agents/workspace.ts:55-203` → `memory.ts:75, :90` |
| Newsroom lessons | Lessons are read before grading and written after an agreed verdict | `server/agents/newsroom.ts:110, :115, :156` |
| Confidence feedback | The Fact-Checker marks a lesson helpful or wrong, which raises or lowers its confidence | `server/agents/factChecker.ts:285-287` → `workspace.ts:162` → `memory.ts:129` |
| Trust ledger export | An append-only record of every memory read and write, saved per run | `server/agents/orchestrator.ts:285` → `memory.ts:135` |
| Nightshift (AI switchboard, Mac only) | First provider in the chain; sends the required headers | `server/adapters/llm.ts:6, :61-62, :396-462`; `scripts/check-model.ts:47-62` |

**Nothing from Meterless does safety work.** These look like safety features, but they are Bundle's own code:
- The prompt-injection pattern check is Bundle's own: `server/agents/finePrintRules.ts:76, :236-237, :255`, saved as `injectionDetected` in `offerChecks.ts:40`.
- The Scout script (`scripts/scout.ts`) is Bundle's own page reader. It shares the name but is not Meterless Scout Intent.
- `server/security.ts` sets standard browser security headers (helmet, a common add-on for Node web servers).
- H-MEM's "Guardrails" (`vendor/hmem/src/sleepCycle.ts:3, :45`) only keep memory tidy-up from archiving key records.

Bundle does not read Nightshift's signed receipts. Every saved run is offline, so no Nightshift call has been recorded yet (README:191).

**README/metadata today are honest.** They claim only H-MEM (README:4, :235; metadata.json:24). Nowhere do they claim Meterless safety.

## 3. Current Meterless docs on safety (cloned github.com/Meterless/Meterless, latest commit 2026-10-19)

- **Scout Intent engine:** `engines/scout-intent/AGENTS.md` (340 lines). Its "Guard" stage has 5 layers, each returning pass, warn or block:
  1. **Injection check:** known patterns, plus asking for a tool that the current request has no right to.
  2. **Policy gate:** who and which screen may do what, value limits, and when approval is required.
  3. **Scope check:** whether the request fits this user and session.
  4. **Personal-data check:** hides (redacts) or blocks personal data by type.
  5. **Rate limit:** caps how often a user can ask.

  The combined result is `{level: low|medium|high|block, flags, redactions, reason}`. The engine ends by issuing an HMAC-signed execution contract (HMAC is a standard way to sign data with a secret key) that expires after 5 minutes. API shape: `new Scout({intentRegistry, policyPack}).decide({prompt, user, surface})`, plus `guard()` (used in `examples/prompt-injection-block/index.ts`).
- **No ready-made package:** `package.json` says `"@meterless/scout" ... the package is not published`. It is a blueprint you build yourself. It does ship a test harness: `SCOUT_IMPL=/path npm run evals`, with 10 locked attack prompts in `evals/regression-set/v1/injection/adversarial.jsonl`. Targets: catches ≥0.90 of real attacks, and ≥0.95 of what it flags really are attacks.
- **Nightshift** (`docs/products/nightshift/how-it-works.md`, 2026-10-19): it has "Checks" (validators for generated files, and an "NLI contradiction guard", meaning a check that answers don't contradict each other). It also gives a "signed receipt" on every routed answer. These quality checks belong to Nightshift's overnight "jobs" feature, which Bundle does not use. They are not a safety filter for Bundle's calls.
- **Web search:** two searches found no third-party pages on Meterless Scout or Nightshift safety; the GitHub repo is the only current source. I could not get to meterless.ai.

## 4. Conclusion

**This is a wording gap, not a rule violation.** The rules require one engine, and H-MEM meets that with real, load-bearing work. "Memory + safety" in CLAUDE.md is left over from the Oct 21 plan. The team cut Scout on purpose (build-plan.md:76), and the signed-off v3 plan doesn't promise it. It would be overclaiming to call Bundle's own injection regex, Nightshift routing or H-MEM "Meterless safety".

**Option A: honest wording (zero build, recommended at minimum).**
- In the README/metadata engines field: "Meterless H-MEM: shared workspace, newsroom lessons, learned rules, confidence feedback. Not used: Markovian, World Model, **Scout Intent (safety engine)**. Bundle's prompt-injection and fine-print checks are our own code, not Meterless."
- Change CLAUDE.md "memory + safety" to "memory (H-MEM) + AI routing (Nightshift)", or note that safety (Scout) was cut.

**Option B: the smallest real fix (about 3–5 hours, fully cloud-buildable, SAMPLE_MODE, no keys).**
- Build only Scout Intent's **Guard stage**, with layer 1 (injection) and layer 4 (personal data), from `engines/scout-intent/AGENTS.md` §6. Put it in a new `server/agents/scoutGuard.ts`.
- Run it on every piece of outside text before it reaches an AI call: fine print in the Fine Print Court and Newsroom, and page text in `scripts/scout.ts`. It should:
  - return Scout's `{level, flags, redactions, reason}` shape;
  - write a trace line tagged "Meterless Scout Intent (Guard)";
  - block, or remove the planted instructions from, any input whose level is "block".
- Fold in the patterns from `finePrintRules.ts:76` so there is one checker, not two.
- Test it with a small adapter that runs Meterless's own 10 attack prompts (`adversarial.jsonl`), and report the real catch rate.
- Honest claim: "Implemented Scout Intent's Guard stage (injection + personal-data layers) from the Meterless spec, tested on Meterless's injection set. The intent catalogue, routing and signed contracts were not built."
- Signed execution contracts plus a small intent catalogue would add about 4–6 more hours. Skip them given the Oct 27 deadline.
- **The Mac is needed only to** record one live run in which the guard sits in front of real Nightshift/Nemotron calls (`npm run eval:live-model`) and to keep that `logs/run_<id>.jsonl`. The guard itself needs no keys and no Mac.

Sources: github.com/Meterless/Meterless (engines/scout-intent/AGENTS.md, package.json, evals/; docs/products/nightshift/how-it-works.md; commit 1742dec, 2026-10-19), cloned Oct 25, 2026.

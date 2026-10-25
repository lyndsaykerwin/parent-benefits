# Lyndsay's feedback: agent loops + latency (Oct 24, 2026, verbatim summary of what she pasted)

Goal: truly agentic (agents negotiate, delegate, cross-examine, refine offers in feedback loops) without ruining latency, UX responsiveness, or token spend. Move from a linear pipeline to an event-driven, multi-tier agent architecture.

## 1. Dynamic agent network
Shared agent memory & state workspace (a "bus") connecting Clawback Hunter <-> Recall Checker <-> Benefits Planner; they send candidate hypotheses to the Fine Print Courtroom (Hunter <-> Lawyer <-> Judge), then the Fact-Checker (cross-examiner).

Agent-to-agent loops:
1. Clawback Hunter <-> Recall Checker (safety-value loop): before publishing a price drop/rebate on an item, Clawback asks Recall Checker "any active flags on this item?". If a CPSC/FDA recall/alert exists on it, the deal is killed before reaching the Judge ("do not incentivize purchase or rebate claim on this item").
2. Benefits Planner <-> Fine Print Lawyer (eligibility loop): Planner sends a benefit's terms to the Lawyer, who tries to disprove eligibility (timing, tenure, income caps). If it finds a condition, it sends the item back with a counter-question, e.g. "query Zetaris for X before approving".
3. Judge <-> Fact-Checker rejection loop (iterative self-correction): instead of just dropping a card, the Fact-Checker sends a targeted correction back to the Court ("math miscalculation on line 2, recalculate net savings"); the Court re-runs with the error context, up to 2 iterations.

## 2. UX/latency: optimistic UI with progressive streaming and background swarms
- Instant local cache render (<100ms): show the previously verified feed.
- Fast-path agent swarm (1–2 s): single-pass rule checks, active recalls -> stream "high confidence" cards.
- Deep multi-agent loops in the background (Court debate, Fact-Checker retry, Zetaris write-back) -> live push updates ("New savings verified!") via WebSockets/SSE.
- Progressive card streaming: push a high-priority recall instantly; Court debates resolve in background and stream in.
- Agent "thinking" status pills, e.g. "Recall Checker cross-referencing CPSC feeds...", "Fine Print Lawyer examining FSA eligibility terms...", "Judge checking H-MEM memory...".
- Optimistic offline execution: serve cached cards from the last run's Zetaris write-back, then background validation inserts/updates/removes items.

## 3. Full database feedback loop (Zetaris + Neon)
1. Persistent grading: when Judge and Fact-Checker agree, write to Neon `offer_checks` {offer_id, status, confidence, rule_citations}.
2. Instant re-querying via Zetaris: next run's agents query Zetaris first; an offer rejected for Family A by a universal rule is skipped for Family B (no reasoning loop needed).
3. Continuous auto-tuning: "I got this"/"Report issue" increment/decrement `confidence_score`; below a threshold Zetaris re-flags the offer for a fresh debate loop.

Offered next steps: a JSON event schema for agent-to-agent messages; the SQL query for Zetaris to pull cached verdicts.

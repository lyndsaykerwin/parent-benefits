# Can Meterless memory be the agents' shared workspace and run the loops? (Oct 24, 2026)

Lyndsay's question (round 4c): "Shared message workspace and loops: isn't Meterless memory supposed to handle these?"

**Short answer: partly, yes.** Meterless's memory engine (**H-MEM**, short for "hierarchical memory") is built to be the place agents **write what they found and read what others found**, with a source, a trust number and an audit trail on every note. So it can be the shared workspace, and it has a built-in "was this note right?" correction loop. What it does **not** do is decide which agent works next, carry a message to a specific agent, or enforce time limits. That part is ordinary code we write (the "orchestrator", the code that runs the agents in order). Using H-MEM this way adds almost no waiting time, because it runs inside our own server with no AI call.

Sources read: `setup/meterless-engines/` (index, readme, H-MEM, Markovian, World Model), `meterless-sponsor-overview.md`, `bundle/server/adapters/memory.ts`, `bundle/server/agents/*`, the vendored engine in `bundle/vendor/hmem/`, and meterless.ai/engines.html (fetched Oct 24, 2026).

## What each Meterless engine can and can't do for us

| Engine | What it is | Fit for Bundle's workspace and loops |
|---|---|---|
| **H-MEM** (memory) | A store of short notes. Each note has a `source`, a `confidence` (a 0–1 trust number), the agent and run that wrote it, and links to what it came from. Every add, read and change is written to an append-only "trust ledger" (a log nothing is deleted from), saved as one line per event. | **Strong fit.** Its own guide says it gives "cross-agent shared knowledge: a Planner agent's decision is retrievable by a Verifier agent" (H-MEM §1) and lists "sub-agent message / handoff" and "Verifier/Critic verdict" as things to store (§6). It has a **built-in feedback loop**: a checker marks a recalled note "helpful", "not helpful" or "wrong", and its trust number goes up or down, so better notes rank first next time (§11.2). |
| **Markovian** (long tasks) | Splits one very long AI task into small chunks, passing a short summary forward, so cost doesn't balloon. | **Not a fit now.** Bundle's AI steps are short (one argument, one ruling). Chunking them would add AI calls and slow things down. |
| **World Model** (shared world state) | A shared, provenance-stamped picture of "things" (entities) that every agent reads and writes. meterless.ai says: "One shared World Model every agent reads from and writes to." | **Overlaps with what we have.** Zetaris + Neon + `offer_checks` already hold our shared facts. Building a second fact store in 2 days isn't worth it. |
| Swarm orchestration (mentioned only) | The engine guides name a swarm engine but it isn't in our folder, and meterless.ai only names examples without explaining them. | Not available to build on. |

None of the engines describes a **message bus** (a system that delivers a message to a named agent and wakes it up). meterless.ai doesn't mention one either.

## What is built today (code checked Oct 24)

- H-MEM is vendored (copied into our code, Apache-2.0 licence) in `bundle/vendor/hmem/` and wrapped by `bundle/server/adapters/memory.ts`.
- **Used now for one thing:** approved rules ("case law"). The owner approves a Coach rule, it's added to H-MEM (`addRule`), and the Judge recalls it before each ruling (`finePrintCourt.ts` line 87). Each run exports the trust ledger to `logs/ledger-<run>.jsonl`.
- **Built but not wired to any agent:** `feedback()` (the trust-number loop) works and is tested (`memory.test.ts`), but no agent calls it.
- **Not built:** agents don't post notes or questions to each other; the orchestrator passes work along (`orchestrator.ts` lines 208–261).

## Which parts are Meterless, which are plain code

| Piece of Lyndsay's design | Who does it |
|---|---|
| The shared whiteboard: agents post claims, questions, answers and corrections, each with source and evidence | **H-MEM** (run-scoped notes, tagged with the run id and the writing agent) |
| "Who said what, and why" for the judges | **H-MEM trust ledger** (already exported to `logs/`) plus our trace |
| Lessons that carry over to the next offers ("this store's mail-in rebates pay in about 8 weeks and take about 15 minutes") | **H-MEM long-term notes**, linked to the `offer_checks` row they came from |
| Self-correction of those lessons (Fact-Checker says a recalled lesson was right or wrong) | **H-MEM feedback** (built, not wired) |
| The hard numbers (dollars, minutes, days) | **Neon `offer_checks`, read through Zetaris** (Zetaris stays the only way agents read data) |
| Deciding which agent runs next, delivering a question to the right agent, round caps (max 2), the 300-second run limit, per-call time limits | **Plain code** (orchestrator) |
| Pushing updates to the screen (server-sent events) | **Plain code** |

## Recommended design (fast, and Meterless does real work)

1. **H-MEM is the shared workspace.** During a run, every agent message (claim / question / answer / correction / verdict) is also written as an H-MEM short-term note scoped to that run. Agents read the notes about the item they're working on before acting. The orchestrator still decides who goes next and delivers the question. Cost: milliseconds; H-MEM's built-in matcher needs no AI call.
2. **H-MEM is the newsroom loop's memory.** After each offer is graded and saved to `offer_checks`, one short grading lesson is saved to H-MEM long-term, pointing at that row. Before grading the next offer, the Court gets (a) past grades from `offer_checks` via Zetaris and (b) the top H-MEM lessons. When the Fact-Checker confirms or corrects a grade, the lessons used get "helpful" or "wrong" feedback, so their trust number moves. This uses the engine's own feedback loop for real, with no users needed.
3. **Keep out of the run (to stay fast):** H-MEM's AI-based note extraction, "dreaming" (making new conclusions from clusters of notes) and "sleep" (clean-up). If wanted, they can run between runs (an open proposal).
4. **Skip Markovian and World Model for this draft.** Say so honestly in the README: we mounted H-MEM, and here is where.

**Honest status:** H-MEM itself is built and in use; using it as the workspace and the newsroom loop's memory is **planned**. The orchestrator code (routing, caps, time limits) is partly built (send-back loop and round caps exist; the 300-second limit is planned).

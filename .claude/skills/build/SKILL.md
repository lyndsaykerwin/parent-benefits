---
name: build
description: Use when the user says "go build this plan", "/build", "execute this plan", or hands over a written plan/spec/PRD to implement. Turns a plan into finished, QC'd code using subagents for 100% of the work — the main thread only orchestrates, never writes code. Not for exploratory or single-line changes.
---

# Build

Run a plan to completion. **You are the orchestrator, not a builder.**

Read `using-superpowers` before dispatching (required for coding work).

## The one hard rule

The main thread never writes, edits, or fixes code. Not one line, not "while I'm here",
not "this is faster than dispatching." If you are about to call Edit or Write on a source
file, stop — that work belongs to a subagent.

The main thread does exactly five things:
1. Reads the plan and writes the tracker
2. Splits work into chunks
3. Dispatches subagents
4. QCs and merges what comes back
5. Declares done

## 1. Tracker first

Before any work starts, write `<plan-name>.build-tracker.md` next to the plan:

- **Done conditions** — copied *verbatim* from the plan. If the plan has none, derive them
  and show the user before proceeding. This list is the only definition of "done."
- **Chunks** — each with: scope, files it owns, depends-on, status
  (`pending` / `building` / `built` / `qc-pass` / `qc-fail`)
- **Open questions** and **decisions made**

Update it after every dispatch returns. It survives a context reset; your memory doesn't.

## 2. Split

One chunk = one subagent = one coherent piece of work with its own files. Chunks that
share files or depend on each other's output are sequential; everything else is parallel.
Dispatch all parallel chunks in a single message so they actually run concurrently
(see `dispatching-parallel-agents`).

## 3. Dispatch builders

Each builder gets a self-contained brief — assume zero knowledge of this conversation:

- The chunk's goal and its done conditions
- Which files it owns and must not touch outside
- Relevant plan excerpts (paste them; don't say "see the plan")
- Required: tests written and run, and **evidence** in the return — commands run, actual
  output, files changed. Not "tests pass."
- "Report blockers instead of working around them or inventing scope."

Subagents must finish their chunk. A partial return is a failed dispatch — send it back
with what's missing, or re-scope it into smaller chunks. Do not absorb the remainder yourself.

## 4. QC — separate agents, never the builder

A builder reviewing its own work is not QC. For each built chunk, dispatch a fresh
reviewer with the code and its done conditions, and ask two distinct questions:

- **Done check** — does this actually satisfy every done condition? Verify by running it,
  not by reading it. Where's the evidence?
- **Tightness check** — dead code, duplication, unused params, over-abstraction,
  swallowed errors, unhandled edge cases, inconsistency with surrounding code,
  untested paths. (Use `/code-review` or `code-reviewer` if it fits.)

Run one integration QC pass across the merged whole once all chunks are `qc-pass` —
seams between chunks are where this breaks.

Findings go to a **fixer subagent**, not to you. Re-QC after fixes. Loop until clean;
if a chunk fails QC three times, stop and take it to the user — the plan is probably wrong.

## 5. Done means all of this

- [ ] Every done condition met, verified by a non-builder agent with evidence attached
- [ ] Tests written and passing (real output in the tracker, not a claim)
- [ ] Tightness QC clean or findings explicitly waived by the user
- [ ] Integration QC clean across the merged work
- [ ] Tracker reflects final state; no chunk left `pending` or `qc-fail`

Anything short of that is reported as "not done, here's what's left" — never rounded up.

## Report

Plain English, no jargon. What got built, what QC found and how it was resolved, what you
left out and why, and anything the user needs to decide.

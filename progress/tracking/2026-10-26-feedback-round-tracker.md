# Oct 26 feedback round: tracker

Deadline: submission due Oct 27, 23:45 UTC. Lyndsay approves the plan from her phone, then the build starts.
Plan file: plans/2026-10-26-feedback-round-plan.md

## Phase 1: research for the plan (subagents, in parallel)
- [ ] A. App comments: find the code and root cause for each of Lyndsay's 12 comments -> progress/reviews/2026-10-26-comments-code-map.md
- [ ] B. Re-grade against judging criteria; list gaps she did not name -> progress/reviews/2026-10-26-judging-regrade.md
- [ ] C. Outside testers on a phone (hosting options, current pricing, login/keys/cost safety) -> progress/reviews/2026-10-26-outside-testing-options.md
- [ ] D. Deck review vs judging criteria + agent system, agent-to-agent talk, two feedback loops, data-as-API -> progress/reviews/2026-10-26-deck-gap-review.md

- Added mid-research (Lyndsay): judges want creative ways to add data -> deck must headline photo -> structured data (sent to D).

- Lyndsay: repo going public is handled by her at submission; don't count it as a gap (keep only a final key scan as a pre-flight step).

Phase 1 done: all four reports in progress/reviews/ (A, B, C, D above).

## Phase 2: plan
- [x] Plan written: plans/2026-10-26-feedback-round-plan.md
- [ ] Sent to Lyndsay's phone; waiting for approval + 3 decisions (blocking rule, Render $7/mo, "Baby's savings" name)

## Phase 3: build (after approval)
- [ ] (filled in from the approved plan)

## Known from this morning's session
- Real mode runs; NVIDIA's free photo AI is often full (503 "16/16") and the app gives up after ~10 s; one garbled answer gets only one retry.
- offer_checks: 13 rows, all live_search; dollar values and model name are blank in every row; newest row's time is ~4 h off (likely time zone bug).
- A pretend family "test-live-check" has one made-up receipt saved in Neon from testing.

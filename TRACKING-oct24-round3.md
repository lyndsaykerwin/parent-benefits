# Oct 24 round 3: tracking

Started Sat Oct 24, 2026 (cloud session). Coordinator: main Claude session. Subagents do the work.

Lyndsay's asks:
1. Use email (purchase receipts) as the item-level data source for matching, instead of / alongside Amazon order upload.
2. She has downloaded Nightshift (on her Mac). Work out how to wire Nightshift + the NVIDIA model in.
3. List any outstanding decisions.
4. Revised plan + exec summary: succinct, ELI12 (explain like I'm 12), no technical detail left out.
5. Flow chart in words only (Excalidraw-style boxes and arrows): user input, guardrails, agent system, evals, Zetaris's job, NVIDIA's job, Meterless's job. For submission docs.

## Phase 1 (parallel)
- [ ] R1 Email receipts: how to get them (Gmail connect vs forwarding address vs Agentmail inbox), privacy, Google approval rules, fake-data demo, how matching improves → `research-email-receipts.md`
- [ ] R2 Nightshift + NVIDIA: setup steps on the Mac, how the app talks to it, code changes needed, where Nemotron fits, test plan → `research-nightshift-setup.md`

## Phase 2 (after Phase 1)
- [ ] W1 Update bundle-plan-v3.md (email + Nightshift + open decisions list); freeze copy in plan-history/ first
- [ ] W2 Rewrite bundle-plan-executive-summary.md (ELI12, all technical details)
- [ ] W3 Words-only flow chart → `flow-chart.md`
- [ ] QC by coordinator, commit, merge to main

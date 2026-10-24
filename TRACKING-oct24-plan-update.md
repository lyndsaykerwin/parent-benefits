# Oct 24 plan update: tracking

Started Sat Oct 24, 2026. Coordinator: main Claude session. All the work is done by subagents.

## Phase 1: research (running at the same time)
- [x] R1 Nightshift (done; code references spot-checked. Open: ask the Meterless help channel whether the M1+ edition counts as "primary" and whether it can reach Nemotron): what it is, how to make it the main AI provider, where NVIDIA still fits → `research-nightshift.md`
- [x] R2 Matching (done; matching code in recall.ts confirmed) + agent API: how lists get matched today (code + Zetaris), how to make it better; agent-friendly format for the brand audit data → `research-matching-and-agent-api.md`
- [x] R3 Onboarding (done; checked: 6 sections, claims match the code): turn the onboarding designs (copied to `onboarding-design/`) into a plain spec → `onboarding-spec.md`

## Phase 2: write (after Phase 1)
- [x] W1 Plan update (done Oct 24): Oct 24 update box, Nightshift (3 outcomes), recall matching, offer_checks + Value Score + brand audit, onboarding, must/should/cut ranking, new timeline, 6 onboarding decisions (section 8) in `bundle-plan-v3.md`. Frozen copy: `plan-history/bundle-plan-v3-2026-10-24-before-update.md`. No "Supabase" mentions were in the plan to fix. Note: Value Score formula is not defined anywhere yet.
- [x] W2 Architecture doc (done Oct 24; every BUILT claim has a file:line reference, checked against the code; tests 268 pass / 8 skipped) → `architecture.md` (sponsor tech, evals, guardrails, data flow). Top guardrail gaps: the AI Judge has the final say on offers; trace, debate and case law are open to anyone; the privacy views are a convention, not enforced by Zetaris permissions.

## Phase 3: grade (after Phase 2)
- [x] G1 Re-grade (done: 53 today, about 74 projected; fails 3 must-pass rules today: Nightshift, public repo, video. "No GitHub remote" confirmed) the whole app against the hackathon criteria → `regrade-2026-10-24.md`

## Decisions carried in from chat
- Store price feeds (Amazon/Walmart/Target) are cut: you can't get access in time.
- Build the "agents' scorecard" table (`offer_checks`) in Neon and register it in Zetaris as its own source.
- Value Score is shown to parents.
- Brand audit (Strategy 3): only the data, in an agent-friendly read-only format. No brand screens. Pitch slide.
- Neon, not Supabase.
- No Redis. Agents write results to Neon; screens read from Neon.
- Don't overclaim "real-time." Meterless = memory engines, not fine-print parsing.

## Round 2 (Oct 24 afternoon), Lyndsay's feedback
Decisions:
- KEEP Plaid. Real customer data is what makes this valuable.
- DROP the poverty guidelines / WIC / SNAP angle. The target is middle-class parents.
- Brand audit: a Zetaris view plus a read-only endpoint with an OpenAPI description. MCP later.
- No confidence-score bands. Find a matching approach that's actually higher quality.
- Add fine-print evals (shipping fee on "free", expired dates, effort/hassle to claim). Effort and details become part of the offer_checks dataset.
- Grade the FUTURE-STATE plan only, focused on hard-to-reverse decisions (innovation, technical, impact, sponsor tech). Skip mechanical items (repo, video).
Steps:
- [ ] A Matching test on Plaid-style bank data + order data vs live recalls → `entity-resolution-test.md`
- [x] B Audit (done; MA claims spot-checked): non_ma_family / MA hardcoding, poverty/WIC usage, fine-print eval spec → `audit-ma-poverty-evals.md`
- [x] C Plan update (done Oct 24; round-1 copy frozen at `plan-history/bundle-plan-v3-2026-10-24-round1.md`). Woven into `bundle-plan-v3.md`: Plaid back in; middle-class sources (Child Tax Credit, Dependent Care FSA, MA/NY/CA paid leave, work benefits, recalls) replace poverty/WIC; any-state rules + 5-family `state_agnostic` test + Ohio auto-renew fix; 12 fine-print tests + 3 controls + "approve, with a catch" + `offer_checks` key fields; brand audit view + read-only endpoint (MCP later); Nightshift → Nemotron (one fallback); re-ranked must/should/cut; mechanical submission items reduced to a timeline reminder. **Product matching is still PENDING** the step A results (`entity-resolution-test.md`); the plan's section 4 item 6 is marked pending and needs filling in when A finishes.
- [ ] D Future-state grade (after C) → `plan-grade-future-state.md`

## Paused Oct 24 (out of credits). Where things stand
- Done: plan updated with round-2 decisions (bundle-plan-v3.md); audit-ma-poverty-evals.md; research-nightshift.md (incl. afternoon update).
- Done: matching test (entity-resolution-test.md). Brand + product type + date rules found 7 of 8 matches on new test data; bank lines have no product names, so recalls need item data (Amazon orders, registry, receipts).
- Next when resuming: 1) read entity-resolution-test.md and fill in the PENDING "Product matching" section of the plan; 2) run step D, the future-state grade (plan-grade-future-state.md), focused on hard-to-reverse choices, measured against the strong-submission examples; 3) connect the app to Nightshift once installed.

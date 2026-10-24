# Oct 24 round 4: tracking

Started Sat Oct 24, 2026 (cloud session). Coordinator: main Claude session. Subagents do the work.

## Lyndsay's feedback (her words, summarised)
- Ways for parents to get data in: (1) receipt forwarding from email, (2) barcode scanning, (3) photos of items in the house or of receipts, turned into structured data by NVIDIA models so Zetaris can join it with other sources.
- NOT on board with the round-3 recommendations or the "can wait" items yet. **Rule: no background decisions or cuts to her plan without asking and getting her approval.**
- Onboarding mocks already have a due date. The question about parents' jobs (work benefits) is cut: we weren't doing anything with it.
- Onboarding = top row of mocks (onboarding questions) + bottom row "version B" (bottom navigation). Do NOT use the middle row. Ask her if anything is unclear.
- Why drop FDA recalls? Feels simple and additive for scoring.
- Confirm everything in Neon still goes through Zetaris for the joins.
- Confirm we are still creating the new dataset from our grades of offers (offer_checks) and doing the OpenAPI endpoint we decided.
- Nightshift can't run from the cloud: work out how much can be built here (including the Nightshift code), to flip on later on the Mac.
- Plaid is still in the plan though she decided against it; several places mention work benefits. Remove.

## Phase 1 (parallel, read-only research)
- [ ] R1 Photo + barcode intake with NVIDIA models → `research-photo-barcode-intake.md`
- [ ] R2 Onboarding mocks review (top row + bottom row B) vs spec; questions for Lyndsay → `onboarding-design/round4-mock-review.md`
- [ ] R3 Audit: Neon→Zetaris, FDA recalls, offer_checks/OpenAPI status, every Plaid + work-benefits mention, every background decision baked into the plan → `audit-round4.md`
- [ ] R4 What can be built in the cloud now (incl. Nightshift code behind a switch) → `cloud-build-assessment.md`

## Phase 2 (after Phase 1 + Lyndsay's answers)
- [ ] W1 Plan: apply her decisions, undo the baked-in recommendations (proposals only, in the open-decisions list)
- [ ] W2 Exec summary + flow chart refresh
- [ ] QC, commit, merge

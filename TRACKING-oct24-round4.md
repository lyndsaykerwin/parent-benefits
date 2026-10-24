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
- [x] R1 (done: photo of label/can unlocks model-number and lot-code matches; barcode works for formula) Photo + barcode intake with NVIDIA models → `research-photo-barcode-intake.md`
- [x] R2 (done; 4 questions for Lyndsay) Onboarding mocks review (top row + bottom row B) vs spec; questions for Lyndsay → `onboarding-design/round4-mock-review.md`
- [x] R3 (done) Audit: Neon→Zetaris, FDA recalls, offer_checks/OpenAPI status, every Plaid + work-benefits mention, every background decision baked into the plan → `audit-round4.md`
- [x] R4 (done: all buildable here; only Nightshift + video need the Mac) What can be built in the cloud now (incl. Nightshift code behind a switch) → `cloud-build-assessment.md`

## Phase 2 (after Phase 1 + Lyndsay's answers)
- [x] W1 (done; QC: Strategy 2 section, OpenAPI must-do, FDA, Plaid/work removed, 28 proposals) Plan: apply her decisions, undo the baked-in recommendations (proposals only, in the open-decisions list)
- [ ] W2 Exec summary + flow chart refresh
- [ ] QC, commit, merge

## Lyndsay's answers (Oct 24, onboarding questions)
- Add purchases: a "+" button on every tab (opens receipts / barcode / photo).
- Expecting families: same Version B tabs, adjusted (Home leads with free gifts; deadlines say "starts at birth").
- Checklist / share / save: light versions ("I got this" tick with $ claimed, small share bar, Save card on Home).
- Still to ask: how real each intake path should be by Oct 27 (waiting on R1/R4 effort estimates).

## Lyndsay's correction (Oct 24): the three strategies must be restored as she set them
- Strategy 1 "Virtual Household Profile": keep as is (it's the Matcher); tell the story better: Zetaris filters so the AI gets a short, already-checked list (fewer tokens, lower cost, less room to make things up). No car/stroller-size details.
- Strategy 2 "Living Fine-Print Database": BUILD. Agents' own conclusions become a new source Zetaris can search next to the government ones. Fact-Checker + Parent Panel save a row per judged offer to `offer_checks` (offer, hidden strings like "$8 shipping", recall status, score, effort/sign-up needs, value); REGISTER DATASOURCE TABLE; cross-source questions like "offers rated truly free whose product hasn't been recalled since we checked"; Coach asks "which fine-print problems show up most in Report issue clicks?". Rows in Neon, never loose JSON files. THIS is the systematic feedback loop: past findings feed how agents grade new offers, and are answers for other offers. Value Score "worth $40 after strings attached". Future: sell this data.
- Strategy 3 "Points Guy" brand report cards: pitch, don't build a brand portal. But Strategy 2's data is exposed as a read-only endpoint with an OpenAPI spec (decided, not a should-do).
- Parent feedback is NOT the focus (no users at launch). Don't make it the main loop.

## Lyndsay round 4b (Oct 24)
- Prioritize photo → structured data (NVIDIA vision model). Do NOT drop email receipts or barcode: keep them in the plan for after the hackathon.
- The 3 gap-answers items (FSA "check with your job" card, Google-only sign-in, "state support coming soon") are fine = decided.
- Agentic looping among the agents was cut from the story; needed for scoring. Work it back in and handle latency. (She mentioned "the below feedback" on latency but none came through: asked her to paste it.)
- Then: updated exec summary for her feedback, QC'd by a subagent against all her high-priority feedback.
- [x] L1 (done) Plan + exec summary: agent loops + latency + photo priority
- [x] L2 (done) Flow chart: add the agent loops
- [x] Q1 (done; 7 fixes, 4 questions) QC subagent: every high-priority item from Lyndsay present → `qc-round4.md`

## Lyndsay round 4c (Oct 24) — answers
- Parent taps (confidence tuning) come LATER, not this draft. The feedback loop that must be VISIBLE in this draft is the "newsroom" loop: the agents' detailed grading of each offer (how valuable, how time-consuming, etc.) feeding back into how they grade.
- Job question: agreed, not essential; stays cut.
- Asks: isn't Meterless memory supposed to handle the shared message workspace and loops?
- QC questions: (1) Monday 3pm Boston code freeze = fine; (2) loops + 300 s run limit as must-do = yes; (3) skip offers whose wording hasn't changed = yes; (4) an offer is graded on its VALUE and TIME TO GET THAT VALUE; both decide whether it's worth someone's time.
- Says the plan otherwise has everything she wants; wants confirmation that building the new onboarding + Version B UI from her mocks is in the plan (it is: must-do item 7, client/src/pages/Onboarding.tsx + Version B tab screens).
- [x] M1 (done) Meterless as shared workspace + apply 4c to plan, summary, flow chart
- [ ] M2 QC
- [ ] Merge to main

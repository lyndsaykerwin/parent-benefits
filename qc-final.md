# Final QC before the build (Sat Oct 24, 2026)

Checked `bundle-plan-v3.md` (plan), `bundle-plan-executive-summary.md` (summary) and `flow-chart.md` (flow chart) at HEAD (`1787269`, the round-4c edit) against `297aa18` ("QC round 4") and `c4540fb` (the commit before the latest one), using `git diff`. Rules: `TRACKING-oct24-round4.md` "round 4c", `qc-round4.md`. Nothing committed.

PASS = right as is. FIXED = corrected now. FLAG = for Lyndsay; not changed.

## 1. Nothing dropped

| Item | Result |
|---|---|
| Plan and summary, `297aa18` → `c4540fb` | PASS: not changed in between |
| Flow chart, `297aa18` → `c4540fb` (the five-chart rewrite, 157 lines removed) | PASS: checked every removed idea against the current file (privacy rules for photos and email, "Not mine", "Forget my items", the three ways purchases come in, Open Food Facts/UPCitemdb, joins J1–J3, tests, Nemotron's jobs, vision model not going through Nightshift, the Coach's Zetaris question, "a code reject always wins", the legend and the mark meanings). All still there; the email details now say "(later)", which matches the decision to park email |
| Latest commit, removals in all three files | PASS: each one was meant to go under round 4c. "Parent taps tune `confidence_score`" became "later" (plan items 18 and 34 crossed out but kept so numbers don't shift). The per-offer `confidence` became the value + time grade. "Value and score" became the grade. "Every message is a trace line" now sits in the H-MEM audit log plus trace line (plan section 1b, item 37, flow chart chart 2). "A finding about one offer becomes an answer for the others" is still in plan section 1 |

## 2. Decisions

### qc-round4.md checklist (re-checked)
| Item | Result |
|---|---|
| Strategy 2 headline + must-do; no-users loop; `offer_checks` fields; `REGISTER DATASOURCE TABLE`; questions that join sources (the Coach question too); rows in Neon; Judge = "Parent Panel" | PASS |
| `GET /api/offer-audit` + OpenAPI must-do on Sunday; selling data / Points Guy = pitch slide | PASS |
| Strategy 1 pitch line word for word, same in plan and summary; no car or stroller details | PASS |
| Shared workspace, three loops, the fast screen, the database loop, built vs. planned labels | PASS |
| Photo check loop and recall verification loop shown as open proposals | **FIXED**: a few places still treated them as scheduled. Plan: rounds table (photo cap), photo hours line, Sunday timeline and its "done when", Monday trace. Flow chart: speed-limits box and the photo-test line. All now say "proposal, item 40/41" or "if approved" |
| Parent feedback not the focus; photo first with NVIDIA vision; email + barcode kept for after the hackathon; Plaid not in the summary or chart (plan only records that it was removed); job question cut; FSA card / Google sign-in / "coming soon"; FDA only finished (`Terminated`) recalls filtered; Zetaris is the only way agents read data; onboarding top row + Version B; middle class; Neon, no Redis, no "real-time" | PASS |
| qc-round4 flags 1–3 (freeze, loops + 300 s, unchanged-wording skip) | PASS: now written as decided (round 4c answers 1–3). Flag 4 (confidence score) no longer applies: the score was replaced |

### Round 4c
| Item | Result |
|---|---|
| Newsroom loop named and shown (grading of value, time to get it and effort feeds the next grading) | PASS: plan round-4c item 1, sections 1 and 1b; summary; flow chart chart 5 |
| Offer grade = value + time to get it → "worth your time"; the cut-off is an open proposal | PASS: plan item 42 |
| Same `offer_checks` rows feed BOTH the newsroom loop AND the data product (`v_offer_audit` + `GET /api/offer-audit` + OpenAPI, must-do, Sunday); selling data / Points Guy = pitch slide | PASS in all three files |
| Nightshift's job paragraph (AI switchboard on the Mac → Nemotron with her NVIDIA key; main AI provider; separate from H-MEM; stand-in in the cloud) | PASS in all three files; unconfirmed setup steps are marked |
| Meterless H-MEM as the shared workspace; plain code handles who goes next and the limits | PASS. Note: the H-MEM "grading lessons" piece of the newsroom loop is how the agents chose to carry out her question, not her own words. It is labelled "applied from her round-4c question" |
| Parent taps later | PASS |
| Monday 3pm freeze, loops + 300 s limit must-do, skip unchanged wording: decided | PASS |
| Job question cut; Plaid absent | PASS |
| Photo first; email + barcode kept for after the hackathon | PASS |
| FDA: only finished recalls filtered | PASS |
| Onboarding top row + Version B screens as a must-do in the plan (must-do 6, detail 7), summary and timeline | PASS |
| Strategy 1 line | PASS |
| No proposal shown as decided | FIXED (photo and recall loops, above) |
| No cut order decided | PASS: "Lyndsay decides" everywhere; plan items 19 and 39 are proposals |

## 3. The three files agree
| Item | Result |
|---|---|
| Numbers: 75–90 h, 14–17 h, 268 tests, 13–171 s, 20 s per call, 300 s, max 2 send-backs, 5 offers, 17 of 42 FDA | PASS: same wherever they appear |
| Names: newsroom loop, H-MEM, Nightshift, `offer_checks`, `v_offer_audit` | PASS |
| Built/planned labels | PASS once the photo/recall fix above was made |

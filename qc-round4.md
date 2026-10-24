# QC round 4: Lyndsay's high-priority points vs. the plan (Oct 24, 2026)

Checked `bundle-plan-executive-summary.md` (summary) and `bundle-plan-v3.md` (plan) against: `TRACKING-oct24-round4.md` (her feedback, onboarding answers, "Lyndsay's correction", round 4b), `lyndsay-feedback-agent-loops-latency.md` (binding), `TRACKING-oct24-round3.md`, `TRACKING-oct24-plan-update.md` (rounds 1–2), `onboarding-design/gap-answers.md` (decisions at top). Nothing new was decided. Nothing committed.

PASS = already right. FIXED = corrected in this round. FLAG = for Lyndsay; not changed.

## Strategy 2: Living Fine-Print Database
| Item | Result |
|---|---|
| Headline innovation + must-do | PASS (summary heading; plan round-4 item 1, must-do 4) |
| It is THE systematic, no-users feedback loop | FIXED in summary (was only in the plan, section 1): "This is the plan's systematic feedback loop, and it needs no users" |
| `offer_checks` fields: hidden strings, effort/sign-up, recall status + date, value/score | PASS |
| `REGISTER DATASOURCE TABLE` | PASS |
| Cross-source questions ("truly free, not recalled since we checked"; Coach's "Report issue" question) | FIXED in summary: Coach question added (was in the plan only) |
| Rows in Neon, never loose JSON | PASS |
| Value Score "worth $40 after strings attached" | PASS |
| "Parent Panel" naming | FIXED in summary: notes the Judge fills that role (plan section 1); whether to build a separate panel stays open proposal 26 |

## Data product
| Item | Result |
|---|---|
| `GET /api/offer-audit` + OpenAPI = must-do, on timeline | PASS (summary + plan must-do 4, Sunday) |
| Selling data / Points Guy report cards = pitch slide; no brand portal; MCP later | PASS |

## Strategy 1
| Item | Result |
|---|---|
| Pitch line verbatim, matches plan section 2 | PASS |
| No car/stroller details | PASS (none in either file) |

## Agent loops (binding feedback file)
| Item | Result |
|---|---|
| Shared workspace / bus (PLANNED; `AgentContext` today) | PASS |
| Clawback ↔ Recall safety-value loop | PASS |
| Benefits Planner ↔ Fine Print Lawyer eligibility loop | PASS (flag on job data kept as open item 35) |
| Judge ↔ Fact-Checker targeted correction, max 2 (BUILT basic, wording planned) | PASS |
| Optimistic UI: instant cache, 1–2 s fast path, background deep loops with push updates (SSE / WebSockets), status pills | PASS |
| DB loop: write-back with `status`, `confidence`, `rule_citations`; Zetaris first; skip graded offers | PASS |
| Parent-tap `confidence_score` tuning written as hers, conflict with "no users" noted | PASS (plan 1b item 3 + section 10 item 34; summary) |
| Built vs planned marked honestly | PASS, with one FIXED: see next row |
| Photo check loop + recall verification loop | FIXED. Added by an agent in round 4b, not in her feedback, but were listed under "Loops kept from before", in must-do item 9, and in the summary under "decided by Lyndsay". Now marked open proposals: plan 1b items 7–8, must-do 8–9, section 6 photo bullet (also fixed wrong "loop 4" reference to "loop 7"), new section 10 items 40–41; summary moved them under "Open proposals (agent-added)" and "photo retry 1: proposed" |

## Other decisions
| Item | Result |
|---|---|
| Parent feedback NOT the main focus | PASS |
| Photo → structured data via NVIDIA vision = priority | PASS |
| Email receipts + barcode kept for after the hackathon, design intact | PASS |
| Plaid absent | PASS in summary (a draft line re-introducing it was caught and removed). Plan mentions Plaid only to record its removal and the open questions it left (section 10 items 8–10, 28): correct |
| Work-benefits question absent | PASS (only mentioned as cut) |
| Dependent Care FSA "Check with your job" card; Google-only sign-in; "Support for your state's programs is coming soon" | PASS |
| FDA recalls stay; only finished/Terminated filtered, with reason | PASS |
| Zetaris only way agents read data; two direct reads flagged as proposal | PASS |
| Onboarding: top row then Version B tabs (Home, Taxes, Savings, Insurance, Deals); never middle row; due date in date screen; "+" on every tab; expecting families same tabs adjusted; light checklist/share/save | PASS |
| Nightshift: built + tested in cloud, flipped on at Mac; Nemotron behind it | PASS |
| No proposal presented as decided | FIXED (photo/recall loops, above). Everything else checked is attributed or in section 10 |
| No cut order stated as decided | PASS (summary + plan: "Lyndsay decides"; item 39 is a proposal) |
| Middle-class target | FIXED in summary: added to "What Bundle is" (was only in the must-do list) |
| Neon not Supabase; no Redis; no "real-time" claims | FIXED in summary: added a "Standing rules" line (plan already had it). No "real-time" claims in either file |
| ELI12 with technical names kept; succinct | FIXED: summary cut from 2,374 to about 2,040 words while adding the items above; every backticked technical name from the previous version is still present (checked by script). Still about 3 pages, not 2: going lower would mean dropping detail from the checklist |

## FLAGs for Lyndsay (not changed)
1. **Monday 3pm Boston code freeze** is written as fact in both files. It first appears in the round-2 plan timeline, not in any recorded decision of hers. Confirm or change.
2. **"Agent loops and fast screen" as a must-do** and the **300-second run limit** marked "must-do": your round-4b note says the loops are needed for scoring and to work them back in; making them must-do (and the exact 300 s number) is the plan's reading of that. Confirm.
3. **Skipping offers whose fingerprint is unchanged** (database loop) goes slightly beyond your feedback (which said skip offers rejected by a universal rule). It builds on the round-2 `fine_print_hash` field. Confirm.
4. Round 2 said "no confidence-score bands" (about product matching); your round-4b loop uses a `confidence_score` on offers. Different things, but worth a glance.

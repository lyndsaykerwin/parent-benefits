# Bundle: the plan in plain English (v3, Sat Oct 24, 2026)

A short, simple version of the full plan, `bundle-plan-v3.md` (rounds 1–3). Where this summary and the plan disagree, the plan wins. Submission is due Tue Oct 27 at 23:45 UTC (7:45pm Boston); our target is 5pm Boston.

## What it is

Bundle is a phone website for new parents. It shows one calm page: money they can get back, government and work benefits with deadlines, safety recalls on things they bought, and deals that are actually worth it. Behind that page, a team of AI helpers (`agents`) looks everything up, argues over tricky offers, and double-checks every number before a parent sees it. Parents tell Bundle what they bought by forwarding store receipts, and where they shop by connecting a card. When parents tap "this was wrong" or "I got this," Bundle learns.

## Who it helps and why it matters

It's for middle-class working parents who are expecting, or whose baby arrived in the last 100 days, in **any US state**. (The earlier low-income angle, including WIC, a food program for lower-income families, has been dropped.) New parents are tired and busy. Money and deadlines slip past them: claims for a work health-spending account (`FSA`), the 30-day window to add a baby to insurance, state paid leave. "Free" offers often hide a fee or a paid membership. Recalled baby gear is hard to spot. Bundle finds these for them and shows its proof.

## How it works, step by step

1. **Quick questions, one per screen** (`onboarding`, spec in `onboarding-spec.md`): "Expecting or baby's here?" (or "Try a sample family"), then the date, then the ZIP code ("Found it: showing [State] programs"), then an optional "Does your job offer benefits?" Last comes a "Checking" screen that shows the helpers working. No bank details are asked for up front.
2. **Add purchases, if you want** (on the results page): **"Forward your receipts"** to a Bundle email address (an inbox on `Agentmail`, an email service whose inboxes a program can read), or tap **"Use sample receipts"** to send made-up receipts through the same reader. **"Connect a card"** uses `Plaid` (the service apps use to read bank purchases) in practice mode with fake banks (`sandbox`). Receipts say *what* you bought. A card says *where* you shop.
3. **A manager program** (`Orchestrator`) starts four helpers at once:
   - **Clawback Hunter** finds money back: FSA-eligible buys, price drops inside a store's refund window, and daycare bills for the work daycare account (`Dependent Care FSA`, up to $7,500).
   - **Recall Checker** checks what you bought against government safety recalls.
   - **Benefits Planner** lists programs and deadlines, like the $2,200 Child Tax Credit and paid leave in MA, NY or CA.
   - **Fine Print Court** works like a courtroom. A **Deal Hunter** argues for an offer, a **Fine Print Lawyer** argues against it, and a **Judge** decides. The Judge looks at up to 5 offers each run and cites rules it learned earlier (`case law`).
4. **A Fact-Checker** re-reads the original source for every card with a separate question. If a card is wrong, it goes back to the helper that made it, up to 2 times, and is then dropped. A card with no source never appears.
5. **The parent sees** the Receipt (money back, likely benefits, deadlines, items safety-checked) and a feed that is never empty. Each card has a "We checked this" line, and a "We caught these for you" list shows what was blocked. Offers show a **Value Score**: true dollar value (face value minus hidden costs), an effort badge (low/medium/high), and the catches.
6. **Learning:** taps on "I got this," "Report issue," "Not mine" and "Returned it" go to memory. A **Coach** helper suggests a new rule when 2 or more reports agree, and a person approves it. The next run follows the new rule.
7. **Owner view ("Behind the scenes"):** a screen locked by a reviewer code (`x-reviewer-token`) shows the debates, data sources, learned rules, scoreboard and the full step-by-step log (`trace`). The server removes all of that from what parents receive.
8. A **Scout** script reads 3 saved official pages ahead of time and turns them into rule rows. It throws out any row with no source, or with an amount that isn't on the page.

## The sponsor tech and the job each does

- **Zetaris** (required, the "data door"): one database question (`SQL`) can read several separate places at once. Honest count: there is **one real cross-source join**, meaning one question that mixes two places. It combines the family's purchase items (sample orders plus `receipt_items`, read through the safe-columns view `v_purchase_items`) with the live **CPSC** (consumer product) and **openFDA** (infant formula) recall feeds. Finished FDA recalls are dropped. Everything else is our own tables, read through **privacy views**: each helper gets its own filtered window. `v_judge_offers` has no family data, `v_clawback_tx` and `v_recall_orders` have no income, and agents never see raw receipts. A second join (brand audit plus open CPSC recalls per brand) is should-do. We claim "two joins" only if it gets built. Without Zetaris, Bundle can't make a single personal card.
- **Neon** (our online database): families, `transactions` (Plaid rows), `amazon_orders` (sample families), FSA list, store policies, price checks, `benefit_rules`, `offers`, `feedback`, Coach proposals, and the ZIP-to-state table (being expanded to every US ZIP). Planned new tables: `receipt_items`, `offer_checks` (the agents' scorecard for each offer's fine print, with no family column), `tax_parameters` (IRS 2026 figures) and `state_programs` (paid leave rows).
- **Meterless:** its **H-MEM** memory engine stores approved rules with a confidence score, and the Judge must cite them. Recommended: parent taps raise or lower a rule's confidence, visible in the owner view (memory points at a row id and never copies receipt text). **Nightshift** (decided) turns Lyndsay's Mac into a private AI server and is the **main AI provider**.
- **NVIDIA Nemotron** answers through Nightshift. Decided order of who answers: **Nightshift → Nemotron direct from NVIDIA → saved offline text**. Recommended models: Nemotron 3 Super for the Judge, with its extra "thinking" step turned off; Ultra only if Super's rulings look weak; Nemotron 3.5 Lightning for quick steps. Each call has a hard time limit and one retry, and each run has a 300-second limit.

## How we know it works (tests and guardrails)

- **The scoreboard** (`npm run eval`, `logs/scoreboard.json`) checks answers against an answer key. Last saved result: 6 of 6 traps caught, 0 false alarms, 100% sourced, and learning works (run 2 blocks the trap and cites rule `mem-1`). That result used no real AI (`offline-fallback`), so it gets rerun with real AI. The app also passes 268 automatic tests.
- **New tests:** 12 **fine-print tests** (hidden shipping, expired, mail-in rebate, auto-renew, minimum purchase, a "prompt injection" where the fine print tries to give the AI orders, and more) plus 3 offers that must still pass. A third verdict, "approve, with a catch," joins approve and reject. Also a 5-family any-state test, a test that fails if "MA" appears in the code, a "no false recall" test, and 14 new matching cases.
- **Guardrails** (safety rules): a code "reject" always beats an AI "approve." Numbers come from code, never the AI. Every AI answer must fit a fixed format. Requests are rate-limited (capped per visitor per few minutes). Text that could contain hidden code is stripped. Secrets stay out of the repo.
- **Recall matcher** (recommended must-do): code compares brand, product type and sale dates, and every alert shows its evidence. On fresh test data it caught 7 of 8 real recalls with 1 wrong alarm. Today's matcher finds 0 of 12. Recommended: card rows from Plaid stay out of recall matching, because a bank line never names the product.
- **Brand audit:** a Zetaris view (`v_offer_audit`) with per-brand totals only. Should-do: a read-only web address (`GET /api/offer-audit`, with an `OpenAPI` description that tells programs how to use it).

## What's built vs. still to build, and the timeline

**Built:** the whole app runs end to end on made-up families: agents, Court, Fact-Checker, never-empty feed, learning loop, traces, and the Zetaris recall join. **Sample mode** (`SAMPLE_MODE=true`) replays saved Zetaris answers and saved AI text, so no keys are needed. **To build:** owner view, Nightshift/Nemotron switch, any-state rules, recall safety and matcher, sample receipts (5.5–6.5 hours), Plaid, fine-print tests with `offer_checks` and the Value Score, memory taps, new onboarding, and fresh evidence.

**Live vs. replayed:** a `LIVE_MODEL` switch uses real AI while Zetaris answers are replayed. Live AI runs and the video happen **only on the Mac**. Any download or hosted copy replays saved traces, and the README says so.

**Timeline:** Sat: Nightshift setup and code switch, owner view, any-state rules, recall safety, scorecard table. Sun: matcher, sample receipts, Plaid, fine-print tests, onboarding, evening real-AI test. **Mon 9am go/no-go** on Nightshift (if it fails, use NVIDIA direct, labeled), real-AI rerun, memory taps, **3pm code freeze**, video on the Mac. Tue: final check and submit.

## Honest limits

- **The must-do list is bigger than the time left:** about 14–19 hours plus three half-days, and four items have no estimate. We will cut in a set order. The live receipt inbox goes first, and "Use sample receipts" stays.
- All data is made up. Plaid runs in practice mode only, and the live inbox accepts only our own test address. Only item rows are kept from receipts. Names, addresses and raw email text are deleted.
- "Connect Gmail" is on the roadmap only, because Google requires a paid outside security review every 12 months.
- Live Zetaris runs are slow (13–171 seconds). Privacy views are a convention (not locked by permissions). Nightshift's Sunday update and some settings are unconfirmed. We never say "real-time."

## Open decisions (full list: plan section 9)

Decide now: Plaid rows out of recall matching; matcher made a must-do; the new honest line for judges; "one cross-source join"; parent taps to memory; keep "seller" on receipt rows; live inbox cut first; accept the time check and cut order; Neon results table as top should-do; the due-date screen; how the daycare account card shows. Can wait: which Nemotron, hosted site or not, a year-one value table, the "cash" wording, list vs. tabs, location pre-fill.

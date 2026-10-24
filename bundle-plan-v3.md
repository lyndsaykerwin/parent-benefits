# Bundle plan v3 (Fri Oct 23, 2026, evening; updated Sat Oct 24, round 2)

Replaces the v2 summary's open items. Submission: Tue Oct 27, 23:45 UTC (7:45pm Boston; our target is 5pm Boston). Earlier versions are saved in `plan-history/`: the Oct 23 version (`bundle-plan-v3-2026-10-24-before-update.md`) and this morning's round-1 version (`bundle-plan-v3-2026-10-24-round1.md`).

## Oct 24 update (what changed today)

Round 1 (morning) and round 2 (afternoon, Lyndsay's final decisions) are merged here. Where they conflict, round 2 wins.

1. **Meterless Nightshift is the main ("primary") AI provider, and NVIDIA's Nemotron answers through it.** Nightshift is Meterless's app that turns your Mac into a private AI server for your apps. Meterless announced today that its full connection (the "Runtime API") now works on M1–M4 Macs and that NVIDIA models are visible in it; a Sunday Oct 25 update adds picking an exact model and longer waits for NVIDIA's slower "reasoning" models. Lyndsay is installing it now. Target setup: **the app → Nightshift → Nemotron**. This replaces the morning's "3 possible outcomes" plan.
2. **Plaid "Connect a card" is back in** (round 2; undoes the morning cut). Plaid is the service apps use to read bank and card purchases; we use its sandbox, meaning practice mode with fake banks. Real purchase data is what makes Bundle valuable. To make room: NVIDIA embeddings, the confidence-score bands and the Nightshift backup branches move out (section 4, ranking).
3. **Middle-class parents, not low-income.** The poverty-guideline / WIC / SNAP / Medicaid angle is dropped. (WIC is a food program for lower-income families; no sample family qualified anyway, so no demo number changes.) The Benefits Planner now uses the Child Tax Credit, the Dependent Care FSA (a work account that pays for daycare before tax), state paid family leave (MA, NY, CA), work benefits, plus the CPSC/FDA recall feeds.
4. **No Massachusetts hardcoding.** Federal programs for everyone; state programs are rows in a table; any US ZIP code works. The weak `non_ma_family` test is replaced by a 5-family `state_agnostic` test, and the saved Ohio example that approves the auto-renew trap gets fixed.
5. **Fine-print checks get much deeper.** 12 new fine-print tests plus 3 "should still pass" controls, and a third verdict, "approve, with a catch." Each check is saved as structured fields in `offer_checks` (the agents' scorecard table), which feeds the parent's **Value Score** and the brand audit.
6. **Recall matching:** finished ("Terminated") FDA recalls are filtered out and a test proves known wrong recalls don't show. **The 0.85 / 0.50 confidence bands are dropped.** The new matching approach is **pending** a separate test (`entity-resolution-test.md`).
7. **Brand audit ("Strategy 3"):** a Zetaris view with per-brand totals only, plus one read-only web address with an OpenAPI description. An MCP server is "later" (a pitch slide).
8. Unchanged from the morning: new one-question-per-screen onboarding (decisions in section 8); owner view split; Neon (not Supabase) is the database; no Redis; never say "real-time"; Meterless = memory engines, not fine-print reading. Store price feeds (Amazon, Walmart, Target) stay cut.

---

## 1. In one minute

**What Bundle does:** a new parent opens it and sees one calm page: money they can get back, benefits with deadlines, recalls, and deals. Behind the scenes, a team of AI helpers (agents) checks every claim and throws out tricky "free" offers that hide a fee, a membership or a lot of hassle.

Every helper looks things up through Zetaris — one door that combines the family's private data (including purchases from a connected card), our rule lists, official tax and leave figures, and live government recall feeds in a single question, without copying any of it.

**Done:** the whole app works and passes its tests. It runs on made-up families, with saved answers standing in for the AI, so it needs no keys.

**What changes:**
1. Two screens. Parents get the simple page plus one short "We checked this" line per card and a "We caught these for you" list. A separate "Behind the scenes" screen, opened with a reviewer code, shows the agents debating, the data sources, the learned rules and the scoreboard.
2. Real AI switches on through **Nightshift on your Mac, with Nemotron behind it**. We rerun the scoreboard and the learning demo with it and say plainly what was real.
3. "Connect a card" works with Plaid's practice banks.
4. Works for middle-class families in any state, with no Massachusetts-only code.
5. Deeper fine-print checks, a Value Score on each offer, and the brand audit data.
6. A quick, one-question-per-screen onboarding replaces the single form.

**Left for you:** finish installing Nightshift today and add your NVIDIA key inside it; answer section 8.

**Timeline:** Sat screens split, any-state rules, recall filter, scorecard table; Sun Plaid, fine-print tests, Value Score, onboarding, Nightshift switch; Mon morning real-AI rerun, matching upgrade, evidence; Tue final check.

---

## 2. What the parent sees vs. what the owner sees

| | Parent view (simple, calm) | Owner view ("Behind the scenes") |
|---|---|---|
| Headline | The Receipt: money back, benefits you likely qualify for, deadlines, items safety-checked | Same Receipt, plus the scoreboard (traps caught, before vs. after learning, match accuracy, fine-print accuracy) |
| Cards | Title, amount, source links, a short "We checked this" line; offers show a Value Score (true dollar value, effort badge, catches) | Same cards, plus the Zetaris data sources used for each |
| Purchases | "Connect a card" (Plaid practice bank) adds purchases; results update on the next run | Which purchase rows came from Plaid vs. sample orders |
| Recalls | "Recall alert" for confirmed matches, with a "Not mine" button. How borderline matches are shown is pending (section 4, item 6) | Every pair considered, including "considered and rejected" with the reason |
| Rejected items | "We caught these for you": plain-language list of offers and claims we stopped, including expired offers | Fine Print Court debate (Deal Hunter vs. Fine Print Lawyer, then the Judge) and Fact-Checker send-backs, in full |
| Learning | Parents tap "I got this" / "Report issue" | Meterless memory and case law, with the Approve button; proposed vs. approved rules |
| Proof | Nothing technical | Full trace of every agent step, including which AI model actually answered |
| Access | Anyone (guest) | Reviewer code only (the existing reviewer token), shown to judges in the demo |

## 3. Where Zetaris does the work

Zetaris must join several real sources in one question. After round 2 it does four joins:

| Helper | The question it asks Zetaris | What gets combined | Where you see it |
|---|---|---|---|
| Recall Checker | Which of this family's purchases are on a recall list? | Purchases (sample orders + Plaid practice-bank card purchases, both in Neon) + live CPSC and openFDA recall feeds (finished FDA recalls dropped) | Recall card; "We checked 7 items" |
| Clawback Hunter | Which purchases are FSA-eligible or inside a store's price-drop window? | Card purchases (now including Plaid) + FSA-eligible list + store policies | "Money back" cards and the Receipt total |
| Benefits Planner | Which programs does this family likely qualify for, by when? | Family profile + benefit rules (federal and state rows) + `tax_parameters` (IRS 2026 limits: Child Tax Credit $2,200 per child, Dependent Care FSA $7,500) + `state_programs` (MA, NY, CA paid family leave) + full ZIP-to-state table + the parent's work-benefits answer | Benefit/deadline cards |
| Fact-Checker | Is this exact dollar amount, date **and state** right? (asks a separate question) | Re-reads the source row, including its state | Blocks or sends back wrong cards, including a wrong-state card |
| Agents' scorecard | What did the agents find in each offer's fine print? | Offers + `offer_checks` (agent-made, registered in Zetaris as its own source) + parent feedback counts. No family data | Value Score on offers; brand audit view |
| Privacy views | — | Each helper gets its own filtered view (the deal Judge never sees family data) | Owner view: "Data sources" per card |

Honest note on "real sources": CPSC and openFDA are live outside feeds; Plaid data arrives from Plaid's practice API and is copied into Neon (Zetaris can't do Plaid's sign-in step); IRS and state leave figures are official numbers stored as rows with their source link and year, checked Oct 24 (`audit-ma-poverty-evals.md` section 2b). The MA leave figure should be confirmed on mass.gov by a person before it goes on a slide.

Remove Zetaris and the app can't produce a single personal card. Honest line for judges: "Zetaris finds the candidate pairs across private and public data in one question; the AI decides the hard cases." (Zetaris has no built-in fuzzy matching.)

## 4. Technical plan (for the CTO)

Starting point: repo `bundle/`, 268 tests passing (8 skipped), `SAMPLE_MODE=true` is always offline by design, Zetaris Neon x CPSC join working, reviewer token already gates Approve. No Redis: agents write results to Neon and screens read from Neon.

**Ranking for the 3 days left.**
- **Must-do:** 1 owner view split; 2 Nightshift → Nemotron and real-AI rerun; 3 Plaid "Connect a card"; 4 any-state, middle-class rules; 5 fine-print tests, `offer_checks` fields, Value Score and the brand audit view; 6 recall safety half (FDA filter, `no_false_recall` test); 7 onboarding core screens; 8 regenerate evidence.
- **Should-do, only once must-dos are green:** brand audit read-only web address with OpenAPI description (first in line); product-matching upgrade from the test results (item 6, pending); onboarding extras.
- **Moved out to make room for Plaid:** NVIDIA embeddings for the memory (Nemotron through Nightshift is now NVIDIA's real job); the confidence-score bands (dropped by decision); the Nightshift backup branches (one simple fallback instead); the onboarding "Checking" screen shows the steps from the run but gets no extra polish.
- **Cut:** MCP server (pitch slide only), brand screens, tabbed layout, save/reminders screen, location pre-fill, store price feeds, NeMo Guardrails, paid hosting, Redis.

**1. Owner view split** (must-do)
- Goal: parent view shows only Receipt, cards, a one-line "We checked this" per card, and "We caught these for you". Everything agent-internal moves behind an owner entry point.
- Key areas: `client/` (card detail, "Bundle got smarter" screen, new owner route), run/trace API in `server/` (a parent-safe response shape vs. the full one), reviewer-token check (`x-reviewer-token`). "We checked this" and "We caught these" are built from fields the Fact-Checker and Court already record.
- Done when: with no token, the API and UI never expose debate text, data-source names, memory rules, traces or Approve; with the token, all of those appear and Approve still works; a test asserts the parent payload has none of those fields; the learning loop (report twice, approve, run again, offer blocked) still passes end to end.
- Risk: leaks through the API (hiding in the UI is not enough); the parent payload must be trimmed on the server. Medium effort; mostly moving existing screens.

**2. Nightshift → Nemotron, live run and honest labeling** (must-do)
- Goal: real model text for the court debate, explanations and Coach rules comes through Nightshift, which passes the hard steps to NVIDIA's Nemotron. Scoreboard and learning demo rerun with it. Both sponsor rules are met in one request: Nightshift is primary, NVIDIA contributes.
- Step 0 (Lyndsay, today): finish installing Nightshift on the M4 Mac, add your NVIDIA key inside Nightshift (cloud models use your own key), and check which models it lists (the CTO can run the check: `GET /v1/models`).
- Code switch (about 2–4 hours with tests): point the single AI adapter `server/adapters/llm.ts` at `http://127.0.0.1:8088/v1`, read Nightshift's token from its `proxy-token` file, add the two Meterless labels (`meterless-app: bundle`, `meterless-scope: user`), use routing names (`meterless/deep`, `meterless/fast`) today, wait up to 180 seconds, and record which model actually answered. Update `scripts/check-model.ts`, `scripts/eval.ts` (scoreboard label `nightshift:<mode → model>`), the tests, `.env.example`, README and `metadata.json`. Full file list: `research-nightshift.md` section 3.
- After the Sunday Oct 25 Nightshift update (Sunday evening, Pacific time): pick Nemotron exactly instead of automatic swapping, and set the longer wait for it. Our AI Judge failures look like timeouts, which this update targets.
- One fallback, not three: if Nemotron isn't reachable through Nightshift by Monday 9am Boston, Nightshift's own models answer everything and the README says so plainly.
- Done when: `llmMode` in the scoreboard reads `nightshift:...` with the model named; the new run-1 and run-2 learning traces are saved; every README/slide line that says "offline", "supported, not exercised", "no real model" or "NVIDIA-hosted" matches what was actually run. Two modes are labeled separately: saved offline replay (no keys, judges' default) and the real-model run (replayed Zetaris answers, live Nightshift).
- Risk: the Sunday update could slip or change names; the hosted site can't reach your Mac (`127.0.0.1` means "this same computer"), so live AI runs happen on your Mac; the score may drop below 6 of 6 and we report what it is; macOS will warn the app is unsigned (open via right-click, Open).

**3. Plaid "Connect a card"** (must-do; about half a day)
- Goal: the "Connect a card" tile (on the results page, not the first onboarding screen) opens Plaid Link (Plaid's pop-up), the parent picks Plaid's test bank, and the fake purchases flow into Bundle and through Zetaris.
- Key areas: server routes for Plaid's two steps (create a link token; swap the public token for an access token), re-added; the existing `mapPlaidTxn` and fixtures; the Neon `transactions` table; the connect tile in `client/`.
- Where data lands: Plaid sandbox → our server → `mapPlaidTxn` → rows in Neon under a demo family id → Zetaris reads Neon as before.
- Baby-relevant data: Plaid's standard test bank has generic purchases (coffee, airlines). Check whether a Plaid custom sandbox user (a test bank login where we write the purchases ourselves) can carry made-up baby purchases; if not, say plainly in the demo that the test bank is generic and sample orders supply the baby items.
- Done when: Connect on a guest/demo family completes Plaid Link with sandbox logins, rows appear in Neon, a local live run produces cards that use them, Plaid secrets live only in the git-ignored env file and `.env.example` holds placeholders. Only demo families can connect.
- Risk: `SAMPLE_MODE` is always offline, so this needs the local live mode; saved Zetaris answers won't cover new purchases, so live Zetaris runs apply (they have been slow: 13 to 171 seconds). The saved-replay path stays the judges' default.

**4. Any state, middle-class rules** (must-do; about half a day). Details: `audit-ma-poverty-evals.md` sections 1c, 1d, 2.
- Remove poverty/WIC: delete the WIC rule, the poverty table and its query, the WIC tests and the "Federal poverty guidelines" label; stop reading exact income (the Child Tax Credit only shrinks above $200,000, or $400,000 joint, so at most ask that as a yes/no later).
- New data tables: `tax_parameters` (one row per IRS 2026 figure, with year and link: Child Tax Credit, Dependent Care FSA $7,500, health FSA $3,400; the $7,500 limit moves out of `factChecker.ts`) and `state_programs` (MA, NY, CA paid family leave rows, plus the existing MA child credit). Register both in Zetaris.
- Code never names a state: the rule `scope` accepts "federal" or any 2-letter state; the Planner skips any rule whose scope isn't federal or the family's state; card wording comes from a `plain_summary` column in the row, not from code; Scout can save any state's rule; the Fact-Checker re-checks state.
- ZIP codes: load every 3-digit ZIP prefix; an unknown state still runs, with federal programs and a calm "We don't have [State] programs yet" note. Never an error.
- Work benefits: the onboarding answer replaces today's always-"yes" FSA setting and fixed household size.
- New `state_agnostic` test (replaces `non_ma_family`): 5 fake families — Maya (MA), Ava (OH, federal only plus the note), Noor (NY, gets NY leave), Cal (CA, gets CA leave, 8 weeks), Fern (FL, no state rows, no ZIP error). Every card's rule must be federal or the family's state (looked up by rule, not by card name); federal cards must exactly match the date rules; never empty; a "swap test" (change a row, card changes with no code edit); a guard test that fails if "MA" or "Massachusetts" appears in agent or route code; and the Fact-Checker must block a planted wrong-state card.
- Done when: the 5-family test passes offline and with the real AI, and no WIC/poverty mention remains in app code or the README. Also replace the WIC statistic on deck slide 2 with a checked middle-class one.

**5. Fine-print tests, `offer_checks` dataset, Value Score and brand audit** (tests, fields, Value Score and view must-do; web address should-do). Details: `audit-ma-poverty-evals.md` section 3.
- New verdict: `approve`, **`approve_with_catch`** (worth it, but the parent sees the catch and the Receipt counts only the true value), `reject`. A code "reject" always overrides an AI "approve."
- 12 new tests (all fake offers): FP-01 shipping fee on "free"; FP-02 shipping costs more than the item; FP-03 already expired; FP-04 about to expire; FP-05 mail-in rebate (high effort); FP-06 phone call, forms and waiting period; FP-07 auto-renewing subscription; FP-08 minimum purchase; FP-09 limited stock or excluded states; FP-10 required account, app or marketing texts; FP-11 true value after several strings; FP-12 prompt injection (fine print that tries to give the AI orders). Plus 3 controls that must still be approved: "free shipping over $50", "subscription is optional and can be skipped", and a plain "one per household" welcome box.
- Ohio fix: FP-07 makes the code reject the auto-renew trap for **every** family on the first run, so the saved Ohio (Ava) example no longer shows it approved. Regenerate `output_examples/ava.json`. The learning demo moves to a subtler trap (for example "autoship must remain active for 2 deliveries").
- `offer_checks` key fields (still **no family column**): identity (`offer_id`, `store`, `source_url`, `fine_print_hash` — a fingerprint of the exact wording so changes are noticed, `checked_at`, `agent`, `model`); money (`face_value_cents`, `hidden_cost_cents`, `true_value_cents`, `min_purchase_cents`, `auto_renew`, `renewal_price_cents`); dates (`deadline_date`, `expired`, `claim_window_days`, `payout_wait_days_max`); effort (`steps_count`, `effort_level`, `effort_minutes_estimate`, plus yes/no flags such as `mail_in`, `needs_receipt`, `needs_phone_call`, `account_required`); availability (`limited_stock`, `regions_excluded`); judgment (`catch_types`, `verdict`, `catch_summary`, `evidence_quote`, `injection_detected`). Code fills dollar amounts, dates and flags; the AI fills only the soft fields (summary, effort level), and code checks them. Every dollar figure must appear in the exact quoted fine print or be computed by code from it.
- Value Score (shown to parents): the true dollar value (face value minus hidden costs), an effort badge (low / medium / high) and the list of catches, with "How we scored this" in plain words. Effort is not turned into dollars (that would need a made-up hourly rate).
- Why this dataset matters: it grows with every run and holds no family data; the wording fingerprint builds a history of each brand's terms; parent reports show where agents were wrong and become new tests and learned rules; it makes offers comparable ("free offers worth over $20, low effort, no auto-renew"); and it **is** the brand audit product.
- Brand audit: Zetaris view `v_offer_audit` with **per-brand totals only** (catch rate, average true vs. advertised value, average effort). Should-do: one read-only web address (`GET /api/offer-audit?store=...`, fixed query, rate-limited, saved answers in sample mode) with an OpenAPI description (the standard file that tells any program or agent how to call it), plus a test that the answer never contains family fields. MCP server (the standard plug-in for AI agents): pitch slide, "later."
- Scoreboard additions: fine-print catches found / total, false alarms on controls, field accuracy against the answer key.
- Done when: all 12 tests and 3 controls pass offline (and are reported with the real AI), a run fills `offer_checks`, Zetaris can query it, and offers show a Value Score.

**6. Recall safety and product matching**
- Must-do now (about 2 hours): drop FDA recalls marked "Terminated" (finished); add the `no_false_recall` test (the maya run must not show CPSC 10490 or 10453, today's known near-misses). Run it offline and with the real AI; report both.

**Product matching (results pending: entity-resolution-test.md)**
- Status: **PENDING.** A separate test on Plaid-style bank data and order data against the live recall feeds is still running. Its results will be added here; don't build beyond the must-do above until then.
- Kept idea: layered matching, strongest evidence first — bar code, then model number found in the recall text, then full product name, then brand plus key words with purchase-date and seller checks, then the AI answers yes / no / unsure with a reason on the borderline pairs. No numeric confidence bands; the aim is fewer wrong alerts and fewer missed recalls, measured on a hand-labelled set ("of alerts raised, X% were right"; "of real recalls, we caught Y%").
- Known limit: bank and card data (Plaid) usually shows only the store, date and amount, **not the product name**. So card purchases alone may not support product-level recall matches; order data or receipts may be needed. The test will say how much each source can match.
- Formula recalls keep the "check the lot number on the can" line. Key areas: `server/agents/recall.ts`, the `v_recall_orders` view in `scripts/zetaris/register.ts`, `evals/expected.json`, `scripts/eval.ts`.

**7. New onboarding** (core screens must-do, about half a day; extras should-do)
- Must-do: screen 1 "We're expecting / Baby's here" plus "Try a sample family"; screen 2 exact date (birthday or due date, matched to the choice, with the baby's-age line); screen 3 ZIP with "Found it: showing [State] programs" (any state; see item 4); screen 4 optional work benefits Yes / No / Not sure / Skip; screen 5 "Checking" with the run's agent steps; then the list. All numbers come from the real run, never typed into the page. "Connect a card" sits on the results page.
- Key areas: `client/src/pages/Onboarding.tsx`, the run request in `server/routes/bundleRoutes.ts`. Full spec: `onboarding-spec.md`.
- Done when: both paths reach a result with made-up dates and ZIPs (including a non-MA ZIP), wrong-direction dates get a clear message, and the sample family still works in one tap.

**8. Regenerate evidence** (must-do)
- Goal: scoreboard, saved example runs and learning traces reflect the real model, the any-state rules, the new fine-print tests and the new views.
- Key areas: `npm run eval`, `eval:live-model`, `examples:regen`, `output_examples/`, `logs/sample/`, `logs/scoreboard.json`, README section 8. Pitch-slide content: brand audit + MCP "later"; maya's money back is $48.99 (an older deck draft says $46.99); no WIC stat.
- Done when: committed files match the README numbers; the full test suite is green; a clean copy with no keys still runs the sample.
- Risk: README claims drifting from the saved files; check by comparing after regeneration.

## 5. Timeline

| Day | What happens | Done when |
|---|---|---|
| Sat Oct 24 | **Lyndsay:** finish the Nightshift install, add the NVIDIA key inside it, answer section 8. Item 1 owner view split. Item 4 any-state, middle-class rules and the 5-family test. Item 6 must-do (FDA filter, `no_false_recall`). Item 5: `offer_checks` table with the key fields, registered in Zetaris | Parent view clean, owner view behind the token, `state_agnostic` and recall tests passing, tests green |
| Sun Oct 25 | Item 3 Plaid (morning). Item 5: 12 fine-print tests, controls, new verdict, Value Score, `v_offer_audit`. Item 7 core onboarding. Item 2 code switch with routing names; **Sunday evening** after the Nightshift update: pin Nemotron and the longer wait | Plaid rows in Neon and in cards; fine-print tests green; onboarding works on both paths; a first Nightshift run saved |
| Mon Oct 26 | Morning: real-AI rerun and learning traces (item 2), item 8 evidence and README. Should-dos only if green: audit web address, product matching from `entity-resolution-test.md`. **Code freeze 3pm Boston**, then a clean-setup rehearsal | Scoreboard and traces saved with Nightshift → Nemotron; README matches files; fresh-copy test passes |
| Tue Oct 27 | Final fresh-download test, target 5pm Boston | Ready before 23:45 UTC |

Reminder (Lyndsay handles these): record the video Monday evening; make the repo public and submit Tuesday.

If behind, cut in this order: audit web address (keep the Zetaris view), onboarding extras, product-matching upgrade (keep the current matcher plus the FDA filter and `no_false_recall`), AI soft fields in `offer_checks` (keep the code-checked ones), then trim onboarding to screens 1–3. Never cut the owner view, Nightshift as main AI, the real-model rerun, the learning demo, Plaid "Connect a card", the any-state fix, or the 12 fine-print tests.

## 6. Not changing / out of scope

- Agents, Fact-Checker send-backs, Fine Print Court, the never-empty feed, the Receipt split, the learning loop, Zetaris joins, Meterless memory (H-MEM, our one required engine, already working), trace logs, `POST /api/run`, `SAMPLE_MODE`.
- Guest only: no sign-in. Firebase stays unused. The save/reminders screen stays a labelled demo, not real sign-in.
- Paid hosting: none. Test locally only; `render.yaml` stays for later (the hosted site can't reach Nightshift on your Mac anyway).
- Cut: live store price feeds, Redis, an MCP server, brand screens, NVIDIA embeddings, confidence-score bands. The Amazon upload stays a coming-soon tile.
- Dropped for good: poverty guidelines, WIC, SNAP, Medicaid and any low-income targeting.
- No real bank connections or real personal data. Plaid is sandbox only, demo families only. Testers and the video use made-up dates and ZIPs.
- Zetaris data-quality rules stay deferred; the Fact-Checker's "no source" rule remains the backstop.

## 7. Keys and access status

| Service | Status |
|---|---|
| Zetaris | Ready (cluster active; Neon and live recall feeds connected) |
| Neon | Ready (the database; not Supabase) |
| Meterless Nightshift | Lyndsay installing now (Oct 24). Token comes from its `proxy-token` file; Sunday Oct 25 update needed for exact model choice |
| NVIDIA | Key available; added inside Nightshift so Nemotron answers through it |
| Plaid sandbox | Keys available; feature back in (sandbox only) |
| Render | Deferred; local testing only |
| Firebase | Unused for the hackathon |

Keys go only in the git-ignored env file (or inside Nightshift); never in the repo, slides or video.

## 8. Decisions for Lyndsay (onboarding)

My recommended answer follows "Recommend:" in each item. Details in `onboarding-spec.md` section 6.

1. **Missing due-date screen** ("We're expecting" goes to the birthday screen by mistake). Recommend: build it (same screen, "When's your baby due?", and the doctor's date is fine).
2. **Dependent Care FSA always shown** (the server today assumes every family's job offers it). Recommend: Yes = show it with an amount; No = hide it; Not sure or Skip = show "Check with your job" with no dollar amount in the big total. Also recommend: drop the employer-name box.
3. ~~ZIP codes only recognized in 6 states.~~ **Decided Oct 24 (round 2):** every US ZIP works; federal programs everywhere plus a kind "We don't have [State] programs yet" note, never an error (section 4, item 4).
4. **"Cash" wording in the big number** ("in cash and tax credits" over-promises: the $1,000 goes into a savings account and the tax credits arrive as lower taxes next spring). You said "keep these" on Oct 23, so this is your call. Recommend: a light fix, saying "savings and tax credits," and add a "How we got this number" link.
5. **Single list or tabs after onboarding.** Recommend: single list for the hackathon; tabs go on a slide as "next."
6. **Location pre-fill** (the browser's "Allow location?" box must be explained by our own screen first). Recommend: drop it for the hackathon, so the parent types a ZIP. If kept, use a "Use my location" button the parent taps, and keep only the ZIP.

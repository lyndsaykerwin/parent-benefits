# Bundle: future-state grade of plan v3 (Sat Oct 24, 2026)

**What this is.** A grade of `bundle-plan-v3.md` (round 2) *as if every part of it were built and working*, not of today's code. It uses the official scoring table (`hackathon-overview.md` §13), the "what judges prioritise" list (§14), and the quality bar in `strong-submission-examples.md` and `weak-submission-examples.md`. The baseline is this morning's grade, `progress/reviews/regrade-2026-10-24.md`: **53 today, about 74 projected**.

**What I left out on purpose:** paperwork-type items (public repo, video recording, `metadata.json` links, secrets scan). Those are pass/fail and covered by the regrade. Here I focus on choices that are **hard to reverse** before the Monday 3pm code freeze (plan §5): what the product is, how it is built, and how the sponsor tools are used.

**How I cite:** "plan §4.6" means `bundle-plan-v3.md` section 4, item 6. "ER test" means `research/entity-resolution-test.md`. "Regrade" means `progress/reviews/regrade-2026-10-24.md`.

**Words used a lot here**
- **Agent:** one AI helper with one job (for example the Recall Checker).
- **Zetaris:** the required "data door". One question in SQL (a database language) can combine several separate data stores without copying them.
- **Cross-source join:** one question that combines rows from two *different* places (for example, the family's purchases in our database plus the government's live recall feed). This is the thing Zetaris is meant to prove.
- **Neon:** our own database. Everything we store ourselves lives here.
- **Meterless:** the other required sponsor. Two parts matter: **Nightshift** (an app that turns the Mac into a private AI server; required as the main AI provider) and **H-MEM** (its memory engine, which stores rules learned from parents).
- **Nemotron:** NVIDIA's AI model. The plan sends AI questions to Nightshift, which passes them to Nemotron.
- **Plaid:** the service apps use to read bank and card purchases. We use its "sandbox", a practice mode with fake banks.
- **Fallback:** a pre-written or rule-based answer used when the AI doesn't respond.
- **Matcher:** the code that decides whether a purchase is the same product as a recall.

---

## 1. Five-line summary

1. **Future-state score: about 79 / 100** (likely range 73 to 83), up from the regrade's 74 projection. The round-2 plan fixes the biggest Impact gap (Massachusetts-only) and the biggest Sponsor gap (Nightshift with Nemotron behind it).
2. **What moved the score up:** any US state works (plan §4.4), a defined Value Score and a growing fine-print dataset that doubles as a brand audit (plan §4.5), "code reject always beats AI approve" (plan §4.5), Nightshift to Nemotron as the single AI path (plan §4.2), and a clean parent view with a separate owner view (plan §4.1).
3. **What still caps it:** the recall feature, which is the project's best "fragmented data" moment, rests on a matcher that finds 0 of 12 real recalls today. The fix exists (ER test §3–4) but the plan lists it as a should-do that gets cut first (plan §4.6, §5).
4. **Biggest honesty risk:** the judges' line "the AI decides the hard cases" (plan §3) is no longer true under the plan's own design, where rules decide and the AI only helps (plan §4.6, §4.5). Change it now.
5. **On the three open questions:** yes, take Plaid card rows out of recall matching; yes to an Amazon order upload, but small and on the results page, and only if the better matcher is built too; and rewrite the "AI decides" line (section 4 below).

---

## 2. Score per criterion (as if fully built)

"Fully built" here means every must-do in plan §4 plus the should-do product-matching upgrade. Where a score depends on that should-do, I say so.

| Criterion (points) | Regrade projected | Future state | Change | Why |
|---|---|---|---|---|
| **Impact (30)** | 21 | **23** | +2 | See 2a |
| **Technical (20)** | 15 | **16** | +1 | See 2b (15 if the matcher upgrade is cut) |
| **Innovation (15)** | 11 | **12** | +1 | See 2c |
| **Demo (15)** | 12 | **12** | 0 | See 2d (not graded in depth; mostly about recording) |
| **Product & UX (10)** | 8 | **8** | 0 | See 2e (9 with a working order upload) |
| **Sponsor Tech (10)** | 7 | **8** | +1 | See 2f |
| **Total (100)** | 74 | **79** | **+5** | Range 73 to 83 |

### 2a. Impact: 23 / 30 (was 21)

**Up:**
- **Any US ZIP code works; no Massachusetts-only code.** Federal programs for everyone, state programs as table rows, a kind "We don't have [State] programs yet" note instead of an error, and a guard test that fails if "MA" appears in agent code (plan §4.4). This removes the regrade's main Impact complaint: "a real parent outside Massachusetts gets federal benefits and offers only" (regrade §3).
- **Middle-class focus with real programs:** Child Tax Credit, Dependent Care FSA (a work account that pays for daycare before tax), and NY/CA/MA paid family leave, each stored with its official source and year (plan §1 item 3, §3, §4.4). That is a bigger group of users than the old low-income angle, and no sample family qualified for WIC anyway (plan Oct 24 update item 3).
- **Value Score:** true dollar value (face value minus hidden costs), an effort badge, and the list of catches, with "How we scored this" in plain words (plan §4.5). The regrade wanted this demoted because the formula wasn't written (regrade §5). It is now written, with a clear rule that every dollar figure must appear in the quoted fine print or be computed by code (plan §4.5). I now agree it stays a must-do.
- **The work-benefits answer is actually used** instead of assuming everyone has a Dependent Care FSA (plan §4.4, §8 decision 2). That stops inflated totals.

**Still holding it back:**
- **The Track 1 hero only works for the sample families.** Track 1 is about "working across fragmented data sources" (`hackathon-overview.md` §6). Bundle's best example is purchases joined with live recalls. But bank lines carry no product names (ER test §1), and the plan keeps the Amazon order upload as a "coming soon" tile (plan §6). So a parent who types in their own details never sees a recall check on their own purchases. Plaid is limited to demo families too (plan §4.3).
- **The "how much money is this worth" claim is still not in the repo.** The regrade flagged that the ~$9,210 figure lives in a research file outside the code (regrade §6 item 12). Plan §4.8 replaces the WIC statistic on slide 2 but doesn't add a sourced value table. Judges discount "unsupported claims of value" (`hackathon-overview.md` §14).

### 2b. Technical: 16 / 20 (was 15)

**Up:**
- **Code checks always run, and a code "reject" overrides an AI "approve"** (plan §4.5). This was the regrade's top unplanned fix (regrade §5 action 4a; `plans/architecture.md` §7c). It stops the AI Court from approving a trap on camera.
- **Much stronger tests:** 12 fine-print tests, 3 "should still pass" controls, a prompt-injection test (FP-12; fine print that tries to give the AI orders), a 5-family any-state test with a "swap a table row, the card changes" check, and a `no_false_recall` test (plan §4.4, §4.5, §4.6). These are exactly the "reliable execution" and "validation" signals judges look for (`hackathon-overview.md` §14).
- **The parent's data is trimmed on the server, not just hidden on screen,** with a test that checks it (plan §4.1).
- **Honest labelling of which AI model answered,** saved in the scoreboard (plan §4.2 "Done when").
- **Recall matcher upgrade (should-do):** brand + product type pairing in Zetaris, then hard rules in code (sale dates, seller, FDA status, shelf life), each alert showing its evidence (plan §4.6). On fresh test data this found 7 of 8 real recalls with 1 wrong alarm (ER test §3). That is a big jump from 0 of 12 today.

**Still holding it back:**
- **The AI's reliability fix depends on Meterless's Sunday update.** The plan's answer to the Judge timing out is "wait for the Sunday Nightshift update, then set a longer wait" (plan §4.2). The ER test found the deeper causes: a timeout that doesn't stop a hung call, replies cut off because the model's "thinking" uses up the length budget, and no retry (ER test §3, Strategy C). None of those fixes is in the plan's "Done when" list. `plans/architecture.md` §7d also wants an overall time limit per run, since Nightshift allows 180 seconds per call and one run makes many calls.
- **Saving results in Neon (so they survive a restart) isn't on the must-do list.** Plan §4 says "agents write results to Neon", but `plans/architecture.md` §4 says the table for it isn't built, and no ranked item covers it.
- **If the matcher upgrade is cut** (it is third in the cut order, plan §5), the recall feature stays at 0 of 12 found without AI, 2 of 12 with it (ER test §3). Score drops to 15.

### 2c. Innovation: 12 / 15 (was 11)

**Up:**
- **A third verdict, "approve, with a catch"** (plan §4.5): more honest than yes/no, and a parent can act on it.
- **The fine-print scorecard (`offer_checks`) turns every run into a growing dataset with no family data in it,** including a fingerprint of each offer's exact wording so changes are noticed. It becomes a **brand audit**: per-brand catch rates and true-vs-advertised value (plan §4.5, §3). That's a second user (brands, watchdogs) built from the same agent work, which is a fresh angle.
- **"Bank data tells us where you shop. Order history tells us what you bought. Recalls need the second."** (plan §4.6). A thoughtful design decision, honestly stated. This matches "the team made thoughtful trade-offs and was honest about limits" (`strong-submission-examples.md` §16).

**Still holding it back:**
- **The more the plan moves decisions to rules, the more a judge asks "where is the AI doing real work?"** Rules decide recalls (plan §4.6), code fills all dollar amounts, dates and flags in the fine-print scorecard while the AI fills "only the soft fields" (plan §4.5), and code overrides the Judge (plan §4.5). That's the *right* engineering, but the pitch needs to show the AI's real jobs clearly (section 4c below). Otherwise it reads like a rule engine with AI decoration, which is close to the "agents as prompt wrappers" weak pattern (`weak-submission-examples.md` §6).

### 2d. Demo: 12 / 15 (unchanged; not graded in depth)

The two-screen split makes the story easier to film: calm parent page first, then "Behind the scenes" with the debate and learning (plan §2). Two plan-driven risks for the recording: live Plaid needs live Zetaris runs, which have taken 13 to 171 seconds (plan §4.3 Risk), and real AI only runs on the Mac (plan §4.2 Risk). Record from saved runs where possible.

### 2e. Product & UX: 8 / 10 (unchanged)

**Up:** one question per screen onboarding (plan §4.7), every ZIP works (plan §8 decision 3), a clean parent view (plan §4.1), "We caught these for you" (plan §2).
**Held back:** "Connect a card" only works for demo families and fills in generic coffee and airline purchases unless a custom test user is set up (plan §4.3), and the Amazon upload is a dead-end "coming soon" tile (plan §6). Both are the "find money in what you've already bought" step that the onboarding design promised (`plans/onboarding-spec.md` §2, screen 8). A small real order upload would make this a 9.

### 2f. Sponsor Tech: 8 / 10 (was 7)

**Up:**
- **Nightshift is the main AI, with Nemotron answering through it** (plan §4.2). This is almost exactly the setup in the judges' own strong example: "All model calls ... run through Meterless ... The agents reason with NVIDIA Nemotron, reached through Meterless" (`strong-submission-examples.md` §5). It meets the Nightshift rule and gives NVIDIA a real job in one move, with one clear fallback (plan §4.2).
- **Zetaris gains the `offer_checks` table as a new, agent-made source,** and the Fact-Checker re-checks state (plan §3).

**Still holding it back:**
- **Zetaris's cross-source join still happens in one agent only.** Plan §3 says "Zetaris does four joins", but only the Recall Checker combines two different places (Neon + live CPSC/FDA feeds). The Benefits Planner's new tables (`tax_parameters`, `state_programs`) are in Neon; Plaid data is copied into Neon (plan §3 "Honest note"); `offer_checks` is in Neon. The regrade already warned: "Don't imply that four live sources are joined" (regrade §6 item 9).
- **Meterless memory stays thin.** NVIDIA embeddings (which would have made the memory understand meaning, not just matching words) moved out (plan §4 ranking). H-MEM still uses a stand-in "hash" matcher, and the parent's "I got this" / "Report issue" / "Not mine" taps still don't adjust a rule's confidence in H-MEM (`plans/architecture.md` §2 H-MEM "Honest limits"; `research/research-nightshift.md` §5). The deck's "take Meterless away and Bundle stops working" overclaims (regrade §6 item 6).

---

## 3. Top 5 hard-to-reverse risks, each with a concrete fix

### Risk 1. The recall feature, the Track 1 showpiece, may ship broken

**What:** the plan's must-do keeps today's matcher plus a filter and one test (plan §4.6 must-do). Today's matcher finds 0 of 12 real recalls offline and 2 of 12 with AI, because its loose word search makes 192 pairs for 30 purchases and only 25 get checked (ER test §3). The better matcher is a should-do and the third thing cut if behind (plan §5).
**Why it's hard to reverse:** recalls are the one true cross-source join (section 2f), the scariest thing to get wrong for a parent (`plans/architecture.md` §7e), and the regenerated evidence on Monday morning (plan §4.8) locks in whichever matcher exists.
**Fix:** promote the core of the better matcher to must-do: (1) brand + product type pairing in the Zetaris view `v_recall_orders`, (2) the sale-date and seller rules, (3) the evidence line on each alert, (4) the two known fixes ("sold in April 2026" dates; "pad/liner/insert" types) (ER test §3, §5). Pay for it by moving the brand-audit web address and onboarding extras behind it in the cut order (plan §5). Add the ER test's 14 cases to the scoreboard (ER test §6) so judges see "88% of alerts right, 88% of recalls found" from fresh data.

### Risk 2. The judges' line says the AI decides, but the design says rules decide

**What:** plan §3 says "the AI decides the hard cases". Plan §4.6 says "no AI needed to raise an alert ... a missing or slow AI answer never decides an alert", and plan §4.5 says "a code reject always overrides an AI approve."
**Why it's hard to reverse:** this line goes into the README, deck and video. A judge who reads the code and finds the opposite marks down credibility across every criterion (`weak-submission-examples.md` §4: "Credibility: damaged across every criterion"). Fixing it after submission isn't possible.
**Fix:** use this line instead: *"Zetaris finds candidate matches across private and public data in one question. Code rules make the safety decisions and show their evidence. The AI argues over fine print, explains, fills gaps the rules can't, and learns new rules from parents, and code can overrule it."* Then show that in the trace (section 4c).

### Risk 3. The real-AI evidence has one shot, and the timeout fix isn't fully planned

**What:** the real-AI rerun happens Monday morning, before the 3pm freeze (plan §5). The plan's only reliability step is the Sunday Nightshift update and a longer wait (plan §4.2). The ER test showed calls that hang past their timeout and replies cut off by the model's "thinking" (ER test §3).
**Why it's hard to reverse:** if the Judge falls back again, the saved scoreboard shows the AI barely worked, and there's no time to rerun after the freeze. The regrade's estimate is 1 to 2 points lower on Technical and Innovation if this isn't fixed (regrade §3).
**Fix:** add to plan §4.2 "Done when": a hard limit on the *whole* call (not just reading data), one retry, a larger reply-length cap, "thinking" turned off for the Judge once the Sunday update allows it, an overall time limit per run (`plans/architecture.md` §7d), and an "AI calls that worked / total" number on the scoreboard. Do a short real-AI smoke test on Sunday evening, not only on Monday.

### Risk 4. "Four Zetaris joins" overclaims; the real cross-source story is one join

**What:** plan §3 lists four joins, but only one crosses two different places (section 2f).
**Why it's hard to reverse:** it shapes the deck's sponsor slide and the video. Judges are told to check whether sponsor tech is "bolted on" (`weak-submission-examples.md` §4).
**Fix (pick one; both are cheap):**
- **(a) Add a second genuine cross-source join:** have the brand audit view `v_offer_audit` combine `offer_checks` (Neon) with the live CPSC recall feed by brand: "per brand: fine-print catch rate, true vs. advertised value, *and open safety recalls*." That makes the brand audit richer and gives Zetaris a second real cross-source job. About 1 to 2 hours, using the brand field the matcher upgrade already pulls out (plan §4.6).
- **(b) Or reword** plan §3 and the deck to: "one join across private and live public data, plus separate filtered views for each agent so the deal Judge never sees family data."

### Risk 5. Meterless memory is the thinnest required piece

**What:** H-MEM uses a stand-in matcher, NVIDIA embeddings were cut, and parent taps don't feed it (section 2f). Only the "Approve" button writes to it.
**Why it's hard to reverse:** Meterless is pass/fail and worth part of the 10 Sponsor points. "Learn from parent feedback" is in the project's one-line description (`CLAUDE.md`), so judges will look for it.
**Fix:** wire the existing `memory.feedback()` (already written, `plans/architecture.md` §2) to "I got this" / "Report issue" on any card whose ruling cited a learned rule, and show the rule's confidence going up or down in the owner view. About 1 to 2 hours. Soften the deck's "take Meterless away and Bundle stops working" to "take Meterless memory away and the Court never learns" (regrade §6 item 6).

**Smaller items to fix while in there:** add a short sourced "what a middle-class family can get back in year one" table to the repo (regrade §6 item 12); add the Neon results table to the must-do list (`plans/architecture.md` §4); note in plan §4.3 that the ER test already proved Plaid's custom test user works (ER test §1), so the "check whether" step is done.

---

## 4. View on the three open questions

### 4a. Should Plaid card rows come out of recall matching? **Yes. Decide now.**

- **Why:** a bank line never names the product, only the store, amount and date (ER test §1). In recall matching it can only cause wrong alarms, such as "AMAZON" against Amazon Basics mattress and pocket-knife recalls (ER test §3). It's a small change (plan §4.6 already recommends it).
- **Score effect:** protects Technical and Impact (a wrong recall is the worst failure for this product, `plans/architecture.md` §7e). No downside.
- **Also update plan §3:** the Recall Checker row still says purchases "+ Plaid practice-bank card purchases". Change it so the plan doesn't contradict itself.
- **Give Plaid a visible job instead:** (1) the Clawback Hunter (money-back helper) finds daycare bills for the Dependent Care FSA using a list of daycare names, since Plaid's own labels were wrong on 3 of 8 baby lines (ER test §1); (2) link each card line to its order by store + amount + date within 3 days, so the bank line proves the purchase (plan §4.6). Use the custom test user with a "BRIGHT HORIZONS TUITION" line so the demo shows a real Dependent Care FSA card from Plaid data. Add the ER test's `plaid_childcare` and `plaid_not_childcare` cases (ER test §6).

### 4b. Should the Amazon order upload be a real step? **Yes, but small, on the results page, and only together with the better matcher.**

- **Why yes:** it's the only way a parent's own purchases reach the recall check (ER test §4 "Data sources" item 1). Without it, the Track 1 showpiece only works on sample families (section 2a). The parser already exists and is tested (`bundle/server/ingest/amazonCsv.ts`, `bundle/server/__tests__/ingest.test.ts`); it just isn't connected to a screen. Worth about +1 Impact and +1 Product & UX.
- **Why not as a first-run onboarding screen:** Lyndsay's rule is "no bank information up front", and the design puts purchase data after the payoff (`plans/onboarding-spec.md` §2 screen 8, §4). Put "Add your Amazon orders" next to "Connect a card" on the results page.
- **Fake-data rule:** offer a **"Use our sample order file"** button as the main path, process the file for that session only, and don't save it (`plans/onboarding-spec.md` §5: "allow sample files only, for the hackathon").
- **Condition:** only do this if the better matcher (Risk 1) is built. Uploaded orders run through today's matcher would find almost nothing (ER test §3), which makes the feature look broken on camera.
- **Priority if time is short:** better matcher first, then upload, then the brand-audit web address.

### 4c. The line "the AI decides the hard cases": **rewrite it now** (see Risk 2 for the new wording)

- **Why it matters for the score:** the true story is *better*, not worse. "Code makes safety calls and shows evidence; the AI does the reading and judging that code can't; each can overrule or correct the other" is the "agents challenge and validate each other" pattern judges prioritise (`hackathon-overview.md` §14).
- **What the AI must visibly do, so Innovation doesn't drop:** (1) argue and judge the soft fine-print catches code can't see, such as the subtler learning-demo trap "autoship must remain active for 2 deliveries" (plan §4.5); (2) write the catch summary and effort level, which code then checks (plan §4.5); (3) propose new rules from parent reports (Coach, `plans/architecture.md` §3); (4) fill in a recall's brand or product type when the rules find none (plan §4.6).
- **Show it in the trace and video:** one moment where code overrules an AI "approve", and one where the AI catches something the code rules missed. That pair is the clearest proof that the agents check each other.

---

## 5. Decide now vs. later

**Decide now (Saturday, before Sunday's build starts). These change what gets built:**
1. Plaid rows out of recall matching, plus Plaid's new job (daycare bills and order linking) (section 4a).
2. Promote the core of the better matcher to must-do and reorder the cut list (Risk 1).
3. Amazon upload: yes as a small results-page step with a sample file, tied to the matcher (section 4b). Or a clear no, and say on a slide that recalls run on sample order history.
4. Replace the "AI decides the hard cases" line everywhere it appears (Risk 2).
5. Add the AI reliability items to plan §4.2 "Done when" and plan a Sunday evening real-AI smoke test (Risk 3).
6. Zetaris: add the brand + live-recall join to the brand audit, or reword "four joins" (Risk 4).
7. Wire parent taps to H-MEM confidence (Risk 5).
8. Put the Neon results table on the must-do list.

**Can wait (Sunday evening to Monday morning):**
- Pin Nemotron exactly once the Sunday update arrives (plan §4.2).
- The brand-audit web address and its OpenAPI description (a standard file that tells other programs how to call it) (plan §4.5 should-do).
- Onboarding extras, and decision 4 "cash" wording (plan §8).
- The year-one value table and deck wording fixes (section 3 smaller items).
- MCP server (a standard plug-in for AI agents) stays a "later" slide (plan §4 Cut).

**Already well decided; don't reopen:** Nightshift to Nemotron as the single AI path with one fallback (plan §4.2); any-state rules (plan §4.4); dropping the confidence-score bands in favour of rules with evidence (plan Oct 24 update item 6); Value Score with effort kept as a badge, not dollars (plan §4.5); no Redis, no paid hosting, never "real-time" (plan Oct 24 update item 8).

---

## 6. Score range

- **About 83 (upside):** everything above lands, including the matcher, the order upload, and a reliable real-AI rerun with Nemotron answering.
- **About 79 (expected):** the plan as written plus the matcher upgrade.
- **About 73 to 75 (downside):** the matcher upgrade is cut, Nemotron can't be reached so Nightshift's small built-in models answer (plan §4.2 fallback), and the Judge still falls back often. The entry still passes the sponsor rules in that case, because Nightshift is still the main AI.

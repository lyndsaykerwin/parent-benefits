# Bundle plan v3 (Fri Oct 23, 2026, evening; updated Sat Oct 24)

Replaces the v2 summary's open items. Submission: Tue Oct 27, 23:45 UTC (7:45pm Boston; our target is 5pm Boston). Video recorded Mon Oct 26. The Oct 23 version is saved in `plans/old-versions/bundle-plan-v3-2026-10-24-before-update.md`.

## Oct 24 update (what changed today)

1. **New judge rule: Meterless Nightshift must be the main ("primary") AI provider.** Nightshift is Meterless's app that turns your Mac into a private AI server for your apps. NVIDIA is now "use it wherever it contributes," not the main AI. Open question: does the free Mac edition you can run (called "M1+") count, and can it reach NVIDIA's Nemotron models? **First step today: Lyndsay asks in the HackOS "Help Meterless" channel.** The plan below works either way.
2. **Plaid "Connect a card" is cut.** It moves out to make room for Nightshift and the new onboarding. Store price feeds (Amazon, Walmart, Target) are also cut: no access in time.
3. **Recall matching gets safer and measurable:** finished ("Terminated") FDA recalls are filtered out, a test proves wrong recalls don't show, and a confidence score sorts matches into "Recall alert" or a calm "Please check this item."
4. **Agents' scorecard:** each offer check is saved in a Neon table (`offer_checks`) and registered in Zetaris as its own source. Parents see a **Value Score** per offer. Brands get data only (no brand screens), plus a pitch slide.
5. **New onboarding:** one question per screen (expecting or baby's here, date, ZIP, optional work benefits), a short "Checking" screen, then the list. Six decisions for you are in section 8.
6. Wording guardrails: Neon (not Supabase) is the database; no Redis; never say "real-time"; Meterless = memory engines, not fine-print reading.

---

## 1. In one minute

**What Bundle does:** a new parent opens it and sees one calm page: money they can get back, benefits with deadlines, recalls, and deals. Behind the scenes, a team of AI helpers (agents) checks every claim and throws out tricky "free" offers that hide a paid membership.

Behind the scenes, every helper looks things up through Zetaris — one door that combines the family's private data, our rule lists and live government recall feeds in a single question, without copying any of it.

**Done:** the whole app works and passes its tests. It runs on made-up families, with saved answers standing in for the AI, so it needs no keys.

**What changes:**
1. Two screens. Parents get the simple page plus one short "We checked this" line per card and a "We caught these for you" list. A separate "Behind the scenes" screen, opened with a reviewer code, shows the agents debating, the data sources, the learned rules and the scoreboard.
2. Real AI switches on, **through Meterless Nightshift running on your Mac** (new rule). We rerun the scoreboard and the learning demo with it and say plainly what was real. NVIDIA stays where it honestly helps (section 4, item 2).
3. A quick, one-question-per-screen onboarding replaces the single form.
4. Safer recall matching, the agents' scorecard in Zetaris, and a Value Score on each offer.

**Left for you:** ask Meterless today; record the video Monday; make the repo public and submit Tuesday.

**Timeline:** Sat split the screens, recall fixes, scorecard table; Sun Nightshift switch and real-AI rerun, onboarding, evidence; Mon morning finish, then video and slides; Tue final test and submit.

---

## 2. What the parent sees vs. what the owner sees

| | Parent view (simple, calm) | Owner view ("Behind the scenes") |
|---|---|---|
| Headline | The Receipt: money back, benefits you likely qualify for, deadlines, items safety-checked | Same Receipt, plus the scoreboard (traps caught, before vs. after learning, match accuracy) |
| Cards | Title, amount, source links, a short "We checked this" line; offers show a Value Score | Same cards, plus the Zetaris data sources used for each |
| Recalls | "Recall alert" for strong matches; "Please check this item" (calm, with a "Not mine" button) for borderline ones | Every pair considered, including "considered and rejected" with the reason |
| Rejected items | "We caught these for you": plain-language list of offers and claims we stopped | Fine Print Court debate (Deal Hunter vs. Fine Print Lawyer, then the Judge) and Fact-Checker send-backs, in full |
| Learning | Parents tap "I got this" / "Report issue" | Meterless memory and case law, with the Approve button; proposed vs. approved rules |
| Proof | Nothing technical | Full trace of every agent step, including which AI model actually answered |
| Access | Anyone (guest) | Reviewer code only (the existing reviewer token), shown to judges in the demo |

## 3. Where Zetaris does the work

| Helper | The question it asks Zetaris | What gets combined | Where you see it |
|---|---|---|---|
| Recall Checker | Which of this family's purchases are on a recall list? Now graded: bar code, then full name, then brand plus words (the AI judges borderline pairs) | Private orders/card purchases (Neon) + live CPSC and FDA recall feeds (finished FDA recalls dropped) | Recall card; "We checked 7 items" |
| Clawback Hunter | Which purchases are FSA-eligible or inside a store's price-drop window? | Card transactions + FSA-eligible list + store policies (live store price feeds cut) | "Money back" cards and the Receipt total |
| Benefits Planner | Which programs does this family likely qualify for, by when? | Family profile + benefit rules + official poverty-limit table | Benefit/deadline cards |
| Fact-Checker | Is this exact dollar amount/date right? (asks a separate question) | Re-reads the source row | Blocks or sends back wrong cards |
| Agents' scorecard (new) | What did the agents find in each offer's fine print? | `offer_checks` table in Neon, written by the agents and registered in Zetaris as its own source (no family data in it) | Value Score on offers; brand audit view |
| Privacy views | — | Each helper gets its own filtered view (the deal Judge never sees income) | Owner view: "Data sources" per card |

Remove Zetaris and the app can't produce a single personal card. Honest line for judges: "Zetaris finds the candidate pairs across private and public data in one question; the AI decides the hard cases." (Zetaris has no built-in fuzzy matching.)

## 4. Technical plan (for the CTO)

Starting point: repo `bundle/`, 264 tests passing, `SAMPLE_MODE=true` is always offline by design (verified), Zetaris Neon x CPSC join working, reviewer token already gates Approve. No Redis: agents write results to Neon and screens read from Neon.

**Ranking for the 3 days left.** Must-do: items 1, 2, 3 (first half), 4 (table and Value Score), 5 (core screens), 6, 7. Should-do, only once must-dos are green: item 3 second half (confidence bands), item 4 audit endpoint, NVIDIA embeddings. Cut: Plaid, MCP server (pitch slide only), tabbed layout, save/reminders screen, model-number matching, location pre-fill.

**1. Owner view split** (must-do)
- Goal: parent view shows only Receipt, cards, a one-line "We checked this" per card, and "We caught these for you". Everything agent-internal moves behind an owner entry point.
- Key areas: `client/` (card detail, "Bundle got smarter" screen, new owner route), run/trace API in `server/` (a parent-safe response shape vs. the full one), reviewer-token check (`x-reviewer-token`). "We checked this" and "We caught these" are built from fields the Fact-Checker and Court already record.
- Done when: with no token, the API and UI never expose debate text, data-source names, memory rules, traces or Approve; with the token, all of those appear and Approve still works; a test asserts the parent payload has none of those fields; the learning loop (report twice, approve, run again, offer blocked) still passes end to end.
- Risk: leaks through the API (hiding in the UI is not enough); the parent payload must be trimmed on the server. Medium effort; mostly moving existing screens.

**2. Nightshift as main AI, live run and honest labeling** (must-do; replaces "NVIDIA live run")
- Goal: real model text for the court debate, explanations and Coach rules comes through Nightshift; scoreboard and learning demo rerun with it.
- Step 0 (Lyndsay, today): ask HackOS "Help Meterless": (a) does the free M1+ edition count as "primary AI provider"? (b) can it reach Nemotron? Also read the Participant Setup Guide's Meterless section (it needs your sign-in). Then decide whether to download Nightshift (`Nightshift-Setup-mac-m1.dmg`, 17.7 MB from meterless.ai, then about 11.5 GB of small models inside the app; start early, it can take 2 hours).
- Code switch (about 2–4 hours with tests): point the single AI adapter `server/adapters/llm.ts` at `http://127.0.0.1:8088/v1`, read Nightshift's token from its `proxy-token` file, add the two Meterless labels (`meterless-app: bundle`, `meterless-scope: user`), use routing names `meterless/deep` and `meterless/fast`, wait up to 180 seconds, and record which model actually answered. Update `scripts/check-model.ts`, `scripts/eval.ts` (scoreboard label `nightshift:<mode → model>`), the tests, `.env.example`, README and `metadata.json`. Full file list: `research/research-nightshift.md` section 3.
- If Meterless says **yes, and Nemotron is reachable**: route `meterless/deep` to Nemotron, so both sponsors work in one request.
- If **yes, but no Nemotron** (or no answer by Sunday noon): Nightshift's small local models are primary; NVIDIA contributes through the optional embeddings below, and, only if the small models make the Court unreliable, Nemotron answers the Judge's final ruling alone (README says which step uses which).
- If **no, M1+ doesn't count**: ask what does (a hosted address or hackathon keys); if nothing is usable on your M4 Mac by Sunday noon, ship the M1+ setup anyway and say plainly in the README which edition we used and why.
- Optional: NVIDIA embeddings for H-MEM (2–4 hours). An embedding turns text into numbers so similar meanings can be found. Meterless memory currently uses a stand-in; NVIDIA's makes "recall the right learned rule" genuinely better, with the old one kept as the offline backup. Becomes should-do if Nemotron can't be reached, so NVIDIA still does real work.
- Done when: `llmMode` in the scoreboard reads `nightshift:...`; the new run-1 and run-2 learning traces are saved; every README/slide line that says "offline", "supported, not exercised", "no real model" or "NVIDIA-hosted" matches what was actually run. Two modes are labeled separately: saved offline replay (no keys, judges' default) and the real-model run (replayed Zetaris answers, live Nightshift).
- Risk: the hosted site can't reach your Mac (`127.0.0.1` means "this same computer"), so live AI runs happen on your Mac and the video shows them; small local models are weaker and may fail the strict answer format more often, so the score may drop below 6 of 6 and we report what it is; the real model may not approve the trap offer in run 1 (then show a saved real run 1 next to run 2, and say so); macOS will warn the app is unsigned (open via right-click, Open).

**3. Recall matching: safer and measured** (first half must-do, about 3 hours; second half should-do, about 2 hours)
- Must-do: drop FDA recalls marked "Terminated" (finished); add a hand-labelled set of 15 to 20 purchase-and-recall pairs to the scoreboard, reporting "of alerts raised, X% were right" and "of real recalls, we caught Y%"; add the `no_false_recall` test (the maya run must not show CPSC 10490 or 10453, today's known near-misses). Run it offline and with the real AI; report both.
- Should-do: layered match with a score. Bar code (0.99), then model number found in the recall text (optional, 0.95), then full name (0.90), then brand plus words with purchase date and seller checks (0.40–0.70), then the AI answers yes / no / unsure with a reason on borderline pairs. Bands: 0.85 and up = "Recall alert"; 0.50 to 0.85 = "Please check this item" (calm wording, a "how to confirm" line, a "Not mine" button that feeds Meterless memory); below 0.50 = hidden from parents, shown in the owner trace. Formula recalls say "check the lot number on the can."
- Key areas: `server/agents/recall.ts`, the `v_recall_orders` view in `scripts/zetaris/register.ts` (pass the bar code through), `evals/expected.json`, `scripts/eval.ts`.
- Done when: the new test and labelled set pass and their numbers are in the scoreboard and README.

**4. Agents' scorecard, Value Score and brand audit data** (table and Value Score must-do; endpoint should-do)
- Goal: the Fine Print Court saves each finding to `offer_checks` in Neon (offer, store, type of catch, one-sentence finding, severity, quote from the public fine print, link, verdict, time, agent, model; **no family column**). The table is registered in Zetaris as its own agent-made source.
- Value Score: shown to parents on each offer. The exact formula is not written down yet; build it from the `offer_checks` findings (what the offer is worth minus its catches) and show "How we scored this" in plain words.
- Brand audit: a Zetaris view `v_offer_audit` with per-brand totals and that brand's own findings only. Should-do: one read-only web address (`GET /api/offer-audit?store=...`, fixed query, rate-limited, saved answers in sample mode) with an OpenAPI description (the standard file that tells any program or agent how to call it), plus a test that the answer never contains family fields. No brand screens. The MCP server (the standard plug-in for AI agents) goes on a pitch slide only.
- Done when: a run fills `offer_checks`, Zetaris can query it, offers show a Value Score, and (if built) the endpoint returns clean JSON.

**5. New onboarding** (core screens must-do, about half a day; extras cut)
- Must-do: screen 1 "We're expecting / Baby's here" plus "Try a sample family"; screen 2 exact date (birthday or due date, matched to the choice, with the baby's-age line); screen 3 ZIP with "Found it: showing [State] programs"; screen 4 optional work-benefits Yes / No / Not sure / Skip; screen 5 "Checking" with real agent steps; then the list. All numbers come from the real run, never typed into the page. Card and Amazon links leave the first screen.
- Cut for the hackathon (mockup or slide only): the tabbed layout, the save/reminders screen, Connect a card, location pre-fill. Share and "find money in purchases" stay as "Coming soon"/demo only if they take under an hour.
- Key areas: `client/src/pages/Onboarding.tsx`, the run request in `server/routes/bundleRoutes.ts` (the work answer must replace today's always-"yes" FSA setting). Full spec: `plans/onboarding-spec.md`.
- Done when: both paths reach a result with made-up dates and ZIPs, wrong-direction dates get a clear message, and the sample family still works in one tap.

**6. Regenerate evidence** (must-do)
- Goal: scoreboard, saved example runs and learning traces reflect the real model and the new views.
- Key areas: `npm run eval`, `eval:live-model`, `examples:regen`, `output_examples/`, `logs/sample/`, `logs/scoreboard.json`, README section 8.
- Done when: committed files match the README numbers; the full test suite is green; a clean clone with no keys still runs the sample.
- Risk: README claims drifting from the saved files; check by diffing after regeneration.

**7. Deck and video updates** (must-do)
- Goal: slides and Monday video show the new onboarding, both views, Nightshift as the AI, Zetaris doing the joins, and the scoreboard.
- Key areas: slides; video script (onboarding and parent view first, then "Behind the scenes" for the agents, sponsor tech and scoreboard); update maya's money back to $48.99 (older deck draft says $46.99); one pitch slide for the brand audit and MCP next step.
- Done when: video is 1 to 4 minutes, shows no keys or real data, names Track 1, and every number on screen matches the saved run; slides have the 8 required points and disclose "Built with Claude Code"; no "real-time" claims.
- Risk: Zetaris or Nightshift slowness during recording (record from the saved-replay run or a real-model run with replayed answers).

## 5. Timeline

| Day | What happens | Done when |
|---|---|---|
| Sat Oct 24 | **Lyndsay first:** ask Help Meterless, read the setup guide, decide on the Nightshift download, answer section 8. Item 1: owner view split. Item 3 must-do half (FDA filter, labelled set, `no_false_recall`). Item 4: `offer_checks` table registered in Zetaris | Parent view clean, owner view complete behind the token, new recall test passing, tests green |
| Sun Oct 25 | Item 2: Nightshift switch, model check, live eval, learning rerun (decide the NVIDIA route by noon). Item 5: core onboarding. Item 4: Value Score. Item 6: regenerate evidence, update README | Scoreboard and traces saved with Nightshift; onboarding works on both paths; README matches files |
| Mon Oct 26 | Morning: should-dos only if everything is green (confidence bands, audit endpoint, NVIDIA embeddings). **Code freeze at noon.** Item 7: slides and **record video** (Lyndsay). Clean-setup rehearsal | Video and slides final; fresh-clone test passes |
| Tue Oct 27 | Final fresh-download test; **make repo public** and **submit** (Lyndsay), target 5pm Boston | Submitted before 23:45 UTC |

If behind, cut in this order: audit endpoint (keep the Zetaris view), NVIDIA embeddings, confidence bands, onboarding extras, then trim onboarding to screens 1–3. Never cut the owner view, Nightshift as main AI, the real-model rerun, the learning demo, or the FDA filter and `no_false_recall` test.

## 6. Not changing / out of scope

- Agents, Fact-Checker send-backs, Fine Print Court, the never-empty feed, the Receipt split, the learning loop, Zetaris joins, Meterless memory (H-MEM, our one required engine, already working), trace logs, `POST /api/run`, `SAMPLE_MODE`.
- Guest only: no sign-in. Firebase stays unused. The save/reminders screen stays a labelled demo, not real sign-in.
- Paid hosting: none. Test locally only; `render.yaml` stays for later (the hosted site can't reach Nightshift on your Mac anyway).
- Cut: Plaid "Connect a card" (stays "Coming soon"; fixture data covers it), live store price feeds, Redis, an MCP server, brand screens. The Amazon upload stays a coming-soon tile.
- No real bank connections or real personal data. Testers and the video use made-up dates and ZIPs.
- Zetaris data-quality rules stay deferred; the Fact-Checker's "no source" rule remains the backstop.

## 7. Keys and access status

| Service | Status |
|---|---|
| Zetaris | Ready (cluster active; Neon and live recall feeds connected) |
| Neon | Ready (the database; not Supabase) |
| Meterless Nightshift | Not installed. Waiting on the Help Meterless answer; token goes in the private env file |
| NVIDIA | Ready (key available); now a supporting role: Nemotron through Nightshift if possible, or embeddings / the Judge step |
| Plaid sandbox | Keys available; feature cut for the hackathon |
| Render | Deferred; local testing only |
| Firebase | Unused for the hackathon |

Keys go only in the git-ignored env file; never in the repo, slides or video.

## 8. Decisions for Lyndsay (onboarding)

My recommended answer follows "Recommend:" in each item. Details in `plans/onboarding-spec.md` section 6.

1. **Missing due-date screen** ("We're expecting" goes to the birthday screen by mistake). Recommend: build it (same screen, "When's your baby due?", and the doctor's date is fine).
2. **Dependent Care FSA always shown** (a work benefit for paying daycare with pre-tax money; the server today assumes every family's job offers it). Recommend: Yes = show it with an amount; No = hide it; Not sure or Skip = show "Check with your job" with no dollar amount in the big total. Also recommend: drop the employer-name box.
3. **ZIP codes only recognized in 6 states** (MA, NH, NY, OH, CA, TX). Recommend: recognize all US ZIPs and show federal programs with a kind "We don't have [State] programs yet" note, never an error.
4. **"Cash" wording in the big number** ("in cash and tax credits" over-promises: the $1,000 goes into a savings account and the tax credits arrive as lower taxes next spring). You said "keep these" on Oct 23, so this is your call. Recommend: a light fix, saying "savings and tax credits," and add a "How we got this number" link.
5. **Single list or tabs after onboarding.** Recommend: single list for the hackathon; tabs go on a slide as "next."
6. **Location pre-fill** (the browser's "Allow location?" box must be explained by our own screen first). Recommend: drop it for the hackathon, so the parent types a ZIP. If kept, use a "Use my location" button the parent taps, and keep only the ZIP.

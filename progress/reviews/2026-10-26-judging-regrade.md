# Bundle: judging re-grade and gaps nobody has named yet (Mon Oct 26, 2026)

Research only. No app code was changed. Deadline: **Tue Oct 27, 23:45 UTC** (7:45pm Boston), about 30 hours away.

**How this was checked.** I read the judging rules (`hackathon-resources/hackathon-overview.md` §4, §12–16; `weak-submission-examples.md`; `strong-submission-examples.md` §9, §15–16; `faq.md`; `hackathon-checklist.md`), the plan (`plans/bundle-plan-v3.md`), the Oct 25 and Oct 26 handoffs, the Oct 24 re-grade (`progress/reviews/regrade-2026-10-24.md`), the README, `metadata.json` and `.env.example`. Then I checked claims against the code and ran things myself:

- `SAMPLE_MODE=true npm test`: **1,223 pass, 11 skipped, 0 fail** (81 test files). `npm run check` (the type check): clean.
- Started a practice-mode server on a spare port (5077) and sent typed-in families from 7 different states through `POST /api/run`. Results below; this is where the biggest new finding came from.
- `gh repo view`: **the GitHub repo is PRIVATE.**
- Searched the saved logs for any trace of a real AI model answering. None found.
- Scanned all 251 saved versions in git history for key-shaped text: nothing real (only the template's fake `sk-your-openai-api-key-here`).

**The public event page adds nothing new.** hackathon.genai.works lists no judging rules or requirements; it points to the event page, and `genai.works/event/open-agent-hackathon-2026` returned "page not found" (404) today. A web search found no other copy. The rules live inside HackOS (the hackathon's own website, which needs a login), so the saved files in `hackathon-resources/` are the best source. **Lyndsay: open HackOS's submission page once today and check for new announcements.**

Words used here:
- **Practice mode (`SAMPLE_MODE`):** runs with no keys, replaying saved real Zetaris answers. This is how judges will most likely run it.
- **Trace:** the step-by-step log of one run.
- **Gate:** a pass/fail rule. Fail it and the score doesn't matter.
- **S / M / L:** small (under 1 hour), medium (1–3 hours), large (3+ hours).

---

## 1. Score table (today, if submitted as-is with the fixes you already plan)

"Now" means what is on disk today. "Reachable" means after your planned fixes **plus** the new items in section 3.

| Criterion (points) | Now, 1–5 | ≈ points now | Reachable | Main reason |
|---|---|---|---|---|
| Impact (30) | 3.5 | 20 | 23 | Real problem, honest "likely" wording, sources on every card. But in practice mode a family typed in from **46 of 51 states** gets a "sources didn't respond" banner and $0 |
| Technical (20) | 3.5 | 13 | 16 | Agents really do loop, retry, block and recover; 1,223 tests. But no saved evidence shows a real AI working, and the repo is private |
| Innovation (15) | 3.5 | 10 | 12 | The Fine Print Court debate, parent feedback becoming memory, reusing saved grades, and photo → structured data are original. In every saved run, though, the "debate" is the offline rule-based screen |
| Demo (15) | 1.5 now / 3.5 once recorded | 4 → 10 | 12 | **No video is recorded.** The script exists, but it says the AI is off on camera |
| Product & UX (10) | 3.5 | 7 | 8 | Calm, mobile-first, never-empty feed, Gear Locker, Deals. Your 14 known fixes cover most of the rough edges |
| Sponsor Tech (10) | 3 | 6 | 8 | Zetaris does real, load-bearing work (strong). Meterless H-MEM memory is real. But Nightshift and NVIDIA appear in **no** saved evidence, and Cursor wasn't used |
| **Total (100)** | | **≈60 (≈66 with a video)** | **≈79** | |

### Evidence per criterion, and what raises each one

**Impact (30): 3.5/5**
- Strong: a clear user and a dollar value with sources (`bundle/docs/year-one-table.md`). Track 1 fit is real: one Zetaris question joins a family's private purchases with live government recall lists (`pairsSql` in `bundle/server/agents/recall.ts`). Amounts are checked by code (`bundle/server/agents/factChecker.ts`).
- Weak, **new and verified today:** in practice mode the Benefits Planner's question (`rulesSql(state)`, `bundle/server/agents/benefits.ts:24-29`) changes with each state. Only 5 states have a saved answer in `data/sample/zetaris-cache/`: CA, FL, MA, NY and OH. A typed-in family from TX (75201) or IL (60601) got the banner *"Some sources didn't respond"*, a $0 Receipt, and "not yet verified" stand-in cards. Judges "test with their own inputs" (weak-submission-examples:309), so this is exactly what they will hit. It also means the honest "we don't cover your state yet" note (`stateNote`) never shows.
- Raise it: fix sample-mode state coverage (new item N2, S). Put the dollar-value evidence inside the submission (the deck and README already link it; check the Child Tax Credit fix you already plan lands in both).

**Technical (20): 3.5/5**
- Strong: four agents run side by side, and one failing never stops the rest. The Fact-Checker sends cards back up to 2 times, then drops them. There are retries for known Zetaris hiccups, a 300-second run budget, live updates streamed to the screen, rate limits, and one log line per step (`bundle/server/agents/orchestrator.ts:262-426`). Tests and type check are green.
- Weak: (a) the repo is private (gate, N1). (b) Every saved scoreboard, example and trace is offline (`logs/scoreboard.json`: `"llmMode": "offline-fallback"`). Even today's live-mode runs on the Mac reused saved grades (`judge reuse_saved_grade ... (no AI)` in `logs/run-guest-e069990f-….jsonl`), so the AI judge never ran there either. (c) The practice-mode state gap above. (d) No clean-download test since the V2 build.
- Raise it: N1, N2, N3 (one saved real-AI run), N6 (clean-download test).

**Innovation (15): 3.5/5**
- Strong ideas: a court that argues over fine print, parent reports becoming a rule in memory that changes the next run (`output_examples/learning/`), saved grades reused when an offer's wording is unchanged, and turning a photo into structured data (gear recall check, receipts).
- Weak: offline, the "debate" lines read "model unavailable" and the Coach picks one of two pre-written sentences (README §8). A judge reading the traces sees a keyword screen.
- Raise it: N3 (one real-AI run showing the court arguing and the Coach writing a rule). Put photo → structured data up front in the README and video (N4).

**Demo (15): 1.5/5 today, about 3.5 once recorded**
- `presentation/demo-video/video-script.md` is detailed, but no video file exists anywhere in the project. **The video is required** (overview §12); without it the entry is incomplete. Your known list includes the deck but not the video.
- The script was written Oct 23. It predates V2 (photo scan, Gear Locker, Deals live search, Account) and promises "AI off."
- Raise it: N5 (re-script around V2 plus one live-AI moment, then record; M–L).

**Product & UX (10): 3.5/5**
- Your known list (plan auto-save, page flicker, plainer Account page, photo examples, async photos, "How we checked", employer-email bug) covers most of it.
- Not yet named: the run limit of **10 runs per address per 10 minutes** (`bundle/server/routes/bundleRoutes.ts:224-228`) blocked me after 6 runs in quick succession. Judges sharing one office network could hit "Too many runs." Also, the two "Coming soon" tiles appear on every feed (`orchestrator.ts:175-178`); judges discount promised features, so consider moving them to the deck's "future" slide.

**Sponsor Tech (10): 3/5**
- **Zetaris: strong.** Every agent reads through `bundle/server/adapters/zetaris.ts`, and the family profile, rules, offers, recalls and fact-checks all go through it. It is a real cross-source join. Remove it and there are no personal cards.
- **Meterless: real, but thin and partly unproven.** H-MEM is the Meterless reference code copied into the repo (`vendor/hmem`; its own README calls it "not a production library"). It does real work: it stores rules, the court recalls them, the next run changes, and agents share a workspace. But your plan (`bundle-plan-v3.md:145`) treats **Nightshift as the "primary AI provider" the Meterless rule asks for**, and no saved file shows Nightshift answering. Job 6 (the Nightshift check) is still open, `progress/reviews/nightshift-check.md` doesn't exist, and the README itself says (§14) "To be recorded on the Mac (not done yet)." If that Meterless rule holds, this is the largest open gate risk.
- **NVIDIA:** wired up, but no saved evidence. `metadata.json` says "not exercised in the saved results."
- **Cursor:** the overview says it is required (§5, §12, §16; faq:113). You confirmed on HackOS that it's optional. `metadata.json` and the README say "not used." Keep a screenshot of that HackOS confirmation, and quote it in the submission form.
- Raise it: N3 (a saved Nightshift → Nemotron run), N4 (refreshed sponsor wording), N9 (Cursor proof).

---

## 2. Already known (not re-proposed)

Plan auto-save · Trump Account moved to savings with the SSN note · Child Tax Credit number confusion · rename "Fine Print Court" to "Fine Print" with a blocking threshold · real/live links and registry fine print · fine-print accuracy · employer-email button bug · "How we checked" on every card · photo examples for stroller/car seat · async photo processing with a Gear Locker notification · plainer Account page · "All checked" flicker · outside testers from a phone · deck update · `offer_checks` rows missing dollar values and model name · NVIDIA free vision often full.

---

## 3. New items, ranked by score gain per hour

| # | Item | Size | Gain | Why it matters |
|---|---|---|---|---|
| **N1** | **Make the GitHub repo public** (after one last key scan), then open the link in a private browser window while logged out | S (15 min) | **Gate** | `gh repo view` says `"visibility":"PRIVATE"`. Weak-submission-examples:375-387: a private repo "cannot be judged properly." My scan found no real keys in any saved version, but rescan right before flipping it |
| **N2** | **Fix practice mode for all states.** Easiest fix: have the Benefits Planner ask Zetaris for *all* rules in one fixed question and filter by state in code, so one saved answer covers every state. Then re-record (`npm run zetaris:record`) and regenerate the examples. Alternative: record the 46 missing state questions | S (1–2 h) | +3 (Impact +2, Technical +1) | Verified today: TX and IL typed-in families get the "sources didn't respond" banner and $0. Judges test their own inputs. It also lets "we don't cover your state yet" show honestly |
| **N3** | **Save one real-AI evidence pack.** On the Mac, with Nightshift → Nemotron (text only, not vision): run `npm run eval:live-model`, plus one run where the court actually argues. Use a fresh or changed offer, because saved grades are otherwise reused with no AI. Commit the scoreboard, trace and `output_examples/live/`, write `progress/reviews/nightshift-check.md`, and update the README §8/§14 labels | M (2–3 h) | +4 (Sponsor +2, Technical +1, Innovation +1), and closes the Nightshift gate risk | Today no saved file shows any AI answering. The Oct 24 re-grade flagged this as the weakest part, and it is still open |
| **N4** | **Refresh the README and `metadata.json` for V2.** Add photo scan → structured data, the Gear Locker, Deals live search (Tavily, a web-search service) and the report card. Add `TAVILY_API_KEY` to `.env.example` (it's missing). Replace the 4 `REPLACE-ME` links in `metadata.json` and its stale NVIDIA line. Name the track in the first line | S (1 h) | +2 (Sponsor, Technical, Impact clarity) | The README describes the Oct 23 app ("Extras tab", 3 sample families). Judges read it first. Photo → data is the strongest "creative data input" story, and it's missing |
| **N5** | **Record the demo video** (required, 1–4 min). Re-script for V2: problem, a typed-in family from another state (after N2), photo scan, Deals with Fine Print, the trace showing agents sending work back, the learning loop, Zetaris and Meterless on screen, one live-AI moment (after N3). Aim for 3:30 | M–L (3–4 h with retakes) | +6 to +8 (Demo) | Not on your known list. No video = incomplete submission (weak-submission-examples:36) |
| **N6** | **Clean-download test.** `git clone` into a new folder, `cp .env.example .env`, `npm ci`, `npm run dev`, then the README's two curl lines and one typed-in family | S (30 min) | +1, guards the Technical score | Not re-proven since V2. The checklist requires "runs from a clean setup with no manual steps" |
| **N7** | **Judge-friendly hosted link** (this overlaps your phone-tester item; the new part is what goes *to judges*). Put the link at the top of the README and in the submission form. Raise the run limit for it, or explain it. Give judges a reviewer code **in the HackOS form only, never in the repo**, so they can see the Agent Workspace trace and approve a rule (the trace is reviewer-only: `bundleRoutes.ts:221, 385-390`) | S (1 h, on top of hosting) | +1 to +2 (Demo, Technical) | Without the code, a judge on the hosted app can't see the agents working together, which is the evidence they score |
| **N8** | **Fill in the HackOS form carefully.** Pick Track 1. Paste the pre-existing components (README §12: VibeCode template, H-MEM, Zetaris starter, research). Write the sponsor explanation, including "what was unique." Submit by your 5pm Boston target (ties go to whoever submitted first) | S (45 min) | Gate | An undeclared earlier piece of work is a disqualification risk (overview §12) |
| **N9** | **Cursor proof.** Save the HackOS screenshot of "Cursor optional." Optionally, make one small real change in Cursor so you can honestly say how it was used | S (20 min) | Protects 1–2 points; removes a gate doubt | The rules text still says Cursor is required |
| N10 | Move the two "Coming soon" tiles off the feed and into the deck's "future" slide | S (20 min) | +0.5 (Product) | Judges discount promised features |
| N11 | Clean up two loose files before the final commit: `bundle/.tmp-q.mjs` (a scratch script that runs any SQL against Neon) and `codebase_export/` (3 MB; I scanned it and found no keys). Neither should be committed | S (5 min) | Avoids a bad look | Both are untracked (not saved in git) today. Keep it that way, or delete them |
| N12 | Delete the pretend family "test-live-check" (and its receipt) from Neon before judges use real mode | S (10 min) | Hygiene | Noted in your tracker. It's harmless, but shows up as clutter |

**Best order for the next 30 hours:** N1 → N2 → N4 → N3 → N6 → (your known fixes) → N5 video → N7 → N8/N9 → submit by 5pm Boston Tuesday.

---

## 4. Disqualification and low-score risks

| Risk | Status today | Severity |
|---|---|---|
| Repo not public | **PRIVATE** (verified) | Gate: fix with N1 |
| Demo video missing | **Not recorded** | Gate: N5 |
| Meterless "Nightshift as primary AI" rule (per `bundle-plan-v3.md:145`) | No saved proof that Nightshift answered; Job 6 still open | High: N3 |
| Sponsor tech "bolted on" | Zetaris: no (load-bearing). H-MEM: no (changes run 2). Nightshift/NVIDIA: unproven | Medium: N3 |
| Hardcoded outputs | OK. Zetaris answers are replayed *real* responses and the agents still run (verified: different states give different cards). The offline Coach's two fixed sentences are labelled honestly | Low |
| Real personal data | Sample families are fictional. The `logs/` ledgers from testers' typed-in families are git-ignored (only `logs/sample/` is committed). Keep outside testers on made-up details | Low |
| Committed secrets | None found in 251 saved versions; `.env.example` has placeholders only | Low: rescan before N1 |
| Cursor required by the written rules | Not used; you have a HackOS confirmation | Medium-low: N9 |
| Judges' own inputs fail | **TX/IL and 44 other states fail in practice mode** | High for score: N2 |
| Over-length video | Script targets 3:30; the old script ran 3:55 | Medium: keep 3:30 |

Sources: `hackathon-resources/hackathon-overview.md` (§5, §12–16), `weak-submission-examples.md` (lines 25–37, 289–309, 375–387), `strong-submission-examples.md` (§9, §15–16), `faq.md` (lines 107–122, 170–191), `hackathon-checklist.md`; live page https://hackathon.genai.works/ (checked Oct 26, 2026: no rule details; it points to the event page, which returned 404).

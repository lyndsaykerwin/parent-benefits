# Bundle plan v3 (Fri Oct 23, 2026, evening)

Replaces the v2 summary's open items. Submission: Tue Oct 27, 23:45 UTC (7:45pm Boston; our target is 5pm Boston). Video recorded Mon Oct 26.

## 1. In one minute

**What Bundle does:** a new parent opens it and sees one calm page: money they can get back, benefits with deadlines, recalls, and deals. Behind the scenes, a team of AI helpers (agents) checks every claim and throws out tricky "free" offers that hide a paid membership.

Behind the scenes, every helper looks things up through Zetaris — one door that combines the family's private data, our rule lists and live government recall feeds in a single question, without copying any of it.

**Done:** the whole app works and passes its tests. It runs on made-up families, with saved answers standing in for the AI, so it needs no keys.

**What changes:**
1. Two screens. Parents get the simple page plus one short "We checked this" line per card and a "We caught these for you" list. A separate "Behind the scenes" screen, opened with a reviewer code, shows the agents debating, the data sources, the learned rules and the scoreboard.
2. Real AI switches on (NVIDIA key arrived). We rerun the scoreboard and the learning demo with it and say plainly what was real.
3. "Connect a card" works for real using Plaid's practice mode (fake bank data, demo families only).

**Left for you:** record the video Monday; make the repo public and submit Tuesday.

**Timeline:** Sat split the screens; Sun real AI and card connection, then rerun the evidence; Mon video and slides; Tue final test and submit.

---

## 2. What the parent sees vs. what the owner sees

| | Parent view (simple, calm) | Owner view ("Behind the scenes") |
|---|---|---|
| Headline | The Receipt: money back, benefits you likely qualify for, deadlines, items safety-checked | Same Receipt, plus the scoreboard (traps caught, before vs. after learning) |
| Cards | Title, amount, source links, a short "We checked this" line | Same cards, plus the Zetaris data sources used for each |
| Rejected items | "We caught these for you": plain-language list of offers and claims we stopped | Fine Print Court debate (Deal Hunter vs. Fine Print Lawyer, then the Judge) and Fact-Checker send-backs, in full |
| Learning | Parents tap "I got this" / "Report issue" | Meterless memory and case law, with the Approve button; proposed vs. approved rules |
| Proof | Nothing technical | Full trace of every agent step |
| Access | Anyone (guest) | Reviewer code only (the existing reviewer token), shown to judges in the demo |

## 3. Where Zetaris does the work

| Helper | The question it asks Zetaris | What gets combined | Where you see it |
|---|---|---|---|
| Recall Checker | Which of this family's purchases are on a recall list? | Private orders/card purchases (Neon) + live CPSC and FDA recall feeds | Recall card; "We checked 7 items" |
| Clawback Hunter | Which purchases are FSA-eligible or dropped in price within the store's window? | Card transactions + FSA-eligible list + store policies + price checks | "Money back" cards and the Receipt total |
| Benefits Planner | Which programs does this family likely qualify for, by when? | Family profile + benefit rules + official poverty-limit table | Benefit/deadline cards |
| Fact-Checker | Is this exact dollar amount/date right? (asks a separate question) | Re-reads the source row | Blocks or sends back wrong cards |
| Privacy views | — | Each helper gets its own filtered view (the deal Judge never sees income) | Owner view: "Data sources" per card |
| Plaid "Connect a card" (new) | Same questions, on the newly connected fake-bank purchases | Plaid transactions copied into Neon, then joined by Zetaris | Cards appear for the connected card |

Remove Zetaris and the app can't produce a single personal card.

## 4. Technical plan (for the CTO)

Starting point: repo `bundle/`, 264 tests passing, `SAMPLE_MODE=true` is always offline by design (verified), Zetaris Neon x CPSC join working, reviewer token already gates Approve.

**1. Owner view split**
- Goal: parent view shows only Receipt, cards, a one-line "We checked this" per card, and "We caught these for you". Everything agent-internal moves behind an owner entry point.
- Key areas: `client/` (card detail, "Bundle got smarter" screen, new owner route), run/trace API in `server/` (a parent-safe response shape vs. the full one), reviewer-token check (`x-reviewer-token`). "We checked this" and "We caught these" are built from fields the Fact-Checker and Court already record.
- Done when: with no token, the API and UI never expose debate text, data-source names, memory rules, traces or Approve; with the token, all of those appear and Approve still works; a test asserts the parent payload has none of those fields; the learning loop (report twice, approve, run again, offer blocked) still passes end to end.
- Risk: leaks through the API (hiding in the UI is not enough); the parent payload must be trimmed on the server. Medium effort; mostly moving existing screens.

**2. NVIDIA live run and honest labeling**
- Goal: real model text for the court debate, explanations and Coach rules; scoreboard and learning demo rerun with it.
- Key areas: `model:check -- --write`, then `eval:live-model`, then `examples:regen` (all documented in the README); `server/adapters/llm.ts`; README sections 6, 8, 11, 13 and the `metadata.json`/slides wording.
- Done when: `llmMode` in the scoreboard reads `nvidia:<model ids>`; the new run-1 and run-2 learning traces are saved; every README/slide line that says "offline", "supported, not exercised" or "no real model" is updated to match what was actually run. Two modes are labeled separately: saved offline replay (no keys, judges' default) and the real-model run (replayed Zetaris answers, live NVIDIA).
- Risk: the real model may not approve the trap offer in run 1 (then show a saved real run 1 next to run 2, and say so); score may be lower than the offline 6 of 6, and we report what it is, not 6 of 6 by default; NVIDIA spending alert should be on.

**3. Plaid Link sandbox flow**
- Goal: the "Connect a card" tile opens Plaid Link (Plaid's pop-up), the parent picks Plaid's test bank, and the fake transactions flow into Bundle.
- Key areas: new server routes for Plaid's link-token and token-exchange steps (removed earlier; to be re-added), existing `mapPlaidTxn` and fixtures, the Neon `transactions` table (so Zetaris can join them), the connect tile in `client/`.
- Where data lands: Plaid sandbox, then our server, then `mapPlaidTxn`, then rows in Neon under a demo family id, then Zetaris reads Neon as before. Zetaris cannot do Plaid's sign-in step itself, which is why we copy into Neon first.
- Done when: clicking Connect on a guest/demo family completes Plaid Link with sandbox credentials, rows appear in Neon, a local run (not sample replay) produces cards that use them, and Plaid secrets live only in the git-ignored env file and `.env.example` holds placeholders. Only guest/demo families can connect; typed-in families stay unsaved.
- Risk: `SAMPLE_MODE` is always offline, so this and the real-model run need a separate local live mode (SAMPLE_MODE off, local only); the saved Zetaris answers won't cover new transactions, so live Zetaris runs apply (intermittent Thrift errors, 13s to 171s); Plaid's sandbox data is generic, so it may yield few baby-specific clawbacks, and the demo should say so. The saved-replay path must keep working as the judges' default and as the video backup.

**4. Regenerate evidence**
- Goal: scoreboard, saved example runs and learning traces reflect the real model and the new views.
- Key areas: `npm run eval`, `eval:live-model`, `examples:regen`, `output_examples/`, `logs/sample/`, `logs/scoreboard.json`, README section 8.
- Done when: committed files match the README numbers; the full test suite is green; a clean clone with no keys still runs the sample.
- Risk: README claims drifting from the saved files; check by diffing after regeneration.

**5. Deck and video updates**
- Goal: slides and Monday video show both views, the real AI, and Plaid.
- Key areas: slides; video script (parent view first, then "Behind the scenes" for the agents, sponsor tech and scoreboard); update maya's money back to $48.99 (older deck draft says $46.99).
- Done when: video is 1 to 4 minutes, shows no keys or real data, names Track 1, and every number on screen matches the saved run; slides have the 8 required points and disclose "Built with Claude Code".
- Risk: Zetaris live slowness during recording (record from the saved-replay run or the real-model run with replayed answers).

## 5. Timeline

| Day | What happens | Done when |
|---|---|---|
| Sat Oct 24 | Item 1: owner view split. Start item 3: Plaid routes and Link tile | Parent view clean, owner view complete behind the token, tests green |
| Sun Oct 25 | Item 2: NVIDIA check, live eval, learning rerun. Finish item 3. Item 4: regenerate evidence, update README | Scoreboard and traces saved with the real model; Connect a card works locally; README matches files |
| Mon Oct 26 | Item 5: slides and **record video** (Lyndsay). Clean-setup rehearsal | Video and slides final; fresh-clone test passes |
| Tue Oct 27 | Final fresh-download test; **make repo public** and **submit** (Lyndsay), target 5pm Boston | Submitted before 23:45 UTC |

If behind, cut in this order: Plaid (fall back to the fixture data, README already says so) before the owner view; never cut the owner view, the real-model rerun or the learning demo.

## 6. Not changing / out of scope

- Agents, Fact-Checker send-backs, Fine Print Court, the never-empty feed, the Receipt split, the learning loop, Zetaris joins, Meterless memory, trace logs, `POST /api/run`, `SAMPLE_MODE`.
- Guest only: no sign-in. Firebase stays unused.
- Paid hosting: none. Test locally only; `render.yaml` stays for later.
- No new features. The Amazon upload stays a coming-soon tile.
- No real bank connections or real personal data. Plaid is sandbox only, demo families only.
- Zetaris data-quality rules stay deferred; the Fact-Checker's "no source" rule remains the backstop.

## 7. Keys and access status

| Service | Status |
|---|---|
| Zetaris | Ready (cluster active; Neon and live recall feeds connected) |
| Neon | Ready |
| NVIDIA | Ready (key available; run `model:check` first) |
| Plaid sandbox | Ready (keys available; sandbox only) |
| Render | Deferred; local testing only |
| Firebase | Unused for the hackathon |

Keys go only in the git-ignored env file; never in the repo, slides or video.

# Bundle submission deck (Oct 27 2026, 8 slides)

**Open it:** `bundle-deck.pdf` (8 slides, 16:9). Slide images: `slides/`. Source: `bundle-deck.html`; re-make the PDF and images with `./render.sh`.
Follows section 7 of `hackathon-resources/strong-submission-examples.md`, one slide per item (the number is in each slide's top-right corner):
1 Problem and users · 2 Solution · 3 Agent workflow (architecture diagram with Zetaris, Meterless and NVIDIA logos) · 4 Technical stack · 5 Sponsor technology · 6 What was unique (photo to data, growing family memory, agent collaboration, graded-deals API) · 7 Product visuals · 8 Future.
Logos in `img/logos/` come from each sponsor's own website. App screenshots `img/v3-*.jpg` were taken Oct 27 from the app in practice mode (made-up family Maya).
The earlier 15-slide version is in `old-versions/bundle-deck-2026-10-26.*`.

## Earlier notes (15-slide deck, kept for history)
## What's in the deck
| # | Slide | Covers (hackathon §12) |
|---|---|---|
| 1 | Bundle. Your first 100 days, checked. (Track 1 badge, Receipt phone) | Title, track, product visual |
| 2 | New parents leave money and safety on the table (sourced stats + 2026 rule changes) | Problem |
| 3 | What Maya's family is owed is scattered across five places | Target user, why it's Track 1 |
| 4 | One screen. Everything she's owed. (Onboarding → Receipt → Feed) | Solution, product visuals |
| 5 | Five kinds of cards. Every one shows its work. (+ never-empty promise) | Product visuals |
| 6 | Architecture diagram: agents ↔ Zetaris ↔ Meterless, send-back loop, Fine Print Court | Agent workflow |
| 7 | Nothing reaches a parent until it survives the court ("How we checked" view) | Agent collaboration |
| 8 | Zetaris: one SQL question across private and public data (real Spike 0 result) | How Zetaris was used |
| 9 | Meterless: Run 2 is smarter than run 1 (case law, trace excerpt) | How Meterless was used |
| 10 | Take either one away and Bundle stops working | What was unique about sponsor tech |
| 11 | Built to be checked (stack, 3 test families, 6 traps, fail-safes) | Technical stack |
| 12 | Next: from "found" to "done." | Future enhancements |

## Final judge scores (round 3, self-review panel)
Impact & Demo **40/45** · Technical & Innovation **31/35** · Sponsor Tech & UX **18/20** · **Total 89/100**. All §12 items covered. Round-by-round notes: `feedback-round-1.md`, `-2.md`, `-3.md`. Design rules: `design-system.md`. Slide plan + speaker notes: `outline.md`.

## What changed (Oct 23, real-app update)
- Slides 1, 4, 5, 7 now use real app screenshots (copied into `img/`, from `bundle/docs/screens/`) inside the same phone frame. "Design preview" labels are gone. The mock-data "smarter" screenshot is not used.
- Real Receipt: **$48.99 money back, $3,640 likely benefits, 3 deadlines, 7 items safety-checked, 1 recall**. (The old $46.99 / 4 deadlines / 5 items were hand-worked guesses.)
- Slides 7 and 9 use real lines from `output_examples/learning/` (run 1 Judge approves; reviewer rule stored as `mem-1`, confidence 0.8; run 2 Judge blocked, cites `mem-1`). No income values shown.
- Slide 11 shows the real scoreboard: 6/6 traps, 0 false alarms, 100% of cards sourced, learning run 1 approved then run 2 blocked citing `mem-1`.
- Honesty notes on slides 7, 9, 10, 11: saved runs used offline fallbacks (`llmMode: offline-fallback`, Scout `fake-llm`); NVIDIA Nemotron-hosted models are supported but not yet exercised in saved results. Slide 6/11 wording changed from "powered by Nemotron" to "supported".
- No Cursor mention anywhere; tooling is stated as "Built with Claude Code" (slides 1, 11).
- Still 12 slides, same design system, all section 12 items covered.

## Remaining updates (after a real NVIDIA model run exists)
1. Re-run `npm run eval` with a model key; update the slide 11 scoreboard, drop the "offline" notes on slides 7, 9, 10, 11, and name the exact Nemotron models used.
2. Re-capture the "How we checked" screenshot (slide 7) so the Deal Hunter / Lawyer / Judge steps show real AI text instead of "Backup used", and capture the populated "Bundle got smarter" screen from a real run for slide 9.
3. Slide 5 phone shows the daycare and recall cards; swap if you prefer a different crop of `04-feed-full.png`.
4. Zetaris slide (8): add openFDA/NHTSA if the final build uses more live sources; refresh timing.
5. Hosting: add the live demo link to slide 12 once chosen.
6. Check facts again: Trump Account deposit status (slide 2 pill) and the 30-day insurance window (both flagged "check" in the research book). Slide 8's recall number (#26191) is from Spike 0; the app trace calls it cpsc-10560 (internal ID).

# Feedback — Round 1 (first full render, 12 slides)

## Render bugs found by looking at the PNGs
- **Slides 1 and 12 lost their dark background.** The `.night` class was weaker than `section.slide`, so cream won and the white headline text vanished. (Root cause: CSS specificity. Fix: `section.slide.night`.)
- **Slide 3:** the center persona card is too tall; "Baby Maya, day 20" wraps and the card collides with the CPSC card and the footer.
- **Slide 4:** the three phones overflow the right edge; the feed phone is clipped.
- **Slide 6:** the orchestrator arrow runs through the "send back" label; the Court→Zetaris diagonal touches the "Judge cites past rulings" tag.
- **Slide 8:** stat numbers and labels don't share a baseline; looks unaligned.

## Judge A — Impact & Demo (45 pts): **33 / 45**
Strong: the problem slide has real, sourced numbers; Maya gives a face; the split Receipt is a memorable, screenshot-able moment.
Weak: the title slide is unreadable (bug). The "useful even with no data" promise (the answer to "would parents link a bank?") is only said once in small text. The fragmentation slide is visually broken, which hurts the Track 1 argument.
Top 3 fixes:
1. Fix the dark title/close slides.
2. Rebuild slide 3 so the "five scattered sources → one family" picture reads in 2 seconds.
3. Make the never-empty guarantee visible on the product slide.

## Judge B — Technical & Innovation (35 pts): **27 / 35**
Strong: critique (Court), validation + retry (Fact-Checker, max 2), shared memory (H-MEM) and fail-closed behavior are all named; real Zetaris proof with numbers.
Weak: the architecture diagram has collisions, so the loops are hard to follow. Branching isn't obvious (what changes for an unborn baby or a family with no data?). Human escalation (reviewer approval) is only in small text.
Top 3 fixes:
1. Clean the diagram: no lines through labels.
2. Show branching explicitly (no data / unborn / out-of-state).
3. Name human-in-the-loop escalation on the diagram.

## Judge C — Sponsor Tech & UX (20 pts): **15 / 20**
Strong: Zetaris SQL + real result is the best slide; "take either away and Bundle stops working" is exactly the bar. Mockups look like a real app.
Weak: governance (per-agent views) is asserted, not shown. Slide 4's clipped phone hurts UX credibility.
Top 3 fixes:
1. Show a concrete governed view (what the Judge can and can't see).
2. Fit the three phones on slide 4.
3. Align slide 8 stats.

**Total: 75 / 100.** Below the 85% bar for every judge (A 73%, B 77%, C 75%).

## §12 checklist
| Requirement | Status |
|---|---|
| Problem and target users | ✅ slides 2–3 (slide 3 needs layout fix) |
| The solution | ✅ slide 4 |
| Agent workflow / architecture | ✅ slides 6–7 |
| Technical stack | ✅ slide 11 |
| How Zetaris and Meterless were used | ✅ slides 8–9 |
| What was unique about sponsor tech | ✅ slide 10 |
| Product visuals | ✅ slides 1, 4, 5, 7 |
| Future enhancements | ✅ slide 12 |
| Track named | ✅ slides 1, 3 |
| NVIDIA Nemotron named as model provider | ✅ slides 1, 6, 10, 11 |
| Cursor not featured | ✅ |
| No secrets / real personal data | ✅ (no hostnames, keys; families fake) |

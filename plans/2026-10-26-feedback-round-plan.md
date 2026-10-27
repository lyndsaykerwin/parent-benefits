# Plan: Oct 26 feedback round

**Deadline:** submission due Oct 27, 23:45 UTC (7:45 pm Boston time tomorrow).
**How it runs:** helpers ("subagents") build each lane in parallel. Lanes never touch the same files. I check every lane's work before it counts as done.
**Research behind this plan** (all in `progress/reviews/`): comments-code-map, judging-regrade, outside-testing-options, deck-gap-review (all dated 2026-10-26).

---

## Where we stand vs. the judges
Today's score is roughly **60/100**, or about 66 once the video exists. Fixing everything below gets about **79**. The repo going public is left out on purpose, since you'll handle it.

| Rule | Now | Biggest lift |
|---|---|---|
| Impact (30) | 20 | Links that work, accurate fine print, all 50 states working |
| Technical (20) | 13 | Saved proof of the real AI doing the work |
| Innovation (15) | 10 | Photo → organized data, the fine-print database offered as a service ("API") |
| Demo (15) | 4 | **The video isn't recorded yet**, and it's required |
| Product & UX (10) | 7 | Your comments below |
| Sponsor tools (10) | 6 | A saved run through Meterless's AI gateway (Nightshift) |

---

## Lane A: Screens and wording (your comments)
1. **Plan auto-saves.** It already saves itself. Swap the "Add a name / Save" card for one line: "✓ Your plan is saved."
2. **Trump Account moves to the existing Savings tab** (off Taxes), and the Massachusetts 529 college-savings card moves there too. Steps spelled out: get your baby's Social Security number, then file IRS Form 4547. $1,000 from the government for babies born 2025–2028 (IRS source checked).
3. **Child Tax Credit wording.** Both numbers are right but unexplained. New wording: "Lowers your taxes by up to $2,200; up to $1,700 of that can come back as a refund even if you owe nothing."
4. **"Fine Print Court" becomes "Fine Print"** everywhere parents see it (about 14 places).
5. **"How we checked"** stays only on deals, money-back and recall cards. Benefits get a plain "Source" link instead.
6. **Account page in plain language.** Removes "Saved in Meterless memory" and other technical words. Technical details show only with the judges' reviewer code.
7. **"Email it to myself" button.** On a computer it opened the share menu and failed silently. It will open your email instead, and show "Opening your email…".
8. **"All checked" flicker.** While checking, the screen shows only the checklist, then goes straight to "We found $X for your family."

## Lane B: Fine print accuracy and links
1. **Blocking rule (your decision below).** Proposed: block only when the catch costs more than the offer is worth, or it turns into a paid subscription that needs a card. Everything else shows as "OK, with a catch."
2. **Fix false catches.** "Mobile phone" counted as "needs a phone call", any old date counted as expired, and ordinary shipping wording blocked offers. Babylist's box was blocked over a known $8.95 shipping fee.
3. **Real, live links.** Eight links are broken or wrong: Pampers, Target trade-in, buybuy BABY, Honest, Costco, the Target registry (opens a jewelry-box page), two Amazon links and Babylist. Every link gets checked with a live page load.
4. **Registry fine print made clear and correct.** For example, Walmart's welcome box needs over $25 in registry purchases, and $300 is a separate tier with a free home cleaning. I'll also remove the made-up "in-store pickup only" line.
5. **The offer-grades table (the Fine-Print Database) fills in properly.** It will save the offer's dollar value and which AI graded it, and show the right time (the 4-hour time-zone mix-up). The database change is done by hand, never with the command that breaks Neon.

## Lane C: Photo recall check
1. **Example photos.** Two made-up example labels, a car seat and a stroller, shown while you take the photo. Each points to exactly what's needed: model number, plus the manufacture date or lot number.
2. **The reader captures those fields.** Today it doesn't read the manufacture date or lot number, which recalls need.
3. **"Thanks, we're processing."** The photo is saved right away and read in the background. The Gear Locker shows "Reading…" and then a notice when it's done. Right now it gives up when NVIDIA is busy; it will keep trying for a few minutes instead of 10 seconds.

## Lane D: Outside testers on their phones
1. **Recommendation: Render, always-on plan, about $7 a month** (charged by the day, so a week is about $2). Gives a normal https link that works on any phone with no app to install. The free plan sleeps and takes a minute to wake, which is bad for judges.
2. **I add:** a tester entry code (so strangers can't use up the free AI allowance), a "use made-up details only" notice, and a fix to the broken Render setup file. Then I give you click-by-click setup steps.
3. **You do (about 15 min, from a laptop):** you already have a Render account. Let it see the repo, and paste in the keys from the list I give you. Then I test the live link at phone size.
4. **Limits to know:** real mode online uses NVIDIA directly, because Meterless's AI gateway only runs on your Mac. NVIDIA slows down if many people test at once. Meterless memory starts fresh online.

## Lane E: Judging gaps you didn't list
1. **Practice mode for all 50 states.** Today it only works for CA, FL, MA, NY and OH; Texas or Illinois families get "$0". Judges will try their own state.
2. **Saved proof the real AI works.** One recorded run through Nightshift (Meterless's AI gateway) → NVIDIA, saved as a scoreboard and trace. **Needs the Nightshift app open on your Mac.**
3. **README and metadata.json updated** to match today's app. metadata.json still has 4 "REPLACE-ME" links.
4. **Final check for keys** in the code before you make the repo public.

## Lane F: Presentation and demo video
1. **Deck rebuilt to 13–15 slides,** each tied to a judging rule. Adds:
   - **Photo → organized data** (headline slide): a before/after of a photo going in and a table of fields coming out, then what it powers (recall check, money-back check, Gear Locker).
   - **The agent system:** a map of which agents exist and what each does.
   - **How agents talk and check each other:** shared notes, deals argued and rebutted, the fact-checker sending work back.
   - **Feedback loop 1 (inside the agents):** rulings become rules that change future grading.
   - **Feedback loop 2 (aggregated data):** every graded offer lands in the Fine-Print Database (no family info). The app reuses it, and it's already offered to other apps through a public "offer audit" service with a written spec.
   - Other creative ways data gets in: pasting a deal into Audit-a-deal, and receipts.
2. **Removes old or false claims:** placeholder "[Stat]" text, bank card/Amazon/Plaid shown as sources (no agent reads them now), "agents argue over every claim" (only deals), old numbers.
4. Screenshots are taken last, after lanes A–C land.

---

## Order
- **Now, in parallel:** lanes A, B, C, D (my part), E1, E3 and F1 (slide content).
- **When you're home:** E2 (open Nightshift), D3 (Render clicks). No video work today (your call).
- **Last:** all tests, a click-through in real mode on the live phone link, deck screenshots, key scan, then save to GitHub.

## Decisions (settled Oct 26)
1. Fine-print blocking rule: block only when the catch costs more than the offer is worth, or it turns into a paid subscription needing a card. Everything else: "OK, with a catch".
2. Render: Lyndsay already has an account; always-on plan (~$7/mo).
3. Trump Account + MA 529 go in the existing Savings tab.
4. No video work today.
5. Top priority: the fine print and the photo reader must actually work. They lost the most points, so lanes B and C get the most effort, with live checks against the real AI.

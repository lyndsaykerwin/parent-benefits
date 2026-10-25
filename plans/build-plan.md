# Bundle: the build plan (explained like you're 12)

> **Oct 23: SUPERSEDED.** The current plan is [bundle-plan-executive-summary.md](bundle-plan-executive-summary.md) (product) and [docs/superpowers/plans/2026-10-23-bundle-mvp.md](../docs/superpowers/plans/2026-10-23-bundle-mvp.md) (engineering). Note: Oct 27, 2026 is a **Tuesday**; the "Mon Oct 27" below is wrong.
>
> **Oct 22 night update:** open decisions and missing basics are in [plans/plan-gaps.md](plan-gaps.md); every hackathon requirement is in [hackathon-resources/hackathon-checklist.md](../hackathon-resources/hackathon-checklist.md). Zetaris now runs on **AWS** (not Docker on the Mac): see [setup/zetaris-aws-setup-notes.md](../setup/zetaris-aws-setup-notes.md). Cursor is now optional. **Decided Oct 22:** Bundle is a phone-friendly website built on Colin Matthews' template (Firebase sign-in, Neon database instead of Supabase, Stripe ready), with real accounts and a parent/admin role. A frozen copy of this plan as of tonight is in [plans/old-versions/](old-versions/build-plan-2026-10-22-v1.md).

Updated Oct 21, 2026, after a feasibility check of every piece. Build Oct 22–27; due **Oct 27, 7:45pm Boston time** (23:45 UTC).

## What we're building, in one breath
Bundle is an app for new parents. A team of AI helpers ("agents") reads benefit and deal pages, checks every fact against official government numbers, asks "is this actually worth a tired parent's time?", and hands a family a short list of what to claim first. When parents say "this was a dud," the app learns a new rule and makes a better decision next time. A scoreboard proves it got better.

We enter **Track 1: Solving Fragmented Intelligence** ("fragmented" means the information is scattered across many places that don't talk to each other).

## How the judges score (100 points), and how we win each part
| Category | Points | Our move |
|---|---|---|
| Impact | 30 | Real user (new parents), real money (~$9,210 in year one for a Boston family), real cost of mistakes |
| Technical | 20 | Agents that check each other and send work back. It runs from a fresh download. Failures are handled |
| Innovation | 15 | A "parent panel" that judges value, plus learning from real parent reports |
| Demo | 15 | Show the app catching a wrong number, then getting smarter between run 1 and run 2 |
| Product and UX | 10 | A calm, friendly app with a "do these first" list |
| Sponsor tech | 10 | Zetaris, Meterless, NVIDIA and Cursor each do a real job |

## The pieces, and what each one does

**Think of the app as a newsroom.** Reporters go out and bring back stories. A fact-checker checks them against the official record. An editors' panel decides if each story is worth printing. A front desk hands readers what's relevant to them. And a coach reads the complaints and writes new rules for next time.

### The 5 agents (the newsroom staff)
"Agent" = a small program that asks an AI model to do one specific job, with rules about what it may do.

1. **Scout (reporter).** Reads 15 saved copies of real offer pages (government benefits + store deals) and fills in a form for each one: amount, who qualifies, deadline, true cost, any strings attached, source link. We use *saved* copies so the demo never breaks because a website changed.
2. **Fact-Checker (the heart of the app).** For each offer, it first looks at Zetaris's list of connected sources (its "catalog") and **decides which ones apply**: a crib deal → safety recalls; formula → FDA recalls; a benefit → income limits. Then it asks Zetaris one question across those sources. If something's wrong ("Scout says the income limit is $52,000; the official chart says $49,000", or "this crib mattress was recalled Aug 6, 2026"), it **sends the work back** to the Scout or **blocks** the offer, at most 2 retries. Judges reward this "send it back" loop most.
3. **Parent Panel (editors).** One AI call imagines 3 different families (a single mom in Ohio on WIC, a two-income couple in California, a NICU family in Boston) and scores every offer on 4 checks: Is it really free? Any hidden strings? How long does it take to claim? Does it fit the baby's age? A rule in the code lets the panel **veto** (block) bad offers.
4. **Matcher (front desk).** One question to Zetaris joins a family's ZIP code, income and due date with the approved offers, and returns a ranked "do these first" list with dollar amounts.
5. **Coach (the learner).** Reads parent reports ("I got this" / "Report issue"), proposes a new rule ("'free' with over $5 shipping is not free"), and saves it in Meterless memory with **where it came from** and **how sure it is**. You click one button to approve it. Next run, the Parent Panel uses the rule.

A plain-code **Coordinator** runs the agents in order, keeps the shared notes, and writes every step to a **trace log**: a diary with one line per action (who did what, how confident it was, whether it retried). Judges read these logs.

### The sponsor tools (each has a real job)
- **Zetaris = the live safety and eligibility check across many agencies.** The facts a parent needs are scattered across agencies that each publish in their own format and update on their own schedule. Zetaris connects them **without copying them**, so a recall posted this morning is caught this afternoon. Sources (the four government feeds below were tested and working Oct 22):
  - **Supabase** (our online database: offers, test families, parent reports). Connect through its "session pooler" address (port 5432) with encryption on.
  - **HHS poverty guidelines** (the federal health department's official income cutoffs, which decide who qualifies for WIC, Medicaid and more; $27,320 for a family of 3 in 2026).
  - **CPSC recalls** (the Consumer Product Safety Commission: recalled cribs, strollers, play yards, high chairs). Check on Day 1 that Zetaris accepts its data format; if not, use the FDA feed's format as the pattern.
  - **openFDA recalls** (the FDA's public data: infant formula and baby food recalls).
  - **Why it's essential:**
    - Agents ask one question across all of these.
    - Agents *discover* which sources exist from Zetaris's catalog, instead of having them written into the code.
    - Adding a new source later (say, car seat recalls) is one setup command, and the agents find it on their own, with no new code.
    - Remove Zetaris and the app can no longer check safety or eligibility, so it really is load-bearing.
  - **Stretch goal (privacy):** Zetaris's access rules (GRANT … ON VIEW) give each agent its own view. The Scout and Parent Panel never see a family's income; only the Matcher's view does.
- **NVIDIA = the brains.** Its Nemotron AI models do the reading, checking and judging, through NVIDIA's API (a web address our code sends questions to). We save answers while testing so we don't burn credits.
- **Meterless = memory (and a little routing).**
  - **H-MEM** is Meterless's memory engine. It stores each learned rule with its source and a confidence score, and it never deletes old rules, only marks them "replaced." We **copy in Meterless's ready-made code** rather than building it, which saves about a day.
  - **The Runtime** is Meterless's "switchboard" for AI calls. On a Mac it can only run small models, so we send one light job (sorting or tidying text) through it. We'll ask on Meterless's help channel on Day 1.
- **Cursor = the workshop.** The AI coding tool where all code gets written. Keep a running note of how you used it (required in the submission).

## How we prove it's reliable ("evals")
An **eval** is a test with an answer key, like grading the app's homework.
- **Answer key:** 15 offers where we've written down the right answer ahead of time, including **6 planted traps**: fake "free" with shipping, a wrong income limit, an expired deal, a sneaky subscription, one that doesn't fit the baby's age, and **a discounted product that's on a real recall list**.
- **What we measure:**
  - **Accuracy:** did the Scout fill in the facts correctly?
  - **Trap catch rate:** how many of the 5 traps got caught?
  - **False alarms:** good offers wrongly blocked.
  - **Right list:** does each test family get the correct offers?
  - **Sources:** % of claims with a source link.
  - **Steadiness:** same results across 3 repeat runs?
- **The killer chart:** the scoreboard **before vs. after learning**. In run 1 the app approves the shipping trap. After 8 parent reports and one approved rule, run 2 catches it.
- One command runs everything and prints the scoreboard. It goes in the README, the demo and the app's "Bundle got smarter" screen.

## What we build vs. "coming soon"
**Build (3 screens):**
1. **Pick a family:** choose one of the test families, or enter ZIP code, due date and income.
2. **Your list:** "do these first" with dollar amounts and deadlines. Tap any offer to see "how we checked" plus the "I got this" and "Report issue" buttons.
3. **Bundle got smarter:** learned rules, fixes and the eval scoreboard.

**Coming soon** (shown as labels in the app, not built): Ask Bundle chat, map of nearby deals, fill-forms-for-me, points and leaderboard, all 50 states, live web reading, notifications, and Meterless's safety engine (Scout Intent), which comes as a written blueprint only and would take 8–12 hours to build.

## The 6 days
The rule: **a complete, rough version of the whole app by end of Day 2 (Thu Oct 23), then improve it**, with the scoreboard deciding what to improve next. "Complete" means every agent, every screen and the scoreboard exist and work end to end, even if they're basic. This works only if Zetaris setup goes smoothly today. If it doesn't, build the agents against saved copies of the feeds' answers while Zetaris installs, then swap Zetaris in.

| Day | Goal | Done when… |
|---|---|---|
| **Wed Oct 22** | Every tool turns on, plus a skeleton | 1. Confirm you're registered (deadline tonight 7:45pm Boston). 2. NVIDIA key + one test call. 3. Install Docker, start the Zetaris download. 4. Meterless Mac app + post your Mac question. 5. Zetaris: sample query, connect Supabase, add the poverty + FDA + CPSC feeds, run **one question across them**. 6. Meterless starter: memory tests pass. 7. Skeleton: one offer goes through one agent, one Zetaris question, one trace line. **If Zetaris isn't working ~5 hours in, switch to AWS.** |
| **Thu Oct 23** | **Version 1, finished and rough** | All 5 agents in simple form. Send-back loop works. 15-offer answer key. 3 rough screens. First scoreboard. Coach saves one rule to memory |
| **Fri Oct 24** | Improve: accuracy | Fix whatever the scoreboard says is weakest. Recall trap and income-limit trap reliably caught |
| **Sat Oct 25** | Improve: the smart part | Parent Panel sharper. Before/after learning run is convincing. Approve button |
| **Sun Oct 26** | Improve: the look + stretch | Screens in Bundle's design. "Coming soon" labels. Run full eval 3 times. Stretch: per-agent privacy views |
| **Mon Oct 27** | Ship it | README, `metadata.json` (required file listing which sponsor tools you used and where), architecture diagram, 1–4 min demo video, slides, test from a fresh download. **Submit by 5pm** |

## If we fall behind, cut in this order
1. The approve button (the Coach saves rules automatically, and the log says so).
2. The Meterless Runtime routing (keep H-MEM, which is the part that really matters).
3. Screen 1 (start straight from a pre-picked test family).
4. Go from 15 offers down to 10.
Never cut: the Fact-Checker send-back loop, Zetaris joining the live government feeds, the recall check, the trace log, the before/after scoreboard.

## Honest numbers
- The full wish list was about 95–100 hours of work. You have about 48. This plan is about 48–52, so it's tight.
- If built well: about **80–88 / 100.** The biggest risk is Zetaris setup on Day 1, which is why it goes first.

# Bundle's new onboarding flow: goals, principles and where everything is

Decided in the Oct 23–24, 2026 design session with Lyndsay. This is the "new onboarding flow." No app code has been changed yet.

## Where everything is
| What | Where |
|---|---|
| Clickable mockups (15 phone screens) | Live canvas: https://claude.ai/artifact/7cbiAkSomHVnmTujuSv6uo (private: share it from the page's Share menu before others can open it) |
| Mockup source files | `onboarding-design/project/` (`canvas.json` maps how the screens connect) |
| Screen-by-screen build spec | `onboarding-spec.md` (project root): every screen, the data fields, the changes from today's `Onboarding.tsx`, privacy checks, open questions |
| Onboarding playbook (the principles, as a reusable skill) | `~/.claude/skills/app-onboarding/SKILL.md` |
| Visual polish rules | `~/.claude/skills/ui-ux-pro-max/` (navigation, touch, contrast, icons) |
| Inspiration for the tab bar | `military benefits screen inspo/` |

## The goal
In about 30 seconds, with no sign-up and no bank details, a new parent should think: *"Whoa, there's money and deadlines for my baby I didn't know about, and it's already been checked."*

It must work equally well for:
- **Expecting families:** free registry gifts now, money once baby arrives.
- **Families whose baby is already here:** deadlines to catch, money to claim, savings on what they've bought. This group is the bigger money-making opportunity for Bundle, so the app must never feel like it's only for expecting parents.

The audience is **middle-class families**. The biggest wins (the $1,000 baby account, federal and state child tax credits) don't depend on income, so **we never ask about income.**

## Principles (from Lyndsay's product playbook, inspired by Nikita Bier and Mark Pincus)
1. **3-second rule.** Value is clear in about 3 seconds, and the first "wow" comes in under 30. No splash screens, welcome slides or feature tours.
2. **A few quick questions build investment.** One tap-to-answer question per screen, with a progress bar that starts partly filled. Only the minimum needed for a true wow: stage (expecting or baby's here), exact date and ZIP. (A work question was dropped on Oct 24.)
3. **Value before any ask.** The payoff (big total plus "do these first") comes before sign-in, purchase data, reminders or sharing. **No bank information up front, ever.**
4. **Explain the benefit before asking.** Every ask says what's in it for the parent ("Get a heads-up 2 weeks before a deadline so you don't lose the money"), and every ask has a real "Not now."
5. **Bring someone in at the high point.** The share ask appears right after the first money check-off, worded simply: "Share this with a friend." It's always skippable, and it shares only a link, never the family's details.
6. **Gamified progress.** A progress bar during the questions, then a working checklist ("X of Y done", "$ claimed") with the first item already ticked.
7. **Careful tone.** Money, pregnancy and kids mean no pressure, no fake urgency, no contact syncing and no made-up stats. Trust messages come first.
8. **Trust is the product.** Every number comes from the real run, never typed into the screen. Every amount links to its official source. Deals with hidden catches are blocked, and we show that we blocked them.

## Decisions made in the session
- **Exact dates only.** Deadlines count from the exact birth date, so there are no "1–3 months" ranges.
- **No "Today" or "Yesterday" shortcuts.** Nobody downloads this the day they give birth.
- **Never fixed to Massachusetts.** The ZIP picks the state, and every state label, section and total comes from that state's programs. Massachusetts numbers in the mocks belong only to the sample family. Bundle's data currently has state programs only for Massachusetts.
- **Share wording:** "Share this with a friend", not "a friend who's expecting."
- **Purchase data and card connection** move to after the payoff ("Find money in what you've already bought"). Card connection stays "Coming soon."
- **Sign-in and reminders** stay clickable demo screens labeled "Demo: not built yet."
- **Version B (bottom tab bar: Home, Taxes, Savings, Insurance, Deals)** is an alternative layout for after onboarding. It's not yet decided whether parents land on the single list or the tabs. The suggestion: the single list first for the wow, then tabs on return visits.
- **Oct 24 decisions (see `gap-answers.md`):**
  - Federal benefits for everyone, plus "your state's programs coming soon" (Massachusetts still shows its programs). Every real ZIP is accepted.
  - **The work question is dropped**, so onboarding is 3 questions. The Dependent Care FSA becomes a "Check with your job" card for everyone.
  - Accounts use Better Auth on Neon with Google only, after browser-saved progress.
  - Bottom tabs stay as Home, Taxes, Savings, Insurance, Deals for now.
  - The mockups still show the work screen (screen 4) and need that update.
- **Big-number wording:** Lyndsay chose to keep "in cash and tax credits" for now. The trust fixes (say when and how the money arrives, add confidence labels and a "How we got this number" link) were proposed and set aside. See open question 3 in `onboarding-spec.md`.

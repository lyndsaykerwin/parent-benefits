# Bundle onboarding spec (new flow, from the Oct 23 design session)

Written Oct 24, 2026. This describes the new design so it can be built. No app code has been changed.

**Sources used:** the screen mockups in `onboarding-design/project/` (the map of how they connect is `canvas.json`, titled "Bundle Onboarding v2"), the design session transcript, the onboarding playbook at `~/.claude/skills/app-onboarding/SKILL.md`, today's sign-up screen `bundle/client/src/pages/Onboarding.tsx`, its screenshot `bundle/docs/screens/01-onboarding.png`, and the server code that receives the answers (`bundle/server/routes/bundleRoutes.ts`).

**Words used below**
- **Onboarding**: everything a new parent sees in their first minute, from opening the site to seeing their list.
- **Payoff**: the "whoa, this is for me" moment. Here, it's the dollar total and the "do these first" deadlines.
- **Field**: one piece of information the app stores, like ZIP code or due date.
- **Agent**: one of Bundle's AI helpers that does a specific job (finding benefits, checking recalls, reading fine print, fact-checking).
- **Zetaris**: the sponsor tool Bundle uses as a single "data door". Agents ask it questions in SQL (a standard language for asking a database questions) across many data sources at once.
- **Meterless**: the sponsor tool that gives Bundle memory (it remembers parent feedback) and safety checks.
- **Dependent Care FSA**: a work benefit that lets you pay for daycare with money before taxes are taken out. FSA stands for Flexible Spending Account. HSA is the similar Health Savings Account.
- **Pre-prompt**: Bundle's own friendly screen that explains a request *before* the phone or browser shows its official "Allow?" box.

---

## 1. Summary (5 lines)

1. The single long form is replaced by one quick question per screen: **Expecting or baby's here → exact date → ZIP → optional work-benefits question**, about 30 seconds, no sign-up and no bank details.
2. A short "Checking" screen narrates the real work the agents are doing, then the parent lands on their **payoff: a big dollar total plus deadlines**, tailored to "baby's here" (deadlines first) or "expecting" (free registry gifts first).
3. The list is a working checklist: ticking items raises "$ claimed", and the **first money tick triggers a "Share this with a friend" moment**.
4. Only *after* the payoff does Bundle ask for more: **find money in past purchases** (Amazon upload / card, card marked "Coming soon"), then **save your list + deadline reminders** (marked "Demo: not built yet").
5. A second layout ("Version B") splits the list into a **bottom tab bar: Home, Taxes, Savings, Insurance, Deals**. Which layout parents land on is still to be decided (see section 6).

---

## 2. Screen order

The design's goal sentence for parents: *"Whoa, there's $X in baby benefits near me that I didn't know about, and it's already been checked."* Tone setting from the playbook: **Careful** (money, pregnancy and kids, so no pressure tactics, no contact syncing, no fake urgency, and trust messages up front).

A progress bar runs through the question screens and starts about a quarter full, because people finish more often when they feel they've already begun. Screens 1 to 4 show "1 of 4", "2 of 4", "3 of 4" and "Last one".

### 1. Hook: "Where are you right now?" (`Main`)
- **Purpose:** explain the value in about 3 seconds and ask the first, easiest question on the same screen. No welcome slides.
- **Parent sees:** "Let's find what your family is **owed.**" / "Cash, credits and free stuff, checked for you. About 30 seconds. No sign-up." Two equal big buttons:
  - **We're expecting**: "Free registry boxes now, money once baby arrives"
  - **Baby's here**: "Deadlines to catch, money to claim, savings on what you buy"
  - Below: **Try a sample family** ("Made-up data. See a finished list in one tap.") and the promise "We never ask for bank details to get started. Bundle finds and prepares. You decide."
- **Parent enters:** one tap. It moves on by itself.
- **Field filled:** which stage the family is in (expecting or born). This decides whether the next screen asks for a due date or a birth date. It is *not* stored as its own field today: the server tells the two apart by whether it receives `dueDate` or `birthDate`.
- **Skippable?** No: it's needed for the result. "Try a sample family" is the shortcut past the whole flow (for judges and testers). It loads a made-up family.

### 2. Exact date (`Date`)
- **Purpose:** deadlines count from the exact day, so Bundle needs the real date.
- **Parent sees, "Baby's here" path:** "Congrats! What's your baby's birthday?" / "Some deadlines count from the day baby was born, so we need the exact date." A date picker. After picking, a live line confirms the age, for example "20 days old: some 30-day deadlines are still open." Then a **Next** button.
- **Parent sees, "Expecting" path:** "When's your baby due?" with a date picker. The note on the canvas says the doctor's due date is fine and Bundle updates it when the baby arrives. **This version of the screen was described in a note but never drawn.** In the clickable mockup, "We're expecting" goes to the birthday screen by mistake.
- **Decision from the session:** the earlier "Today" and "Yesterday" shortcut buttons were removed. Lyndsay's reasoning: nobody downloads this the day of or the day after giving birth. Quick-pick ranges ("1 to 3 months") were also replaced by an exact date, because deadlines need the exact day.
- **Field filled:** `birthDate` or `dueDate` (one or the other, never both).
- **Skippable?** No.

### 3. ZIP code (`Zip`)
- **Purpose:** every state has its own programs, and the ZIP tells Bundle which state applies.
- **Parent sees:** "Where do you live?" / "Every state has its own programs. Your ZIP code tells us which ones are yours." A ZIP box with a number keypad, pre-filled "from your location. You can change it." Once the ZIP is recognized, a confirmation line: "Found it: showing **[State]** programs plus federal ones." Button: **Looks right**.
- **Decision from the session:** nothing may be fixed to Massachusetts. The state label, sections and dollar totals all come from the state the ZIP points to. The Massachusetts numbers in the mockups belong only to the sample family.
- **Field filled:** `zip`. The server then works out `state` from the first 3 digits.
- **Skippable?** No.

### 4. Work benefits, optional (`Work`)
- **Purpose:** some money (paid leave, the Dependent Care FSA) comes through a job, not the government. This question can add hundreds of dollars.
- **Parent sees:** "Does your job, or your partner's, offer benefits?" / "Things like paid leave or a childcare account through work. It can add hundreds more." Three tap buttons: **Yes / No / Not sure**. A small "Why we ask" link opens: "Some money comes through your employer, not the government. We only use this to show those programs. We never contact your employer." And **Skip for now**.
- **Field filled:** whether the employer offers benefits. The closest field today is `dcfsaOffered` (does the employer offer a Dependent Care FSA), which the server currently always sets to "yes". The design asks a broader yes/no/not sure question instead of the employer's name (see section 4).
- **Skippable?** **Yes.**

### 5. Checking (`Checking`)
- **Purpose:** the result takes a few seconds, so Bundle shows the real steps the agents are taking. This builds anticipation and trust. The playbook forbids made-up steps.
- **Parent sees:** "Finding and fact-checking your money…" / "Every amount gets checked against an official source before you see it." A list of steps that tick off:
  - Matching [State] and federal programs
  - Checking deadlines from your baby's birth date
  - Checking 739 government safety recalls
  - Blocking deals with hidden catches
  - Footer: "Opens your list on its own in about 3 seconds"
- **Parent enters:** nothing.
- **Field filled:** none. This is when the answers are sent to the server and the agents run.
- **Skippable?** No. It ends by itself when the run finishes.

### 6. The payoff: your list (two versions, chosen by screen 1)

**6a. "Baby's here" list (`ListBabyHere`)**
- **Purpose:** the high point. Make it obvious the app is for parents who already have a baby, the group most likely to bring in money for Bundle.
- **Parent sees:** "Your family could get **$3,640** in cash and tax credits, plus $85 in free gifts", "2 deadlines in 10 days", "Every amount fact-checked". Then a working checklist with "X of Y done" and "$ claimed":
  - "See what you qualify for" is already ticked, so the parent feels they've started.
  - **Do these first · deadlines** (red, "10 days left"): add baby to health insurance (30 days from birth), start a Dependent Care FSA (same 30-day window).
  - **Money · federal:** open the baby's $1,000 starter account (a government deposit for babies born 2025 to 2028); claim the Child Tax Credit ($2,200).
  - **Money · [your state]** "(from your ZIP)": for the sample, the Massachusetts Child and Family Tax Credit ($440) and Paid Family and Medical Leave.
  - Link: "Find money in what you've already bought" (goes to screen 8). Button: **Save my list** (goes to screen 9).
- **All dollar amounts are examples from the sample family.** The real screen must show what Bundle actually calculates for that family. The project rule is never to hard-code results.

**6b. "Expecting" list (`ListExpecting`)**
- **Parent sees:** "Waiting for your family **$3,640** once baby arrives, plus $85 in free gifts you can get now."
  - **Free right now · registry gifts:** Amazon registry welcome box ($35, needs Prime and one registry item), Walmart welcome gift bag ($25), Babylist welcome box ($20, after 10 registry items, shipping may cost extra), "+ 2 more gifts and a 15% coupon".
  - **Once baby arrives · we'll remind you:** $1,000 starter account, federal Child Tax Credit, state tax credit, add baby to insurance (30-day deadline).
  - "Already buying baby gear? We'll watch it for recalls and price drops." Buttons: **Share with a friend**, **Save my list**.
- **Fields filled:** none. These screens read the results.
- **Skippable?** This is the destination. Everything after it is optional.

### 7. First check-off, then share (`Share`)
- **When it appears:** the first time the parent ticks a money item on the list (for example, opening the $1,000 account). On 6a it first appears as a small bar ("Nice, $X claimed! Know someone who'd want this? Share"), and that bar opens this screen.
- **Parent sees:** "You just claimed **$1,000**. Your baby's starter account is on its way. $2,640 more to go." / "**Share this with a friend**. Most parents don't know this money exists. We only share a link, never your list or details." A pre-written message: "Bundle found money and deadlines for our baby that I had no idea about. Takes 30 seconds: [link]". Buttons: **Share**, **Not now**.
- **Decision from the session:** Lyndsay asked for plain "Share this with a friend", not "friend who's expecting" or "your partner".
- **Field filled:** none. Only a link is shared.
- **Skippable?** **Yes** ("Not now"). Sharing is never required.

### 8. Find money in what you've already bought (`MoneyHook`)
- **Purpose:** the main way Bundle could make money, shown only after the payoff. In the plan it's aimed mainly at the "baby's here" path.
- **Parent sees:** "Baby gear adds up fast. Bundle checks your purchases for three kinds of money back":
  - pay yourself back tax-free from an FSA or HSA (thermometers, pumps and more)
  - price dropped after you bought (many stores refund the difference)
  - recalls on things you own (checked against government safety lists)
  - "Read-only. We can never move your money." Buttons: **Upload Amazon orders**, **Connect a card** (tagged "Coming soon"), **Not now**.
- **Field filled:** purchase history (an Amazon order file). Not built for real parents yet. Today, purchase data exists only for sample families.
- **Skippable?** **Yes.**

### 9. Save list + reminders (`Save`, labeled "Demo: not built yet")
- **Parent sees:** "Save your list so you don't lose it. $3,640 and 2 deadlines, kept in one place. One tap, no password." **Continue with Apple / Continue with Google**. Then a reminder pre-prompt: "Want a heads-up before deadlines? We'll remind you 2 weeks before each one, so you don't lose the money. Nothing else." **Remind me / Not now / Back to my list**.
- **Field filled:** an account and permission for reminders. Neither is built. Both must stay clearly marked as demo.
- **Skippable?** **Yes.**

**How 7, 8 and 9 connect:** the canvas numbers them 7 → 8 → 9, but they are not forced in that order. Each one opens from a button or moment on the list, and each one returns to the list. The design session described the flow as ending back on the list.

---

## 3. Main navigation after onboarding ("Version B" tabs)

This is an alternative to the single long list in 6a. It was inspired by the military benefits app Lyndsay showed (screenshots in `military benefits screen inspo/`). A bar floats at the bottom with 5 tabs, each with an icon and a label. The current tab is highlighted in coral. It follows the ui-ux-pro-max rules: at most 5 tabs, labels always shown, taps at least 44px, and the bar never covers content.

| Tab | What it shows (sample-family numbers) |
|---|---|
| **Home** | The big total ("Your family could get $3,640…"). Then **Do these first**: the two 10-day deadlines, each linking to its tab. Then four category tiles: Taxes $2,640 / 3 benefits, Savings $1,000 + money back, Insurance 2 to-dos due in 10 days, Deals $85 / 4 offers, 1 blocked. Then a trust card: "We blocked 1 deal with a hidden catch". |
| **Taxes** | "$2,640 off your taxes. Claimed when you file next spring." Federal Child Tax Credit ($2,200, "Likely eligible"), state Child and Family Tax Credit ($440), and the Dependent Care FSA ("10 days left", tax savings). Each item has a "How we checked" link. |
| **Savings** | "$1,000 for your baby. Plus money back on baby gear you've already bought." The $1,000 starter account, plus "Pay yourself back from an FSA or HSA" and "Price dropped after you bought", both marked "Needs purchases" ("Unlocks the two items above"). The purchases link leads to screen 8. |
| **Insurance** (Insurance & leave) | "2 deadlines in 10 days. These count from your baby's birth date." Add baby to health insurance (deadline date shown), and the state's paid family leave ("Check with your job"). The tab shows a red "2" badge while you're on another tab. |
| **Deals** | "$85 in free gifts. Every offer read for fine print. Anything with a catch gets blocked." Amazon box, Walmart bag, Babylist box, Target 15% registry coupon, each labeled "Checked" (or "Shipping may cost"). A blocked offer appears in red, for example a "free" diaper box that turns into a paid monthly membership. |

The session's recommendation (not yet confirmed by Lyndsay): show the single list (6a) right after onboarding for the strongest first impression, then use the tabbed app for return visits.

---

## 4. Differences from today's `Onboarding.tsx`

**Today:** one screen with three boxes (one date box for "due date or birth date", ZIP, and an optional employer name typed in), a **Find what we're owed** button, a **Try as guest** button, and "Connect a card" and "Upload Amazon orders" links (both "coming soon") on the first screen.

**New**
- An **Expecting / Baby's here** choice as the first question. The date question is then worded to match.
- **One question per screen**, a progress bar, and screens that move on after a single tap.
- A **work benefits Yes / No / Not sure** question with "Why we ask" and "Skip".
- ZIP **pre-filled from location**, plus a "Found it: showing [State] programs" confirmation.
- A live **baby's age line** under the date ("20 days old…").
- A dedicated **Checking screen** with real steps. Today the app jumps straight to the results page, which shows the run's progress there.
- **Two versions of the results** (baby's here vs expecting), a **working checklist** with "$ claimed", a **share moment** after the first money tick, a **save + reminders** screen (demo only), and an optional **tabbed layout**.

**Changed**
- "Due date or birth date" in one box (the app guessed which from whether the date was in the past) → an explicit choice, then a date screen with its own wording.
- "Try as guest" → **"Try a sample family"**, made quieter below the two main choices.
- Headline kept ("Let's find what your family is owed."). The subtitle changes from "Three answers…" to "Cash, credits and free stuff, checked for you. About 30 seconds. No sign-up."
- **Employer name (free text) → yes/no/not sure about benefits.** Less typing and less personal. The server stores the employer name today but doesn't use it to decide anything. It uses `dcfsaOffered`, which is currently always "yes".

**Removed / moved**
- **Connect a card / Upload Amazon orders are removed from the first screen.** They move to screen 8, after the payoff. (Lyndsay's rule: no bank information up front.)
- The single "Find what we're owed" submit button. Each screen now has its own button.
- No income question (none exists today either). The session decided never to ask it.

---

## 5. Data and privacy notes

### Which answers reach which agents
| Answer | Where it goes |
|---|---|
| **Expecting / baby's here + date** | The server checks it, then it's used by the **benefits agent** (deadlines and eligibility, such as the $1,000 account for babies born 2025 to 2028), the **fine-print agent** (it picks offers by the baby's age; only the age in days is used, and the offer list itself holds no family data), the **fact-checker** (deadline math), and the backup list. |
| **ZIP → state** | The server looks up the state from the first 3 digits (a table stored in the Neon database, a cloud database). The **benefits agent** and **fact-checker** use the state to include or skip state programs. The benefit rules themselves come through **Zetaris**. For a typed-in (guest) family, the family's own details are kept in memory on the server and are not queried through Zetaris. |
| **Work benefits answer** | Should drive `dcfsaOffered`, which the **benefits agent**, the **fact-checker** and the **purchases (clawback) agent** read to decide whether the Dependent Care FSA appears. Needs new wiring (see section 6). |
| **Parent feedback** (ticks, "report an issue") | Stored by **Meterless** memory so Bundle learns. Unchanged by this design. |
| **Purchases** (screen 8) | Would go to the purchases agent and the **recall agent** through Zetaris. Today this works only for sample families. |

Each run's notes are written to a log file on the server (`logs/`), and every Zetaris question and memory call is recorded in the run's trace. Treat these logs as containing whatever the parent typed in.

### Checks that must happen (in the browser for quick feedback, and again on the server, which is the real gate)
- **ZIP:** exactly 5 digits (the number keypad and digit-only filter already exist). It must also map to a state Bundle knows. **Today only some ZIP ranges are recognized: MA, NH, NY, OH, CA and TX.** Every other ZIP gets the "Enter a valid US ZIP code" error, so the "Found it: showing [State]" line has to handle "we don't cover your state yet" kindly instead of looking broken.
- **Birth date:** no more than 2 years ago and not in the future (one day of slack for time zones). Due date: today up to 10 months ahead. These rules already exist in `bundle/shared/dateRange.ts`. **New:** the picker must match the chosen path. A future date on the "Baby's here" path, or a past date on the "Expecting" path, gets a clear message instead of being silently reinterpreted the way today's single box does it.
- **Exactly one date** is sent (birth or due, never both). The server already enforces this.
- **Work answer:** only Yes / No / Not sure / skipped. No free text.
- **Location pre-fill:** asking the browser for location triggers its "Allow location?" box. The playbook requires a Bundle pre-prompt first, or an "Use my location" button the parent taps, never a cold prompt. Only the ZIP should be kept, never exact coordinates.
- **Numbers on screen must be real:** the "$3,640" total, "739 recalls", "2 deadlines in 10 days", "$85 in free gifts", "X days old", and deadline dates all have to come from the actual run, never typed into the page. "Opens in about 3 seconds" should wait for the real run to finish.

### Real personal data (project rule: fake data only)
- The flow collects real-looking personal details: a child's birth date or due date and a home ZIP. For the hackathon, **testers and the demo must use made-up dates and ZIPs**, or the "Try a sample family" button. Bundle should not keep typed-in families after a run.
- **Upload Amazon orders / Connect a card** would bring in real purchase history and bank-linked data. Keep them as "Coming soon", or allow sample files only, for the hackathon.
- **Apple/Google sign-in and reminders** would collect real identities. Keep them as clickable demo screens labeled "Demo: not built yet", and don't connect real sign-in.
- **Share:** shares only a link, never the list or details (as the screen promises). The pre-written message must not include the baby's date, the ZIP or amounts.
- The sample family's data is made up. The screens should keep saying "Sample family" and "Made-up data" wherever sample numbers appear.

---

## 6. Open questions and decisions still needed

1. **Single list (6a/6b) or tabs (Version B) after onboarding?** The session suggested: single list first, tabs on return visits. Lyndsay hasn't confirmed.
2. **Draw the "Expecting" due-date screen.** It was only described in a note, and the clickable mockup sends "We're expecting" to the birthday screen.
3. **Honest wording of the big number.** The session flagged that "in cash and tax credits" over-promises: the $1,000 goes into a savings account for the baby, and the $2,640 comes as lower taxes next spring. Both government programs need the baby to have a Social Security number. Suggested fixes: say when and how money arrives, count only near-certain money in the big number, add confidence labels ("Very likely" / "Check with your job"), and add a "How we got this number" link listing the assumptions (files taxes, income under $400k married / $200k single). Lyndsay replied "No don't do it. keep these" to the next proposal, and the mockups still say "in cash and tax credits", so **confirm whether these trust fixes are wanted.**
4. **How the work answer maps to data.** "Yes" → `dcfsaOffered = true`? What do "No", "Not sure" and "Skip" do? Today the server hard-codes "yes", so every guest family is shown the Dependent Care FSA. Should "Not sure" show work-based items as "Check with your job" without dollar amounts?
5. **Employer name:** drop the field completely, or keep it as optional? The design drops it.
6. **States beyond the supported ones:** Bundle only has state programs for Massachusetts, and it only recognizes ZIPs in 6 states. What should a parent in, say, Florida see: federal-only results with a "we don't cover your state yet" note, or an error?
7. **Location pre-fill:** keep it (it needs a pre-prompt and a "Use my location" tap) or drop it to keep the demo simple?
8. **Does the checklist save?** Ticks and "$ claimed" vanish on refresh unless they're saved. Without accounts, should progress be saved in the browser only?
9. **Money-hook screen for expecting families:** the plan says it's mainly for the "baby's here" path, but the expecting list has "Already buying baby gear?". Show screen 8 to both?
10. **Wording consistency:** the canvas title says "3 taps + 1 optional", but the screens count "1 of 4 … Last one". Is the work question counted in the progress bar even when skipped?
11. **Card connection and accounts stay "Coming soon" / demo for the hackathon** (fake-data rule). Confirm nothing real gets connected before Oct 27.

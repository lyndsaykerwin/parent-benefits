# Round 4 mock review: which mocks we're using, what's out of date, and 4 questions

Written Oct 24, 2026. This is a review only. No other files or code were changed.

**Lyndsay's decisions this review follows**
- Onboarding = the **top row** of mocks (the questions), then **Version B** (the **bottom row**: the app with a navigation bar at the bottom).
- The **middle row is not used.**
- The due date is already in her mocks.
- The **work / job-benefits question is cut.**
- **Plaid (connecting a bank or card) is out.**
- New ways to add purchases: **forwarding email receipts, scanning a barcode, and taking photos of items or receipts.**

**Words used below**
- **Mock (mockup):** a drawing of an app screen, not working code.
- **Canvas:** the big design board that holds all 15 mock screens. Its layout file, `design/onboarding/project/canvas.json`, records where every screen sits on the board.
- **Plaid:** a service apps use to read bank and card purchases.
- **Dependent Care FSA:** a work benefit that lets you pay for daycare with money before taxes come out.

---

## 1. Which mocks are the top, middle and bottom rows (and how I know)

The canvas layout file gives each screen a position on the board: `x` is how far right it sits and `y` is how far down. Screens with the same `y` sit in the same row. Each row also has a large title written above it. I also checked the live canvas (https://claude.ai/artifact/7cbiAkSomHVnmTujuSv6uo). Its files are identical to the copies in `design/onboarding/project/`: same 15 screens, same file sizes, same layout file.

| Row | Height on board (`y`) | Title written above the row | Screens, left to right |
|---|---|---|---|
| **Top (USE)** | 0 | "Questions: 3 taps + 1 optional, about 30 seconds, no sign-up" | `Main`, `Date`, `Zip`, `Work`, `Checking` |
| **Middle (DO NOT USE)** | 1244 | "The payoff first, then the asks" | `ListBabyHere` (6a), `ListExpecting` (6b), `Share` (7), `MoneyHook` (8), `Save` (9) |
| **Bottom = Version B (USE)** | 2964 | "Version B: the list split into tabs with a bottom bar" | `NavApp` (Home), `NavTaxes`, `NavSavings`, `NavInsurance`, `NavDeals` |

Three sticky notes sit to the right of the rows (at `x` = 2350). The note beside the top row explains the due date (see section 2). The note beside the bottom row says Version B replaces the single long list.

## 2. The screens we're using, in order

### Top row: onboarding questions
1. **`Main`: the hook.** The progress bar is a quarter full ("1 of 4"). The screen reads "Let's find what your family is **owed.**" / "Cash, credits and free stuff, checked for you. About 30 seconds. No sign-up." It asks "Where are you right now?" with two big buttons, **We're expecting** and **Baby's here**. Below them: **Try a sample family** ("Made-up data") and "We never ask for bank details to get started."
2. **`Date`: the exact date.** "2 of 4". The drawn version is the "Baby's here" one: "Congrats! What's your baby's birthday?", a date picker, then a live line such as "20 days old: some 30-day deadlines are still open", and a **Next** button.
   - **The due date is in the mocks.** The note beside the top row specifies it: "Expecting path: 'When's your baby due?' with a date picker. The due date from your doctor is fine, and we update it when baby arrives." The expecting sample family also shows "due Dec 7".
   - **One small catch for the builder:** there's no separate drawing of the due-date version, and in the clickable mock both buttons lead to the birthday screen. The builder should use the same screen and swap the wording as the note says. Nothing needs to be designed.
3. **`Zip`: where you live.** "3 of 4". "Where do you live?" A ZIP box with "Filled in from your location. You can change it." Once the ZIP is recognized: "Found it: showing [State] programs plus federal ones." Button: **Looks right**.
4. ~~**`Work`: job benefits.**~~ **CUT.** It asked "Does your job, or your partner's, offer benefits?" with Yes / No / Not sure. The mock still exists, so skip it. The progress bar becomes "1 of 3", "2 of 3", "Last one", and **Looks right** on the ZIP screen goes straight to Checking.
5. **`Checking`: the wait screen.** "Finding and fact-checking your money…" Steps tick off: "Matching [State] and federal programs", "Checking deadlines from your baby's birth date", "Checking 739 government safety recalls", "Blocking deals with hidden catches". Then "Opens your list on its own in about 3 seconds."
   - **Builder note:** in the mock this screen opens the middle-row list (`ListBabyHere`). It should open Version B's Home instead. **Try a sample family** on `Main` also points at the middle-row list and should go to Version B's Home too.

### Bottom row: Version B (the app, with 5 tabs in a bottom bar)
The bar is always visible: **Home, Taxes, Savings, Insurance, Deals**, each with an icon and a label. The current tab is highlighted. The Insurance tab shows a red "2" badge while you're on another tab. The numbers below belong to the made-up Massachusetts sample family only.

1. **`NavApp`: Home.**
   - The big number: "Your family could get **$3,640** in cash and tax credits, plus $85 in free gifts."
   - **Do these first:** "Add baby to health insurance" (goes to Insurance) and "Start a Dependent Care FSA" (goes to Taxes), each marked "10 days left".
   - **By category:** four tiles: Taxes $2,640 / 3 benefits; Savings $1,000 + money back; Insurance 2 to-dos / due in 10 days; Deals $85 / 4 offers, 1 blocked.
   - A trust card: "We blocked 1 deal with a hidden catch."
2. **`NavTaxes`: Taxes.** "$2,640 off your taxes. Claimed when you file next spring." It lists:
   - federal Child Tax Credit, $2,200 ("Likely eligible")
   - state Child and Family Tax Credit, $440
   - Dependent Care FSA ("Through work", "10 days left", "Tax savings")

   Each has a "How we checked" link.
3. **`NavSavings`: Savings.** "$1,000 for your baby. Plus money back on baby gear you've already bought." It lists:
   - the $1,000 starter account
   - "Pay yourself back from an FSA or HSA" and "Price dropped after you bought", both marked "Needs purchases"
   - a link, "Find money in what you've already bought / Unlocks the two items above". **In the mock this link opens `MoneyHook`, a middle-row screen.** This is where the new purchase options most naturally go (question 1).
4. **`NavInsurance`: Insurance & leave.** "2 deadlines in 10 days. These count from your baby's birth date." It lists adding baby to health insurance ("Deadline Nov 2") and the state's paid family leave ("Check with your job").
5. **`NavDeals`: Deals.** "$85 in free gifts. Every offer read for fine print." It lists:
   - Amazon registry box $35, Walmart gift bag $25, Babylist box $20 ("Shipping may cost"), Target 15% coupon
   - a red "Blocked by Bundle" card: a "free" diaper box that turns into a paid monthly membership

**Version B is drawn only for a "baby's here" family.** No expecting version exists (question 3). It also has no checklist, share screen or sign-in screen. Those were all in the middle row (question 4).

---

## 3. Where the written plans disagree with these decisions

Line numbers are from the files as they stand today.

### `plans/onboarding-spec.md`
| Where | What it says | Why it's out of date |
|---|---|---|
| §1 Summary, lines 1, 4, 5 | Flow includes an "optional work-benefits question"; purchases come from "Amazon upload / card"; Version B is "a second layout", still undecided | Work question cut; card connection out; intake is now receipts, barcode, photo; Version B is the decided layout |
| §2 intro | Progress shows "1 of 4 … Last one" | Now 3 questions |
| §2 screen 2 (Date) | "This version of the screen was described in a note but never drawn" | The due date **is** in the mocks (the note and the "due Dec 7" sample). It only needs wording swapped. Don't treat it as missing |
| §2 screen 4 (Work) | The whole screen, the `dcfsaOffered` mapping, "Skippable? Yes" | Cut |
| §2 screen 5 (Checking) | Lands on the list (6a/6b) | Lands on Version B Home |
| §2 screens 6a, 6b, 7, 8, 9 | The single long list, checklist, share, "Find money" screen, save + reminders | All middle row: not used |
| §2 screen 8 | **Upload Amazon orders** / **Connect a card** ("Coming soon") | Plaid out; replaced by forwarding receipts, barcode, photo |
| §2 screen 9 | Continue with **Apple** / Google | Middle row. Also, the Oct 24 decision is Google only |
| §3 | Version B is "an alternative"; "show the single list (6a) right after onboarding … tabs for return visits" | Version B *is* what parents see after onboarding |
| §4 "New" and "Changed" | Work Yes / No / Not sure question; employer name replaced by yes/no; "two versions of the results… an optional tabbed layout" | Work question cut; one layout (tabs) |
| §4 "Removed / moved" | Connect a card / Upload Amazon move to screen 8 | Card is out entirely; screen 8 is middle row |
| §5 tables | "Work benefits answer" row; "Work answer" check; privacy note on "Upload Amazon orders / Connect a card … bank-linked data" | Remove. Add privacy rules for receipts, barcodes and photos instead (a receipt photo can show a real name or card digits) |
| §5 ZIP check | "Only … MA, NH, NY, OH, CA and TX" | Already overtaken by the Oct 24 "every ZIP works" decision |
| §6 open questions 1, 2, 4, 5, 9, 10, 11 | List or tabs; draw the due-date screen; how the work answer maps; employer name; money screen for expecting; "3 + 1 optional" counting; card connection | All answered by her decisions |

### `design/onboarding/gap-answers.md`
- **Decisions block at the top (lines 3–7) matches her decisions.** It has the work question dropped, bottom tabs and 5 tabs kept.
- **§2 body (lines 36–62)** still recommends a yes / no / unknown work question and lists the files to change for it. Her decision overrides this. The surviving piece is a "Check with your job" Dependent Care FSA card for everyone.
- **§3 (line 74):** "Save your list" with Google sign-in lived on the middle-row `Save` screen. Version B has no place for it yet (question 4).
- **§4 (lines 90–100):**
  - It recommends that "the long list opens as the first view of the Home tab" and that the app go to 4 tabs (Home · Money · Insurance · Offers). Both conflict with the Version B mock and with her decision to keep 5 tabs. The long list is middle-row content. Version B's Home is a summary.
  - It also mentions an "Upload Amazon orders" button on Savings, which is replaced by the new intake options.

### `bundle-plan-v3.md`
**Plaid / card connection (now out)**
- Line 10: "Plaid stays for store-level jobs."
- Line 14 (and §9 item 1, line 246): "Plaid card rows come out of recall matching." This is now moot.
- Line 27: "Plaid 'Connect a card' is back in."
- Lines 41, 48, 67: "a connected card" / "Connect a card tells it *where* you shop."
- Line 57: the timeline puts Plaid on Sunday.
- Lines 81, 89: the Clawback Hunter (the agent that finds money back on purchases) reads Plaid card lines for daycare bills. Without Plaid, the daycare-bill evidence has to come from the forwarded daycare invoice. That's already a "should-do" at line 181.
- Lines 123–129: **Item 3, Plaid "Connect a card", is a must-do (half a day).**
- Line 154: "Plaid rows out" as part of the recall-safety fix.
- Lines 197, 203, 253: the Sunday Plaid build. The cut order says "Never cut: … Plaid", and "the next hardest call is between Plaid and sample receipts."
- Lines 212, 224: Plaid sandbox (Plaid's practice mode with fake banks) rules and the keys table.

**Work-benefits question (now cut)**
- Line 28: the Benefits Planner uses "work benefits."
- Line 137: "the onboarding answer replaces today's always-'yes' FSA setting."
- Line 165: onboarding must-do includes "screen 4 optional work benefits Yes / No / Not sure / Skip."
- §8 item 2 (line 236) and §9 item 14 (line 259): show the FSA card according to the work answer.

**Due date said to be missing**
- §8 item 1 (line 235) and §9 item 13 (line 258): "Missing due-date screen." It's specified in the mocks; it only needs a wording swap in code.

**Single list instead of tabs**
- Line 165: "then the list."
- §8 item 5 (line 239) and §9 item 16 (line 261): "Recommend: single list for the hackathon; tabs go on a slide as 'next'." She chose the tabs (Version B).

**New intake options**
- Lines 171 and 182 put **receipt photos** on the "roadmap only" slide. Photos are now in.
- **Barcode scanning is not mentioned anywhere** in the plan or spec.
- Email receipt forwarding (round 3, line 10) already matches her decision.

### Also stale (not asked, noted for completeness)
`design/onboarding/README.md` still says:
- "Version B … is an alternative … not yet decided"
- "Card connection stays 'Coming soon'"
- the mockups "still show the work screen (screen 4)"

---

## 4. Questions for Lyndsay

**Q1. Where do the new ways to add purchases go in Version B?** The mocks don't show them. The only purchase link is on the Savings tab ("Find money in what you've already bought"), and it opens a middle-row screen.
- **A. (Recommended)** An "Add your purchases" card on the **Savings tab** with three buttons: **Forward receipts** (shows Bundle's email address), **Scan a barcode**, **Snap a photo**. Plus "Use sample receipts" for the demo. Home's Savings tile says "+ add purchases" so it's findable.
- B. A "+" button floating on every tab that opens the same three options. It's easier to find, but it crowds the bar, and the design rules cap the bar at 5 items.
- C. A card on **Home** under "Do these first". It's more visible, but it pushes an ask up next to the payoff, which breaks "value before any ask."

**Q2. How real should barcode and photo be for Oct 27?** The plan already has more must-dos than time, and neither option has a time estimate. The fake-data rule also means no real receipts.
- **A. (Recommended)** Email forwarding plus "Use sample receipts" built for real. Barcode and photo work as clickable demos using made-up sample items (a sample barcode, a sample receipt picture), labeled "Demo." They're shown in the video and on the roadmap slide.
- B. Build all three for real (camera access, barcode lookup, reading text from photos). This is the most impressive, but it probably costs a day we don't have.
- C. Email forwarding only. Barcode and photo go on the roadmap slide.

**Q3. What does an expecting family see after onboarding?** Version B is drawn only for a "baby's here" family. The expecting list was in the middle row.
- **A. (Recommended)** The same 5 tabs.
  - Home leads with "Free right now: $85 in registry gifts" and "Waiting once baby arrives: $X."
  - Deadline items read "Starts when baby is born" instead of "10 days left."
  - Insurance shows no red badge until the birth.
- B. Expecting families keep the middle-row expecting list (6b), and only "baby's here" families get tabs. This is two designs to build.
- C. The same tabs, but expecting families start on the Deals tab instead of Home.

**Q4. Version B has no checklist, share moment or "Save your list" sign-in. Those were all middle row. Keep any of them?**
- **A. (Recommended)** Fold in a light version:
  - an "I got this" tick on each card, with "$ claimed" on Home (this also feeds Meterless memory, plan item 10)
  - a small "Share this with a friend" bar after the first tick
  - a "Save your list" card on Home for Google sign-in
- B. Drop all three for the hackathon. Version B as drawn is enough.
- C. Keep only "Save your list" (accounts were already decided), and drop the checklist and share.

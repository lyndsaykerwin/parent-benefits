# V2 feedback: point-by-point response (Oct 25, 2026)

This answers every point in Lyndsay's V2 feedback, in the order she wrote it. For each point it says: **Agree / Agree with changes / Push back**, what the code does today (from `progress/reviews/v2-code-map.md`), and how to build it. Facts and sources are in `research/v2-feedback-research.md`.

Plain-English word list (used below):
- **Dependent Care FSA (DCFSA):** a work benefit that lets you pay for daycare with money that isn't taxed.
- **Qualifying life event (QLE):** something like a birth that lets you change your health plan outside the normal yearly sign-up window.
- **W-2 job:** a regular job where the employer takes taxes out of your paycheck (as opposed to freelance work).
- **ACA:** the Affordable Care Act, the 2010 health law that makes most plans cover certain care at no cost.
- **Migration:** a small script that adds a new column or table to the database.
- **Replay cache:** the saved answers that let the app run in practice mode (SAMPLE_MODE) without calling Zetaris live. It is keyed by the exact wording of each database question, so changing that wording breaks replay until it is re-recorded.
- **Mockup:** a clickable picture of a screen, not working code.
- **Acceptance test:** an automatic check that clicks through a screen and confirms a user story works.

---

## Headline ruling

1. **No refactor. Agree.** Every item is a targeted change.
2. **Two corrections to the plan before building:**
   - The "70,000+ lines of code" claim is wrong. The app is about **13,200 lines of hand-written code plus 10,700 lines of tests** (about 28,700 total). Don't put 70,000 in the submission; a judge who checks will lose trust.
   - Several file paths in section 5 are wrong or missing. The corrected file map is in section 5 below.
3. **Five fact fixes**, so the app never says something untrue:
   - "14,200 recall records" is made up. The real numbers are **10,058 CPSC recalls** (Consumer Product Safety Commission; downloaded Oct 25, 2026) and **69 car-seat recalls since 2010** from NHTSA (National Highway Traffic Safety Administration). The app should count what it actually loaded.
   - **Car seats are NHTSA's job, not CPSC's.** The Graco car seat example has to be checked against NHTSA's list.
   - "$7,500 Dependent Care FSA" is correct for 2026. Three caveats apply: it's per household, it's $3,750 if married filing separately, and an employer may set a lower cap.
   - "30 days to add baby to insurance" is only true for job-based plans. The Marketplace (in MA, the Health Connector) gives 60 days. Babies of moms on MassHealth are covered automatically for a year (report the birth within 10 days). For TRICARE, the baby must be registered in DEERS, the military's family-records system, within 90 days.
   - "Paid upon filing your 2026 taxes in Spring 2027" is only right for babies born in 2026. A baby due in 2027 means the 2027 taxes, filed in spring 2028. The app must work out the year from the date.

---

## A. The 5 onboarding questions

### Q1–Q3 (stage, date, ZIP): keep as is. Agree.
Already built: `client/src/pages/Onboarding.tsx`. No change except the step counter: "1 of 5" instead of "1 of 3".

### Q4 "What is your household's employment setup?": Agree with changes
**Why it's good:** It powers a real, big, personal number ($7,500 tax-free for daycare), and the app can't learn this any other way. It also replaces the Oct 24 decision to drop the work question (`design/onboarding/README.md`). That README needs a note saying the decision was reversed and why.

**Changes, from the onboarding playbook (app-onboarding skill):**
1. **Drop "W-2" from the screen.** Parents don't know the term. Proposed wording:
   - "We both work for an employer"
   - "One of us works for an employer, one stays home"
   - "One or both of us is self-employed or freelance"
   - "I'm a single parent with a job"
   - a quieter link: "Something else / prefer not to say" (trust rule: sensitive questions always get a way out)
2. **Fix the advice behind each answer** so it's true:
   - Both work → "You may be able to set aside up to $7,500 tax-free for daycare (Dependent Care FSA). Check with HR."
   - One stays home → "A Dependent Care FSA usually needs both parents earning. There's an exception if the stay-home parent is a full-time student or disabled." Don't say "you don't qualify" flatly.
   - Self-employed → "No work FSA, but the childcare tax credit can give back up to $1,500 for one child ($3,000 for two or more)." It's 50% of up to $3,000 / $6,000 in costs and is not refundable (it can lower your tax bill, but it isn't paid out as cash).
   - Single parent with a job → qualifies for the FSA if the employer offers one, same as "both work."
3. **Show the payoff on the next screen** (Law 2: each answer visibly shapes the result). A small line appears: "Got it — checking daycare tax savings for you."
4. **Order is right.** It's more sensitive than ZIP, so it comes after the easy questions (trust rule: least sensitive first).

### Q5 "Where do you get your health insurance?": Agree with changes
**Why it's good:** It turns one generic "add baby to insurance" card into the correct deadline, which is the most urgent money-and-health item in the app.

**Changes:**
1. **Split "Military / TRICARE / Other."** Military has a 90-day rule; "other" has no rule. Lumping them gives the wrong deadline. Proposed:
   - "Through a job (mine or my partner's)"
   - "Health Connector / Healthcare.gov"
   - "MassHealth / Medicaid / CHIP." Show the state's own name first; for an MA ZIP that's "MassHealth."
   - "TRICARE (military)"
   - quieter link: "No insurance right now / not sure." This matters: a newborn with no coverage may qualify for MassHealth, and the app should say so.
2. **Each answer's deadline (all sourced):**

   | Answer | Countdown pill | Detail |
   |---|---|---|
   | Through a job | "30 days from birth to add baby" | Federal minimum is 30; some plans give 60. "Check your plan." Coverage goes back to the birth date. |
   | Health Connector / Healthcare.gov | "60 days from birth to add baby" | Coverage can start on the birth date. |
   | MassHealth / Medicaid | "Baby is covered automatically for 1 year" | "Report the birth within 10 days." No countdown, just a to-do. |
   | TRICARE | "90 days to register baby in DEERS" | 120 days if overseas. |
   | None / not sure | "Your baby may qualify for MassHealth" | Link to apply. |

### Should Q5 also ask for the insurance company (Aetna, BCBS, UnitedHealthcare, Kaiser)? **Push back: no, not in onboarding.**
The point in the feedback is right, and it is actually the reason **not** to ask. ACA free preventive care (breast pump, lactation help, $0 well-baby visits, newborn screening) applies the same at every carrier, including employer plans that pay claims themselves. The Supreme Court upheld it 6–3 on June 27, 2025. So the carrier name adds nothing to the first payoff. It would be a 6th question, which breaks the 3–5 question rule.

**Simple way to still get the benefit:**
1. If Q5 = "Through a job" or "Health Connector," show one card with no extra question: **"Your plan covers a breast pump at $0."** It carries a small "Why?" line: "A federal law makes most plans cover this, whichever company runs your plan. Older 'grandfathered' plans and short-term plans are the exceptions."
2. Inside the Insurance tab, offer the carrier as an **optional Profile Booster** (see section 2): "Which company is on your insurance card?" with logo chips: Aetna, BCBS, UnitedHealthcare, Kaiser, Other. The payoff is concrete, such as "Here's how to order your free pump through Aetna," and a link to that carrier's maternity program.
3. **Caveat to show:** the 2026 federal baby vaccine schedule is tied up in court, so don't promise "$0 vaccines" without "check your plan."

### Does the new flow pass the onboarding playbook? Mostly yes, with 3 fixes
| Law / default | Pass? | Note |
|---|---|---|
| 3-second rule | Yes | Q1 is still the first screen. |
| Sunk cost: 3–5 tap questions | Yes, 5 | Exactly at the limit. **Don't add a 6th** (the carrier question). |
| Taps over typing | Yes | Q4 and Q5 are tap choices that auto-advance. |
| "Why we ask" link | **Add** | Q4: "So we can check daycare tax savings." Q5: "So we can give you the right deadline." |
| Prefer not to say | **Add** | On Q4 and Q5, as a quieter link. Skipping still gives a result: a broader card plus "Add this later for your exact deadline." |
| Answers kept on Back | Check | Onboarding already has Back; the test must cover Q4 and Q5. |
| "Try a sample family" | Keep | It must fill Q4 and Q5 for Maya (add to `families.json`). |
| Waiting screen narrates real steps | **Fix** (next section) | |

### The "We're checking for you" screen: Agree with 2 changes
**What it says today** (`server/routes/bundleRoutes.ts:115-120`, copied in `client/src/lib/stream.ts:153-159`):
1. "Money you can get back"
2. "Your items vs. official recall lists"
3. "Programs and deadlines for your family"
4. "Deals, read for hidden catches"
5. "Every card double-checked against its source"

The feedback is right that line 2 is false for a typed-in family with no purchases. It also slightly misreads the code: the screen doesn't jump to a new page. It re-draws in place as the results screen when the run finishes (`Feed.tsx:212-216, 255-262`). To the parent it feels the same, so the fix stands.

**New lines:**
1. ✓ "State and federal family benefits," based on your ZIP and baby's age
2. ✓ "Insurance deadline to add your baby," based on your insurance (Q5)
3. ✓ "Daycare tax savings and Dependent Care FSA," based on your work setup (Q4)
4. ✓ "Free registry gifts and welcome boxes," checked for your baby's exact age

**Change 1, keep a 5th line:** "✓ Every result double-checked against its official source." This step really runs (the Fact-Checker, an AI helper that re-reads each card against its source, with 2 retries). It's the app's best trust point and a judging point for showing agents doing real work. Dropping it hides real work.

**Change 2, show the recall line only when it's true:** "Your items vs. official recall lists" appears **only** if the family has items (for example, the sample family Maya, or after a photo). Rule: show a step only if the run really does it. The playbook says to never show fake steps.

**"View my results →" button: Agree, with a twist.** Instead of a plain button, end with a reveal: **"We found $X for your family. View my results →"** The tap then feels like opening a present, not a chore. Use the real number from the run, never a guess.

Engineering note: the step list is duplicated on server and client. Change both, and update `Feed.test.tsx`, which checks the old wording.

---

## B. Gear and photo matching: Agree with changes (privacy and accuracy)

**What the code does today:** The photo is read, the item is saved to `purchase_items` (the table already exists), and the photo bytes are deliberately wiped (`server/ingest/photo.ts:360`). The location and phone details are stripped too. **No card appears** until the parent taps "Check my new items" and a whole new run starts. **Bug found:** for typed-in (guest) families, the recall check is skipped entirely (`server/agents/recall.ts:270-273`). A "Gear Locker" built on that would say "safe" without checking. This must be fixed first.

**Saving the photo: Agree, but only a small thumbnail of item photos, never receipts.**
- Receipts can show names, addresses and card digits, so keep wiping receipt images and save only the items read from them.
- For an item photo, save a small (about 200 px) thumbnail in a new `photo_thumb` column on `purchase_items` (one migration). Keep wiping the full-size image.
- "Forget my items" must delete thumbnails too (it already deletes the rows).

**Saving the gear: Agree.** The rows are already saved. Add the "Gear Locker" list to the Savings tab and the new Account tab.

**The green "Verified Safe" badge: Agree with wording changes.** "Verified Safe" is a promise the app can't make. No recall today doesn't mean the item is safe, and it could get the app in legal trouble. Proposed card:

> **Graco SnugRide 35 Lite infant car seat**
> Model 2120349 · UPC 047406173005
> 🛡️ **No recalls found** as of Oct 25, 2026. Checked against 69 NHTSA car-seat recalls. [For other gear: "10,058 CPSC recalls."]
> **Register it with Graco →** (This is how you'd hear about a future recall.)
> Saved to your gear locker.

How to check car seats: NHTSA's free API can't look a seat up by brand and model (tested Oct 25: "Graco SnugRide" returns 0). Load NHTSA's free daily recall file once, keep the 69 car-seat rows, and match on brand and model text. Model #2120349 is not a confirmed real model number, so label it "example" in the demo.

Why the changes:
- The real count replaces "14,200."
- Car seats go to NHTSA.
- "Registered to your profile" sounds like manufacturer registration, which is a different and more valuable thing. So link to the real registration page and say "Saved to your gear locker" for the app part.

**Demo risk:** in practice mode, photo reading returns "needs the live model," because the saved vision answers folder (`data/sample/vision-cache/`) is empty. Before the demo, record one sample photo of a fictional item with `npm run record-vision`.

---

## C. Refactor or targeted fixes? Agree: targeted fixes
The 5 listed changes are right, but each touches more files than listed. Corrected map in section 5. Line-count correction is in the headline above.

---

## 2. Profile Boosters (deeper questions inside the app)

### How should they show up? (thinking like Nikita Bier)
The principle: **never ask a question; offer a reward that happens to need one answer.** Each booster is a card that shows the money it unlocks *before* asking, takes one tap, and changes a number on screen right away.

1. **Lead with the gain, as a range:** "Your tax refund: **$2,200–$3,100**. One tap makes it exact →" The range comes from what the app already knows. Narrowing it is the reward.
2. **One booster per tab, at the top, only when it changes something on that tab.** Taxes tab gets filing status. Insurance tab gets the carrier. Never more than one booster visible at a time, and never on Home during the first visit (protect the payoff).
3. **One tap, chip answers, inline.** No new page, no typing. The card flips to show the new exact number with a short count-up animation (respect "reduce motion" settings).
4. **"Not now" is always there.** If skipped, the card shrinks to a small chip ("Make my tax number exact") and comes back once, a week later or on the next visit, never as a nag.
5. **A progress ring on the Account tab**, framed as money, not completion: "Your plan is 70% exact. 2 answers left could change your numbers." Rings work because people like finishing things (Law 5), but say what finishing gets them.
6. **Partner hook (Law 4, careful tone):** the Taxes booster ends with "Send these to your partner or tax preparer" as a one-tap share. Never required.
7. **No fake urgency.** This is money and babies, so the playbook's "careful" tone applies: no countdowns on boosters and no "others are ahead of you."

### Taxes tab booster: filing status. Agree with changes
- Question: "How will you file taxes this year?" Chips: Married filing together / Single / Head of household ("single parent who pays most home costs") / Not sure.
- **529 college savings deduction** (a 529 is a savings account for school with tax breaks): use **Massachusetts** for the demo family, since the demo is in Boston. MA allows a state deduction of $1,000 single / $2,000 joint (confirmed with MEFA, the agency that runs the MA 529 plan; see research file §7). The feedback's Indiana/Oklahoma example needs fixing:
  - Indiana gives a **credit** (money off the tax bill), not a deduction, and it doesn't double for couples.
  - Oklahoma does double ($10,000 / $20,000).
  - Don't show other states' rules to an MA family at all.
- **"W-4 Allowance Advisor" → rename "Update your paycheck tax form (W-4)."** The W-4 is the form that tells your employer how much tax to take out of each paycheck. It dropped "allowances" in 2020, so the old name would look dated to a tax-savvy judge. Output: a short list for your tax preparer, such as "Add your baby in Step 3 (dependents) so less tax is taken from each paycheck."
- **EITC and childcare-credit phase-outs:** **defer**, i.e. not for this hackathon. EITC is the Earned Income Tax Credit, a tax credit for lower-income working families; a phase-out is the point where a credit starts shrinking as income rises. This needs income, the most sensitive question there is, and the math is complex. If built later, ask income as a tappable range with "Prefer not to say."

### Insurance tab booster: "Questions to ask HR." Agree strongly
This is the best idea in the section: it's honest about what the app can't see (private HR handbooks) and still useful. Build it from Q4 and Q5, no extra question:
- Through a job: "Do we have 30 or 60 days to add our baby?" / "Does our plan offer paid parental leave top-up (extra pay on top of state leave)?" / "Do we offer a Dependent Care FSA, and what's the cap?" / "When does the FSA life-event window close?"
- One stays home: drop the FSA questions.
- Self-employed: replace them with "Questions for your tax preparer."
- One-tap "Copy" and "Email to myself." The second uses the device's own share menu, so the app sends nothing.
- Then the optional carrier booster (section A).

---

## 3. Audit grid: row-by-row response

| Row | Ruling | What the code says / changes to the fix |
|---|---|---|
| Onboarding form | **Agree** | 3 questions today. Medium effort, not small: the new answers must also flow into the request, the family type, the database (one migration) and sample families. **Don't change the Zetaris SQL text** for the family profile, or practice mode replay breaks. Carry Q4/Q5 alongside it. |
| "Checking" screen | **Agree with changes** | It re-draws in place, not a page jump. Keep the "double-checked" line; show the recall line only when true; reveal button with the real total. |
| Tax credit display | **Agree with changes** | One number today (`client/src/lib/tabs.ts:53-61`, `HomeTab.tsx:52-58`). Details below. |
| Gear and photo | **Agree with changes** | Thumbnail of item photos only; fix the guest-family recall skip; "No recalls found" wording; real counts; NHTSA for car seats. |
| "I got this" | **Agree, and it's worse than described** | There are **two** "I got this" buttons that don't talk to each other: tab card checkbox (browser memory only) and card detail page (saves feedback to the server). Unify them. "Not relevant" doesn't exist. Add it and send it to the Coach (the agent that learns from parent feedback) as a learning signal, which is real Meterless work. |
| Offers and deals | **Agree, with your note applied** | Your note says to work with the data we have. Agreed, so **no fake "Scanning…" animation over saved data**; that would be a fake step. Say what's true: "Checking 16 saved offers against your baby's age (Day 20)." Optional real live search is below. Fix "Fits babies up to 12 months old" (`server/agents/sql.ts:62-65`) to "Your baby is 20 days old. This offer is for babies 0–12 months." |
| Persistence and memory | **Agree with changes** | There's no Account tab today, and typed-in families aren't saved. Today's memory holds **lessons about offers and rules**, not facts about the family (155 entries, 7 long-term). Honest version below. |
| Navigation and banners | **Agree, smaller than described** | Back links already exist on card detail and the Smarter page. The tabs have a tab bar, so they don't need one; add Back only to new sub-views (Gear Locker, Audit a Deal, HR checklist). "Start over with your own details" shows on Home for **every** run (`VersionB.tsx:70-74`). Move it into an Account menu and show it on Home only for the sample family. |

### Money buckets, in detail (story 3)
| Bucket | What's in it | When the money comes | Note |
|---|---|---|---|
| **Money back now** | FSA reimbursements, price-drop refunds | Within weeks of filing a claim | For a typed-in family with no receipts this is $0. Show "Add a receipt to find money back," never "$0." |
| **At tax time** | Child Tax Credit $2,200 (up to $1,700 refundable), MA child credit $440, Trump Account $1,000 | "When you file your 2026 taxes (spring 2027)," with the year worked out from the date | The Trump Account $1,000 goes **into the baby's account, not your pocket**. Label it that way. |
| **Paid family leave** | MA paid leave (PFML) | Weekly, during leave | The app has no amount today (blank). Show "up to $1,230 a week for 12 weeks (depends on your pay)." |
| Free gifts | Registry and welcome boxes | Shipped | Already separate; keep. |

Build it properly: add a `category` field to each card on the server. Today the app guesses categories from card names, which breaks when a new benefit is added.

---

## 4. User stories: response and changes to each

**Story 1: 5-question intake and insurance deadline timer. Agree with changes.**
- "Exactly 5 steps": yes.
- The insurance options change to 5 choices plus "not sure" (section A).
- The checking screen must match the answers, plus the always-true "double-checked" line.
- The countdown pill uses the table in section A, not 30 days for everyone.
- Add: "Back keeps your answers," and "Try a sample family fills all 5."

**Story 2: Gear Locker. Agree with changes.**
- Camera guidance: yes. "On your phone, point at the sticker on the bottom of the car seat. On a computer, upload a photo."
- Save a thumbnail for item photos only, not receipts.
- "0 CPSC/FDA recalls" becomes "No recalls found," with the source picked by product type (NHTSA for car seats).
- Add: it must work for typed-in families (fix the recall skip).

**Story 3: Money buckets. Agree.**
- Add the tax-year rule, the "baby's account" label for the Trump Account, and the empty state for "Money back now."

**Story 4: One-tap completion and quick wins. Agree with changes.**
- Drawer: yes.
- Moves money from "Still to claim" to "Claimed so far": yes.
- The **quick-win filter needs data the app doesn't have.** Only deal cards have a time estimate today; benefit, refund and recall cards have none. Add a `minutes` estimate to each benefit rule, for example "Add baby to insurance: about 15 min." Without that the filter would be a guess.
- "Not relevant" cards go to the drawer too, with an Undo.

**Story 5: Deal scanner and exact age. Agree with changes.**
- No fake scanning: the indicator says what's really happening (see the audit grid row).
- Exact-age line: yes.
- "Audit a Deal" box: doable, medium effort. The two debaters (Deal Hunter and Fine-Print Lawyer) are roles inside one function, not separate agents, so they need a new entry point. In practice mode there's no AI, so the box falls back to the rule-based checker and says so ("Quick check. The full AI review runs in live mode").
- Pasted text is a prompt-injection risk (hidden instructions that try to take over the AI). The existing guard covers it; don't save pasted offers to the graded-offers database.

**Story 6: Account Portal and memory. Agree with changes.**
- Editable profile: yes. Changing an answer re-runs the check.
- Gear Locker: yes.
- **Memory entries:** make this real, not decorative. Today the memory stores lessons and rules, not the family. Two honest panels:
  1. **"What Bundle remembers about your family"**: write the onboarding answers and gear into Meterless memory as tagged entries, so each shows a real `mem-XX` id. That's real sponsor work, and only fictional data goes in.
  2. **"What Bundle has learned from parents"**: the 7 long-term lessons plus approved rules, each with "learned from N parent reports," using the real count.
- Add "Forget everything" next to it (trust).

---

## 5. Corrected file map

| Feedback said | Real location / what else must change |
|---|---|
| `client/src/pages/Onboarding.tsx` | Correct. Also: `client/src/lib/bundle.ts` (request type), `server/routes/bundleRoutes.ts` (builds the family), `shared/bundle.ts` (Family type), `shared/schema.ts` + new migration, `data/sample/families.json`, `server/agents/benefits.ts` (uses the answers), `plans/onboarding-spec.md`, `design/onboarding/README.md`. |
| `client/src/pages/Feed.tsx` | Correct. Also the duplicated step list in `server/routes/bundleRoutes.ts:115` and `client/src/lib/stream.ts:153`, plus `Feed.test.tsx`. |
| `AddPurchaseButton.tsx` and `server/agents/photoReader.ts` | The photo reader is actually **`server/ingest/photo.ts`**. Also `server/routes/photoRoutes.ts`, `server/agents/recall.ts` (guest skip bug), `shared/schema.ts` (thumbnail column). |
| `VersionB.tsx` and `tabs.ts` | The total is shown in **`client/src/pages/tabs/HomeTab.tsx`**, computed in `tabs.ts` **and** in `server/agents/orchestrator.ts:184` (duplicated). `category` field: `shared/bundle.ts`, `benefits.ts`, `clawback.ts`, `fallback.ts`. "I got this": `FeedCardView.tsx`, `CardDetail.tsx`. |
| `DealsTab.tsx` | Correct. Also `server/agents/finePrintCourt.ts` (new entry point for pasted text), a new rate-limited route, and `server/agents/sql.ts:62` (age line). |
| `AccountTab.tsx` | **Doesn't exist; new file.** Also `tabs.ts` (new tab id), `TabBar.tsx`, a new read-only memory route that filters to long-term or family entries. |
| `AppShell.tsx` | Back already works there. The banner is in **`VersionB.tsx:70-74`**. |

---

## Other feedback

### How can we search for the latest offers live without getting blocked?
**Use a search service built for AI agents instead of scraping (copying text off) store websites.** Recommended: **Tavily**, with 1,000 free searches a month and no credit card (per its docs, Oct 2026).
1. Search only a short allow-list of trusted sites (brand registry pages, Babylist, Amazon, Target and so on) for "free baby box," "registry welcome gift," and similar.
2. Each result goes through the existing fine-print court before a parent sees it, so new offers get graded the same as saved ones.
3. Save results to the replay cache so practice mode shows the same offers without the internet.

Why not the others:
- Bing's search API shut down Aug 11, 2025.
- Brave now needs a credit card.
- Amazon's product API needs 10 sales in 30 days.
- Store affiliate feeds need approved accounts.
- None of those works in 2 days.

**Suggested scope:** treat it as an optional "live mode" extra after the stories above, not a demo dependency. With it, the "Scanning latest offers…" line becomes true.

### A visual for the graded-offers database
The database exists (`offer_checks` table, the `GET /api/offer-audit` endpoint, and the Zetaris view `v_offer_audit`), but **no screen uses it, and practice mode has 0 graded rows.** Two ideas, both using only real numbers:

1. **"Offer report card" strip on the Deals tab** (for parents and judges): one row per store with a small bar: green for approved, amber for "has a catch," red for blocked. Above it: "We've graded N offers. X had a catch. $Y in hidden costs caught." Tapping a store shows its graded offers. Judges get to see the agent work become data.
2. **"You're helping other parents" moment** (Law 4, careful tone): after "Report issue" or "Not relevant," show "Thanks. Your report is in the review queue. Once approved, it protects every family checking this offer." Later, on the Account tab: "Your reports helped grade N offers." Use only real counts. If the count is 0, show the promise, not a number.

**To make it show anything in practice mode**, seed graded rows once: do one live run that grades the 16 saved offers, then re-record the replay cache.

---

## Open decisions for Lyndsay
1. Q5 carrier question stays out of onboarding (optional booster instead)? *Recommended: yes.*
2. Keep the 5th "double-checked" line on the checking screen? *Recommended: yes.*
3. Save thumbnails for item photos only, never receipts? *Recommended: yes.*
4. Live offer search (Tavily) now, or after the 6 stories? *Recommended: after.*

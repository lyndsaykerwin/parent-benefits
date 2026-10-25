# V2 build plan (revised Oct 25, 2026, after Lyndsay's review)

This is the plan to build from. It replaces the build parts of `plans/v2-feedback-response.md`; the first version is saved in `plans/old-versions/v2-feedback-response-2026-10-25-v1.md`. The reasoning and sources for each point are still in `plans/v2-feedback-response.md` and the research files:
- `research/v2-feedback-research.md` (benefit facts)
- `research/v2-accounts-research.md` (saved accounts)
- `research/v2-offers-research.md` (live search and affiliate feeds)

**Scope Lyndsay set (Oct 25):** all 6 stories, live offer search, and real saved accounts, all in before the deadline (**Oct 27, 7:45pm Boston time**).

Words used below:
- **Firebase:** Google's sign-in service. The app was set up with it on Oct 22, and the keys already exist.
- **Tavily:** a search service built for AI agents.
- **Affiliate network:** a company that pays a site a small cut when a reader buys through its link.
- **Migration:** a small script that adds new columns or tables to the database.
- **Replay cache:** the saved Zetaris answers that let practice mode (SAMPLE_MODE) run offline.

---

## 1. What changed after Lyndsay's review

| # | Lyndsay said | New ruling |
|---|---|---|
| 1 | The "W-2" options are confusing | **Q4 becomes a two-part question on one screen.** First: "Who's raising this baby?" with "Just me" / "Two of us." Then one row per parent appears below ("You", "Your partner"), each with 3 choices: **"Paycheck from a job"** (hint: taxes come out of your pay), **"Self-employed or freelance"** (hint: you pay your own taxes), **"Not working right now"** (hint: staying home, studying or between jobs). The quieter "Something else / prefer not to say" link stays. The hints explain the job-vs-freelance difference in everyday words, so the term "W-2" never appears. |
| 2 | The checking screen jumped ahead too fast | Lines tick off one at a time, about 1.2–1.5 seconds apart, and stay on screen. The "We found $X… View my results →" card appears only after the last line. **Nothing moves on by itself.** |
| 3 | Don't show the Dependent Care FSA if I'm not eligible | The daycare line depends on Q4. "Daycare tax savings and Dependent Care FSA" shows only if every parent earns and at least one has a paycheck. A self-employed-only home sees "Childcare tax credit" instead. If a parent isn't working, the line is left off. "Prefer not to say" shows "Daycare tax savings (general)." The same rule applies to the cards on the results screen. |
| 4 | What about affiliate feeds? | **None can work in 2 days.** Impact, Awin, CJ and Rakuten all need an approved account and usually a live site with visitors; Amazon needs 10 sales in 30 days. **Build Tavily live search now. Lyndsay applies to Impact and Awin now** (Impact reaches Babylist, Target and Walmart; Awin has the clearest promotions feed), so approval arrives after the hackathon. The feeds then plug into the same grading step. Coupon feeds you get instantly (LinkMyDeals, Coupomated) are skipped because their data is copied from coupon sites, which breaks the "checked offers" promise. |
| 5 | Shouldn't we save user accounts and email? Colin's template? | **Yes, build it.** Colin Matthews' template had Firebase sign-in. The team copied in a later guest-only version and removed it. Bring it back without passwords: **"Continue with Google"** as the main button and **"Email me a sign-in link"** as the second option. Firebase's free plan sends only **5 email links a day**, so Google leads. A clearly labelled **"Demo sign-in (sample mode)"** button lets judges try it without keys. Details in section 4, lane E. |
| 6 | Live offer search AND the 6 stories, now | Both are in the build order below. |
| 7 | Do save receipt photos | **Receipt photos are saved now**, along with gear photos, for signed-in parents only. Location data is still stripped, and the parent can delete them anytime. On screen: "Photos are saved to your account only. We strip location data. Delete anytime." |
| 8 | "mem-01" is too techy | Memory entries show friendly labels such as "Remembered from your setup · Oct 23" or "Learned from your gear scan · Oct 25," with a small grey "Saved in Meterless memory" tag. The raw id sits behind a tiny "Technical details" toggle so judges can still see the sponsor tech. |
| 9 | Nothing leads to the gear locker | Three ways in:<br>(1) a card high on Home, "📷 Snap your baby gear — we'll check recalls and find money back," with a "Scan gear or a receipt" button;<br>(2) the unlabelled "+" in the header becomes a "Scan" button with a camera icon;<br>(3) the same card at the top of Savings, plus an empty-locker message with the button.<br>The scan sheet asks "What are you scanning?": **Gear** (the sticker, for a recall check) or **A receipt** (money back for FSA-eligible items and price drops, plus a recall check on each item). Results end with "See your gear locker →." |
| 10 | "Audit a deal" should ask for specifics or take a screenshot | It becomes a short form: **Who's offering it?**, **What do you get?**, **Link (optional)**, and **Fine print**, with a choice of **"Paste the text"** or **"Add a screenshot."** A screenshot is read by the same photo reader the gear scan uses. The verdict names the store and the offer. |
| — | Carried over (not objected to) | The insurance-company question stays out of onboarding (it's an optional booster in the Insurance tab). The "Every result double-checked" line stays on the checking screen. |

---

## 2. Unchanged from the first response
These still stand as written in `plans/v2-feedback-response.md`:
- Q1–Q3; Q5's five insurance choices and their deadlines
- The money buckets, including the tax year worked out from the date and the "baby's account" label for the Trump Account
- "I got this" / "Not relevant" with a drawer, Undo and a quick-win filter (benefits get minute estimates)
- The "No recalls found" wording, real recall counts and NHTSA for car seats
- Profile Boosters: Taxes filing status with the MA 529 line, the renamed W-4 item and "Questions to ask HR"
- The offer report card, the "You're helping other parents" moment, moving "Start over" into the Account tab, and Back buttons on sub-views
- The corrected file map, and the "no 70,000 lines" correction

---

## 3. What Lyndsay needs to do (only she can)
1. **Firebase console, about 30 minutes.** Switch on Google sign-in and Email-link sign-in. Add `localhost` and the Render web address as allowed websites. Decide whether to add a card for the paid pay-as-you-go plan with a $5 spending alert; it lifts the 5-a-day email limit to 25,000. Without it, Google sign-in still works fully.
2. **Tavily key, 5 minutes.** Sign up at tavily.com (free, no card) and paste the key into `.secrets/bundle.env.local` as `TAVILY_API_KEY`. A helper can tell you exactly where; it can't create the account for you.
3. **Affiliate applications, about 20 minutes each, optional for the hackathon:** Impact and Awin. Use your own details; approval arrives after Oct 27.
4. **Render dashboard:** add the Firebase settings so the live site can sign people in. A helper will give you the exact list of names.
5. **Live Zetaris re-recording:** at the end, one run of `npm run zetaris:record` with live Zetaris, so practice mode includes the new offers and graded rows. A helper can run it if the Zetaris keys are in `.secrets/`.

---

## 4. Build order

Five lanes run in parallel, each in its own set of files, so helpers don't collide. **Step 0 goes first** because every lane needs it.

### Step 0: shared foundation (about 1.5 hours; one helper; must finish before the lanes start)
- **One database migration covering everything:**
  - `families` gets new columns: `household` (one or two parents), `parent1_work`, `parent2_work`, `insurance`, `user_id`.
  - `purchase_items` gets `photo_id`.
  - New tables: `item_photos` (thumbnail and receipt image as text, signed-in parents only), `claims` (card id, status got_it or not_relevant, user), and `users` (Firebase id, email, role).
  - `run_results` gets `family_id`.
  - `feedback.kind` gains `not_relevant`.
- **Shared types:** `Family` gains household, work and insurance fields; `FeedCard` gains `category` (money_back | tax_time | leave | gift | info) and `minutes`.
- **Sample families:** add the new answers to `data/sample/families.json` (Maya: two of us, both have a paycheck, insurance through a job).
- **Rule:** do **not** change any Zetaris SQL text in this step. The new answers travel alongside the family profile, so practice mode keeps working.

### Lane A: onboarding and checking screen (Story 1, about 4 hours)
- Q4 as two parts (`Onboarding.tsx`), and Q5. "Why we ask" and "prefer not to say" on both. Back keeps answers. "Try a sample family" fills all 5.
- Eligibility rules in one shared place (`shared/eligibility.ts`): who gets the daycare FSA, who gets the childcare credit, and which insurance deadline applies.
- Checking screen (`Feed.tsx`, plus the duplicated step lists in `bundleRoutes.ts` and `stream.ts`):
  - lines come from the answers
  - the recall line shows only if the family has items
  - the daycare line follows rule 3
  - slow, readable pacing, then the "View my results" reveal
- Insurance tab: the countdown pill follows Q5. "Questions to ask HR" checklist and the optional carrier booster.

### Lane B: money and tasks (Stories 3 and 4, about 4 hours)
- Set `category` and `minutes` on the server (`benefits.ts`, `clawback.ts`, `fallback.ts`, `orchestrator.ts` receipt).
- Three buckets on Home (`HomeTab.tsx`, `tabs.ts`):
  - the tax year comes from the birth or due date
  - the "Money back now" empty state says "Add a receipt to find money back"
  - leave shows "up to $1,230 a week for 12 weeks"
- One "I got this" path for cards and the detail page. "Not relevant" is new. Both write to `claims` (or browser storage for guests) and to `feedback`, and the Coach learns from "not relevant." Drawer with Undo; "Still to claim" and "Claimed so far" update; Quick wins filter.
- Taxes tab filing-status booster.

### Lane C: gear scan and locker (Story 2, about 4 hours)
- The scan entry points from rule 9 (`AddPurchaseButton.tsx` becomes a labelled "Scan", plus the Home card and Savings card).
- "What are you scanning?" sheet: gear or receipt.
- Save photos to `item_photos`, with location data still stripped (`server/ingest/photo.ts`, `photoRoutes.ts`). Keep the full-size image only as a thumbnail and a readable receipt copy.
- **Fix the guest recall skip** (`server/agents/recall.ts:270`), so typed-in families get checked.
- Car-seat check: load NHTSA's free daily recall file once into a small table (69 car-seat rows) and match on brand and model.
- Run the recall check straight from the photo route. The result card shows "No recalls found as of [date] · checked against 69 NHTSA car-seat recalls / 10,058 CPSC recalls" and "Register it with Graco →."
- Receipts also run the money-back check (FSA-eligible items, price drops).
- Gear Locker on Savings and Account; "Forget" deletes photos.
- Practice mode: record one fictional item photo and one fictional receipt (`npm run record-vision`).

### Lane D: deals and live search (Story 5, about 5 hours)
- **Live search:** add the Tavily package (`@tavily/core`) and a new `offerSearch` agent. It searches a fixed allow-list of 14 trusted baby-offer pages (in `research/v2-offers-research.md`), reads them, and turns each into an offer. **Every new offer goes through the existing fine-print court before a parent sees it.**
  - Store the summary, link and date only, never whole pages. Test the 3 sites that block automated readers first (Walmart, Huggies, mass.gov) and drop any that fail.
  - Practice mode shows the "Checking 16 saved offers" line. Live mode shows "Searching 14 trusted baby-offer sites…" and "New · found today" tags.
- Fix the exact-age line: "Your baby is 20 days old. This offer is for babies 0–12 months."
- **Audit-a-deal form** (rule 10): a new rate-limited route that wraps the court for typed or screenshot input.
  - It has a guard against hidden instructions in pasted text.
  - Pasted offers are never saved to the graded-offers table.
  - Practice mode falls back to the rule-based check and says so.
- Offer report card strip (from `/api/offer-audit`) and the "You're helping other parents" thank-you.
- Affiliate-ready but **off**: an empty "Paid link" label slot, and a rule that grading happens before any link is attached and sorting never uses commission.

### Lane E: accounts and Account tab (Story 6 + accounts, about 8 hours; the biggest lane)
- Bring back Firebase from Colin's template (commit a9542c2): about 60% of the server code can be reused, but the sign-in screen is rewritten without passwords.
  - Browser: `client/src/lib/firebase.ts`, Google popup, email link and a `/signin-finish` page.
  - Server: `server/middleware/auth.ts` checks the sign-in token.
  - The `VITE_*` keys need `envDir` set so the browser can read them; Render needs them at build time.
- "Save your plan so you don't lose it" card on Home **after** the first results, never before (onboarding rule: account after the payoff). It has "Continue with Google", "Email me a sign-in link" and "Not now."
- On sign-in, the guest family, ticked tasks, photos and last run move to the account.
- **Demo sign-in** button, clearly labelled, accepted only in SAMPLE_MODE or when no Firebase key is set.
- Account tab (new tab):
  - editable profile with the 5 answers (editing re-runs the check)
  - Gear Locker
  - **"What Bundle remembers about your family":** profile answers and gear written into Meterless memory, shown with friendly labels and a "Technical details" toggle
  - **"What Bundle has learned from parents"**
  - progress ring
  - "Signed in as … · Sign out", "Start over" and "Forget everything" (one delete that also removes the Firebase sign-in record)
- Parents only see their own family's data (every request checks it).

### Step 6: join-up and proof (about 2 hours, after the lanes)
- Run `npm test`, `npm run test:v2` and the type check (`npm run check`); all must pass.
- Re-record the Zetaris replay and regenerate the saved sample run (`npm run examples:regen`).
- A helper clicks through the full flow in the real app with the `agent-browser` skill and takes screenshots.
- Update the README and the demo script.

**Total:** about 28 hours of helper work in 5 parallel lanes, which is about 10–12 hours of clock time. That leaves a buffer before Oct 27.

**Cut line, if time runs short (in this order):**
1. Email-link sign-in (keep Google and Demo)
2. Offer report card
3. Carrier booster
4. Taxes booster

Never cut: the 5 questions, the honest checking screen, gear scan with a real recall check, money buckets, live search, Google sign-in.

---

## 5. Tests (1–2 per story, in `bundle/client/src/__acceptance__/v2/`)
The existing 12 tests stay, updated to the new wording and shape:

| Story | Tests |
|---|---|
| S1 | (a) Q4 "Just me / Two of us" shows the right parent rows, Back keeps answers, and the run request carries household, both work answers and insurance. (b) For a two-parent home with one "Not working right now", the checking screen has **no** Dependent Care FSA line, lines appear one by one, and results show only after "View my results." (+ insurance pill test, kept) |
| S2 | (a) The Home "Scan gear or a receipt" button opens the "What are you scanning?" sheet, and a gear result shows "No recalls found" and lands in the Gear Locker. (b) A receipt result shows a thumbnail and "Receipt · N items" in the locker. |
| S3 | Kept: the three buckets, spring 2027 vs. 2028. |
| S4 | Kept: drawer and counters; quick wins. |
| S5 | (a) The Audit form has "Who's offering it?", "What do you get?", a link field, "Paste the text" / "Add a screenshot", and the verdict names the store. (b) In live mode (mocked search reply), new offers show "New · found today" and a grade. (+ age line, kept) |
| S6 | (a) The Account tab shows friendly memory labels ("Remembered from your setup") with no raw "mem-" visible until "Technical details" is tapped. (b) The "Save your plan" card appears only after results, and "Demo sign-in" signs in and shows "Signed in as". |

These all fail today, by design. Each one turns green when its lane is done.

# V2 build plan (revision 2, Oct 25, 2026)

This is the plan to build from. Earlier versions:
- `plans/old-versions/v2-feedback-response-2026-10-25-v1.md` (first response)
- `plans/old-versions/v2-build-plan-2026-10-25-v1.md` (revision 1, before the outside review)

The reasoning and sources are in `plans/v2-feedback-response.md` and the research files:
- `research/v2-feedback-research.md` (benefit facts)
- `research/v2-accounts-research.md` (sign-in research; now mostly not used, see R1)
- `research/v2-offers-research.md` (live search and affiliate feeds)

**Scope:** all 6 stories, live offer search, and saved profiles, all in before the deadline (**Oct 27, 7:45pm Boston time**).

Words used below:
- **localStorage:** a small memory inside the browser that keeps a value after the page is closed.
- **Tavily:** a search service built for AI agents.
- **Nightshift:** Meterless's AI "hotspot" program that runs on the Mac and passes the app's AI requests to a model.
- **Migration:** a small script that adds new columns or tables to the database.
- **Replay cache:** the saved Zetaris answers that let practice mode (SAMPLE_MODE) run offline.
- **Timeout:** a time limit after which the app stops waiting.

---

## 1. Change log

### Round 2: Lyndsay's review (Oct 25)
| # | Change | Where it lives now |
|---|---|---|
| 1 | Q4 asks "Just me / Two of us", then shows a row for each parent: "Paycheck from a job" / "Self-employed or freelance" / "Not working right now", each with a grey hint | Lane A |
| 2 | The checking screen goes slowly and never moves on by itself | Lane A |
| 3 | The daycare line shows only when the family qualifies | Lane A, `shared/eligibility.ts` |
| 4 | Affiliate feeds come after the hackathon (apply to Impact and Awin now); Tavily now | Lane D, section 3 |
| 5 | ~~Firebase accounts~~ → **replaced by R1** | Lane E |
| 7 | Receipt photos are saved | Lane C |
| 8 | Friendly memory labels | Lane E |
| 9 | Scan buttons on Home, in the header and on Savings | Lane C |
| 10 | Audit-a-deal form with a screenshot option | Lane D |

### Round 3: outside review (Oct 25)
| # | Feedback | What changed | Where it lives now |
|---|---|---|---|
| R1 | Firebase sign-in is a demo risk and earns no points | **Firebase is removed.** Profiles are saved in the `families` table, and the browser remembers the family id in localStorage (`bundle_family_id`). The Account tab gets a **"Switch family"** menu: Maya, Leo, Ava, My saved profile. | Step 0, Lane E, section 3 |
| R2 | Saving no pasted offers stops the graded-offers database from growing | Audited offers **are saved** to `offer_checks` with `source: 'user_audit'` when the court is confident and no hidden instructions were found. They then show up in `/api/offer-audit`, the Zetaris views and the next parent's instant verdict. | Step 0, Lane D |
| R3 | Live search is slow and may fail on stage Wi-Fi | Live search **runs in the background and never blocks** the page. Saved offers show at once; new ones slide in with "New · found today". The search gives up after a 10-second timeout and quietly keeps the saved offers. | Lane D |
| R4 | Check that Meterless Nightshift works | A check step proves `MODEL_PROVIDER=nightshift` works and that traces are stamped with Nightshift. (The app already supports it in `server/adapters/llm.ts`, and `npm run model:check -- --provider nightshift` exists.) | Lane E, Step 6 |
| R5 | Remove "Likely a good deal" filler | Offer cards show the court's real findings: verdict, traps, hidden fees, minutes of effort and true value. | Lane D |
| R6 | "Not relevant" must lower the headline number | It takes the card's amount off "Still to claim" at once, moves the card to a closed **"Dismissed"** drawer, and offers an instant Undo. | Lane B |
| R7 | Photo tips so the AI can read the label | The gear camera sheet shows a framing guide and tip. | Lane C |
| R8 | Back must not lose your place | Back from card detail or the Account tab returns to the same tab at the same scroll spot. | Lane E (navigation), Step 6 test |

### Removed in round 3
- **Firebase sign-in:** Google button, email sign-in links, the `/signin-finish` page, the server's sign-in check, the `users` table, and the `VITE_FIREBASE` and Render key steps.
- **"Demo sign-in" button and "Signed in as … · Sign out":** replaced by the Switch-family menu and "Saved on this device."
- **Lyndsay's to-dos for Firebase:** the console clicks, the paid-plan decision, the Render Firebase keys.
- **"Pasted offers are never saved"** (replaced by R2).
- **The "Likely a good deal." sentence** (replaced by R5).
- **Lane E estimate cut from about 8 hours to about 4.** Total work cut from about 28 hours to about 24.

### Where I did not copy the review word for word
- **"Searching 14 verified merchant feeds."** These are trusted web pages, not merchant feeds, so the copy stays **"Searching 14 trusted baby-offer sites."** The review's own fix calls them merchant feeds, which would be untrue on screen.
- **"Confidence ≥ 0.8."** The court has no single confidence number today. The plan defines "confident" as **both sides of the court agreeing** (the same test that already decides which grades get saved) **plus** no hidden-instruction warning. Saved user audits are labelled "from a parent" in the report card, so they never pass as Bundle's own checks.
- **"Immediately updates" the Zetaris views.** True in live mode. In practice mode Zetaris answers come from the saved replay, so the new row shows from the app's own copy and appears in Zetaris after the next re-recording.
- **"Nightshift is mandatory."** The rules require Meterless (memory, and Nightshift where it fits), not Nightshift by name (`hackathon-resources/hackathon-overview.md:39,152`). The check is in anyway, because it's cheap.
- **"Dismissed Items" vs. "Dismissed Tasks"** (the review uses both). The drawer is called **"Dismissed"**, kept separate from the **"Claimed"** drawer, because "I got this" and "Not relevant" do different things to the money (section 2, Lane B).

---

## 2. Unchanged from the first response
These still stand as written in `plans/v2-feedback-response.md`:
- Q1–Q3
- Q5's five insurance choices and their deadlines
- The money buckets, including the tax year worked out from the date and the "baby's account" label for the Trump Account
- The quick-win filter, with minute estimates on benefits
- The "No recalls found" wording, the real recall counts, and NHTSA for car seats
- Profile Boosters: filing status on the Taxes tab with the MA 529 line, the renamed W-4 item, and "Questions to ask HR"
- The offer report card and the "You're helping other parents" moment
- Moving "Start over" into the Account tab
- The corrected file map, and no claim of 70,000 lines
- The insurance-company question is not part of onboarding
- The "Every result double-checked" line stays

---

## 3. What Lyndsay needs to do (only she can)
1. **Tavily key, 5 minutes:** sign up at tavily.com (free, no card) and put the key in `.secrets/bundle.env.local` as `TAVILY_API_KEY`.
2. **Affiliate applications (optional, about 20 minutes each):** Impact and Awin, using your own details. Approval comes after Oct 27.
3. **Nightshift on:** have the Meterless Nightshift app running on the Mac when the helper runs the check (R4). The token file is already set (`NIGHTSHIFT_TOKEN_FILE`).
4. **Live Zetaris re-recording at the end:** one `npm run zetaris:record` run, so practice mode includes the new offers, user audits and graded rows. A helper can run it if the Zetaris keys are in `.secrets/`.

(Removed: the Firebase console, the paid-plan decision, the Render Firebase keys.)

---

## 4. Build order

Five lanes run in parallel, each in its own files. **Step 0 goes first.**

### Step 0: shared foundation (about 1.5 hours)
- **One database migration:**
  - `families` gets new columns: `household`, `parent1_work`, `parent2_work`, `insurance`, `saved_at`.
  - `purchase_items` gets `photo_id`.
  - New tables: `item_photos` (thumbnail and receipt image as text) and `claims` (family, card, status `got_it` or `not_relevant`).
  - `run_results` gets `family_id`.
  - `feedback.kind` gains `not_relevant`.
  - **`offer_checks` gets `source`** (`court` or `user_audit`) for R2.
  - (No `users` table; removed by R1.)
- **Shared types:** `Family` gains household, work and insurance. `FeedCard` gains `category` (money_back, tax_time, leave, gift or info) and `minutes`.
- **Sample families:** add the new answers to `families.json` (Maya: two parents, both with a paycheck, insurance through a job). Make sure Leo and Ava are set up too, since they appear in the Switch-family menu.
- **Rule:** don't change any Zetaris SQL text the app sends today. New queries are fine.

### Lane A: onboarding and checking screen (Story 1, about 4 hours)
- Q4 in two parts and Q5. Both have "Why we ask" and "prefer not to say". Back keeps answers. "Try a sample family" fills all 5.
- `shared/eligibility.ts` decides daycare FSA vs. childcare credit vs. nothing, and which insurance deadline applies.
- Checking screen:
  - Lines come from the answers. The recall line shows only if the family has items. The daycare line follows the eligibility rule.
  - About 1.3 seconds between lines, then the "We found $X… View my results →" reveal. Nothing moves on by itself.
- Insurance tab: the countdown pill follows Q5. "Questions to ask HR" and the optional carrier booster.
- **Save on finish:** when onboarding finishes, the family is saved to `families` and its id goes in localStorage (R1).

### Lane B: money and tasks (Stories 3 and 4, about 4 hours)
- Set `category` and `minutes` on the server, then show the three buckets on Home (tax year from the date, empty-state text, leave line).
- **One "I got this" path** for cards and the detail page. It moves the card to the **"Claimed"** drawer, takes the amount off **"Still to claim"** and adds it to **"Claimed so far"**.
- **"Not relevant" (R6):** takes the amount off "Still to claim" at once, without adding it to "Claimed so far". The card moves to a closed **"Dismissed"** drawer. An Undo appears for a few seconds, and Undo is also available inside the drawer. The headline money number on Home goes down too, so nothing counted is something the parent said doesn't apply. It's saved to `claims` and `feedback`, and the Coach (the agent that learns from parent feedback) learns from it.
- Quick wins filter. Taxes filing-status booster.

### Lane C: gear scan and locker (Story 2, about 4 hours)
- Scan entry points: a card on Home, a "Scan" button in the header, a card on Savings, and the empty-locker button. The sheet asks "What are you scanning?": gear or receipt.
- **Framing guide (R7):** the gear camera view shows a dashed frame and this tip: **"Tip: frame the white manufacturer label or barcode sticker. It's usually under a car seat, on the back of a high chair, or on a stroller's rear frame."** If the photo can't be read, the app says exactly that: "We couldn't find a model number. Try the white label." It never guesses.
- Save gear and receipt photos to `item_photos` (location data stripped; "Forget" deletes them).
- Fix the skipped recall check for guest families. Use the NHTSA car-seat recall file (69 rows). Run the recall check from the photo route. Receipts also get the money-back check.
- Result card with "No recalls found as of [date]…" and "Register it with Graco →". Gear Locker on Savings and Account. Record a sample photo and a sample receipt for practice mode.

### Lane D: deals and live search (Story 5, about 5 hours)
- **Live search, never blocking (R3):**
  - Opening Deals shows the saved, already-graded offers **at once**. Live search starts in the background, with a small line: "Searching 14 trusted baby-offer sites for new offers…"
  - Tavily (`@tavily/core`) searches the 14-site allow-list. Each result goes through the fine-print court, then slides in with a **"New · found today"** badge.
  - **10-second timeout.** On a timeout, error or no internet, the line changes to "No new offers right now. Showing your checked offers." No spinner is left running and no error appears.
  - Practice mode skips the search and says "Checking 16 saved offers against your baby's age (Day 20)."
- **Objective offer copy (R5):** delete the "Likely a good deal." sentence (`server/agents/finePrintCourt.ts:217, :331`). Each offer card shows:
  - 🛡️ **Fine Print Court: Approved** (0 subscription traps, $0 hidden fees). Or "Approved with a catch: [the catch]", or "Blocked: [reason]".
  - ⏱️ **About N minutes** (e.g. "online registry setup only"), from the existing effort estimate.
  - 💵 **True value $X**, from the existing true-value field.
  - **Age:** "Your baby is 20 days old. This offer is for babies 0–12 months."
- **Audit-a-deal form:**
  - Fields: who's offering it, what you get, a link, and the fine print (pasted or a screenshot).
  - It runs on a rate-limited route with the hidden-instruction guard.
  - **Saving (R2):** if both sides of the court agree and no hidden instructions were found, it's saved to `offer_checks` with `source: 'user_audit'` and an offer id built from the store and offer text. The next parent who audits the same offer gets the saved verdict instantly. Otherwise it's shown but not saved, with the line "Shown to you only; not added to the shared list."
  - In practice mode the rule-based check runs and says so. User audits are saved only when the full AI court ran.
- Offer report card (from `/api/offer-audit`): user-audited offers are counted and marked "from a parent". Plus the "You're helping other parents" thank-you, which now gives a real count when a user audit is saved.
- Affiliate-ready but **off**: grade before any link is attached, never sort by commission, and leave a "Paid link" label slot for later.

### Lane E: profiles, Account tab, Nightshift check (Story 6, about 4 hours)
- **Saved profile (R1):**
  - When the app opens, it reads `bundle_family_id` from localStorage and loads that family from `families`. If none is found, it starts onboarding.
  - Claims, photos and runs are tied to the family id. No sign-in.
- **"Switch family" menu** at the top of the Account tab: Maya, Leo, Ava, My saved profile. Switching loads that family's last results instantly from saved runs. Sample families are labelled "Sample".
- Account tab:
  - Editable 5 answers (editing re-runs the check) and Gear Locker.
  - Memory, with friendly labels and a "Technical details" toggle: **"What Bundle remembers about your family"** (answers and gear written into Meterless memory, tagged with the family) and **"What Bundle has learned from parents"**.
  - Progress ring, "Start over", and "Forget everything", which deletes the family, claims, photos and memory entries, then clears localStorage.
  - Trust line: "Saved on this device. No account needed."
- Optional "Save your plan" card on Home after the first results: "Your plan is saved on this device. Add a name for it (optional)." No email, no sign-in.
- **Back keeps your place (R8).** Returning to the right tab already works today: the app remembers the tab in the browser's per-tab memory. The new part is the scroll spot.
  - The tab and scroll spot are remembered when leaving a tab, and restored on Back from card detail, the Account tab or any sub-view.
  - Back from card detail returns to the tab the card came from, not Home.
- **Nightshift check (R4):**
  - With Nightshift running, `MODEL_PROVIDER=nightshift` plus `NIGHTSHIFT_TOKEN_FILE` makes `npm run model:check -- --provider nightshift` pass.
  - One live run shows `nightshift:` in the provider label on agent trace lines (already produced by `providerLabel` in `llm.ts`).
  - Save the output to `progress/reviews/nightshift-check.md` for the judges.
  - If Nightshift isn't running, the app falls back to NVIDIA as it does today. Record that outcome honestly.

### Step 6: join-up and proof (about 2 hours)
- `npm test`, `npm run test:v2` and `npm run check` must all pass.
- Re-record Zetaris. Regenerate the sample run (`npm run examples:regen`).
- A helper uses `agent-browser` to click through the full flow in the real app, including:
  - Switch family
  - Back keeping your place
  - Deals with the Wi-Fi off (it must fall back cleanly)
  - an audit that gets saved and then reused
- Nightshift check output saved. README and demo script updated.

**Total:** about 24 hours of helper work in 5 parallel lanes, which is about 9–11 hours of real time.

**Cut line, in this order:**
1. Offer report card
2. Carrier booster
3. Taxes booster
4. Screenshot audits (keep pasted text)

**Never cut:** the 5 questions, the honest checking screen, gear scan with a real recall check, money buckets with honest "Not relevant", live search with fallback, saved profiles plus Switch family, and the Nightshift check.

---

## 5. Tests (in `bundle/client/src/__acceptance__/v2/`)
| Story | Tests |
|---|---|
| S1 | (a) Q4 household rows, Back keeps answers, and the run request has all the answers. (b) Two parents with one not working: no FSA line, lines appear one at a time, and nothing shows until "View my results". (c) Insurance pill. |
| S2 | (a) Home "Scan gear or a receipt" opens the sheet. **The gear view shows the framing tip ("white manufacturer label")**, the result shows "No recalls found", and the item is in the locker. (b) A receipt shows a thumbnail and "Receipt · 3 items". |
| S3 | The three buckets; spring 2027 vs. 2028. |
| S4 | (a) "I got this" moves the card to "Claimed": Still to claim goes down and Claimed so far goes up. **"Not relevant" moves the card to "Dismissed": Still to claim goes down, Claimed so far is unchanged, the headline number goes down, and Undo puts it all back.** (b) Quick wins. |
| S5 | (a) Age line, plus **the offer card shows "Fine Print Court: Approved", minutes and true value, and never "Likely a good deal"**. (b) Audit form: the verdict names the store, and **a confident audit shows the "added to the shared list" line and sends `source: 'user_audit'`**. (c) Live search: saved offers show **before** the search answers, new offers get "New · found today", and **a failed or timed-out search shows "No new offers right now" with saved offers still there**. |
| S6 | (a) Friendly memory labels; no "mem-" until "Technical details" is tapped. (b) **The "Switch family" menu changes to Leo and shows Leo's answers. A saved family id in localStorage reloads that family without onboarding. Back from card detail returns to the same tab.** |

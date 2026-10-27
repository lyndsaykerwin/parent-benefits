# Lyndsay's Oct 26 comments: where each one lives in the code, and how to fix it

Research only. No app code was changed. Written Oct 26, 2026 (about 08:45 Boston time).

**What I could and could not check**
- **The app was not running.** Nothing answered on http://localhost:5050 when I checked (connection refused, and no Node server listening). I was told not to start one, so I could not click through #8 or #13 in a browser. Their causes come from reading the code, and they are clear from it.
- **The database was read with SELECT only.** "SELECT" means look, never change.
- **Every link was checked twice:** once with `curl` (a command-line tool that fetches a web page and reports its status code) and, for the pages that need a real browser, with agent-browser.
- **Walmart.com shows a "Robot or human?" check** (a CAPTCHA, a puzzle that proves you are a person) to every automated visitor. I did not try to get past it, so Walmart's terms come from search results.

Sizes: **S** = under 30 min, **M** = 30–90 min, **L** = over 90 min.

---

## 1. The plan should save itself and just say "saved". Size S

**Files**
- `bundle/client/src/pages/tabs/Extras.tsx` lines 34–75: `SavePlanCard`
- `bundle/client/src/lib/account.ts` lines 4–18: `loadPlan`, `savePlan`
- The card is placed in `bundle/client/src/pages/tabs/HomeTab.tsx` line 86.

**What happens now.** The plan is already saved without the parent doing anything:
- The finished results are stored on the server (the `run_results` table).
- The family's id is kept in the browser (`localStorage`, the browser's own small storage, written in `client/src/lib/bundle.ts` line 278).

But the Home tab still shows a card titled "Your plan is saved on this device", with an "Add a name for it (optional)" box, a "Save name" button and "Not now". That reads like a task the parent has to finish. The green "Plan saved" confirmation only appears after they type a name.

**Fix.**
- Replace the form with a single passive line on Home: "✓ Saved on this device. No account needed."
- If you want, also show a small toast (a pop-up note that fades by itself) the first time results open.
- Move "Name your plan" to the Account page, which already uses `loadPlan(...).name` (AccountTab line 144).
- Delete the "Not now" and "hidden" logic.

**Risk.** Low. Tests that look for `save-card` / `save-name-input` will need updating: search `__tests__` and `__acceptance__/v2` for `save-card`.

---

## 2. "Trump Account" should not sit under taxes; make the Social Security number need clear. Size M

**Files**
- `bundle/shared/cardMeta.ts` lines 13–21: `cardCategory`. The last line sends every checked benefit with a dollar amount to `'tax_time'`, so `benefit-trump_account` lands in the "At tax time" bucket on Home.
- `bundle/shared/bundle.ts` line 2: the list of allowed categories (`'money_back' | 'tax_time' | 'leave' | 'gift' | 'info'`).
- `bundle/client/src/pages/tabs/Buckets.tsx` lines 14, 29–31: the bucket rows. There is already a "Goes into your baby's account" pill.
- `bundle/client/src/lib/tabs.ts` line 31: on the tabs, the card already goes to **Savings**. Only the Home bucket is wrong.
- `bundle/client/src/pages/tabs/TaxesTab.tsx` line 13: already leaves it out of the Taxes list.
- `bundle/server/agents/benefits.ts` lines 15–17 (the 2025–2028 dates) and line 48 (the card wording when the AI is off).
- `bundle/data/sample/fallback-rules.json` and the `benefit_rules` row `TRUMP_ACCOUNT`, whose source is `https://trumpaccounts.gov`.

**Root cause.** `cardCategory` has no category for "money into the baby's account", so the catch-all "tax time" rule picks it up.

**Fix.**
1. Add a category such as `'baby_savings'` and return it for `benefit-trump_account`.
2. In Buckets, render a fourth box, "Your baby's savings account": "$1,000 from the government, deposited into a Trump Account."
3. Change the card text to say what is needed. Proposed: "Your baby needs a Social Security number first (you can request one at the hospital when you fill in the birth certificate form). Then sign up with IRS Form 4547, either with your tax return or online at trumpaccounts.gov. We don't need your number."
4. Keep it counted in the big total, as now.

**Risk.** Medium-low. The new category has to be handled anywhere `CardCategory` is switched on: `Buckets.tsx`, `cardMinutes`, and the acceptance tests `s3-money-buckets.test.tsx` and `s4-one-tap.test.tsx`.

**Current rules, checked against current sources:**
- **Who gets the $1,000.** The $1,000 "pilot program contribution" is for children born from Jan 1, 2025 through Dec 31, 2028. The child must be a U.S. citizen with a valid Social Security number (SSN). The app's 2025–2028 range matches.
  - Source: IRS IR-2026-42, Mar 31, 2026: https://www.irs.gov/newsroom/4-million-children-have-been-signed-up-for-trump-accounts-with-1-million-claiming-the-1000-pilot-program-contribution
- **How to sign up.** File Form 4547 ("a one-page form… just check the box") with the tax return, or through the IRS online portal at trumpaccounts.gov. The person filing is normally the parent who will claim the child.
  - Source: the IRS release above, plus TaxAct's guide to Form 4547: https://www.taxact.com/support/45386
- **When.** Money could first be added on July 4, 2026. Account activation started in May 2026.
  - Source: Treasury/IRS proposed rules, March 2026: https://www.irs.gov/newsroom/treasury-irs-issue-proposed-regulations-for-trump-accounts-contribution-pilot-program-treasury-department-to-deposit-1000-into-the-account-of-each-eligible-child
  - Coverage of the same rules: https://www.journalofaccountancy.com/news/2026/mar/irs-proposes-regulations-for-trump-accounts-pilot-program/
- **Caveat.** The March 2026 rules were *proposed*. I did not find the final version, so keep the wording "likely eligible".
- **Link check.** trumpaccounts.gov answers 403 ("blocked") to automated tools, because of a Cloudflare "Just a moment…" page (Cloudflare is a service that screens out robot visitors). A real browser should open it fine.

---

## 3. "Child Tax Credit (up to $1,700 refundable) $2,200" is confusing. Size S

**Files**
- `bundle/client/src/pages/tabs/Buckets.tsx` line 21: `const NOTE = { 'benefit-federal_child_tax_credit': 'up to $1,700 refundable' }`. It is printed in brackets next to the $2,200 amount (lines 28 and 34).
- The amount itself comes from `bundle/data/sample/tax-parameters.json` / `benefit_rules` (`amountCents: 220000`).

**Root cause.** The two numbers are both correct, but they answer different questions, and the screen does not say so:
- **$2,200** is the most the credit can lower your tax bill, per child.
- **$1,700** is the most of that you can get back as a refund if you owe little or no tax. That refundable part is the "Additional Child Tax Credit".

"Refundable" is jargon.

**Fix (pick one).**
- Option A: drop the note from the bucket row, and explain it once on the card: "Lowers your tax bill by up to $2,200. If you owe less than that, up to $1,700 can come back to you as a refund."
- Option B: change the note to "up to $1,700 of it as a refund if you owe little tax".

**Recommendation:** A. The bucket stays clean.

**Risk.** None. One acceptance test may check this text: `grep -rn "1,700" client/src/__acceptance__`.

**Checked against the source.** Rev. Proc. 2025-32, section .05, gives these figures for tax years beginning in 2026: a maximum credit of $2,200, and $1,700 as the refundable amount. I read the IRS PDF itself: https://www.irs.gov/pub/irs-drop/rp-25-32.pdf. The app's numbers are right.

---

## 4. "Fine Print Court" means nothing to users; say "Fine Print". Size S

**Every place a user can see it** (code comments left out):

| File:line | Text now | Proposed |
|---|---|---|
| `client/src/lib/offers.ts` 46 | `Fine Print Court: Approved with a catch: …` | `Fine print: OK, with a catch: …` |
| `client/src/lib/offers.ts` 47 | `Fine Print Court: Blocked: …` | `Fine print: Blocked: …` |
| `client/src/lib/offers.ts` 49 | `Fine Print Court: Approved (0 subscription traps, $0 hidden fees)` | `Fine print: OK (no subscription traps, no hidden fees)` |
| `client/src/lib/offers.ts` 45 | `Rule check only. The full AI court runs in live mode.` | `Quick check only. Read the terms before you sign up.` |
| `client/src/pages/tabs/DealsTab.tsx` 101 | `Fine Print Court: Blocked:` | `Fine print: Blocked:` |
| `client/src/lib/bundle.ts` 123 | section title `Deals that passed Fine Print Court` | `Deals whose fine print checks out` |
| `client/src/lib/bundle.ts` 159 | `Offers not yet checked by Fine Print Court` | `Offers we haven't checked yet` |
| `client/src/lib/bundle.ts` 192 | agent label `Fine Print Court` (used in step lists) | `Fine print check` |
| `client/src/components/HowWeCheckedSections.tsx` 71 | `Offers our Fine Print Court blocked.` | `Offers we blocked because of their fine print.` |
| `client/src/components/FeedCardView.tsx` 95 | aria-label `What the Fine Print Court found` (read aloud by screen readers) | `What the fine print says` |
| `client/src/components/AuditDeal.tsx` 118 | `When both sides of our court agree…` | `When our checks agree…` |
| `client/src/pages/Smarter.tsx` 157 | `the court approved / rejected the trap offer` | `our fine-print check …` |
| `server/agents/fallback.ts` 50 (card body) | `Fine Print Court has not checked it.` | `We haven't checked its fine print yet.` |
| `server/agents/finePrintCourt.ts` 65, 67 (card body when the AI is off) | `Court was offline; …` | Already removed before display (`howWeChecked.ts` 150, `bundleRoutes.ts` 117). Better: change the text at the source. |

**Owner-only screens** (Feed.tsx line 21, the agent step list; AgentWorkspace.tsx line 153) can keep "Court". They are only seen with a reviewer code (a private access code for judges and the owner).

**Fix.** Find and replace the user-facing strings above. Leave the internal name `fine_print_court`, which is stored in the database and logs, alone.

**Risk.** Tests check exact wording. Run `grep -rln "Fine Print Court" client/src/**/__tests__ client/src/__acceptance__ server/__tests__` and update them. `server/__tests__/finePrintCourt.test.ts` is about the agent, not the words, so it is safe.

---

## 5. A clear limit for what fine print blocks an offer. Size M (policy plus code)

**How a verdict is decided today.** There are two deciders, and the stricter one always wins.

1. **Fixed code rules, no AI** (`bundle/server/agents/finePrintRules.ts`, `checkFinePrint`, lines 147–297).
   - Patterns read fees, membership, auto-renewal, minimum spend, deadlines and effort flags from the text.
   - The decision itself is at lines 270–273. An offer is **rejected** if any of these catches is found:
     - `negative_value`: it costs more than it is worth.
     - `auto_renew`: it renews automatically. This includes a trial you can cancel.
     - `expired`: any "expires <date>" in the past anywhere on the page.
     - `prompt_injection`: hidden orders aimed at the AI reviewer.
     - `fee_unknown`: "shipping charges may apply", with no amount.
     - `fee_over_limit`: "free", plus a fee over $5 when no value is stated.
     - `required_membership`: only when no price is given.
   - **Any other catch** gives `approve_with_catch`: minimum purchase, app, account, phone call, form, in-store only, while supplies last, region limits.
   - **No catches** gives `approve`.
2. **The AI "Judge"** (`bundle/server/agents/finePrintCourt.ts`, `judgeOne`, lines 116–205).
   - A "Deal Hunter" and a "Fine Print Lawyer" each argue in 2–3 sentences. A Judge then answers only **approve or reject** (no "with a catch").
   - The Judge's prompt (line 133) says "Reject offers that are not really free or cost the parent more than they save". That is how Prime-only offers get blocked.
   - If the code rules and the Judge disagree, there is one rebuttal round (a second turn for each side to respond).
3. **How the two are combined.** `finalVerdict` (`finePrintRules.ts` lines 133–137) takes the stricter answer. A code "reject" always stands, and an AI "reject" with no learned rule cited also stands (lines 189–196).
4. **When the AI is off** (`screen`, lines 63–69): it rejects on a learned-rule keyword match or `offlineProblem` (`offerScreen.ts`), and otherwise approves with "couldn't fully check".

**Why good offers get blocked.**
- Boilerplate (standard legal wording that appears on most pages) such as "Shipping charges may apply to discounted and free promotional items" sets off `fee_unknown`, which is an automatic reject. Amazon's welcome-box page was blocked this way.
- Any old date on a long page sets off `expired`. Similac was blocked by a footnote for one sub-offer that ended in February 2026.
- The Judge is told to reject anything "not really free". A Prime or Costco membership the family may already have is treated as a trap.

**Proposed rule, in plain words.** Block only what costs money you would not otherwise spend, or can't be used. Everything else is "OK, with a catch", shown clearly.

| Outcome | When |
|---|---|
| **Block** | It costs more than it's worth: known fees plus required spend minus the stated value is below $0. *Or* it turns into a paid plan unless you cancel, and a card is required. *Or* there are hidden orders to the AI. |
| **Hide (not "blocked")** | The main offer has ended. Only count a date that is next to the offer's own words, not any date on the page. |
| **OK, with a catch** | A membership is needed (say "needs Prime"). A fee is stated or "may apply". A minimum spend (say "needs $25 of registry purchases"). Limited stock. In-store only. Region limits. A trial that does **not** need a card. |
| **OK** | Only effort: app, account, form, phone call. Show these as **minutes**, not as catches. |

**Code changes.**
- Edit the `REJECT` list in `finePrintRules.ts` line 271. Move `fee_unknown` and `required_membership` to "catch".
- Make `auto_renew` a block only when `cardRequired` is true or a renewal price is stated.
- Stop counting `phone_call`, `app_required` and `account_required` as catches (the `CATCH_FOR` list, lines 220–230). Leave them in the effort minutes.
- Change the Judge's prompt and the `valid` check to allow `"approve_with_catch"`.
- Allow an AI reject only when it quotes words that really appear in the fine print. `quoteIsExact` (line 127) already exists for this.
- Update the fixed test cases in `bundle/data/sample/fine-print-cases/`.

**Risk.** Medium:
- `server/__tests__/finePrintRules.test.ts` and `finePrintCourt.test.ts` pin today's verdicts.
- Grades already saved in `offer_checks` are reused without asking the AI again (`savedVerdicts.canSkipAi`). After changing the rules, they need re-grading, or the reuse needs to check a rules version number.

---

## 6. Links must be real and live; registry gift fine print must be clear. Size M

**Where links come from**
- The seed offers: the `offers` table, from `bundle/scripts/seed.ts` and `bundle/data/sample/fallback-offers.json`.
- Benefit rules: `benefit_rules`, `data/sample/fallback-rules.json`, `state-programs.json`, `tax-parameters.json`.
- Live-search finds, saved in `offer_checks.source_url`.
- A few links written into the code: `client/src/lib/insurance.ts`, `server/agents/*`.

**Results** (checked Oct 26 with curl, then in a real browser where curl was blocked):

| URL (where used) | Result | Replace with |
|---|---|---|
| `walmart.com/cp/baby-registry/1094765` (seed offer 1315, fallback-offers.json) | Bot wall, so it can't be verified. Lyndsay saw it land on an unrelated page. It is the old page id. | `https://www.walmart.com/cp/baby-registry/1229485`. This is the id in live-search row 9 and the one quoted in a Sept 2026 Slickdeals post. Walmart's own search result also shows `walmart.com/cp/1229485`. Open both in a normal browser to confirm. |
| `target.com/c/baby-registry/-/N-5xtbg` (seed 1314, fallback) | **Wrong page**: the page title says "Jewelry Boxes, Storage & Organization". | `https://www.target.com/help/article/000062588` ("Baby Registry Welcome Kits", 200 OK). For the 15% completion discount: `https://www.target.com/help/article/000062273` (200 OK). |
| `target.com/c/car-seat-trade-in/-/N-4tfr8` (seed 1323) | **404** (page not found) | Target's car-seat trade-in is a seasonal event, so drop the offer, or link to the Target Circle deals page when the event is on. |
| `amazon.com/b?node=17938598011` (seed 1328, "Subscribe & Save", offer_checks row 2) | **Wrong page**: "International Best Sellers" | I didn't find a verified public Subscribe & Save page. Drop the offer, or find the page by hand in a browser before relinking. |
| `amazon.com/b?ie=UTF8&node=21499367011` (live row 13) | **Wrong page**: "All Departments" | Use the welcome-box help page `https://www.amazon.com/gp/help/customer/display.html?nodeId=GBLXVKVYG5SBG8HF` (200 OK, has the real terms). |
| `amazon.com/baby-reg/homepage` (seed 1313) | 200 OK, the registry home page. It mentions the Welcome Box. | Keep, or point to the help page above. |
| `pampers.com/en-us/club` (seed 1316, 1319, offer_checks rows 1 and 6) | **404** ("Oops… Error code: 404") | `https://www.pampers.com/en-us/rewards` (200 OK) |
| `babylist.com/registry-benefits` (seed 1317, fallback) | Redirects to `babylist.com/find` (registry search) | `https://www.babylist.com/hello-baby/babylist-hello-baby-box` (200 OK, has the terms) |
| `enfamil.com/enfamil-family-beginnings/` (seed 1321) | Redirects twice to `/help-center/enfamil-family-beginnings/` (fine) | Use the final address |
| `similac.com/strongmoms.html` (seed 1322) | Redirects to `/rewards.html` | `https://www.similac.com/rewards.html` |
| `buybuybaby.com/registry` (seed 1324) | **404** (redirects to bedbathandbeyond.com, "Page Not Found") | Drop the offer |
| `honest.com/baby-registry` (seed 1325) | **404** | Drop the offer, or find the current Honest page |
| `costco.com/baby-registry.html` (seed 1326) | **404** | Drop the offer |
| `chewy.com/` (seed 1327) | 429 (rate-limited: the site is refusing too many requests). It's the home page anyway, not an offer. | Drop the offer, or link to a specific page |
| `huggies.com/en-us/rewards` (seed 1320) | 403 (Cloudflare bot check) | Probably fine in a browser. Check by hand. |
| `example.com/cuddle-and-co/free-diaper-box` (seed 1318) | Made-up demo "trap" offer | Fine as a demo of a blocked offer. Make sure it is never shown as a live link: it only appears in the blocked list. |
| mass.gov pages (MA PFML, MA child credit, WIC) | 403 to curl ("Not allowed": bot blocking) | Probably fine in a browser. Check by hand. |
| `paidfamilyleave.ny.gov`, `trumpaccounts.gov` | 403 (Cloudflare) | Same: check by hand |
| irs.gov (CTC, p503, p15b, tc602, rp-25-32), healthcare.gov (both), edd.ca.gov, accessdata.fda.gov, aeroflow, byram, savingforcollege | 200 OK | Keep |
| Live finds: enfamil wonderbox, enfamil coupons, similac free-samples | 200 OK (one harmless trailing-slash redirect) | Keep |

**Better long-term fix (M).** Add a "link check" script, `npm run check-links`. It would:
- fetch every `source_url` and fail on a 404, or on a redirect to a different path;
- run in the test suite with a saved allow-list for bot-walled sites;
- be paired with a rule that a card's link must be the page the fine print was read from. The live search already does this; the seed data doesn't.

**Registry welcome-box terms today.** These should replace the made-up one-line fine print in `scripts/seed.ts` / `fallback-offers.json`.

- **Walmart.** Keep the registry for 7 days, add 20+ items, and have **more than $25** of registry purchases (by you or guests). A banner then appears to claim the box. The **$300** figure is a *separate, bigger* tier: spend $300 on registry items to get the box **plus a professional home cleaning**. That is where the "spend $300" confusion comes from.
  - Sources: the Slickdeals post of Sept 6, 2026, citing Walmart's page https://slickdeals.net/f/19978626-create-baby-registry-purchase-300-in-items-get-a-free-welcome-baby-box-and-professional-home-cleaning ; Walmart's page https://www.walmart.com/cp/1229485 (bot-walled for me).
  - Our seed text "in-store pickup only" is **wrong**.
  - Card wording: "Free welcome box after $25 of registry purchases (20+ items, registry open 7 days). Spend $300 and you also get a free home cleaning."
- **Target.** Join Target Circle (free), create a baby registry, add 10 unique items, and have **over $10** purchased from the registry. Online only, as a Target Circle bonus you accept.
  - Source: https://www.target.com/help/article/000062588 (read Oct 26, 2026).
  - Our seed offer only covers the 15% completion coupon, and links to a jewelry-box page.
- **Amazon.** You must be a **Prime member** (or in a Prime household), create a registry, add 10 unique items from the checklist, and have **over $10** of registry purchases. Gift cards don't count. Continental U.S. only, while supplies last. "Shipping charges may apply to discounted and free promotional items" is generic wording.
  - Source: https://www.amazon.com/gp/help/customer/display.html?nodeId=GBLXVKVYG5SBG8HF (live search saved this text Oct 26).
- **Babylist Hello Baby Box.** Create a registry, add 3 items from other stores, complete 40% of the checklist, buy **at least $30 from the Babylist Shop**, then **pay $8.95 shipping**. The arrival date must be between 4 weeks ago and 9 months away.
  - Source: https://www.babylist.com/hello-baby/babylist-hello-baby-box (read Oct 26, 2026).
  - Our seed says "shipping fee may apply", so it is blocked today. Under the #5 rule it becomes "OK, with a catch: $8.95 shipping and a $30 purchase".

**Risk.** Changing seed rows changes `fine_print_hash` (a fingerprint of the exact wording), so saved grades are redone. That is fine and intended. Re-run the seed against Neon with plain INSERT/UPDATE statements, **not** `db:push`: your memory file says drizzle-kit's `db:push` tries to drop constraints.

---

## 7. Is the fine-print grading accurate? Size M (the two bugs below are S each)

**All 13 `offer_checks` rows were read; here is how they compare with the live fine print:**

| Row | Offer | App said | Reality | Right? |
|---|---|---|---|---|
| 3 | Amazon welcome box (seed) | Blocked: "membership required" | Prime *is* required, plus 10 items and $10 of purchases | Reason right, but it should be a catch, not a block |
| 13 | Amazon welcome box (live) | Blocked: "fee may apply; while supplies last" | Blocked for generic shipping wording. It **missed** the Prime need: the text says "customers who are Prime members", which the pattern `requires… Prime` doesn't match. It also missed the $10 purchase: "over $10 of purchases" isn't matched by `MIN_PURCHASE`. | No |
| 7 | Babylist box | Blocked: "fee may apply" | Real: $8.95 shipping, plus a $30 purchase, plus 40% of the checklist | Should be a catch |
| 5 | Walmart gift (seed) | Catch: "in-store only; while supplies last" | The seed fine print is made up and wrong. The real offer is online, 20 items, 7 days, $25. | No: bad input |
| 9 | Walmart (live) | Approved, no catches, no evidence quote | It needs $25 of purchases and 20 items | No: nothing found. The page text was likely thin or bot-walled. |
| 4 | Target 15% completion | Approved | Roughly right, but the link goes to a jewelry-box page | Link wrong |
| 11 | Similac (live) | Blocked: "expired; phone call; account; app" | "Offer expires February 28, 2026" is a footnote for one sub-offer. "Phone call" came from the customer-service number. The app is optional: "eligible for coupons even if you don't download the app". | No |
| 10, 12 | Enfamil (live) | Catch: "phone call; app" | "Phone" matched "**mobile phone**", and the app is optional | False catches |
| 1, 6 | Pampers | Approved | Fine, but the link is a 404 | Link wrong |

**Pattern.** The code rules match words with no sense of context. "phone" matches "mobile phone". Any date counts as an offer end date. Generic wording counts as a fee. On long live pages (up to 6,000 characters of whole-page text, `liveSearch.ts` line 194), almost every page sets something off. Fixes:
- Tighten `FLAGS.needsPhoneCall` (finePrintRules.ts line 102) to "call us to / by phone to claim".
- Treat "download the app" as effort, not a catch.
- Only count a deadline found in the same sentence as the offer's title words.
- Treat "may apply" as a catch, not a block (see #5).
- For live pages, send only the terms section (text after "Terms", "Conditions" or "How to qualify") to the checks.

**Bug A: `face_value_cents` and `true_value_cents` are blank in every row.**
- Root cause: `buildOfferCheckRow` (`server/agents/offerChecks.ts` lines 21–44) saves only `check.faceValueCents`. The code check finds a value only when the text says "($35 value)" or "$X off/back" (`FACE_VALUE`, finePrintRules.ts line 64). None of the real or seed texts do.
- The offer's own value *is* used on the card (`buildOfferFacts`, `faceCents: offer.valueCents`, offerFacts.ts lines 28–29). It is just never passed to the saver.
- Fix: add a `faceCents` argument to `buildOfferCheckRow`, and store `check.faceValueCents ?? faceCents`, with true value = face − hidden costs. Pass `offer.valueCents` from `newsroom.ts` line 150, `liveSearch.ts` line 210 (`face`) and `dealAudit.ts` line 151.

**Bug B: `model` is blank in every row.**
- Root cause: `buildOfferCheckRow` has `model: string | null = null`, and none of the three callers pass it.
- Fix: pass the model name the LLM adapter used (`server/adapters/llm.ts`, which knows its model id) through `ctx.llm`, e.g. an `llm.modelName` property, into the three calls. Note: `liveSearch.ts` also changes `agent` to `live_search`, and that part works.

**Bug C: `checked_at` looks about 4 hours off. It is a read-side time-zone bug, not a write bug.**
- Proof:
  - Row 13 shows as `2026-10-26T16:11Z` when read through the JS driver, but the raw stored value is `2026-10-26 12:11:16` (`checked_at::text`).
  - The database clock read `12:42 UTC` at the same moment.
  - So the stored value (12:11 UTC, which was 08:11 Boston time) is correct.
- Root cause:
  - The column is `timestamp("checked_at")` **without time zone** (`shared/schema.ts` line 178). It holds "12:11" with no zone attached.
  - The JS drivers (the code that talks to the database, Neon and node-postgres) read a zone-less time as *this computer's* local time. On a Mac set to Boston (UTC−4), they treat "12:11" as 12:11 Boston = 16:11 UTC, so it shows 4 hours ahead.
- Fix:
  - Make the column zone-aware: `timestamp('checked_at', { withTimezone: true })`.
  - Run this on Neon by hand: `ALTER TABLE offer_checks ALTER COLUMN checked_at TYPE timestamptz USING checked_at AT TIME ZONE 'UTC';`. Do the same for `recall_checked_at`, `run_results.created_at` and `item_photos.created_at`. As in #6, run it as a plain statement, not `db:push`.
  - Then update `savedVerdicts.ts` line 107, which reads `checked_at`.
- Risk: low. It is a one-way change to the column type, but the `USING` clause keeps the values correct.

---

## 8. "Email to myself" button doesn't seem to work. Size S

**Files**
- `bundle/client/src/pages/tabs/HrQuestions.tsx` lines 29–33. This is the "Questions to ask HR" screen, opened from the Insurance tab (`InsuranceTab.tsx` line 32).
- The same pattern is in `TaxBooster.tsx` lines 81–88.

**What the code does.**
```ts
try {
  if (navigator.share) { await navigator.share({ title: list.title, text }); return; }
} catch { /* closed the share menu: nothing to do */ return; }
window.location.href = `mailto:?subject=…&body=…`;
```

**Root cause (from the code; I could not click it because the app was not running).**
1. On a Mac, both Safari and recent Chrome have `navigator.share` (the "Share" menu built into the browser). So the button opens the system **Share sheet**, not an email. It also has no "To:" address, so it does not read as "email to myself".
2. If sharing fails for any reason other than the parent closing it, the empty `catch { return; }` stops silently and the email fallback never runs. Reasons include sharing being blocked inside the Claude app's browser pane or an embedded frame (`NotAllowedError`).
3. When it does fall back to `mailto:`, the Mac opens Apple Mail. If Lyndsay uses Gmail in a browser and Apple Mail isn't set up, nothing visible happens.
4. In every case the screen shows no message (`setNote` is never called in `email()`).

**Fix.**
- Use the Share sheet only on phones. Check `navigator.maxTouchPoints > 0` together with `navigator.canShare?.({ text })`.
- In the `catch`, return only on `AbortError` (the parent closed the menu). Otherwise fall through to `mailto:`.
- Always show a status line: "Opening your email app… If nothing opens, tap Copy and paste it into an email."
- Optionally add a second link: "Open in Gmail" → `https://mail.google.com/mail/?view=cm&su=…&body=…`. This needs no address and sends nothing by itself.
- Apply the same fix to TaxBooster.

**Risk.** Low.

---

## 9. "How we checked" appears on every card and doesn't always make sense. Size S–M

**Where it shows**
- **The link:** `bundle/client/src/components/FeedCardView.tsx` lines 151–160. It is drawn whenever a `detailHref` is passed. `CardStack` (`client/src/pages/tabs/shared.tsx` lines 45–49) passes it for **every** card on Home, Taxes, Savings, Insurance and Deals.
- **The page:** `bundle/client/src/pages/CardDetail.tsx` lines 124–133. For parents it shows one sentence from `howWeChecked()` (`client/src/lib/tabs.ts` lines 210–214), almost always: "We checked this against its official source before showing it to you."

**Root cause.** It is one fixed sentence for every kind of card. It makes no sense in these cases:
- A "check with your job" card (Dependent Care FSA): nothing was checked; we tell them to ask HR.
- The insurance "add your baby" reminder and paid-leave info.
- The Trump Account and Child Tax Credit cards: these are rules from a table, linked to IRS pages, not a per-family check.
- "Coming soon" tiles.

**Proposal.**

| Card type | Keep "How we checked"? | Instead / what it should say |
|---|---|---|
| Deals (discount) | **Yes**, renamed **"What the fine print says"** | Verdict, catches, minutes, true value, and a link to the terms page |
| Money back (FSA / price-drop clawbacks) | **Yes** | "We matched your receipt line X to the store's policy / FSA list" |
| Recall | **Yes** | "Your model number matched CPSC recall #…" |
| Benefits with a dollar amount (CTC, MA credit, Trump Account, paid leave) | No link | Show a "Source: IRS.gov ↗" chip on the card (the chips already exist, lines 130–148) |
| Check-with-your-job, insurance reminder, coming soon | No | Nothing |

Code: only pass `detailHref` in `CardStack` when `c.kind === 'discount' || c.kind === 'clawback' || c.kind === 'recall'`. Owners (people with the reviewer code) keep the link everywhere, for the audit log.

**Risk.** Low. Some tests click "How we checked" on benefit cards: `grep -rn "How we checked" client/src/**/__tests__ client/src/__acceptance__`.

---

## 10. The photo recall check needs example photos and a clear list of what's needed. Size M

**Files**
- `bundle/client/src/components/scan/ScanSheet.tsx`:
  - line 21: `GEAR_TIP`;
  - line 26: `PHONE_GEAR`, "point at the sticker on the bottom of the car seat";
  - line 100: "Gear (the sticker on the item)";
  - lines 111–124: the camera view, which says "Fit the label inside the dashed frame".
- `bundle/server/ingest/photo.ts`:
  - lines 80–82 and 181: the fields read are `productName, brand, modelNumber, lotCode, upc`. **There is no manufacture date.**
  - lines 406–408: no model number or UPC (the barcode number) → "try the white label".

**Images on disk now** (`bundle/data/sample/photos/`): only `item-graco-sample-label.png` (a made-up car-seat label, model SAMPLE-1042) and `receipt-made-up-baby-mart.png`, plus their `.browser.jpg` copies. There is **no stroller example**, and no example is shown in the app.

**What recall lookups actually need**
- **Car seats (NHTSA, the U.S. road-safety agency).** Manufacturer, model name and number, and **date of manufacture**. They are on a white sticker on the bottom or back of the seat; for an infant seat, the carrier and the base can each have one. Recalls are limited to date ranges, so the date matters.
  - Sources: https://www.canr.msu.edu/news/is_your_car_seat_recalled_what_to_do_who_to_contact_and_when_to_worry ; the Safety 1st 2025 recall, "all dates of manufacture between Feb 28 2023 and Mar 7 2025": https://safety1st.com/pages/safety1st-and-disney-baby-3-in-1-harness-booster-label-recall
- **Strollers (CPSC, the U.S. product-safety agency).** **Model number** and **manufacture date and/or lot number**. The label is usually on the frame near a rear wheel, on a leg, or under the seat. The exact spot changes by brand.
  - Sources: https://www.cpsc.gov/Recalls/2022/Baby-Trend-Recalls-Cityscape-Travel-Jogger-Strollers-Due-to-Fall-and-Injury-Hazards-Recall-Alert (model, date and lot on the inside of the side frame) ; https://www.cpsc.gov/Recalls/2016/Britax-Recalls-Strollers-and-Replacement-Top-Seats (model and date on the frame between the front wheels)

**Fix**
1. Make two example images with a script, the same way the Graco label was made. Both must be made up (no real brand, or a clearly fake "SAMPLE" brand):
   - a stroller frame label: "Model No. SAMPLE-ST200 · Date of manufacture 2026/03/14 · Lot 0314A";
   - a car-seat bottom sticker with the model and "Date of Manufacture".
2. Show the matching one in the capture step, with a caption: "Good photo: the whole white sticker, flat, in focus. We need: brand, model number, date made."
3. Add `manufacturedOn` to the vision prompt shape (`photo.ts` line 181) and to the result. Recall matching can use it later, against the date ranges in recall notices.

**Risk.**
- A prompt change means re-recording the saved vision answers (`npm run record-vision`) so practice mode (SAMPLE_MODE, which replays saved answers) still matches.
- Example images must never show real people or brands.

---

## 11. A slow photo read should say "thanks, we're working on it" and notify the Gear Locker later. Size L

**Current flow (it all happens in one waiting step).**
1. The client sends `POST /api/photo/read` (`client/src/lib/photoPrep.ts` lines 139–151) and waits.
2. The ScanSheet shows "Reading the sticker…" (line 146).
3. The server (`server/routes/photoRoutes.ts` lines 87–120) calls `readPhoto` (`server/ingest/photo.ts` lines 380–425).
4. The vision call goes through `server/adapters/llm.ts`. When busy, it gets up to `BUSY_MAX_TRIES = 4` tries within `BUSY_WAIT_BUDGET_MS = 10_000` (lines 152–155), with pauses of about 1, 2 and 4 s.
5. If NVIDIA is still answering "503 ResourceExhausted", the parent sees `PHOTO_BUSY_MESSAGE`: "The photo reader is busy right now. Try again in a minute." (photo.ts line 21). The photo is thrown away.
6. A garbled answer gets one retry (lines 390–402), then `CLEARER_PHOTO_MESSAGE`.

**What a background ("async") version needs.**
1. **Save first, then read.** Store the photo right away:
   - Add a `status` column (`'reading' | 'done' | 'needs_clearer_photo' | 'failed'`) and `read_error` to `item_photos` (`shared/schema.ts` lines 232–239).
   - Return `202` (meaning "accepted, still working") with `{ photoId, status: 'reading' }`.
2. **Read in the background.** Start `readPhoto` without making the parent wait (a small in-process queue is enough for the demo).
   - When busy, retry with longer pauses: e.g. 3 tries over about 2 minutes, instead of 10 s.
   - When done, write the items to `purchase_items` and set `status: 'done'`.
   - Risk: Render (the hosting service the app runs on) may restart the server. On startup, re-queue any photo still marked `reading`.
3. **Client.** On a 202, the ScanSheet shows: "Thanks! We're reading your photo. We'll add it to your Gear Locker when it's done. You can close this."
4. **Gear Locker.**
   - `GET /api/families/:id/gear` (photoRoutes line 124) also returns photos marked `reading` or `needs_clearer_photo`.
   - `GearLocker.tsx` shows a "Reading…" tile.
   - Check every 5 s while any photo is `reading` (`client/src/lib/poll.ts` already exists).
   - Show a dot/badge on the family chip or Gear Locker entry, plus a toast "Your car seat is in your Gear Locker. No recalls found.", when the status changes.
5. **"Needs a clearer photo" results** become a locker tile with a "Retake" button, instead of a dead end.

**Risk.**
- Medium-high for the deadline. It touches the database (a new column, added by hand on Neon, not `db:push`), the server, the client, and the saved-answer replay in practice mode.
- Cheaper interim fix (S): raise `retryBudgetMs` for photo calls only to about 25 s, and change the waiting text after 8 s to "Still reading. The free photo reader is busy; this can take up to 30 seconds."

---

## 12. The Account page sounds too technical. Size S

**File:** `bundle/client/src/pages/tabs/AccountTab.tsx`. Learned-lesson text is built in `server/agents/newsroom.ts` line 161, and partly cleaned up by `plainLesson` (`client/src/lib/offers.ts` lines 130–134).

| Line | Text now | Proposed |
|---|---|---|
| 292 | "Saved in Meterless memory" (a tag on every remembered fact) | Remove it (or say "Saved for you") |
| 42 | "Remembered from your setup" / "Remembered from your gear locker" | "From your answers" / "From your Gear Locker" |
| 280 | "What Bundle remembers about your family" | "What we know about your family" |
| 284 | "Nothing yet. Bundle remembers your answers and your gear here, so it can check them for you." | "Nothing yet. Your answers and gear show up here so we can keep checking them for you." |
| 298–301, 319–321 | "Technical details" buttons (they show memory ids and `source: setup`) | Show only with a reviewer code (`ownerToken()`) |
| 304 | "What Bundle has learned from parents" | "Tips from other parents" |
| 309–312 | Each lesson reads like `Amazon offer "…" graded approved with a catch: no dollar value stated, about 15 minutes of effort; catches: …` and "Bundle learned this while grading an offer" | Show only lessons that came from parent reports, written as "Parents told us: …". Hide the automatic grading lessons (`reports === null`) from parents. |
| 306 | "When parents report an offer or mark a card not relevant, Bundle learns from it." | "When parents flag a bad offer, we warn everyone else." |
| 244–252 | "Your plan is 72% exact." / "answers left could change your numbers" | "Your numbers are 72% complete. Answer 2 more questions to firm them up." |
| 234 | "Saved on this device. No account needed." | Keep: it is plain |
| 202–204 | "Save and re-check" / "Saving checks your family again with the new answer." | "Save" / "We'll update your results with this answer." |

**Fix.** Change the text only. Put the technical details behind the reviewer code.

**Risk.** Text-matching tests (`accountRoutes.test.ts`, the client `AccountTab` tests).

**Judging note.** Judges need to see Meterless (the required memory/safety tool) doing real work. Keep "Meterless" in the owner-only view and in the agent audit log (`AgentWorkspace`), not on the parent's screen.

---

## 13. The "All checked" screen shows results, then swaps them for "We found $X". Size S

**File:** `bundle/client/src/pages/Feed.tsx`.

**Root cause (from the code; I could not watch it because the app was not running).**
- While the check runs, the parent screen draws two things one after the other (lines 300–306): `ParentProgress` (the checklist) and **`LiveCards`**. LiveCards holds:
  - the cards from the family's *previous* run, fetched by `api.latestRun` (lines 214–231), with the note "From your last check. We're updating these now…";
  - new cards as they stream in (`liveCards()`, lines 69–74).
- When the run finishes, `onDone` (lines 241–244) stores it in `finished`. Two things then change at once:
  - The line `{!(finished && !owner) && <LiveCards …/>}` (line 305) **hides** all those cards.
  - `ParentProgress` swaps in the dark "We found $X for your family" card with "View my results" (lines 126–140).
- So the parent sees results appear and then vanish behind the reveal card. That is the "starts to show results, then replaces them" effect.

**Fix (recommended).**
- Don't render `LiveCards` on the parent screen at all. Keep it for owners: `owner && <LiveCards …/>`.
- Also drop the `api.latestRun` pre-fetch for parents (lines 214–231 then only need to run for owners).
- The parent then sees only the checklist, then "We found $X", then taps through to the tabs.

**Option B**, if "go straight there" means skip the reveal card: in `onDone`, call `saveRun(saved); setRun(saved)` for parents too, which jumps straight to the Home tab. The Home tab already shows "Found for your family $X" at the top (HomeTab line 61).

**Recommendation:** A. The "$X" moment is good for the demo video.

**Risk.** Low. `client/src/pages/__tests__` may test `saved-feed-note` and `live-cards` for parents. Update those to owner-only.

---

## Surprises worth knowing
- **Three links shown to parents go to the wrong page entirely**, not just stale ones:
  - Target registry → "Jewelry Boxes, Storage & Organization";
  - Amazon Subscribe & Save → "International Best Sellers";
  - Amazon live find → "All Departments".
- **Five seed links are 404s:** Pampers, Target trade-in, buybuy BABY, Honest, Costco.
- **The seed fine print for Walmart is invented and wrong** ("in-store pickup only"). The real offer is online with a $25 threshold; $300 is the separate home-cleaning tier.
- **The blank database columns and the "4 hours off" time** are three separate small bugs: the value is never passed, the model name is never passed, and the time is read as local time. None of them changes what the parent sees today, but judges looking at the database would notice.
- **Babylist's box is blocked today** even though its real cost is a known $8.95 shipping fee. That is a clear example for the new threshold rule (#5).

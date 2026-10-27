# Lane B build report: fine print accuracy, links, offer_checks (Oct 26, 2026)

Nothing committed or pushed. All changes are local files plus three database changes on Neon (listed below).

## Results
- `npm test`: 1,388 passed, 1 failed, 11 skipped. The one failure is a photo test (loop 7, photo intake retry), which belongs to Lane C, whose photo code was mid-edit.
- `npm run test:v2`: 22 of 22 passed.
- `npm run check` (the type checker, which catches code mistakes before the app runs): clean, exit 0.
- New test file `bundle/server/__tests__/finePrintPolicy.test.ts`: 28 tests. They cover the blocking rule, every false catch (using the real quoted text), how the AI's answer and the code rules combine, value and model being saved, and the link-check grading.

## 1. Blocking rule (as Lyndsay approved)
In `finePrintRules.ts`, an offer is **blocked** only in these cases:
- **It costs more than it is worth.** The stated fees are bigger than the value printed in the fine print, or else the offer's own listed value.
- **It renews automatically into a paid plan.** It must also either need a payment card or state a price.
- **Its own end date has passed.**
- **It contains hidden orders aimed at the AI.**

Everything else with a catch is **"approve_with_catch"**, including:
- unknown fees ("may apply") and needing a membership such as Prime (`fee_unknown`, `required_membership`);
- a big fee when we don't know the offer's value (`fee_over_limit`);
- minimum spend, limited stock, and similar.

An app, an account, a form or a phone call is now **effort** (it adds minutes), not a catch.

**How the code rules and the AI Judge combine** (`combineVerdict`, `finalVerdict`):
- A code "reject" always wins.
- An AI "reject" blocks only if it cites a learned rule from parent feedback. Otherwise it can at most make the offer "OK, with a catch".
- The AI can add a catch the code missed only if it quotes words that really appear in the fine print. Catches that are only about joining or using an app are ignored.
- The Judge's prompt now states the rule, and the Judge may answer approve / approve_with_catch / reject, plus a "quote".
- The offline screen (used when the AI is unavailable) follows the same rule.

**Other changes:**
- The planted trap ("card on file … paid membership at $29.99/month") is now caught by the code rules alone.
- "needs Prime" is shown as a catch, not counted as a "subscription trap" (`offerFacts.ts`).
- A saved grade is no longer reused once a newer learned rule matches that wording. This keeps the feedback loop working.

## 2. False catches fixed (each has a regression test with the real quoted text)
- **"mobile phone"** no longer means "needs a phone call". Neither does a help-line number ("Or give us a call at 1-800…"). "Call to request a form" still counts.
- **Dates:** a past date counts as "expired" only in short fine print. On a long web page it must be in a sentence that names the offer and is not a footnote. Example that now passes: Similac's "† Offer expires February 28, 2026" footnote about a photo book.
- **Standard shipping wording** is an unknown-fee catch, never a block. This covers "Shipping charges may apply…", "Shipping and handling fees apply", and "subject to additional shipping and handling fees".
- **Babylist:** "pay $8.95 + tax… for shipping" is now read as an $8.95 fee, and "minimum purchase totaling $30" as a $30 minimum. The result is a catch with a true value of $11.05 (the $20 listed value minus the $8.95 fee).
- **App and account:** a page menu's "Download the app", or "even if you don't download the app", is not a required app. A "Sign up" button is not an account requirement.
- **Wording now read correctly:**
  - Amazon's "active Amazon Prime accounts" (membership);
  - "over $10 of purchases", "Purchase over $10", "Over $25 purchased", "Spend $300 on items" (minimum spend);
  - "valued at $100" (stated value);
  - "card on file" (card required);
  - "automatically enrolled" (renews automatically).

## 3. Links: every offer link was checked with a real page load
New command: `npm run links:check` (file `bundle/server/offers/linkCheck.ts`; one line added to `package.json`).
- For each link, it prints whether it passed, the HTTP status (the code a web page returns: 200 means it loaded, 404 means not found), the final address after any redirects, the page title, and where the link is used.
- A link fails if the page is missing or redirects to a different page.
- Last run: **22 links, 19 OK, 0 FAIL, 2 BOT-WALL** ("bot wall" means the site blocks automated visitors), 1 made-up demo link skipped.

| Offer | New link | Status / title |
|---|---|---|
| Amazon welcome box | amazon.com/gp/help/customer/display.html?nodeId=GBLXVKVYG5SBG8HF | 200, "Baby Registry Welcome Box - Amazon Customer Service" |
| Amazon completion discount (replaces buybuy BABY, 404) | …nodeId=GV4FFW94JAGFL4RH | 200, "Baby Registry Completion Discount" |
| Amazon Subscribe & Save, two offers (old link opened "International Best Sellers"; replaces Chewy, which is bot-walled) | amazon.com/b?node=5856181011 | 200, "Amazon.com: Subscribe & Save" |
| Target 15% coupon (old link opened Jewelry Boxes) | target.com/help/article/000062273 | 200 |
| Target Welcome Kit (replaces Huggies, which is bot-walled and couldn't be verified) | target.com/help/article/000062588 | 200 |
| Walmart box and the $300 cleaning offer (replaces the Target trade-in, 404) | walmart.com/cp/baby-registry/1229485 | 200, "Free Baby Boxes & Baby Registry \| Walmart". It loads with curl (a command-line page-download tool), so no browser was needed. |
| Pampers, two offers (old link 404) | pampers.com/en-us/rewards | 200 |
| Babylist box (old link landed on registry search) | babylist.com/hello-baby/babylist-hello-baby-box | 200 |
| Babylist 15% discount (replaces Honest, 404) | babylist.com/registry-discount | 200 |
| Enfamil, two offers (one replaces the Costco page, 404) | enfamil.com/wonderbox-gift | 200, trailing-slash redirect only |
| Similac | similac.com/rewards.html | 200 |
| Cuddle & Co (made-up demo trap) | example.com | Skipped. Blocked cards on example.com or *.test addresses now carry no link (`isDemoUrl`). |

**Still to check by hand:** two benefit links, trumpaccounts.gov and paidfamilyleave.ny.gov. They are behind Cloudflare (a service that blocks automated visitors), even in a real browser through `agent-browser`. Someone needs to open them in a normal browser.

Same 16 offer rows (ids 1313–1328) in `scripts/seed.ts` and in Neon:
- **Kept, with links and wording corrected:** Amazon welcome box, Target 15% coupon, Walmart box, Pampers (two offers), the Cuddle & Co trap, Enfamil, Similac, and Amazon Subscribe & Save on diapers.
- **Seven new verified offers in place of offers whose pages were dead or blocked** (Huggies, Target trade-in, buybuy BABY, Honest, Costco, Chewy, plus the old Babylist "registry benefits" page): Babylist Hello Baby Box, Target Welcome Kit, Walmart home cleaning, Amazon completion discount, Babylist 15% discount, Enfamil friend points, and Subscribe & Save on baby food.

`data/sample/fallback-offers.json` (the bundled stand-in offers) was regenerated from the new seed.

## 4. Registry fine print: copied from the live pages
Each sentence below comes from the store's own page, read Oct 26. The source address sits next to each offer in `scripts/seed.ts` (`OFFER_SRC`).
- **Walmart**, from Walmart's own FAQ on the page above:
  - "Registry must be open for 7 days. A minimum of 20 unique items… Over $25 purchased from and through your registry… valid in the U.S., excluding PO Boxes."
  - The $300 tier is a separate offer: "Spend $300 on items from your registry" gets a free home cleaning (worth $99).
  - The made-up "in-store pickup only" line is gone.
- **Target:** join Target Circle, add 10 items, "Purchase over $10 from your registry", "valued at $100", "Shipping and handling fees apply".
- **Amazon:** "active Amazon Prime accounts… 10 unique items… over $10 of purchases… contiguous United States… while supplies last".
- **Babylist:** 3 items from other stores, 40% of the checklist, $30 Babylist Shop purchase, "pay $8.95 + tax… for shipping".
- **Box values:** where a store gives no dollar value for its box (Amazon, Walmart, Babylist), the existing estimate is kept and marked "est." in the seed file.

## 5. offer_checks (the table of saved grades) now complete
- **Dollar value:** `buildOfferCheckRow` now gets the offer's value. Face value is the value printed in the fine print, or else the offer's listed or headline value. True value is face value minus stated fees.
- **Model name:** taken from the Judge's answer (for example `nvidia-direct:nvidia/nemotron-3-ultra-550b-a55b`).
- **Where this is saved:** the court (`newsroom.writeBack`), live search (`liveSearch.ts`) and parent audits (`dealAudit.ts`).
- **Proof:** new rows 14–38 all have the model filled in, and the value wherever one is known. Rows 21, 25, 27, 28 and 30 came from another lane's live search running the new code.

**Timestamp SQL I ran by hand on Neon** (no `db:push`). It fixes the time-zone mix-up: times are stored in UTC (world standard time), but the column did not say so, so the app read them as Boston time.
```
ALTER TABLE offer_checks ALTER COLUMN checked_at TYPE timestamptz USING checked_at AT TIME ZONE 'UTC', ALTER COLUMN recall_checked_at TYPE timestamptz USING recall_checked_at AT TIME ZONE 'UTC'
```
- I first checked that no database views depend on these columns.
- The 13 old rows now read correctly. For example, row 13 is now `2026-10-26T12:11:16Z`; before, it showed as 16:11Z.
- The schema file (the code's description of the database), `shared/schema.ts`, was updated to match. I changed only the `offer_checks` block.

**Offer data on Neon:** I updated rows 1313–1328 with `UPDATE offers SET title, store, min_age_days, max_age_days, trigger_keyword, value_cents, fine_print, source_url WHERE id=…`, one statement per row, with values filled in safely as parameters.

## 6. Accuracy check: real AI (NVIDIA) on the live fine print of 14 real offers, plus the planted trap
- **"Before"** is the old saved grade where one exists, otherwise what the old rules said about the same text.
- **Model:** nvidia-direct:nvidia/nemotron-3-ultra-550b-a55b.
- **Agreement:** every grade was agreed between the code rules and the AI, with no rebuttal round.

| Offer | Before | After (row) | Catches shown | Right? (quote) |
|---|---|---|---|---|
| Amazon welcome box (seed) | reject, "membership required" (row 3) | catch (14) | needs Prime; $10 minimum; while supplies last | Yes: "active Amazon Prime accounts… over $10 of purchases… while supplies last" |
| Amazon welcome box (live help page) | reject over standard shipping wording (row 13) or Prime missed (row 8) | catch (32) | same three | Yes |
| Babylist Hello Baby Box | reject, "fee may apply" (row 7) | catch (18), true value $11.05 | $8.95 fee; $30 minimum | Yes: "pay $8.95 + tax… for shipping", "minimum purchase totaling $30" |
| Walmart welcome box | catch, made-up "in-store only" text (row 5) | catch (33) | $25 minimum | Yes: "Over $25 purchased from and through your registry" |
| Walmart home cleaning ($300 tier) | old rules: catch (stock only) | catch (36) | $300 minimum; while supplies last | Yes: "Spend $300 on items from your registry" |
| Target Welcome Kit | old rules: approve, nothing found | catch (20), value $100 | shipping fee, amount not given; $10 minimum | Yes: "Shipping and handling fees apply", "Purchase over $10" |
| Target 15% coupon | approve, wrong link (row 4) | approve (15) | none | Yes: "15% off… redeemable twice" |
| Pampers $10 per 10 scans | approve, link 404 (rows 1, 6) | approve (17) | none (app counts as effort) | Yes |
| Similac rewards (seed) | (old seed text) | approve (22) | none | Yes |
| Similac live page | reject: expired, phone, account, app (row 11) | catch (26) | shipping fee, amount not given | Yes: "Offers may be subject to additional shipping and handling fees"; the photo-book footnote date is ignored |
| Enfamil Wonder Box (live) | catch: app (row 10) | approve (38) | none | Yes: joining is free |
| Enfamil coupons (live) | catch: phone, app (row 12; "phone" came from "mobile phone") | catch (37) | AI: "requires enrollment… savings contingent on… purchases" | Partly. The false phone catch is gone. The AI's catch is mostly effort; a rewards program needing purchases is a fair but soft catch. |
| Amazon completion discount | old rules: approve | catch (24) | AI: "$2,000 order cap, $300 max discount" | Yes: "up to a combined value of $2,000, for a maximum discount of $300.00" |
| Cuddle & Co trap (made up) | caught only by the AI; the code rules missed it | reject (19) by code and AI | renews at $29.99/month; card required | Yes |

**Score: 13 right, 1 partly right.** Before this work, 6 of these offers had a wrong verdict or a false catch, and 4 had wrong or dead links.

## Files changed (Lane B only)
- **Rules and grading:**
  - `bundle/server/agents/finePrintRules.ts`
  - `bundle/server/agents/finePrintCourt.ts`
  - `bundle/server/agents/offerChecks.ts`
  - `bundle/server/agents/offerFacts.ts`
  - `bundle/server/agents/newsroom.ts`
- **Live search, parent audits, and two new scripts:**
  - `bundle/server/offers/liveSearch.ts`
  - `bundle/server/offers/dealAudit.ts`
  - new: `bundle/server/offers/linkCheck.ts`, `bundle/server/offers/accuracyRun.ts`
- **Seed and offer data:**
  - `bundle/scripts/seed.ts` (the OFFERS block only)
  - `bundle/data/sample/fallback-offers.json`
- **Schema:** `bundle/shared/schema.ts` (the `offer_checks` block only)
- **package.json:** one line added, the `links:check` script.
- **Tests:**
  - new: `bundle/server/__tests__/finePrintPolicy.test.ts`
  - updated for the new rule: `finePrintRules.test.ts`, `finePrintCourt.test.ts`, `offerRoutes.test.ts`, `loopsEndToEnd.test.ts` (one fee-offer value), `eval.test.ts` (one line), `fallback.test.ts` (titles), and `sampleMode.test.ts`. That last one: the learning-loop demo now uses the Subscribe & Save offer, because the code rules now block the obvious trap on the first run.

## Blockers and follow-ups for other lanes
1. **Practice-mode recordings and examples (Lane E1/E3):**
   - The saved practice-mode answers in `data/sample/zetaris-cache` still hold the old offer rows (old links and text), for example the Amazon Subscribe & Save link that opens "International Best Sellers".
   - They need re-recording with `npm run zetaris:record`, then `npm run examples:regen`.
   - `output_examples/*.json` also still show old titles and links.
2. **README (Lane E3):** the "Try the learning loop" steps report the "Free newborn diaper box". That box is now blocked on the first run, so the steps should use "Amazon Subscribe & Save diaper discount" instead. `sampleMode.test.ts` already shows the working flow.
3. **Client wording (Lane A):**
   - Add a plain label for the new catch type `ai_found_catch`, for example "a catch our reviewer found". Today it shows as "ai found catch".
   - Make sure `fee_over_limit` reads as a catch, not "over our limit".
4. **Photo test:** `loopsEndToEnd` loop 7 (photo retry count) is failing. It belongs to Lane C.
5. **Two benefit links to open by hand:** trumpaccounts.gov and paidfamilyleave.ny.gov (Cloudflare bot wall).
6. **Older grades in offer_checks:** rows 1–13 were graded under the old rules. They are not reused for seed offers, because the wording changed, so the fingerprint differs. They remain as history.

## QC fixes (after the Lane B QC report, Oct 26)
Every fix in this section is in a Lane B file and has its own regression test (a test that stops the problem coming back), using the QC report's exact sentences. They are in `finePrintPolicy.test.ts`, section "QC fixes".

### H1. Free trials that turn into paid plans are now blocked
The code now also reads a price that comes after "then", "after the trial", "unless you cancel", "continues at", or "converts to". It also counts any stated recurring price (for example "charged $9.99 a month") as an automatic renewal.
- **Blocked now:** "Free trial for 7 days, then $14.99 per month. Credit card required."
- **Blocked now:** "first box is free, then $24.99 per month"
- **Blocked now:** "After the trial you will be charged $9.99 a month…"
- **Not affected:** "Free shipping, then $5 off" is still not treated as a renewal.

### H2. More ways of writing a value are understood
The value reader now recognizes "(a $100 value)", "worth $99", "$100 value", and "$100 retail value".
- **Blocked now:** "Free kit (a $100 value). Pay $120 for shipping." (the shipping costs more than the kit is worth).

### M1. An AI reject is never quietly dropped
- **AI says reject but gives no exact quote from the fine print:** the offer shows as "OK, with a catch" (catch type `ai_concern`), with the note "our checker raised a concern we couldn't confirm…".
- **AI says reject and quotes exact words that themselves show a paid-plan trap or a cost bigger than the value:** the offer is blocked.

### M3. Two false catches fixed
These no longer count as catches:
- "No credit card required" (the card check now ignores negated wording).
- "Free shipping will apply" and "No shipping…".

These are now caught as unknown fees:
- "Standard shipping rates apply"
- "you pay shipping"

### L4. Membership wording
"Must be a Walmart+ member" and "members only" are now read as needing a membership, which is a catch.

### M4. Data corrected
Changed in `scripts/seed.ts`, in Neon, and in the bundled stand-in list (`fallback-offers.json`). Each change has its source sentence as a comment in the seed file.

| Offer | Change | Source sentence |
|---|---|---|
| Babylist Hello Baby Box (1317) | Age window changed to −270 to +28 days | "arrival date must be between four weeks ago and up to nine months away" |
| Amazon completion discount (1324) | Window changed to −60 to +90 days | "begins 60 days prior… expires 90 days after the Arrival Date" |
| Target Welcome Kit (1320) | Value set to $100 | "valued at $100" |

### L1. Different answers on different runs: fixed in Lane B's code
**Cause:** the AI sometimes added a catch the code rules had not found. That is why the Enfamil offer was graded differently on two runs (rows 31 and 38).

**Fix:** such an AI catch now counts only if the words it quotes would show a catch to the code rules too. Rejects still go through M1 above. In practice, the code rules now decide the grade.

**Proof:** two real-mode runs back to back gave identical grades for:
- Target 15% coupon (1314): approve both times (rows 49 and 52);
- Enfamil coupons: approve both times (rows 50 and 53);
- Enfamil Wonder Box: approve both times (rows 51 and 54).

**Still to do (Lane C):** the AI model's randomness setting ("temperature") is 0.2 in `server/adapters/llm.ts`. Setting it to 0 would make answers more repeatable. That file belongs to Lane C, so I didn't change it.

### L2. Comment corrected
The comment now says the offline stand-in screen is stricter on purpose.

### Real-mode re-run (NVIDIA nemotron-3-ultra)
| Offer | Grade | Catches | Row |
|---|---|---|---|
| Amazon box | OK, with a catch | needs Prime; $10 minimum; while supplies last | 42 |
| Babylist box | OK, with a catch | $8.95 shipping; $30 minimum | 44 |
| Target kit | OK, with a catch | shipping fee, amount not given; $10 minimum | 46 |
| Cuddle & Co trap (made up) | Blocked | renews at $29.99/month; card required | 45 |
| Target 15% coupon, Enfamil ×2 | Approve, the same on both runs | none | see L1 |

All of these are right. Every new row has the dollar value and the model name filled in.

### Test results after the fixes
- `npm test`: 1,399 passed, 0 failed, 11 skipped. The photo test that failed earlier has been fixed by its own lane.
- `npm run test:v2`: 23 of 23 passed.
- `npm run check`: exit 0, meaning no errors.

### Re-QC (two short trial wordings got through)
**Problem:** two ways of writing a trial that turns into a paid plan were not being blocked:
- "Try it free, then just $9.99/mo" was approved.
- "$0 today, $19 monthly after 30 days. Card required." was only marked "OK, with a catch".

**Fix:** the code now also reads:
- short forms after "then": "/mo", "/mo.", "per mo", "a month", "/month", "wk" and "yr";
- a recurring price that starts later, such as "$X monthly / weekly / yearly after…" (also "once", "when", "starting").

**Tests added:**
- 6 sentences that must now be blocked, including both sentences above.
- 2 that must not be blocked: "No subscription required." and "Free sample, no purchase necessary."

**Results:**
- Lane tests: 202 of 202 passed.
- `npm run check`: exit 0, meaning no errors.

### Final QC round
**Problem fixed:** the previous pattern wrongly blocked "Save $5 monthly after you join. Free to join." A money amount right after save, earn, get, back, off, discount, credit or "cash back" is a saving, not a charge, so it is now skipped.

**Two more trial wordings are caught:**
- "afterwards only $12/mo";
- "per mth" (short for "per month").

**Tests added:**
- 3 that must be blocked, including "afterwards only $12/mo" with a card on file or required, and "then $7.99 per mth".
- 2 that must not be blocked: the "Save $5 monthly…" sentence and "Earn $10 back monthly after your first order".

**Results:**
- Lane tests: 207 of 207 passed.
- `npm run check` (the code type checker): exit 0, meaning no errors.

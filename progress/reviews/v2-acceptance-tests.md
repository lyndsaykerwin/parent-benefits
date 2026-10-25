# V2 acceptance tests (Oct 25, 2026, updated for round 3: R1–R8)

**What these are:** 21 automatic checks that click through the screens the way a parent would. They follow section 5 of the revised plan, `plans/v2-build-plan.md` (the rulings in section 1 set the wording). The features aren't built yet, so **all 21 fail today**. Each one fails because a button, line of text or behaviour is missing, not because the test itself is broken (no syntax, type or import errors). Once a feature is built, its test should pass.

- **Where they live:** `bundle/client/src/__acceptance__/v2/` (one file per story, plus `helpers.tsx`).
- **How to run them:** `cd bundle && npm run test:v2`. This uses its own settings file, `bundle/jest.v2.config.cjs`.
- **They don't touch the normal checks:** `npm test` only looks inside `__tests__` folders, so it skips these. The existing client checks still pass (`npx jest --selectProjects client`: 19 files, 178 tests). The type check (`npm run check`, which runs `tsc`) is clean.
- **Practice data:** the fictional sample family Maya (born 2026-10-03, ZIP 02139, demo date 2026-10-23, so 20 days old; two parents, both paid by a job, insurance through a job), and Leo for the "expecting" case. The server is faked inside the test; nothing calls the real server.
- **Count per story:** S1: 3, S2: 2, S3: 2, S4: 3, S5: 7, S6: 4.
- **Round 3 changes:** Firebase sign-in test removed (R1). Added: Switch family, saved family id in localStorage, Back keeps tab and scroll spot (R1, R8); Claimed / Dismissed drawers with honest money numbers and Undo (R6); offer cards with the court's real findings and no "Likely a good deal" (R5); confident audits "Added to the shared list" (R2); live search that never blocks and falls back cleanly on failure or a 10-second timeout (R3); the gear framing tip (R7).

## Results today

| Test (file › name) | Story | What it checks (plain English) | Result today (why it fails) |
|---|---|---|---|
| s1-intake › shows the right parent rows, keeps answers on Back, and sends household + both work answers + insurance | S1 | Q4 asks "Who's raising this baby?" ("Just me" / "Two of us"). "Just me" shows one row, "You"; "Two of us" adds "Your partner". Each row has "Paycheck from a job", "Self-employed or freelance", "Not working right now", with everyday hints and no "W-2". Back keeps the answers. The run request sends household, both work answers and insurance. | FAIL: can't find "1 of 5" |
| s1-intake › two parents, one not working: no Dependent Care FSA line, lines appear one by one, results wait for "View my results" | S1 | On the checking screen, no "Dependent Care FSA" or "Daycare tax savings" line when a parent isn't working. Lines appear one at a time (first alone, the second about 1.2–1.5 seconds later) and stay. Only after the last line: "We found $X for your family" and "View my results". Nothing moves on by itself, even after a full minute; the tabs open only after the tap. | FAIL: all 5 old lines appear at once |
| s1-intake › job-based insurance shows "30 days from birth to add baby" and "Check your plan" | S1 | The Insurance tab deadline pill matches the insurance answer. (Kept.) | FAIL: can't find "30 days from birth to add baby" |
| s2-gear-locker › Gear: shows "No recalls found", then "See your gear locker" lands on the locker with the item | S2 | Home's "Scan gear or a receipt" button opens "What are you scanning?" with "Gear" and "A receipt". **The gear view shows the framing tip ("white manufacturer label").** A gear photo shows "No recalls found" with the model, UPC (barcode number), "69 NHTSA car-seat recalls" and "Register it with Graco"; "See your gear locker" leads to the locker with the car seat in it. | FAIL: no "Scan gear or a receipt" button |
| s2-gear-locker › A receipt: the locker shows a receipt thumbnail and "Receipt · 3 items" | S2 | A receipt photo is sent as a receipt; the Gear Locker then shows a small picture of the receipt and "Receipt · 3 items". | FAIL: no "Scan gear or a receipt" button |
| s3-money-buckets › Maya (born 2026): real amounts in each bucket, spring 2027, Trump Account into the baby's account | S3 | Kept as before. | FAIL: no "Money back now" section |
| s3-money-buckets › a baby due in 2027 says spring 2028, and an empty "Money back now" asks for a receipt instead of $0 | S3 | Kept as before. | FAIL: no "At tax time" section |
| s4-one-tap › "I got this" puts the card in "Claimed" and moves its $1,000 from Still to claim to Claimed so far | S4 | "I got this" on the Trump Account moves it to the "Claimed" drawer; Still to claim goes down $1,000 and Claimed so far goes up $1,000. | FAIL: no "Still to claim" counter |
| s4-one-tap › "Not relevant" moves the card to "Dismissed", lowers Still to claim and the headline, and Undo restores all three | S4 | "Not relevant" on the MA tax credit ($440) moves it to the "Dismissed" drawer, sends feedback `not_relevant`, lowers Still to claim and the big Home number by $440, leaves Claimed so far alone; "Undo" puts the card and all three numbers back. | FAIL: no "Still to claim" counter |
| s4-one-tap › shows only cards under 5 minutes | S4 | Kept as before. | FAIL: no "Quick wins" button |
| s5-deals › shows the saved-offers status line and the exact-age line on offers | S5 | Practice mode: "Checking N saved offers against your baby's age (Day 20)" and "Your baby is 20 days old. This offer is for babies 0–12 months." (Kept.) | FAIL: no "Checking N saved offers…" line |
| s5-deals › sends store, offer, link and pasted text, and the verdict names the store | S5 | "Audit a deal" is a form: "Who's offering it?", "What do you get?", "Link (optional)", and "Paste the text" / "Add a screenshot" (a file picker). "Check this deal" sends `{store, offer, link, text}`, and the verdict box names the store the parent typed. | FAIL: no "Audit a deal" button |
| s5-deals › an offer card shows "Fine Print Court: Approved", "About N minutes" and "True value $", never "Likely a good deal" | S5 | Practice mode: at least one offer card on Deals shows "Fine Print Court: Approved", "About N minutes" and "True value $X", and "Likely a good deal" appears nowhere. Uses the saved sample run, so it needs the server change plus `npm run examples:regen`. | FAIL: no card says "Fine Print Court: Approved" |
| s5-deals › a confident reply ({mode: "full", saved: true}) shows "Added to the shared list" | S5 | The audit form sends store and offer to the audit address; a confident reply shows "Added to the shared list" (and not "not added to the shared list"). | FAIL: no "Audit a deal" button |
| s5-deals › saved offers show before the search answers; new offers then show "New · found today" and a grade | S5 | Live search held open: the saved "Free newborn diaper box" card and "Searching 14 trusted baby-offer sites" are on screen before the search answers. After it answers, the new card shows "New · found today" and "True value $25", and the saved card stays. | FAIL: the app never asks the live search |
| s5-deals › a failed search shows "No new offers right now", keeps the saved offers and leaves nothing "Searching" | S5 | The search request fails (no internet): "No new offers right now" shows, the saved card stays, no progress bar or status box still says "Searching", no error alert. | FAIL: the app never asks the live search |
| s5-deals › a search that never answers gives up after 10 seconds with "No new offers right now" | S5 | Fake clock: the search never answers; after 10.5 seconds the same fallback line shows and the saved card stays. | FAIL: the app never asks the live search |
| s6-account › shows answers, gear and friendly memory labels; mem- ids only after "Technical details" | S6 | Kept as before. | FAIL: Home still shows "Start over with your own details" |
| s6-account › "Switch family" → Leo shows Leo's answers (due Dec 7, 2026, ZIP 02446) | S6 | On the Account tab, "Switch family" → Leo; the Account tab then shows Leo's due date and ZIP, not Maya's 02139. | FAIL: no Account tab |
| s6-account › a saved bundle_family_id in localStorage opens that family's results without onboarding | S6 | With `bundle_family_id` = `fam-7f3a9c` saved, opening the app at "/" asks the server for that family and shows the tabs and "Still to claim", never the first onboarding question. | FAIL: the app never asks for the saved family |
| s6-account › Back from card detail returns to the tab the card came from (Deals), not Home, at the same scroll spot | S6 | Open an offer from Deals after scrolling to 640px, tap Back: Deals is the current tab and the page scrolls back to 640. (Returning to the right tab already works today; the scroll spot is what's missing.) | FAIL: scroll spot not restored |

## Names and wording the tests expect (builders must match these)
The plan left these choices open, so the tests had to pick:

**Onboarding (S1)**
- Step labels: "1 of 5" through "4 of 5". The last step can say "5 of 5" or "Last one". Q3's "Looks right" moves on to Q4.
- Q4 heading: "Who's raising this baby?" (straight or curly apostrophe). It keeps the "why we ask" line containing "So we can check daycare tax savings" and the "Something else / prefer not to say" link (found by text, so link or button).
- "Just me" and "Two of us" are buttons. Each parent row is a group (`role="group"`, for example a `fieldset` with a `legend`) named exactly "You" or "Your partner".
- Inside each row, three buttons whose names start with "Paycheck from a job", "Self-employed or freelance", "Not working right now". Hints somewhere on the screen contain "taxes come out of your pay", "you pay your own taxes", and "staying home, studying or between jobs". "W-2" never appears.
- Chosen answers (household and each row) have `aria-pressed="true"` when you come back with Back.
- Q4 can have a "Next" (or "Continue") button, or move on by itself once every row is answered. Coming back to an answered Q4, it needs a Next button, or re-tapping an answer must move on.
- Q5 wording is unchanged: "Where do you get your health insurance?", the four choices, "No insurance right now / not sure", "So we can give you the right deadline".
- Run request body: `{ zip, birthDate, household, parent1Work, parent2Work?, insurance }`.
  - `household`: `one` or `two`. `parent1Work` / `parent2Work`: `paycheck`, `self_employed` or `not_working` (`parent2Work` only when `two`). The old `employment` field is gone.
  - `insurance`: `job`, `marketplace`, `medicaid`, `tricare`, `none_or_not_sure`.

**Checking screen (S1)**
- The lines sit in `<li>` items inside the box marked `data-testid="parent-steps"`. An item that says "Getting started…" is not counted as a line.
- Pacing: the first line shows alone; the next appears within 1.5 seconds of it; the earlier lines stay. The test uses Jest's fake clock (fake timers), so pacing must use `setTimeout`/`setInterval`, not real wall-clock waits.
- Lines expected for this family: "State and federal family benefits", "Insurance deadline to add your baby", "Free registry gifts and welcome boxes", "Every result double-checked against its official source". With a parent "Not working right now", no text anywhere matching "Dependent Care FSA" or "Daycare tax savings".
- The test's run finishes straight away (status `done` after the live stream sends `end`); the screen must still pace the lines and must not open the tabs.
- Reveal text: "We found $3,688.99 for your family" (the run's real total) and a "View my results" button, only after the last line. The tabs (`navigation` named "Main") appear only after it is tapped.

**Insurance pill (S1)** — unchanged: the card "Add your baby to health insurance" contains "30 days from birth to add baby" and "Check your plan" when `family.insurance` is `job`.

**Gear and receipts (S2)**
- Home has a button named "Scan gear or a receipt". It opens a dialog named "What are you scanning?" with buttons starting "Gear" and "A receipt".
- After choosing Gear, the dialog mentions "point at the sticker on the bottom of the car seat" and shows the framing tip as text containing "white manufacturer label" (R7). The file picker keeps its label "Take or choose a photo". The photo request (`POST /api/photo/read`) has `kind: 'item'` for gear and `kind: 'receipt'` for a receipt.
- Gear reply: `{ status, rounds, stored, kind, items: [{ productName, brand, modelNumber, upc, recall: { found, source, recordsChecked, checkedOn, registerUrl } }] }`. The result is an article named after the product, with "No recalls found", "Model …", "UPC …", "69 NHTSA car-seat recalls" and a "Register it with Graco" link. Never "Verified Safe".
- Receipt reply adds `photoId`, `thumbnail` (a data address of the picture) and `store`.
- Every scan result ends with "See your gear locker" (link or button), which shows the section labelled "Gear locker".
- The fake server answers any address containing gear, purchase or items with `{ items: [...], receipts: [{ photoId, kind: 'receipt', store, purchasedOn, itemCount, thumbnail, items }] }`. In the locker, a receipt shows text "Receipt · 3 items" and an image whose alt text contains "receipt".

**Money buckets (S3)** — unchanged: labelled sections "Money back now", "At tax time", "Paid family leave"; the tax year is worked out in the browser.

**Drawers and quick wins (S4)**
- Counters `data-testid="still-to-claim"` and `data-testid="claimed-so-far"` on Home; the headline stays `data-testid="home-total-amount"`.
- Two drawers per tab, each a `region` (or `section` with `aria-label`) whose label starts "Claimed" or "Dismissed" (not "Claimed so far"). If folded, its toggle is a button whose name starts "Claimed"/"Show claimed" or "Dismissed"/"Show dismissed" with `aria-expanded`.
- Card buttons "I got this" (button or checkbox) and "Not relevant". "Not relevant" lowers Still to claim and the headline by the card's amount, leaves Claimed so far alone, and sends `POST /api/feedback` with `{ familyId, cardId, kind: 'not_relevant' }`.
- An "Undo" button (the instant one, or one inside the Dismissed drawer) restores the card and all three numbers.
- A "Quick wins" button reveals a "Quick wins" section where every card shows "N min" with N under 5.

**Deals (S5)**
- Practice mode status line: "Checking N saved offers against your baby's age (Day 20)". Age line from the server (`sql.ts`), so `output_examples/maya.json` needs `npm run examples:regen`.
- Audit a deal: an "Audit a deal" button opens a form with fields labelled "Who's offering it?", "What do you get?", "Link (optional)". Two choices, "Paste the text" and "Add a screenshot" (tab or button). "Add a screenshot" shows a file input whose label contains "screenshot". "Paste the text" shows a text box labelled "Fine print", "Paste the text" or "Paste the offer". Submit button: "Check this deal".
- It sends a POST to any address containing "audit" with body `{ store, offer, link, text }` (no `imageBase64` when text is pasted; a screenshot sends `imageBase64` instead of `text`).
- Offer cards (R5): text "Fine Print Court: Approved", "About N minutes" (a single number), "True value $X"; never "Likely a good deal" (server change in `finePrintCourt.ts` + `npm run examples:regen`).
- Confident audit (R2): reply `{ verdict, summary, mode: 'full', saved: true }` → the screen shows "Added to the shared list". The server sets `source: 'user_audit'`; the client test only checks the saved line.
- Reply: `{ verdict, summary, mode: 'quick' }` (it does not repeat the store). The screen shows "Approved with a catch", the summary, and "Quick check. The full AI review runs in live mode." The nearest section, article, `role="status"` or `aria-live` box around "Approved with a catch" must contain the store name the parent typed.
- Live search: when Deals opens, the app asks any address containing "offer-search". Reply: `{ mode: 'live', sitesSearched: 14, searchedOn, cards: [FeedCard + foundOn, isNew] }`. The screen shows "Searching 14 trusted baby-offer sites", and the new offer's article shows "New · found today" and its Value Score line ("True value $25"). If that address answers "not found", Deals stays in practice mode.
- Never blocking (R3): the saved offer "Free newborn diaper box" and "Searching 14 trusted baby-offer sites" show while the search is still unanswered. If the request fails, or gives up after 10 seconds (must use `setTimeout`, since the test uses Jest's fake clock), the text "No new offers right now" shows, saved offers stay, nothing with `role="progressbar"` or `role="status"` still says "Searching", the "Searching 14…" text is gone, and no `role="alert"` appears.

**Account (S6)**
- "Account" is a tab in the bottom bar; its section is labelled "Account". Answers shown in the new words, including "Two of us" and "Paycheck from a job".
- Memory reply at any address containing "memory": `{ family: [{ id, text, source: 'setup', savedOn }], learned: [{ id, text, reports }] }`. The screen shows "Remembered from your setup" and "Saved in Meterless memory", and no text like "mem-201" anywhere in the Account section until a "Technical details" button is tapped (the ids should not be in the page at all before that, not just hidden by style).
- "Switch family" (R1): on the Account tab, a `combobox` (a `<select>` with options) or a button named "Switch family" opening `menuitem`/`menuitemradio`/`option` choices. Choosing "Leo" loads Leo's saved results; the Account section then shows "Dec 7, 2026" (or "December 7, 2026") and "02446", and no "02139".
- Saved profile (R1): localStorage key `bundle_family_id`. When `<App />` opens at "/" with it set, the app calls a GET address containing `/api/families/<id>` (the fake server answers any `/api/families/…` address with the family plus its last finished run: a run status `{ runId, familyId, status: 'done', family, today, result }` that also carries `family`, `run`, `lastRun` and `latestRun`). It then shows the tabs (`navigation` "Main") and `still-to-claim`, and never "Let's find what your family is…" or "Where are you right now?".
- Back keeps your place (R8): from Deals, open a card via its link to `/card/…`, then tap the Back link ("Back" or "Your feed"). Deals is `aria-current="page"` again and `window.scrollTo` is called with the spot the parent left (the test scrolls to 640: `scrollTo(0, 640)` or `scrollTo({ top: 640 })`).

**Data from the server (S3, S4 Quick wins, S5 age line)**
- These read the saved sample run in `output_examples/maya.json`; the server changes need `npm run examples:regen` before they can pass.

**Not tested**
- The other insurance pills (60 days for the Health Connector, and so on), the recall line showing only for families with items, the self-employed-only "Childcare tax credit" line, the screenshot submission body, and "Try a sample family fills all 5".

# Lane A build report: screens and wording (Oct 26, 2026)

All 8 approved items are built, tested and checked on screen at phone width (375 px). Nothing was committed or pushed.

**Plain-English key**
- **Test**: a small program that clicks through a screen and checks what it shows.
- **Reviewer code / owner view**: the private code that judges and Lyndsay type in. With it on, the app shows the "behind the scenes" details. Parents never see them.
- **mailto: link**: a web link that opens your computer's email program with a new message already filled in.
- **Share sheet**: the phone's built-in "Share" menu (Messages, Mail, WhatsApp…).

## Summary of evidence (final runs)

| Command | Result |
|---|---|
| `cd bundle && npm test` | `Test Suites: 1 failed, 1 skipped, 87 passed` / `Tests: 1 failed, 11 skipped, 1384 passed, 1396 total`. The one failure is `server/__tests__/loopsEndToEnd.test.ts › loop 7: photo intake retry`, a photo lane test (see Blockers). |
| `npx jest client` (all browser-side tests) | `Test Suites: 28 passed, 28 total` / `Tests: 292 passed, 292 total` |
| `cd bundle && npm run test:v2` | `Test Suites: 6 passed, 6 total` / `Tests: 22 passed, 22 total` |
| `cd bundle && npm run check` (type check) | exit 0, no errors (on the final run) |
| Baseline before any change | `npm test`: 81 suites / 1223 tests passed. `test:v2`: 22 passed. |

New test file: `bundle/client/src/pages/tabs/__tests__/LaneA.test.tsx` (17 tests, one block per item). I wrote them first and watched 15 fail before building anything. The other 2 already passed, because they check that the owner view keeps what it had. All 17 pass now.

Screenshots (375 px wide, practice mode, Maya sample family) are in `progress/reviews/lane-a-screens/`.

---

## 1. The plan saves itself
- **Files:** `client/src/pages/tabs/Extras.tsx` (the `SavePlanCard` is replaced by `PlanSavedLine`), `HomeTab.tsx`, `AccountTab.tsx`.
- **What changed:** Home now shows one line, "✓ Your plan is saved." The name box, "Save name" and "Not now" are gone. Naming the plan moved to the Account page: a "Name this plan" button for your own saved family, then a name box, "Save name" and "Cancel". It uses the same browser storage as before.
- **Tests:** LaneA item 1 (2 tests). Updated `LaneE.test.tsx` ("Save your plan") and `VersionB.test.tsx` ("light extras").
- **Screen:** `1-home-plan-saved.png`.

## 2. Trump Account and the MA 529 move to Savings
- **Files:** `shared/cardMeta.ts` (new `bucketOf` and `isBabySavings`), `Buckets.tsx`, `TaxesTab.tsx`, `TaxBooster.tsx` (new `Five29Card`; `TaxExtras` is now only the W-4 tip), `SavingsTab.tsx` (new `TrumpSteps`), `HomeTab.tsx` (tile text "baby's account + money back").
- **What changed:**
  - **Home:** the Trump Account left the "At tax time" box. It now has its own box, "Your baby's savings account": "$1,000. Deposited once your baby has a Social Security number. Money from the government into an account in your baby's name, not paid to you," plus a link to see the steps in Savings.
  - **Savings, Trump Account card:** spells out the steps.
    1. Get your baby's Social Security number. You can ask for one at the hospital, on the birth certificate form.
    2. Then file IRS Form 4547, with your tax return or online at trumpaccounts.gov.
    - It also says the IRS confirms the $1,000 for babies born 2025–2028 who have a Social Security number. Source: IRS news release IR-2026-42, Mar 31, 2026 (https://www.irs.gov/newsroom/4-million-children-have-been-signed-up-for-trump-accounts-with-1-million-claiming-the-1000-pilot-program-contribution).
  - **The MA 529 card** (`data-testid="card-529"`, Massachusetts families only) moved from Taxes to Savings. It still reads the same saved filing answer (`useFiling`), so it always agrees with the Taxes booster.
  - **Taxes** shows neither card now.
- **Tests:** LaneA item 2 (3 tests: the bucket, the Savings steps and 529, the 529 agreeing with the Taxes answer). Updated `LaneB.test.tsx` (tax bucket totals, 529 tests now open Savings) and `s3-money-buckets.test.tsx`.
- **Screens:** `2-home-baby-savings-bucket.png`, `2-savings-trump-steps.png`, `2-savings-529-card.png`.
- **Note:** the server still tags the Trump card `tax_time`. Home sorts it by the card's id instead, so older saved results land in the right box too. No server change was needed.

## 3. Child Tax Credit wording
- **Files:** `Buckets.tsx`.
- **What changed:** under "Child Tax Credit $2,200" the line now reads "Lowers your taxes by up to $2,200; up to $1,700 of that can come back as a refund even if you owe nothing." The bracketed "(up to $1,700 refundable)" is gone. Both figures come from IRS Rev. Proc. 2025-32 (https://www.irs.gov/pub/irs-drop/rp-25-32.pdf).
- **Tests:** LaneA item 3.
- **Screen:** `2-3-home-buckets-ctc-wording.png`.

## 4. "Fine Print Court" becomes "Fine Print"
- **Files:** `lib/offers.ts`, `pages/tabs/DealsTab.tsx`, `lib/bundle.ts`, `components/HowWeCheckedSections.tsx`, `components/FeedCardView.tsx` (screen-reader label), `components/AuditDeal.tsx`, `pages/Smarter.tsx`.
- **What changed:**
  - **Offer lines:** "Fine print: OK (no subscription traps, no hidden fees)", "Fine print: OK, with a catch: …" and "Fine print: Blocked: …".
  - **Verdict label:** approve_with_catch now shows as "OK, with a catch", and approve as "OK".
  - **"Rule check only…" note:** now "Quick check only. Read the terms before you sign up."
  - **Section titles:** "Deals whose fine print checks out" and "Offers we haven't checked yet".
  - **Kept as they were:** owner-only screens (the Feed agent step list and AgentWorkspace) and the internal name `fine_print_court`.
- **Tests:** LaneA item 4 (the wording, plus a sweep of all 5 parent tabs, including hidden labels). Updated `LaneD.test.tsx` and `s5-deals.test.tsx`.
- **Screen:** `4-deals-fine-print-wording.png`.

## 5. "How we checked" only on deals, money back and recalls
- **Files:** `pages/tabs/shared.tsx` (new `showsHowWeChecked`; `TabProps` gains `owner`), `pages/tabs/VersionB.tsx` (passes `owner`), `components/FeedCardView.tsx` (new `sourceHref` prop).
- **What changed:**
  - **Parents:** benefit cards no longer link to "How we checked". They get a plain "Source ↗" link to the card's own source page instead. Deals, money-back and recall cards keep "How we checked".
  - **Owner view:** keeps "How we checked" on every card.
- **Tests:** LaneA item 5 (2 tests). Updated `VersionB.test.tsx` (Taxes test now expects Source links).
- **Screens:** `5-taxes-ctc-source-link.png`, `5-savings-money-back-how-we-checked.png`.

## 6. Account page in plain language
- **Files:** `AccountTab.tsx`.
- **What changed:**
  - **Hidden for parents, kept for the owner view:** "Saved in Meterless memory", both "Technical details" buttons, and automatic grading notes (lessons with no parent reports).
  - **Wording:**

    | Was | Now |
    |---|---|
    | What Bundle remembers about your family | What we know about your family |
    | Remembered from your setup / gear locker | From your answers / From your Gear Locker |
    | What Bundle has learned from parents | Tips from other parents |
    | Bundle learned from N parent reports | From N parent reports |
    | Your plan is N% exact | Your numbers are N% complete. Answer N more questions to firm them up. |
    | Save and re-check | Save ("We'll update your results with this answer.") |
- **Tests:** LaneA item 6 (parent view and owner view). Updated `LaneE.test.tsx` and `s6-account.test.tsx`.
- **Screens:** `6-account-top.png`, `6-account-memory-plain-words.png`.

## 7. "Email to myself" never fails silently
- **Files:** new `client/src/lib/sendToSelf.ts`, `HrQuestions.tsx`, `TaxBooster.tsx` ("Send these to your partner or tax preparer" uses it too).
- **What changed:**
  - **On tap:** the button shows "Opening your email…" straight away.
  - **Phones** (touch screen plus a Share sheet) open the Share sheet. If the parent closes it, nothing more happens; that is not an error. If sharing is blocked, it falls back to email.
  - **Computers** open a mailto: link, even when the browser has a Share sheet (Mac Safari and Chrome do).
  - **Status line:** "Opening your email… If nothing opens, tap Copy and paste it into an email." If the email link itself fails, a visible error tells the parent to use Copy.
- **Tests:** LaneA item 7 (4 tests). Updated `InsuranceTab.test.tsx` so it acts as a phone.
- **Screen:** `7-email-to-myself-status.png`.

## 8. No "All checked" flicker
- **Files:** `pages/Feed.tsx`.
- **What changed:** while a check runs, a parent sees only the checklist. Last run's cards and the cards that arrive during the check are no longer shown. When the check finishes, the parent goes straight to "We found $X for your family". Last run's results are not even fetched for parents now. The owner view still shows them.
- **Tests:** LaneA item 8. Updated `Feed.test.tsx` (the saved-cards and streamed-cards tests now run as owner).
- **Screens:** `8a-checking-checklist-only.png` (the script also confirmed there were no cards on screen), `8b-we-found-reveal.png`.

---

## Blockers and notes
- **Two failures in other lanes' files**, neither in a Lane A file:
  - **Earlier runs:** fine-print court, Zetaris and offer tests failed while other lanes were mid-edit. The type check failed in `server/ingest/photo.ts`, and one run crashed in `client/src/components/scan/photoJob.ts` (`fetch is not defined`). On the final run the court/Zetaris/offer suites and the type check passed.
  - **Final run:** one photo-lane test still fails: `server/__tests__/loopsEndToEnd.test.ts › loop 7: photo intake retry`.
- **The `agent-browser` screenshot command hung on this Mac**, even on a blank page, headless and headed (`CDP command timed out: Page.captureScreenshot`). Other lanes had browser sessions open at the same time.
  - I took the screenshots with a small script instead. It drives the same headless Chrome that agent-browser downloads, at 375×812 phone size: `/private/tmp/claude-501/-Users-lyndsay--claude-spares-spare-D8tcfW/8f872c66-b3a8-4c13-b70c-c203b89cac97/scratchpad/shots.mjs`.
  - Browsers block port 5061 by default, so Chrome was started with an exception for that one port.
- **Optional follow-up (server lane, not needed):** `server/__tests__/laneB.test.ts` line 56 still expects the server to tag the Trump card `tax_time`. Home now ignores that tag. A `'baby_savings'` category in `shared/bundle.ts` could replace it later.
- **Server stopped:** my practice-mode server on port 5061 is stopped.

---

## QC fixes (after progress/reviews/2026-10-26-lane-a-qc.md)

| Finding | Fix | Files | Test |
|---|---|---|---|
| **M1:** "Send these…" said "tap Copy", but there was no Copy button | Added a **Copy** button under "Send these to your partner or tax preparer". It shows "Copied. Paste it into a message or email." (or a visible "Couldn't copy…" message). | `TaxBooster.tsx` | LaneA: "the Taxes 'Send these' card has a working Copy button with visible feedback" |
| **L1:** "memory" in parent text | Menu item is now "Your plan and saved answers". The section's screen-reader label is now "What we know about your family". The Forget dialog now says "your saved answers… and everything we know about your family". | `FamilyChipMenu.tsx`, `AccountTab.tsx` (and the tests and helpers that used the old names) | existing FamilyMenu, LaneE and s6 tests, updated |
| **L2/L3:** wording on phones vs computers | Phones now see "Choose where to send it…" while the Share sheet is open. Computers see "Opening your email… If nothing opens, **click** Copy…"; phones say "tap". | `lib/sendToSelf.ts` (`startNote`, `openingEmail`, `emailFailed`), `HrQuestions.tsx`, `TaxBooster.tsx` | LaneA: "a computer is told to 'click' Copy…", "on a phone the button says 'Choose where to send it…'" |
| **L4:** test coverage that was dropped | Put the missing checks back. | — | LaneE: the plan name is saved to browser storage. LaneA item 8: owner fields (`owner-trace-id`) never reach a parent's checking page. s6: new test, the reviewer code plus "Technical details" reveals the raw `mem-` ids. |
| Fine-print lane: new catch type `ai_found_catch` | Parents now read "our checker found a catch in the fine print". It goes through the same label map (`CATCH_WORDS` / `catchWord`) that offer cards and the "Tips from other parents" lessons use. | `lib/tabs.ts` | LaneA: "the new ai_found_catch type is said in plain words" |
| Unowned one-liner: `parentResult()` dropped `stateNote` | Added `...(r.stateNote ? { stateNote: r.stateNote } : {})`. The browser keeps its own fallback. | `server/routes/bundleRoutes.ts` (1 line) | `bundleRoutes.test.ts`: "parentResult keeps the 'coming soon' state note…". I watched it fail with the line removed, then pass with it back. |

**Evidence (final runs)**

| Command | Result |
|---|---|
| `npx jest client server/__tests__/bundleRoutes.test.ts` | `Test Suites: 29 passed` / `Tests: 333 passed, 333 total` |
| `npm run test:v2` | `Test Suites: 6 passed` / `Tests: 23 passed, 23 total` |
| `npm run check` | exit 0 |
| `npm test` | `Test Suites: 1 skipped, 88 passed` / `Tests: 11 skipped, 1394 passed, 1405 total` |

# Task 12 report: mobile-first UI

**Status:** DONE (one commit on local `main`, not pushed)
**Commit:** `320ceeb feat: mobile-first onboarding, feed, card detail, smarter screens` (BASE c8cfb40)
**Checks:** `npm run check` is clean. `npm test` passes: 17 suites, 168 tests (server and client).

## What was built
- `client/src/pages/Onboarding.tsx` has three inputs: a due date or birth date (a past date counts as a birth date, a future date as a due date), a ZIP code, and an optional employer.
  - "Find what we're owed" posts the inline family.
  - "Try as guest" posts `{familyId:'maya'}`.
  - "Connect a card" and "Upload Amazon orders" show a coming-soon note that points the user to Try as guest. This follows the Task 11 ruling: no live Plaid and no upload route.
- `client/src/pages/Feed.tsx` (`/feed/:runId`):
  - It polls `GET /api/runs/:runId` and `/trace` every 1s.
  - While the run is going it shows a 5-step progress card plus a "Live activity" list made from the trace lines. Repeats are collapsed and the newest line is shown first.
  - When the run finishes it shows the ReceiptCard, the banner (when there is one), the pinned insurance card, then the groups in this order: clawback, recall, benefit, discount, coming_soon.
  - The page ends with a link to "Bundle got smarter".
  - The finished run is saved in sessionStorage.
- `client/src/components/ReceiptCard.tsx` shows the split Receipt:
  - the coral headline "$X money back"
  - "$Y in benefits you likely qualify for"
  - the number of deadlines, with "next in D days"
  - "N items safety-checked", then either "1 recall" or "all clear"
- `client/src/components/FeedCardView.tsx` shows each card:
  - a coloured dot and kind label, the verdict pill (`Likely eligible`, `Not yet verified` for `info`, and so on), the title and body, and the amount in USD
  - DCFSA amounts are labelled "eligible spend", never "money back"
  - deadlines within 30 days show as a coral countdown; later ones show as a calm "By/Ends Mon D, YYYY"
  - sources are links that open in a new tab (`noopener`), followed by a "How we checked ›" link
- `client/src/pages/CardDetail.tsx` (`/card/:id?run=`):
  - It shows the card, then "How we checked": a timeline of that card's own trace lines (its own line, the explanation, the court's arguments and the Fact-Checker's verdict), written in plain English, with the raw `agent.action · time` underneath.
  - It also lists the sources.
  - "I got this" and "Report issue" (with a text box) post to `/api/feedback`.
  - If the run isn't in this tab's memory, it loads the run from the server, so a link opened in a new tab still works.
- `client/src/pages/Smarter.tsx` (`/smarter`):
  - three-step "how it learns" strip
  - approved case law (dark card, CL-xx, confidence bar, number of parent reports)
  - proposals waiting for review, with Approve
  - the scoreboard, which reads Task 13's JSON, including run 1 → run 2 learning and the model label
  - a "Reviewer mode" token field. The token is kept in sessionStorage and sent as `x-reviewer-token`. Approve is turned off until Reviewer mode is on.
- `client/src/lib/bundle.ts` holds the shared helpers: money and date formatting, `groupCards` (which pins the insurance card and adds the client-only "Connect your bank (Plaid)" tile), `traceForCard`, `describeLine`, API calls, and sessionStorage handling.
- The design follows deck/design-system.md:
  - tokens: cream `#FBF6EF`, ink, ink-2, line, coral and coral-deep, plus the card-kind colours
  - type: Manrope 500–800 and JetBrains Mono, loaded from Google Fonts (the existing CSP already allows this)
  - cards: 24px radius with the deck's card shadow
  - layout: a 480px-max column with 16px side gutters
  - tap targets: at least 44px, and main buttons are 56px

## Server changes (small, tested)
- `GET /api/runs/:runId` now also returns `family: {name, birthDate, dueDate}` (display fields only, never income) and `today`. The UI uses them for the "Baby Maya · day 20" chip and so its day counts match the server's date.
- New `GET /api/scoreboard` returns `{scoreboard: <logs/scoreboard.json> | null}`. The path can be swapped out (`ApiDeps.scoreboardFile`) so tests can use a temporary file.
- Two new tests in `server/__tests__/bundleRoutes.test.ts`. One of them checks that the income value never appears in the response.

## TDD evidence
1. I wrote `client/src/components/__tests__/FeedCardView.test.tsx` with 5 tests: amount `$28.99`, `Likely eligible`, sources render as links (href, `_blank`, `noopener`), `info` shows `Not yet verified`, and DCFSA shows "eligible spend".
2. RED, first with the component missing ("Cannot find module '../FeedCardView'"), then with an empty stub: 5 of 5 failed.
3. I implemented the component. GREEN: 5 of 5 pass.
4. I added `client/src/lib/__tests__/bundle.test.tsx` (pinning and group order, trace matching including the `discount-673` vs `discount-6730` edge case, chip and number formatting) and the 2 server route tests (RED on the missing `scoreboardFile`, then GREEN).
5. Test setup: I added the dev dependencies `@testing-library/react@16`, `@testing-library/dom@10` and `jest-environment-jsdom@30`. `jest.config.cjs` now has two projects:
   - **server**: same settings as before.
   - **client**: jsdom with ts-jest `react-jsx`. It also transforms `wouter`, which ships only in the newer "ES module" format that Jest can't load as-is.

## Screenshots (375px wide, 2x; driven through real Chrome against `PORT=5050 npm run dev`)
All are in `/Users/lyndsay/Documents/hackathon/bundle/docs/screens/`:
- `01-onboarding.png`
- `02-run-in-progress.png`: a live maya run at 4s, with the progress steps and live activity.
- `03-feed-receipt.png`: the Receipt shows $48.99 money back, $3,640 in benefits, 3 deadlines (next in 10 days), 7 items checked and 1 recall. The insurance card is pinned below it.
- `04-feed-full.png`: the whole feed, 18 cards including the Plaid tile.
- `05-card-detail.png`: the FSA thermometer card, with its trace and sources.
- `05b-card-detail-discount-court.png`: a discount card showing the Deal Hunter, Lawyer, Judge and Fact-Checker steps.
- `06-report-issue-form.png`: the report form, opened and filled in.
- `07-got-this-confirmed.png`: the confirmation after "I got this" was really sent.
- `08-smarter.png`: the real empty state (no proposals, no scoreboard yet).
- `09-smarter-populated-MOCK-DATA.png`: **made-up data** (the browser's API answers were replaced only for this screenshot) to check the filled-in layout before Task 13 produces real data. The file name says MOCK. It must not be used in the deck as real output.

Live runs took 49s and 10s.

Things I found in the screenshots and fixed:
- The discount label wrapped onto two lines, so it is now just "Discount" (the section heading already says "passed Fine Print Court").
- "345 days left" is now "Ends Oct 3, 2027".
- Coming-soon tiles repeated "Coming soon:" in the text, so the repeat is removed.
- The "Bundle got smarter" button was cramped, so it has more padding.
- The confidence label wrapped on the dark card.
- "model unavailable" is now plain English: "used its backup check (AI offline)".
- The Judge's "approve:" prefix now reads "Approved."
- The newest activity line now shows first, so it stays on screen.
- "No sign-up" broke across lines at the hyphen, so it now uses a non-breaking hyphen.

## Decisions (made without the owner; owner unavailable)
- **Single date field.** A past date counts as a birth date, a future date as a due date. That's one fewer question for tired parents. The hidden helper text for screen readers explains it.
- **Plaid tile added in the browser.** The feed shows 3 coming-soon tiles: the server's 2, plus "Connect your bank (Plaid)" added by the browser (the controller asked for that tile). The server's never-empty rule of 2 tiles is unchanged.
- **Pinned card.** The card pinned on top is the one whose id contains "insurance" (`benefit-insurance_add_baby`).
- **Verdict pill wording.** `verified` → "Verified", `likely` → "Likely eligible", `all_clear` → "All clear", `info` → "Not yet verified". The copy rule (say "likely eligible", never "eligible") holds.
- **Live feedback test.** Live, I only sent "I got this". I did **not** send "Report issue", because issue reports feed the Coach. A test note sitting in Neon could slip into Task 13's learning demo. So the report form is shown filled in but not sent. The sending code is the same `api.feedback` call that "I got this" uses.
- **Screenshot tool.** agent-browser could open pages but its `screenshot` command hung every time (it timed out). Chrome's `--headless --window-size=375` mode draws the page wider than 375px, so the right edge got cut off. I used a small throwaway script outside the repo that drives Chrome's DevTools protocol with exact 375×812 phone settings.
- **Light theme only.** The deck design has no dark mode for the product.
- **Zetaris cache files.** My live runs rewrote some saved Zetaris answers in `data/sample/zetaris-cache` and added 5 new ones. I restored the rewritten files and left the 5 new ones uncommitted, so the feature commit stays focused. The controller can commit them as a "refresh replay cache" commit if wanted.

## Concerns / follow-ups
1. **"I got this" added one real row to Neon.** It is a `got_it` feedback row for maya on card `clawback-fsa-maya-tx-01`. The Coach ignores `got_it` rows. Delete it if you want a clean table.
2. **Server restarts lose runs.** Runs are kept only in the server's memory, so after a restart a `/feed/:runId` link shows "This run has expired". The current tab still shows its saved copy, and a card detail page falls back to it too.
3. **The court ran in backup mode.** The NVIDIA key is still missing, so the court's trace says "Backup used" on every step. The UI says so honestly. Once the key arrives, the court screenshots should be retaken.
4. **The "next in D days" Receipt line counts `info` filler cards.** This is the existing Task 9 note (deferred to the final review). The UI only displays the number.
5. **The headline font comes from Google Fonts at runtime.** If the hosting setup blocks it, the page falls back to the system font. Hosting the font file ourselves would be a small Task 14 job.
6. **No in-browser test for the full flow.** Only FeedCardView and the helper functions have automated tests. The flow itself was checked by hand in a real browser.

---

## Fix round 1 (commit `3c44d3a`, follows 320ceeb)

**I1: one failed check no longer ends the feed.** While a run is going, the feed page checks with the server every second (this is called "polling"). Before this fix, a single failed check ended the run view.
- The polling now lives in `client/src/lib/poll.ts` (`pollRun`, with `MAX_POLL_FAILURES = 5`) instead of inside `Feed.tsx`.
- When the server says the run doesn't exist (a 404), polling stops at once and the page says "This run has expired".
- Any other error (a network blip, a server error, a rate limit) is retried on the same 1-second timer. A successful check resets the failure count.
- Only 5 failures in a row show "We lost touch with Bundle".
- API errors now carry their HTTP status (`err.status`), so a 404 is recognised by its status code rather than by matching the message text.
- `Feed.tsx` now uses `pollRun`.
- New tests in `client/src/lib/__tests__/poll.test.tsx` (using fake timers):
  - 4 failures then success: polling keeps going and finishes, and never gives up.
  - 5 failures: gives up with "lost" after exactly 5 checks.
  - A success between failures resets the count.
  - A 404 gives up with "expired" after a single check.

**M1: only web links are rendered.** `safeSources()` keeps only sources whose URL starts with `http://` or `https://`. It is used on the feed card and on the card detail page. New test: a `javascript:` source is not rendered as a link.

**M3: screen-reader fixes.** The hard-coded `aria-busy="true"` is removed. Each progress step's icon now has visually hidden status text ("Waiting:", "Working:", "Done:") that screen readers announce.

**M4: contrast.** The "(optional)" label and the input placeholders now use ink-2 instead of ink-3, so the text meets the AA contrast standard. ink-3 is now used only for decorative dots.

**Checks**
- `npm run check` is clean.
- `npm test` passes: 18 suites, 173 tests. The client tests are 13 of 13.

**Live check at 375px wide**
- The guest run finished and showed the Receipt after 13s.
- `/feed/does-not-exist` immediately showed the "expired" message.
- Observation, not caused by this change: this live run's money-back figure was $28.99, not $48.99. The price-adjustment card's deadline is today (2026-10-23), so whether it appears depends on the live run. The UI shows whatever the server returns.
- The saved Zetaris answers that my live runs rewrote were restored, so they are not in the commit.

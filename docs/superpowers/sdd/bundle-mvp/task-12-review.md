# Task 12 review (commit 320ceeb, base c8cfb40)

Spec: PASS. Every listed requirement is present: 3-input onboarding plus Try as guest (maya), no sign-in UI, two-number Receipt, pinned insurance card, group order, banner, 1s polling progress list, "How we checked" with sources, I got this / Report issue, Smarter with Reviewer-mode token, "Likely eligible" / "Not yet verified", DCFSA "eligible spend", three coming-soon tiles (2 server, Plaid added client-side), income never displayed or sent.
Severity counts: Critical 0, Important 1, Minor 6.

## Named risks
- Polling leak: clean. The effect cleanup sets `stopped` and clears the timer. Every await is followed by a `stopped` check. It stops on done, failed, error and when a saved run exists. No leak.
- XSS: none. There is no `dangerouslySetInnerHTML` outside shadcn ui. All text is rendered as React text. The only injection surface is source URLs in `href` (see M1).
- Reviewer token: sent only as the `x-reviewer-token` header on the approve call. It is never logged and never put in a URL. It lives in sessionStorage, the field is `type=password`, and the draft is cleared. Fine.
- Income: `/api/runs/:id` adds `family {name, birthDate, dueDate}` and `today` only. The test asserts income is absent. Fine. The scoreboard endpoint is a read of a local file with a try/catch fallback.
- Accessibility basics: inputs are wrapped in labels, buttons have text names, `:focus-visible` has a 3px coral outline, and tap targets are 44px or more. Gaps are listed under M3 to M5.

## Important
I1. One failed poll ends the run view. In `Feed.tsx` the `catch` in `tick` sets a terminal error and returns. A single dropped request on flaky mobile data, or a server hiccup, kills a run that is still going and shows "We lost touch". The run is stored server-side, but the page never resumes. Fix: tolerate transient errors by retrying 3 to 5 consecutive failures with the 1s timer before giving up. Keep "Run not found" (404) as an immediate stop. Note the failed-run message also needs no change.

## Minor
M1. Source links use `href={s.url}` with no scheme check (`FeedCardView.tsx`, `CardDetail.tsx`). Sources come from the DB or LLM-assisted data, so a `javascript:` URL is theoretically possible. Fix: render the link only if `/^https?:\/\//i.test(url)`.
M2. Polling intervals use setTimeout after the response, so the cadence is about 1s plus latency. This is fine and arguably better than setInterval; no action.
M3. `aria-busy="true"` is hardcoded on the progress section. It is never set false before unmount, which can mute the polite announcements. Remove it. Step states (done, working, waiting) are icon-only (`aria-hidden`), so a screen-reader user cannot tell progress. Fix: add visually hidden "done" or "in progress" text.
M4. `text-ink-3` (#8A8076 on cream, about 3.5:1) is used for small text, such as the "(optional)" label and placeholders. This is below the 4.5:1 AA bar for small text. Fix: use ink-2 for text.
M5. No focus or title management on route change, so a keyboard user stays at the old position after "Try as guest" navigates. Fix: focus the page h1 on mount and set `document.title`.
M6. Onboarding does not bound the date: a year-1900 or 2099 date goes to the server. The server validates the format only, so a nonsense family may be produced. Fix: min and max on the date input (for example, 18 months ago to 12 months ahead). Related: the client "today" (local) can differ from the server today at day boundaries, which affects whether a date is classed as birth or due.

## Notes (no action)
- Tests: only FeedCardView plus helper functions are unit tested. The Feed polling and Smarter flows have no component tests. Disclosed in the report; acceptable for the hackathon, but the polling logic (I1) is the one place a test would pay off.
- The screenshot `03-feed-receipt.png` matches the claims ($48.99 money back, $3,640 benefits, next in 10 days, 7 items, pinned card on top) and has good contrast and spacing at 375px.
- Report's Zetaris cache note (5 uncommitted files) is outside the commit; the controller should decide whether to commit them.

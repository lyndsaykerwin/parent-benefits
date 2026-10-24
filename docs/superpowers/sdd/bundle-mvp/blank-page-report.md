# Blank page report

**Symptom:** `SAMPLE_MODE=true PORT=5060 npm run dev` served a blank page in the browser.

**Root cause:** Not the recent offline-mode or UI commits. The server's safety headers (helmet defaults, present since the first
commit) include the rule "upgrade insecure requests" and HSTS. Safari obeys that rule even on localhost and rewrites every script
address to https://localhost, which has no certificate ("A TLS error caused the secure connection to fail"), so no JavaScript
loads and the page stays empty. Chrome exempts localhost, so Chrome screenshots always worked. Reproduced with WebKit (Safari's
engine): all three script requests failed on https://localhost:5070.

**Fix:** new `bundle/server/security.ts`; headers are now chosen per request. Plain http gets everything except upgrade-insecure-requests
and HSTS; https (e.g. Render) keeps both. Regression test: `server/__tests__/securityHeaders.test.ts`.

**Verification:** WebKit now renders the onboarding text; headless Chrome screenshot `bundle/docs/screens/00-smoke.png` shows
"Try as guest". `npm run check` clean, `npm test` 267 passed (8 skipped DB tests), secrets grep empty.

**Restart:** yes. Lyndsay's server on 5060 runs the old header code. Ctrl+C it, then
`cd /Users/lyndsay/Documents/hackathon/bundle && SAMPLE_MODE=true PORT=5060 npm run dev`, then hard-refresh Safari (Cmd+Shift+R).

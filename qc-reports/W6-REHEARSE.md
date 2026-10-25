# W6-REHEARSE: clean-download rehearsal (2026-10-25)

Fresh `git clone --branch claude/funny-darwin-ccrblc` into the scratch folder (first try). No key variables set. Node v22.22.0, npm 10.9.4, Linux. Repo not edited.

| Step | Result |
|---|---|
| 1. Fresh clone, no keys | PASS (only `bundle/.env.example` is tracked; no `.env`) |
| 2. README quick start as written (`cp .env.example .env`, `npm ci`, `SAMPLE_MODE=true npm run dev`) | PASS, with wording problems below. `npm ci` 17 s, up on :5050 in 3 s, `curl /` = 200, `POST /api/run?wait=true` leo = JSON cards |
| 3a. `SAMPLE_MODE=true npm test` | PASS: 65 suites passed, 1 skipped (live DB), 1000 tests passed, 11 skipped, 0 failed, 77 s. No flake this run |
| 3b. `npm run check` (tsc) | PASS, no output |
| 3c. `npm run build` | PASS (vite 4 s, server bundle 281 kB) |
| 3d. `npx tsx scripts/eval.ts` | PASS: trapsCaught 8/8, falseAlarms 0, maya 4899 / leo 0 / ava 1458, expectationFailures [] |
| 4. Parent click-through (Playwright, phone width) | PASS. Landing, "Try a sample family", feed ($3,688.99, Maya day 20), Deals tab, open card ("How we checked"), "Your feed" back link. 0 console errors, 0 page errors, 0 failed or 4xx/5xx requests. Text "Plaid" / "connect your bank" appears nowhere (only "We never ask for bank details to get started"). Server stopped (port 5050 closed). Screenshots in `qc-reports/w6-rehearse/` (1-landing, 2-feed-home, 3-deals-tab, 4-card-open, 5-back-to-feed) |
| 5. Secrets scan | PASS. No `nvapi-` real keys, no `sk-`, `ghp_`, `AKIA`. `.env.example` holds placeholders only (`<nvapi-your-nvidia-key>`, `<user>:<password>@<host>`). Only passwords found are throwaway local-test ones (`postgres://bundle:bundle@127.0.0.1`) in tests, `db-test-setup.sh` and QC notes; long hex strings are file-hash names and git commit ids |

## README fixes needed (bundle/README.md)

1. **Wrong button name** (section 16, line 330): `Open http://localhost:5050 and tap "Try as guest" to see the app.`
   Replace with: `Open http://localhost:5050 and tap "Try a sample family" (made-up data). The finished list appears on its own; there is no separate "run" button. Open the Deals tab, tap a card, then "How we checked", and use "Your feed" to go back.`
2. **Node version is unverified/possibly overstated** (section 4 line 72 and section 16 line 314: `Needs Node 24 or newer.`). Everything above passed on Node 22.22. `package.json` says `>=24`. Either test on 24 or say: `Needs Node 24 or newer (check with node -v; get it from nodejs.org). It also worked on Node 22 in testing.`
3. **No download step** (section 4 and 16 begin at `cp .env.example .env` / `cd bundle`). Add before: `git clone <repo-url> && cd parent-benefits/bundle` (section 4) with a note that section 16's `cd bundle` assumes you are in the repo root. Also name the branch if the default branch is not the submission.
4. **Timings missing.** After `npm ci`: `Takes about 20 seconds; it prints "30 vulnerabilities". That is normal for this sample app and can be ignored.` After `npm test`: `Takes about 1.5 minutes.`
5. **Terminal noise unexplained** (line 84 `Starts in a few seconds.`). Add: `The terminal will scroll with lines of JSON; that is the agents' activity log, not an error. The line "serving on port 5050" means it is ready.`
6. **eval is very long** (line 91 `npm run eval ... prints the scoreboard`). Output is about 1,400 lines; scoreboard is at the bottom. Add: `Scroll to the end and look for "trapsCaught": 8, "falseAlarms": 0.` Also: running `npm test` / `npm run eval` rewrites tracked files (`bundle/logs/scoreboard.json`, `bundle/output_examples/learning/*.jsonl`); say so, so a reviewer is not alarmed by `git status`.
7. **Line 330** `SAMPLE_MODE=true npm test` vs line 89 `npm test`: make consistent (`.env` already sets SAMPLE_MODE=true, both work).

## Other observations (not README)
- Sample-mode card copy contradicts itself: Deals cards say "We couldn't read this offer's fine print in full, so we haven't confirmed it is free of catches" while "How we checked" says "We checked this against its official source before showing it to you." A judge may notice; consider reconciling the text for offline mode.
- Dev server prints a "baseline-browser-mapping data is over two months old" warning; harmless.
- Not clicked: "Baby's here" / "We're expecting" paths, "Bundle got smarter" (my last selector missed it on the post-back page; not a bug finding).

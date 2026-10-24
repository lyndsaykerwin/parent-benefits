# Cloud health check — Bundle app (step E2)

Date: Oct 24, 2026. Where: the Claude Code cloud sandbox (a temporary computer in the cloud, not Lyndsay's Mac). No secret keys were present, so everything ran in **sample mode** (`SAMPLE_MODE=true`), where the app uses built-in practice data and a stand-in for the AI model instead of calling real outside services.

**Bottom line: healthy.** It installed cleanly, all tests passed with the same numbers as before, the type check found no errors, and the server started and answered requests. No app code was changed and nothing was committed.

## What I ran and what happened

| Step | Command | Result |
|---|---|---|
| 1. Install the app's building blocks ("dependencies", the outside code libraries the app relies on) | `npm ci` in `bundle/` | Worked first time (782 packages in 35 seconds). `npm ci` installs the exact versions written in the lock file, so no fallback to `npm install` was needed. |
| 2. Automated tests (small programs that check the app behaves correctly) | `SAMPLE_MODE=true npm test` | **268 passed, 8 skipped, 0 failed** (29 test files passed, 1 skipped). Matches the previous known result exactly. Took about 52 seconds. |
| 3. Type check (a spell-checker for code that catches mismatched data, e.g. passing a word where a number is expected) | `npm run check` (runs `tsc`) | **Passed** — no errors. |
| 4. Start the server and poke it | `SAMPLE_MODE=true npm run dev` equivalent (`tsx server/index.ts`), port 5050 | Started in about a second. All checks below answered correctly. Server then stopped; nothing left running. |

There is no separate "lint" script (a lint is a style checker) in `package.json`, so only the type check was run.

### Server checks (each is a web request sent to the running app)

- `GET /api/health` → 200 OK, `{"ok":true}` (200 means "success").
- `GET /` (home page) → 200 OK, returns the web page.
- `GET /api/scoreboard` → 200 OK; shows 6 of 6 trap deals caught, 0 false alarms, 100% of cards sourced, and the "learning" proof (second run blocked an offer, citing memory rule `mem-1`).
- `GET /api/case-law` → 200 OK (empty list, as expected for a fresh start).
- `POST /api/run` for the sample family "leo" → 200 OK in 0.04 seconds, returned a full set of benefit cards with sources.
- `POST /api/run` with a bad ZIP code → 400 (the app correctly rejected bad input).

## Why 8 tests are skipped (this is expected)

All 8 skips are in one file, `bundle/server/__tests__/seed.test.ts`. That test wipes and refills the real online database (Neon), so it deliberately only runs when someone sets `RUN_DB_TESTS=1` and provides a database address. There is no database here, so skipping is correct — not a problem.

## Problems and warnings found (none block the demo)

1. **Node version is older than the app asks for.** The sandbox has Node 22.22.0 (Node is the engine that runs the app's JavaScript code); `bundle/package.json` says it wants Node 24 or newer. Everything still worked, so this is a mismatch on paper, not a breakage. *Suggested fix:* either install Node 24 in the cloud environment's setup script, or, if Node 22 is fine, relax the `"engines"` line to `>=22`. Worth knowing because the hosting service (Render, per `render.yaml`) may pick its Node version from that line.
2. **Security warnings from the installer:** `npm` reports 30 known weaknesses in the outside libraries (2 critical, 19 high, 8 moderate, 1 low). This is very common in projects like this and many affect only development tools, not the live app. *Suggested fix:* after the hackathon deadline, run `npm audit` to see which ones matter; don't do a blanket `npm audit fix --force` during the build week, because it can upgrade libraries in ways that break things.
3. **"Old data" notices when the server started:** two helper libraries (`baseline-browser-mapping` and `caniuse-lite`, which track which web browsers support which features) say their data is a few months old. Harmless cosmetic warnings. *Suggested fix:* optional; `npx update-browserslist-db@latest` clears one of them.
4. **Note on the sample run output:** one card reads "Court was offline; the fine print says a shipping or handling fee may apply." "Court" is the Fine Print Court checker, which needs the real AI model; in sample mode it is offline by design, so the app falls back to a careful "blocked" verdict. Expected behavior, not a bug — but worth knowing if that wording appears in a demo recording made without keys.

## Nothing changed

`git status` was clean after the run: no app files were modified and nothing was committed. The server process was stopped and port 5050 was confirmed closed.

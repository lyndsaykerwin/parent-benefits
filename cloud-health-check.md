# Cloud health check — Bundle app (Oct 24, 2026)

**Verdict: healthy.** The app installs, all tests pass, and the server starts and answers in sample mode on this cloud machine. No app code was changed.

## What ran (all inside `bundle/`)

| Step | Command | Result |
|---|---|---|
| 1. Install the app's building blocks ("dependencies") | `npm ci` (uses the exact versions saved in `package-lock.json`) | OK: 782 packages installed in 31 seconds |
| 2. Automated tests | `SAMPLE_MODE=true npm test` | **268 passed, 8 skipped, 0 failed** (29 test files passed, 1 skipped). Same as the Mac. |
| 3. Start the server | `SAMPLE_MODE=true PORT=5050 npx tsx server/index.ts` (what `npm run dev` does) | Started: "serving on port 5050" |
| 4. Check it responds | home page `/` | 200 OK, page title "Bundle" |
| | `GET /api/health` | 200 OK, `{"ok":true}` |
| | `GET /api/scoreboard` | 200 OK: 6 of 6 traps caught, 0 false alarms, offline mode |
| | `POST /api/run` with `input_examples/maya.json` | 202 Accepted (the run was started and given a run ID) |
| 5. Stop the server | stopped the process | Confirmed: nothing answering on port 5050 afterwards |

"Sample mode" (`SAMPLE_MODE=true`) means the app runs with no secret keys: it replays saved Zetaris answers and uses fixed text instead of calling the AI model.

The 8 skipped tests are the one live-database test file (`server/__tests__/seed.test.ts`), which is deliberately skipped unless `RUN_DB_TESTS=1` is set. That is expected.

## Small things noticed (none blocking)

1. **Node version is older than the app asks for.** This machine has Node 22.22.0 (Node is the program that runs the app's JavaScript). `bundle/package.json` says `"node": ">=24"` and `bundle/.tool-versions` pins 24.9.0. Everything still worked on 22, but the hosting site (Render) should use 24 to match.
2. **Security warnings from the installer:** `npm ci` reported 30 known vulnerabilities in third-party packages (2 critical, 19 high). These are in outside libraries, not Bundle's own code. Worth a look with `npm audit` before going public, but not urgent for the hackathon demo.
3. **Out-of-date browser lists:** the server printed notices that `caniuse-lite` and `baseline-browser-mapping` data (lists of what web browsers support) are a few months old. Cosmetic only.
4. **No `.env` file here.** I passed `SAMPLE_MODE=true` on the command line instead of creating one, so nothing new was written into the project.

## Git safety

- `node_modules` (the installed building blocks, hundreds of MB) is ignored by git: rule on line 1 of `bundle/.gitignore`, and also in the top-level `.gitignore`. It will not be committed.
- `git status` showed no changes from this check except this report file. Nothing was committed.

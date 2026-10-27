# Lane D build report: tester code + Render (Oct 26, 2026)

Nothing committed, pushed or deployed. No accounts created, no keys entered anywhere.

## What changed (files I own)

| File | Change |
|---|---|
| `bundle/server/middleware/testerCode.ts` (new) | Tester entry code. When `TESTER_ACCESS_CODE` is set, every `/api` route except `/api/health` and `/api/tester-access` needs the code, sent as a cookie (set after typing the code once; holds a fingerprint of the code, not the code; HttpOnly, 30 days) or an `x-tester-code` header (for scripts). Unset = no gate. Wrong guesses (form or header) capped at 10 per address per 15 min (then 429). Also `gateHintCookie`: on page loads it leaves a readable `bundle_gate=on` cookie so the screens show a blank moment instead of flashing the app before the gate. |
| `bundle/server/__tests__/testerCode.test.ts` (new) | 10 tests: no-code mode, block/allow, cookie, old-code cookie rejected, header, wrong code, lockout + recovery, header guesses counted, no-credential requests not counted, hint cookie. |
| `bundle/server/index.ts` | Mounts the gate after body parsing. CORS now allows `PUBLIC_URL`, `FRONTEND_URL` and Render's automatic `RENDER_EXTERNAL_URL`, plus localhost always; adds the `x-tester-code` header. |
| `bundle/client/src/components/gate/TesterGate.tsx` (new) | One-field gate screen ("Enter the tester code you were sent") with the notice "Please use made-up details only — this is a test app." Asks `/api/tester-access` once; no client fetch code elsewhere needed to change (the cookie travels with every same-site request). |
| `bundle/client/src/components/gate/__tests__/TesterGate.test.tsx` (new) | 7 tests. |
| `bundle/client/src/App.tsx` | Wraps the router in `<TesterGate>`. |
| `render.yaml` (moved from `bundle/` to repo root) | `rootDir: bundle`, plan `0.5c-512mb` (Render's current id for Starter), build `npm ci --include=dev && npm run build`, start `npm start`, health check `/api/health`, `autoDeployTrigger: commit`, `SAMPLE_MODE=false`, `MODEL_PROVIDER=nvidia`, `NODE_ENV`, `NODE_VERSION=24`, `TRUST_PROXY=1`, and `sync: false` names for `TESTER_ACCESS_CODE`, `REVIEWER_MODE_TOKEN`, `DATABASE_URL`, `MODEL_API_KEY`, `MODEL_BASE_URL`, `MODEL_REASONING`, `MODEL_FAST`, `ZETARIS_BASE_URL/ORG_ID/API_KEY`, `TAVILY_API_KEY`. 1 GB disk `hmem` at `/opt/render/project/src/bundle/data/hmem`. |
| `bundle/.env.example` | Adds `PUBLIC_URL` and `TESTER_ACCESS_CODE` (empty). |
| `setup/render-setup.md` (new) | Click-by-click guide for Lyndsay, with the line number of each key in `.secrets/bundle.env.local` (no values), tester-code advice and the message to send testers. |

Memory path: not configurable by a setting (`server/bundleDeps.ts` and `server/routes/index.ts` use `path.resolve('data/hmem')`), but it is a fixed spot relative to the app folder, so the disk mounts there. `data/hmem/` is git-ignored, so the mount hides nothing.

Render docs checked today: blueprint spec (render.com/docs/blueprint-spec: `rootDir`, `plan` ids such as `0.5c-512mb`, `sync: false` only prompts on first creation, `autoDeployTrigger` replaces `autoDeploy`) and disks (render.com/docs/disks: Node app root is `/opt/render/project/src`; a disk stops zero-downtime deploys, paid services only).

## Evidence

- `npm run check`: passes (exit 0).
- `npm run build`: passes (`dist/public` + `dist/index.js` 369.8 kb).
- Production start, locally: `PORT=5064 SAMPLE_MODE=false MODEL_PROVIDER=nvidia TRUST_PROXY=0 TESTER_ACCESS_CODE=<test value> node dist/index.js` (secrets loaded by the app's own env loader). Log: "tester entry code is ON", "serving on port 5064".
  - `/api/health` 200 `{"ok":true}`; page `/` 200 and sets `bundle_gate`; `/api/case-law` without code 401 `tester_code_required`; status `{"required":true,"ok":false}`; wrong code 401 `tester_code_wrong`; right code 200 + cookie; with cookie 200; header works (reached the scoreboard's own reviewer check, 403 "for the reviewer only").
  - Real run: `POST /api/run {"familyId":"maya"}` finished `done` in ~15 s, no error, 13 cards (benefit, clawback, recall, discount, coming_soon). Server log shows real NVIDIA text in FinePrintCourt debates (32), Zetaris queries (18 across agents), hmem recall (9), and the startup live search.
  - Server stopped afterwards.
- Browser at 375 px (agent-browser), in `progress/reviews/lane-d-screens/`: `gate-375.png` (gate + notice), `gate-375-wrong-code.png` (friendly error), `gate-375-after-unlock.png` (onboarding opens after the right code). A reload stays unlocked.
- Tests: my 17 new tests pass. Full `npm test`: 1297 passed, 18 failed (8 suites: LaneE, Feed, InsuranceTab, VersionB, LaneB, LaneD client tests; savedVerdicts, finePrintPolicy server tests). `npm run test:v2`: 18 passed, 4 failed (s3, s5, s6). **None are caused by this lane:** only LaneE and s6 render `<App/>`, and swapping my `App.tsx` back to the committed version gives identical results (LaneE 20/20 pass both ways; s6 same 1 failure both ways). The failures sit in files other builders are editing right now (AccountTab, HomeTab, VersionB, shared, cardMeta, etc.).

## Blockers / for others

- The failing tests above belong to the lanes editing those files.
- Git: `bundle/render.yaml` shows as deleted and `render.yaml` as new; commit both together.
- Lyndsay must do Render steps herself (guide). After the first deploy, `sync: false` values are not re-prompted, so any new secret must be added by hand in Render's Environment page.
- Not checked: the live Render link (not deployed). Do the 375 px check and one real run there after deploying.

## QC fixes (after progress/reviews/2026-10-26-lane-d-qc.md)

1. **HIGH, fixed: capital letters skipped the gate.** `testerCode.ts` now compares a cleaned-up path (`normalPath`: lower case, double slashes collapsed, trailing slash removed) for the gate, the gate address and the open list. New tests: `/API/secret`, `/Api/secret`, `/API/SECRET`, `/api/secret/`, `//api/secret` all get 401 `tester_code_required`; `/API/Tester-Access` and `/API/HEALTH` still work. (Express matches routes ignoring case, so before the fix these tests would have reached the route.)
2. **Fixed: the notice now stays.** In tester mode (server says a code is set) the gate component puts one slim line, "Please use made-up details only — this is a test app.", at the very top of every screen. It is part of the page, not floating, so it never covers a button and scrolls away. Not shown on the laptop (no code). Tests check it shows after unlocking and is absent with no code.
3. **Fixed: a wrong `x-tester-code` header now gets 401 `tester_code_wrong` ("That code didn't work…")**, the same as a wrong typed code. A missing code still gets `tester_code_required`.
4. **Fixed: the `bundle_gate` cookie is only set on page loads**: GET, not /api, path has no file ending, and the browser asks for `text/html`. Scripts, styles and pictures don't get it. Tests added.

Left as is, as instructed: (F2) testers sharing one Wi-Fi share the 10-wrong-guesses limit; (F4) if the code is changed while a phone has the app open, the app shows its normal error screens until the page is reloaded, then the gate.

**Re-check evidence**
- Tests: lane's own 23/23 pass (16 server, 7 client). `npm run check` OK. Full `npm test`: 1369 passed, 1 failed (loopsEndToEnd / offlineGuarantee in the full run; both pass alone, 26/26, and don't touch this lane's files). `npm run test:v2`: 22/22 pass.
- Rebuilt (`dist/index.js` 403.2 kb). Ran with `PORT=5064 SAMPLE_MODE=true TESTER_ACCESS_CODE=<test> NODE_ENV=production node dist/index.js`. Curl results: health 200; `/api/families/maya/gear` with no code: 401; `/API/...`, `/Api/...`, `//api/...` with no code: 401; wrong header: 401 `tester_code_wrong`; right header: 200; wrong POST: 401; right POST: 200 + cookie; with cookie: 200; `POST /api/run`: 202. Hint cookie: on `/` yes, on `/feed/x` yes, on `/assets/index-*.js` no. Server stopped.
- Screenshots at 375 px (replaced): `lane-d-screens/gate-375.png`, `gate-375-wrong-code.png`, `gate-375-after-unlock.png` (onboarding with the slim line on top) and `onboarding-375-bottom.png` (scrolled: line gone, "Try a sample family" button not covered). Page width 375 (no sideways scroll).
- Note: the agent-browser tool hung several times ("daemon may be busy"); a fresh session worked.

# Task 10 report: Bundle API, guest mode, Reviewer mode, Coach

Status: DONE_WITH_CONCERNS. Commits (local main): 9e9d2de (feature), 45d564f (replay-cache refresh from live run).
Tests: npm run check clean; npm test 146/146 (14 suites; new: bundleRoutes 16 cases, coach 5). RED confirmed first (module not found).

## What was built
- server/routes/bundleRoutes.ts: createBundleRouter(deps). POST /api/run (202 {runId}; ?wait=true returns BundleResult), GET /api/runs/:id (status + result), GET /api/runs/:id/trace (TraceLine[] read from logs/run-<id>.jsonl, so it fills as the run goes), POST /api/feedback, GET /api/case-law ({proposals, approved}), POST /api/case-law/:id/approve.
- server/agents/coach.ts: proposeRules (>=2 'issue' reports per cluster, LLM clusters via askJson, confidence = min(0.9, 0.5+0.1n) rounded to 2dp; ids validated; model down => no proposals; notes treated as untrusted in prompt).
- server/bundleStore.ts: BundleStore interface, DrizzleStore (Neon, lazy db import), MemoryStore (tests).
- server/bundleDeps.ts: makeRealRunDeps (shared with scripts/run-family.ts, now refactored to use it) + createDefaultApiDeps. registerRoutes takes injectable deps.
- orchestrator.ts: RunDeps.runId optional + exported newRunId, so the API can return the id before the run ends.
- index.ts: CORS allows x-reviewer-token. supertest + @types/supertest added as devDependencies (they were NOT in the template).

## Decisions (owner unavailable)
- Reviewer mode: header x-reviewer-token vs env REVIEWER_MODE_TOKEN, constant-time compare; empty env or empty header => 403. Unknown id 404; re-approve is idempotent.
- Inline family: needs exactly one of birthDate/dueDate (YYYY-MM-DD), 5-digit ZIP with a zip_states prefix, employer optional (default ''). Id guest-<hex>; never saved. Seed table's '000'/'US' default row is rejected as invalid (found live: 00000 was accepted until fixed).
- Unauthenticated limits: 10 runs/IP/10min (wait=true counts too), feedback 30/IP/10min. Feedback only for maya/leo/ava or a family id from a run this server started.
- Coach runs after each feedback save over feedback not yet covered by an existing proposal; proposals deduped by text. A Coach failure never fails the feedback save.
- Run registry is in memory (max 200, oldest evicted); GET run/trace 404 after a restart or eviction.

## Live check (PORT=5050, leo, ?wait=true, live Zetaris + Neon)
200 in ~7s: 14 cards (benefit 5, discount 5, coming_soon 2, clawback 1, recall 1), receipt moneyBack 0 / likelyBenefits $3,640, 2 deadlines (next 2027-01-06), itemsChecked 0, banner null. Trace endpoint returned 41 lines. Approve without token 403; bad ZIP 400 with exact copy.

## Concerns
1. Model not configured: MODEL_REASONING/MODEL_FAST are empty in ../.secrets/bundle.env.local, so the live run used the LLM-unavailable fallback (20 of 41 trace lines have status 'fallback'; Coach proposes nothing live). The learning demo (Task 13) needs real model ids.
2. Behind a hosting proxy, express-rate-limit will see one IP unless `app.set('trust proxy', 1)` is set at deploy time (not done; Task 14).
3. wait=true holds an HTTP connection for up to ~170s; the UI should use the 202 flow.
4. DB-backed paths (DrizzleStore) are only exercised live for zip lookup; feedback/case-law writes against Neon were not hit live (tests use MemoryStore).
5. The live run refreshed the Zetaris replay cache (separate commit 45d564f).

## Fix round 1 (3 Important)
- I1: proposeRules keeps only the newest 40 issue reports (MAX_ISSUES); the store now has listRecentIssues(limit) (Drizzle: WHERE kind='issue' ORDER BY id DESC LIMIT 40) instead of reading the whole table. Test: 60 notes in, only ids 21-60 reach the prompt.
- I2: body limit 100kb for JSON and urlencoded (server/middleware/bodyLimit.ts, used by index.ts and the test app). No other route needs more (only /api/health besides the new routes). Test: 150kb body gives 413.
- I3: global in-flight counter (default 5, ApiDeps.maxInFlight); the 6th concurrent run gets 503, counter decremented in finally. Test: 5 held runs then 503, then a slot frees.
- Run ids are now `<familyId>-<crypto.randomUUID()>` (test added).
Result: npm run check clean; npm test 150/150. Commit: see git log (fix: cap Coach input...).

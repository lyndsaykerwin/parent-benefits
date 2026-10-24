# Task 10 review: Bundle API, guest mode, Reviewer mode, Coach

Spec compliance: PASS. Every listed requirement is implemented as written. Reviewed from the source files and the diff; I did not run the test suite.
Counts: Critical 0, Important 3, Minor 6.

## Spec checklist
- POST /api/run: 202 {runId}; ?wait=true returns the BundleResult. OK.
- GET /api/runs/:id and /trace. OK. The trace is read from the run's JSONL log, and the income mask in trace.ts applies.
- ZIP check: /^\d{5}$/, then a zip_states lookup. The seed table's '000'/'US' default row is rejected, which is correct. Error text is exact. OK.
- Inline family: not persisted. Defaults are householdSize 3, income null, dcfsaOffered true. OK.
- Seed ids: only maya, leo and ava. Any other familyId returns 400. OK.
- Run limiter: 10 per IP per 10 minutes, returns 429. OK.
- Feedback limiter: 30 per IP per 10 minutes. Family must be a seed id or a family from a run this server started. OK.
- Reviewer approve: header x-reviewer-token against REVIEWER_MODE_TOKEN. 403 if the header is missing or wrong, or if the env var is empty. Calls memory.addRule. OK.
- Coach: needs 2 or more 'issue' reports per cluster. Confidence is min(0.9, 0.5 + 0.1n) rounded to 2 decimals, so 3 reports gives 0.8. A model failure produces no proposals. Ids are validated. Report text is flagged as untrusted in the prompt. OK.

## Named risks
- Token comparison: OK. tokenOk hashes both values with SHA-256 and then uses timingSafeEqual, so lengths are equal and nothing leaks. Empty values are rejected first. The approve route has no limiter of its own, only the 500 per 15 minutes global one on /api. Minor.
- Registry growth: the runs Map is capped at 200 with oldest-first eviction, which is OK. See M1 for the two things that still grow: the knownFamilies set and the log files on disk.
- Body size: see I2.
- Error leakage: handlers return fixed messages and log only e.message server-side. The global handler in index.ts hides messages for 5xx in production only. In dev it returns err.message, with no stack in the response. OK, but production deploy must set NODE_ENV=production (M5).
- runId guessability: see M2. Low real risk for seed runs because the data is fictional.

## Important
I1. Coach amplifies cost and its input is unbounded (bundleRoutes.ts, feedback handler).
- Every feedback POST makes one LLM call whenever there are 2 or more uncovered issue notes.
- The prompt lists all uncovered notes in the table, with no row cap. Notes that never cluster stay uncovered forever, so the prompt grows and repeats on every submission.
- listFeedback() also reads the entire table each time.
- Abuse path: an attacker spends 30 submissions per 10 minutes per IP to trigger LLM spend.
- Fix: in proposeRules, take only the newest N issue notes (about 40). In the handler, query only recent rows, or add LIMIT. Optionally put a global limit on Coach calls, or mark rows as "considered" after one pass.

I2. The 10 MB JSON and urlencoded body limit stays in force on a public unauthenticated API (index.ts, template default).
- Every request body also passes through the xss sanitizer, which costs CPU.
- /api/run and /api/feedback need under 2 KB.
- Fix: set express.json({limit:'100kb'}) and urlencoded to 100kb, after checking that no other route needs more.

I3. No cap on runs in flight (startRun).
- The limit is per IP. Each run makes live Zetaris and LLM calls, and wait=true holds a connection for up to about 170 seconds.
- Many IPs, or a spoofed X-Forwarded-For once trust proxy is set in T14, can overload the server and burn LLM quota.
- Fix: add a global in-flight counter, for example 5. Return 503 with a "busy, try again" message above it, and decrement in finally. T14 should also set trust proxy correctly. That is an accepted ruling and not blamed here.

## Minor
M1. knownFamilies (a Set) gains a guest id on every run and is never trimmed. Run log files also pile up in logs/ with no cleanup. Tie the set to the registry eviction and prune old logs.
M2. runId = familyId + timestamp to the second + 4 hex characters (16 bits). Seed-family ids are public, so runs are enumerable, but the data is fictional. Guest runs get extra entropy from the 8-hex family id (about 48 bits in total). Use crypto.randomUUID() or 16 random bytes for the suffix.
M3. Approve check-then-act is racy. Two concurrent approvals can both call addRule, and memory gets a duplicate. Make markApproved conditional (WHERE status='proposed') and add the rule only if that update changed a row.
M4. Dates are not range-checked (year 0001, far-future birth dates). Only the format is checked. Add a sane window.
M5. Make the deploy checklist set NODE_ENV=production, so err.message is hidden from clients.
M6. The Coach's covered/dedupe logic relies on string ids. Neon's feedback.id is a number, and the String() conversions look consistent, but DrizzleStore is untested live (the report says so, concern 4). Do a manual Neon feedback and approve smoke test before the demo.

## Reported concerns
Not blocking: the unset model ids (needed for Task 13), trust proxy (T14), and the long wait=true hold. The replay-cache commit 45d564f is separate and fine.

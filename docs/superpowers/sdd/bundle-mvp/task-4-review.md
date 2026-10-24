# Task 4 review (commit f48d9cf)

## Spec compliance: PASS (all interfaces match the brief; one hardening gap below)
- Generator / NvidiaGenerator(apiKey, baseUrl, models, injected client) / FakeGenerator / askJson {value, usedFallback}: match. FakeGenerator makes exactly 2 calls on ['x','y'].
- TraceLine fields exact; TraceLogger(runId, dir).log returns trace_id, writes logs/run-<id>.jsonl; lines() present.
- BundleMemory addRule/recallRules/feedback/exportLedger over vendored H-MEM; types.ts has AgentContext, Candidate, CourtRuling.
- App runs with empty MODEL_API_KEY: createGenerator returns UnavailableGenerator, askJson falls back at once.
- H-MEM vendored, NOTICE credits Meterless / Apache-2.0 (no separate LICENSE file; NOTICE states the licence, acceptable). Not modified.
- zetaris.ts now imports real TraceLogger/TraceLine; 'degraded' mapped to 'fallback'.
- Tests cover all brief items; FEEDBACK_DELTAS imported not hard-coded.

## Deviations judged
- type 'preference' instead of 'procedural': OK (H-MEM has no 'procedural'); sensible.
- threshold 0.15 + shared-word check: OK, documented in a code comment. Note the filter can return fewer than topN; fine.
- tsconfig target ES2022: OK, needed for vendor Set/Map iteration; low risk.

## Findings
### Important
1. Password redaction leaks JSON-style passwords. Verified: `{"password":"abc123"}` becomes `{"password"[redacted]"abc123"}` (value NOT masked; regex 1 matches the closing quote of the key). Also `Password is abc123` is not masked. Fix: add a first rule for `("?password"?\s*[:=]\s*)"[^"]*"` (and single-quote variant), or mask `password\W{1,4}\S+` generally; add a test for `{"password":"x"}`.
2. NvidiaGenerator has no timeout and uses the SDK default (about 10 min, plus 2 SDK retries). A hung NVIDIA endpoint stalls a run instead of triggering the fallback. Fix: `new OpenAI({apiKey, baseURL, timeout: 20000, maxRetries: 0})` (askJson already retries).

### Minor
3. Income redaction edge cases (safe-side or leaky): `income of 85000`, `income $85 000` (leaves ` 000`), `takes in $85,000 income` (number before the word) are not/only partly masked; `income 85k` leaves "k". Spec only requires "income followed by a number", so acceptable; consider also masking `\$\d{2,3},\d{3}` money values in summaries.
4. askJson aborts on the first ModelUnavailable, so a transient network blip gets no retry (brief says retry once). Fine for the no-key case; consider retrying when the error was a call failure vs. "not configured".
5. TraceLogger constructor's mkdirSync is outside the try/catch, so an unwritable logs dir throws at construction despite "tracing never crashes a run". runId is used unsanitised in the filename.
6. Memory log summaries pass raw rule text/queries (sliced to 200) to trace; they go through redact, fine.

No Critical findings.
Counts: Critical 0, Important 2, Minor 4.

# W3-AUDIT QC (commit c033f92) - PASS

Tests in worktree: npm test = 647 passed, 10 skipped, 0 failed; tsc --noEmit clean. git status clean after (no test-rewritten files). Diff touches only the 3 owned files.

## A. Done check
- Endpoint answers; reuses offerAuditSql() from savedVerdicts.ts unchanged (route line 92); all-brands text is identical to the recorded replay (sample test returns 200 found/none).
- OpenAPI vs code, field by field: status enum found/none/unavailable, brands, message, 7 brand fields (names, null-ability, catchRate 0..1) all match; 200/400/429/503 match (429 body {error}, 400 body {error}, 503 uses OfferAuditResponse). Store regex in yaml description matches savedVerdicts. Matches the view's output columns.
- No leaks: toBrand copies 7 fields explicitly; test feeds dirty row with family/income/zip/rule fields and asserts exact key set.
- Unrecorded ?store= in sample mode: 503 {status:unavailable, message generic}; error text never echoed; test spies on fetch, zero calls.
- Rate limit: express-rate-limit, 60/10min default, injectable; test proves 429 with plain message.
- 503 judgment: acceptable and consistent with savedVerdicts' "unavailable" status. (404 would be wrong: it implies the store does not exist; 200+none would hide an outage.)

## B. Tightness
- store goes into SQL only after /^[A-Za-z0-9 .,&'’-]{1,80}$/ and quote doubling (curly quote also doubled). Array/duplicate param rejected 400 before any query. No injection path found.
- No hardcoded outputs, secrets or real personal data (test rows are "Made-up Store").
- Tests meaningful.

## Must-fixes
None.

## Nice-to-haves
1. Route is not yet registered in server/routes/index.ts (planned orchestrator hand-off patch; do not forget).
2. If deployed behind a proxy, set Express `trust proxy` or the rate limit keys on the proxy IP (shared bucket).
3. Public Cache-Control is set before validation of Zetaris result only; fine, but 400 responses carry no cache header (harmless).
4. yaml `servers` lists only localhost:5050.

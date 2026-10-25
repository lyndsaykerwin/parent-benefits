# W4-STREAM-SRV QC (Oct 25) -- verdict: PASS (with 2 recommended fixes, 1 should-fix)

Verified in the worktree (commit c97fc23): npm test 914 passed / 11 skipped / 0 failed; tsc clean; build OK; eval 6/6 traps, 0 false alarms, expectationFailures [], maya 4899 / leo 0 / ava 1458. Logs/examples/cache reverted.

## 1. Parent safety: OK
- Every RunEvent type traced (card_ready, card_updated, card_removed, agent_status). `parentEvent` is a switch with explicit field copies; the default returns null, so any new event type is hidden from parents by default. Cards go through `parentCard` (key whitelist + sanitized valueScore/sources/body). card_removed drops `reason`. agent_status drops `label` and unknown agents. The `end` payload is `{}`. Run-level events do not exist in the hub.
- Reviewer token: header `x-reviewer-token` only (query string never read); `tokenOk` hashes both sides with sha256 and uses timingSafeEqual (constant-time); empty server token means off.
- Note: `id:` uses the original seq, so filtered gaps are harmless for Last-Event-ID.

## 2. Resource safety: OK
- Disconnect: `res.on('close')` runs cleanup (unsubscribe, heartbeat and cap timers cleared, IP slot freed); tested. Cleanup is guarded against double calls and against onEnd firing during subscribe.
- Proxy: server/index.ts sets trust proxy = 1 in production (TRUST_PROXY override), so `req.ip` is the real visitor; same `req.ip` use as POST /api/run. If TRUST_PROXY=0 behind a proxy, all parents share one IP (4 streams total) -- same caveat as the existing run limiter.
- Lockout: a refresh closes the old connection first, so the cap of 4 open and 60 per 10 min is generous for one parent. Shared-IP households/offices (NAT) could hit 4; acceptable.
- 6-minute cap vs 300 s budget: fine. On cap, the server sends `end`, and the client then polls, so no data is lost.

## 3. Correctness
- Replay of a finished run then `end`: OK (subscribe replays, then onEnd). Last-Event-ID / afterSeq: OK. Unknown run: 200 + end, creates nothing: OK.
- RACE (real, small): `hub.has(runId)` is false from POST /api/run until the orchestrator's first `emit` (agent_status 'working', orchestrator.ts ~252), which comes only after `loadFamily`, `new Workspace` and the memory setup awaits. Sample mode is near-instant so it rarely hits; in live mode (network memory calls) a client that opens the stream right after the 202 can get `end` and silently drop to polling for the whole run (no streaming cards or pills). The result is still correct (polling is the safety net), so it is not a safety bug, but it defeats the feature in the live demo. Recommend fixing (fix 1).

## 4. Client/server format: OK
Server writes `id`, `event: <type>`, `data: <RunEvent JSON>`, `event: end`. Client stream.ts listens for the same four names plus `end` (then polls), `onerror` closes and polls, a 45 s stall falls back to polling, and applyEvent dedupes by seq. A test feeds server output into `applyEvent`.

## Numbered fixes
1. SHOULD-FIX: make the run visible to the stream before the first event. Add `open(runId)` to RunEventHub (creates the empty log) and call it synchronously in `startRun` (bundleRoutes.ts, right after `newRunId`) or at the top of `runBundle`. Then `has()` is true the moment POST returns. Add a test: open, then stream connects, then emit, then finish. (Hub eviction at 100 runs is only reachable by real runs, so the stranger-flooding protection stays.)
2. NICE: the builder's note stands: browsers' EventSource cannot send `x-reviewer-token`, so the Agent Workspace cannot get the full stream; it should keep using the existing owner endpoints. No action needed for parents.
3. NICE: if a run is evicted from the hub (>100 runs) while a stream is attached, the stream just stays idle until the 6-minute cap; harmless.

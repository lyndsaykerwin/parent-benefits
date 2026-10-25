# W4-STREAM-SRV build (Oct 25)

Built `GET /api/runs/:runId/events` (server-sent events) over the run-event hub.

Files: `bundle/server/routes/streamRoutes.ts` (new), registered in `routes/index.ts`; `bundleRoutes.ts` now exports `tokenOk`; `runEvents.ts` gained `has(runId)` (asking never creates a log). Tests: `server/__tests__/streamRoutes.test.ts` (8).

Format (matches client/src/lib/stream.ts): `id: <seq>`, `event: <type>`, `data: <RunEvent JSON>`; `event: end` closes the run; `: ping` comment every 15 s.
- Parents: cards go through `parentCard`; `card_removed` drops `reason`; `agent_status` drops `label` and any agent not in the known list (clawback, recall, benefits, fine_print_court/court, fact_checker). Reviewer token (`x-reviewer-token`) gets full events.
- Reconnect: `Last-Event-ID` header or `?afterSeq=`; replays only later events.
- Unknown run (or after restart): 200 + immediate `end` (client then polls); nothing is created in the hub.
- Disconnect: unsubscribes, clears heartbeat and cap timer, frees the per-IP slot (test checks `listenerCount` back to 0).
- Limits: express-rate-limit 60 connections/10 min per IP, 4 open streams per IP (429), 6-minute max open.
- A test feeds route output into the client's `applyEvent` to prove both sides agree.

Verification (SAMPLE_MODE=true): npm test 914 passed / 11 skipped / 0 failed; tsc clean; build OK; eval 6/6 traps, 0 false alarms, maya 4899 / leo 0 / ava 1458. No SQL changes.
Note: browsers' EventSource cannot send the reviewer header, so the reviewer view of the stream needs fetch-based reading (not built).

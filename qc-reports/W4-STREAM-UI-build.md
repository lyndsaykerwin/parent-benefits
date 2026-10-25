# W4-STREAM-UI build report

Client side of the live feed. No server files touched (no orchestrator.ts, no bundleRoutes.ts).

## What was built
- `bundle/client/src/lib/stream.ts` (new): `followRun` opens `GET /api/runs/:runId/events` (browser EventSource), applies events, and always finishes through the existing once-a-second polling, so the final screen equals the saved result. Falls back to polling when: no EventSource, stream error, stream goes quiet for 45s, or an `end` message arrives.
- Cards: every streamed or saved card is copied field by field to the parent whitelist (id, kind, title, body, amountCents, deadline, verdict, sources label+url). traceId and any extras are dropped. Blocked cards are never shown as ready cards. Order: recall, money back, benefits, deals, coming soon; nearest deadline first.
- Status pills: parent wording per `agent_status` ("Checking recalls...", "Recall check finished", ...). Server `label` is ignored; unknown agents get a generic pill. No agent names, no "real-time".
- `Feed.tsx`: instant feed (reads the run once, then `GET /api/families/:id/latest-run`; shows saved cards with a "From your last check" note; fresh cards replace their saved copy; 404 means the normal checking screen, no error), pills on both parent and owner checking screens.
- Tests: `lib/__tests__/stream.test.tsx` (17), 4 new in `pages/__tests__/Feed.test.tsx`.

## Event contract assumed (for W4-STREAM-SRV)
Each event sent as `event: <type>` (card_ready, card_updated, card_removed, agent_status) with the RunEvent as JSON in `data` (an unnamed message with `type` inside works too). `event: end` when the run finishes. `id:` = seq. Client strips owner fields anyway.

## Not changed
`poll.ts`, `bundle.ts` unchanged (`api.latestRun` already existed).

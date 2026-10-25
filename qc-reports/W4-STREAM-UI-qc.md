# W4-STREAM-UI QC (commit 0257bd9)

Verdict: PASS, with fix 1 strongly recommended in this chunk (small).

Checks run in worktree: SAMPLE_MODE=true npm test = 871 pass / 0 fail (11 skipped, pre-existing); tsc clean; build clean. Generated files restored with git checkout.

1. Acceptance: all met. Fake-EventSource tests cover kind order, pill wording per agent_status, error then polling, stop/cleanup, no-EventSource. grep "real-time" in client/src = only test names (no UI text). 404 on latest-run is swallowed (normal checking screen).
2. Whitelist: sanitizeCard copies 8 fields only (id, kind, title, body, amountCents, deadline, verdict, sources label+url); traceId/valueScore/extras dropped; applied to streamed AND saved cards. Pills ignore server label and agent names. PASS. (Note: valueScore from W4-CARDS is also dropped on streamed cards; fine for now, add to the whitelist later if wanted.)
3. Fallback: pollRun is always the finisher; es closed before polling starts; startPolling is idempotent; native EventSource auto-reconnect is prevented by close() in onerror; 45s stall timer cleared on stop/startPolling; stop() closes es, clears timer, stops poll. Cards deduped by id (seq check + filter). No loop found. Dependency: relies on the W4-STREAM-SRV route sending `end` or closing; otherwise the 45s stall still hands over to polling.
4a. Frozen steps/elapsed: real, visible. setElapsed and setSteps/setLines run only in poll onStatus, and polling starts only at end/error/stall, so during a healthy stream the "Ns" counter sits at 0s and the steps list does not move. A judge would see a stuck timer. Fix 1.
4b. Saved cards have no detail links: acceptable to defer (FeedCardView takes optional detailHref; cards simply lack the link). Not required here; note for W5/polish.
5. Wording plain English; no jargon or agent names.

Fixes:
1. In Feed.tsx add a 1-second ticker (setInterval in a useEffect when !run, cleared on cleanup) that sets elapsed from started/startedAt, so the counter moves during streaming. Optionally derive step ticks from pills. (~6 lines)
2. (Optional) pass detailHref to LiveCards for saved/streamed cards.

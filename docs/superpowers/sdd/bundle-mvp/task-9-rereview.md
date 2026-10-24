# Task 9 fix1 re-review

Test run: orchestrator + factChecker suites, 30/30 pass.

- I-1 ADDRESSED. verify() sets `unavailable` only in the catch path. checkOne retries once only when the reason matches thrift/resultset, never calls revise on an outage, sets the banner, and drops with status 'error'. Tests cover the outage (5 verify calls, no revise) and the transient retry. Note: a transient check retries ONCE per checkOne call; the retry result is not re-tested for transience (fine, it drops).
- I-2 ADDRESSED. Bundled fallback-rules/offers.json (with sources) via scripts/gen-fallback.ts; benefit fillers use shared screenRule (same date logic); verdict 'info', body contains the exact line, never verified; receipt dollar sums count only verified/likely so totals are 0. Test with benefits AND court failing asserts minimums, 'info', totals 0. Fillers are de-duplicated against verified cards.
- Minors: concurrency cap 4 ADDRESSED; purchaseKeywords transient retry ADDRESSED; benefits.revise uses deps.today ADDRESSED (orchestrator passes it); log filename sanitization ADDRESSED (runId and ledger file; '.' also replaced); MAX_RETRIES (/^\d+$/, default 2) ADDRESSED, tested with '-1'.

New breakage / flags (minor, none blocking):
1. Receipt deadlineCount/nextDeadline (orchestrator.ts ~line 117) filter on kind and deadline only, so unverified 'info' filler benefits DO count toward the deadline tally and next deadline. Dollar totals are clean; deadlines are not. Probably should add `counts(c)`.
2. Outage test's "no verified/likely" assertion relies on fillers only; fine, but it does not assert no real cards leak.
3. Parallel checks (4) share `banner` and trace; harmless. Fallback WIC is skipped by design, MA rules are skipped (scope federal only), so a failed run shows federal fillers only.

# Review: UI data-visibility (0bd4df3..HEAD, c4fef64 + 6867447)

Spec: all requirements implemented, with one evidence gap (screenshot 11 shows feedback buttons on a blocked card).
Test run: full `npx jest` green (26 suites passed, 251 tests, 8 pre-existing skips).

## Critical
None.

## Important
1. Screenshot 11 (docs/screens/11-how-we-checked-memory.png) shows "I got this / Report issue" on the blocked diaper-box card. The code guard (`card.verdict !== 'blocked'` in CardDetail.tsx) is correct, so the image looks stale, taken before the guard was in. It contradicts the spec in the one image meant to prove it. Fix: retake 11 from the HEAD build, and add a CardDetail test (blocked card renders no feedback section).

## Minor
1. Duplicate blocked cards possible: `judgeOffers` runs inside `withRetry` (orchestrator.ts:211) and pushes to the shared `ctx.blocked` as it goes. A transient failure partway means the retry pushes the same offers again, so you get duplicate React keys and a doubled list. Fix: dedupe by id in `toBlockedCard`'s push, or reset `ctx.blocked.length = 0` at the start of `judgeOffers`.
2. `redactSql` hides string literals and any `*income*` column name, but not bare numbers. Today no mapped query holds an income number (the only income query, the planner family view in benefits.ts, is never tied to a card), so nothing leaks now. Hardening: also replace numeric literals except ids for the card's own key, or whitelist only the card's own id.
3. Live progress feed: `describeLine` has no case for `memory rule_recalled`, so the run-in-progress view prints the raw pipe format ("Memory: mem-1|0.80|2|..."). Fix: add a case returning "Memory recalled a learned rule".
4. Run-wide "origin" queries are attached by card kind. A discount or recall card can therefore list a query that read other offers or purchases (still labelled as checked sources). This is accurate wording ("N queries across M sources"), and the per-card keys (RecallID, offer id, rule code, tx id) are exact with word-boundary guards, so no other card's id-keyed queries leak (tested with 99999 and 4242).
5. Memory "cited by Judge" for the real mem-1 only appears on blocked cards. This is correct behaviour, but screenshot 12 and 11 show the Judge ran on its rule-based backup ("Court was offline"), not the LLM. Say so if it is shown in the demo.

## Checked and fine
- Named risk, XSS: rule text, SQL, reason and titles are all rendered as React text nodes (no dangerouslySetInnerHTML); source links go through existing `safeSources`.
- Named risk, mapping: card keys are regex-anchored by id with `\b`; truncated (200-char) SQL simply fails to match and the section hides; errored queries are excluded; unknown cards return null.
- Blocked cards: verdict 'blocked', amountCents null, kept in `result.blocked` outside `cards`, so Receipt and the discount minimums cannot count them (orchestrator test compares receipt with and without). No family data or income in the card (court sees offers only); tested.
- SAMPLE_MODE: cache miss throws ZetarisUnavailable before any fetch or writeCache; the write path is only reachable in live mode; tested (no fetch call, empty cache dir). Note sampleMode is only on when keys are absent (bundleDeps.ts:23), as the implementer reported.
- Zetaris header "saved real response" appears only when every hit is `query_cached`; live runs show summed ms.
- Feed list is collapsed (`<details>` without `open`), tested; link target is the blocked card's detail view.
- Screenshots: 09 is named MOCK-DATA; 10/11/12 show real-run content (mem-1, 70%, 2 parent reports). No unlabeled artificial-rule screenshot remains.

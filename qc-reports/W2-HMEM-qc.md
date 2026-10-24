# W2-HMEM QC report (branch worktree-agent-af84d268e9138a6ca, commit 1459de3)

Verdict: PASS (no must-fix). Tests in the worktree's bundle/: 480 passed, 8 skipped, 0 failed. `npx tsc --noEmit`: clean.

## A. Done check
- Item-37 note shape: PASS. workspace.ts:190-201 has exactly {run_id, from_agent, to_agent, type, about, body, evidence_sql, round}; five types; round 0-2 validated (workspace.ts:347-366). Tested (workspace.test.ts:30-55).
- Per-run/per-item notes: PASS. Stored in H-MEM with chatId=runId (memory.ts:86-107); read filters by about/from/to/type; run isolation tested (test:68).
- Lessons point at offer_checks rows: PASS. addLesson stores source/provenance ref `offer_checks:<id>`; recallLessons returns offerCheckId (memory.ts:110-138). Tested (test:164).
- helpful/wrong feedback: PASS. feedbackLesson uses engine deltas; test checks the exact numbers (test:181).
- No AI extraction/dreaming during a run: PASS. No LLM or fetch in either file; test stubs fetch and checks the ledger has no sleep/dream rows (test:199). Slightly weak (only proves the calls it made) but the code has no such calls.
- Each note copied as a trace line: PASS. post/read/lesson/fallback each write a 'memory' trace line plus a line in Lyndsay's format (workspace.ts:376-388); the format check is run in test:102.
- Ledger export unchanged: PASS. exportLedger untouched (memory.ts diff); notes show up as ordinary 'create' rows (test:124). Note: the ledger now also contains workspace notes and lessons (more rows, same format).
- Honest backend logging: PASS. `backend` is 'hmem-local' or 'fallback-memory'; open line, fallback line and "[fallback-memory]" prefixes with status 'fallback'.

## B. Tightness check
- Files touched: all within owned files (memory.ts, workspace.ts, types.ts, memory.test.ts, workspace.test.ts). PASS.
- Hardcoded outputs / real personal data / secrets: none found. Test values are invented (Acme, $52,000, hunter2).
- Masking: PASS. body, evidence_sql and lesson text go through redact(); the trace also redacts. Tests cover income and password in both the stored note and the trace copy. Gap: from_agent, to_agent and about are not masked (low risk, they are ids).
- recallRules excludes notes and lessons: PASS (memory.ts:73 tag filter; tests at memory.test.ts:21 and workspace.test.ts:86,173). Tests pass because notes/lessons and rules actually share the store and the filter is what separates them.
- Fallback path tested: PARTIAL. Test (workspace.test.ts:143) uses a store that throws on every call, so the failure happens in the constructor probe. The mid-run switch (switchToFallback from post/read/addLesson after a healthy open) is never exercised.
- Dead code: memory.ts:34 adds an `agentLog` parameter to the private log(), but no caller passes it (memory.ts:50,68,131). Also `Lesson` (workspace.ts:207) duplicates `StoredLesson`.

## Must-fix
None.

## Nice-to-have
1. memory.ts:34/38: remove the unused `agentLog` parameter and the AgentLogHint import.
2. workspace.test.ts:143: add a test where the store works at open, then throws on a later post/read (covers switchToFallback and the mirror catch-up).
3. workspace.ts:207: reuse `StoredLesson` instead of a duplicate `Lesson` type.
4. workspace.ts:351-353: also redact from_agent/to_agent/about, or restrict them to known names.
5. memory.ts:58,125: recall windows are topN+20; if more than 20 notes outrank the rules, case-law recall could return fewer than topN. Fine for a 300-second run.
6. workspace.ts:334-341: a lesson id starting 'local-' is logged as a fallback even if the engine is healthy (edge case only).

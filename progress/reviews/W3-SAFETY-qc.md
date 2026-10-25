# W3-SAFETY QC (branch worktree-agent-a9bb7705bb6114af3, 06fb8fa)

Verdict: PASS (no must-fixes).
Tests (worktree bundle/): 655 passed, 10 skipped, 1 failed (666). `npx tsc --noEmit`: clean. Worktree clean after run.

Failing test: eval.test.ts "maya: expected card recall-cpsc-10560 is missing". Confirmed sole cause: the stored Zetaris replay (data/sample/zetaris-cache/462e8c...json and 59c5a9...json) still holds KEAWIS purchased_on 2026-09-10; the real recall's sale window is Aug 2024 to Jul 2025, so the new date rules reject it. Resolves on Mac re-record (itemsSql/pairsSql replay).

## A. Done check
- recall.ts imports recallMatch.ts (matchRecall, typesIn, extract*); askJson/llm import and MAX_PAIRS removed. judgePair is synchronous, no model call.
- itemsSql, pairsSql, finishedFdaSql unchanged (diff touches only comments); clawback fsaSql/priceSql text unchanged. COALESCE(p.store, p.seller) was already in clawback.ts on main (lines 24, 34, 38).
- recallDetailsSql is new, separate. If the detail query throws (no replay), readRecallRecords logs a 'fallback' trace line and judges from pair rows only.
- Every alert body gets "Matched on: <evidence>" (toCandidate); evidence cleaned of the matcher's own lot sentence; formula lot line appended once (LOT_LINE, tested "once").
- Evidence contract for FACT: claim carries evidence, evidenceType (upc|lot|model|name|confirmed), evidenceCode, recalledProduct (raw pair-row text, not a paraphrase), itemText (+ matchLevel). Test covers it.
- Safety loop (clawback.ts safetyGate): runs before return from findClawbacks (so before the Judge). Recalled item: workspace question, answer, verdict notes; trace line action 'safety_kill', status blocked, text includes "do not encourage buying or claiming a rebate on this item". Recall check throws: deals kept, trace 'safety_check' status fallback "not safety-checked". Workspace failure never blocks. One lookup per run shared with recall cards via WeakMap; revise re-reads (fresh).
- no_false_recall test still passes with the real matcher.

## B. Judgment
- Dropping the LLM from recall matching: consistent with M5 (fixed rules, evidence line, fixed lists) and with the plan's "no model for safety". Only cost: borderline pairs the rules reject are silent misses (logged as recall_rejected, first 20). Acceptable.
- Keeping deals when the check cannot run: reasonable and honest (loud fallback trace). Stricter alternative (hide money-back cards when unchecked) would be safer for a real product but would blank the feature offline. Suggest noting it in the demo script. Not a must-fix.
- Maya date 2025-03-10: required by the real recall (sold Aug 2024 to Jul 2025), and the test pins that. But Maya's baby was born 2026-10-03 (families.json), so a March 2025 crib mattress predates the pregnancy by about 10 months. Plausible only as a hand-me-down or earlier purchase for an older child; the story reads slightly odd. Acceptable for a planted demo; consider a note in the sample README.

## C. Tightness
- Changed files: the 4 owned files plus purchase-items.json (authorized date). No secrets, personal data or hardcoded outputs. recallDetailsSql uses quoteInt/quoteId, throws InvalidId on empty/unsafe, no family data in the text. Tests are meaningful (kill both deal types, workspace, no-workspace, failure paths, one-query, window rejection, UPC/lot, formula line once, FACT contract, real recall 10560 record check).

## Nice-to-haves
1. recall.test.ts ~line 386: the Maya test reads ../../../experiments/entity-resolution/data/cpsc.json; it will break if that folder moves (or in a checkout without it). Consider a skip guard.
2. Mac re-record needed: zetaris:record (the date change makes the old itemsSql/pairsSql replay stale), plus the new recallDetailsSql replay, then agents-live and examples:regen --live. Tracker's Zetaris list should add recallDetailsSql (new query).
3. recall_rejected logging capped at 20 per run; fine.

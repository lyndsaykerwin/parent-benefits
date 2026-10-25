# W3-FACT QC (commit 6dec6b3)
Verdict: PASS (with nice-to-haves). npm test: 662 passed, 10 skipped, 3 failed. tsc --noEmit: clean. No tracked files changed by the run.

## Failures
1. benefits.test.ts:185 - fake rows lack `scope`; fail-closed returns "wrong state: source does not say" -> ruling 3 only.
2. eval.test.ts - missing recall-cpsc-10560 (no structured evidence yet, ruling 2) and benefit-ma_pfml / ma_child_tax_credit (recorded replay holds old rule SQL text without `scope`, ruling 1) -> only those.
3. sampleMode.test.ts:104 - banner "Some sources didn't respond": replay miss on the changed rule query makes verify return unavailable -> ruling 1 only.
Replays containing the old SQL: logs/sample/*.jsonl, output_examples/learning/run*.jsonl (re-record needed).

## A. Done check
- Targeted corrections name field/said/source (compare(), item price) via correctionInstruction: yes.
- Max 2 rounds (MAX_CORRECTION_ROUNDS, loop; recall/no-source/wrong-state/unavailable never sent back): yes.
- approve_card / status ok / target ParentFeed on final yes: yes.
- Lessons: helpful on first-time approve, wrong after correction/gave up, none when unchecked: yes.
- Loop 8: evidence-less recall dropped in check() before any query: yes. Code whole-word match (hasWholeCode) and UPC leading zeros ignored: yes.
- Wrong-state: rule scope vs family state, federal passes, empty scope fails closed, drop() = no send-back: yes.

## B. Judgment
- Recall check reuses text the producing agent read (no independent read): acceptable. Plan says check against the recall record, and notes say prefer no new SQL; the existing recall-id query still runs. Weakness: the checker trusts the agent's `recalledProduct`. Nice-to-have: SAFETY should pass the raw feed text, not a paraphrase.
- Fail-closed on missing scope: seed gives federal rules scope='federal' (seed.ts lines 48-57) and state rules their 2-letter state. Safe once the live view/replay returns scope. Until re-recorded, replay mode shows unchecked (cause of failures 2-3).

## C. Tightness
- Only factChecker.ts and its test changed. 3 existing fixtures changed (rule rows gained scope x2, recall claim gained evidence fields): legitimate, required by new behaviour.
- No hardcoded outputs or secrets; tests use seed BENEFIT_RULES and real hmem feedback deltas.

## Must-fix
None.

## Nice-to-have
1. checkWithCorrections is not called by any agent yet (W4-ORCH wiring); make sure the hand-off is tracked.
2. 'confirmed' evidence type only checks both texts exist (weak); fine while shown as "likely".
3. Re-record replays after SAFETY lands (rule query now selects scope).

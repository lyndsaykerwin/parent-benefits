# W3-COURT QC (commit 0000c83)
Result: PASS (no must-fixes). `npm test` (no TEST_DATABASE_URL): 659 passed, 11 skipped, 0 failed (expected ~660/10; one extra skip, likely the DB-gated offerChecks test; not a failure). `npx tsc --noEmit`: clean. Worktree clean afterward. Wave-1 `finePrintRules.test.ts` (FP-01..FP-12 + 3 controls) passes untouched (rules code not edited).

## A. Done check
- One rebuttal per offer per run: Newsroom.canRebut/useRebuttal (newsroom.ts:116-117), keyed per offer, per-ctx WeakMap so send-back re-judges share the count (finePrintCourt.ts:158; test "strictly max 1"). Yes.
- Stricter wins: finalVerdict(code, judge) (finePrintCourt.ts:187) plus reject override text (188-190). Yes.
- One saved-verdict question/run: judgeOffers calls nr.load once; revise never loads; uses savedVerdictsSql via fetchSavedVerdicts unchanged (savedVerdicts.ts not in diff). Test asserts one query. Caveat: orchestrator wraps judgeOffers in withRetry (orchestrator.ts:215), so a transient-error retry would ask again (see nice-to-have 1).
- canSkipAi reuse: only via canSkipAi (agreed + same fingerprint, or agreed universal reject). Tests: disputed not reused, changed wording graded fresh, universal reject no AI.
- Past grades + H-MEM lessons in Judge prompt (basePrompt, past.promptText) and named in trace (`newsroom_context`). Yes.
- Write-back: writer refuses non-'agreed' inside createOfferCheckWriter (offerChecks.ts:48); caller only writes standing==='agreed'; disputed/fallback/offline never saved; row has no family field (test). Yes.
- approve_with_catch: amount = trueValueCents, else face minus hidden cost (toCandidate:209-211; savedCandidate too). Yes.
- OFFLINE_APPROVE_TEXT updated (finePrintCourt.ts:59) with test updates.

## B. Judgment
- Saved-verdict replay: the id list = offers picked for that family (age window + keywords), so the SQL text varies by family. Sample mode replays only exact text, so only families whose picked set matches a recorded one will hit; others get "unavailable". No recording of v_offer_verdicts exists today anyway. Acceptable for the demo but the Mac recording should be done for the specific demo families (Maya, Ava, etc.).
- Fallback honest: yes. Trace logs "saved grades unavailable ... every offer is graded fresh" with status fallback; never fabricated. Test covers it. Does not touch the 12 FP tests + 3 controls (those are pure code rules).
- effort_minutes_estimate = upper end: sensible (cautious, matches "paid in" rule of showing both ends only when stated); lesson text also says "about N minutes".

## C. Tightness
- Owned files only (+ types.ts, allowed). No hardcoded outputs/secrets/personal data.
- Gap (out of scope): nothing sets ctx.offerChecks, so in real runs nothing is saved until W4-ORCH wires createOfferCheckWriter(db). Must be in W4 hand-off.
- Injection: lessons are redacted and capped at 500 chars by workspace.addLesson, framed as "context, not binding", but built from offer title/store (offer-supplied text) and inserted raw (newlines intact) into the Judge prompt; saved-grade store also raw. Low risk (offer title is already in the prompt; verdict is JSON-validated and the code screen can only make it stricter), but see nice-to-have 2.
- Tests meaningful: assert call counts, prompt contents, trace lines, writer refusal, fake DB rows.

## Nice-to-haves
1. newsroom.ts:67 `load`: skip if savedStatus !== 'not_asked' so a withRetry re-run of judgeOffers never asks the saved-verdict question twice.
2. newsroom.ts:108/107: collapse whitespace/newlines and quote store/title text in lessons and past grades before putting them in the prompt.
3. Record v_offer_verdicts replays for the demo families on the Mac; note one extra skipped test (11 vs 10).

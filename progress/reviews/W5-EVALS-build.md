# W5-EVALS build report

Date: 2026-10-25. Setting: SAMPLE_MODE=true, saved Zetaris answers only, no model.

## What changed
- `bundle/scripts/eval.ts`
  - Scoreboard gains, all computed by running the checks (nothing typed in):
    - `finePrint`: 15 answer-key cases; catches found 2/2; controls with a false alarm 0/3; answer-key fields correct 46/46; quotes not exact words 0.
    - `recall`: expected recall shown 1/1; look-alike or finished recalls wrongly shown 0 (3 checked).
    - `photo`: `{ measured: false, madeUpRate: null }` with the reason. There is no saved vision replay, so it says "not measured offline" rather than a made-up 0.
    - `loops`: per family, per run, counts read from the trace lines (send-backs, corrections, rebuttals, court rulings and blocks, saved-verdict reads, eligibility questions, recall verifications, safety checks, cards approved or rejected).
    - Provider and model that answered: already present (`llmMode`, `llmCalls`), unchanged.
  - Learning demo moved to a subtler trap taken from an offer already in the saved data: offer 1328, "Amazon Subscribe & Save diaper discount" (savings only last while a subscription stays active and the price can change). It has no free-trial or auto-renew words. The old "free diaper box" trap (1318) is taught in the same cycle and kept as `learningDetail.obviousTrap`.
  - New check: `learning.collateralBlocked`, which counts other approved offers that run 2 wrongly blocked (0). Counted into `falseAlarms`, as are control false alarms and wrong recalls.
  - `mergeLearning` gets null slots for the new fields.
- `bundle/evals/expected.json`: added `subtle_subscription_savings`. Removed the retired `refund` trap, whose check was empty and always passed. Traps went from 6 to 8 because the recall look-alike and finished-FDA checks that were already in the answer key are now scored: `no_false_recall`, `no_terminated_fda`.
- `bundle/server/agents/coach.ts`: one new offline theme in `THEMES` (a rule for "savings that depend on a plan"). It is text only, so no Zetaris SQL changed. Real-model clustering is unaffected.
- `bundle/scripts/regen-examples.ts`: also copies the agent log `logs/run_bundle_<runId>.jsonl` to `logs/sample/<name>.agent.jsonl`.
- `bundle/server/__tests__/eval.test.ts`: totals 8/8, subtle-trap and collateral assertions, fine-print/recall/photo/loops tests.

## Zetaris safety
No offer added or changed, no SQL text changed, no replay file written (`git status` clean for `data/sample/zetaris-cache`).

## Results
- `SAMPLE_MODE=true npm test`: 60 suites passed, 908 passed, 0 failed (baseline 906; +2 new tests).
- `tsc`: clean. `npm run build`: OK.
- `npm run eval`: 8/8 traps, 0 false alarms, `expectationFailures` empty, stable, maya 4899 / leo 0 / ava 1458. Learning flip: run 1 approved offer 1328, run 2 blocked it citing the learned rule, 0 other offers blocked.
- Generated `logs/scoreboard.json`, `output_examples/learning/*` were reverted (W6-EVIDENCE regenerates them).

## For others
- `client/src/pages/Smarter.tsx` lines ~152-153 say "free trap offer" in the learning text; it now describes a subscription-savings offer. Not touched (not my file).
- Real-model scoreboard still needs the Mac `eval:live-model` run.

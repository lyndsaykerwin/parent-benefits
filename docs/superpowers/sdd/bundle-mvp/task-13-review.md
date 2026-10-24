# Task 13 review

Spec: PASS (with one Important finding). Critical 0, Important 1, Minor 3.

## Named risks
1. Hard-coded outcome? No. The trap is blocked in run 2 because the Coach's rule is stored in memory (addRule + markApproved, same two steps as the approve route), recalled by the Court (ctx.memory.recallRules on the fine print), and matched by shared keywords in finePrintCourt.screen. Nothing special-cases offer id 966 or the title in the court/eval logic. run1.jsonl shows judge "approve ... nothing found"; run2.jsonl shows "reject ... [cited mem-1]" for offer 966 only, other offers still approved. The trap is found by title from expected.json (a test oracle, not logic).
   Mild fixture tuning (disclosed in coach.ts): the offline THEMES rule wording reuses parent words so the offline Court can match. It still requires >=2 issue notes in a theme and a human approval.
2. Partial scoreboard overwrite: real. `--learning` writes logs/scoreboard.json with unmeasured traps shown as caught:false, no moneyBack/falseAlarm numbers. /api/scoreboard serves that file, so running --learning after the full eval would show a degraded board. The file on disk now is the full one (6/6, 0 false alarms, 100%, runs 3, stable, moneyBack maya 4899 / leo 0 / ava 1458, learning mem-1).

## Findings
- Important: --learning clobbers the full scoreboard. Fix: in main(), when --learning, write to logs/scoreboard-learning.json (or merge only `learning`/`learningDetail` into the existing file); never overwrite the full board with a partial one.
- Minor: Coach auto-renew theme regex is broad ("charged", "trial", "monthly"); two unrelated notes saying "charged" would propose the auto-renew rule. Gated by reviewer approval; tighten if time.
- Minor: Scoreboard.demoDate comes from expected.json, not resolveToday; harmless but could drift.
- Minor: Scout wrong-amount trap relies on a scripted row (labelled scoutLlmMode "fake-llm"). The rejection itself is real logic (amount must appear on the page); label is honest. upsertScoutRows is untested/unwired (disclosed).

## Spec checks
- Scout: exactly 3 pages, sourceUrl required, no-source rows go through factChecker.verify; same-site and amount-on-page checks; without a model returns nothing (no fake). OK.
- runEval Scoreboard fields present plus honesty labels (llmMode, scoutLlmMode). trapsTotal 6, sourcedPct 100. OK.
- Learning flow, traces in output_examples/learning, scoreboard written. OK.
- Demo date: resolveToday (seed families DEMO_TODAY unless TODAY), wired in bundleDeps/routes, status returns demoDate, Feed label helper with test. OK.
- maya moneyBack 4899 asserted via expected.json on cached Zetaris; root-cause explanation (Zetaris flakiness, not date bug) is plausible per report; not independently re-run (read-only, no suite).
- Zetaris cache commit eea2c8d present.

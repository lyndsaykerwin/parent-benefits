# Task 8 review: Benefits Planner

Spec: PASS. Critical 0, Important 0, Minor 3.

## Spec checks
- Deadline math: addDays uses UTC midnight + whole-day ms, sliced to ISO. No timezone drift (UTC has no DST). maya 2026-10-03+30 = 2026-11-02; leo 2026-12-07+30 = 2027-01-06. Window comparison is string compare of ISO dates, valid. Deadline == today kept (tested).
- Past-window exclusion, MA exclusion for non-MA, Trump Account 2025-01-01..2028-12-31 (string compare, inclusive edges tested), CTC deadline null, WIC from poverty_guidelines row (income*100 <= line*185 is the correct cents math; null income or missing row skips) all correct.
- Amounts/deadlines only from rules table; LLM writes body via explain() with dollar-figure guard and deterministic fallback; tested accepted/rejected/no-model.
- Income never in trace summaries or LLM facts (test covers trace + card text).
- Fact-Checker contract: claim {type:'rule', ref: code}; test runs verify() on every card. Safe SQL: quoteId / quoteInt, unsafe id returns [] without querying.
- revise() exported, re-derives from source, null when rule gone.
- Brief's expected values all asserted in tests.

## Judgment: "(after birth)" on every unborn card
Acceptable and matches the brief's literal text. Slightly odd on cards with no deadline (e.g. "Federal Child Tax Credit (after birth)"), but consistent and harmless. Minor only.

## Minor
1. Title suffix on non-windowed cards reads awkwardly; could limit to cards with a deadline. Optional.
2. revise() re-runs the whole plan (3+ queries and an LLM call per card) just to rebuild one card. Fine at hackathon scale; could pass a code filter.
3. Cached zetaris JSON in data/sample contains fake seed incomes; allowed (fake data), noted by implementer.

No tests run (read-only review).

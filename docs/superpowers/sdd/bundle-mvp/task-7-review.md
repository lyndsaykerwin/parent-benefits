# Task 7 review: Fine Print Court

Spec compliance: PASS. Severity: Critical 0, Important 1, Minor 4.

## Spec checks (all met)
- judgeOffers signature/return Candidate[]; reads bundle_pg.v_judge_offers (view now has trigger_keyword, no family columns; register.ts --replace path added). Age interpolated via quoteInt only; keyword matching in code, no keyword text in SQL.
- Cap 5, triggered first then general (includeGeneral gates general). Tested (15 calls, trigger first).
- 3 LLM calls/offer (fast, fast, reasoning via askJson) and 3 trace lines (deal_hunter, fine_print_lawyer, judge). Tested.
- Judge prompt lists recalled rules with [id] and confidence. Tested for text+id.
- Offline screen per ruling: rule keyword match -> reject citing id; explicit shipping/handling/postage fee > $5 -> reject; else approve 'likely', trace 'fallback'. No hard-coded auto-renew. Rejected -> 'blocked', excluded.
- Amounts/deadline deterministic from offer row; claim {type:'offer', offerId} matches factChecker offer branch. revise() exported, re-queries by safe id, adds reason to all prompts.
- Seed/trap rulings applied (no shipping sentence, trigger 'diaper'); cited ids filtered to recalled ids.

## Findings
Important
1. bigFee false positive (finePrintCourt.ts bigFee): any sentence mentioning shipping with any dollar figure > $5 rejects, so "Free shipping on orders over $50" or "$10 off, shipping included" is rejected offline. Fix: only count a dollar amount adjacent to the fee word (e.g. regex `\$\s?N\s*(shipping|handling|postage)` or `(shipping|handling|postage)[^.$]{0,20}\$N`) and skip "free shipping"/"over $N" phrasing; add a test for "Free shipping on orders over $50" being approved.

Minor
2. askJson retries once on malformed Judge JSON, so that case makes 4 LLM calls (and the spec says exactly 3). Edge case, untested; accept or note, or pass a single-try path.
3. Trigger match `o.trigger.includes(k)` with k.length >= 3 is loose (keyword "dia" would match "diaper"); prefer whole-word/stem compare.
4. Test gaps: no test that invented cited ids are dropped, that Judge approve traces 'ok', or that a Judge-unavailable-but-hunter-ok path works; trap test's fine print omits "$40 shipping subscription" (the brief's wording), though that is consistent with the ruling. Tests are otherwise meaningful (assert prompts, trace order, statuses, candidate shape).
5. Offline reason strings say "Court was offline" even when askJson fell back due to bad JSON with a live model; cosmetic.

Evidence limits: read-only; I did not run tests (report states 97/97, check clean).

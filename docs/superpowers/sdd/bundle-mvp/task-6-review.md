# Task 6 review: Clawback Hunter and Recall Checker

Spec compliance: PASS (with the one deviation noted below that is covered by a ruling).
Counts: Critical 0, Important 2, Minor 3.

## Named risks
1. LLM "no" dropping an exact product-name match: YES, it can. recall.ts judgePair() computes `exact`, then asks the model; `value.same ? {row, exact} : null` drops the pair on a model "no". The report admits this and says it is tested. The exact flag only feeds the fallback. A false "no" on KEAWIS removes a safety recall.
2. Price-adjustment window: correct. SQL uses datediff(observed_at, purchase date) BETWEEN 0 AND window_days (relative to purchase); code re-checks seenOn >= date && seenOn <= addDays(date, window); deadline = purchase + window; the Fact-Checker re-derives it independently. Boundary inclusive both ends (deadline 2026-10-23 case lines up with live result). Ava's out-of-window drop is correctly not flagged.
3. SQL from purchase titles: no escaping needed and none missing. Titles, merchants, keywords never reach the SQL string; they are joined inside Zetaris. Only family id (quoteId whitelist), plan-year dates (quoteDate, year from today()/TODAY validated by regex) and constant stop-words are interpolated. Unsafe family id returns [] without querying.

## Important
1. Exact containment can be overridden by the model (recall.ts judgePair). Fix: if `exact` is true, accept the pair without asking the model (verdict verified); only ask the model for non-exact pairs. Update the test that currently expects a false "no" to drop KEAWIS.
2. MAX_PAIRS = 25 slice happens before judging, on rows ordered only by recall_date DESC (recall.ts, `.slice(0, MAX_PAIRS)`). With a real, larger CPSC feed the noise pairs (brand/token matches) can push an exact-name match past 25 and silently drop it. Fix: sort so exact containment pairs come first (exactContainment(item, product)), and always keep all exact pairs, capping only the non-exact ones.

## Minor
1. Spec deviation (ruled OK): itemsChecked for maya is 9, not the Amazon row count 3; matches the stated ruling (Amazon items + card item descriptions). Note that "Groceries" / "Daycare tuition" are counted as items, which pads the number shown to users; consider excluding card categories that match no item-like text if Task 9 displays it prominently.
2. DCFSA candidate's claim txId/txAmountCents is only the latest payment, while amountCents is the capped sum; the verifier uses planYear, so it works, but revise() for dcfsa matches by type only (fine for one-per-family).
3. FDA recall URL is a generic enforcement-report page (no per-recall URL in the feed); acceptable but weak as a "source" if shown as a citation.

## Other checks (all fine)
- Refunds (amount_cents > 0 in SQL plus an in-code guard) and duplicates (dupKey merchant+date+amount) never become candidates; no-data family returns [] (recall returns itemsChecked 0 without the pair query).
- Amounts are integer cents; price amount = paid - lowest in-window price; DCFSA only when dcfsaOffered, min(total, 750000), verdict likely; income is never traced.
- explain() guard throws away any model body containing a dollar figure not in the allowed list, so dollar amounts stay deterministic.
- CPSC and openFDA explode sit in subqueries; one statement per call, no trailing semicolon.
- verify() extended for all three subtypes with tests (factChecker 14 passing per report); revise() exported from both agents.
- Not run by me (read-only, no suite). Relied on report's 84/84.

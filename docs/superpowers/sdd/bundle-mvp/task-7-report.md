# Task 7 report: Fine Print Court
Status: DONE (with concerns). Commit a08dab5 on local main (not pushed). npm run check clean; npm test 97/97 (10 new in finePrintCourt.test.ts).

Files: server/agents/finePrintCourt.ts (judgeOffers, revise, babyAgeDays), server/__tests__/finePrintCourt.test.ts, scripts/zetaris/court-live.ts, plus cached Zetaris results in data/sample/zetaris-cache/.

Decisions:
- Reads bundle_pg.offers, not v_judge_offers: the view has no trigger_keyword column, which the brief needs. Offers hold no family data. Changing the live view would need a drop and recreate in Zetaris, so I skipped it.
- Trigger matching is done in code (purchase keyword contains the trigger or vice versa), so no keyword text is put into SQL. Only the integer age is interpolated, via quoteInt.
- Order: triggered offers first, then general ones, capped at 5.
- 3 LLM calls per offer: hunter and lawyer on the fast model, Judge via askJson on the reasoning model. 3 trace lines per offer. Judge line status: blocked on reject, fallback on offline approve, ok otherwise.
- Controller ruling applied (offline screen replaces "unavailable -> reject"): rejects if the fine print shares at least 2 keywords with a recalled rule (cites its id), or if a sentence mentioning shipping/handling/postage states a dollar amount over $5. Otherwise approves as 'likely' with status 'fallback'. There is no hard-coded auto-renew or subscription detection.
- The Judge's cited ids are filtered to the ids actually recalled, so invented ids are dropped.
- Candidates: claim {type:'offer', offerId}, deadline = birth/due date + maxAgeDays. verify() returned OK for all live candidates.
- Approved cards use a deterministic body, because explain() would add a 4th LLM call.

Tests: trap rejected on Judge reject; Judge prompt contains rule text and id; 3 calls and 3 traces per offer; cap 5 (triggered first); includeGeneral on and off; offline (a) approved as likely/fallback, (b) rejected citing the rule id, (b2) unrelated rule does not reject, (c) $7.99 rejected and $3.99 allowed; revise. The tests and implementation were written in the same pass, so I did not run a separate RED step.

Live (Zetaris, no model key): maya (age 20d) and leo (age -45d) each ran the SQL and approved 5 offers offline, all verify OK, results cached.

Concerns:
1. The seed trap's fine print includes "Shipping and handling $7.95", so the offline screen rejects it on the fee alone, before case law is consulted. The offline learning demo therefore cannot show case law doing the work on the seed trap unless the seed fine print drops that sentence (the tests use the trap wording without it). Seed change is a controller call.
2. With the cap of 5, general offers sort by id, and the trap is the 6th general offer, so it is usually never judged when triggered offers fill the slots (it was not in either live run). The orchestrator may want to force-include it for the demo, or the ordering could change.
3. v_judge_offers is unused by the court (see decisions).

## Follow-up round (controller rulings on concerns 1-3)
Done:
1. scripts/seed.ts: trap fine print no longer mentions shipping/handling ($7.95 removed; auto-renew wording kept). Seed test now asserts the trap exists, has trigger 'diaper', and no 'shipping' text.
2. Trap has triggerKeyword 'diaper'. Maya already had diaper purchases in her fixtures (Walgreens, Pampers newborn diapers), so no fixture or count changes were needed. The trap now ranks into the top 5 as a trigger match.
3. scripts/zetaris/register.ts: v_judge_offers now includes trigger_keyword (still no family columns). New path `--replace=<view,...>` re-runs CREATE DATASOURCE VIEW for the named views only. The court now reads bundle_pg.v_judge_offers.

Commands and outputs:
- `npx tsx scripts/zetaris/register.ts --replace=v_judge_offers` (dry run) -> "WOULD RUN [view v_judge_offers] CREATE DATASOURCE VIEW ... trigger_keyword ..."
- `... --replace=v_judge_offers --apply` -> "RUN [view v_judge_offers] ok (241 ms)" (applied twice; the second was a harmless no-op replace)
- `npx tsx scripts/seed.ts` -> "Seeded Bundle tables." (Neon, Bundle tables only; offer ids changed, which is fine)
- `npx tsx scripts/zetaris/court-live.ts` (offline) -> maya: 5 approved, "Free newborn diaper box" is first, amount 4000, verify=OK, judged and approved as likely/fallback (no case law yet). leo: trap also approved offline. All judge lines status 'fallback'. Cache refreshed in data/sample/zetaris-cache/.
- npm run check clean; npm test 97/97 passing.

## Fix round 1
Changes in server/agents/finePrintCourt.ts:
- bigFee now counts only a dollar amount directly attached to shipping/handling/postage ("$7.99 shipping", "shipping fee of $9", "shipping and handling: $7.95"). A threshold (over, above, minimum, spend, orders of) before the amount is skipped, so "Free shipping on orders over $50" is no longer rejected.
- Trigger matching is whole-word (a plural -s/-es is allowed): "diapers" matches 'diaper', "dia" and "carseat" do not.
- New tests: threshold and fee cases (c2), whole-word trigger, invented cited ids dropped (approve and reject), Judge approve traces 'ok'.
Command: npm run check && npm test -- finePrintCourt -> tsc clean; 13/13 passing. Commit: 3948a67.

# W2-PURCH QC (commit 7f0a878, branch worktree-agent-ac39e3c2f76ac25b3)

Verdict: PASS with caveats (not mergeable-and-green until replays are recorded AND evals/expected.json is updated).

## Tests
- npm test in worktree: 468 passed, 8 skipped, 4 failed (eval.test.ts x3, sampleMode.test.ts x1). tsc --noEmit: clean.
- Replay cause confirmed: I hashed the 5 changed Zetaris queries (itemsSql, pairsSql, finishedFdaSql, fsaSql, priceSql) for maya; none has a file in data/sample/zetaris-cache. Sample mode throws "No saved response", so recall/clawback give no cards.
- BUT replays are NOT the only cause of the eval failures. evals/expected.json (not owned by any chunk) still expects card "clawback-dcfsa-maya" and old transaction ids (clawback-fsa-maya-tx-01, -price-maya-tx-02, ava tx-04). New card ids are `clawback-fsa-<purchase_items serial id>` so those idContains strings can never match, and the daycare card is deliberately gone. After recording replays eval.test.ts would still fail until expected.json is updated.

## A. Done check
- Codes from purchase_items only: PASS. recall.ts reads only bundle_pg.v_purchase_items; pairsSql joins on UPC, lot, model first; codeEvidence() (code, not model) produces "UPC/lot code/model number X appears in the recall notice" appended as "Matched on: ..." Tests cover UPC, lot, short-fragment rejection.
- no_false_recall (CPSC 10490 / 10453): passes (recall.test.ts:193), but against a fake pair list.
- M8: no agent reads transactions / v_clawback_tx / v_recall_orders / Plaid: PASS for recall, clawback, factChecker (test asserts it). Daycare: dcfsa claim removed from factChecker, clawback, tests; unknown type fails closed.
- Planted recalled item (KEAWIS mattress) found with fake Zetaris: PASS.
- Gaps vs M5 wording (probably W3-SAFETY, but note): (1) server/agents/recallMatch.ts (the W1-RECALL matcher with sale dates, pad/liner/insert, size clash) is imported by NO agent, only its own test. recall.ts still uses its older loose SQL join + model confirm. (2) Evidence line exists only for code matches, not for exact-name or model-confirmed matches. (3) No "check the lot number on the can" line for formula recalls anywhere in server code.
- Maya money-back total unchanged by design: 2899 + 2000 = 4899 (no daycare card was ever in the 4899 expectation). Builder should say so explicitly.

## B. W2-ZREG integration (main already includes ZREG, bundle/scripts/zetaris/register.ts)
v_purchase_items = id, family_id, source, store, seller, purchased_on, product_name, brand, model_number, lot_code, upc, size_text, quantity, price_cents, confidence.
Missing from the required list: NONE. All 10 columns are present (plus extras).
SQL text match: PURCH uses only family_id, id, store, purchased_on, product_name, price_cents, upc, lot_code, model_number, source: all exist. Small risk: `store` can be NULL in the view (ZREG's old v_clawback_tx used COALESCE(store, seller)); clawback joins `lower(sp.store) = lower(p.store)`, so a receipt with only `seller` set never gets money-back cards. Sample data always sets store, so tests pass. Also factChecker uses quoteInt(claim.itemId) against view column id (integer serial): ok if Zetaris types it as int (open question 11, only a live --apply proves).
Not yet proven live: nothing here runs against real Zetaris.

## C. Tightness
- Owned files only: yes except bundle/scripts/seed.ts (4 lines): imports loadPurchaseItems instead of the deleted plaid.ts, inserts purchase_items rows, deletes them first. Necessary (plaid.ts deletion breaks seed's import) and small; W2-STATE also owns seed.ts so expect a trivial merge conflict. main has not changed seed.ts since the branch point. Judged acceptable.
- data/sample/purchase-items.json: made-up (note says so, extractor 'sample_fixture', brands/products public, UPC 842602101004 is a made-up value); no real names/addresses. OK. Ava has infant-medicine line, leo nothing.
- Removed tests: only Plaid mapper/fixture tests, DCFSA tests, 'family with no transactions', 'unique ids for identical Plaid lines', and the daycare-item-list test. All map to removed features. New tests are meaningful (codes, evidence, view-only SQL, unpriced line, fragment rejection, mapPurchaseReceipt validation).
- No hardcoded outputs found.
- Leftovers outside ownership (hand-offs): client/src/lib/howWeChecked.ts still labels/matches v_clawback_tx / v_recall_orders (new evidence SQL names v_purchase_items, so "how we checked" source labels/matching break for clawback and recall cards); scripts/zetaris/agents-live.ts prints claim.txId; orchestrator.ts still handles 'dcfsa_childcare' and says "Connect a card or upload Amazon orders" (clawbackNoData); server/ingest/amazonCsv.ts and its tests remain (harmless, not an agent source); shared/bundle.ts untouched though owned.

## Must-fix
1. evals/expected.json: drop dcfsa card, replace tx-NN id strings with ids that match `clawback-fsa-` / `clawback-price-` item cards (and cpsc-10560 stays); needed before eval.test.ts can go green after recording.
2. Mac: run zetaris:record for itemsSql/pairsSql/finishedFdaSql/fsaSql/priceSql (never hand-written) so sampleMode.test and eval pass.
3. client/src/lib/howWeChecked.ts: point the clawback/recall source matchers at v_purchase_items (otherwise the owner-view labels regress).

## Nice-to-have
- clawback.ts:~20-45 use COALESCE(p.store, p.seller) so seller-only receipts work.
- Wire recallMatch.ts into recall.ts and add "check the lot number on the can" for formula (W3-SAFETY), evidence line for every alert.
- Update orchestrator clawbackNoData copy and dcfsa branch (W4-ORCH/W2-STATE).

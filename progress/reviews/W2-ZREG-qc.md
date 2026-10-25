# W2-ZREG QC (branch worktree-agent-a111d3e1f05f820cd, commit 94539ba)
Verdict: PASS (no must-fixes).

## Tests
- Worktree `npm test` (no DB URL set): 493 passed, 8 skipped. `npx tsc --noEmit`: clean.
- With local DB: register.test.ts 15/15 passed, including the 2 live view checks (every view's SQL runs on real Postgres; latest-grade-per-offer picks the newer row; v_offer_audit counts once; universal_rule true for reject + citation + no regions + not expired).
- Side note: the whole suite with TEST_DATABASE_URL set to my DB makes the older W1-DB schema.test.ts fail ("role bundle does not exist"): that test uses its own DATABASE_URL default (user `bundle`), not W2-ZREG's problem.

## Local DB finding
- `npm run db:test` (scripts/db-test-setup.sh) is built for Linux: it uses `service postgresql start` and `sudo -u postgres`, role `bundle`/`bundle`, DB `bundle_test`. It will not work as-is on this Mac.
- Homebrew postgresql@16 was already installed but stopped. Started with: `brew services start postgresql@16` (no new software installed). Connects as OS user `lyndsay`, no password.
- Created DB manually: `psql -h 127.0.0.1 -d postgres -c "CREATE DATABASE bundle_test_w2zreg"`, then applied migrations/*.sql with `sed 's/--> statement-breakpoint//'` piped to psql.
- Run: `TEST_DATABASE_URL=postgres://lyndsay@127.0.0.1:5432/bundle_test_w2zreg NODE_ENV=test npx jest --maxWorkers=1 server/__tests__/register.test.ts`
- Postgres service left running and the DB left in place (local only; no Neon touched).

## A. Done check
- M4 saved-verdict query: savedVerdictsSql reads bundle_pg.v_offer_verdicts only, sorted/deduped ids (stable SQL text), no family columns. fetchSavedVerdicts returns status none/unavailable (never throws) so sample mode falls back to "no saved verdicts". OK.
- Views: v_recall_orders and v_clawback_tx read only purchase_items; old column names kept (clawback: id, family_id, date, merchant, amount_cents, category; recall: family_id, purchased_on, item_text, source, price_cents plus extra code columns). v_purchase_items safe columns only. v_family_profile / v_coach_feedback (issues only) added. OK.
- register.ts: never drops/alters (test asserts); dry run sends only SHOW; password redacted. record.ts refuses in SAMPLE_MODE and without the three Zetaris keys; read-only SELECTs; cache written only by the live client. `zetaris:record` script entry already in package.json. OK.
- canSkipAi: same fingerprint -> reuse; universal-rule reject -> reuse; else fresh. Sound.
- universal_rule definition (reject AND rule_citations <> '[]' AND regions_excluded = '[]' AND expired = false): matches plan section 1 ("rule that doesn't depend on the family"); excluding region- and date-dependent rejections is the conservative reading. Acceptable.

## B. Tightness
- Only owned files changed (5 files). No hardcoded outputs, secrets or real personal data (test rows are "Made-up Store"). v_offer_verdicts / v_offer_audit have no family fields (test asserts). SQL exact-text caveat for sample replay documented in savedVerdicts.ts and record.ts headers. Tests are meaningful (typo guard on columns, fake Zetaris, live Postgres).

## Nice-to-haves
1. canSkipAi / v_offer_verdicts do not look at `status`: a saved grade with status other than 'agreed' (e.g. disputed/pending) would be reused on same fingerprint or universal rule. W3-COURT should only write agreed rows, or canSkipAi should require status === 'agreed' (server/agents/savedVerdicts.ts, canSkipAi).
2. scripts/zetaris/register.ts runSteps: `split(password).join('***')` with an empty password would mangle the message (split('')); guard `password ? ... : msg`.
3. Zetaris dialect for ROW_NUMBER() OVER, CAST(jsonb AS varchar), and CASE is only provable by the live `--apply` (open question 11); already documented. Fallback if rejected: replace --replace list and simplify to a MAX(checked_at) join.
4. db-test-setup.sh is Linux-only; a Mac note (brew path above) would help the local session.

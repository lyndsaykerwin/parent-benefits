# W2-RESULTS QC (commit 28ca5d4) - PASS

Tests (in worktree bundle/): without DB 479 passed / 8 skipped (the 8 are seed.test.ts, gated on RUN_DB_TESTS + Neon, correct). With TEST_DATABASE_URL on local throwaway cluster: 479 passed / 8 skipped x3 runs; the live DrizzleStore test really ran (rows landed in run_results). tsc --noEmit clean. Note: two early full-suite runs with DB failed schema.test.ts (not an owned file) with 'role "bundle" does not exist'; after I created a role `bundle`, runs passed 3/3. schema.test.ts defaults/pool seem to want the `bundle` role; not caused by this chunk.

## A. Done check (M10)
- Restart: test builds a second router on the same store (empty in-memory run list) and GET /api/runs/:id returns the saved result. That proves persistence for MemoryStore only. DrizzleStore is tested separately at store level (save/replace/latest/missing) on live Postgres, not through the router. Together they cover M10; a router+DrizzleStore test would be stronger (nice-to-have).
- Sample replay: loops SEED_FAMILY_IDS with SAMPLE_MODE=true and no keys, restores env in finally, reads each saved result back through a fresh router. OK.
- Failed save: caught, logged, run still 200 and status done. OK.
- GET /api/runs/:id and /trace fall back to saved row (findRun); store read errors logged -> 404. OK.
- latest-run: only knownFamilies (seed + families run this process); unknown/guest ids 404 without store lookup. OK.

## B. Tightness
- Owner/parent split: restored and latest-run both go through runBody -> view() -> parentResult; test checks traceId, debate, sql, source quote, agent absent for parents; owner sees full. Trace is 403 without x-reviewer-token. parentBody/finePrintCourt untouched. Saved row holds full owner copy (by design); no income saved in family header.
- Restored trace dir = path.resolve('logs') matches bundleDeps default. OK.
- RunEventHub: max runs / events per run bounded and tested; throwing listener isolated (emit, tested); finish/late subscribe/afterSeq/copies tested. Not tested: listener throwing inside onEnd or in replay (code handles it).
- Owned files only (6 files). No hardcoded outputs, personal data or secrets.

## Must-fixes
None.

## Nice-to-haves
1. runResults.test.ts ~line 185+: live Postgres test silently `return`s (shows as passed) when no DB; consider it.skip-style visibility. It also leaves rows behind (no cleanup).
2. Add one router-level test using DrizzleStore for the restart case.
3. runEvents.ts: no test for throwing onEnd handler / throwing replay listener.
4. After a restart, latest-run for guest-created family ids 404s (knownFamilies is in memory); fine for seed families, note for W4-STREAM.

## Local DB commands
export LC_ALL=en_US.UTF-8 PATH=/opt/homebrew/opt/postgresql@16/bin:$PATH
D=<scratchpad>/pgqc; initdb -D $D -U qc -A trust; mkdir -p /tmp/pgqcsock
pg_ctl -D $D -o "-p 5441 -c listen_addresses=127.0.0.1 -k /tmp/pgqcsock" -l $D/log -w start
createdb -h 127.0.0.1 -p 5441 -U qc bundle_test_w2results_qc
for f in migrations/*.sql; do sed 's/--> statement-breakpoint//' $f | psql -q -h 127.0.0.1 -p 5441 -U qc bundle_test_w2results_qc -v ON_ERROR_STOP=1; done
psql ... -c "create role bundle superuser login password 'bundle'"
TEST_DATABASE_URL=postgres://bundle:bundle@127.0.0.1:5441/bundle_test_w2results_qc npm test
Stop: pg_ctl -D $D stop -m fast; rm -rf /tmp/pgqcsock   (LC_ALL is required, else "postmaster became multithreaded"; short socket dir required, path limit 103 bytes)

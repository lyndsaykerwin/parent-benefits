# Task 14 review: submission packaging

Spec: PASS (with 0 Critical, 2 Important, 3 Minor).

## Named risks
- Cached final cards in SAMPLE_MODE? NO. The cache (server/adapters/zetaris.ts) is keyed by sha256 of the SQL text and stores raw query results (headers, rows, ms). Agents, Fact-Checker and court still run on those rows; final cards are recomputed every run. A typed-in family misses the cache and hits the failure path (banner + never-empty feed), which proves nothing is replaying finished answers.
- Live NVIDIA claim? Not claimed as run. README/metadata say "optional"; limitations and section 8 state the scoreboard is offline-fallback (llmMode offline-fallback, scout fake-llm). Matches logs/scoreboard.json. NvidiaGenerator exists in llm.ts. Honest, but see I2.
- DQ rules in Zetaris? README section 11 says not set up. Honest. Not claimed elsewhere.
- Plaid connection? Section 11 says fixture only. Honest.
- Secrets: .env.example placeholders only; DATABASE_URL commented; .gitignore ignores .env*, keeps logs/sample. Tree clean on local main.

## Findings
Important
- I1. README section 7 row 1 says a failed Zetaris query is "retry once". Code: ZetarisClient has no retry; only orchestrator.retryTransient retries once, and only for "thrift|resultset" errors on one query (the items query). Other failures go straight to cache fallback or skip. Overstated failure handling in a judge-facing table. Fix: reword to "one pause-and-retry for a known transient Zetaris error on the purchases query; otherwise use a saved response if present; otherwise that agent is skipped...". (MAX_RETRIES governs Fact-Checker send-backs, not Zetaris; .env.example comment could say so.)
- I2. README header and section 13 list NVIDIA among "Sponsor technology" with no live run ever done. Caveat is only in "(optional)" and section 11. Fix: header should say "NVIDIA-hosted models (supported, not exercised in the saved results)". Same for metadata.json sponsor_tech.nvidia.

Minor
- M1. README section 9 says input_examples has 4 requests, brief asked for 3. Fine (superset); output_examples likewise 4. No action, just note.
- M2. Cache capture timestamps are file mtimes (range stated), disclosed in report but README/data say "captured" without noting they are file times. Optional wording.
- M3. logs/sample traces contain the SQL text with column name annual_income_cents (no values). "No income in logs" is true for values; consider "no income values".

## Checked and OK
Track named; pre-existing components (6af369a MIT, H-MEM Apache-2.0, Zetaris patterns, pre-Oct-22 research) credited; setup, sample request/response, sample mode honesty, failure table, data/licences, limitations, scoreboard numbers (6/6, 0, 100%, mem-1) match scoreboard.json; demo date 2026-10-23 documented; data/README labels saved pages as hand-written excerpts and cache as saved real responses over synthetic data with timestamps; metadata.json flags unknown schema and REPLACE-ME placeholders; LICENSE MIT; TRUST_PROXY=1 wired; start sets NODE_ENV=production; port 5050; rate limit 10 runs/10 min confirmed in bundleRoutes; withTrace on both clients wired in orchestrator (with a function check for test fakes); output_examples card counts leo 14, maya 17, ava 11, custom 9 (>=9). Not re-run: clean-clone test and suite (read-only review).

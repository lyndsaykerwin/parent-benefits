# Offline fix report

Root cause: server/bundleDeps.ts built the Zetaris client with `sampleMode: sample && missing.length > 0`, so offline replay only happened when a Zetaris key was missing. With real keys in .secrets/bundle.env.local, SAMPLE_MODE=true still went live and wrote the cache (commit 6867447 only guarded the client, not this wiring). The model generator was likewise built from MODEL_API_KEY regardless of SAMPLE_MODE.
loadEnv was NOT at fault: dotenv already treats an empty-string variable as set; now locked in by a test.

Fix (commit ec67a3e): `sampleMode: sample`; new `makeGenerator()` returns an always-unavailable generator in SAMPLE_MODE (used by makeRealRunDeps and createDefaultApiDeps).
Tests: server/__tests__/offlineGuarantee.test.ts (keys present + fake fetch that records calls: no Zetaris call, cache dir unchanged, model offline, live mode still live); env.test.ts empty-string case. Written first, 2 failed before the fix. npm run check and full npm test green (261 passed); secrets grep empty.
Real check: `SAMPLE_MODE=true PORT=5061 npm run dev`, POST /api/run?wait=true maya returned 16 cards, no banner; git status showed nothing under data/sample/zetaris-cache/; server stopped, data/hmem removed.
Docs: README (hosting checklist, sample-mode section) and demo/video-script.md (start command now `SAMPLE_MODE=true PORT=5050 npm run dev`, reset keeps `rm -rf data/hmem`).

## Fix round 1
- makeRealRunDeps / createDefaultApiDeps / makeGenerator take an explicit `{ live: true }`; the server never passes it, so SAMPLE_MODE stays offline there.
- scripts/regen-examples.ts --live passes live (header comment corrected); scripts/run-family.ts no longer forces SAMPLE_MODE, uses live: true and a new loadSampleFamily for family loading.
- scripts/eval.ts was never affected (builds its own client; --live is live, replay otherwise); now covered by a test.
- demo/video-script.md slow-feed row reworded (check the start line has SAMPLE_MODE=true, look for another cause).
- Tests added: live clients when SAMPLE_MODE is unset, with live: true, and eval --live. Nothing live was run. check and full test green (264 passed).

# Task 4 report: LLM adapter, trace logger, memory adapter

Status: DONE. Commit f48d9cf (local main, not pushed). `npm run check` clean; `npm test` 43/43 (6 suites).

## TDD
RED: first run of llm/trace/memory tests failed with "Cannot find module" (TS2307). GREEN after implementing. memory.test.ts then failed on a type error and on empty recall; fixed (see decisions).

## Files
server/adapters/llm.ts, server/adapters/memory.ts, server/agents/trace.ts, server/agents/types.ts (incl. CourtRuling), tests llm/trace/memory, vendor/hmem (+NOTICE crediting Meterless, Apache-2.0), zetaris.ts now imports the real TraceLogger type, .env.example note, openai dependency added, tsconfig target ES2022.

## Decisions
- H-MEM: vendored via degit, unmodified. It has zero runtime deps, so no npm install in vendor was needed. It imports fine under tsx, esbuild bundle and Jest (ts-jest) with no extra config. Needed one fix: root tsconfig had no `target` (defaulted to ES5), so tsc rejected the vendor's Set/Map iteration; set `target: ES2022`.
- Brief said `type:'procedural'` but H-MEM only allows personal|factual|preference|general. Used `preference` (learned from user feedback).
- Recall threshold: H-MEM default 0.35 returned nothing for short rules (its built-in hash embedder scores low). BundleMemory passes threshold 0.15 and requires one shared non-stop word with the query, so unrelated queries return []. Swap in a real embedder later and this can go back to default.
- createGenerator(): empty MODEL_API_KEY (or missing MODEL_REASONING/MODEL_FAST) returns a generator that throws ModelUnavailable; askJson falls back immediately (no wasted retry). Model ids are not guessed; "to confirm on build.nvidia.com".
- NvidiaGenerator takes an optional injected client (4th arg) for tests; any client failure becomes ModelUnavailable.
- askJson: 2 tries, strips code fences, validates; the retry prompt adds a "JSON only" reminder.
- Redaction: income (income/annualIncome/annual_income/annualIncomeCents + number, with $ and commas), password "..." / password: '...' / password=..., applied to input_summary and output_summary. Tracing never throws if the file write fails (in-memory lines kept).
- Zetaris trace status 'degraded' mapped to 'fallback' to fit the TraceLine union.
- exportLedger writes the H-MEM trust ledger as JSON lines.

## Concerns
- "income" followed by any number is redacted even in non-income contexts (over-masking, safe side).
- Real NVIDIA call path untested against the live API (no key); only the injected-client path is tested.
- Stale tsbuildinfo caused a false tsc failure once; deleting node_modules/typescript/tsbuildinfo fixes it.

## Fix round 1
Changes: password redaction now covers `{"password":"x"}`, single-quote variant, `password "x"`, `Password is abc123`, unquoted `password=x`; NvidiaGenerator OpenAI client gets `timeout` (SOURCE_TIMEOUT_SECONDS, default 20s, via generatorConfigFromEnv/createGenerator) and `maxRetries: 0`; runId sanitised to [A-Za-z0-9_-] in the trace filename; mkdirSync moved inside the try. New tests: 4 password cases, filename sanitising, timeout-from-env.
Command: `npx jest server/__tests__/trace server/__tests__/llm; npm run check; npm test`
Output: trace+llm 26/26 pass; tsc clean; full suite 49/49 pass. Commit: see git log (fix: mask JSON-style passwords...).

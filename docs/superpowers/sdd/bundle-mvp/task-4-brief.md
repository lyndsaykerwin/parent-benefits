### Task 4: LLM adapter, trace logger and memory adapter

**Files:**
- Create: `server/adapters/llm.ts`, `server/agents/trace.ts`, `server/adapters/memory.ts`, `server/agents/types.ts`; vendor `vendor/hmem/` via `npx degit meterless/meterless/engines/hmem/reference vendor/hmem`
- Test: `server/__tests__/llm.test.ts`, `trace.test.ts`, `memory.test.ts`

**Interfaces:**
- Produces:

```ts
// llm.ts
export interface Generator { generate(prompt: string, system?: string, model?: 'reasoning' | 'fast'): Promise<string> }
export class NvidiaGenerator implements Generator { constructor(apiKey: string, baseUrl: string, models: { reasoning: string; fast: string }) }
export class FakeGenerator implements Generator { constructor(responses: string[]) }
export async function askJson<T>(g: Generator, prompt: string, validate: (x: unknown) => x is T, fallback: T): Promise<{ value: T; usedFallback: boolean }>
// trace.ts
export interface TraceLine { timestamp: string; trace_id: string; agent_name: string; action: string; input_summary: string; output_summary: string; target_agent: string | null; confidence: number | null; retry_count: number; status: 'ok' | 'retry' | 'blocked' | 'fallback' | 'error' }
export class TraceLogger { constructor(runId: string, dir: string); log(line: Omit<TraceLine, 'timestamp' | 'trace_id'>): string /* returns trace_id */; lines(): TraceLine[] }
// memory.ts
export class BundleMemory {
  constructor(persistDir: string, trace?: TraceLogger)
  addRule(text: string, source: string, confidence: number, refs: string[]): string   // memory id
  recallRules(query: string, topN?: number): { id: string; text: string; confidence: number; score: number }[]
  feedback(memoryId: string, kind: 'helpful' | 'not_helpful' | 'wrong'): void
  exportLedger(toFile: string): void
}
// types.ts
export interface CourtRuling { verdict: 'approve' | 'reject'; citedRuleIds: string[]; reason: string }
export interface AgentContext { runId: string; family: Family; z: ZetarisClient; llm: Generator; memory: BundleMemory; trace: TraceLogger }
export interface Candidate extends FeedCard { agent: string; claim: Record<string, string | number>; evidenceSql: string; retryCount: number }
```

- [ ] Step 1: Write the tests:
  - `askJson` with a FakeGenerator `['not json', '{"ok":true}']` returns `{value:{ok:true}, usedFallback:false}`; with `['x','y']` it returns the fallback and `usedFallback:true` (exactly 2 calls)
  - `TraceLogger.log` writes a line to `logs/run-<id>.jsonl` containing every field from Global Constraints
  - a trace whose `input_summary` contains `annualIncome` is redacted to `[redacted]`
  - `BundleMemory.addRule('free + >$5 shipping is not free','feedback:3',0.7,['fb1'])`, then `recallRules('free shipping offer')[0].text` matches; `feedback(id,'helpful')` raises confidence by `FEEDBACK_DELTAS.helpful` (import it from the vendored `types.ts`; verify the value before asserting)
- [ ] Step 2: Run the tests. Expected: FAIL.
- [ ] Step 3: Implement.
  - `NvidiaGenerator` uses the `openai` SDK with `baseURL`. Model ids come from `MODEL_REASONING`/`MODEL_FAST`.
  - `BundleMemory` wraps `new HMEM({persistDir, actor:'bundle'})`, using `add({content, source, confidence, type:'procedural', layer:'long_term', provenance:{origin:'user_correction', learnedAt: Date.now(), label: source, refs}})` and `query(q,{topN})`.
- [ ] Step 4: Run the tests. Expected: PASS.
- [ ] Step 5: Commit `feat: llm adapter with json fallback, trace logger with redaction, H-MEM memory adapter`.


---
**Binding context (read too):** overrides.md, global-constraints.md, and the "Rulings" section of progress.md, all in this folder. Where they conflict with the text above, they win. Key rulings: guest only (no Firebase; "Reviewer mode" token instead of admin); the Receipt is split into `moneyBackCents` + `likelyBenefitsCents`; the court caps at 5 offers; reuse the existing Zetaris objects `bundle_pg` and `bundle_live.cpsc_recalls`; never drop the Neon table `spike0_amazon_orders`. Repo: /Users/lyndsay/Documents/hackathon/bundle (local `main`, never push).

**Task 4 specifics from the controller:**
- Vendor H-MEM with `npx --yes degit meterless/meterless/engines/hmem/reference vendor/hmem`, then `cd vendor/hmem && npm install --no-audit --no-fund` (Apache-2.0; credit it in vendor/hmem/README or NOTICE). The public surface lives in `vendor/hmem/src/index.ts`: `new HMEM({persistDir, actor})`, `add(input: AddInput)`, `query(q, {topN, threshold})` → `{memories, context, trace}`, `feedback(id, kind)`. `AddInput` = `{content, type?, layer?, tags?, confidence?, source, provenance?: {origin, learnedAt, label, refs?}, supersedes?, derivedFrom?}`. `FEEDBACK_DELTAS` in src/types.ts (helpful +0.05, not_helpful −0.03, wrong −0.2); import the constant instead of hard-coding it. H-MEM is TypeScript ESM (`.ts` imports). Make it importable from the server (tsx/esbuild) and from Jest; if Jest ESM handling of vendor .ts is a problem, a thin re-export plus transform config is fine. Document what you did.
- **There's no NVIDIA key yet.** `NvidiaGenerator` must be testable with an injected OpenAI-compatible client (fake), and the app must still run with `MODEL_API_KEY` empty (a factory returns a generator whose calls throw `ModelUnavailable`, so `askJson` falls back). The model id defaults come from env `MODEL_REASONING` / `MODEL_FAST`, with placeholders in .env.example. Do not guess model ids as hard truths; note "to confirm on build.nvidia.com".
- Trace redaction: any `input_summary`/`output_summary` containing `annualIncome`, `annual_income` or `income` followed by a number gets that value replaced with `[redacted]`. Test it.
- The trace dir defaults to `logs/` in the repo root; tests use a temp dir.

- Also from the Task 3 review: TraceLogger redaction must mask `password "..."` / `password=...` patterns, in addition to income. Test it. `server/adapters/zetaris.ts` currently defines a minimal local trace interface; switch it to import the real `TraceLogger` type from server/agents/trace.ts.

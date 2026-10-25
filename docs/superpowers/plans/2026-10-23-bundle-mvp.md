# Bundle "First 100 Days" MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone-first web app where a new-parent family gets a never-empty, verified feed of clawback, recall, discount and benefit cards. A multi-agent system produces the feed over Zetaris-federated data, and the system learns from feedback via Meterless H-MEM.

**Architecture:** Colin Matthews' Express + React (Vite) + Drizzle template, at commit `a9542c2` (the last Firebase Auth version). Deterministic SQL and code compute candidates, dollar amounts and deadlines. LLM agents (NVIDIA Nemotron via an OpenAI-compatible API) explain, debate (Fine Print Court) and validate. A plain-code orchestrator runs the agents, enforces the never-empty feed and writes JSONL traces. All personalised reads go through Zetaris: a Neon Postgres datasource joined with CPSC/openFDA REST tables, with a view per agent.

**Tech Stack:**
- TypeScript, Node ≥24, Express 4, React 18, Vite, Tailwind/shadcn (from the template)
- Drizzle ORM with `@neondatabase/serverless`, Firebase Auth (client SDK + `firebase-admin`)
- `openai` SDK pointed at `https://integrate.api.nvidia.com/v1`
- Zetaris REST (UI proxy `POST /api/proxy/sql-editor/sqls/run-query`)
- Meterless H-MEM reference (vendored, Apache-2.0)
- Jest (from the template)

**Spec:** [bundle-plan-executive-summary.md](../../../bundle-plan-executive-summary.md). Background: [research-book/bundle-class-book.md](../../../research-book/bundle-class-book.md), [hackathon-checklist.md](../../../hackathon-checklist.md).

## Decisions that override tasks below (Oct 23)

Read the "Decisions locked Oct 23" section of the spec first. Where a task conflicts with it, the spec wins: guest only (skip Firebase; use the template's current HEAD and strip Replit auth); no live Plaid routes; Amazon upload is optional; the court caps at 5 offers; the Receipt is split into `moneyBackCents` and `likelyBenefitsCents`; a mini-Scout reads 3 pages; real-AI learning demo with a tricky trap offer. Also: Plan B must keep the purchases × recalls join inside Zetaris; CPSC falls back to a saved flattened copy; batch and cache queries per run and stream progress (first card under 30s); always-on hosting; ask what `metadata.json` must contain; NVIDIA spending alert. Video and slides are recorded Mon Oct 26.

## Spike 0 result (Oct 23): GO

Zetaris joined Neon (`bundle_pg`) × live CPSC (`bundle_live.cpsc_recalls`) in one query, in about 2s warm and 6s cold; full notes are in `docs/zetaris-notes.md`. Already created: datasource `bundle_pg` (plain `sslmode=require` works) and REST table `bundle_live.cpsc_recalls` (739 rows). The objects in Task 3 Step 5 that already exist should be reused, not recreated.
- CPSC product names are nested: use `LATERAL VIEW explode(Products) AS p` and `p.Name` **inside a subquery** (putting LATERAL VIEW directly in a JOIN gives a misleading `mismatched input` error).
- Real purchase titles need fuzzier recall matching than `LIKE` (brand + model tokens, with an LLM confirm step in the Recall Checker).
- Plan B is not needed.

## Global Constraints

- **Repo location:** `/Users/lyndsay/Documents/hackathon/bundle/` (its own git repo).
  - Secrets are read from `/Users/lyndsay/Documents/hackathon/.secrets/bundle.env.local` plus Zetaris values copied from `zetaris-getting-started/.env.local`.
  - Never commit secrets. `.env.example` holds placeholders only.
- **Fake data only.** No real personal data, ever. Income never appears in traces or logs.
- **Zetaris SQL:** one statement per call, no trailing semicolon, qualified `source.table` names. Use `--dry-run` / show-SQL before any CREATE. Zetaris is read-only: all writes go to Neon via Drizzle.
- **Money and dates:**
  - Dollar amounts are computed deterministically (SQL/code), never by the LLM.
  - Amounts are stored as integer cents and displayed as USD.
  - Deadlines are ISO dates computed from the family's `birthDate` (or `dueDate` if unborn).
- **Fact-Checker:** max **2** send-back retries per candidate. After that the card is dropped and the drop is traced.
- **Never-empty feed** (spec §1):
  - ≥2 `benefit` cards
  - exactly 1 `recall` card
  - ≥3 `discount` cards
  - `clawback` cards only when real, otherwise exactly 1 `clawback` info card with the spec's copy
  - 2 `coming_soon` tiles
- **Clawback empty-state copy (exact):**
  - No data connected: `No money to claw back yet. Connect a card or upload Amazon orders.`
  - Data connected, none found: `Nothing to claw back: you're doing great.`
- **Recall copy (exact):**
  - All clear: `We checked {n} items: all clear.`
  - No purchases: `Connect your data to safety-check your items.`
- **Trace line fields (exact):** `timestamp, trace_id, agent_name, action, input_summary, output_summary, target_agent, confidence, retry_count, status`. Written one JSON object per line to `logs/run-<runId>.jsonl`.
- **Env vars:** `DATABASE_URL, GOOGLE_APPLICATION_CREDENTIALS, VITE_FIREBASE_*, ZETARIS_BASE_URL, ZETARIS_ORG_ID, ZETARIS_API_KEY, MODEL_API_KEY, MODEL_BASE_URL, MODEL_REASONING, MODEL_FAST, SAMPLE_MODE, SOURCE_TIMEOUT_SECONDS, MAX_RETRIES, ADMIN_EMAILS`.
  - `MODEL_BASE_URL` defaults to `https://integrate.api.nvidia.com/v1`.
  - `MAX_RETRIES` defaults to `2`, `SOURCE_TIMEOUT_SECONDS` to `20`.
- **SAMPLE_MODE=true:** loads sample *inputs* (seed families, fixture transactions, cached Zetaris query results for the seed families), never pre-written cards.
- **Copy rules:** say "likely eligible", not "eligible". Bundle "finds and prepares"; never "advises".
- **Mobile-first UI:** design at 375px width first.
- **Dates:** seed data uses fixed ISO dates. `TODAY` env var (ISO) overrides the current date; SAMPLE_MODE pins `TODAY=2026-10-23` so cached Zetaris results and tests stay valid.
- **Table naming:** every Drizzle `pgTable` uses an explicit snake_case table name and snake_case column names (e.g. `pgTable('price_observations', { minAgeDays: integer('min_age_days') })`), because raw Zetaris SQL uses snake_case.
- **Fail closed:** when the LLM is unavailable, Fine Print Court rejects (never auto-approves); explanations fall back to deterministic text.
- **Every Zetaris and memory call is traced:** `ZetarisClient` and `BundleMemory` take an optional `TraceLogger`.
- **Deadline:** submissions close Tue Oct 27, 2026, 23:45 UTC (Oct 27 is a Tuesday). Target: submit by 5pm Boston that day.
- **Guest abuse limits:** unauthenticated `POST /api/run` may only use seed family ids, or an inline family that is not persisted. Rate limit is 10 runs per IP per 10 minutes (`express-rate-limit`, already in the template).

## Review Focus

1. **Family with no transactions and no orders (guest or new user).** The feed still meets every never-empty minimum. Pinned in Task 9.
2. **Zetaris slow or down.** After `SOURCE_TIMEOUT_SECONDS`, fall back to the cached results for that family (in SAMPLE_MODE) or show a `Some sources didn't respond: showing what we could check.` banner. Never a blank page or a 500. Pinned in Tasks 3 and 9.
3. **LLM returns malformed JSON or is unreachable.** Retry once, then use the deterministic fallback text for that card. The run completes. Pinned in Task 4.
4. **Birth date over 100 days ago, or due date in the future.** Deadlines that have already passed are excluded; future deadlines are computed from the due date and labelled "after birth". Pinned in Task 8.
5. **Refunds, duplicates and non-MA ZIPs:**
   - negative or duplicate transactions are ignored by clawback
   - non-MA ZIPs get federal cards only
   - an unknown ZIP gets a 400 with `Enter a valid US ZIP code`

   Pinned in Tasks 6, 8 and 10.

---

## File Structure (in `bundle/`)

```
shared/schema.ts            # MODIFY: add Bundle tables + users.role
shared/bundle.ts            # CREATE: FeedCard, BundleReceipt, BundleResult, Family types
server/adapters/zetaris.ts  # CREATE: ZetarisClient (runQuery, timeout, cache)
server/adapters/llm.ts      # CREATE: Generator interface, NvidiaGenerator, FakeGenerator, askJson
server/adapters/memory.ts   # CREATE: BundleMemory over vendored H-MEM
server/agents/trace.ts      # CREATE: TraceLogger
server/agents/types.ts      # CREATE: AgentContext, Candidate, Verdict
server/agents/clawback.ts   # CREATE
server/agents/recall.ts     # CREATE
server/agents/finePrintCourt.ts  # CREATE
server/agents/benefits.ts   # CREATE
server/agents/factChecker.ts     # CREATE
server/agents/coach.ts      # CREATE
server/agents/orchestrator.ts    # CREATE: runBundle + assembleFeed
server/routes/bundleRoutes.ts    # CREATE
server/ingest/plaid.ts      # CREATE
server/ingest/amazonCsv.ts  # CREATE
scripts/seed.ts             # CREATE: 3 fake families + curated tables
scripts/zetaris/register.ts # CREATE: datasource, REST tables, views, DQ (dry-run default)
scripts/scout.ts            # CREATE: saved pages -> rules/offers rows
scripts/eval.ts             # CREATE: scoreboard
data/sample/                # fixtures: plaid-transactions.json, amazon-orders.csv, saved-pages/*.html
client/src/pages/Onboarding.tsx, Feed.tsx, CardDetail.tsx, Smarter.tsx   # CREATE
vendor/hmem/                # vendored Meterless H-MEM reference
```

---

### Task 1: Scaffold the repo from the template's Firebase-era commit

**Files:**
- Create: `bundle/` from `colinmatthews/VibeCodeYourNextSideProject-Template` at commit `a9542c2`
- Delete: `server/lib/firebaseStorage.ts`, `server/storage/FileStorage.ts`, the files routes/pages/components, `server/routes/chatKitRoutes.ts`, `client/src/pages/ai-chat.tsx`, the items/todo routes/pages and their tests
- Modify: `server/routes/index.ts`, `client/src/App.tsx`, `package.json` (name `bundle`), `.env.example`, `.gitignore` (add `.env*`, `logs/*.jsonl`, `vendor/hmem/node_modules`, `data/hmem/`)
- Create: `server/env.ts`, which loads `../.secrets/bundle.env.local`, then `.env.local`

**Interfaces:**
- Produces: `loadEnv(): void` (called first in `server/index.ts`); a running dev server on `PORT=5000`; `npm test` green.

- [ ] Step 1: `git clone` the template, `git checkout a9542c2`, copy the tree (without `.git`) to `bundle/`, `git init`, initial commit `chore: import template a9542c2 (MIT, pre-existing component)`.
- [ ] Step 2: Remove storage, ChatKit and items code; fix imports until `npm run check` (tsc) passes.
- [ ] Step 3: Run `npm test`. Expected: the remaining auth/user/payment tests PASS. Delete only tests whose feature was deleted.
- [ ] Step 4: Add `server/env.ts`. Test `server/__tests__/env.test.ts`: `loadEnv()` with a temp file containing `FOO=bar` sets `process.env.FOO === 'bar'` and does not overwrite an existing value.
- [ ] Step 5: `npm run dev`, then `curl -s localhost:5000/api/health` (add a route returning `{ok:true}` if absent). Expected: `{"ok":true}`.
- [ ] Step 6: Commit `chore: strip storage/chat/items, add env loader`.

### Task 2: Schema, shared types and seed data

**Files:**
- Modify: `shared/schema.ts`
  - add `role` to `users`: text enum `['parent','admin']`, default `'parent'`
  - add tables `families`, `transactions`, `amazonOrders`, `fsaEligibleCategories`, `storePolicies`, `benefitRules`, `offers`, `feedback`, `caseLawProposals`, `priceObservations`
- Create: `shared/bundle.ts`, `scripts/seed.ts`, `data/sample/plaid-transactions.json`, `data/sample/amazon-orders.csv`
- Test: `server/__tests__/seed.test.ts`

**Interfaces:**
- Produces, in `shared/bundle.ts`:

```ts
export type CardKind = 'clawback' | 'recall' | 'discount' | 'benefit' | 'coming_soon';
export type Verdict = 'verified' | 'likely' | 'all_clear' | 'info' | 'blocked';
export interface Source { label: string; url: string }
export interface FeedCard {
  id: string; kind: CardKind; title: string; body: string;
  amountCents: number | null; deadline: string | null; // ISO date
  verdict: Verdict; sources: Source[]; traceId: string;
}
export interface BundleReceipt { totalCents: number; deadlineCount: number; nextDeadline: string | null; itemsChecked: number }
export interface BundleResult { familyId: string; runId: string; receipt: BundleReceipt; cards: FeedCard[]; banner: string | null }
export interface Family {
  id: string; userId: string | null; isGuest: boolean; name: string;
  birthDate: string | null; dueDate: string | null; zip: string; state: string;
  employer: string; householdSize: number; annualIncomeCents: number | null;
  dcfsaOffered: boolean; dataConnected: boolean;
}
```

- Table columns (key ones):
  - `transactions(id, familyId, date, merchant, amountCents, category, source 'plaid'|'fixture')`
  - `amazonOrders(id, familyId, orderDate, title, asin, upc, priceCents)`
  - `fsaEligibleCategories(id, keyword, category, account 'FSA'|'HSA'|'DCFSA', sourceUrl)`
  - `storePolicies(id, store, adjustmentWindowDays, sourceUrl)`
  - `benefitRules(id, code, title, scope 'federal'|'MA', amountCents, windowStartDaysFromBirth, windowEndDaysFromBirth, condition, sourceUrl)`
  - `offers(id, title, store, minAgeDays, maxAgeDays, triggerKeyword, valueCents, finePrint, sourceUrl)`
  - `feedback(id, familyId, cardId, kind 'got_it'|'issue', note, createdAt)`
  - `caseLawProposals(id, text, sourceFeedbackIds, confidence, status 'proposed'|'approved'|'rejected', memoryId)`
  - `priceObservations(id, store, keyword, priceCents, observedAt, sourceUrl)`: sample price checks that power the price-adjustment clawback
- `seed()` inserts 3 families:
  - `maya` (MA, born 20 days ago, Plaid fixture + Amazon CSV, DCFSA offered)
  - `leo` (MA, due in 45 days, no data)
  - `ava` (Ohio ZIP 43215, born 60 days ago, Plaid fixture only)
- Curated rows, each with a `sourceUrl`:
  - ≥15 offers, including ≥4 general offers (`triggerKeyword=''`, `minAgeDays=-280`, `maxAgeDays=365`) so unborn families can reach 3 discounts, and the shipping-trap offer
  - a `zip_states` table (zip3 prefix → state) covering MA, OH and a default
  - ≥7 benefit rules: `TRUMP_ACCOUNT` $1,000 federal (birth 2025–2028); `FEDERAL_CHILD_TAX_CREDIT` $2,200 federal (no deadline window; guarantees a second benefit card for non-MA families past day 30); `INSURANCE_ADD_BABY` window 0–30; `DCFSA_LIFE_EVENT` 0–30; `MA_CHILD_TAX_CREDIT` $440 (MA); `MA_PFML` (MA); `WIC_SCREEN` (federal, condition income ≤185% FPL)
  - ≥10 FSA categories, ≥3 store policies

- [ ] Step 1: Write the test: after `seed()` against a test schema, `families` has ids `maya, leo, ava`; `benefitRules` includes `FEDERAL_CHILD_TAX_CREDIT`; every `benefitRules`/`offers`/`fsaEligibleCategories` row has a non-empty `sourceUrl`; `ava.state === 'OH'`.
- [ ] Step 2: Run `npm test -- seed`. Expected: FAIL.
- [ ] Step 3: Add the tables, types, fixtures and `seed(): Promise<void>`. The fixtures must include traps:
  - one FSA-eligible purchase (`Target, "Frida baby thermometer", 2899`)
  - one price-drop item within window
  - one refund (negative amount)
  - one duplicate transaction
  - one Amazon item whose title matches a real CPSC recalled product
  - daycare payments (`Bright Horizons`, monthly)
- [ ] Step 4: apply reviewed SQL by hand, only with Lyndsay's OK — never run `db:push` (Neon), then `npx tsx scripts/seed.ts`, then `npm test -- seed`. Expected: PASS.
- [ ] Step 5: Commit `feat: bundle schema, shared types, seed families and fixtures`.

### Task 3: Zetaris adapter and source registration

**Files:**
- Create: `server/adapters/zetaris.ts`, `scripts/zetaris/register.ts`, `data/sample/zetaris-cache/` (cached JSON results keyed by SQL hash)
- Test: `server/__tests__/zetaris.test.ts`

**Interfaces:**
- Produces:

```ts
export interface QueryResult { headers: string[]; rows: Record<string, string | number | null>[]; ms: number } // numeric-looking values coerced to number, '' and 'null' to null
export class ZetarisClient {
  constructor(opts: { baseUrl: string; orgId: string; apiKey: string; timeoutMs: number; sampleMode: boolean; cacheDir: string; fetchFn?: typeof fetch; trace?: TraceLogger })
  runQuery(sql: string): Promise<QueryResult>   // throws ZetarisUnavailable on timeout/5xx when no cache
}
export class ZetarisUnavailable extends Error {}
```

- Request: `POST {baseUrl}/api/proxy/sql-editor/sqls/run-query` with headers `Authorization: Bearer {apiKey}`, `X-Org-ID`, `X-Request-ID` (uuid), body `{sql, limit: 1000}`. The response shape `{headers, data: string[][]}` is mapped to `rows`.
- In sampleMode, or when a live call fails, read `cacheDir/<sha256(sql)>.json` if present. Live successes write the cache.

- [ ] Step 1: Write the tests with a fake `fetchFn`:
  - (a) maps `{headers:['a','b'],data:[['1','x']]}` to `rows[0].a === 1` (number) and `rows[0].b === 'x'`
  - (b) a timeout with no cache throws `ZetarisUnavailable`
  - (c) a timeout with a cache file returns the cached rows
  - (d) a SQL string ending in `;` is rejected with `Error('one statement, no trailing semicolon')`
- [ ] Step 2: Run `npm test -- zetaris`. Expected: FAIL.
- [ ] Step 3: Implement `ZetarisClient`.
- [ ] Step 4: Run `npm test -- zetaris`. Expected: PASS.
- [ ] Step 5: Write `scripts/zetaris/register.ts` with `--apply` (default prints SQL only). The statements, one per call:
  - `CREATE DATASOURCE bundle_pg DESCRIBE BY "Bundle Neon" OPTIONS (jdbcdriver "org.postgresql.Driver", jdbcurl "jdbc:postgresql://<neon-host>:5432/neondb?sslmode=require", username "<user>", password "<pw>")`, with values parsed from `DATABASE_URL`
  - `REGISTER DATASOURCE TABLE '<t>' FROM bundle_pg` for each Bundle table
  - `CREATE LIGHTNING DATABASE bundle_live DESCRIBE BY "Live recall feeds"`
  - `CREATE LIGHTNING REST TABLE cpsc_recalls FROM bundle_live REQUEST (endpoint "https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=2024-01-01", method "GET")`
  - `CREATE LIGHTNING REST TABLE fda_food_recalls FROM bundle_live REQUEST (endpoint "https://api.fda.gov/food/enforcement.json?search=product_description:%22infant%20formula%22&limit=100", method "GET")`
  - Optional, if its endpoint is confirmed: an NHTSA car-seat recall REST table in `bundle_live`
  - Per-agent views: `CREATE DATASOURCE VIEW v_judge_offers FROM bundle_pg AS SELECT id, title, store, min_age_days, max_age_days, value_cents, fine_print, source_url FROM offers` (no family columns), and `v_planner_family` (includes income), `v_clawback_tx` (transactions + family id, no income), `v_recall_orders` (amazon_orders + transactions merchant/description, no income), `v_scout_rules` (benefit_rules + offers, no family data)
- [ ] Step 6: **Go/no-go by Fri Oct 23 noon Boston.** Run `npx tsx scripts/zetaris/register.ts` (dry run), review, then run with `--apply`. Also check that `SELECT * FROM bundle_live.cpsc_recalls LIMIT 5` returns flattened product names (CPSC nests `Products[].Name`). If not, register a saved, flattened CSV copy as a file table and record that in `docs/zetaris-notes.md`. **Plan B, if JDBC to Neon fails:** export the curated tables and fixtures to CSV and register them as Zetaris file tables; private family tables stay in Neon and are joined in the app layer, with the limitation documented. Verify `SHOW DATASOURCES` lists `bundle_pg` and `SELECT count(*) AS n FROM bundle_pg.families` returns `3`. If the JDBC registration fails, record the error in `docs/zetaris-notes.md` and stop for review. This is the plan's biggest unknown.
- [ ] Step 7: Commit `feat: zetaris client with timeout+cache; source registration script`.

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

### Task 5: Fact-Checker

**Files:** Create `server/agents/factChecker.ts`. Test `server/__tests__/factChecker.test.ts`.

**Interfaces:**
- Consumes: `AgentContext`, `Candidate`
- Produces: `verify(c: Candidate, ctx: AgentContext): Promise<{ ok: boolean; reason: string | null; corrected: Partial<Candidate> | null }>`. It re-runs an *independent* Zetaris query for `c.claim` (amount, recall id or deadline) and compares. It fails when the amount differs by more than 1 cent, the deadline differs, or `sources` is empty.

- [ ] Step 1: Write the tests with a stub `z.runQuery`:
  - a candidate claiming `amountCents: 2899` with the re-query returning `2899` gives `ok:true`
  - a re-query returning `2499` gives `ok:false` with reason containing `amount mismatch` and `corrected.amountCents === 2499`
  - `sources: []` gives `ok:false` with reason `no source`
- [ ] Step 2: Run. Expected: FAIL. Step 3: implement. Step 4: run. Expected: PASS. Step 5: commit `feat: fact-checker agent`.

### Task 6: Clawback Hunter and Recall Checker

**Files:** Create `server/agents/clawback.ts`, `server/agents/recall.ts`. Test `server/__tests__/clawback.test.ts`, `recall.test.ts`.

**Interfaces:**
- Produces:
  - Every candidate-producing agent (Tasks 6–8) also exports `revise(c: Candidate, reason: string, ctx): Promise<Candidate | null>`. It re-derives the candidate from source data with the reason in scope; `null` means give up.
  - `findClawbacks(ctx): Promise<Candidate[]>`, with three kinds in `claim.type`: `'fsa_reimbursement' | 'price_adjustment' | 'dcfsa_childcare'`
  - `checkRecalls(ctx): Promise<{ candidates: Candidate[]; itemsChecked: number }>`
  - Both build SQL against `bundle_pg.v_clawback_tx`, `bundle_pg.v_recall_orders`, `bundle_pg.fsa_eligible_categories`, `bundle_pg.store_policies`, `bundle_pg.price_observations`, `bundle_pg.amazon_orders`, `bundle_live.cpsc_recalls`, `bundle_live.fda_food_recalls`
  - The LLM writes only `body` (an explanation, via `askJson`, with deterministic fallback text)

- [ ] Step 1: Write the tests (stub Zetaris rows modelled on the fixtures):
  - maya gets an `fsa_reimbursement` of `2899` and a `dcfsa_childcare` candidate
  - the refund and the duplicate do not produce candidates
  - a family with no transactions gets `[]`
  - `checkRecalls` for maya returns 1 recall candidate and `itemsChecked` equal to her Amazon row count
  - for leo it returns `{candidates:[], itemsChecked:0}`
- [ ] Step 2: Run. Expected: FAIL. Step 3: implement (dedupe on `merchant+date+amountCents`; skip `amountCents <= 0`; title match via `lower(title) LIKE '%' || lower(product_name) || '%'` against CPSC). Step 4: run. Expected: PASS. Step 5: commit `feat: clawback hunter and recall checker`.

### Task 7: Fine Print Court (discounts)

**Files:** Create `server/agents/finePrintCourt.ts`. Test `server/__tests__/finePrintCourt.test.ts`.

**Interfaces:**
- Produces: `judgeOffers(ctx, input: { ageDays: number; purchaseKeywords: string[]; includeGeneral: boolean }): Promise<Candidate[]>`. The orchestrator computes `ageDays` (negative if unborn) and `purchaseKeywords` from the clawback/recall views. With `includeGeneral`, offers with `triggerKeyword=''` are judged too, so feed fillers have always passed the court.
  - It selects offers matched by baby age (`minAgeDays ≤ ageDays ≤ maxAgeDays`) and purchase `triggerKeyword` from `bundle_pg.v_judge_offers`.
  - For each offer: Deal Hunter argues for (fast model), Fine Print Lawyer argues against (fast model), Judge rules (reasoning model). The Judge's prompt includes `memory.recallRules(offer.finePrint)` as cited case law.
  - The ruling is a `CourtRuling`. If the LLM fails, the ruling is `{verdict:'reject', citedRuleIds:[], reason:'court unavailable'}`. Rejected offers are traced with `status:'blocked'` and excluded.

- [ ] Step 1: Write the tests (FakeGenerator scripted):
  - an offer whose `finePrint` contains `$40 shipping subscription` is rejected when the Judge responds `{"verdict":"reject",...}`
  - with memory holding the rule `free + >$5 shipping is not free`, the Judge prompt (captured by the fake) contains that rule text
  - each offer produces exactly 3 LLM calls and 3 trace lines (`deal_hunter`, `fine_print_lawyer`, `judge`)
- [ ] Step 2: Run. Expected: FAIL. Step 3: implement. Step 4: run. Expected: PASS. Step 5: commit `feat: fine print court`.

### Task 8: Benefits Planner

**Files:** Create `server/agents/benefits.ts`. Test `server/__tests__/benefits.test.ts`.

**Interfaces:**
- Produces: `planBenefits(ctx, today: string): Promise<Candidate[]>`.
  - It reads `bundle_pg.benefit_rules` and `bundle_pg.v_planner_family`.
  - It computes `deadline = anchor + windowEndDaysFromBirth`, where `anchor` is `birthDate`, or `dueDate` for unborn babies (titles suffixed ` (after birth)`).
  - It excludes rules whose deadline is before `today` and `MA` rules when `state !== 'MA'`.
  - `WIC_SCREEN` applies only when `annualIncomeCents ≤ 185% FPL` for `householdSize`, using 2026 HHS guidelines (stored as a rule row, not hard-coded).

- [ ] Step 1: Write the tests (`today = '2026-10-23'`):
  - maya (born 2026-10-03) gets `INSURANCE_ADD_BABY` with deadline `2026-11-02`, `TRUMP_ACCOUNT` at `100000` cents, and `MA_CHILD_TAX_CREDIT` at `44000`
  - ava (OH) has no MA cards
  - leo (due 2026-12-07) gets `INSURANCE_ADD_BABY` with deadline `2027-01-06`, and its title contains `(after birth)`
  - a family born 2026-06-01 has no `INSURANCE_ADD_BABY`
  - ava (OH, born 60 days ago) still gets ≥2 benefit candidates (`TRUMP_ACCOUNT`, `FEDERAL_CHILD_TAX_CREDIT`)
- [ ] Step 2: Run. Expected: FAIL. Step 3: implement. Step 4: run. Expected: PASS. Step 5: commit `feat: benefits planner`.

### Task 9: Orchestrator and never-empty feed

**Files:** Create `server/agents/orchestrator.ts`. Test `server/__tests__/orchestrator.test.ts`.

**Interfaces:**
- Consumes: Tasks 4–8
- Produces:
  - `runBundle(familyId: string, deps: { z: ZetarisClient; llm: Generator; memory: BundleMemory; loadFamily: (id: string) => Promise<Family>; logsDir: string; today: string }): Promise<BundleResult>`
  - `assembleFeed(verified: Candidate[], family: Family, itemsChecked: number, fillers: { approvedGeneralOffers: Candidate[]; federalBenefits: Candidate[] }): { cards: FeedCard[]; receipt: BundleReceipt }`
  - `loadFamily` reads Neon via Drizzle; in SAMPLE_MODE it reads `data/sample/families.json`
- Flow:
  1. Load the family.
  2. Run clawback, recall, court and benefits concurrently. Each is wrapped so `ZetarisUnavailable` sets `banner = "Some sources didn't respond: showing what we could check."`
  3. Fact-check each candidate. On failure, call the owning agent's `revise(c, reason, ctx)` (if `corrected` is present it is passed in the reason) and re-verify. Each attempt is a retry. Max `MAX_RETRIES`.
  4. `assembleFeed`.
  5. Export the H-MEM ledger to `logs/`.
- `assembleFeed` enforces the Global Constraints minimums, filling from:
  - general benefit rules (federal)
  - court-approved general offers (`fillers.approvedGeneralOffers`; never unvetted)
  - the clawback info copy
  - the recall all-clear / no-purchases copy
  - two fixed coming-soon tiles: `Pre-filled applications` and `We'll watch for price drops`
- The receipt sums `amountCents` of `clawback` and `benefit` cards with verdict `verified|likely`.

- [ ] Step 1: Write the tests:
  - `assembleFeed([], leoFamily, 0, fillers)` gives ≥2 benefit, 1 recall with body `Connect your data to safety-check your items.`, ≥3 discount, 1 clawback with body `No money to claw back yet. Connect a card or upload Amazon orders.`, 2 coming_soon
  - a family with `dataConnected:true` and no clawbacks gets `Nothing to claw back: you're doing great.`
  - all-clear with `itemsChecked:23` gives `We checked 23 items: all clear.`
  - `runBundle` with a stub Zetaris that throws `ZetarisUnavailable` for recalls still returns a result with `banner` set and the minimums met
  - a filler offer the court rejected never appears in the feed
  - a candidate failing fact-check 3 times is dropped after 2 retries, with a trace line `status:'blocked'`, `retry_count:2`
- [ ] Step 2: Run. Expected: FAIL. Step 3: implement. Step 4: run. Expected: PASS. Step 5: commit `feat: orchestrator with fact-check loop and never-empty feed`.

### Task 10: API routes, guest mode, roles and Coach

**Files:** Create `server/routes/bundleRoutes.ts`, `server/agents/coach.ts`. Modify `server/routes/index.ts`, `server/middleware/authHelpers.ts` (add `requireAdmin`). Test `server/__tests__/bundleRoutes.test.ts`, `coach.test.ts`.

**Interfaces:**
- Produces, over HTTP:
  - `POST /api/run` with body `{familyId}`, or `{zip, birthDate|dueDate, employer}` to create a family (validates ZIP `/^\d{5}$/` and that `zip_states` has its prefix, else 400 `Enter a valid US ZIP code`). Inline families default to `householdSize: 3`, `annualIncomeCents: null` (the WIC card is skipped; the Planner treats null income as unknown), `dcfsaOffered: true` (DCFSA cards marked `likely`). Returns `BundleResult`. Guests may run seed families without auth.
  - `GET /api/runs/:runId/trace` returns `TraceLine[]`
  - `POST /api/feedback` with `{familyId, cardId, kind, note}` saves to Neon, then calls `proposeRules`
  - `GET /api/case-law` returns proposals and approved rules
  - `POST /api/case-law/:id/approve` (`requireAdmin`; admin = email in `ADMIN_EMAILS` or `users.role='admin'`) calls `memory.addRule`
- Coach: `proposeRules(feedbackRows: Feedback[], llm): Promise<{ text: string; confidence: number; sourceFeedbackIds: string[] }[]>`, proposing only when ≥2 `issue` reports share a theme (LLM clusters; confidence = min(0.9, 0.5 + 0.1 × reports)).

- [ ] Step 1: Write the tests (supertest is already in the template):
  - `POST /api/run {familyId:'leo'}` without auth gives 200, with `cards.length ≥ 9`
  - `POST /api/run {zip:'00000',...}` gives 400 with the exact message
  - approve as a non-admin gives 403
  - the 11th unauthenticated run from one IP within 10 minutes gives 429
  - the Coach with 3 `issue` notes mentioning shipping returns 1 proposal with confidence `0.8`
- [ ] Step 2: Run. Expected: FAIL. Step 3: implement. Step 4: run. Expected: PASS. Step 5: commit `feat: bundle api, guest mode, admin role, coach`.

### Task 11: Ingest (Plaid sandbox and Amazon CSV)

**Files:** Create `server/ingest/plaid.ts`, `server/ingest/amazonCsv.ts`, plus routes `POST /api/ingest/plaid/link-token`, `POST /api/ingest/plaid/exchange`, `POST /api/ingest/amazon` (multipart). Test `server/__tests__/ingest.test.ts`.

**Interfaces:**
- Produces:
  - `parseAmazonCsv(csv: string, familyId: string): AmazonOrderRow[]`. Columns follow Amazon's `Retail.OrderHistory` export: `Order Date, Product Name, ASIN, Unit Price`. Bad rows are skipped and counted.
  - `importPlaidTransactions(familyId, accessToken, plaidClient): Promise<number>`, using Plaid `transactionsSync` with sandbox credentials `PLAID_CLIENT_ID`/`PLAID_SECRET`/`PLAID_ENV=sandbox`.
  - Both set `families.dataConnected = true`.
- Until Plaid keys exist, `data/sample/plaid-transactions.json` is in Plaid's transaction shape and imported via the same mapper, `mapPlaidTxn(t: PlaidTxn, familyId): TransactionRow`.

- [ ] Step 1: Write the tests:
  - `parseAmazonCsv` on the fixture returns N rows with `priceCents` integers, and skips a malformed line
  - `mapPlaidTxn({amount: 28.99, merchant_name:'Target', date:'2026-10-10'})` gives `amountCents: 2899`, `merchant:'Target'` (Plaid's positive amount means an outflow)
- [ ] Step 2: Run. Expected: FAIL. Step 3: implement. Step 4: run. Expected: PASS. Step 5: commit `feat: plaid sandbox and amazon csv ingest`.

### Task 12: Mobile-first UI

**Files:** Create `client/src/pages/Onboarding.tsx`, `Feed.tsx`, `CardDetail.tsx`, `Smarter.tsx`, `client/src/components/ReceiptCard.tsx`, `FeedCardView.tsx`. Modify `client/src/App.tsx` (routes `/`, `/feed/:runId`, `/card/:id`, `/smarter`). Test `client/src/components/__tests__/FeedCardView.test.tsx`.

**Interfaces:**
- Consumes: Task 10 API, `shared/bundle.ts`.
- Onboarding: 3 inputs, plus the buttons `Try as guest` (picks maya), `Connect a card` (Plaid Link) and `Upload Amazon orders`.
- Feed:
  - `ReceiptCard` (`$X found · N deadlines (next in D days) · M items safety-checked`)
  - grouped cards in the order clawback, recall, benefit, discount, coming_soon
  - the banner when present
  - a progress list while running, fed by streamed trace lines (polling `/api/runs/:runId/trace` every 1s)
- CardDetail: "How we checked" (trace lines for that card, sources) and the `I got this` / `Report issue` buttons.
- Smarter: case-law proposals with Approve (admin only), approved rules with confidence, and the eval scoreboard (Task 13 JSON).

- [ ] Step 1: Write the test: `FeedCardView` renders the amount as `$28.99`, a `verdict:'likely'` card shows `Likely eligible`, and the sources render as links.
- [ ] Step 2: Run. Expected: FAIL. Step 3: implement (shadcn components, 375px-first, readable contrast). Step 4: run. Expected: PASS.
- [ ] Step 5: Manual check at 375px: guest flow → Receipt → card detail → report issue. Screenshot to `docs/screens/`.
- [ ] Step 6: Commit `feat: mobile-first onboarding, feed, card detail, smarter screens`.

### Task 13: Scout, evals and learning demo

**Files:** Create `scripts/scout.ts`, `scripts/eval.ts`, `data/sample/saved-pages/*.html` (10 saved official/offer pages), `evals/expected.json`. Test `server/__tests__/eval.test.ts`.

**Interfaces:**
- `scout(pagesDir): Promise<{ rules: BenefitRuleRow[]; offers: OfferRow[] }>`: the LLM extracts rows, each requiring `sourceUrl`; the Fact-Checker's `no source` rule rejects any without it. Output is written via upsert. Seed rows remain the fallback.
- `runEval(): Promise<Scoreboard>`, where `Scoreboard = { trapsCaught: number; trapsTotal: number; falseAlarms: number; sourcedPct: number; runs: number; stable: boolean; learning: { run1Approved: boolean; run2Blocked: boolean; citedRuleId: string | null } }`. It runs `runBundle` for the 3 seed families 3 times and compares to `evals/expected.json`. Traps: the shipping-trap offer, a wrong-amount Scout row, the recalled item, the refund, the duplicate, the non-MA family.
- Learning demo: `scripts/eval.ts --learning`:
  1. Run 1. The shipping-trap offer is approved (no case law yet).
  2. Inject 3 fixture `issue` feedback rows, run the Coach, and auto-approve with the admin flag.
  3. Run 2. The trap is rejected and the Judge's trace cites the rule id.
  4. Write `logs/scoreboard.json`, and copy run 1 and run 2 traces to `output_examples/learning/` (a saved real run 1 is the demo fallback if the live model rejects the trap in run 1).

- [ ] Step 1: Write the test: `runEval` with FakeGenerator fixtures returns `trapsTotal === 6` and `sourcedPct === 100`; the `--learning` path flips the trap offer from approved (run 1) to blocked (run 2).
- [ ] Step 2: Run. Expected: FAIL. Step 3: implement. Step 4: run. Expected: PASS. Step 5: commit `feat: scout, eval scoreboard, learning demo`.

### Task 14: Submission packaging

**Files:** Create `README.md` (sections per hackathon-checklist §6), `data/README.md` (source, licence, subset, count, regenerate, limits per source), `metadata.json`, `input_examples/` (3), `output_examples/` (3 saved real runs), `docs/architecture.md` (diagram), `LICENSE` (MIT; Colin's template credited as a pre-existing component). Modify `.env.example`.

- [ ] Step 0: SAMPLE_MODE must run with no secrets: families from `data/sample/families.json`, `firebase-admin` init skipped, Zetaris answered from the committed cache (README states these are saved real responses, with capture timestamps), LLM falling back to deterministic text when `MODEL_API_KEY` is empty. Commit sample traces to `logs/sample/` (not ignored).
- [ ] Step 1: Clean-setup test (in a temp dir with **no** `../.secrets` next to it):
  1. `git clone` to a temp dir
  2. `cp .env.example .env` with `SAMPLE_MODE=true`
  3. `npm ci && npm run dev`
  4. `curl -s -XPOST localhost:5000/api/run -H 'content-type: application/json' -d '{"familyId":"leo"}' | jq '.cards|length'`

  Expected: `≥ 9`, with no other manual steps.
- [ ] Step 2: `git grep -nE 'npg_|AIza|akiurs|BEGIN PRIVATE KEY'` returns nothing.
- [ ] Step 3: Check that the time from `npm run dev` to the server listening is under 30s.
- [ ] Step 4: README names the track (Track 1: Solving Fragmented Intelligence), lists pre-existing components (Colin Matthews' template at a9542c2, Meterless H-MEM reference, Zetaris starter scripts, pre-Oct-22 research), and maps the layout to the hackathon's suggested `app/agents`-style structure. Add `metadata.json` per the HackOS spec (still unknown; ask in #help desk).
- [ ] Step 5: Commit `docs: readme, data notes, metadata, examples`.
- [ ] Step 6 (human, Tue Oct 27): make the repo public, open its link in a logged-out private window, submit on HackOS.

---

## QC: executive summary ↔ plan

| Exec summary item | Task(s) |
|---|---|
| §1 three inputs, guest, optional Plaid/Amazon | 10, 11, 12 |
| §1 Receipt | 9 (`receipt`), 12 (`ReceiptCard`) |
| §1 Clawback (FSA, price adjustment, DCFSA) | 6 |
| §1 Recall (flags / all clear / connect) | 6, 9 |
| §1 Discounts via Fine Print Court | 7 |
| §1 Benefits/deadlines (Trump Account, insurance 30-day, MA CTC $440, PFML, DCFSA life event) | 2 (rules), 8 |
| §1 Coming-soon tiles | 9, 12 |
| §1 Never-empty guarantee + exact copy | Global Constraints, 9 |
| §2 Orchestrator, traces | 4, 9 |
| §2 Fact-Checker, max 2 retries | 5, 9 |
| §2 Coach + admin approve + case law | 4 (memory), 10, 13 |
| §2 Scout | 13 |
| §3 Zetaris: Neon × curated × CPSC/openFDA, per-agent views, DQ | 3 (views). **Gap fixed:** DQ rule added below |
| §3 H-MEM learning run 1 vs 2, ledger in logs/ | 4, 9, 13 |
| §3 NVIDIA Nemotron | 4 |
| §4 `POST /api/run`, SAMPLE_MODE, logs/, repo files, evals | 3, 9, 10, 13, 14 |
| §5 Infra order 1–5 | Tasks 1–4 (+ Firebase in 1/10) |
| §6 Timeline (Tue Oct 27 deadline, Fri noon Zetaris go/no-go, Plan B) | Global Constraints, Task 3 Step 6, Task 14 Step 6 |
| §7 risks: speed, open endpoint, learning reliability | Global Constraints (rate limit, guest limits), Task 9 (parallel agents), Task 13 (saved run 1) |
| §6 Cut order | Scout = 13, price-adjustment = part of 6, Amazon = part of 11, login = part of 10 |

**DQ gap fix (added to Task 3, Step 5):** also emit `REGISTER DQ` for the rules `offers.source_url IS NOT NULL AND source_url <> ''` and `benefit_rules.source_url IS NOT NULL`, check the exact syntax in `docs/guides/zetaris-lightning-sql-commands.md` §DQ, and run it in Step 6. The Fact-Checker's `no source` check (Task 5) is the in-app backstop.

**Firebase check (added to Task 1, Step 5):** confirm `client/src/lib/firebase.ts` initialises from `VITE_FIREBASE_*` and that sign-in with a test account created in the Firebase console works locally. Storage init must be removed so no Blaze plan is needed.

**Independent review (Oct 23):** a fresh reviewer compared this plan with the exec summary and found 8 mismatches, 10 consistency issues, 6 hackathon gaps and 5 risks. All are fixed above: the Tuesday deadline, the coming-soon tiles, the exact recall copy, ≥15 offers, court-vetted fillers, per-agent views for recall and Scout, the learning fields on the scoreboard, fixed dates plus `TODAY`, `CourtRuling`, snake_case names, numeric coercion, `loadFamily` plus fillers, `revise()`, court inputs, unborn general offers, inline-family defaults plus `zip_states`, a secret-free SAMPLE_MODE, fail-closed court, traced Zetaris and memory calls, committed sample logs, packaging steps, Plan B, and rate limits.

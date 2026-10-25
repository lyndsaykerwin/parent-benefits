## Global Constraints

- **Repo location:** `/Users/lyndsay/Documents/hackathon/bundle/` (its own git repo).
  - Secrets are read from `/Users/lyndsay/Documents/hackathon/.secrets/bundle.env.local` plus Zetaris values copied from `setup/zetaris-getting-started/.env.local`.
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
- **LLM unavailable:** Fine Print Court uses a deterministic screen. It rejects offers matching an approved case-law rule's keywords or an explicit shipping/handling fee over $5, and approves the rest as verdict `likely` with trace status `fallback`. Auto-renew detection is never hard-coded; it is learned via case law. Explanations fall back to deterministic text. (Controller ruling, Oct 23; supersedes the earlier "reject" rule.)
- **Every Zetaris and memory call is traced:** `ZetarisClient` and `BundleMemory` take an optional `TraceLogger`.
- **Deadline:** submissions close Tue Oct 27, 2026, 23:45 UTC (Oct 27 is a Tuesday). Target: submit by 5pm Boston that day.
- **Guest abuse limits:** unauthenticated `POST /api/run` may only use seed family ids, or an inline family that is not persisted. Rate limit is 10 runs per IP per 10 minutes (`express-rate-limit`, already in the template).

## Review Focus

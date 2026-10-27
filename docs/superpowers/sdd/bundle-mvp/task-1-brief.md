# Task 1 brief: scaffold the Bundle repo from the VibeCode template (guest-only)

**Overrides the plan's Task 1 text, per the spec's "Decisions locked Oct 23": guest only, no sign-in.**

## Goal
Create `/Users/lyndsay/Documents/hackathon/bundle/` as its own git repo (branch `main`, local only, **no remote, do not push**). Start from the VibeCode template repository at its current HEAD (`6af369a`), with everything Bundle doesn't need removed, and a dev server and test suite that work.

## Steps
1. Clone the template into a temp dir, then copy the tree **without `.git`** into `bundle/`. Run `git init -b main` and make the first commit: `chore: import VibeCode template 6af369a (MIT, pre-existing component)`. This commit must hold the template exactly as imported, so the pre-existing code is clearly separate from new work.
2. Remove:
   - **Replit auth:** `server/replit_integrations/`, its use in `server/routes/index.ts`, session/passport setup, and the Replit-only files `.replit`, `replit.md`, `attached_assets/`
   - **ChatKit / AI chat:** `server/routes/chatKitRoutes.ts`, `client/src/pages/ai-chat.tsx`, `docs/CHATKIT_*`, `docs/agent-function-*`
   - **Items / to-dos:** `server/routes/itemRoutes.ts`, `server/storage/ItemStorage.ts`, the TodoList component, and their tests
   - **Payments routes/pages** may stay for now but must not be required to boot. If they need Stripe keys at startup, make them load only when `STRIPE_SECRET_KEY` is set.
   - Tests for deleted features
3. Auth becomes **guest-only**. Keep `server/middleware/auth.ts` minimal or remove it, so no route requires sign-in. Keep the `users` table in the schema (later tasks may use it), but nothing depends on a logged-in user.
4. Add `server/env.ts` exporting `loadEnv(): void`, called first in `server/index.ts`.
   - It loads `/Users/lyndsay/Documents/hackathon/.secrets/bundle.env.local` **if it exists** (resolve as `path.resolve(process.cwd(), '../.secrets/bundle.env.local')`), then `.env.local` and `.env` in the repo root if present.
   - It never overwrites a variable that is already set. Use `dotenv`, already a dependency.
   - Test `server/__tests__/env.test.ts`: `loadEnv` with a temp file containing `FOO=bar` sets `process.env.FOO === 'bar'`, and does not overwrite a pre-set value. Refactor so the file paths are injectable for the test.
5. Add `GET /api/health` returning `{"ok":true}`.
6. `package.json` name becomes `bundle`. `.gitignore` must include `.env`, `.env.*` (but not `.env.example`), `logs/*.jsonl`, `vendor/hmem/node_modules`, `data/hmem/`, `node_modules`, `dist`.
7. `.env.example` keeps placeholders only, for: `DATABASE_URL, ZETARIS_BASE_URL, ZETARIS_ORG_ID, ZETARIS_API_KEY, MODEL_API_KEY, MODEL_BASE_URL=https://integrate.api.nvidia.com/v1, MODEL_REASONING, MODEL_FAST, SAMPLE_MODE=false, SOURCE_TIMEOUT_SECONDS=20, MAX_RETRIES=2, REVIEWER_MODE_TOKEN, TODAY, PORT=5000`. Optional Stripe vars, commented out.
8. Database: the template uses `@neondatabase/serverless` with `DATABASE_URL`. Keep that. The real Neon URL comes from the secrets file via `loadEnv`. Do not run `db:push`; apply reviewed SQL by hand, only with Lyndsay's OK. The Neon database already contains a table `spike0_amazon_orders` that must NOT be dropped. If drizzle-kit wants to drop it, do NOT confirm; report instead. (Drizzle's `tablesFilter` can scope it.)

## Verification (paste the outputs into your report)
- `npm install` succeeds
- `npm run check` (tsc) passes with 0 errors
- `npm test` passes (state the counts)
- `npm run dev`, then `curl -s localhost:5000/api/health` returns `{"ok":true}`, and loading `/` in a browser or with curl returns the HTML shell. Stop the server afterwards.
- `git grep -nE 'npg_|AIza|akiurs|BEGIN PRIVATE KEY'` prints nothing

## Constraints
- Fake data only. Never print or commit secret values. Do not push anywhere.
- Commit in logical steps, e.g. `chore: strip replit auth, chat, items`, `feat: env loader + health route`.

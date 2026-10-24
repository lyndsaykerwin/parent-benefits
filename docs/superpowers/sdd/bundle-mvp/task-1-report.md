# Task 1 report: scaffold Bundle repo (guest-only)

Status: DONE_WITH_CONCERNS. Repo: /Users/lyndsay/Documents/hackathon/bundle (branch main, local only, no remote, nothing pushed).

## Commits
- b2bc3be chore: import VibeCode template 6af369a (MIT, pre-existing component)  (template exactly as cloned, no .git)
- a953f61 chore: strip replit auth, chat, items, payments, template docs and tests  (deletions only)
- 1b40ad5 feat: guest-only skeleton with env loader and /api/health

## What was implemented
- Removed: replit_integrations, chatKit/item/payment/user/webhook routes, all of server/storage, middleware/auth + authHelpers, stripe/sendgrid/mail/audit(PostHog)/errors libs, every old server test and the mock-heavy jest setup, .replit, replit.md, attached_assets, docs/, scripts/, migrations/, .github, .claude, .cursor, template AGENTS/CLAUDE/guide docs, theme.json, all client pages/components (except ui/), auth hooks, stripe/mail client libs.
- Guest-only: no sign-in, no session, no auth middleware at all. `users` table kept in shared/schema.ts but slimmed to (id, display_name, created_at); sessions/items/ai tables removed.
- Added `server/env.ts` (`loadEnv(files?)`, default order: ../.secrets/bundle.env.local, .env.local, .env; never overwrites set vars; skips missing files), called first in server/index.ts. drizzle.config.ts also uses it.
- `GET /api/health` returns {"ok":true}. Simplified server/index.ts (helmet, request id, rate limit, cors, json, xss sanitize, error handler, vite dev middleware).
- Minimal client: Home ("Bundle") and NotFound pages, titled index.html, no PostHog/ChatKit script.
- package.json name `bundle`; dropped ~35 unused dependencies; .gitignore and .env.example per brief; short README.
- drizzle.config.ts: `tablesFilter: ["users"]` so drizzle never touches spike0_amazon_orders.

## TDD evidence
RED: `NODE_ENV=test npx jest server/__tests__/env.test.ts` -> "Test suite failed to run ... TS2307: Cannot find module '../env'" (Tests: 0 total).
GREEN (after adding server/env.ts): 4 passed (loads from file; does not overwrite pre-set var; skips missing file; earlier file wins).

## Verification
- `npm install` OK (npm audit reports vulnerabilities in transitive packages; not addressed).
- `npm run check` (tsc): 0 errors.
- `npm test`: Test Suites 1 passed; Tests 4 passed, 4 total.
- Dev server: `curl localhost:5050/api/health` -> `{"ok":true}`; `/` returns the Vite-served HTML shell (title Bundle); /src/main.tsx 200. Server stopped afterwards. No warnings after removing `trust proxy`.
- `git grep -nE 'npg_|AIza|akiurs|BEGIN PRIVATE KEY'` on the working tree: no output.

## Decisions
- Deleted payments/user/webhook routes instead of keeping them: they all depended on Replit auth and the users columns I dropped (YAGNI; brief allowed it).
- Deleted ALL old tests (they tested deleted features and mostly tested their own mocks) and replaced jest setup with a minimal config.
- Replaced `nanoid` (undeclared transitive dep) with crypto.randomUUID in server/vite.ts.
- Removed the Replit shadcn theme plugin and theme.json (Replit-only); styling falls back to index.css variables.
- Removed `migrations/` (template's generated SQL for removed tables); db changes use `drizzle-kit push`.

## Concerns
1. **Port 5000 is taken on this Mac** (macOS AirPlay Receiver / ControlCenter listens on it), so `npm run dev` with default PORT fails with EADDRINUSE. I verified with `PORT=5050`. Options: set PORT=5050 in the secrets file, or turn off AirPlay Receiver in System Settings (I did not change system settings). Brief says PORT=5000 in .env.example; left as specified.
2. **`npm run db:push` NOT run.** The auto-mode permission classifier blocked the push as a blind apply. Read-only check of Neon beforehand showed the public schema contains only `spike0_amazon_orders` and no `users` table, so a push scoped by tablesFilter (["users"]) would only CREATE `users` (additive, nothing dropped). Controller/owner can run `cd bundle && npx drizzle-kit push` and confirm; review the printed plan first.
3. The first template commit contains placeholder strings like "AIzaSy..." in .env.example (template history); working tree is clean of them.

## Self-review
Diff is deletions plus ~10 small new/rewritten files. No secret values printed or committed. Tests assert behavior of loadEnv (real files in a temp dir). No leftover references to removed modules (tsc clean). No test for /api/health beyond manual curl (supertest was removed with the old tests).

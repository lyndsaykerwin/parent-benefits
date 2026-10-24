# Task 1 review (scaffold, guest-only)

## Part 1: Spec compliance: PASS (with noted scope extras)
Verified from the repo at HEAD 1b40ad5 (3 commits, no remote):
- Verbatim import commit first, then strip, then feature commit. OK.
- server/env.ts: loadEnv(files?) injectable, order ../.secrets/bundle.env.local, .env.local, .env; override:false; skips missing; called first in server/index.ts (before other imports run code). Test covers set + no-overwrite (+2 extras). OK.
- GET /api/health returns {ok:true}. OK. package name bundle. OK.
- .gitignore covers .env, .env.*, !.env.example, logs/*.jsonl, vendor/hmem/node_modules, data/hmem/, node_modules, dist. OK.
- .env.example: all required keys, placeholders only, Stripe commented. OK.
- Guest-only: no auth middleware, session or passport anywhere. users table kept. OK.
- spike0_amazon_orders protected via tablesFilter ["users"]; db:push not run (reported honestly, accepted as deferred).
- Secret grep on working tree: clean (I re-ran it).

Missing: none required. (db:push deferral is disclosed, not a miss.)

Extra (beyond brief, deletions): removed whole docs/, scripts/, migrations/, .github, .claude, .cursor, theme.json, all client pages/components outside ui/, and slimmed users to (id, display_name, created_at) dropping email/Stripe columns. Brief only required CHATKIT/agent-function docs and "users table kept". Controller already accepted route deletion; the rest is consistent with that but wider than asked. Not harmful; flagging for awareness.

Misunderstood: none.

## Part 2: Quality
Critical: none.
Important: none.

Minor:
1. README.md (dev line): says http://localhost:5000, but default port is unusable on this Mac (AirPlay). Fix: say "set PORT=5050 in ../.secrets/bundle.env.local" or note the caveat.
2. Unused dependencies remain in package.json (cookie-parser, @types/cookie-parser, drizzle-zod, and likely many radix/UI libs). Harmless; prune later if bundle size or install time matters.
3. server/db.ts throws at import if DATABASE_URL is unset. Fine today (nothing imports it yet); later tasks that import it must make sure loadEnv has run first (index.ts does this) and that tests mock or set it.
4. No automated test for /api/health (only manual curl). A small supertest/fetch test would lock it in; supertest was removed. Optional.
5. .gitignore has extra `.mcp.json` and `vite.config.ts.*` (template carryover). Harmless.
6. drizzle.config.ts `out: "./migrations"` points at a directory that no longer exists; drizzle push does not need it, but generate would recreate it. Fine.

## Cannot verify from diff
- Whether a Vite HMR websocket works under CSP connectSrc 'self' in a real browser (report says HTML shell and /src/main.tsx return 200 only).
- db:push effect on Neon (not run); the tablesFilter assumption should be reviewed in the printed plan before confirming.
- First commit's history contains placeholder "AIzaSy..." strings from the template (placeholders per report; not a real key, working tree clean).

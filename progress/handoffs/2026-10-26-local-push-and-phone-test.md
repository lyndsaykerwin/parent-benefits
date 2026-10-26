# Handoff: finish the push and test on the Mac (Oct 26, 2026)

Read first: CLAUDE.md, AGENTS.md, progress/handoffs/2026-10-25-v2-cloud-handoff.md, progress/tracking/2026-10-25-mac-finish-tracker.md.
Deadline: submission due Oct 27, 23:45 UTC. Lyndsay is non-technical: plain English, fictional data only, never print secrets.

## Where things stand
- V2 build is done (Lanes A-E, 21/21 acceptance tests, last full run 1194 pass / 0 fail, type check clean).
- Jobs 1-5 from the Mac finish tracker are done (Neon columns added, Tavily proven, Zetaris/vision reports written, live finds save to offer_checks, Account moved to the family chip).
- Commit `d7ac58e` ("Vision/photo reading and LLM adapter fixes, chip and Account tweaks, tests") is on local `main` but NOT pushed. The cloud session's network blocked GitHub (403 from proxy).
- Left uncommitted on purpose: `bundle/.claude/`, `codebase_export/`. This file is also new and uncommitted.
- Stale git lock files were renamed to `.git/stale-*`; safe to delete.

## Step 1: push
1. `cd ~/Documents/hackathon && git status` (expect only the two folders above plus this file).
2. `git add progress/handoffs/2026-10-26-local-push-and-phone-test.md && git commit -m "Add Oct 26 handoff"`.
3. `git push origin main`. Confirm on GitHub (lyndsaykerwin/parent-benefits) that d7ac58e is there.

## Step 2: re-verify on the Mac (cloud could not run tests)
`cd bundle && npm test && npm run test:v2 && npm run check`. One past one-off failure in `eval.test` that passed on rerun; rerun once before worrying.

## Step 3: test on her computer, then her phone
1. Practice mode: `SAMPLE_MODE=true npm run dev`, open http://localhost:5050 (not 5060).
2. Phone on the same Wi-Fi: find the Mac's address (System Settings > Wi-Fi > Details, or `ipconfig getifaddr en0`) and open `http://<that address>:5050` on the phone. The server already listens on all addresses. If it won't load, check the Mac firewall. Note: the production CORS list in server/index.ts only allows localhost.
3. Friend (anywhere): either ngrok (`ngrok http 5050`, already installed; link works only while the Mac is awake and the app runs; practice mode only, no real keys) or Render (below).

## Step 4 (optional, preferred for a friend): deploy to Render
- `bundle/render.yaml` is ready (practice mode, always-on Starter plan; the free plan sleeps ~1 min). Lyndsay creates the Render account, connects the GitHub repo, picks the blueprint. Check current pricing.
- Keys go only in Render's dashboard, never the repo. Leave practice mode on for a friend; there is no login, so real-mode keys would be spent by any visitor.
- Friend must use made-up family details only.

## Still open from the earlier plan
- Job 6: Nightshift check (needs the Meterless Nightshift app open): `npm run model:check -- --provider nightshift`, one live run, save to progress/reviews/nightshift-check.md.
- Job 7: real-mode click-through with the database, README update, demo script update.
- Tavily report says live finds are "mostly not real offers": Lyndsay to decide if demo-ready.
- Questions for Lyndsay: report card is empty in practice mode until Zetaris is re-recorded (job 3 blocked on a source column that is now added, so re-run `register`, `zetaris:record`, `examples:regen`); header chip naming for typed-in families.
- Do not run `db:push` or `drizzle-kit migrate` on Neon (see job 1 report).

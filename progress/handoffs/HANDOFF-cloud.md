# Handoff: Mac → cloud (Sun Oct 25, 2026)

Written at the end of the Mac session. Everything below is saved on GitHub `main` (repo `lyndsaykerwin/parent-benefits`). Lyndsay is switching to a **different Claude Code account**; this file plus the repo is the full picture. Start by reading `CLAUDE.md` (it pulls in her working rules and the "subagents for everything" preference).

## Where things are
- **Plan (signed off):** `bundle-plan-v3.md`. **Build tracker (source of truth):** `progress/tracking/bundle-plan-v3.build-tracker.md` — waves 4–6 are at lines ~300–360.
- **Wave trackers:** `progress/tracking/TRACKING-oct24-wave2.md`, `progress/tracking/TRACKING-oct24-wave3.md` (each has chunk status, hand-offs, and a "live re-record" section).
- **QC reports:** `qc-reports/W2-*.md`, `qc-reports/W3-*.md` (+ `*-integration-qc.md`). The W3 integration report lists every W4 wiring gap with file:line.
- **Earlier handoff (cloud → Mac):** `progress/handoffs/HANDOFF-local.md`.

## Status
- **Waves 1–3: built, independently QC'd, merged, live-recorded, pushed.** `cd bundle && npm test` → **850 passed, 11 skipped, 0 failed**; `npx tsc --noEmit` clean; `npm run build` OK. Offline eval: 6/6 traps, 0 false alarms, learning flip works; money back Maya $48.99, Leo $0, Ava $14.58.
- **Neon:** 5 wave-2 tables live, `poverty_guidelines` dropped, sample data re-seeded Oct 25 (Maya's KEAWIS purchase now 2025-03-10, inside real recall 10560's sale window).
- **Zetaris:** all tables/views registered; replays recorded for every sample-mode query including W3's (rule query with `scope`, `recallDetailsSql`, `eligibilityCounterSql` MA/NY/CA, saved verdicts, offer audit). Recorded with the AI off, matching how sample mode runs. (Live Nemotron caught the free-box trap on the first try — good demo fact.)
- **Offer deadline bug fixed:** `max_age_days` was being used as an end date. Offers now have no deadline and say "Fits babies up to N months old."

## Next: wave 4 (not started)
Run it the same way as waves 2–3: map chunks to a `TRACKING-*-wave4.md`, builders in separate worktrees (start ≤5 at once — 6+ simultaneous worktree creations collided once), independent QC agent per chunk, fixer, re-QC, merge only on pass, one integration QC, then one live re-record if Zetaris SQL text changed. Cheaper models (Sonnet for build/QC, Haiku for merges) worked well.
- **W4-ORCH** — wire into `server/agents/orchestrator.ts`: `ctx.workspace = new Workspace(runId, memory, trace)`; `ctx.offerChecks = createOfferCheckWriter(db)`; `checkWithCorrections` instead of plain `verify` (pass `(c, why) => benefits.revise(c, why, ctx)` + workspace lesson ids); `runEligibilityLoop`; `runEvents.emit` + `runEvents.finish(runId)`; set `stateNote: UNCOVERED_STATE_NOTE` when no rule matches the family's state; attach `valueScore` to feed cards; `withTrace(trace, agentName)` per agent; log final yes as `approve_card`; remove dead `dcfsa_childcare` branch (orchestrator.ts ~122-125); fix server card text "Do this by <date>" for expecting families; `POST /api/run?wait=true` should include `family` (bundleRoutes.ts ~226).
- **W4-STREAM** — instant saved feed, streaming cards, status pills (event hub `server/agents/runEvents.ts`; its events carry full owner cards, so apply the parent whitelist).
- Then **W5** (coverage audit, evals/scoreboard, README with Meterless honesty note) and **W6** (regenerate labelled offline evidence + clean-download rehearsal). Panel loop-detection wording (`client/src/pages/AgentWorkspace.tsx` `loopsOf`) should be re-checked in W5-COVERAGE against real court/fact/safety trace lines.
- **Not in any wave (Lyndsay said not now):** slide deck, demo video script, submission form (declare pre-Oct-22 work; `metadata.json` contents unknown). Deck slide 2 has a bracketed placeholder where the WIC stat was. Deadline Tue Oct 27, 7:45pm Boston; her target 5pm.

## Cloud environment setup (new account)
Secrets are NOT in the repo. In the new account's cloud environment settings, add these as environment variables (values from Lyndsay's Mac file `~/Documents/hackathon/.secrets/bundle.env.local` — she copies them herself; never paste them into chat or the repo):
- Needed: `DATABASE_URL` (Neon), `ZETARIS_BASE_URL`, `ZETARIS_ORG_ID`, `ZETARIS_API_KEY`, `MODEL_API_KEY`, `MODEL_BASE_URL`, `MODEL_REASONING`, `MODEL_FAST` (now `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`).
- Firebase (only if hosting/auth work needs it): `VITE_FIREBASE_*` (5), `FIREBASE_STORAGE_BUCKET`, `GOOGLE_APPLICATION_CREDENTIALS` (points to a JSON file on the Mac — the cloud would need that file's contents provided separately).
- Not needed anymore: `PLAID_*` (Plaid removed in W2-PURCH). Mac-only: `NIGHTSHIFT_TOKEN_FILE`.
- With no keys, run with `SAMPLE_MODE=true` (everything builds and tests offline).

## What only works on the Mac
- **Nightshift** (Meterless's AI switchboard) runs on the Mac at `127.0.0.1:8088` and now routes to NVIDIA Nemotron (Lyndsay added her NVIDIA key inside the Nightshift app on Oct 24; `npm run model:check -- --provider nightshift` passed: Nemotron 3 Ultra 550B + 3.5 Lightning). The cloud cannot reach it, so in the cloud the app falls back to NVIDIA direct (if `MODEL_API_KEY` set) or offline text. **Live demo runs and the demo video must happen on the Mac** to show "Nightshift as primary AI provider".
- Meterless **Sunday Oct 25 evening (Pacific) update**: after it, on the Mac, pick Nemotron as the exact model for "deep", raise its timeout, and turn "thinking" off (`NIGHTSHIFT_REASONING`, `NIGHTSHIFT_EXTRA_BODY`) — the big model currently starts some replies by thinking out loud.
- Local Postgres for live DB tests: on Mac via Homebrew `postgresql@16` (`bundle/db-test-setup.sh` has Mac + Linux paths).

## Rules learned the hard way
- **Never run `npm run db:push`** (drizzle-kit): on Oct 24 it ignored a "no" and tried to apply its plan (it failed on the first statement, nothing lost). Apply schema changes as reviewed SQL by hand, only with Lyndsay's OK.
- **Never hand-write Zetaris replays.** Any change to Zetaris SQL text makes sample-mode replays miss; leave tests strict and re-record live (`zetaris:record`, `agents-live`, `benefits-live`, `court-live`, `examples:regen -- --live`; thrift errors pass after ~30s retry). Re-record with the AI off so sample-mode traps behave as designed.
- Tests must not depend on Neon serial ids (purchase_items ids change on re-seed).
- After test/eval runs, `git checkout -- bundle/logs bundle/output_examples bundle/data/sample/zetaris-cache` unless regenerating on purpose.
- Live steps that change Neon/Zetaris need Lyndsay's explicit yes each time.

## Open decisions for Lyndsay (defaults in brackets, being applied unless she says otherwise)
- Unverified benefits still count toward the total with a "Not yet verified" label [keep].
- If the recall check can't run, deals stay visible with a logged fallback [keep].
- "Save your list" ships as a labelled demo card; real sign-in ≈ 4–6 h + Google OAuth keys only she can create [keep as demo].
- H-MEM note writes are logged as `recall_hmem` [keep]; run notes kept forever [keep]; `universal_rule` definition [keep].
- Maya's crib mattress is dated ~10 months before her pregnancy (forced by the real recall window) — describe as a hand-me-down/earlier purchase in the demo.

## Update: cloud session, Oct 25 (waves 4-6 done)
- **Built, independently QC'd, merged to main:** W4 (orchestrator wiring, Value Score cards, instant saved feed + streaming cards + status pills, server event stream with parent whitelist), W5 (coverage audit, 8-trap scoreboard, README with Meterless honesty note, Mac checklist `bundle/docs/mac-flip-on-checklist.md`, year-one table, Forget-my-items button, family profile via Zetaris), W6 (offline evidence regenerated + labelled, browser smoke test, clean-download rehearsal PASS). Plaid tile removed (Lyndsay). Parent wording polished.
- **Checks:** `SAMPLE_MODE=true npm test` 1000 passed / 11 skipped; tsc + build clean; eval 8/8 traps, 0 false alarms, Maya $48.99 / Leo $0 / Ava $14.58. No Zetaris SQL changed → no re-record needed.
- **Known, left as is (Lyndsay's call):** `eval.test.ts` "stable across 3 runs" fails occasionally (suspect: shared memory across the 3 runs, scripts/eval.ts:348).
- **Open decisions:** CLAUDE.md "memory + safety" wording vs. Meterless used for memory + Nightshift only (progress/reviews/meterless-safety-research.md); deck still says $9,210 and "6 of 6"; recall columns on offer_checks need a new Zetaris question (Mac); verify IRS Form 4547 wording in bundle/docs/year-one-table.md.
- **Mac only:** Nightshift settings after Meterless's update, live re-record if ever needed, live demo + video — see the Mac checklist.

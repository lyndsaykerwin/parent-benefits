# SDD ledger — plan: /Users/lyndsay/Documents/hackathon/docs/superpowers/plans/2026-10-23-bundle-mvp.md

Spec: /Users/lyndsay/Documents/hackathon/bundle-plan-executive-summary.md (binding, incl. "Decisions locked Oct 23").
Workspace: /Users/lyndsay/Documents/hackathon/docs/superpowers/sdd/bundle-mvp (outside any repo).
Repo: /Users/lyndsay/Documents/hackathon/bundle (created by Task 1; work on `main`).

## Rulings
- Ruling: the workspace lives in the hackathon folder, not the sdd-workspace default — the script resolved to ~/dotfiles (a public repo) — if wrong, files move; no cost.
- Ruling: work directly on `main` in the new `bundle` repo, with no worktree — it's a brand-new solo repo and Lyndsay's CLAUDE.md says solo work goes to main — if wrong, branch later.
- Ruling: Task 1 uses the template's current HEAD (6af369a), not a9542c2 — the spec's "Decisions locked Oct 23" made it guest only, so the Firebase-era commit isn't needed — cost if wrong: Firebase gets re-added post-hackathon.
- Ruling: Task 10's roles/admin are replaced by a demo "Reviewer mode" (env `REVIEWER_MODE_TOKEN`, header `x-reviewer-token`); `requireAdmin` checks that token — the spec says guest only — low cost.
- Ruling: Task 11 drops the Plaid link/exchange routes and keeps `mapPlaidTxn` + fixtures; Amazon upload is optional (only after the core works).
- Ruling: Task 7's court caps at 5 offers per run (spec decision).
- Ruling: `BundleReceipt` = `{ moneyBackCents, likelyBenefitsCents, deadlineCount, nextDeadline, itemsChecked }` (the spec splits the Receipt); this replaces `totalCents` in Tasks 2, 9 and 12.
- Ruling: Task 13 has a mini-Scout over 3 saved pages; the trap offer is "free, auto-renews into a paid membership after 30 days"; the learning demo uses the real AI, with saved runs as backup.
- Ruling: Task 3 reuses the existing `bundle_pg` datasource and `bundle_live.cpsc_recalls` (Spike 0) rather than recreating them.

## Pre-flight scan
| Pair / task | Produces → consumes | Finding | Ruling |
|---|---|---|---|
| T2 ↔ T9/T12 | `BundleReceipt` | `totalCents` conflicts with the spec's split Receipt | Use the split fields (above) |
| T1 ↔ T10 | Firebase auth → roles | Spec makes it guest only | Reviewer-mode token (above) |
| T3 ↔ T6 | views → SQL | T6 uses `v_recall_orders`; T3 now defines it | OK |
| T4 ↔ T7 | `CourtRuling` type | Defined in T4 types.ts, used in T7 | OK |
| T5 ↔ T9 | `verify` + `revise` | `revise` defined in T6–8 and consumed by T9 | OK |
| T9 ↔ T7 | `judgeOffers(ctx,input)` → fillers | T9 must call it with `includeGeneral:true` | OK |
| T11 ↔ T2 | `mapPlaidTxn` → transactions table | Matching columns | OK |
| T13 ↔ T9 | `runBundle` deps | Must pass `loadFamily` | OK |
| Each task self-consistent | — | T1 deletes items tests, fine; T2 seed test asserts `FEDERAL_CHILD_TAX_CREDIT` | OK |

## Progress
- Spike 0: complete (Zetaris Neon × CPSC join GO; setup/zetaris-notes.md)
- Ruling: default dev port 5050 (macOS AirPlay holds 5000) — set PORT=5050 in .env.example/docs — no cost.
- Ruling: payments/user/webhook routes deleted in T1 (they depended on Replit auth); they're preserved in import commit b2bc3be for post-hackathon — spec says payments "ready but unused", acceptable.
- Ruling: db:push deferred to Task 2 (schema task), run after reading the printed plan; never drop spike0_amazon_orders.
- Task 1: complete (commits b2bc3be..1b40ad5, review clean; 6 Minor parked: README port, unused deps, db.ts throws without DATABASE_URL (→ T14 SAMPLE_MODE must handle), no automated health test, gitignore carryover)
- Task 2: BASE=1b40ad5, dispatched
- Ruling: schema changes after T2 are applied as reviewed CREATE/ALTER SQL, never via an interactive drizzle-kit push (it proposed dropping spike0's sequence) — low cost.
- Task 2: minor (deferred): seed.ts:357 semicolon in comment; 3-day price-window margin; unfetched offer URLs/example.com trap URL (disclosed); poverty figures unverified; maya daycare payments predate birth (plausible: older sibling/prepaid — fine)
- Task 2: fix round 1/5 dispatched (Important: seed test doesn't guard all traps)
- Task 2: fix round 1/5 (1 addressed, 0 open; commits f246083..4121fc9)
- Task 2: complete (commits 1b40ad5..4121fc9, review clean)
- Task 2: minor (deferred): new seed tests order-dependent
- Task 3: BASE=4121fc9, dispatched
- Ruling: Zetaris DQ rules deferred (need extra setup); the Fact-Checker's `no source` check is the enforced backstop, and the README states it — cost: slightly weaker "Zetaris governance" story; revisit if time on Mon.
- Ruling: NHTSA table skipped (endpoint unconfirmed) — optional per plan.
- Ruling: openFDA rows need `LATERAL VIEW explode(results)` in a subquery; numeric dates are normalised in the Recall Checker (Task 6).
- Task 3: complete (commits 4121fc9..e7ecb97, review clean)
- Task 3: minor (deferred): register.ts password replace (split/join); trace fields filled by real TraceLogger (T4); stale dry-run cache; sampleMode cache misses go live (T9/T14 must cache seed queries)
- Task 3: minor → carried to T4: TraceLogger must also mask password "..." patterns
- Task 4: BASE=e7ecb97, dispatched
- Task 4: minor (deferred): income redaction misses number-before-word; askJson no retry on transient ModelUnavailable; TraceLogger mkdir outside try; runId unsanitised in filename
- Task 4: fix round 1/5 dispatched (2 Important: JSON password redaction; NvidiaGenerator timeout) FIX_BASE=f48d9cf
- Task 4: fix round 1/5 (2 addressed, 0 open; commits f48d9cf..7602fc6)
- Task 4: complete (commits e7ecb97..7602fc6, review clean)
- Task 4: minor (deferred): timeout wiring into OpenAI client untested; 20000 default repeated x3; runId punctuation collisions
- Task 5: BASE=7602fc6, dispatched
- Ruling (interface contract from T5): candidates must set claim.type plus keys — rule: ref (benefit_rules.code); offer: offerId; recall: recallId; clawback: txId + txAmountCents (price_adjustment also observationId + diff; dcfsa: txIds sum) — read server/agents/factChecker.ts before T6-8.
- Task 5: minor (deferred): missing source deadline/amount passes; empty id→0 queried; clawback refund amount not verified (T6 extends); live smoke of qualifiers/FDA explode before T9
- Task 5: fix round 1/5 dispatched (Important: q() backslash escape) FIX_BASE=7a14c56
- Task 5: fix round 1/5 (1 addressed, 0 open)
- Task 5: complete (commits 7602fc6..35b1b9e, review clean)
- Task 6: BASE=35b1b9e, dispatched
- Ruling: itemsChecked counts Amazon items + card item descriptions (maya 9) — more items safety-checked is truthful — revert is one line if judged misleading.
- Task 6: minor (deferred): DCFSA claim carries latest payment only (verifier uses planYear); FDA URL generic
- Task 6: fix round 1/5 dispatched (2 Important: exact matches bypass LLM; exact pairs exempt from cap; + minor itemsChecked excludes non-product rows) FIX_BASE=6d9d224
- Task 6: fix round 1/5 (2 addressed + 1 minor, 0 open)
- Task 6: complete (commits 35b1b9e..102fa1b, review clean)
- Task 6: minor (deferred): itemsChecked filter test asserts SQL text only; pair-query SQL row limit unchecked
- Task 7: BASE=102fa1b, dispatched
- Ruling: Court fallback when LLM unavailable = deterministic screen (not auto-approve): reject if fine print matches keywords of any approved case-law rule (BundleMemory.recallRules) or an explicit shipping/handling fee > $5; otherwise approve with verdict 'likely' and trace status 'fallback'. Auto-renew is NOT a hard-coded flag (it must be learned via case law, so the learning demo works offline too). Supersedes 'court rejects when LLM down' — it reconciles fail-closed with the never-empty ≥3 discounts guarantee — cost if wrong: an unflagged bad offer shows as 'likely' with no key.
- Ruling (T7 concerns): (1) the trap's fine print drops "Shipping and handling $7.95", so the learning case is purely auto-renew; (2) the trap gets trigger_keyword 'diaper' and maya's fixtures include a diaper purchase, so the trap ranks into the top 5 as a trigger match; (3) v_judge_offers is recreated to include trigger_keyword (CREATE DATASOURCE VIEW replaces it) and the court reads the view, keeping the governed-view story — all done in T7 (before its review).
- Task 7: minor (deferred): askJson retry → 4 calls on bad JSON; loose trigger includes; missing tests (invented cited ids, approve traces ok); offline reason text on bad JSON
- Task 7: fix round 1/5 dispatched (Important: bigFee over-matches 'free shipping over $50') FIX_BASE=77222af
- Task 7: fix round 1/5 (1 addressed + 3 minors, 0 open)
- Task 7: complete (commits 102fa1b..3948a67, review clean)
- Task 8: BASE=3948a67, dispatched
- Ruling: cached planner-view results contain the seed families' FAKE incomes; acceptable (fake data, cache isn't logs/traces); README must say cache data is synthetic.
- Task 8: complete (commits 3948a67..7f57580, review clean)
- Task 8: minor (deferred): '(after birth)' suffix on no-deadline cards; revise() re-runs whole plan
- Task 9: BASE=7f57580, dispatched
- Ruling (Receipt honesty): moneyBackCents counts only fsa_reimbursement + price_adjustment (concrete refunds). The dcfsa_childcare card stays kind 'clawback', verdict 'likely', but its amount is excluded from both Receipt totals; its body explains "up to $X of daycare can be paid with pre-tax dollars through your DCFSA" — the panel flagged inflated totals; DCFSA money is the family's own pre-tax contributions, not a refund. maya moneyBack becomes $48.99 (deck says $46.99 → update deck Mon).
- Ruling: "exactly 1 recall card" means exactly 1 when there are no real recalls (all-clear or connect copy); with real recalls, one card per verified recall — matches the spec's "either the flags, or...".
- Ruling: Zetaris transient HTTP 400 (Thrift/ResultSet) gets one automatic retry (added in T9). First-card-under-30s is met by the UI progress view (T12) plus SAMPLE_MODE replay (T14), not by runBundle itself.
- Ruling (never-empty vs never-unverified, T9 review I-2): when benefits or court produce too few verified cards (e.g. Zetaris down, no cache), assembleFeed fills from a bundled local copy (data/sample/fallback-rules.json + data/sample/fallback-offers.json, generated from the seed with sources). Benefit fillers are computed by the same deterministic date logic. Fillers get verdict 'info' and a visible label ("Not yet verified: some sources didn't respond"), are excluded from Receipt totals, and are never shown as verified. Minimums hold; honesty holds.
- Task 9: minor (deferred): banner shows on code bugs too; a few tests missing
- Task 9: fix round 1/5 dispatched (I-1 outage ≠ wrong; I-2 real fillers per ruling; + minors: parallel fact-check cap 4, purchaseKeywords retry, benefits.revise uses deps.today, familyId sanitized, MAX_RETRIES validated) FIX_BASE=5f4bab2
- RISK: live Zetaris (Mini cluster) gives intermittent Thrift 400s and slow runs (13s–171s). Demo + judges rely on SAMPLE_MODE replay (T14); live mode stays available. Consider asking Zetaris Discord / sizing up after submission.
- Task 9: fix round 1/5 (2 addressed + 5 minors, 0 open)
- Task 9: complete (commits 7f57580..e0d3a05, review clean)
- Task 9: minor (deferred → final review): Receipt deadlineCount/nextDeadline counts 'info' filler benefits (add counts(c) filter, orchestrator.ts ~117)
- Task 10: BASE=e0d3a05, dispatched
- Ruling: `trust proxy` + hosting rate-limit config → Task 14; in-memory run registry acceptable for the hackathon (README notes it); Neon feedback writes are exercised live in Task 13's learning run.
- BLOCKER (Lyndsay): NVIDIA key and model ids still missing → the learning demo runs with a labelled fake-llm until the key arrives.
- Task 10: minor (deferred): knownFamilies/log growth; approve race; date range checks; NODE_ENV=production on deploy (T14); Drizzle feedback path smoke (T13)
- Task 10: fix round 1/5 dispatched (I1 coach cap; I2 body limit 100kb; I3 global in-flight cap 5 → 503; + runId randomUUID) FIX_BASE=45d564f
- Task 10: fix round 1/5 (3 addressed, 0 open)
- Task 10: complete (commits e0d3a05..1e5f369, review clean)
- Task 10: minor (deferred): coach 'uncovered' filter after LIMIT; 503 test fixed 300ms wait
- Task 11: BASE=1e5f369, dispatched
- Ruling: the Amazon upload route is skipped (agents read shared Neon tables via Zetaris; inline uploads would need agent SQL changes). parseAmazonCsv + tests remain; the upload becomes a 'coming soon' tile.
- Task 11: fix round 1/5 (1 addressed + 2 minors, 0 open)
- Task 11: complete (commits 1e5f369..c8cfb40, review clean)
- Task 12: BASE=c8cfb40, dispatched
- Task 12: INTERRUPTED (session usage limit, resets 1:50pm ET). Implementer agent a1a3e865b9da6ed2b can be resumed via SendMessage; uncommitted work is in the working tree (see git status). Resume: message that agent 'continue Task 12 from where you stopped'.
- Ruling: the Neon got_it row from T12's live click stays (harmless fake-family feedback). The 5 uncommitted cache files are committed in T13.
- Task 12: minor (deferred): no focus/title change on route change; onboarding date min/max + day-boundary today
- Task 12: fix round 1/5 dispatched (I1 poll retry; + M1 https-only links, M3 aria-busy/status text, M4 contrast) FIX_BASE=320ceeb
- Ruling (demo date): seed families (maya/leo/ava) are evaluated at DEMO_TODAY=2026-10-23 unless the TODAY env overrides; inline families use the real date. The UI shows 'Demo date: Oct 23, 2026' on seed-family feeds. This keeps fixture windows (price adjustment, insurance 10 days left) stable through judging (Oct 28–Nov 6) and matches the deck — honest because these are labelled sample families. Implement in Task 13 (orchestrator/bundleDeps + UI label).
- OPEN QUESTION → T13: one live maya run showed moneyBack $28.99 (price-adjustment card missing) even though today = its deadline (2026-10-23). Possible transient Zetaris failure or an inclusive-date bug. T13's eval must check maya moneyBack = 4899 deterministically (fake LLM, cached Zetaris).
- Task 12: fix round 1/5 (1 addressed + 3 minors, 0 open)
- Task 12: complete (commits c8cfb40..3c44d3a, review clean)
- Task 13: BASE=3c44d3a, dispatched
- Ruling: the saved Scout pages are hand-written excerpts (the gov sites blocked download). data/README must label them as excerpts with source URLs and capture dates; never call them full copies.
- Task 13: minor (deferred): broad Coach auto-renew regex (reviewer gate mitigates); demoDate from expected.json; upsertScoutRows unwired
- Task 13: fix round 1/5 dispatched (I: --learning clobbers full scoreboard → merge learning fields) FIX_BASE=475b5fc
- Task 13: fix round 1/5 (1 addressed, 0 open)
- Task 13: complete (commits 3c44d3a..01c031d, review clean)
- Task 14: BASE=01c031d, dispatched
- Task 14: minor (deferred): cache timestamps are file mtimes; column name annual_income_cents appears in logged SQL (values never)
- Task 14: fix round 1/5 dispatched (I1 README retry wording; I2 NVIDIA 'supported, not exercised' wording) FIX_BASE=e3bd70a
- Task 14: fix round 1/5 (2 addressed, verified by controller grep)
- Task 14: complete (commits ..d17c2a3, review clean)
- Controller finding for final review: README line 4 claims 'built in Cursor' — false (Cursor optional, not used; Claude Code was used). Must fix.
- FINAL REVIEW: dispatched over b2bc3be..d17c2a3
- FINAL REVIEW: 1 Critical, 9 Important, 14 Minor (final-review.md).
- Ruling (C1): Remove "built in Cursor" everywhere. State "Built with Claude Code. (Cursor was listed as required in the original rules; organizers announced it optional; Lyndsay to confirm on HackOS.)" — cost if wrong: a Sponsor Tech deduction if Cursor turns out required after all; Lyndsay must confirm.
- Ruling (I6): no real-AI run can be saved until the NVIDIA key exists (Lyndsay's blocker). The README discloses the offline Coach pattern (predefined rule templates matched by keyword themes) and that saved runs are offline. When the key arrives, re-run the eval with the model and commit the outputs.
- Ruling (I9): trust proxy defaults on when NODE_ENV=production (override TRUST_PROXY=0); the in-flight cap gains a per-IP cap of 2.
- Ruling (I3): the offline court's approve text becomes "Offline screen: no flagged terms found. Not reviewed by the AI court." — never "found nothing costly".
- FINAL FIX WAVE dispatched FIX_BASE=d17c2a3
- FINAL: fix wave clean on re-review (final-rereview.md). Workspace kept (outside repo) for CTO review. HEAD=b0171e6
- Oct 23 (later): Lyndsay CONFIRMED Cursor is optional. Ruling C1 wording → drop 'pending confirmation'.
- Ruling: eval:live-model = live NVIDIA model + replayed (saved real) Zetaris answers, for repeatable judged numbers; run-family --live is a dev tool and may refresh the cache. Server in SAMPLE_MODE can never go live (verified, 264 tests).

# Bundle: final whole-branch review

Range: `b2bc3be..d17c2a3` (33 commits) in `/Users/lyndsay/Documents/hackathon/bundle`, local `main`, clean working tree.
Reviewer: final reviewer (read-only, nothing in the repo was changed). Date: 2026-10-23.

**Counts:** 1 Critical · 9 Important · 14 Minor. Also a triage of the ledger's deferred minors (table at the end): 4 to fix now, 1 to fix at deploy, the rest leave.

**What passed:**
- **No committed secrets.** I checked HEAD and the full git history. The only database addresses are the template's `test:test@localhost` ones and the placeholder in `.env.example`. `register.ts` prints only a redacted (blanked-out) version of the password.
- **No hardcoded outputs.** `output_examples/` and `logs/sample/` are real SAMPLE_MODE runs: their traces show `query_cached` lines and the fallback statuses.
- **The scoreboard is computed by `scripts/eval.ts`,** not written by hand. The planted "wrong amount" Scout row comes from a scripted stand-in model, and the README says so.
- **SQL is safe.** Every value placed into SQL goes through `quoteId` / `quoteInt` / `quoteDate`.
- **The public API is protected.** It has a 100kb body limit, a rate limit of 10 runs per IP per 10 minutes, a limit of 5 runs at once, and a reviewer-token check that is safe against timing attacks.
- **No income leaks.** `FamilyView` never carries income, typed-in families have income `null`, and the logs hold only SQL column names, never values. The committed cache does hold fake incomes, and that matches the ruling.
- **SAMPLE_MODE recomputes from saved source rows.** It replays raw Zetaris rows (data) and never saved cards.
- **Pre-existing work is disclosed** (README §12, metadata).
- **The demo date** works as ruled (`server/demoDate.ts`).
- **Never-empty minimums hold.** Even when every agent fails, the feed still has a recall card, a clawback card and the coming-soon tiles.

---

## Critical

### C1. "Built in Cursor" is false, in four places
- **Where:** `README.md:4` ("built in Cursor"), `README.md:46` (row `| Built in | Cursor |`), `README.md:183` ("**Cursor:** the build tool."), `metadata.json:26` (`"cursor": "Built in Cursor."`).
- **Failure scenario:** A false claim about sponsor technology is an integrity failure: a claim not backed by the work. Cursor was not used; Claude Code was. The hackathon's own rules still say Cursor is required (`hackathon-overview.md:39,103,153,287`). The organisers' Oct 22 "now optional" message is unconfirmed (`hackathon-checklist.md:47-48`). A judge who asks "how was Cursor used?" (`hackathon-overview.md:320`) gets nothing, and the false claim then undermines every other claim.
- **Fix:**
  1. Delete the Cursor clause on line 4, the "Built in" row, the Cursor bullet in §13 and `sponsor_tech.cursor`.
  2. Add an honest line: "Built with Claude Code (AI coding assistant). Cursor was made optional by the organisers on Oct 22 [link to the announcement]."
  3. Before submitting, get a written confirmation from HackOS #help that Cursor is optional, and keep a screenshot. If it is still required, raise that with Lyndsay now: it is a compliance gap, not a wording issue.

---

## Important

### I1. The Receipt's deadline count includes unverified filler benefits (deferred minor from Task 9, promoted)
- **Where:** `server/agents/orchestrator.ts:122-124`. The `deadlines` filter checks `kind === 'benefit' && deadline >= today` but not `counts(c)`. The dollar totals use `counts(c)` (line 116); the deadline count does not.
- **Failure scenario:** The benefits agent fails, or returns one card. The filler loop (lines 89-92) then adds `fallback-benefit-insurance_add_baby` or `dcfsa_life_event` (verdict `info`, "Not yet verified"). The Receipt counts a deadline the app has not checked, and `nextDeadline` can point at it. This breaks the "fillers stay outside the Receipt" ruling. It is hidden today only because Trump and the federal CTC (no deadlines) are first in `fallback-rules.json`.
- **Fix:** `.filter((c) => c.kind === 'benefit' && counts(c) && c.deadline && c.deadline >= today)`. Add a test: benefits agent fails, insurance filler present, `deadlineCount === 0`.

### I2. Unchecked filler offers appear under the heading "Deals that passed Fine Print Court", including a "free" box that needs Prime
- **Where:** `server/agents/fallback.ts:43-51` (fillers never go to the court); `client/src/lib/bundle.ts:101` (section title for every `discount` card); `client/src/pages/Feed.tsx:170`; `data/sample/fallback-offers.json` ("Free baby registry welcome box … Requires Prime"; Babylist "shipping fee may apply").
- **Failure scenario:** A judge types their own family (README §6 tells them to) and sees `output_examples/custom-family.json`. Three discount cards sit under "Deals that passed Fine Print Court", each badged "Not yet verified", and the first is a "free" offer that needs a paid membership. That is the exact trap the README's Problem section says Bundle catches. It reads as the court being fake.
- **Fix (both cheap):**
  1. In `groupCards` / `KIND_META`, title the section "Deals (not yet checked by Fine Print Court)" when any discount card is `info`, or put `info` discounts in their own group.
  2. Run filler offers through the court's deterministic `screen()` (export it) before using them, or drop fillers whose fine print mentions membership, Prime or a fee.

### I3. When the court is offline it approves the Prime-only box, and the card text claims a full fine-print check
- **Where:** `server/agents/finePrintCourt.ts:74-80` (the offline screen checks only learned rules and fees over $5); `finePrintCourt.ts:141` (body text "Our fine-print check found nothing that makes it costly. Likely a good deal." for every approval, including the offline screen). Seen in `output_examples/maya.json` and `leo.json` (`discount-961`) and in `leo.json` (`discount-965`, Babylist "shipping fee may apply").
- **Failure scenario:** The saved examples, which are what judges read, show the court passing a "free" offer that needs a paid membership, with text claiming nothing costly was found.
- **Fix:**
  - When `usedFallback`, say instead: "Our offline screen found no known problem (checked against learned rules and fees)."
  - Add one deterministic "requires a paid membership (Prime, membership, subscription required)" check to `screen()`, or note in the README that the offline screen does not catch it.
  - Regenerate the examples afterwards (see I7).

### I4. In SAMPLE_MODE, a family the judge types in gets no checked cards at all
- **Where:** `server/agents/benefits.ts:111-112` (`Promise.all([rules, familySql(guest-…)])`); `orchestrator.ts:164-174, 206` (`purchaseKeywords` and the court query, which depends on age); `clawback.ts` / `recall.ts` queries by family id. Evidence: `logs/sample/custom-family.jsonl`. The rules query hits the cache, then the guest-only queries miss, all four agents fail, the receipt reads $0 and the banner shows.
- **Failure scenario:** The checklist warns that "Judges will try their own inputs" (`hackathon-checklist.md:77`). Every typed-in family on the hosted SAMPLE_MODE demo shows "Some sources didn't respond" and only unverified cards. The cause is not an outage. The planner queries `v_planner_family` for a guest id that can never be in the database: typed-in families are never saved. That one pointless miss throws away the rules result, which was already cached.
- **Fix:**
  - **Benefits:** when `family.isGuest`, skip `familySql` and use the inline family (income is `null`, so WIC is skipped). The rules query and the per-rule fact-check queries are already cached from maya's runs.
  - **Clawback, recall and `purchaseKeywords`:** when `family.isGuest && !family.dataConnected`, return empty without querying.
  - **Court:** query all offers once (`SELECT … FROM v_judge_offers ORDER BY id`), filter by age in code, then capture that one query into the cache.
  - **Result:** typed-in families get verified benefit cards, court-judged offers, a real Receipt and no banner. Keep one "Zetaris down" example to show the failure handling.

### I5. The Receipt says "all clear" when nothing was checked
- **Where:** `client/src/components/ReceiptCard.tsx:41-44`. It shows "0 items safety-checked" next to a green "all clear" whenever `recallCount === 0`.
- **Failure scenario:** leo (no purchases), every typed-in family and any run where the Recall Checker failed all show "all clear" on a safety check. The feed's own recall card says "Connect your data to safety-check your items." Showing false safety reassurance is the worst kind of wrong for this product.
- **Fix:** `itemsChecked === 0 ? 'not checked yet' : recallCount > 0 ? '… recalls' : 'all clear'`, in a neutral colour. Add a test.

### I6. No real-model evidence, and the offline learning loop runs on rule text written in advance
- **Where:** `server/agents/coach.ts:27-42`. `THEMES` holds two fixed rule sentences, and the comment on line 29 says the wording "deliberately reuses the words parents use, so the Court's offline case-law match can recognise the fine print". Also `logs/scoreboard.json` (`llmMode: offline-fallback`) and every saved trace (all `deal_hunter` / `fine_print_lawyer` lines are "model unavailable").
- **Spec:** "Decisions locked Oct 23" says "The learning demo uses the real AI (no rigged run 1)" and asks for "one saved scoreboard run with the real AI". Neither exists yet: the NVIDIA key is the blocker in the ledger.
- **Failure scenario:** A skeptical judge reads `coach.ts` and sees that three fixture complaints map to a sentence written in advance, chosen so a keyword screen will match it. The judge concludes the learning was staged. They also see that the "court debate" never happened in any committed trace. The README admits the offline mode, but not that Coach picks from two rule sentences written in advance.
- **Fix:**
  1. As soon as the key arrives, run `npm run eval` with `MODEL_*` set. Commit it as a second scoreboard (e.g. `logs/scoreboard-real-model.json`) with its learning traces, and link both in README §8.
  2. Whatever happens, add one README sentence to §6/§8: "Offline, the Coach does not write rules: when 2+ reports share a theme it proposes one of two pre-written rule sentences (`server/agents/coach.ts`, THEMES)."

### I7. The committed evidence predates the final code; the learning traces show no memory calls
- **Where:** `output_examples/learning/run1.jsonl`, `run2.jsonl` and `logs/scoreboard.json`, all generated 18:22 UTC at commit `475b5fc`/`01c031d`. Trace wiring for Zetaris and memory (`withTrace`) arrived later, in `e3bd70a`. `logs/sample/*` (18:26) do have `memory recall_rules` lines; the learning traces have no `memory` or `zetaris` lines at all.
- **Failure scenario:** The one trace that proves Meterless memory changes an outcome (run 2 blocks the offer citing `mem-1`) shows no `add_rule` and no `recall_rules` from memory. Meterless "must do real work", so this is the place where that evidence matters most. The scoreboard was also not produced by HEAD.
- **Fix:** After the fixes above, run `npm run eval` (this rewrites `output_examples/learning/`), regenerate `output_examples/*.json` and `logs/sample/*.jsonl` with no keys, and check that run 2 contains `memory add_rule` and `memory recall_rules → 1 rule(s)` before `judge … [cited mem-1]`.

### I8. Judges cannot reproduce the learning loop from the README
- **Where:** `.env.example` sets `REVIEWER_MODE_TOKEN=""`, which leaves Reviewer mode off (`bundleRoutes.ts:193`). The README never mentions Reviewer mode or how to approve a rule. §5 only lists `POST /api/feedback` and `GET /api/case-law`.
- **Failure scenario:** "Learns from parent feedback" is the main differentiator. A judge following the README can only read a saved trace; in the app the Approve button is disabled, with no explanation of how to enable it.
- **Fix:** Add a README subsection, "Try the learning loop (2 minutes)":
  1. Set `REVIEWER_MODE_TOKEN=demo` in `.env` and restart.
  2. Run maya and note that the "Free newborn diaper box" card appears.
  3. `POST /api/feedback` twice: `{"familyId":"maya","cardId":"discount-966","kind":"issue","note":"free box turned into a paid monthly membership"}`.
  4. `GET /api/case-law` to see the proposal.
  5. `POST /api/case-law/<id>/approve` with header `x-reviewer-token: demo`.
  6. Run maya again: the card is gone and the trace cites `mem-…`.
  7. Note that `data/hmem` keeps the rule. Delete that folder to reset.

### I9. On the hosted demo, every judge can end up sharing one rate limit
- **Where:** `server/index.ts:19` (`trust proxy` only when `TRUST_PROXY=1`); `bundleRoutes.ts:57-61` (10 runs per IP per 10 minutes); `bundleRoutes.ts:118` (5 runs at once, shared by all visitors).
- **Failure scenario:** Hosts like Render or Replit sit behind a proxy (a middle server that forwards visitors' requests). If `TRUST_PROXY` is left unset, every visitor appears as the proxy's address, so after 10 runs in 10 minutes all judges get a 429 ("too many requests"). Separately, one visitor can fill all 5 run slots with `?wait=true` calls; live Zetaris runs took 13–171s.
- **Fix:**
  - Write a deploy checklist in README §4 or `docs/`: `TRUST_PROXY=1`, `SAMPLE_MODE=true`, no `ZETARIS_*` keys on the host (see M8), `npm run build && npm start`. Then check from two networks.
  - Optionally cap runs per IP to 2 at a time.

---

## Minor

| # | Where | Issue and failure scenario | Fix |
|---|---|---|---|
| M1 | `orchestrator.ts:122-124`, `ReceiptCard.tsx:37-38` | Only benefit deadlines count. Maya's $20 price adjustment expires **today** (2026-10-23), yet her Receipt says "3 deadlines, next in 10 days". This is the hero family. | Include verified clawback deadlines in `deadlineCount` / `nextDeadline` (Lyndsay's product call; also check the deck). |
| M2 | `orchestrator.ts:116-121` | `moneyBackCents` sums every clawback card except DCFSA, so the ruling holds only because no other clawback type exists today. | Allow only `claim.type ∈ {fsa_reimbursement, price_adjustment}` (an explicit list, to lock the ruling in code). |
| M3 | `orchestrator.ts:69` | The comment "Fillers are only ever agent output that already passed fact-check" has been false since the I-2 ruling. A judge reading the code is misled. | Update the comment to describe the bundled `info` stand-ins. |
| M4 | `client/src/lib/bundle.ts:117, 121-128` | `isInsurance` would pin the unverified insurance filler as the top card, and `amountCaption` shows "likely benefit" on cards badged "Not yet verified". | Pin only when `verdict !== 'info'`; caption `info` cards "not yet verified". |
| M5 | `README.md:180` (§13) | "Agents never talk to Postgres directly". In live mode `defaultLoadFamily` (`orchestrator.ts:48`) and `DrizzleStore` (feedback) use Neon directly. | Reword: "Agents read all data through Zetaris; the app shell loads the family profile and saves feedback via Drizzle." |
| M6 | `README.md:30` | Scout row: "Fact-Checker rejects". The wrong-amount rejection is Scout's own check (`scripts/scout.ts:101`), and the saved Scout run uses a scripted model. | "Scout's checks (and the Fact-Checker's no-source rule) reject; the saved run uses a scripted stand-in model." |
| M7 | `vendor/hmem/` | NOTICE only; Apache-2.0 §4(a) requires a copy of the licence itself. | Add `vendor/hmem/LICENSE` (Apache-2.0 text). |
| M8 | `server/env.ts:8`, `server/bundleDeps.ts:23` | Settings load first from `../.secrets/bundle.env.local`, a file outside the repo. And `SAMPLE_MODE=true` with Zetaris keys present still runs **live**: replay happens only when keys are missing. README §6 implies SAMPLE_MODE always replays. A host given both gets slow live Zetaris. | Document it, or make `SAMPLE_MODE=true` always replay. Drop the `../.secrets` path from the public repo, or explain it in a comment. |
| M9 | `server/adapters/zetaris.ts:131` | Live runs write into the tracked `data/sample/zetaris-cache/`, so typed-in families' results pile up there. | Run `git status` before each commit, or send live writes to a git-ignored folder. |
| M10 | `server/agents/factChecker.ts:189` | The "no source" check is `sources.length > 0`, so an empty or `javascript:` URL passes. The UI hides such links, but the claim "every card has a source" is weaker than stated. | Require at least one `https?://` URL. |
| M11 | `bundleRoutes.ts:80-81`, Onboarding | Any valid date is accepted (birth date 2010, due date 2031), which produces odd feeds. Deferred from Tasks 10 and 12. | Server check: birth date within the past 2 years, due date within the next 10 months; mirror it with `min`/`max` on the form. |
| M12 | `bundleRoutes.ts:149-190` | Any visitor's notes feed the Coach, and the proposals are shown publicly on `/api/case-law`. Approval is gated, but the displayed text could be junk. | Acceptable for a hackathon; optionally show proposals only in Reviewer mode. |
| M13 | `output_examples/maya.json`, `ava.json` | They show the trap "Free newborn diaper box" approved. That is correct (state before learning) but has no explanation. | One line in README §9: "maya/ava examples are before learning; see `output_examples/learning/run2.jsonl` for the block." |
| M14 | `bundleRoutes.ts:55, 95` | `knownFamilies` grows without limit (deferred). | Leave, or cap it like `runs` (MAX_REGISTRY). |

---

## Cross-task interface check (passed unless noted)

- **Orchestrator ↔ agents:** the `findClawbacks`, `checkRecalls`, `planBenefits`, `judgeOffers` and `revise` signatures match. `benefits.revise` is called with `deps.today`.
- **Orchestrator ↔ routes:** `runBundle(family.id, {…base, runId, loadFamily})` matches. `GET /api/runs/:id` returns `today` and `demoDate`, which the UI uses for the "Demo date" label.
- **Routes ↔ UI:** the `BundleReceipt` fields match `ReceiptCard`. The `VERDICT_LABEL.info` text "Not yet verified" matches the filler meaning. The section label is wrong (I2), and so is the "all clear" text (I5).
- **Never-empty:** passes when every agent fails (`custom-family.json`: 9 cards). Minimums are met from bundled fillers; the honesty issues are I1 and I2.
- **Receipt honesty:** the DCFSA card is excluded from both totals and `info` cards are excluded from the dollar totals. Not yet from the deadline count (I1).
- **SAMPLE_MODE:** replays raw Zetaris rows keyed by a sha256 hash of the SQL. All agent logic, fact-checks and court screens run live. Confirmed in `logs/sample/maya.jsonl` (25 `query_cached` lines, 15 `fact_checker verify` lines).

## Judge run-through (README)

- `cp .env.example .env && npm ci && npm run dev` is enough: no `DATABASE_URL` is needed (`server/db.ts` is imported only when needed), and H-MEM has no runtime dependencies. Port 5050 matches everywhere.
- **Not verified here:** a true clean-clone run on another machine. Do the Tuesday clean-setup test (spec timeline) from a fresh `git clone` with no `../.secrets` folder present (M8).
- **Gaps:** the learning loop (I8), typed-in families (I4) and real-model evidence (I6).

---

## Deferred minors from `progress.md`: triage

| Task | Deferred minor | Decision | Why |
|---|---|---|---|
| T1 | README port | Leave (done) | README and `.env.example` say 5050 |
| T1 | Unused dependencies | Leave | Harmless; maybe trim after the hackathon |
| T1 | `db.ts` throws without DATABASE_URL | Leave (done) | Imported only when needed, so SAMPLE_MODE never imports it |
| T1 | No automated health test | Leave | `/api/health` is trivial |
| T1 | gitignore carryover | Leave | Current `.gitignore` is correct |
| T2 | `seed.ts:357` semicolon in comment | Leave | Cosmetic |
| T2 | 3-day price-window margin | Leave | The demo date is pinned |
| T2 | Offer URLs not fetched / example.com trap URL | Leave | Disclosed in `data/README.md:13` |
| T2 | Poverty figures not re-verified | Leave | Disclosed (README §11, data README) |
| T2 | Maya's daycare payments predate the birth | Leave | Plausible (older sibling) |
| T2 | Seed tests depend on order | Leave | Test hygiene only |
| T3 | `register.ts` password replace (split/join) | Leave | Only the redacted SQL is printed; error text masks the first match |
| T3 | Trace fields filled by the real TraceLogger | Leave (done in T4) | |
| T3 | Stale dry-run cache | Leave | Goes to a temporary folder |
| T3 | SAMPLE_MODE cache misses go live | **Fix now (via I4)** | The cause of typed-in families failing in SAMPLE_MODE |
| T4 | Income redaction misses number-before-word | Leave | No income value ever reaches a trace input (guests have `null`, the SQL holds only column names) |
| T4 | askJson: no retry on a transient ModelUnavailable | Leave | Falls back to deterministic text |
| T4 | TraceLogger mkdir outside try | Leave (done) | Now inside the try (`trace.ts:60-61`) |
| T4 | runId not cleaned before use in the filename | Leave (done) | Cleaned (`trace.ts:41`); run ids are random UUIDs |
| T4 | OpenAI client timeout wiring untested | Leave | Only matters with a real key; check during the I6 run |
| T4 | 20000 default repeated ×3 | Leave | Cosmetic |
| T4 | runId punctuation collisions | Leave | Not an issue with UUIDs |
| T5 | Missing source deadline/amount passes | Leave | Low; card values come from the same table |
| T5 | Empty id → 0 queried | Leave | `intId` returns null for empty input |
| T5 | Clawback refund amount not verified | Leave (done in T6) | `price_adjustment` re-derives it on its own query path |
| T5 | Live smoke of qualifiers/FDA | Leave (done) | Live cache captured |
| T6 | DCFSA claim carries only the latest payment | Leave | The verifier sums by plan year |
| T6 | Generic FDA URL | Leave | Goes to the FDA recall portal; mention in data README if time allows |
| T6 | itemsChecked filter test checks SQL text only | Leave | Covered by eval (`duplicate` trap) |
| T6 | Pair-query row limit unchecked | Leave | 1000-row limit; the sample data is tiny |
| T7 | askJson retry → 4 calls on bad JSON | Leave | Cost only |
| T7 | Loose trigger matching | Leave | `wholeWord` limits it |
| T7 | Missing tests (made-up cited ids, approve traces) | Leave | Made-up ids are filtered (`finePrintCourt.ts:128`) |
| T7 | Offline reason text on bad JSON | Leave | Folds into I3's wording fix |
| T8 | "(after birth)" suffix on no-deadline cards | Leave | Accurate wording |
| T8 | `revise()` re-runs the whole plan | Leave | Cost only |
| T9 | Banner shows on code bugs too | Leave | Safe (it errs toward caution) |
| T9 | A few tests missing | Leave | |
| T9 | **Receipt deadlineCount counts `info` fillers** | **Fix now (I1)** | Breaks the Receipt-honesty ruling |
| T10 | knownFamilies/log growth | Leave (M14) | Bounded in practice by the rate limit |
| T10 | Approve race | Leave | `alreadyApproved` path; at worst a duplicate memory row |
| T10 | Date range checks | **Fix now (M11)** | Cheap, and judges try odd inputs |
| T10 | NODE_ENV=production on deploy | **Fix at deploy (I9)** | `npm start` sets it; add it to the deploy checklist |
| T10 | Drizzle feedback path smoke | Leave | Exercised live in T12/T13 |
| T10 | Coach "uncovered" filter applied after LIMIT | Leave | Edge case past 40 issues |
| T10 | 503 test uses a fixed 300ms wait | Leave | Test flakiness only |
| T12 | No focus/title change on route change | Leave | Accessibility nicety |
| T12 | Onboarding date min/max + day-boundary today | **Fix now (with M11)** | Same change as the server check |
| T13 | Broad Coach auto-renew pattern | Leave, but **disclose (I6)** | The reviewer gate limits the damage; the README must name the fixed THEMES |
| T13 | demoDate from expected.json | Leave (done in `01c031d`) | Uses `resolveToday` |
| T13 | `upsertScoutRows` not connected | Leave | README says Scout "proposes"; see M6 wording |
| T14 | Cache timestamps are file modification times | Leave | Disclosed (`data/README.md:15`) |
| T14 | Column name `annual_income_cents` in logged SQL | Leave | A column name, never a value |

## Suggested order before submission

1. C1 (Cursor wording, and confirm with HackOS).
2. I1, I5, I2, I3: small code and text changes, each with a test.
3. I4 (guest path in SAMPLE_MODE), then capture any new cache entries live.
4. M11 date range, M2, M3, M4, M7.
5. README: I6 disclosure sentence, I8 learning-loop steps, I9 deploy checklist, M5, M6, M13.
6. When the NVIDIA key arrives: a real-model eval run (I6).
7. Regenerate all evidence at final HEAD (I7): `npm run eval`, the output examples and `logs/sample` with no keys. Then do the clean-clone test from a fresh folder.

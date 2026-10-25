# Bundle v2 code map (read-only investigation, 2026-10-25)

Root: `/Users/lyndsay/Documents/hackathon/bundle`. All paths below are relative to that folder unless they are absolute. Stack: React 18, wouter and Tailwind on the client; Express, Drizzle/Postgres (Neon), Zetaris SQL views and vendored H-MEM (Meterless) memory on the server. Routes (`client/src/App.tsx:54-58`): `/` Onboarding, `/feed/:runId` Feed, `/card/:id` CardDetail, `/smarter` Smarter, plus a not-found page.

## 1. Onboarding screens
- **Component:** `client/src/pages/Onboarding.tsx` (216 lines). Helpers: `client/src/lib/onboarding.ts` (stateForZip, zipMessage, babyAgeLine, COVERED_STATES) and `shared/dateRange.ts`.
- **3 questions** (`Step = 1|2|3`, labels "1 of 3", "2 of 3", "Last one", at :11-15):
  1. "Where are you right now?" with two choices, "We're expecting" and "Baby's here" (:138-142). The "Try a sample family" button starts `{familyId:'maya'}` (:145).
  2. A date screen: "When's your baby due?" or "Congrats! What's your baby's birthday?" (:159). It shows a baby-age line and checks the date range.
  3. "Where do you live?" with a 5-digit ZIP (:193). Submitting calls `api.startRun` and goes to `/feed/:runId` (:103-104).
- **How answers are stored:**
  - Nothing is saved on the client except the run. The request type is `RunRequest = {familyId} | {zip, birthDate?, dueDate?, employer?}` (`client/src/lib/bundle.ts:246`).
  - The server builds an in-memory guest `Family` in `server/routes/bundleRoutes.ts:190-196`: `id: guest-<hex>`, `householdSize: 3`, `annualIncomeCents: null`, `dcfsaOffered: true` (hard-coded), `dataConnected: false`.
  - Guest families are **not** written to the `families` table. Only the finished run is saved, as jsonb in `run_results` (`shared/schema.ts:212-219`). The client copies the run to sessionStorage (`bundle.ts:280-291`).
  - The `Family` type is at `shared/bundle.ts:55-60`. The `families` table is at `shared/schema.ts:18-32` and has `employer text`, `household_size`, `annual_income_cents`, `dcfsa_offered`, `data_connected`.
- **Employment and insurance type:**
  - The only employment-related fields are `employer` (free text, not used in any decision; the onboarding screen never sends it) and `dcfsaOffered` (boolean).
  - **No insurance-type field exists anywhere.** "Insurance" appears only as the `INSURANCE_ADD_BABY` rule (card id `benefit-insurance_add_baby`, `server/agents/orchestrator.ts:31`), the Insurance tab, and the id regex in `client/src/lib/tabs.ts:27`. Nothing covers employment type either (W-2, self-employed, and so on).
- **Spec vs. code:** `plans/onboarding-spec.md` §2.4 still describes an optional 4th "Work benefits Yes/No/Not sure" screen. `design/onboarding/README.md` records that this work question was **dropped on Oct 24** (3 questions; the Dependent Care FSA became a "Check with your job" card for everyone).
- **Difficulty to add employment or insurance questions: medium.**
  - The UI is small: add a Step 4 to the `PROGRESS` map.
  - You would also need to widen `RunRequest`, the server checks in `resolveFamily`, the `Family` type, the `families` schema plus a migration (`migrations/0000_init_bundle_v3.sql`), and the Zetaris view `v_family_profile` (`scripts/zetaris/register.ts:76`, `familyProfileSql` in `server/agents/savedVerdicts.ts`). Then the benefits and eligibility agents have to actually use the new fields.
  - Risks: the SAMPLE_MODE replay cache is keyed by the sha256 of the exact SQL text (`server/adapters/zetaris.ts:58`), so changing the profile SQL breaks replay until you re-record with `npm run zetaris:record`. Sample families in `families.json` would also need the new fields.

## 2. "We're checking for you" (ParentProgress)
- **Location:** `client/src/pages/Feed.tsx:91-113`.
  - Heading (:94-95): "We're checking for you." (the last two words are coral).
  - Subtitle (:98): "We are checking government, recall and store information for your family. This is often quick, and can sometimes take a minute or two."
  - Before any step arrives, it shows a spinner with "Getting started…" (:101) and an elapsed "Ns" counter (:110).
- **Checklist lines, verbatim.** The server copy is `PARENT_STEPS` in `server/routes/bundleRoutes.ts:115-120`; the client copy is `stepsFromStream` in `client/src/lib/stream.ts:153-159`. The wording is the same:
  1. "Money you can get back"
  2. "Your items vs. official recall lists"
  3. "Programs and deadlines for your family"
  4. "Deals, read for hidden catches"
  5. "Every card double-checked against its source"
- **Status pills** (shown only while there are no steps; `stream.ts:130-136`): for example "Looking for money you can get back…", "Checking recalls…", "Reading the fine print on deals…", "Double-checking each card against its source…".
- **Owner (reviewer-code) version:** `Progress` at `Feed.tsx:116-157`, headed "Your agents are on it." with agent-named steps at :16-22 (for example "Clawback Finder: money you can get back") and live activity.
- **Live cards** appear under the checklist while the run is going (`LiveCards`, :78-88), with "From your last check. We're updating these now…".
- **Auto-redirect: there is no navigation.** When the run finishes, `onDone` calls `saveRun` and `setRun` (`Feed.tsx:212-216`), and the same route re-renders as `<VersionB>` (:255-262). The URL stays `/feed/:runId`. Errors show "That didn't work." with a "Start again" link (:234-241).
- **Difficulty:** small to change the copy. Keep the server and client step lists in sync (they are duplicated). `Feed.test.tsx` asserts on this wording.

## 3. Home headline money total
- **Calculation:** `homeTotals()` in `client/src/lib/tabs.ts:53-61`. `totalCents = result.receipt.moneyBackCents + result.receipt.likelyBenefitsCents`, which is the server's receipt from `assembleFeed` in `server/agents/orchestrator.ts:184-198`.
  - **Money back** = clawback cards whose claim type is `fsa_reimbursement` or `price_adjustment` and whose verdict is verified or likely.
  - **Benefits** = the sum of `amountCents` on every verified or likely `benefit` card.
  - Free gifts are kept separate (`giftsCents`, :57). Blocked and "info" (unverified stand-in) cards are never counted.
- **Display:** `client/src/pages/tabs/HomeTab.tsx:52-58`. The 56px number has the eyebrow "Your family could get" (or "Waiting for your family" when expecting) and the sub-line "in savings and tax credits", plus ", plus $X in free gifts". The "How we got this number" breakdown is in `client/src/pages/tabs/Extras.tsx:87-122`.
- **Is there a field for cash/FSA vs. tax credit vs. paid leave? No.**
  - `FeedCard` (`shared/bundle.ts:4-10`) has only `kind: 'clawback'|'recall'|'discount'|'benefit'|'coming_soon'` and `verdict: 'verified'|'likely'|'all_clear'|'info'|'blocked'`.
  - The server-only `Candidate.claim.type` (`'rule'`, `'fsa_reimbursement'`, `'price_adjustment'`, `'offer'`, `'recall'`; see `server/agents/types.ts:94`) is dropped when a candidate becomes a card.
  - The client works out the category with **id regexes**: `tabForCard` (`tabs.ts:23-30`) sends `/insurance|_pfml?$|_pfl$/` to Insurance and `/tax_credit|dcfsa/` to Taxes, and everything else falls to Savings. `Extras.tsx:88-89` uses `/tax_credit/` and `/trump_account/`.
  - Card ids come from rule codes as `benefit-${code.toLowerCase()}` (`server/agents/benefits.ts:127`). Codes: `TRUMP_ACCOUNT` ($1,000 deposit, not cash to the parent), `FEDERAL_CHILD_TAX_CREDIT` ($2,200 from `tax-parameters.json`), `INSURANCE_ADD_BABY` (null), `DCFSA_LIFE_EVENT` (null, check with your job), `MA_CHILD_TAX_CREDIT` ($440), and `MA_PFML`, `NY_PFL`, `CA_PFL` (paid leave, amount null). Clawback ids are `clawback-fsa-*` and `clawback-price-*`. Fallback stand-ins are `fallback-benefit-*` and `fallback-offer-N`.
  - The `benefit_rules` and `state_programs` tables have no category column either (`shared/schema.ts:69-80`, `:233-244`).
- **Difficulty to split the total: small to medium.**
  - Client-only: group `homeTotals.parts` by id regex. Quick, but fragile.
  - Proper: add a `category` field (cash | tax_credit | account_deposit | leave | money_back) to `FeedCard`, set it in benefits.ts, clawback.ts and fallback.ts, and pass it through `toCard`.
  - Risks: the receipt rule is copied in both orchestrator.ts and tabs.ts. Tests in `server/__tests__/orchestrator.test.ts`, `runResults.test.ts` and `client/src/lib/__tests__/tabs.test.tsx` lock it. Saved `run_results` and the session-cached runs would not have the new field.

## 4. Photo upload
- **Client:** `client/src/components/AddPurchaseButton.tsx` (the "+" in the VersionB header, `VersionB.tsx:57`). It opens a "Take a photo" sheet where you pick "An item" or "A receipt".
  - `client/src/lib/photoPrep.ts` redraws the picture as a JPEG on a canvas (this strips location and phone details) and posts base64 to `POST /api/photo/read`.
  - Result text comes from `describeReading` (:24-32): "Added N items: …" or "We already had …". A "Check my new items" button starts a **new full run** with `{familyId}` (:75-84).
- **Server route:** `server/routes/photoRoutes.ts:53-78`. It returns only product facts.
- **The photoReader agent is `server/ingest/photo.ts`** (trace name `photo_reader`; there is no separate agent file).
  - It extracts `productName`, `brand`, `modelNumber`, `lotCode`, `upc`, `sizeText`, `store`, `purchasedOn`, `priceCents`, `quantity` and `confidence` (`ReadItem`, :65-77; prompt shape at :167).
  - Plain-code checks (`checkReading`, :89-153) cover the UPC check digit, code shape and "code must appear in readText". The model gets one retry, then the parent is asked for a clearer photo (:299-316).
  - The model call goes through `see()` in `server/adapters/llm.ts` (NVIDIA vision). SAMPLE_MODE replays answers from `data/sample/vision-cache/<sha256>.json`; that folder holds only a README, so photo reading in sample mode returns "needs the live model" (:338-340).
- **Where the image bytes are wiped:** `server/ingest/photo.ts:360`, `input.bytes.fill(0)` inside the `finally` of `readPhoto` (:332-362). The recorder takes the hash before the wipe (:369).
- **`purchase_items` table: exists.**
  - Defined at `shared/schema.ts:136-157` and in `migrations/0000_init_bundle_v3.sql:135`.
  - Columns: `id` serial, `family_id`, `source` (email | barcode | photo_item | photo_receipt), `store`, `seller`, `purchased_on`, `product_name`, `brand`, `model_number`, `lot_code`, `upc` varchar(14), `size_text`, `quantity`, `price_cents`, `confidence` real, `extractor`, `input_hash`, `line_index`, `created_at`.
  - It has a unique constraint on (family_id, input_hash, line_index).
  - Storage: the DB store is at `photo.ts:222-239`; a memory store is used in SAMPLE_MODE or when there is no DATABASE_URL (`photoRoutes.ts:23`). "Forget my items" calls `POST /api/photo/forget` and deletes **all** of the family's purchase_items rows.
  - Agents read the table through the Zetaris view `v_purchase_items`.
- **The photo flow emits no cards itself.** Cards only appear after "Check my new items" starts a new run. In that run, if there are no recall matches, `assembleFeed` (`orchestrator.ts:164-167`) adds:
  - `recall-all-clear` (kind recall, verdict `all_clear`): "We checked N items: all clear." (COPY at :25-29).
  - Or, with no items, `recall-no-purchases` (info): "Connect your data to safety-check your items."
  - A clawback info card is also added when there are no clawbacks: "Nothing to claw back: you're doing great." or "No money to claw back yet. Connect a card or upload Amazon orders."
  - Two coming-soon tiles: "Pre-filled applications" and "We'll watch for price drops".
  - Inline guest families (typed in on onboarding) get **no** recall query (`server/agents/recall.ts:270-273`, `isInlineFamily`). So photos added by a guest are never checked by a rerun unless the guest family id is persisted.
- **Difficulty to show per-photo results (for example "no recall found for X") right away: medium.** You would call the recall matcher (`server/agents/recallMatch.ts`) directly from the photo route, or return a mini result. Risks: the PII guarantees in photo.ts, rate limits, and the Zetaris cache keys.

## 5. "I got this" / "Not relevant"
- **"Not relevant" does not exist anywhere** in the client, server or data.
- **"I got this" exists in two places, and they are not connected:**
  1. **Tab cards:** a checkbox labelled "I got this" in `client/src/components/FeedCardView.tsx:110-117`.
     - It is shown only for `claimableCards` (`tabs.ts:120-122`): counted money-back or benefit cards (excluding check-with-your-job cards) plus non-blocked gifts.
     - The toggle is in `VersionB.tsx:41-43`. It is stored **only in localStorage** under `bundle:claimed:<familyId>` (`tabs.ts:124-136`).
     - Home uses it for "X of Y done", "$ claimed" and the progress bar (`HomeTab.tsx:25-29, 65-74`), and the ShareBar appears once claimed > 0 (:117). The total includes 1 free "See what you qualify for · Done!" item.
  2. **Card detail page:** "I got this" and "Report issue" buttons in `client/src/pages/CardDetail.tsx:187-225`. `send('got_it')` posts to `POST /api/feedback` (`server/routes/bundleRoutes.ts:298`) and writes the `feedback` table (`shared/schema.ts:94-101`, kind enum `got_it | issue`). It shows "Nice. We've marked this one as done for you." but **does not** update the localStorage claims, so the two can disagree. "issue" reports feed the Coach (`server/agents/coach.ts`) and become case-law proposals.
- **Claimed state:** only the localStorage boolean map and the got_it rows in `feedback`. There is no server-side per-card status (claimed, dismissed, completed).
- **Quick-win or time-estimate field:**
  - Only on **deal cards**: `ValueScore.effortMinutesEstimate {min,max}`, `effortLevel`, `stepsCount`, `payoutWaitDays`, `timeLabel` and `worthYourTime` (`shared/bundle.ts:22-36`). They are shown as "About N minutes of effort, …" (`tabs.ts:182-190`). The `offer_checks` table has matching columns (`effort_minutes_estimate`, `steps_count`, `effort_level`).
  - Benefit, clawback and recall cards have **no** effort or time field. "Do these first" (`tabs.ts:83-96`) is driven only by deadlines within URGENT_DAYS.
- **Difficulty:** adding "Not relevant" with localStorage only is **small** (copy the claims pattern and filter cards). Making it reach the server or teach the Coach is **medium**: add `not_relevant` to the feedback kind enum (schema enum plus migration plus the route check at bundleRoutes.ts:302 plus `v_coach_feedback`). Unifying the two "I got this" paths is small.

## 6. Deals tab
- **File:** `client/src/pages/tabs/DealsTab.tsx`.
  - Header (:17-21): "$X in free gifts" or "Deals checked for you", with the sub-line "Every offer read for fine print. Anything with a catch gets blocked."
  - Sections: checked deals, unchecked deals (`UNCHECKED_DEALS_SECTION`), and "We caught these for you" / "Blocked by Bundle" (:29-45).
- **Where offers come from:** the `offers` table, seeded from a static list in `scripts/seed.ts` (around :100), read **through Zetaris**: `SELECT id, title, store, min_age_days, max_age_days, trigger_keyword, value_cents, fine_print, source_url FROM bundle_pg.v_judge_offers ORDER BY id` (`server/agents/finePrintCourt.ts:245-257`).
  - Age-window and purchase-keyword filtering happen in code (:259-263), capped at MAX_OFFERS.
  - The sample replay answer is `data/sample/zetaris-cache/061e925e….json` with **16 offers** (ids 1313-1328: Amazon, Target, Walmart, Pampers, Babylist, Cuddle & Co trap, Huggies, Enfamil, Similac, Buy Buy Baby, Honest, Costco, Chewy and others).
  - Short feeds are topped up from `data/sample/fallback-offers.json` (5 offers; `server/agents/fallback.ts:45`).
- **Current copy:**
  - "Likely a good deal." comes from `finePrintCourt.ts:217` (fresh grade) and `:331` (reused saved grade): "`${store} has an offer worth about $X. Our fine-print check found nothing that makes it costly. Likely a good deal. ${eligibilityText}`".
  - **"Fits babies up to 12 months old."** comes from `eligibilityText()` in `server/agents/sql.ts:62-65`. It is `max_age_days/30.4`, and the comment says it is NOT an end date. The feedback's "good fit for 12 months" is this line.
  - An approval with a catch reads "…after the catch. Approved with a catch: … Only the true value is counted." (:216).
  - The offline line is "No flagged terms found. We couldn't fully check this offer's fine print." (:60). The client rewrites it in `plainCardBody` (`tabs.ts:158-160`).
- **DealHunter and FinePrintLawyer are not separate agents.** They are roles inside `argue()` in `finePrintCourt.ts:74-96` (trace names `deal_hunter` and `fine_print_lawyer`, plus `judge`), called from the private `judgeOne()` (:122ff).
  - The Deal Hunter prompt (:80) is "argue why this offer is a good deal for a new parent".
- **Can they judge arbitrary pasted text?** Not today. No route accepts text, and `judgeOne` and `argue` are not exported; they expect an `Offer` (`{id, title, store, finePrint, minAgeDays, …}`) plus `AgentContext` (llm, trace, memory, workspace).
  - The **code-only** screen `checkFinePrint(text, {today})` in `server/agents/finePrintRules.ts:145` (exported) works on any string. So does `offlineProblem(text)` in `server/agents/offerScreen.ts:14`.
- **Difficulty for a "paste an offer" checker: medium.**
  - Export a `judgeText()` wrapper that builds a synthetic Offer and context, and add a rate-limited POST route.
  - Risks: prompt injection (the court already has `injectionDetected` / `prompt_injection` handling), offer_checks write-back must be skipped for pasted text, and the SAMPLE_MODE LLM is unavailable so it would fall back to the code-only screen.

## 7. Account tab
- **`AccountTab.tsx` does not exist.** The tabs are `HomeTab`, `TaxesTab`, `SavingsTab`, `InsuranceTab` and `DealsTab` (`client/src/pages/tabs/`). `TabId` (`tabs.ts:8`) is `home | taxes | savings | insurance | deals`, and `TabBar.tsx` shows those five.
- **The nearest things are on Home** (`Extras.tsx`):
  - `SaveListCard` (:34-44): a "Demo: not built yet" card with a disabled "Continue with Google (coming later)" button.
  - `ForgetItemsCard` (:47-84).
  - The `/smarter` page (`client/src/pages/Smarter.tsx`): case-law proposals and approved rules. Rule text is visible only with the reviewer code; the scoreboard is owner-only.
- **Meterless memory:** vendored at `vendor/hmem/src` and wrapped by `server/adapters/memory.ts` (`BundleMemory`).
  - IDs are `mem-${++seq}` (`vendor/hmem/src/memoryStore.ts:71`).
  - Persisted at `data/hmem/state.json` (seq 155; **155 records: 148 short-term workspace notes and 7 long-term grading lessons**, for example mem-95, mem-99, mem-103, mem-111, mem-115, mem-127, mem-131) and `data/hmem/ledger.jsonl` (1,088 lines).
  - Methods: `addRule`, `recallRules(query)` (search, which skips workspace and lesson tags), `addNote` / `notesForRun(runId)`, `addLesson` / `recallLessons`, `feedback(id, helpful|not_helpful|wrong)` and `exportLedger`. There is also `hmem.store.all()`, used inside `notesForRun`.
  - **No HTTP API lists memories.** Memory reaches the client only through:
    - `/api/case-law` (proposals carry `memoryId` once approved; the approve route at `bundleRoutes.ts:348-365` calls `memory.addRule`).
    - The owner-only `/api/scoreboard` (reads `logs/scoreboard.json`).
    - The owner-only `/api/runs/:runId/agent-log` and trace lines.
    - `MemorySection` in `client/src/components/HowWeCheckedSections.tsx`, which reads `rule_recalled` trace lines.
- **Difficulty for an Account tab: medium.** Add a TabId, a TabBar entry and a new screen. A read-only "what Bundle remembers" view needs a new `GET` route that filters `hmem.store.all()` to long-term records and owner-gates rule text. The no-sign-in, guest-only model means nothing ties to a user.
  - Risks: memory content includes run ids and offer text, and workspace notes are per-run, so they must be filtered.

## 8. AppShell
- **File:** `client/src/components/AppShell.tsx`. It takes an optional `back={{href,label}}` prop and renders "‹ label" (:44-48). `backClick` uses history.back when the previous page matches (:8-15). The header has a "bundle." wordmark linking to `/`, the family chip and an action slot.
- **Back links in use:**
  - CardDetail: "Your feed" (:110) and "Back" (:79, :84).
  - Smarter: "Your feed" or "Home" (:69).
  - Onboarding steps 2-3 have their own back chevron (`Onboarding.tsx:28-31`).
  - The VersionB tabs and Feed have **no** back link.
- **"Start over with your own details"** is rendered in `client/src/pages/tabs/VersionB.tsx:70-74`, only on the Home tab: a `<Link href="/">` underlined text link. It shows for every run, not only sample runs. VersionB also renders the demo-date note (:60), "…Sample families are checked as of this date…", and `result.banner` (:61-63).
- **Difficulty:** small to limit it to sample runs (check `run.demoDate` or `familyId` against the seed ids) or to move it.

## 9. Tests
- **Framework: Jest 30 + ts-jest only.** Vitest and Playwright are not installed: there is no `@playwright` in node_modules and no `playwright` binary.
  - `jest.config.cjs` defines two projects: `server` (node env, `server/__tests__/**/*.test.ts`) and `client` (jsdom, `client/src/**/__tests__/**/*.test.tsx`, React Testing Library 16 and `@testing-library/dom`).
  - `vendor/hmem/test/smoke.test.ts` sits outside both projects.
  - The `agent-browser` CLI is installed globally (`~/.nvm/.../bin/agent-browser`) and there is an agent-browser skill, but it is not wired into the repo.
- **Run:** `npm test`, which is `NODE_ENV=test npx jest --maxWorkers=1`.
  - DB tests need `npm run db:test` (local Homebrew postgres@16, DB `bundle_test`; `scripts/db-test-setup.sh`) and a test DB URL. They appear to skip without one (`offerChecks`, `schema`, `photoDb`, `register`, `runResults`).
  - Evals: `npm run eval` (`scripts/eval.ts`, `evals/expected.json`).
  - Type check: `npm run check` (tsc).
- **Count:** 66 test files (47 server + 19 client), about 894 `it(` / `test(` cases by grep (about 719 server, 175 client). Test code is about 10.7k lines. These are grep counts; the suite was not run.
- **Browser/e2e:** none. Client tests render components in jsdom, for example `Onboarding.test.tsx` (11 cases), `Feed.test.tsx` (12), `VersionB.test.tsx`, `CardDetail.test.tsx` and `AddPurchaseButton.test.tsx`. Nothing clicks through a real browser.
  - Past manual smoke screenshots are in `/Users/lyndsay/Documents/hackathon/progress/reviews/w6-smoke/` and `bundle/docs/screens/`.
- **Other package.json scripts:** dev, build, start, db:push, db:studio, db:generate, record-vision, zetaris:record, seed, model:check, eval:live-model, examples:regen.
- **Difficulty to add Playwright e2e: medium.**
  - You would install `@playwright/test` plus browsers (a download, which needs approval).
  - The app has to run on port 5050 with `SAMPLE_MODE=true` (the sample family flow is deterministic, with `DEMO_TODAY=2026-10-23` at `server/demoDate.ts:9`).
  - Keep e2e specs out of Jest's testMatch.

## 10. Graded offers database/API
- **Table `offer_checks`:** `shared/schema.ts:163-209`, `migrations/0000_init_bundle_v3.sql:66`. One row per judged offer, no family column. Columns cover:
  - identity: offer_id, store, source_url, fine_print_hash, checked_at, agent, model
  - money: face, hidden, true, min_purchase, auto_renew, renewal_price
  - dates: deadline_date, expired, claim_window_days, payout_wait min/max
  - effort: steps_count, effort_level, effort_minutes_estimate, mail_in, needs_receipt, needs_phone_call, account_required
  - availability: limited_stock, regions_excluded
  - judgment: catch_types, verdict, status, rule_citations, catch_summary, evidence_quote, injection_detected
  - recall: recall_status, recall_ids, recall_checked_at
- **Writes:** `server/agents/offerChecks.ts` (`createOfferCheckWriter`), only when the court's sides **agree** (`finePrintCourt.ts:284-285`) and never in sample runs (`RunDeps.offerChecks` absent).
- **Zetaris views** (`scripts/zetaris/register.ts:32-78`):
  - `v_offer_verdicts` gives the latest grade per offer and powers grade reuse via `savedVerdictsSql` in `server/agents/savedVerdicts.ts`.
  - `v_offer_audit` gives per-store `offers_checked`, `offers_caught` (verdict <> 'approve'), `catch_rate`, and average face, true and effort values.
- **Public API:** `GET /api/offer-audit[?store=]` in `server/routes/offerAuditRoutes.ts:87-110`, with the OpenAPI spec in `docs/openapi/offer-audit.yaml`. **No client screen calls it.**
- **Sample data:**
  - The cached `v_offer_audit` answer (`data/sample/zetaris-cache/78a2ecc5….json`) has **0 rows**, so sample mode returns `status:'none'`.
  - The 7 H-MEM "lesson" memories echo grades (approve, approve_with_catch, reject) for Amazon, Target, Walmart, Pampers and Babylist.
  - `data/sample/fine-print-cases/cases.json` has 15 eval cases.
- **Parent feedback counts:** the `feedback` table (got_it/issue) and `case_law_proposals.source_feedback_ids`. `recallRules` returns `reports = provenance.refs.length` (`server/adapters/memory.ts:66`). No per-offer feedback count is exposed or joined to offer_checks.
- **Difficulty for a "graded offers" UI: medium.** The API exists, but there is no sample data to show. You would need to record a real run and the `zetaris:record` replay, or seed offer_checks. Adding feedback counts per offer needs a new view and a migration.

## 11. Lines of code (excluding node_modules)
- Everything in client, server, shared, scripts and migrations (.ts, .tsx, .css, .sql, .sh) is **about 28.7k lines**. That splits into:
  - about 10.75k test lines
  - about 4.7k generated shadcn `components/ui`
  - **about 13.2k hand-written app code**
- `vendor/hmem` TypeScript adds about 1.3k.
- All text files (code, md, json, html, csv, jsonl), excluding node_modules, dist, logs, the zetaris-cache and package-lock, come to **about 52.7k lines**. `logs/` is 11 MB of run ledgers, and `package-lock.json` is 315 KB.
- **The "70,000+" claim does not hold for code.** It is only reachable by counting logs, the cache, the lockfile or generated data.

## 12. Sample-mode fixtures
- **Location:** `data/sample/`:
  - `families.json`, `amazon-orders.csv`, `purchase-items.json` (11 receipts with 11 items)
  - `fallback-offers.json` (5), `fallback-rules.json` (4 federal rules), `state-programs.json` (MA_CHILD_TAX_CREDIT $440, MA_PFML, NY_PFL, CA_PFL), `tax-parameters.json` (CTC $2,200, DCFSA limits), `zip3-states.json`
  - `fine-print-cases/cases.json`, `saved-pages/*.html`
  - `zetaris-cache/` (210 recorded answers keyed by the sha256 of the SQL text)
  - `vision-cache/` (empty apart from a README)
- Also `data/hmem/` (memory state). Loaded by `loadSampleFamily` (`server/agents/orchestrator.ts:52-57`). `DEMO_TODAY = 2026-10-23` (`server/demoDate.ts:9`).
- **Sample families** (`data/sample/families.json`), 6 in total:

| id | status | ZIP | state | age on 2026-10-23 | notes |
|---|---|---|---|---|---|
| **maya** (the "Try a sample family" button) | born 2026-10-03 | 02139 | MA | about 20 days | employer "Northwind Robotics", dcfsaOffered true, dataConnected true |
| leo | due 2026-12-07 | 02446 | MA | expecting | no data |
| ava | born 2026-08-24 | 43215 | OH | about 2 months | data connected |
| noor | due 2026-12-14 | 11201 | NY | expecting | |
| cal | born 2026-09-29 | 94110 | CA | about 3.5 weeks | |
| fern | born 2026-10-10 | 33101 | FL | about 2 weeks | uncovered state |

- `data/sample/README.md` is out of date: it says there are 3 families and mentions `plaid-transactions.json`, which is not present. Its planted traps include a Frida thermometer FSA case, a Graco Pack 'n Play price drop, a duplicated Walgreens charge, a KEAWIS crib mattress matching CPSC recall 10560, and the Cuddle & Co auto-renew trap offer.

## Cross-cutting risks
1. **SQL-keyed replay cache.** Any change to Zetaris SQL text breaks sample replay until you re-record it (`npm run zetaris:record` needs live Zetaris credentials).
2. **Duplicated logic.** The receipt rule lives in both the server and `tabs.ts`, and the step labels live in both `bundleRoutes.ts` and `stream.ts`. Change both together.
3. **Guest families are not persisted.** Photo items for a guest are not re-checked by recall, and nothing ties claims to an account.
4. **Category by regex.** The client decides card categories from id patterns, so new benefit codes need matching tab and total regexes.

null

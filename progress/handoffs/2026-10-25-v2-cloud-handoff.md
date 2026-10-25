# Handoff: V2 build, Mac → cloud (Oct 25, 2026)

## Where things stand
- **Planning is done and pushed to `main`.** Nothing in the app code has changed yet.
- **Build from:** `plans/v2-build-plan.md` (revision 2). Read section 1 (change log and what was removed) and section 4 (build order).
- **What it should look like:** `design/v2/index.html` (clickable mockups) and `design/v2/screens/*.png` (screenshots of each story). `design/v2/README.md` maps screens to stories.
- **What "done" means:** 21 acceptance tests in `bundle/client/src/__acceptance__/v2/`. They all fail today, on purpose. Run them with `cd bundle && npm run test:v2`. The exact button names, text and request shapes the code must match are in `progress/reviews/v2-acceptance-tests.md`.
- **Background, read only if needed:**
  - `plans/v2-feedback-response.md` (the reasons behind each choice)
  - `progress/reviews/v2-code-map.md` (where things are in today's code, with line numbers)
  - `research/v2-*.md` (facts and sources)

## Rules for the cloud session
1. **Follow** `CLAUDE.md`, `AGENTS.md` and `.claude/lyndsay-global-instructions.md`.
   - Lyndsay is non-technical, so use plain English.
   - Use fictional data only.
   - Never print or commit secrets.
2. **Keys** come from the cloud environment's settings, not the repo.
   - `TAVILY_API_KEY` should be there.
   - If a key is missing, run with `SAMPLE_MODE=true`, and make features fall back the way the plan says.
3. **Budget: about $25 of credits.** Work so that running out mid-way loses nothing:
   - **Order:** Step 0 → Lane A → Lane B → Lane D → Lane C → Lane E. This order puts the plan's "never cut" items first.
   - **After each step or lane:** run `npm run test:v2`, `npm test` and `npm run check`. Commit with a clear message, push to `main`, then update this file's "Progress log" below and push again.
   - Use subagents for the work and ask for short replies. Keep the main conversation light, and don't re-read big files you don't need.
   - Follow the plan's cut line if credits are running low. Stop and write the handoff once roughly $5 is left.
4. **Quality-check against the mockups after every lane.**
   - Start the app: `cd bundle && SAMPLE_MODE=true npm run dev`, then open http://localhost:5050.
   - Click through that lane's story and screenshot it. Compare it with the matching `design/v2/screens/` image and the live mockup.
   - Copy, order and behaviour must match. Colours come from the existing app. List any differences in the progress log.
   - Mockup numbers marked "example" are not real data. Never copy them into the app.
5. **Leave for the Mac session:**
   - The Nightshift check (R4). It needs the Meterless Nightshift app on Lyndsay's Mac.
   - `npm run zetaris:record`, unless Zetaris keys are in the cloud environment.
   - `npm run record-vision` for the sample photos, unless NVIDIA keys are present.
   - Note each one in the log.
6. **Don't touch** the modified files in `bundle/data/sample/zetaris-cache/` or the `codebase_export/` folder. Both were left uncommitted on the Mac on purpose, and their origin is unclear.

## How to hand back to the Mac
Before stopping, whether finished or out of credits:
- Update the "Progress log" below with:
  - what's done (each lane, tests passing / failing, with counts)
  - what's half-done, and the exact next step
  - differences found against the mockups
  - anything left for the Mac
  - questions for Lyndsay
- Commit and push to `main`. The Mac session will read this file first.

## Progress log
- Oct 25 (Mac): planning, mockups and 21 failing acceptance tests pushed. Build not started.
- Oct 25 (cloud): **no keys in the cloud environment** (TAVILY_API_KEY, DATABASE_URL, NVIDIA, Zetaris and Meterless are all missing), so everything is built and checked in SAMPLE_MODE.
- Oct 25 (cloud): **Step 0 done.** The new database columns and tables are in `bundle/migrations/0002_v2_foundation.sql`, plus new shared types and sample-family answers. Tests: test:v2 0/21 (expected), npm test 1000 pass / 11 skipped, check clean.
  - **Mac to-do:** apply the migration to Neon (`npm run db:push`). No DATABASE_URL here.
  - Field names: `household` 'one'|'two'; `parent1Work`/`parent2Work` 'paycheck'|'self_employed'|'not_working'; `insurance` 'job'|'marketplace'|'medicaid'|'tricare'|'none_or_not_sure'; FeedCard `category`, `minutes`.
  - In practice mode, the four new answers are filled in from `families.json`, because the saved Zetaris replay doesn't have them. In live Zetaris they need a new view later. The existing SQL is unchanged.
- Oct 25 (cloud): **Lane A done** (Story 1). Tests: test:v2 3/21 (all of S1), npm test 1051 pass / 11 skipped, check clean. In the real app, Q4 (two-parent and solo), Q5, the checking screen, the reveal and the Insurance card all match the mockups.
  - Differences from the mockup:
    - The Insurance tab has no "Change" link yet. It needs Lane E's profile editing.
    - The carrier booster shows plain steps instead of a carrier link, because no carrier web addresses were checked.
    - The reveal total is the real run number, not the mockup's example.
  - Notes for later lanes:
    - The rules are in `bundle/shared/eligibility.ts`.
    - `POST /api/run` returns `{runId, familyId}`. A typed-in family's id goes in localStorage `bundle_family_id`.
    - Lane E must make `resolveFamily` load saved `guest-…` families.
    - Lane B should add a childcare-credit card for self-employed families, so it matches the checking line.
- Oct 25 (cloud): **Lane B done** (Stories 3 and 4). Tests: test:v2 8/21 (S1, S3 and S4 all pass), npm test 1087 pass / 11 skipped, check clean. In the real app, all of these work:
  - the three money buckets
  - "I got this" sends the card to Claimed
  - "Not relevant" sends the card to Dismissed, lowers Still to claim and the headline, and Undo puts both back
  - Quick wins
  - the Taxes booster with the MA 529 line
  - Deliberate differences from the mockup:
    - The booster says "Your tax credits", not "refund".
    - The booster range is built from the family's own cards, not the mockup's example $3,100.
    - Minute estimates are Bundle's own: "about N min".
    - The card link still says "How we checked".
  - Notes for later lanes:
    - Claims are kept in the browser (`bundle:claimed:<family>` / `bundle:dismissed:<family>`). The server copy is only written, never read back yet.
    - Lane C should point the empty "Money back now" bucket's "Add a receipt" at the scan sheet.
    - **Lane E must remove the old "Save your list… Continue with Google (coming later)" card on Home** (left over from Firebase) and add the "Save your plan" card.
  - `output_examples/` and `logs/sample/` were regenerated with `npm run examples:regen`, in practice mode.
- Oct 25 (cloud): **Lane D done** (Story 5). Tests: test:v2 15/21 (S5 7/7, with S1, S3 and S4 still passing), npm test 1114 pass / 11 skipped, check clean.
  - Checked in the real app:
    - Deals opens at once with the saved offers. Practice mode says "Checking 16 saved offers against your baby's age (Day 20)", worked out from the run.
    - Offer cards show "Fine Print Court: Approved (0 subscription traps, $0 hidden fees)", "About N minutes", "True value $X" and the age line. "Likely a good deal" is gone.
    - A failed search, or one with no key or that times out after 10s, quietly shows "No new offers right now. Showing your checked offers."
    - The audit form works. In a test with a stand-in AI model, a confident audit was saved ("Added to the shared list"), and repeating it came back instantly from the saved copy.
  - Differences from the mockup:
    - The report card is empty in practice mode, because the recorded Zetaris answer has 0 grades. The mockup shows example numbers.
    - Offer cards have no short note like "online registry setup only".
  - **Mac to-do (needs keys):**
    - Prove a real Tavily search with TAVILY_API_KEY (only tested against a fake here).
    - Test the database copy of saved audits (`createDbAuditStore`).
    - Run Zetaris `register` for the new view `v_audit_by_source`, then `npm run zetaris:record`.
    - Not built: saving live-search finds to offer_checks.
  - Notes:
    - New route `/api/offers/report-card`.
    - Cards carry `offerFacts`.
    - Any lane that changes run output must re-run `npm run examples:regen`.
    - `bodyLimit.ts` now lets photo uploads past 100 KB on `/api/photo/read`. Lane C should verify this.
- Oct 25 (cloud): **Lane C done** (Story 2). Tests: test:v2 17/21 (S2 passes; only S6 is left), npm test 1140 pass / 11 skipped, check clean.
  - Checked in the real app:
    - All four Scan entry points open the "What are you scanning?" sheet: the Home card, the header button, the Savings card and the empty locker.
    - The gear camera shows the dashed frame and the exact label tip.
    - The result reads "No recalls found as of … Checked against 69 NHTSA car-seat recalls" with "Register it with Graco →".
    - The receipt shows a thumbnail and its item count. The locker and Forget work, and a 1.8 MB photo works.
  - The NHTSA list is new: `bundle/data/nhtsa-car-seat-recalls.json`, 69 child-seat recalls from NHTSA's public download, Oct 25.
  - Practice mode has no photo-reading key, so the answer comes from `data/sample/sample-photo-answers.json` and is clearly labelled "Practice mode" and "Sample".
  - Differences from the mockup and open items:
    - When no recall list is reachable, the result says "Not checked for recalls". The mockups don't show this case.
    - **Small fix needed:** for sample families, the recall date uses today (Oct 25) while the demo date banner says Oct 23. These should match.
  - **Mac to-do:**
    - `npm run record-vision` (needs NVIDIA) to record a real sample photo and receipt.
    - Test the new CPSC recall query against live Zetaris.
    - Test the item_photos database code on Neon.

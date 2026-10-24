# What can be built in the cloud, and what has to wait for the Mac

Written Sat Oct 24, 2026 (cloud session). **No app code was changed and nothing was committed.** This only says how buildable each item is; it does not rank, cut or decide anything in the plan.

Sources: `bundle-plan-v3.md`, `research-nightshift-setup.md`, `research-email-receipts.md`, `architecture.md`, `entity-resolution-test.md`, `onboarding-spec.md`, `onboarding-design/README.md`, `cloud-health-check.md`, and the code in `bundle/`. `research-photo-barcode-intake.md` did not exist yet when this was written, so the photo and barcode rows below use placeholders that the research may change.

New decisions included: **Plaid is out**, the **work-benefits question is cut** (so onboarding is 3 questions), and data comes in through **forwarded email receipts, barcode scanning, and photos of items or receipts read by NVIDIA vision models**. (A vision model is an AI that can read pictures.)

---

## 1. The short answer

- **Almost everything can be built here, and most of it can also be tested here.** The cloud machine can stand up fake versions of every outside service. A **fake server** is a small program on this machine that answers exactly like the real service (Nightshift, NVIDIA, Zetaris, Agentmail) would, so the code can be tested without keys.
- **Nothing on the list needs keys or the Mac just to write the code.** A few settings can't be filled in until Nightshift's Sunday update or the photo research lands (section 4), but the code can leave a slot for them.
- **Only two things truly need the Mac:** Nightshift itself and the demo video. Everything else in the "flip on later" group (Zetaris, Neon, NVIDIA direct, Agentmail) only needs **keys**. If those keys were added to this cloud environment's settings, they could be switched on here too.
- Rough total to build and test in the cloud: **about 75 to 90 hours of coding-agent work** (section 3). Many pieces don't depend on each other, so several agents can work on them at the same time.

### What I checked on this machine (Oct 24)

| Check | Result |
|---|---|
| Fake "Nightshift" test | **Works.** I started a fake OpenAI-compatible server on this machine. ("OpenAI-compatible" means it accepts requests in the same layout OpenAI uses, which is the layout Nightshift and NVIDIA both use.) The app's current AI adapter (the file that talks to the AI service) called it over a real network connection and got a ruling back. The `openai` library sent the Nightshift labels (`meterless-app: bundle`, `meterless-scope: user`) and the password, and the fake server received them. A call that never got an answer was cut off at the 2-second limit. A wrong password came back as a "401" error (the code for "not allowed"), and a server error followed by a retry worked on the second try. The script is in the scratchpad (`/tmp/claude-0/-home-user-parent-benefits/12c034cc-fef9-579f-be7a-532c423ed2f7/scratchpad/fake-nightshift-proof.mts`) and is not part of the app. |
| Local Postgres (Postgres is the type of database Neon runs) | **Installed and working.** Version 16 is already on this machine and starts with one command (`service postgresql start`). I turned the app's table list into a SQL setup file with `drizzle-kit generate`, which writes the database's setup instructions from the code's table definitions. All 13 current tables were created cleanly in a throwaway test database, which I then deleted. |
| Can this machine reach outside services? | NVIDIA's model list: yes (answered "200", meaning OK). Open Food Facts, a free barcode lookup with no key: yes. Agentmail: yes, but it asked for a key ("401"). UPCitemdb's free trial (another barcode lookup): rate-limited ("429"). The npm package store (where code libraries are downloaded from): yes. |
| Recall data saved offline | `experiments/entity-resolution/data/` already holds 739 CPSC recalls plus the FDA recalls and the test purchases, so the matcher can be built and scored with no internet. **22 of the 739 CPSC recalls list barcode numbers (UPCs)**, so a scanned barcode can match those recalls exactly. |

---

## 2. Each plan item, sorted into three groups

**The three groups:**
- **(a) Build and test fully in the cloud.** Sample mode (the app running on saved answers with no keys), fake servers, or the local Postgres are enough.
- **(b) Build and test here with fakes; prove it for real later.** The "flip-on step" is one setting plus one command, run on the Mac or anywhere the keys exist.
- **(c) Needs keys or the Mac even to build.**

One catch applies to several items. **Zetaris saved answers** are files stored next to the code. Each one is labeled with a fingerprint of the exact SQL question it answers. When a question changes, or a new table adds a new question, sample mode can't find a saved answer. It then shows its "source unavailable" fallback instead of failing. So any item that changes a Zetaris question works fully in tests, which use a fake Zetaris, but needs **one live recording run** before the judges' offline replay shows it. The code already saves answers automatically whenever it runs with live Zetaris (`server/adapters/zetaris.ts`, line 70). **Saved answers must never be written by hand**, because the project rule says outputs are never hardcoded.

| # | Item | Group | Build + test here (hours) | Flip-on step (what makes it real) |
|---|---|---|---|---|
| 1 | Owner view split (parent view vs. "Behind the scenes") | **a** | 3–4 | none |
| 2 | **Nightshift adapter**: chain Nightshift → Nemotron direct → saved text, timeout + retry, run time limit, `LIVE_MODEL`, `model:check --provider`, scoreboard labels | **b** | 4–5 | Mac: put `NIGHTSHIFT_TOKEN_FILE=<path>` in `.secrets/bundle.env.local`, then `npm run model:check -- --provider nightshift` |
| 3 | **Nemotron direct** (NVIDIA backup in the chain) | **b** | included in #2 | `MODEL_API_KEY=nvapi-…` (plus `MODEL_REASONING`/`MODEL_FAST`), then `npm run model:check -- --provider nvidia`. **Works anywhere with the key, including this cloud machine** |
| 4 | Real-AI rerun of scoreboard + learning traces | **b** | 0 (no new code) | Mac: `SAMPLE_MODE=true LIVE_MODEL=true npm run eval:live-model` |
| 5 | Any-state rules: `tax_parameters`, `state_programs`, full ZIP table, 5-family `state_agnostic` test, WIC/poverty removal | **a** for code and tests; **b** for offline replay | 4–6 | Record saved answers for the new Planner questions (checklist step 6) |
| 6 | Work question cut → Dependent Care FSA becomes "Check with your job" for everyone | **a** | 1 | none |
| 7 | Recall safety (drop finished FDA recalls, `no_false_recall` test) | **a** (tests); **b** (replay, because the SQL changes) | 2 | Re-record saved answers |
| 8 | **Product-matcher upgrade** (brand + product type + date rules, evidence line, 14 new test cases) | **a** for matching rules and scoring, using the saved 739 CPSC + FDA rows; **b** for the changed `v_recall_orders` view | 5–7 (no file had an estimate; this is mine) | Register the changed view in Zetaris, then re-record |
| 9 | **Email receipts, sample version** (fake emails, reader, `receipt_items`, `v_purchase_items`, "Use sample receipts" button, privacy tests) | **a** (reader and tests); **b** (the Zetaris join in replay) | 5.5–6.5 (from `research-email-receipts.md`) | Create the tables in Neon, register them in Zetaris, re-record |
| 10 | **Receipts through a live Agentmail inbox** (allowlist so only our test address gets in, checking for new mail on a timer, delete after reading) | **b**: build it against a fake Agentmail server that serves the sample emails | 2–3 | `AGENTMAIL_API_KEY=…`, `AGENTMAIL_INBOX_ID=…`, then a new command such as `npm run receipts:poll` (still to be built). **Works anywhere with the key** |
| 11 | **Photo intake** (photo of an item or receipt → NVIDIA vision model → item rows) | **b**: build the upload route, size limit, removal of location data from photos, the request to the vision model, and answer checking; test against a fake vision server using made-up receipt images | 4–6 | `MODEL_VISION=<NVIDIA vision model name>` (the research file will pick it) plus `MODEL_API_KEY`, then a new command such as `npm run model:check -- --vision` (still to be built). Whether Nightshift can route pictures is **not documented**, so plan on NVIDIA direct for photos |
| 12 | **Barcode scanning** (camera → barcode number → product lookup → recall check) | **a** for reading barcodes from saved sample images, lookups using saved sample answers, and exact matches against the 22 CPSC recalls that list barcodes; **b** for the live camera and live lookup | 4–6 | Live lookup: `BARCODE_LOOKUP=live` (Open Food Facts needs no key and is reachable from here). Camera: phones only allow it on secure (`https://`) pages or on `localhost` (this same computer), so test with the Mac's webcam at `localhost`. Testing on a phone needs a secure address, which is a separate decision |
| 13 | Zetaris registration of new tables and views (`receipt_items`, `offer_checks`, `tax_parameters`, `state_programs`, `v_purchase_items`, `v_offer_audit`, changed `v_recall_orders`) plus a "record saved answers" command | **b** | 2–3 | Needs `ZETARIS_*` and `DATABASE_URL`: run `npx tsx scripts/zetaris/register.ts` (dry run), then `--apply --replace=…`, then record. **Not tied to the Mac; it only needs keys.** The Neon side of each view's query can be checked on the local Postgres here; Zetaris's own SQL wording can only be checked live |
| 14 | `offer_checks` table + Value Score + `approve_with_catch` verdict | **a** | 4–5 | Register in Zetaris and re-record (for replay) |
| 15 | Brand audit view `v_offer_audit` + read-only web address `GET /api/offer-audit` + **OpenAPI description** (the standard file that tells other programs how to call it) + "no family fields" test | **a** for the web address, OpenAPI file and tests (fake Zetaris); **b** for real data | 2–3 | Register the view, re-record |
| 16 | **Fine-print tests** FP-01 to FP-12 + 3 controls, Ohio fix, subtler learning trap | **a** (the code rules decide; tests run offline) | 4–6 | Report the real-AI result with #4 |
| 17 | Parent taps → Meterless memory confidence ("I got this", "Not mine", "Returned it") | **a** (the memory engine runs locally from `data/hmem`) | 1–2 | none |
| 18 | **Onboarding top row**: screens 1 Hook, 2 Date (both birthday and due-date versions), 3 ZIP, 5 Checking (screen 4 Work is cut) | **a** (the app already has screen-test tools: Jest with jsdom and Testing Library; the agent-browser skill can take screenshots) | 4–5 | none |
| 19 | Onboarding middle row: 6a/6b lists, 7 Share, 8 "Find money in past purchases" (now forward / scan / photo), 9 Save (labeled demo) | **a** | 4–6 | none |
| 20 | **Version B bottom-tab screens** (Home, Taxes, Savings, Insurance, Deals) | **a** | 5–7 | none |
| 21 | **Neon database changes** (new tables, then applying them to Neon) | **a** for writing and testing them on local Postgres (proven above); **b** for applying to the real Neon | 1–2 per batch + about 1 for setup (see note) | `npm run db:push` with `DATABASE_URL`. It shows the planned changes and asks before applying. Add new table names to `BUNDLE_TABLE_NAMES` first, or the tool won't touch them (this protects other tables in the shared database). **Only needs the key** |
| 22 | Regenerate evidence (scoreboard, saved examples, README numbers) | **a** for the offline part; **b** for the real-AI part (#4) | 1–2 | Mac: `npm run examples:regen` after #4 |
| 23 | Plaid clean-up (Plaid is out: the Connect tile, wording, docs; keeping or removing the sample card data is a decision for Lyndsay) | **a** | 1–2 | none |
| 24 | Should-dos: daycare invoice → Dependent Care FSA card; Neon results table; brand + live-recall join | **a** / **a** (with local Postgres) / **b** (live CPSC feed through Zetaris) | 1 / 2–3 / 1–2 | Join: register in Zetaris and re-record |

**Note on the database (item 21):** the app connects to Neon with Neon's own connection library, which talks to Neon over the internet in its own way. A plain local Postgres doesn't understand that. So the setup files can be written and tested here today, as shown above. To also run the app's database code (`seed()`, `DrizzleStore`) against the local database, one small change is needed: use the standard `pg` connection library (downloadable from here, version 8.23.1) whenever the database address points at this machine. That is about 1 hour, and it's counted in item 21's "setup" hour. This machine has Docker, a tool for running prepackaged programs, but I didn't check that it can actually run them here, so I didn't count on it.

**Group (c), needs keys or the Mac to build at all:** nothing outright. Four details can't be known in the cloud. The code can leave a setting for each and fill it in later:
1. The exact model name to pin Nemotron inside Nightshift, and Nightshift's "thinking off" setting (expected in Meterless's Sunday Oct 25 update).
2. Whether Nightshift can route photos to a vision model.
3. Which NVIDIA vision model to use (waiting on `research-photo-barcode-intake.md`).
4. Whether Zetaris accepts the exact wording of the new view definitions (only a live `register.ts --apply` can tell).

---

## 3. A sensible build order (all in the cloud, several agents at once)

This is ordered by what depends on what, not by importance.

1. **Groundwork (about 6 to 8 hours, can run side by side):**
   - Nightshift adapter + chain + `LIVE_MODEL`, with fake-server tests (#2, #3).
   - Local Postgres test setup + `pg` switch + database changes for every new table at once: `receipt_items` (or one shared item table with a `source` column for email, barcode and photo), `offer_checks`, `tax_parameters`, `state_programs` (#21).
   - A fake Zetaris that answers new questions in tests, and a "record saved answers" command for the flip-on (#13).
2. **Matcher upgrade (#8) and recall safety (#7).** Receipts, barcodes and photos all feed the matcher, so it comes first.
3. **Item intake (#9, then #12, #11, #10).** All four write the same kind of item row, so build the sample-receipt reader first and reuse its row format and privacy rules for barcode, photo and Agentmail.
4. **Fine print (#16, #14, #15).** Doesn't depend on steps 2–3, so it can run alongside them.
5. **Any-state rules and work-question cut (#5, #6), Plaid clean-up (#23).** Can also run alongside.
6. **Owner view split (#1) and memory taps (#17).** These need the new card fields from steps 2–5 to be settled.
7. **Onboarding (#18, #19, #20).** The screens show results, so they come after the server changes. Screen 8 needs the intake buttons from step 3.
8. **Offline evidence (#22, offline part).** Then hand over to the Mac checklist below.

---

## 4. Flip-on checklist for the Mac

Commands run inside the `bundle` folder. Commands marked "new" don't exist yet; the build above would create them. Steps 3 to 6 and 9 only need keys and could also run in the cloud if the keys were put in this environment's settings.

1. **Get the latest code:** `git pull`, then `npm ci` (installs the exact library versions). Use Node 24; the cloud machine has 22.
2. **Finish Nightshift setup** (`research-nightshift-setup.md` §2, steps A–F). Then add these to `.secrets/bundle.env.local`, a private file that never goes to GitHub:
   `MODEL_PROVIDER=auto`, `NIGHTSHIFT_TOKEN_FILE=<path from step 9 of that guide>`, `MODEL_API_KEY=…`, `MODEL_REASONING=…`, `MODEL_FAST=…`, `MODEL_VISION=…`, `ZETARIS_BASE_URL/ORG_ID/API_KEY=…`, `DATABASE_URL=…`, `AGENTMAIL_API_KEY=…`, `AGENTMAIL_INBOX_ID=…`.
3. **Check both AI routes:** `npm run model:check -- --provider nightshift` and then `-- --provider nvidia`. Both should say "ok" and name the model that answered. Then quit Nightshift and run the first check again; it should say "Nightshift isn't running."
4. **Check photo reading (new):** `npm run model:check -- --vision`.
5. **Create the new tables in Neon:** `npm run db:push`, read the list of changes, and confirm.
6. **Register in Zetaris:** `npx tsx scripts/zetaris/register.ts` (dry run, shows what it will do), then `npx tsx scripts/zetaris/register.ts --apply --replace=v_recall_orders,…`.
7. **Record saved Zetaris answers (new command, for example `npm run zetaris:record`).** Commit the new files in `data/sample/zetaris-cache/`.
8. **Smoke test:** `SAMPLE_MODE=true LIVE_MODEL=true npm run dev`, open `http://localhost:5050`, and run the sample family. Try "Use sample receipts", scan a barcode with the webcam, and upload one photo of a made-up receipt. The owner view trace should show which provider and model answered.
9. **Live inbox (optional):** forward one fake receipt from the allowlisted test address, then run `npm run receipts:poll` (new).
10. **Sunday evening:** after Nightshift's update, pin Nemotron with `NIGHTSHIFT_REASONING=<exact name>`, turn thinking off, and repeat steps 3 and 8.
11. **Monday (after the 9am go/no-go):** `SAMPLE_MODE=true LIVE_MODEL=true npm run eval:live-model`, then `npm run examples:regen`. Commit `logs/` and `output_examples/`.
12. **Fresh-download check:** in a clean copy with no keys, run `SAMPLE_MODE=true npm test` and `SAMPLE_MODE=true npm run eval`.

---

## 5. Risks to know about

- **Saved Zetaris answers go stale whenever a question changes.** Every changed question needs step 7 before the offline demo shows it. Until then, sample mode shows its "source unavailable" fallback.
- **Zetaris's SQL can't be checked here.** The Neon side of each query can be checked on the local Postgres, but Zetaris's own wording is only checked live, in step 6.
- **Phone cameras need a secure page.** `localhost` on the Mac is fine; testing on a real phone needs a secure address, and that hasn't been decided.
- **The barcode lookup can be thin for baby gear.** Open Food Facts mostly covers food and formula; UPCitemdb's free trial is rate-limited. Only 22 of 739 CPSC recalls list barcodes. The photo research may change this row.
- **Nightshift's Sunday update could rename settings.** The code keeps the model name and the "thinking off" option as settings, not built-in values, so a rename only means editing the private settings file.

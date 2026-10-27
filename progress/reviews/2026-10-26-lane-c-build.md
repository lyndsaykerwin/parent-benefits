# Lane C build report: the photo reader (Oct 26, 2026)

**Bottom line:** in real mode (real NVIDIA AI, real Neon database), the photo reader read **24 of 24** photos end to end through the app's web address. That is 4 sample photos, 3 rounds each, run twice. Before this work, the same receipt worked about 1 time in 4.

Nothing is committed. Every change is a local edit in `~/Documents/hackathon/bundle`.

## What changed, in plain English

1. **Reliability** (`server/adapters/llm.ts`, `server/ingest/photo.ts`)
   - **More patience when the free service is busy.** Photo reading now has its own waiting time: up to about 4 minutes, with pauses that double from 2 seconds up to 20 seconds each. The text helpers keep their short 10-second limit, so they are not slowed down. You can change the photo waiting time with the setting `VISION_BUSY_BUDGET_SECONDS`.
   - **A backup photo model.** The backup is `nvidia/nemotron-3.5-super-vl-120b-a12b`, on the same NVIDIA service. I tested it live today and it read the label correctly in about 14 seconds. It is tried straight away whenever the main model is busy. You can change it with the setting `MODEL_VISION_FALLBACK`; set it to `none` to switch it off.
     - Other models tested: `llama-3.2-11b-vision` worked. `gemma-3-12b` is not available (it returns "404", meaning "not found"). `llama-3.2-90b-vision` hung for more than 5 minutes.
   - **Garbled answers get fixed.** Sometimes the model's reply is messy: it "thinks out loud" first, wraps the answer in formatting marks, adds chatter, or leaves stray commas. The reader now removes all of that and pulls out the actual data. The data format is called JSON.
     - The model gets up to **4 tries** (`MAX_READ_ATTEMPTS`).
     - An empty reply counts as messy and gets another try.
     - If every try fails, the parent sees: "We had trouble reading that photo just now. Please try again in a minute." That is not the photo's fault, so it does not blame the photo.
   - **"Please send a clearer photo" now appears only when the model itself says the photo is too blurry or dark.** The model reports that in a new "unreadable" field.
   - **Small fixes found on the way:**
     - The instructions sent to the model now say the product name and store name must always be filled in. Without that, the model was copying the blank form, which forced a second try every time. Now all 8 recorded sample reads succeed on the first try.
     - CPSC recalls (CPSC is the U.S. product-safety agency) could never match on model number. The model numbers were stored in a different format (with capitals and dashes) from the one the checker compares against. Fixed in `server/ingest/gearRecall.ts`.

2. **Reading in the background** (`server/ingest/photoJobs.ts` is new; `server/routes/photoRoutes.ts`)
   - When a parent sends a photo, the server saves it at once and answers in under 0.3 seconds: "Thanks! We're reading your photo…".
   - A queue reads up to 2 photos at a time.
   - If the service is still busy after the full 4 minutes, the photo goes back in the queue. It waits 30 seconds, then 60, then 120 before each new attempt, so it keeps trying for several more minutes before giving up.
   - A photo that stopped has a "Try again" button that re-reads the same photo, with no new picture needed. The photo stays in the server's short-term memory for 30 minutes for this, and is then wiped. The picture itself is never written to disk.
   - If the server restarts mid-read, that photo shows "interrupted, please take it again". This kicks in once the photo has been stuck for 15 minutes.
   - **New web addresses on the server:**
     - `/api/photo/read` with `background: true`, or `/api/photo/start`: sends a photo.
     - `GET /api/photo/status/:id`: checks one photo.
     - `GET /api/families/:id/photos`: lists photos still being read, or stopped.
     - `POST /api/photo/retry` and `/api/photo/dismiss`: the "Try again" and "Remove" buttons.
     - `GET /api/photo/examples/car-seat|stroller`: the two example pictures.
   - **On screen** (files in `client/src/components/scan/`: `photoJob.ts` is new; `ScanSheet.tsx`, `ScanContext.tsx`, `GearLocker.tsx` and `ResultCards.tsx` changed):
     - The scan sheet says "Photo sent / Got it".
     - If the read finishes while the sheet is still open, the result card appears in the sheet.
     - The Gear Locker shows a "Reading…" tile. It checks again every 4 seconds and swaps the tile for the item when done.
     - A failed photo becomes a tile with "Try again" and "Remove".
     - When a read finishes, a note appears at the bottom of the screen with an "Open" button. The locker card also shows an "N new" badge.

3. **What recalls need** (`photo.ts`, `server/agents/recallMatch.ts`, `server/ingest/gearRecall.ts`)
   - The reader now captures the **date of manufacture** (stored as year-month-day, or year-month when the label has no day) and the **lot code** (the batch number).
   - Both are checked before they are kept:
     - the date must be a real date and not in the future;
     - its year must appear in the text the model copied from the photo.
   - Both are stored in the database and shown on the result card and in the locker, for example "Made 2026-03-14 · Lot 0314A".
   - **The recall check uses them.** It reads "manufactured between X and Y" from the recall notice:
     - a unit made outside those dates is ruled out, with a plain sentence saying why;
     - a car-seat recall that names dates, when no date could be read, adds "Check the date of manufacture on your seat's white sticker";
     - a lot code printed in the recall notice is treated as an exact match.

4. **Example photos** (in `data/sample/photos/`)
   - Two made-up labels, drawn by `draw-example-labels.py`:
     - `item-example-car-seat-label.png`: brand ZOOBLEFERN, model ZF-CS100, made 2026/02/09, lot CS0209B;
     - `item-example-stroller-label.png`: brand TRUNDLEMOTH, model TM-ST200, made 2026/03/14, lot 0314A.
   - Both are marked "SAMPLE IMAGE / NOT A REAL PRODUCT". There are no people in them.
   - The brand names are invented. I first used "Pebblenest" and "Willowby", but a web search showed they were too close to the real Maxi-Cosi Pebble and Britax Willow car seats, so I changed them.
   - The scan sheet shows both examples with the exact tip "Find the white sticker under the seat with the model number and date made." Each has a "Try this example" button.
   - `.browser.jpg` copies were made in Chrome exactly the way the app prepares photos, so the example buttons find their saved answers in practice mode.
   - `npm run record-vision -- --force` re-recorded real NVIDIA answers for all 8 sample files, with the new instructions. All 8 were read on the first try. Practice mode replays these answers.

5. **Database change** (only the `item_photos` and `purchase_items` parts of `shared/schema.ts`, plus the new file `migrations/0003_lane_c_photo_status.sql`)
   - I applied these by hand to Neon with `@neondatabase/serverless`, and confirmed afterwards that the columns exist. I did not use `db:push`. Each statement only adds a column, so nothing existing is removed or changed:
     ```sql
     ALTER TABLE "item_photos" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'done' NOT NULL;
     ALTER TABLE "item_photos" ADD COLUMN IF NOT EXISTS "read_error" text;
     ALTER TABLE "item_photos" ADD COLUMN IF NOT EXISTS "read_result" jsonb;
     ALTER TABLE "item_photos" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
     ALTER TABLE "purchase_items" ADD COLUMN IF NOT EXISTS "manufactured_on" text;
     ```
   - The local test database picks up the same file automatically (`npm run db:test`). `photoDb.test.ts` passed against a real local copy of the database.

## Live proof (real mode, through the HTTP API, Oct 26)

**How it was run**
- Server: port 5063, real AI (`MODEL_PROVIDER=nvidia`), real database (`SAMPLE_MODE=false`).
- Each round sent all 4 photos **at the same time**, in background mode, then checked their status every 2 seconds until done.
- All test families were made up (names start with `test-lane-c-`).
- Script: `scratchpad/proof.mjs`.

**Set A (first instructions): 12 of 12 done.**
- NVIDIA was busy 4 times during set A. The server log shows lines such as `[vision] busy: nemotron-3-nano-omni + nemotron-3.5-super-vl; waiting 2 s`: both models were busy at the same moment. Every photo still finished, with no "busy" error.
- Rounds 2 and 3 took about 78 to 114 seconds. That is waiting on the busy service and the 2-at-a-time queue; the parent had already been told "we're reading it" within 0.3 seconds.
- 6 of the 12 needed a second try. That was the blank-form problem, fixed before set B.

**Set B (final instructions): 12 of 12 done, all on the first try, 0 busy.**

| Photo | Set A done | Set B done | Set B time (s) | What was read (all runs identical) |
|---|---|---|---|---|
| Graco sample label (car seat) | 3/3 | 3/3 | 8.3 / 6.2 / 6.2 | Model SAMPLE-1042 · made 2026-03-15 · lot SMP-0315 · no recall found (NHTSA) |
| Made-up Baby Mart receipt | 3/3 | 3/3 | 17.0 / 14.9 / 8.6 | 3 lines: $12.99, $8.49, $24.99 (correct) |
| Example car-seat label (new) | 3/3 | 3/3 | 20.6 / 10.4 / 14.5 | ZF-CS100 · 2026-02-09 · CS0209B · no recall found (NHTSA) |
| Example stroller label (new) | 3/3 | 3/3 | 16.5 / 18.6 / 12.4 | TM-ST200 · 2026-03-14 · 0314A |

The server's first reply took 30–286 milliseconds every time.

## Tests and checks (actual output)

| Command | Result |
|---|---|
| `npm test` | 88 test files passed, 1 skipped; 1,408 tests passed, 11 skipped (rerun after the temperature change below) |
| `npm run test:v2` | 6 test files, 23 tests passed |
| `npm run check` (the code-error checker) | No errors |

**New tests**
- `server/__tests__/photoJobs.test.ts` (9 tests): background reading and its web addresses.
- `server/__tests__/recallDates.test.ts` (10 tests): recall dates and lot codes.
- 7 new tests in `llm.test.ts`: photo waiting time and the backup model.
- 9 new tests in `photo.test.ts`: messy-answer repair, "unreadable", date and lot reading.
- 5 new tests in `ScanSheet.test.tsx`: the example labels, "Try this example", "reading" then result, "Try again", and the locker going from "Reading…" to the item.
- 1 new database test in `photoDb.test.ts`.

**Older tests I rewrote to match the new rule.** The old rule was "one retry, then ask for a clearer photo". Lyndsay approved changing it.
- `photo.test.ts`: the retry tests.
- `loopsEndToEnd.test.ts` › loop 7 "bad every time". This file belongs to another lane; the coordinator asked me to make it pass. It now checks that the reader stops after at most 3 retries and never guesses a model number.

## Screenshots

At phone width (375 pixels), in `progress/reviews/lane-c-screens/`:
- `01-scan-sheet-examples.png`: the two example labels and the exact tip.
- `02-scan-sheet-examples-lower.png`: the dashed frame, now labelled "MODEL · DATE MADE · LOT".
- `03-photo-sent-thanks.png`: "Got it. Thanks! We're reading your photo…".
- `04-locker-reading.png`: the Gear Locker "Reading…" tile.
- `05-locker-done.png`: the finished item, "City Stroller · TRUNDLEMOTH · Model TM-ST200 · Made 2026-03-14 · Lot 0314A".

## Add-on: text answers now use temperature 0

Asked for by the coordinator for the fine-print lane. In `server/adapters/llm.ts`, every text call now asks the model for temperature 0 instead of 0.2.

- **What temperature means:** how much randomness the model is allowed. At 0 it gives the most likely answer every time, so the same offer should get the same grade on every run.
- **Photo reading keeps 0.2.** The settings are `TEXT_TEMPERATURE` and `VISION_TEMPERATURE`.
- **Test:** a new test in `llm.test.ts` checks that text calls send 0 and photo calls send 0.2.
- **Checks rerun afterwards:** `npm test`, `npm run test:v2` and `npm run check` all pass.

## Notes and blockers

- **No blockers.**
- **Not changed:** `client/src/lib/photoPrep.ts` belongs to another lane, so I left it alone. My new helper sends photos to the same `/api/photo/read` address with `background: true`. Older test stand-ins that answer that address straight away still work.
- **Not changed:** the main recall checker (`server/agents/recall.ts`) reads purchases through Zetaris's `v_purchase_items` view, which does not include the new `manufactured_on` column. I did not change the Zetaris view, so only the photo recall check uses the date for now.
- **Possibly mine:** many `data/sample/zetaris-cache/*.json` files show as changed in git. My real-mode test server may have recorded some of them while running the sample family for the screenshots; other lanes may have changed the rest. Please review before committing.
- **Expect some extra NVIDIA use:** when NVIDIA is busy, one photo can now use about 4 minutes of retries, plus up to 3 more attempts from the queue. The queue reads at most 2 photos at a time.

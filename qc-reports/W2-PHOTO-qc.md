# W2-PHOTO QC (commit 805f110) - PASS

Tests: 499 passed, 8 skipped, 0 failed. `tsc --noEmit`: 0 errors.

## A. Done check (verified in code)
- Rows go to purchase_items (photo.ts:318-327), source photo_item/photo_receipt, inputHash + lineIndex; unique (family,hash,line) honoured by memory store (206) and DB store `onConflictDoNothing` (228). Same photo twice = 0 new rows (tested).
- Retry: photo.ts:299-316. Exactly one retry with the problem list; second failure returns CLEARER_PHOTO_MESSAGE before any insert, so nothing stored. Rejected photos are not retried.
- M9 trace: vision_extract (r1), retry_request (retry 1), vision_extract (r2), blocked retry_request at end; never above retry 1 (photo.ts:303-314; tests 234-255).
- Photo bytes: no write calls except recorder's JSON of model answers (379). Buffer wiped in `finally` (360). Trace holds only counts and problem text. Rows hold no image. Privacy test at test:257.
- forgetItems (241) works, only that family (tested). Note: DB version deletes ALL purchase_items for the family (email/barcode too) - fits "forget my items".
- Receipt model: visionKindFor (31-33) only uses 'receipt' kind when MODEL_VISION_RECEIPT set; tested.
- SAMPLE_MODE: replays by sha256 fingerprint, including saved retry; says "needs the live model" when nothing is saved; no model call (338-343, tests 285-318). Cache dir is empty (README only) - honest, nothing hand-written.

## B. Tightness
- Only owned files touched plus 2 READMEs inside owned folders. `.tsx` client test is ACCEPTABLE and actually required: jest client project only matches `*.test.tsx` (jest.config.cjs:28); an owned `.ts` file would never run.
- Route: 8mb JSON limit, 400 on bad input, 413 on oversize (both byte check and body-parser), rate limit 30/15min per connection, familyId regex. Response is product facts only (photoRoutes.ts:63-71), no inputHash/confidence/readText/extractor.
- photoPrep redraws via canvas to a new JPEG, which drops EXIF/GPS; resized to 1600px. Test uses a fake codec, so it proves the flow, not real EXIF removal (unavoidable in jest).
- No hardcoded outputs, real personal data, or secrets found. Fake vision server in tests.
- Not yet wired: `photoRoutes` in server/routes/index.ts and `record-vision` in package.json (known orchestrator hand-offs).
- DB store path (createDbPhotoStore) is untested. Acceptable, NOT a must-fix: it is 15 lines, uses the same table shape and unique key as W1-DB, and no local Postgres. Add to Mac checklist: one real photo -> row in Neon, then forget.

## Must-fix
None.

## Nice-to-have
1. No test for the 429 rate limit.
2. Recorder saves the model's raw answers including `readText`; prompt tells model to omit card digits/addresses, but eyeball the first recorded file before committing it.
3. Route does not tell the client whether the row was actually saved (`stored` count is dropped); in-memory store in no-DB mode loses rows on restart.
4. DB `deleteForFamily` is broader than photo rows (see above); confirm that is intended.

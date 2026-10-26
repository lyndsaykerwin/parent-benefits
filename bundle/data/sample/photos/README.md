Sample photos for the photo intake path. Only made-up images or credited public recall-notice photos go here
(never real family photos). Name a receipt image `receipt-<something>.png` so the recorder treats it as a receipt.

After adding photos, on a machine with the NVIDIA key run `npm run record-vision`; it saves the model's real answers
into `../vision-cache/`, and SAMPLE_MODE replays them. Until a photo has a saved answer, sample mode answers with the
labelled made-up answer in `../sample-photo-answers.json`.

What is here (all made up, drawn by a script on Oct 25 2026, no real people, addresses or card numbers):
- `item-graco-sample-label.png`: a made-up car-seat label (model SAMPLE-1042). Upload this in the Scan sheet.
- `receipt-made-up-baby-mart.png`: a made-up receipt (3 items, $46.47). Upload this in the Scan sheet.
- `*.browser.jpg`: the same two pictures exactly as Chrome sends them. Before upload the phone-side code redraws every
  photo as a fresh JPEG (to strip location data), so the uploaded bytes differ from the file. Recording these copies
  is what lets the upload above find its saved answer. If you change a PNG, remake its `.browser.jpg` (redraw it on a
  canvas in Chrome as `client/src/lib/photoPrep.ts` does, JPEG quality 0.85) and re-run `npm run record-vision`.
  Other browsers (Safari) may re-encode slightly differently and get the made-up fallback instead.

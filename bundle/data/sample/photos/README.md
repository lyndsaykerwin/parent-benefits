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

Added Oct 26 2026 (Lane C), drawn by `draw-example-labels.py` (Python + Pillow), all made up, clearly fictional brands:
- `item-example-car-seat-label.png`: a car-seat sticker, brand "ZOOBLEFERN" (made up), model ZF-CS100, date of manufacture
  2026/02/09, lot CS0209B.
- `item-example-stroller-label.png`: a stroller frame sticker, brand "TRUNDLEMOTH" (made up), model TM-ST200, date of
  manufacture 2026/03/14, lot 0314A.
These two are shown in the Scan sheet as "what to photograph" examples (served by `GET /api/photo/examples/car-seat` and
`/stroller`), with a "Try this example" button. Their `.browser.jpg` copies were made by redrawing the PNG on a canvas in
Chrome at JPEG quality 0.85, exactly as the app does, so the button finds the recorded answer in practice mode.

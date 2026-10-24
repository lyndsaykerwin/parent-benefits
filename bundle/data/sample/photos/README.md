Sample photos for the photo intake path. Only made-up images or credited public recall-notice photos go here
(never real family photos). Name a receipt image `receipt-<something>.png` so the recorder treats it as a receipt.

After adding photos, on a machine with the NVIDIA key run `npm run record-vision`; it saves the model's real answers
into `../vision-cache/`, and SAMPLE_MODE replays them. Until a photo has a saved answer, sample mode tells the parent
that photo reading needs the live model.

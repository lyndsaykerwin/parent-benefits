# Demo polish: loading screen + photo scan (Oct 27, 2026)

Approved by Lyndsay in chat. Save (commit to main) after each piece so work survives running out of credits.
Only commit the files each piece touches; the deck changes and `codebase_export/` in the working tree are NOT part of this work.

## Pieces

- [ ] A. Loading screen (`bundle/client/src/pages/Feed.tsx`): remove the seconds counter (parent + owner screens); replace the timer-driven checklist with real per-helper progress (`stepsFromStream()` in `client/src/lib/stream.ts`); add a live "N benefits found so far · $X" line from parent-safe `card_ready` cards. Update Feed tests.
- [ ] B. Scan sheet (`bundle/client/src/components/scan/ScanSheet.tsx`): drop `capture="environment"` so phone + receipt paths both offer "Photo Library" as well as the camera. Button label should say take *or choose*.
- [ ] C. Synthetic photos (`bundle/server/ingest/photo.ts`, `bundle/data/sample/vision-cache/`): loosen the "street address" rejection so a store address on a receipt is fine; record practice-mode answers for `receipt-maple-moon-sample.png` and `item-britax-recall-sample-label.png` (the browser-redrawn JPEG copies) so SAMPLE_MODE returns the right results.
- [ ] D. QC each piece, browser check, final save.

Dropped by Lyndsay: "Try this example" buttons; limiting photo library (a website can't).

## Status log
- Piece B done: phone scan (gear and receipt) no longer forces the camera; button now says "Take or choose a photo" so parents can pick a photo they already took. ScanSheet tests 17/17, gear-locker acceptance 3/3, TypeScript check clean.
- Piece A done: checking screen has no seconds counter (parent and owner); the parent checklist now lists every line at once and ticks each off when its helpers really report done (no timers); a quiet line counts finds so far ("2 things found so far · about $500", cards stay hidden). Client tests 295/295, v2 acceptance 24/24, TypeScript check clean.

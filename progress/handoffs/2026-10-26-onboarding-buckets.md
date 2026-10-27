# Handoff: 5-question onboarding, Checking screen, money buckets (Oct 26, 2026, evening)

Read first: CLAUDE.md, AGENTS.md, then `progress/handoffs/2026-10-26-local-push-and-phone-test.md` (the steps there are still open).
Deadline: submission due Oct 27, 23:45 UTC. Lyndsay had ~7% weekly usage left, so this session worked without helper agents.

## Done this session (all committed on local `main`, NOT pushed)
- `6810df6`: saved the previous session's unsaved work (tester gate, photo jobs, send-to-self, tests, sample caches, removed render.yaml).
- `34ffe03`: Home header now shows 3 buckets instead of one merged number: Immediate cash back, Annual tax return (badge "Paid upon filing 2026 taxes (Spring 2027)", year computed), Paid family leave ("Up to $1,230/wk" for MA). The merged total stays as a small "Total found" line. File: `bundle/client/src/pages/tabs/HomeTab.tsx` (not VersionB.tsx, which only hosts the tabs).
- Checked and already done before this session, no change needed:
  - `Onboarding.tsx` already has the 5 steps (stage, date, ZIP, household + how each parent earns, insurance) and sends all of them to `api.startRun()`. Work setups cover the 4 requested ones (and mixed cases).
  - `Feed.tsx` Checking screen already lists only answer-based lines (`client/src/lib/checking.ts`) and waits for a "View my results →" tap; no auto-redirect for parents.
- Tests: type check clean, `npm test` 1413 pass / 0 fail, `npm run test:v2` 23/23. Seen working in the browser (sample family Maya).

## Rulings / questions for Lyndsay
- Old rule "Home never says 'cash'" was relaxed: only the "Immediate cash back" label may use it (test updated in `VersionB.test.tsx`).
- The 3 buckets add up to less than "Total found" because the baby savings account ($1,000 Trump Account) is in the total but in none of the 3 buckets. Decide: add a 4th line, or leave as is (it is still shown in the buckets section lower on Home).

## Next
1. `git push origin main` (Lyndsay or next session).
2. Continue the open steps in the earlier Oct 26 handoff (phone test, Nightshift check, real-mode click-through, README/demo script).

## Later the same evening: Gear locker + "I got this" task
- Savings tab now lists every scanned gear item ("Inspected nursery gear": photo, brand + name, Model · UPC, recall result), so a clean scan is never swallowed. Code: `InspectedGear` in `bundle/client/src/components/scan/GearLocker.tsx`; test in `__acceptance__/v2/s2-gear-locker.test.tsx`.
- Badge says "No recalls found", NOT "Verified Safe" (Lyndsay's prompt asked for "Verified Safe", but plan ruling round 3 R7 forbids it and a test enforces it). "Could not check" results never get the badge. Lyndsay to confirm.
- "I got this / Not relevant / Undo" drawers, Claimed so far and Still to claim already existed (`hooks/useClaims.ts`, `ClaimDrawers` in `pages/tabs/shared.tsx`); answers are saved per family in the browser + server. No change made; storage key was not renamed to `bundle_claimed_cards`.
- Sample family Maya has no saved gear, so the new list is only visible after scanning a photo.

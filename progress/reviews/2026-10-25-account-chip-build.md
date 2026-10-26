# Account moves into the family chip (option B), Oct 25, 2026

## What changed, in plain English
- The bottom bar is back to 5 tabs: Home, Taxes, Savings, Insurance, Deals. Account is no longer a tab.
- The family label at the top of the screen (the "chip") is now a button. Tapping it opens a small menu with:
  - "Switch family": Maya, Leo, Ava (samples) and "My saved profile". It is the same list and the same logic as on the Account screen (moved into one shared file, not copied).
  - "Your plan and memory": opens the full Account screen, unchanged (answers, gear locker, memory, Forget everything, Start over, its own Switch family).
- The menu closes when you tap outside it, press Escape, or pick something. The button tells screen readers it opens a menu and whether it is open. Every row is at least 44px tall.
- Switching family from the chip lands on Home. Switching from inside Account still lands on Account, as before.
- Chip wording (updated per the coordinator's change): sample families keep their name ("Baby Maya · day 20", "Leo · due in 45 days"). A family the parent typed in now says "Your family · day 20" / "Your family · due in N days", never "Baby Guest". "Baby Guest" came from the server naming every typed-in family "Guest" (server/routes/bundleRoutes.ts) and the chip putting "Baby" in front. The "Save your plan" name is not shown on the chip.
- Account never had its own web address; which screen is open is remembered per run in the browser's session storage. That still works (a saved "account" screen still reopens on reload).

## Files
- New: client/src/pages/tabs/FamilySwitch.tsx (shared switch list + logic), client/src/pages/tabs/FamilyChipMenu.tsx (the chip button and menu), client/src/pages/tabs/__tests__/FamilyMenu.test.tsx (6 tests)
- Changed: client/src/lib/bundle.ts (familyChip), client/src/lib/tabs.ts (comment), client/src/components/AppShell.tsx (chip slot), client/src/pages/tabs/TabBar.tsx, VersionB.tsx, AccountTab.tsx, client/src/pages/Feed.tsx and CardDetail.tsx (chip wording), tests: __acceptance__/v2/helpers.tsx, s6-account.test.tsx, tabs/__tests__/LaneE.test.tsx, VersionB.test.tsx

## Checks
- Type check (`npx tsc --noEmit`): passes. It first failed because `@tavily/core` was listed in package.json but not installed on this Mac; ran `npm install` (no lockfile change kept).
- `npm run test:v2` (acceptance): 6 suites, 22 tests, all pass.
- `npm test`: 1171 passed, 6 failed, 11 skipped (1188). The failures are not from this work:
  - server/__tests__/agentLogCoverage.test.ts (5): caused by the uncommitted changes already in data/sample/zetaris-cache (26 files). With those set aside temporarily, the full suite is 1177 passed, 0 failed, 11 skipped. Those files were put back untouched.
  - server/__tests__/eval.test.ts (1): flaked; passed 13/13 on a single rerun.
- Looked at it in the real app at phone width (375px): found the menu ran off the left edge of the screen; fixed by anchoring it to the full header. Then confirmed the menu fits and "Your plan and memory" opens Account.

## Open points
- At 375px the chip text still gets cut short ("Baby Maya · day …") because the Scan button takes room. Not fixed here.
- Another session was editing server files (offer search, liveFinds test) at the same time; nothing committed by me.

## Follow-up: chip no longer cut off at 375px
- On a phone (narrower than 640px) the chip shows only who it is: "Maya", "Leo", "Your family", plus the arrow. From 640px up it shows the full label ("Baby Maya · day 20", "Your family · day 13"). Screen readers always hear the full label ("Family menu: Baby Maya · day 20").
- New helper `familyChipParts` in client/src/lib/bundle.ts; `familyChip` is unchanged for other pages.
- Checked with agent-browser on a test server (port 5055, sample mode, now stopped). Results: 375px Maya chip 68px wide, Your family 104px; 768px both 150px. No text cut off at either width. All chips 44px tall.
- Screenshots: progress/reviews/2026-10-25-chip-375.png, -768.png, -375-typed-in.png, -768-typed-in.png. The typed-in family was made-up answers (born Oct 12, 2026, ZIP 02139).
- Tests: added a narrow/wide label test plus familyChipParts cases. FamilyMenu, bundle, LaneE and VersionB tests: 48/48 pass. test:v2: 22/22 pass. Type check passes.

# W3-VERSIONB QC (commit c97da3f)

Verdict: PASS with 2 must-fixes (both small, neither blocks merge).

## Runs (worktree bundle/)
- npm test: 51 suites passed, 1 skipped; 698 passed, 10 skipped, 0 failed (matches expectation).
- tsc --noEmit: 0 errors. vite build: OK (client JS 340 kB).
- Worktree git status clean after runs.
- Dry-run merge of branch into current main (temp worktree, removed): clean, no conflicts (git merge-tree --write-tree also clean). Merged tree: tsc-free client tests 144/144 pass; full jest 844 pass, 2 fail (sampleMode "typed-in family" and eval "6 traps"); the SAME 2 fail on plain main, so not caused by this branch (they are the known Mac re-record replay tests).

## A. Done check
- Five tabs Home/Taxes/Savings/Insurance/Deals: yes (tabs/TabBar.tsx, VersionB.tsx). "+" (AddPurchaseButton) is in AppShell `action`, so it appears on every tab.
- "+" flow: uses checkPickedFile/preparePhoto (photoPrep) then sendPhoto -> POST /api/photo/read; message uses real `stored` (describeReading: stored 0 -> "nothing new was added"; `stored` missing falls back to items.length). Non-ok status shows server message. Tests in AddPurchaseButton.test.tsx.
- Expecting vs baby's here: stageOf; Home leads with free gifts when expecting, "Starts at birth" labels, Insurance badge 0, tests in VersionB.test.tsx for both.
- Extras: "I got this" ticks with "$ claimed" (localStorage per family), ShareBar shares only window.location.origin (no run id/names/amounts), SaveListCard labelled "Demo: not built yet" with demo-only message. Google sign-in estimate: should be in builder's report (not re-checked).
- Wording: grep of non-test client code finds no "cash", no daycare card, no dollar literals (all amounts via fmtUsd/fmtUsdShort from run data). "Check with your job" pill replaces the verdict for DCFSA and paid family leave; amountCaption returns null for them; they are excluded from totals and ticks. Real output examples confirm ids (benefit-dcfsa_life_event, benefit-ma_pfml) and null amounts, so the regex matches.
- Owner-panel slot: `ownerPanel` renders only when `owner` true (data-testid owner-panel-slot); lines passed to tabs only for owner; Feed.tsx only fetches trace when owner. Slot currently `ownerPanel={null}` (AgentWorkspace not on branch).
- howWeChecked.ts: clawback-fsa key pattern = `v_purchase_items WHERE id = N` (matches factChecker.ts:144); clawback-price = `v_purchase_items p JOIN ... WHERE p.id = N` (matches factChecker.ts:163-168); kind patterns `fsa_eligible_categories` and `po.price_cents < p.price_cents` match clawback.ts:27 and :42. Drift-guard test (howWeCheckedEvidence.test.tsx) passes.

## B. Merge risk
- No conflicting files. Branch touches only client/ and shared/bundle.ts; main's only client/shared changes since the branch point are new AgentWorkspace.tsx + its test.
- howWeChecked vs W3-SAFETY recallDetailsSql (recall.ts:89): recall card key pattern `cpsc_recalls ... RecallID = N` is satisfied by factChecker.ts:137 (`WHERE RecallID = id`), not by recallDetailsSql (`RecallID IN (...)`), so the new details query is not shown as a card's own evidence line (harmless, it carries no item_text, so the recall kind pattern `item_text ... v_purchase_items` still hits pairsSql). Labels still match after merge; merged client tests pass.
- Wiring left: Feed.tsx must mount `<AgentWorkspace runId={runId} />` into `ownerPanel` after merge (comment in Feed.tsx:184-186).

## C. Accessibility / phone
- TabBar: `<nav aria-label="Main">` with real buttons, aria-current="page", min-h 60px, labels always shown, safe-area padding; badge has aria-label. Tab region has role=region + label. Keyboard works (native buttons). It is not role=tablist, which is fine for a nav.
- "+" button 44x44 with aria-label; dialog has role=dialog, aria-modal, labelled title, Escape closes, focus returns to opener (no focus trap inside the dialog: nice-to-have).
- Page max-w 480 with 16px gutters, header chip truncates (min-w-0), bottom padding pb-32 clears the bar. No automated 375px no-horizontal-scroll test exists (jsdom can't measure); visual check on a real phone/screenshot still needed.

## D. Deadline-bug root cause (read-only)
"Ends Oct 3, 2027" is a DISCOUNT card ("Ends" is the discount prefix in cardDeadline, client bundle.ts:193). The server sets an offer's deadline as birth-or-due date + the offer's `max_age_days` (the oldest baby age the offer fits, not an end date):
- bundle/server/agents/finePrintCourt.ts:205 `anchor = birthDate ?? dueDate`, :220 `deadline: addDays(anchor, offer.maxAgeDays)` (same again at :302 and :312). For a guest with a due date this lands about a year later (e.g. 2027-12-20).
- Fix belongs to W3-COURT/W4-ORCH: use the offer's real end date (if the table has one) or leave deadline null; do not derive from baby age.

## Must-fixes
1. client/src/pages/tabs/InsuranceTab.tsx:12 and tabs/shared.tsx CardStack: for an expecting family only deadlines within 60 days get the "Starts at birth" label (tabs.ts:~83); the year-long paid-family-leave card still shows "By <date a year out>" (cardDeadline, FeedCardView.tsx:44). M6 says expecting deadlines say "starts at birth". Pass a "Starts at birth" deadlineLabel for every benefit with a deadline when stage is expecting. (No test covers a PFML card for an expecting run.)
2. client/src/pages/Feed.tsx:186 `ownerPanel={null}`: mount W3-PANEL's AgentWorkspace after merge (owner-only; slot is ready and tested).

## Nice-to-haves
- Static pill "Every amount checked against its source" (HomeTab.tsx) sits beside "likely" amounts; soften to "Checked against official sources".
- Focus trap in the photo dialog (AddPurchaseButton.tsx).
- Add a 375px screenshot check; server does not yet send `stateNote` (client falls back to family.state / coming-soon card, works).
- Offer deadline bug (D) will show wrong "Ends" dates in Deals and cause Value Score "expired" confusion until fixed in agents.

### Task 12: Mobile-first UI

**Files:** Create `client/src/pages/Onboarding.tsx`, `Feed.tsx`, `CardDetail.tsx`, `Smarter.tsx`, `client/src/components/ReceiptCard.tsx`, `FeedCardView.tsx`. Modify `client/src/App.tsx` (routes `/`, `/feed/:runId`, `/card/:id`, `/smarter`). Test `client/src/components/__tests__/FeedCardView.test.tsx`.

**Interfaces:**
- Consumes: Task 10 API, `shared/bundle.ts`.
- Onboarding: 3 inputs, plus the buttons `Try as guest` (picks maya), `Connect a card` (Plaid Link) and `Upload Amazon orders`.
- Feed:
  - `ReceiptCard` (`$X found · N deadlines (next in D days) · M items safety-checked`)
  - grouped cards in the order clawback, recall, benefit, discount, coming_soon
  - the banner when present
  - a progress list while running, fed by streamed trace lines (polling `/api/runs/:runId/trace` every 1s)
- CardDetail: "How we checked" (trace lines for that card, sources) and the `I got this` / `Report issue` buttons.
- Smarter: case-law proposals with Approve (admin only), approved rules with confidence, and the eval scoreboard (Task 13 JSON).

- [ ] Step 1: Write the test: `FeedCardView` renders the amount as `$28.99`, a `verdict:'likely'` card shows `Likely eligible`, and the sources render as links.
- [ ] Step 2: Run. Expected: FAIL. Step 3: implement (shadcn components, 375px-first, readable contrast). Step 4: run. Expected: PASS.
- [ ] Step 5: Manual check at 375px: guest flow → Receipt → card detail → report issue. Screenshot to `docs/screens/`.
- [ ] Step 6: Commit `feat: mobile-first onboarding, feed, card detail, smarter screens`.


---
**Binding context (read too):** overrides.md, global-constraints.md, and the "Rulings" section of progress.md, all in this folder. Where they conflict with the text above, they win. Key rulings: guest only (no Firebase; "Reviewer mode" token instead of admin); the Receipt is split into `moneyBackCents` + `likelyBenefitsCents`; the court caps at 5 offers; reuse the existing Zetaris objects `bundle_pg` and `bundle_live.cpsc_recalls`; never drop the Neon table `spike0_amazon_orders`. Repo: /Users/lyndsay/Documents/hackathon/bundle (local `main`, never push).

**Controller specifics:** match the visual design system in /Users/lyndsay/Documents/hackathon/presentation/deck/design-system.md (colours, type, radii, card styles) and the mockups in presentation/deck/slides/slide-04.png, so screenshots match the deck. The Receipt shows two numbers, "$X money back" and "$Y in benefits you likely qualify for", plus deadlines and items checked. The insurance-deadline card is pinned on top. There's no sign-in UI. The "Bundle got smarter" screen has a Reviewer-mode token field (stored in sessionStorage) for approving case law. Coming-soon tiles: "Pre-filled applications", "We'll watch for price drops", "Connect your bank (Plaid)".
- **API shape from Task 10:** `POST /api/run` returns `202 {runId}`. Poll `GET /api/runs/:runId` (status, plus BundleResult when done) and `GET /api/runs/:runId/trace` (lines so far) every 1s to show agent progress ("Fact-Checker sent 1 back…"). Read server/routes/bundleRoutes.ts for exact shapes before building. Cards with verdict `info` show the "Not yet verified" label. The DCFSA card shows "eligible spend", not money back.

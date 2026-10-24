### Task 10: API routes, guest mode, roles and Coach

**Files:** Create `server/routes/bundleRoutes.ts`, `server/agents/coach.ts`. Modify `server/routes/index.ts`, `server/middleware/authHelpers.ts` (add `requireAdmin`). Test `server/__tests__/bundleRoutes.test.ts`, `coach.test.ts`.

**Interfaces:**
- Produces, over HTTP:
  - `POST /api/run` with body `{familyId}`, or `{zip, birthDate|dueDate, employer}` to create a family (validates ZIP `/^\d{5}$/` and that `zip_states` has its prefix, else 400 `Enter a valid US ZIP code`). Inline families default to `householdSize: 3`, `annualIncomeCents: null` (the WIC card is skipped; the Planner treats null income as unknown), `dcfsaOffered: true` (DCFSA cards marked `likely`). Returns `BundleResult`. Guests may run seed families without auth.
  - `GET /api/runs/:runId/trace` returns `TraceLine[]`
  - `POST /api/feedback` with `{familyId, cardId, kind, note}` saves to Neon, then calls `proposeRules`
  - `GET /api/case-law` returns proposals and approved rules
  - `POST /api/case-law/:id/approve` (`requireAdmin`; admin = email in `ADMIN_EMAILS` or `users.role='admin'`) calls `memory.addRule`
- Coach: `proposeRules(feedbackRows: Feedback[], llm): Promise<{ text: string; confidence: number; sourceFeedbackIds: string[] }[]>`, proposing only when ≥2 `issue` reports share a theme (LLM clusters; confidence = min(0.9, 0.5 + 0.1 × reports)).

- [ ] Step 1: Write the tests (supertest is already in the template):
  - `POST /api/run {familyId:'leo'}` without auth gives 200, with `cards.length ≥ 9`
  - `POST /api/run {zip:'00000',...}` gives 400 with the exact message
  - approve as a non-admin gives 403
  - the 11th unauthenticated run from one IP within 10 minutes gives 429
  - the Coach with 3 `issue` notes mentioning shipping returns 1 proposal with confidence `0.8`
- [ ] Step 2: Run. Expected: FAIL. Step 3: implement. Step 4: run. Expected: PASS. Step 5: commit `feat: bundle api, guest mode, admin role, coach`.


---
**Binding context (read too):** overrides.md, global-constraints.md, and the "Rulings" section of progress.md, all in this folder. Where they conflict with the text above, they win. Key rulings: guest only (no Firebase; "Reviewer mode" token instead of admin); the Receipt is split into `moneyBackCents` + `likelyBenefitsCents`; the court caps at 5 offers; reuse the existing Zetaris objects `bundle_pg` and `bundle_live.cpsc_recalls`; never drop the Neon table `spike0_amazon_orders`. Repo: /Users/lyndsay/Documents/hackathon/bundle (local `main`, never push).

**Controller specifics (override the roles/admin text):** there's no auth. "Reviewer mode": `POST /api/case-law/:id/approve` requires header `x-reviewer-token` equal to env `REVIEWER_MODE_TOKEN` (403 otherwise, and 403 if the env var is empty). Guests may run seed families (`maya`, `leo`, `ava`), or an inline family that is **not persisted** (validate the ZIP via `zip_states`; defaults per global constraints). Rate limit unauthenticated `POST /api/run`: 10 per IP per 10 minutes (`express-rate-limit`). `POST /api/feedback` is also rate-limited (30 per IP per 10 minutes) and only accepts seed family ids or a run's family id.

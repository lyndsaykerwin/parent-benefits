# Tracking: Interactive deal auditor & B2B save (Deals tab)

Started: 2026-10-26 evening. Resume here if this session stops.

## Goal
Deals tab: paste-any-offer auditor, live Fine Print Court output, save confident grades to `offer_checks` (`source: user_audit`), brief ZIP scanning line, exact baby-age badge.

## Files we are allowed to change (task)
- Primary: `bundle/client/src/pages/tabs/DealsTab.tsx`
- Server: `bundle/server/routes/offerRoutes.ts` (this is the real `POST /api/offers/audit` route; `offerAuditRoutes.ts` is the public brand totals view)
- Needed supporting files (cannot do the UI without them):
  - `bundle/client/src/lib/offers.ts` (age line + scanning copy + paste helpers)
  - `bundle/shared/offers.ts` (audit reply may include Value Score)
  - `bundle/server/offers/dealAudit.ts` (already saves `user_audit`; add Value Score on the reply)
  - tests: `bundle/client/src/__acceptance__/v2/s5-deals.test.tsx`, `bundle/client/src/pages/tabs/__tests__/LaneD.test.tsx`

Do **not** touch `HomeTab.tsx`, `Onboarding.tsx`, or `Feed.tsx`.

## What already existed
- Full “Audit a deal” screen: `client/src/components/AuditDeal.tsx`
- `POST /api/offers/audit` → `auditDeal()` already writes `offer_checks` with `source: 'user_audit'` when the full AI court ran, both sides agreed, no hidden orders, text ≥ 20 chars
- Offer cards already show fine-print / minutes / true value

## Work
1. [x] Inline card “Check Any Offer or Registry Deal” at top of Deals (textarea + Audit Deal). Keep the existing full Audit-a-deal button so older tests still work.
2. [x] Show Deal Hunter vs Fine-Print Lawyer, Value Score, Approved/Blocked.
3. [x] Confirm save path; attach Value Score on the audit reply.
4. [x] Brief “Scanning verified offers for your ZIP code…”
5. [x] Age badge: `Matches your baby's exact age (Day N)`
6. [x] `npm run check` + Deals/audit tests (2026-10-26: tsc clean; s5 8/8; LaneD+offerRoutes 28/28)

## Ruling
Keep the existing full audit form (store / what you get / screenshot). The new card is a faster paste-only path that fills store/offer from the pasted text (Babylist / Target / Amazon / “Pasted offer”).
Changing save rules to “approve only” would drop blocked deals from the shared brand totals — keep save-on-agreed-full-court (current R2).

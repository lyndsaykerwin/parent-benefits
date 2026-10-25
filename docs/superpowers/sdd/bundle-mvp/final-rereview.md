# Final fix wave: scoped re-review (base d17c2a3 .. b0171e6)

Read: the findings list, the controller rulings, the fix report, the whole fix diff, plus a few direct checks (cache file count, `package.json` scripts, the saved examples and learning traces, the Coach and feedback code). Nothing was changed in the repo.

## Verdicts

| # | Verdict | Evidence |
|---|---|---|
| C1 Cursor claim | ADDRESSED (per ruling) | Removed from README header, tech table, section 13 and `metadata.json`. Remaining mentions are the ruled wording only. A grep of README, metadata and docs finds nothing else (other "cursor" hits in `client/src/components/ui` are CSS). Residual risk below. |
| I1 Receipt deadlines | ADDRESSED | `counts(c)` added to the deadline filter. Two tests: a unit test on `assembleFeed` and a `runBundle` test with the benefits agent failing. |
| I2 Unchecked deals under "passed" | ADDRESSED | Separate group titled "Offers not yet checked by Fine Print Court", stand-ins reworded, Prime/fee stand-ins dropped via the shared `offerScreen.ts`. Tests in `bundle.test.tsx` and `fallback.test.ts`. Saved examples show no Prime or Babylist box. |
| I3 Offline court wording | ADDRESSED (ruling wording used) | Approve text is "Offline screen: no flagged terms found. Not reviewed by the AI court." in the reason and the card body. The offline screen also rejects "requires Prime/membership" and "fee may apply". The auto-renew trap stays approved offline on purpose (the learning demo), and README section 6 says so. Tests cover both. |
| I4 Typed-in families in SAMPLE_MODE | ADDRESSED | `isInlineFamily` guard in benefits, clawback, recall and `purchaseKeywords`; the court makes one all-offers query and filters by age in code. Unit tests plus an end-to-end SAMPLE_MODE test. `custom-family.json`: 13 cards, no banner, $3,640 benefits, 3 deadlines. Cache holds 126 files, matching the README. |
| I5 "all clear" with nothing checked | ADDRESSED | `ReceiptCard` shows a neutral "Connect your data to safety-check items" when `itemsChecked === 0`. Test added. Leo and custom-family now hit this path. |
| I6 Real-model evidence / offline Coach | ACCEPTED-BY-RULING | No real-model run exists (needs the NVIDIA key). The disclosure is in the README Coach row and sections 6, 8 and 11, and names `THEMES` in `coach.ts`. Still open for Lyndsay: capture a real-model run when the key arrives. |
| I7 Evidence at final code | ADDRESSED, with a documented deviation | Learning traces now have `zetaris` lines (run1 24, run2 23) and `memory recall_rules`. The `memory add_rule` line is in a separate `approve.jsonl`, not in run 2 (documented in README section 8). The `[cited mem-1]` judge line is in run 2. The examples and scoreboard were regenerated at 915f804; the only later commit is test-only. |
| I8 Learning-loop steps | ADDRESSED | Seven README steps, and an automated test that follows them (403 without the token, 200 with it, the trap card gone, `[cited mem-` in the trace). Sending the same note twice works because the Coach counts feedback rows, not distinct text. |
| I9 Rate limit / proxy | ADDRESSED (ruling) | `trustProxyHops()` defaults to 1 in production, with `TRUST_PROXY=0/1` overrides, and `npm start` really sets `NODE_ENV=production`. Per-IP cap of 2 (429) on top of the overall cap of 5. Hosting checklist in README section 4. Tests for both. |
| M2, M3, M4, M5, M6, M7, M8, M10, M11, M13 | ADDRESSED | M7: `vendor/hmem/LICENSE` added. M8: documented in the README and a comment in `env.ts` (behaviour unchanged). M11: shared `dateRange.ts`, server 400 plus form min/max, tested. |
| M1, M9, M12, M14 | Left, as ruled | M1 is Lyndsay's product call: Maya's price adjustment expires on the demo date, yet her Receipt says 3 deadlines, next in 10 days. |

## New problems from the fix diff
No new Critical. No new Important breakage found. Notes, in order of weight:

1. **Cursor wording (watch item, not a defect).** The README says "the organizers announced it optional" as a plain fact. `hackathon-resources/hackathon-checklist.md:47-48` calls that announcement unconfirmed, and the rules in `hackathon-overview.md` still say Cursor is required. The text follows the ruling and says "confirmation on HackOS is pending". The compliance gap stays open until Lyndsay gets the written confirmation. Before submitting, either get it or soften "announced" to "reportedly announced".
2. **Cache coverage by date (Minor).** Typed-in families are checked cards only if their SQL is in the replay cache. The per-offer fact-check queries were captured by sweeping ages 0 to 720 days plus 5 due dates, measured from Oct 23. Due-date families typed during judging (Oct 28 onward) probably still hit, because the queries are keyed by offer id rather than by date. An unusual due date could miss and show the banner and stand-ins, which is a safe failure. Worth one manual try of a far-off due date and a date a few days ahead.
3. **Untested glue (Minor).**
   - `server/index.ts` calls `trustProxyHops()` but nothing tests that call (the function itself is tested).
   - The Onboarding `min`/`max` attributes have no test (the server check does).
   - The browser date picker greys out dates, but only `onSubmit` blocks bad ones.
4. **Live database reseeding (Minor, already flagged by the implementer).** `npm test` reseeds Neon when `DATABASE_URL` is set. In live mode, offer ids then drift from what the cache holds. It is harmless for SAMPLE_MODE. Make it opt-in or say so in the README.
5. **Per-IP cap in memory (Minor).** It works for one server instance. Behind two proxy hops, such as a CDN in front of the host, trusting one hop would still group visitors. The README hosting checklist says to check from two networks, which covers it.

## Bottom line
All Critical and Important findings are addressed or accepted by ruling. Lyndsay still has to do two things: confirm Cursor is optional on HackOS, and run the real-model eval once the NVIDIA key arrives.

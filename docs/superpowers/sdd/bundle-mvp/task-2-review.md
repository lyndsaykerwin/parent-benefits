# Task 2 review

Spec: PASS (all binding constraints met). Critical 0, Important 1, Minor 5.

## Spec compliance
- Families: maya 2026-10-03, leo due 2026-12-07 (no data), ava 2026-08-24, 43215/OH. families.json matches (seed reads that file, so the mirror is by construction).
- Receipt split fields, nullable annualIncomeCents, no `role`, snake_case everywhere, zip_states (MA 010-027, OH 430-459, default 000), poverty_guidelines with source_url: OK.
- Offers: 16 total; 6 rows with trigger '' / -280 / 365 (5 plus the trap; the report says 5 incl. trap, a miscount that is harmless). Trap "Free newborn diaper box" is flagged in a code comment and in the README. Every curated row has a non-empty source_url (Cuddle & Co uses an example.com placeholder, disclosed).
- 7 benefit rules with the specified values, FEDERAL_CHILD_TAX_CREDIT included. 12 FSA categories, 3 store policies.
- tablesFilter lists only the 13 Bundle tables. spike0_amazon_orders is untouched. The DROP SEQUENCE hazard was found, not run, and recorded in the Rulings.

## Fixture traps (present in the data)
- Target thermometer 2899: present, and the 'thermometer' FSA keyword matches it.
- Price drop: Pack 'n Play bought 2026-10-09 at 8999 with a 6999 observation on 2026-10-20. That is day 11 of Target's 14-day window. Present.
- Refund: Carter's -2400. Present.
- Duplicate: Walgreens tx-05 and tx-06, same date and amount. Present.
- Daycare: Bright Horizons on 08-01, 09-01 and 10-01, 1850 each. Present.
- Recall: the Amazon title "KEAWIS Crib Mattress, Dual-Sided Firm Baby Mattress" is identical to the zetaris-notes.md example (RecallID 10560, recalled 2026-01-15). The order is dated after the recall, which is correct. A title join will match.

## Seed safety
- seed() clears only Bundle tables. Transactions, orders and families are deleted by the seed family ids. Feedback and case_law_proposals are deliberately left alone. It runs in one DB transaction and is idempotent. No writes outside the Bundle tables.
- The test runs against the live Neon Bundle tables. That is acceptable and documented.

## Findings

### Important
1. seed.test.ts does not guard most of the planted traps, so it is partly a presence/length check. It asserts only the thermometer, a negative amount, and the maya/ava/leo split. It does not assert the KEAWIS order, the duplicate pair, the daycare rows, the Pack 'n Play price observation, the fixed ISO dates, or poverty/zip source URLs.
   - Why it matters: a later edit could silently remove a trap that downstream agent tests rely on.
   - Fix: add assertions for the KEAWIS title and asin, two Walgreens rows with the same date and amount, 3 Bright Horizons rows, the price_observations Pack 'n Play row, maya.birthDate, leo.dueDate and ava.birthDate, and a non-empty source_url on poverty_guidelines and price_observations.

### Minor
1. scripts/seed.ts:357 has the semicolon inside the trailing comment (`... // run from the repo root ...;`). It works through automatic semicolon insertion but is fragile. Move the comment.
2. The price-drop observation (2026-10-20) is 11 days into a 14-day window. Any "today" later than 2026-10-23 makes the window lapse. Make sure the agent uses a fixed as-of date or the fixture date.
3. The Chewy offer cites the homepage, and several offer and store-policy URLs were not fetched. This is disclosed, and the Fact-Checker is meant to verify them.
4. The poverty guideline figures could not be independently checked in this review. They are plausible, and the report claims they were verified at aspe.hhs.gov.
5. maya has daycare payments from August but a birth date of 2026-10-03. This is odd but harmless for the traps.

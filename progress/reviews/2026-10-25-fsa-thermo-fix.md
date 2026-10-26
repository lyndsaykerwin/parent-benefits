# FSA receipt matching fix: "INFANT DIGITAL THERMO" (Oct 25, 2026)

## The problem
When you scan a receipt, each line is checked against the list of things you can pay for from a health FSA
(flexible spending account: a tax-free health spending account from your job) or HSA (health savings account).
The checker only looked for the whole keyword inside the line. The list says "thermometer", the receipt says
"THERMO", so the thermometer showed "No money back found". (First noted in `2026-10-25-job4-vision.md`.)

## Where the code is
- `bundle/server/ingest/gearRecall.ts`, function `moneyBackFor` (used by the receipt scan in `server/routes/photoRoutes.ts`).
- The keyword list itself (`FSA_CATEGORIES` in `bundle/scripts/seed.ts`) was not changed.

## The fix (general, not a one-off)
The line and the keyword are split into words. Every word of the keyword must appear on the line, either:
1. as the same word, plural or not ("PADS" = "pad", "THERMOMETERS" = "thermometer");
2. as the start of the word, at least 4 letters ("THERMO", "THERM" for thermometer); or
3. with vowels dropped: at least 4 letters, same first and last letter, all letters in order ("ASPRTR" for aspirator,
   "THERMOMTR" for thermometer).

Guards against false matches: short forms under 4 letters never count; a short form can't be longer than the word;
the plural trim is used only for exact words (so "THERMOS" is not "THERMO"); two-word keywords need both words
("GAS STATION" is not "gas drops"); daycare stays out (it's a Dependent Care FSA, a separate childcare account).

## Tests (written first, seen failing, then passing)
In `bundle/server/__tests__/gearScan.test.ts`, "money back on a receipt line":
- Matches: INFANT DIGITAL THERMO, BABY THERM DIGITAL, DIG THERMOMTR, THERMOMETERS 2PK, NASAL ASPRTR BABY,
  SALINE NASAL DROPS, INFANT GAS DROPS, NURSING PAD 60CT, TYLENOL INFANT SUSP.
- Does not match: THERMAL BLANKET, THERMOS BOTTLE, SALT AND PEPPER, SUN HAT, GAS STATION SNACK,
  BREAST MILK STORAGE BAGS, NURSING PILLOW, ASPEN CANDLE, THE BABY DAYCARE BOOK, diapers, empty line.

Results: related server suites (photo, gearScan, clawback, sampleMode, recall, ingest, loopsEndToEnd):
10 suites, 193 tests passed. `npm run check` (the type check) passed.

## Is a baby thermometer really FSA-eligible?
Yes.
- IRS Publication 502 (2025 edition, the current one): "You can include in medical expenses the cost of devices
  used in diagnosing and treating illness and disease." https://www.irs.gov/publications/p502
- HSA Store lists thermometers as "100% HSA eligible", for example
  https://www.hsastore.com/caring-mill-digital-thermometer-with-case/40762.html (found by web search Oct 25, 2026;
  the page blocked automatic reading, so the label is from the search result).
- The seed list's existing source, https://fsastore.com/baby-thermometers.html, also blocked automatic reading today.

## Left alone on purpose
- The Money-back agent's database query (`server/agents/clawback.ts`, `KEYWORD_MATCH`) still uses the plain
  "contains the keyword" match. Changing it would change the saved Zetaris answers (`data/sample/zetaris-cache`),
  which another helper is working on. Worth aligning later if real store lines feed that path.
- Nothing committed.

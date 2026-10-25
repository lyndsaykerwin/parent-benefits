# Getting purchases into Bundle: barcode scanning and photos (with email receipts)

Written Sat Oct 24, 2026 (cloud session). Research only: **no code changed, nothing committed, nothing cut or ranked.** Builds on `research-email-receipts.md` (path 1) and `research-nightshift-setup.md`. Sources are listed at the end with the date each was read.

Lyndsay's decision: parents get item data into Bundle three ways.
1. **Forward email receipts** (already researched in `research-email-receipts.md`).
2. **Scan a barcode** with the phone camera.
3. **Take a photo** of an item in the house (for example the label under a baby walker, or the bottom of a formula can) or of a **paper receipt**. An NVIDIA AI model that can "see" pictures turns the photo into a tidy row of facts, so Zetaris (the required "data door" that lets one SQL question read many sources at once; SQL is the standard language for asking a database questions) can match it against live recalls, offers and benefit rules.

Plaid (the bank-connection service) is out.

---

## The big finding first (read this)

**I checked the live recall feeds on Oct 24 and the result changes how matching should work.**

- **CPSC** (the US Consumer Product Safety Commission, which recalls cribs, walkers, toys and so on) has a field called `ProductUPCs`, but **only 22 of 739 recalls since June 2025 fill it in (3%)**, and **only 1 of 86 baby-related recalls** does. Its `Products.Model` field is **empty in all 739**. So "scan the barcode, match the UPC" (a UPC is the 12-digit number under a barcode) will almost never hit a CPSC baby recall.
- **But the model number is usually there, inside the free text.** About **50 of the 86 baby recalls** say things like *"Model No: MY002" is printed on a label on the back* (ONTHEWEI bath seat, recall 11014), *"Model No.: RV001" is printed on a label under the walker's seat* (Kmaier walker, 10959), or *"Item number B11654 and the UPC 669028116546 are printed on the bottom of the packaging"* (Boon baby bottles, 10803). That is exactly what a **photo of the item's label** captures. So path 3 (photo of the item) is the one that unlocks precise CPSC matches.
- **openFDA** (the US Food and Drug Administration's free data service; we use its food recall list for infant formula) has **no separate UPC field**, but **31 of the 42 infant-formula recalls write the UPC inside `product_description`** (for example *"Retail UPCs: 070074537306"*, Similac For Spit Up), and **36 of 42 list lot codes in `code_info`** (a lot code is the batch number printed on the can, e.g. *"Lot 300357651Z - USE BY 04JUL2024"*). So **barcode → formula recall** works well, and **photo of the can bottom → lot code → exact recall** is even more precise. 17 of the 42 are "Terminated" (finished) and must be filtered out, as `plans/architecture.md` already plans.

My own count, Oct 24, 2026: downloaded `saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=2025-06-01` (the same feed Zetaris reads, 739 recalls dated 2025-06-05 to 2026-10-22) and `api.fda.gov/food/enforcement.json?search=product_description:"infant formula"&limit=100` (42 results).

This also corrects one line in `plans/architecture.md` §"Product matching": the planned "Bar code: Purchase UPC = CPSC `ProductUPCs`, confidence 0.99" is still right to build, but on its own it will rarely fire. The model-number and lot-code matches do most of the precise work.

---

## 1. NVIDIA models that can read pictures

All of these sit on **build.nvidia.com** and are called through the same **OpenAI-compatible** address Bundle already uses (`https://integrate.api.nvidia.com/v1`; "OpenAI-compatible" means the request looks like an OpenAI request, so the same code library works). A picture is sent inside the message as an `image_url` part, usually as a "data URL" (the photo turned into a long line of text that starts `data:image/jpeg;base64,...`).

| Model (exact name on build.nvidia.com) | What it is | Best for | Notes |
|---|---|---|---|
| `nvidia/nemotron-nano-12b-v2-vl` | Small NVIDIA "vision-language" model (reads images and answers in text). Released Oct 28, 2025. | **Paper receipts** and labels. NVIDIA names "invoices, receipts, and manuals" as intended uses. OCR scores: OCRBench 85.6, DocVQA 94.4. (OCR = optical character recognition, reading printed text from a picture.) | Up to about 4–5 images per request, up to about 2048×1536 pixels. "Thinking" is off by default; put `/no_think` in the instructions to be sure. |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` | Newer NVIDIA model that takes images, video, audio and text. Released Apr 28, 2026. | **Both**: OCR is built in; scores higher on OCRBench v2 than the model above (67.0 vs 54.8). Good for product photos where it must read a label *and* understand the object. | Officially "supports JSON output". "Thinking" is **on** by default; turn it off with `enable_thinking: false` or replies get slow and long. JPEG/PNG only. |
| `nvidia/nemotron-3.5-super-vl-120b-a12b` | NVIDIA's newest big vision model, announced Oct 15, 2026. | Hard cases: messy photos, crumpled receipts. Listed with "structured output" support and positioned for "invoices, receipts". | Brand new (9 days old); slower and more likely to be busy. Good "best NVIDIA model" story. Not yet tested by us. |
| `nvidia/nemotron-ocr-v2`, `nvidia/nemotron-parse-2.0` (and `nemotron-3.5-parse`), `paddleocr` | Specialist text readers: they return the words (and where they sit on the page), not an answer to a question. | Receipts, as a first step before a text model tidies the words into a row. | Two calls instead of one; more work. Useful backup if the vision model misreads numbers. |
| `meta/llama-3.2-11b-vision-instruct`, `-90b-` | Older (2024) Meta vision models hosted by NVIDIA. | General photos. | Fine fallback, not NVIDIA's own model. |

Avoid `cosmos-reason1-7b`: its page says it was retired on Mar 24, 2026.

**Product photos vs receipts, in plain words:**
- *Receipt photo*: mostly reading printed lines. Nemotron Nano 12B v2 VL is built for this; Omni also works.
- *Item photo*: read a small label ("Model No: RV001", lot code, UPC digits) *and* say what the object is ("baby walker"). Omni or Super VL are the better fit. Ask for the exact printed text, not a guess.

**Does it return JSON reliably?** (JSON = a strict, machine-readable text format, like a filled-in form.)
- NVIDIA's own docs for its vision services say: pass `response_format: { type: "json_schema", ... }` (a "schema" is the exact list of fields and types you want back) rather than plain "JSON please". Omni and Super VL list structured output as supported. **Not confirmed** for every model on the hosted free service, so test each one.
- Bundle already protects itself: `askJson()` in `bundle/server/adapters/llm.ts` tries twice, strips code fences, checks the shape, and falls back if it fails. Keep that. Add one rule: **any field the model can't read must come back empty, never invented**, and a UPC is only accepted if its check digit (the last digit, which is computed from the others) is correct.

**Free limits.** The old "1,000 free credits" system is gone; the free tier is now **rate-limited, commonly about 40 requests per minute**, varying by model and traffic, with "429 Too Many Requests" errors when busy. Your own number shows on your build.nvidia.com dashboard. One photo = one request, so this is plenty for a demo. (Source: developer blog and NVIDIA forum threads, 2026; no official page states it.)

**Photo size.** Shrink every photo on the phone before sending (about 1024–1600 pixels on the long side, JPEG). This keeps requests small and fast. I saw reports of a small size cap for pictures pasted straight into a request on some NVIDIA-hosted models, but could not confirm a number; shrinking avoids the problem either way.

**What `llm.ts` needs (for whoever codes it).** Today `ChatClient` only allows `content: string` (line 20) and `generate()` takes only text. A picture needs `content` to be a list of parts (`[{type:'text',...},{type:'image_url', image_url:{url:'data:image/jpeg;base64,...'}}]`). Add a separate `see(prompt, imageDataUrl)` method and a third model setting such as `MODEL_VISION` (e.g. `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`). Raise the timeout for picture calls (today's 20 seconds is too short; 60–90 s), send `max_tokens`, and turn "thinking" off.

**Can it go through Nightshift later?** Probably yes. Meterless's Runtime 1.4 docs (engines.html, read Oct 24) say a picture is sent as an `image_url` data URL, that a picture moves the request into the **"vision"** class, and that chat accepts the vision class. So the model name would look like `meterless/vision.deep` (check the exact names with `GET /v1/models`). **Unknown:** whether Nightshift hands vision requests to NVIDIA through your key, or answers them with a small local model. Test with one sample photo once Nightshift is set up (step 12 in `research-nightshift-setup.md`). The same fallback chain applies: Nightshift → NVIDIA direct → saved answer.

---

## 2. Barcode scanning in a phone web page (no app store)

**The built-in browser tool.** Some browsers have a ready-made barcode reader called `BarcodeDetector`. As of Oct 2026 (caniuse.com): **works** in Chrome on Android and Samsung Internet; **off by default on iPhone Safari** (hidden behind a developer setting, through iOS 27.2) and on Mac Safari; **not in Firefox**. Most judges and parents will try it on an iPhone, so we cannot rely on it alone.

**Libraries (ready-made code we add):**

| Library | What it is | Status |
|---|---|---|
| `barcode-detector` (npm, version 3.2.x) | A "polyfill": it gives every browser the same `BarcodeDetector` tool, powered by ZXing (a well-known barcode reader) compiled to WebAssembly (a fast format browsers run). Reads UPC-A, UPC-E, EAN-13, EAN-8. | Actively maintained. Uses the phone's built-in reader when there is one, its own otherwise. The reader file (about 2 MB) loads from a public CDN (a file-delivery network) or can be bundled with the app. **The simplest good choice.** |
| `zxing-wasm` | The engine underneath the one above. | Maintained. |
| `@zxing/library` (zxing-js) | Older pure-JavaScript version of ZXing. | Slower; kept for backward compatibility. |
| `html5-qrcode` | Popular all-in-one scanner with a camera box. | **Paused**: the author said 2.3.8 (April 2023) is the last release. Avoid. |
| QuaggaJS / `quagga2` | Older barcode-only reader. | Original abandoned; `quagga2` fork still updated but has many open issues. |

**Simplest way to get the picture (no live video at all):** a normal file button with `accept="image/*" capture="environment"` opens the phone's camera; the parent takes one photo of the barcode; the page reads it. This works on every phone and is much easier than a live video scanner. A live scanner (the camera feed with a box) is nicer but needs the page served over HTTPS (the secure web address; the hosted Render site already is) and more testing on real phones. Always offer **"type the numbers instead"** as a backup.

**Turning a UPC into a product name (lookup services):**

| Service | Free allowance | Notes |
|---|---|---|
| **UPCitemdb** | Free trial plan: **100 lookups a day, max 6 a minute**, counted per internet address; no sign-up. Paid from $99/month. | Covers general goods (baby gear, bottles). Its docs hint browser use needs a paid plan, so call it **from our server**, not the phone. |
| **Open Food Facts** | Free, no key; **15 product lookups a minute** per address. Must send an app name and contact email in the `User-Agent` header (a label on each request). Data is open (ODbL licence: free to use if credited and shared alike). | Good for **formula and baby food**. Endpoint: `world.openfoodfacts.org/api/v3.6/product/{barcode}.json`. Sister site **Open Products Facts** covers non-food, but coverage of US baby gear is likely thin (not measured). |
| **Go-UPC** | No free tier; trial key on request by email. Paid from $74.95/month. | Only if the others miss. |
| **Barcode Lookup** | Could not check: its site blocked my reader (403). Historically a short free trial, then paid. | Treat as unknown. |

Recommendation for the demo: Open Food Facts first for food/formula, UPCitemdb second, and **save every answer** to a file so the demo never depends on these services being up (see §7). Note: many scanners return a 13-digit EAN for a 12-digit UPC (just a leading 0). Store UPCs in one standard form: digits only, 12 digits when the 13-digit form starts with 0.

---

## 3. Do the recall feeds carry UPCs, model numbers or lot codes?

| Feed | Field names (checked live Oct 24) | UPC | Model number | Lot / batch code |
|---|---|---|---|---|
| **CPSC** recall API | Top level: `RecallID, RecallNumber, RecallDate, Title, Description, URL, Products[], ProductUPCs[], Hazards[], Remedies[], Retailers[], Manufacturers[], Images[], ...`. Inside `Products`: `Name, Description, Model, Type, CategoryID, NumberOfUnits`. Inside `ProductUPCs`: `UPC`. | `ProductUPCs[].UPC`, but filled in only 22/739 (1 of 86 baby). Sometimes written in `Description` text instead (Boon bottles). | `Products.Model` empty in 739/739. Written in `Description` / `Products.Description` text in about 50/86 baby recalls ("Model No: ..."). | Sometimes in text ("Production Batch: 202509", "Batch Number: 202506001"). |
| **openFDA** food enforcement | `recall_number, status, classification, recalling_firm, product_description, code_info, reason_for_recall, recall_initiation_date, termination_date, distribution_pattern, product_quantity, openfda` (`openfda` is empty for all 42 formula records). | Inside `product_description` text for 31/42 ("Retail UPCs: 070074537306"). | Item numbers sometimes in text. | Inside `code_info` text for 36/42 ("Lot ... USE BY ...", "Batches: 23432SH00 ..."). |

**What this means for Zetaris joins** (a "join" is matching rows from two lists on a shared value):
- **Barcode ↔ CPSC UPC field**: an exact equality join, `explode(ProductUPCs)` then `u.UPC = purchase.upc`. Simple, near-certain, rarely fires. Build it anyway; it is cheap and it is the cleanest "Zetaris joins private and public data" proof.
- **Barcode ↔ openFDA formula**: `product_description` contains the purchase UPC (after removing spaces between digits). Fires often for formula. Zetaris has no fuzzy matching, but "contains this exact 12-digit number" is not fuzzy.
- **Photo model number / lot code ↔ recall text**: "recall text contains this exact code" (for example `lower(Description) LIKE '%rv001%'`, and `code_info LIKE '%300357651z%'`). Precise, because model and lot codes are unusual strings. Require codes of at least 4 characters and let the existing AI check confirm short or common-looking ones.
- Everything else keeps today's brand + words matcher plus the AI check.

So all three intake paths feed the same "exact code first, words second" ladder already sketched in `plans/architecture.md`.

---

## 4. One common row for all three paths

Today Bundle stores purchases in `amazon_orders` (id, family, date, title, ASIN, UPC, price) and card lines in `transactions` (`bundle/shared/schema.ts`). The recall view `v_recall_orders` in `bundle/scripts/zetaris/register.ts` combines the two, and `server/agents/recall.ts` reads that view. A single new table means every path (email, barcode, photo) lands in one place and the Recall Checker sees it with almost no new code.

**Proposed Neon table `purchase_items`** (Neon is Bundle's hosted Postgres database):

| Column | Meaning | Email | Barcode | Photo of item | Photo of receipt |
|---|---|---|---|---|---|
| `id` | Row id | ✓ | ✓ | ✓ | ✓ |
| `family_id` | Which family | ✓ | ✓ | ✓ | ✓ |
| `source` | `email` / `barcode` / `photo_item` / `photo_receipt` | ✓ | ✓ | ✓ | ✓ |
| `store` | Shop name | ✓ | – | – | ✓ |
| `purchased_on` | Date bought (empty if unknown) | ✓ | – | – | ✓ |
| `product_name` | Item title | ✓ | from lookup | read by AI | ✓ (often shortened) |
| `brand` | Brand | often | from lookup | read by AI | sometimes |
| `model_number` | Model / item number as printed | sometimes | – | **often** | rarely |
| `lot_code` | Batch / lot / "use by" as printed | – | – | **formula cans, gear labels** | – |
| `upc` | 12-digit UPC, digits only, check digit verified | rarely | **always** | if digits are visible | rarely |
| `size_text` | Size / colour / count | often | from lookup | sometimes | sometimes |
| `price_cents` | Price in cents (empty if unknown) | ✓ | – | – | ✓ |
| `confidence` | 0–1: how sure the reader was (barcode = 1.0; lookup hit = 0.9; AI reading = model's own score, capped at 0.8 unless a check digit or exact code verifies it) | ✓ | ✓ | ✓ | ✓ |
| `extractor` | What produced it (`email-rules`, `zxing`, `upcitemdb`, `nemotron-3-nano-omni`, `sample-cache`) | ✓ | ✓ | ✓ | ✓ |
| `input_hash` | Fingerprint of the email/photo, to stop double-counting; cannot be turned back into the photo | ✓ | ✓ | ✓ | ✓ |
| `created_at` | When added | ✓ | ✓ | ✓ | ✓ |

This replaces the separate `receipt_items` table suggested in `research-email-receipts.md` §3 (same idea, more sources).

**How it reaches Zetaris (following `register.ts`):**
1. Add `purchase_items` to `BUNDLE_TABLE_NAMES` in `bundle/shared/schema.ts`; `register.ts` then runs `REGISTER DATASOURCE TABLE 'purchase_items' FROM bundle_pg` automatically.
2. Add a **safe-columns view** (a saved query that shows only the columns an agent needs) to the `VIEWS` list, for example:
   `v_purchase_items: SELECT family_id, source, store, purchased_on, product_name, brand, model_number, lot_code, upc, size_text, confidence FROM purchase_items` (no price, no hash, no extractor details).
3. Extend `v_recall_orders` with a third `UNION ALL` (a way to stack lists): `... UNION ALL SELECT family_id, purchased_on, product_name AS item_text, source, price_cents FROM purchase_items`, plus new code columns (`upc`, `model_number`, `lot_code`), set to `NULL` for the Amazon and card rows. Re-create it with `register.ts --replace=v_recall_orders --apply`.
4. Add the exact-code joins from §3 to `recall.ts` `pairsSql()` as extra `OR` conditions (or a second small query), labelled "verified" when a code matches.
5. Remember: in SAMPLE_MODE, Zetaris answers come only from saved responses in `bundle/data/sample/zetaris-cache` (one file per exact SQL text; `server/bundleDeps.ts`). **Any new or changed SQL needs one live Zetaris run (on a machine with keys) to save its answer** before the cloud demo can show it.

Judge-friendly line: one Zetaris view now stacks items from four kinds of input (email, barcode, item photo, receipt photo) and joins them with two live government recall feeds in one question.

---

## 5. Privacy and guardrails for photos

Photos of a home can show children's faces, people, house numbers, mail with addresses, screens and documents. Phones also hide **EXIF data** inside every photo (hidden details such as the GPS location where it was taken, the time and the phone model).

**Project rule: never use real personal data.** For the demo, use only fake or public sample images (see §6).

**For the product (and to describe in the README):**
- **On the phone, before upload:** redraw the photo onto a blank canvas and save a fresh copy. This throws away all EXIF data, including GPS, and lets us shrink it. (Social sites don't reliably strip it; one report found GPS accurate to about 3 metres surviving a marketplace upload.)
- **Guide the shot:** "Fill the frame with the label or receipt. No people." A cropping box helps.
- **Send the AI only the photo, no family details.** The AI instructions say: "Only report product facts. If you see a person, a face, an address or a document that is not a receipt, return `{"rejected":"not a product photo"}`."
- **Keep:** only the `purchase_items` row (product facts) plus the `input_hash`.
- **Drop:** the photo itself right after reading (don't store it on the server or in Neon; never put it in a log, trace file or Meterless memory). From a receipt, drop card digits, loyalty numbers, cashier names, store address and anything that isn't an item line, date, store name or price.
- **Never** send photos to Meterless H-MEM memory; memory stores only feedback about an item by its row id (as in the email research).
- **"Forget my items"** deletes the family's rows.
- NVIDIA's hosted free service is governed by its **API Trial Terms of Service**; we should not send real family photos to a trial service anyway. Running the model inside Nightshift or locally is the privacy upgrade for the roadmap.
- Face blurring on the phone is possible but is extra work; the "no people, reject if seen" rule is the practical guard for the hackathon.

---

## 6. Ways to test it (evals)

An **eval** is a fixed set of test inputs with an answer key, scored automatically.

**Sample inputs (all fake or public):**
- **Barcodes (8–10):** barcode images generated by code (for example the `bwip-js` library) for real public UPCs taken from the recall feeds, such as `669028116546` (Boon NURSH bottles, CPSC 10803) and `070074537306` (Similac For Spit Up, FDA), plus a few ordinary non-recalled baby products and 2 deliberately damaged or wrong-check-digit codes.
- **Item-label photos (8–10):** CPSC recall notices include product and label photos (the `Images[]` field), often showing the exact "Model No" label; use those (government notices, credit the source), plus look-alike labels we make ourselves with a different model number (to test "don't raise a false alarm").
- **Receipt photos (5–6):** fake receipts we draw ourselves (HTML printed to an image, then photographed or slightly tilted/blurred by code) from made-up stores and orders; one crumpled, one cut off, one non-receipt (a grocery list).
- **Must-reject photos (3):** a photo containing a (stock or AI-made) face, an envelope with a fake address, a blank wall.

**Answer key per input:** expected `product_name`, `brand`, `model_number`, `lot_code`, `upc`, `store`, `date`, `price`, and the recall id that should (or should not) match.

**Scores to report (in plain words):**
- Field accuracy: "of the codes the AI read, X% were exactly right" (codes must match character for character).
- Made-up rate: "the AI filled in a field that wasn't on the picture Y times" (target 0).
- Recall alerts: "of alerts raised, X% were right; of real recalls in the set, we caught Y%".
- Rejects: all must-reject photos rejected, nothing stored.
- Barcode: all good codes read; bad check digits refused.

These slot into the existing `npm run eval` scoreboard (`bundle/evals/expected.json`), with the photo cases run in SAMPLE_MODE from saved answers and in live mode on the Mac.

---

## 7. Effort, and what works in the cloud without keys

**SAMPLE_MODE** = the app's offline mode: it ignores keys and uses saved answers so the hosted demo never breaks. For photos, that means saving each sample photo's model answer in a file named by the photo's fingerprint (the same pattern as `data/sample/zetaris-cache`), and offering "Use a sample photo" buttons.

| Piece | Hours | Cloud, no keys (SAMPLE_MODE)? | Needs live keys / real device |
|---|---|---|---|
| **Shared: `purchase_items` table, safe view, `v_recall_orders` change, `register.ts` update** | 1–1.5 | Code + tests yes | Running `register.ts --apply` needs Zetaris + Neon keys |
| **Shared: exact-code joins in `recall.ts` (UPC, model no., lot code) + tests** | 2–3 | Yes, with hand-made test rows | One live Zetaris run to save new SQL answers to the cache |
| **Barcode path**: photo/file button + `barcode-detector`, type-it-in backup, UPC clean-up and check digit, server lookup (Open Food Facts → UPCitemdb) with saved answers, sample barcode images | 3–4 | Yes (decode sample images in tests; lookup answers saved) | Camera test on a real iPhone + Android over HTTPS; live lookup services (no key needed, but network) |
| **Live camera scanner** (video box instead of one photo) | +1.5–2 | Not testable | Real phones |
| **Photo of item path**: `see()` in `llm.ts` with image parts + `MODEL_VISION`, label-reading instructions and checks, canvas shrink + EXIF strip, reject rule, saved answers, 8–10 sample photos | 4–5 | Yes, with saved answers | `MODEL_API_KEY` to record real answers once and to compare models |
| **Photo of receipt path** (reuses the above): receipt instructions, many rows per photo, receipt drop-list, 5–6 fake receipts | 2–3 | Yes, with saved answers | Same key |
| **Evals** (answer key + scoring for barcode and photos) | 2–3 | Yes | Live run on the Mac for the "real model" score |
| **Nightshift vision test** | 0.5–1 | No | Mac with Nightshift running |
| **Email path** (from `research-email-receipts.md`, sample version; now writing to `purchase_items`) | about 5.5–6.5 (+2–3 live inbox) | Yes | Agentmail key for the live inbox |

Rough totals, sharing the common pieces once: barcode about 6–8 hours; photos (item + receipt) about 9–12 hours; plus evals 2–3 hours. Everything except the camera-on-a-real-phone checks, the first live model answers and the Zetaris registration can be built and tested in the cloud.

**Order of key-dependent steps on the Mac:** (1) run `register.ts --apply`; (2) run the family once live so new SQL answers are saved to the Zetaris cache; (3) run the photo samples once live to save model answers; (4) commit the saved answers so the cloud and hosted demo work offline.

---

## Open questions for Lyndsay
1. Is it OK to use CPSC recall-notice photos (government notices, credited) as the sample "item photos"? The alternative is making our own label pictures.
2. For the "best NVIDIA" story: Nemotron 3 Nano Omni (faster, tested by others) as the default, with Nemotron 3.5 Super VL tried as an upgrade?
3. One photo of a barcode (works everywhere), or also the live camera scanner (nicer, +1.5–2 hours, needs real-phone testing)?

---

## Sources (all read Oct 24, 2026 unless noted)
- CPSC recall API, live: https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=2025-06-01 (my counts above)
- openFDA food enforcement, live: https://api.fda.gov/food/enforcement.json?search=product_description:%22infant%20formula%22&limit=100 (my counts above)
- Nemotron Nano 12B v2 VL model reference (released Oct 28, 2025): https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-nano-12b-v2-vl
- Nemotron 3 Nano Omni model reference (released Apr 28, 2026): https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-nano-omni-30b-a3b-reasoning
- Nemotron 3.5 Super VL announcement, Oct 15, 2026 (HPCwire; page blocked my reader, details from search summary): https://www.hpcwire.com/aiwire/2026/10/15/nvidia-expands-nemotron-family-with-highest-efficiency-super-vl-and-bolt-models/ ; listing details: https://enterprisedna.co/directories/models/nvidia-nemotron-3-5-super-vl
- build.nvidia.com catalogue (model names incl. nemotron-ocr-v2, nemotron-parse-2.0, nemotron-3.5-parse, paddleocr, llama-3.2 vision): https://build.nvidia.com/models?q=VL ; Nemotron Parse 2.0 card: https://build.nvidia.com/nvidia/nemotron-parse-2.0/modelcard
- Cosmos Reason1 retirement note: https://build.nvidia.com/nvidia/cosmos-reason1-7b/deploy
- NVIDIA NIM for vision models, structured generation (`json_schema` recommended): https://docs.nvidia.com/nim/vision-language-models/1.7.0/structured-generation.html
- Free tier ~40 requests/minute (blog + forum, 2026): https://medium.com/@vignarajj/beyond-the-hype-supercharging-my-local-development-workflow-with-nvidia-nim-and-opencode-free-6ff12d6f851e ; https://forums.developer.nvidia.com/t/request-for-nvidia-build-api-rate-limit-increase-40-rpm-200-rpm/377433
- Meterless Runtime 1.4 (images as `image_url`, "vision" class): https://meterless.ai/engines.html
- BarcodeDetector browser support: https://caniuse.com/mdn-api_barcodedetector ; WebKit bug: https://bugs.webkit.org/show_bug.cgi?id=198174
- `barcode-detector` polyfill: https://app.unpkg.com/barcode-detector@3.2.2/files/README.md ; zxing-wasm: https://cdn.jsdelivr.net/npm/zxing-wasm@3.0.2/README.md
- html5-qrcode paused: https://github.com/mebjas/html5-qrcode/discussions/747 ; library comparison: https://scanbot.io/blog/quagga2-vs-html5-qrcode-scanner/
- UPCitemdb limits: https://www.upcitemdb.com/wp/docs/main/development/api-rate-limits/ ; pricing (competitor page dated Oct 12, 2026): https://shopsavvy.com/compare/shopsavvy-data-api-vs-upcitemdb
- Go-UPC pricing (competitor page dated Oct 12, 2026): https://shopsavvy.com/compare/shopsavvy-data-api-vs-go-upc
- Open Food Facts API (15/min, User-Agent, ODbL): https://openfoodfacts.github.io/openfoodfacts-server/api/
- Photo hidden data and stripping: https://flaviocopes.com/exif-metadata-privacy.md ; https://orthogonal.info/remove-gps-location-from-photos/
- Bundle code read: `bundle/server/adapters/llm.ts`, `bundle/server/agents/recall.ts`, `bundle/scripts/zetaris/register.ts`, `bundle/shared/schema.ts`, `bundle/server/bundleDeps.ts`, `bundle/server/ingest/amazonCsv.ts`

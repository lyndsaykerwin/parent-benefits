# Entity-resolution test: can Bundle match purchases to real recalls?

Written Sat Oct 24, 2026. This is an experiment only. No app code in `bundle/` was changed. The scripts and data are in `research/experiments/entity-resolution/`.

**Entity resolution** means deciding that two differently worded records describe the same real thing, for example "Babysense MaxView 5.5" HD Video Baby Monitor" and the recall "Babysense Max View Baby Monitors".

## 5-line summary

1. **Lyndsay's worry is right, and it goes further.** A real Plaid bank line (Plaid is the service that reads a family's bank and card data) contains **no product at all**, only the store, the amount and the date (for example `AMAZON MKTPL*2K4RT81Q3`, $89.99). No amount of clever matching can find a recalled crib mattress in that line.
2. **So recall matching needs a second data source that lists the items bought:** an Amazon or Walmart order-history file, email receipts, or a baby-registry list. Plaid is still useful for things that only need the store: spotting baby spending, card-linked cash-back offers, and childcare bills for the Dependent Care FSA (a tax-free childcare account).
3. **On item-level data, today's rule fails both ways.** With no AI it raises **0 of 12** real recall alerts. Its word net (the first, loose search) produces **192 candidate pairs for 30 purchases**, and only 25 of those ever reach the AI check, which then found **2 of 12**.
4. **A "structured fields + hard rules" matcher scored 12/12 with no wrong alarms on the main set.** On a held-out set written after its rules were frozen, it scored **7 of 8 found and 1 wrong alarm**. It first pulls brand, product type, product-line word, sale dates, seller and recall status out of both records, then joins on those fields.
5. **The AI-verifier strategy was attempted but could not finish.** 5 of its calls failed (2 timeouts, 3 garbled replies), and the run hung until stopped. Only 2 of the 16 pairs got an answer. This is the same failure the app's AI Judge shows, which makes it useful evidence for the timeout fix.

---

## 1. What bank data actually looks like (real Plaid sandbox output, fake data)

**How we got it.** We used Plaid's **sandbox**, its practice mode with fake banks, at `sandbox.plaid.com`, with the keys in `.secrets/bundle.env.local`. We used Plaid's "custom user" feature: logging in as `user_custom` with a settings object that lists your own transactions under `override_accounts` (https://plaid.com/docs/sandbox/user-custom/, checked Oct 24, 2026). We added 10 card purchases written the way real statements read, created a sandbox item, pulled `/transactions/sync`, then deleted the item. Script: `research/experiments/entity-resolution/plaid_sandbox.py`. Raw output: `data/plaid_sandbox_transactions.json`.

**One real row, trimmed. Everything in it is fake data from the sandbox:**

```json
{
  "date": "2026-09-02", "amount": 89.99,
  "name": "AMAZON MKTPL*2K4RT81Q3 Amzn.com/bill",
  "original_description": "AMAZON MKTPL*2K4RT81Q3 Amzn.com/bill WA",
  "merchant_name": "Amazon", "website": "amazon.com",
  "logo_url": "https://plaid-merchant-logos.plaid.com/amazon_44.png",
  "counterparties": [{"name": "Amazon", "type": "merchant", "confidence_level": "VERY_HIGH", "website": "amazon.com"}],
  "personal_finance_category": {"primary": "GENERAL_MERCHANDISE", "detailed": "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES", "confidence_level": "HIGH"},
  "payment_channel": "online", "location": {"region": "WA", "city": null}
}
```

**What Plaid did with our 10 lines:**

| What the card statement said | Plaid `merchant_name` | Plaid category (`detailed`) | Comment |
|---|---|---|---|
| AMAZON MKTPL*2K4RT81Q3 | Amazon | Online marketplaces | Good store, no product |
| TARGET 00012345 BOSTON MA | Target | Superstores | Good |
| WAL-MART #2149 | Walmart | Superstores | Good |
| BUYBUY BABY #1027 | Buybuy Baby | **GENERAL_SERVICES_CHILDCARE** | **Wrong:** this is a shop, not childcare |
| GRACO CHILDRENS PRODUCTS | Graco Childrens Products | **Pharmacies and supplements** | Wrong category. Brand known, product unknown |
| SQ *SIMILAC STORE | (none) | Convenience stores | Merchant not recognised |
| BRIGHT HORIZONS TUITION ACH | (none) | **GENERAL_SERVICES_EDUCATION** | Real daycare, but **not** labelled childcare |
| CVS/PHARMACY #01234 | CVS | Pharmacies and supplements | Good |

**Answer to the key question.** A bank or card transaction contains the **store, amount, date and a reference code, never the product name**. Plaid's transaction object has no field for line items, SKUs (a store's code for one specific product) or product names. The fields that come closest are `name` (deprecated), `merchant_name`, `counterparties`, `personal_finance_category`, `website`, `logo_url`, `payment_channel` and `location` (https://plaid.com/docs/api/products/transactions/, checked Oct 24, 2026). **Plaid Enrich** (`/transactions/enrich`, for card data you already hold) returns the same kind of extra detail: merchant name, counterparties, category, website, logo, location and store number, with **no line items** (https://plaid.com/docs/api/products/enrich/, checked Oct 24, 2026). A search for any Plaid line-item or SKU product found none. Item-level data comes from receipt-reading vendors such as Veryfi (https://www.veryfi.com/fields-supported/line-items/) or Taggun, not from Plaid.

Two extra warnings from the sandbox. First, Plaid's own category labels were wrong for 3 of our 8 baby-related lines, so Bundle can't use "category = childcare" on its own to find Dependent Care FSA bills. It should also match a list of known daycare names (Bright Horizons, KinderCare and so on). Second, today's `recall.ts` reads the card row's **category** text as the "item", and for Plaid that would be a code like `GENERAL_MERCHANDISE_SUPERSTORES`, which can never match a recall.

### What each data type can and can't match

| Data source | Has product name? | Can match product recalls? | Good for |
|---|---|---|---|
| **Plaid bank/card lines** | No (store + amount only) | **No.** At best "you shop at a store named in a recall" | Spotting baby spending, card-linked cash-back offers by merchant, childcare payments for Dependent Care FSA, spotting subscriptions |
| **Amazon / Walmart order history** (CSV export) | Yes, full item title + date + seller (+ ASIN, Amazon's own product ID) | **Yes, this is where matching works** | Recalls, offer matching by product |
| **Email receipts** (Gmail read-only) | Usually yes, for online stores | Yes, after reading the email | Covers Target, Walmart, buybuy BABY online orders |
| **Baby-registry list** (Babylist, Amazon registry) | Yes, exact product + brand, often model | Yes, the cleanest source, but it shows intent, not proof of purchase | Pre-birth recall watch: "an item on your registry was recalled" |
| **Photo of paper receipt** | Short codes ("GRCO CS SNUGRD"), sometimes UPC (the bar-code number) | Partly. Needs AI reading plus a lookup | In-store purchases |
| **Plaid line + order history joined** | Yes, via the order | Yes | Link the bank line to the order by store + amount + date, so a $129.00 Amazon charge points to its order items |

---

## 2. The test

**Data (all purchases fake, all recalls real):**
- **Recalls:** the live CPSC feed (739 recalls since June 1, 2025, which unpack to 739 product rows) plus the openFDA infant-formula feed (42 recalls). Both were downloaded Oct 24, 2026 into `data/cpsc.json` and `data/fda.json`. Every purchase was checked against **all 781** product rows, not a hand-picked short list, so wrong alarms against unrelated recalls count too.
- **Main set (`data/purchases.json`): 30 fake purchases, 12 true matches.** 23 are order-history item titles (Amazon, Walmart, Carter's, Target) and 7 are Plaid bank lines copied exactly from the sandbox output. They are deliberately messy: "MaxView" against "Max View", a recall name with no brand ("Giraffe highchairs"), extra words, sizes and colours. There are also 11 **near-misses**, purchases that look like a recall but aren't, for example:
  - same brand, different product (Babysense 7 movement monitor, Joolz stroller when only the adapter was recalled, Skip Hop activity centre);
  - shared words only (Melissa & Doug giraffe plush, Amazon Basics bibs, Newton crib mattress, Graco Pack 'n Play against the unbranded "Play Yards" recall);
  - the right model but the wrong dates (VEVOR swing bought before the recalled units were sold; Boon 4 oz grey bottle);
  - a closed FDA recall (a2 Platinum, "Terminated");
  - an old FDA recall still marked "Ongoing" (Similac 2022 lots, bought in 2026).
- **Held-out set (`data/heldout.json`): 15 purchases, 8 true matches.** This set was written **after** strategy B's rules were frozen, using recalls B was never tuned on. It is the honest test.
- **Labels:** each purchase lists the recall(s) it should trigger. Every other purchase-recall pair is "no match". All 192 + 40 pairs that today's net flagged were reviewed against these labels.

**Scores used:**
- **Precision:** of the alarms raised, how many were right.
- **Recall:** of the true matches, how many were found. This is a different meaning from a product recall.

**Strategies:**
- **A: today's rule.** It is copied line by line from `bundle/server/agents/recall.ts` into Python. A purchase and a recall become a pair if the full recall name is inside the title, or they share 2 or more non-generic words, or the recall's first word appears in the title. Exact-name pairs are accepted without asking the AI. Loose pairs are sorted newest recall first, and only the first 25 (`MAX_PAIRS`) get the app's AI yes/no question. With no AI answer, a loose pair is rejected.
- **B: structured fields + hard rules, no AI.** It turns each record into fields, then joins on them:
  - **brand**, taken from the product name, the recalling firm in the title ("Skip Hop Recalls…"), the phrase "This recall involves…", or the listed makers;
  - **product type**, from a fixed list (crib mattress ≠ play-yard mattress ≠ adult mattress; car-seat adapter ≠ stroller);
  - **product-line word**, such as "Max View", "Tatamia" or "Giraffe";
  - **model number** and **size**;
  - **sale window**, read from the CPSC "sold from August 2024 through July 2025" text;
  - **seller**;
  - **FDA status** and formula shelf life.

  An alert needs all of these: brand ✓, type ✓, bought inside the sale window ✓, seller consistent with the notice ✓, line word present ✓, and no size or model conflict ✓. Every alert carries its evidence, for example "brand=joolz; type=car_seat_adapter; bought inside sale window Jun 2025–May 2026; seller amazon named in notice; model=AER2".
- **C: B's brand + type join and date rules, then an AI verifier.** The AI must copy exact words from both records as evidence. The code then checks that each quote really appears in the source text, and if it doesn't, there is no alert. The AI is NVIDIA `nemotron-3-ultra` through its OpenAI-compatible API, called the same way as `bundle/server/adapters/llm.ts`.
- **Zetaris was not used.** Zetaris is the hackathon's required "data door" that queries several sources in one SQL question. These were plain Python scripts, which was quicker for scoring. Strategy B's join uses only brand, type and date fields, which Zetaris can do in SQL (see section 4).

---

## 3. Results

### Main set (30 purchases × 781 recall products, 12 true matches)

| Strategy | Alarms | Right | Precision | Recall | Wrong alarms | Misses |
|---|---|---|---|---|---|---|
| A0: today's word net, if every pair were an alarm | 192 | 12 | **6%** | 100% | 180 | 0 |
| A1: today's rule, offline (exact name only) | 0 | 0 | n/a | **0%** | 0 | 12 |
| A2: today's rule + its AI yes/no (25-pair cap) | 2 | 2 | 100% | **17%** | 0 | 10 |
| **B: structured fields + hard rules (no AI)** | 12 | 12 | **100%** | **100%** | 0 | 0 |
| C: B join + AI evidence verifier | not completed (see below) | | | | | |

### Held-out set (written after B's rules were frozen; 15 purchases, 8 true matches)

| Strategy | Alarms | Right | Precision | Recall | Wrong alarms | Misses |
|---|---|---|---|---|---|---|
| A0: today's net as alarms | 40 | 8 | 20% | 100% | 32 | 0 |
| A1: today's rule, offline | 0 | 0 | n/a | 0% | 0 | 8 |
| **B: structured + rules** | 8 | 7 | **88%** | **88%** | 1 | 1 |

**The held-out row is the number to quote.** The perfect main-set score is partly because the rules were adjusted while looking at it. Two rules were added after the first run: the seller rule, and skipping the product-line rule for FDA's long descriptions.

### Examples, and why each happened

**Why today's rule (A) misses real recalls:**
- **The exact-name shortcut almost never fires.** Real titles rarely contain the recall's whole product name word for word. "KEAWIS Mini Crib Mattress 38 x 24…" does not contain "KEAWIS Crib Mattress", because "Mini" sits in the middle. So offline, 0 of 12 were found.
- **The 25-pair cap cuts off the real matches.** The net found 192 pairs, 180 of them junk. Only the newest 25 got the AI question, so **167 pairs were never judged**, including KEAWIS, Bugaboo, Peg Perego, Babysense, VEVOR gate, babyletto and ByHeart. For one real family with a year of baby orders, this is the normal case, not an edge case.
- **The AI said "no" to 3 real matches it did see:** Costway high chair, Skip Hop Elmo teether and Joolz Aer2 adapter. It was shown only the short product name and title, not the description, model or sale dates, so it couldn't be sure. It said "yes" to only 2, Boon NURSH and Nara Organics, both correct.

**What today's net would flag if the AI let things through (the 180 junk pairs):**
- "VEVOR Baby Gate" against **VEVOR Garment Steamers, Ice Crushers, Handrails**, the VEVOR swing and loungers, and 5 other brands' retractable gates;
- the Plaid line "AMAZON MKTPL*…" against **Amazon Basics mattresses, pocket knives and dumbbells**;
- "babyletto Kiwi **Electric** Recliner" against electric kettles, toaster ovens and pressure washers;
- one ByHeart formula purchase against **27 different FDA recalls**, including Similac recalls from 2015 and 2022 and ByHeart's own **closed** 2022 recall.

**How B gets it right:**
- **Babysense 7 movement monitor:** same brand and type, but rejected because "product-line word missing (max, view)".
- **VEVOR swing, model BB702A:** the model matches the recall, but rejected because "bought May 2024, outside CPSC sale window Jan–Aug 2025".
- **Melissa & Doug giraffe plush:** it joined to the Hobby Lobby giraffe-toy recall, then was rejected because "notice says sold only at Hobby Lobby; bought at Amazon".
- **a2 Platinum formula:** rejected because "FDA status is Terminated".
- **Similac 360, bought 2026:** rejected against 15 Abbott recalls because "outside recalled-stock shelf life around Feb 2022", even though FDA still marks them "Ongoing".
- **Joolz Aer+ stroller:** no alarm, because type "stroller" ≠ recalled "car_seat_adapter".

**Where B failed on the held-out set (honest):**
- **Wrong alarm:** "ONTHEWEI Baby Bath Seat, Pink", bought Aug 2025. The notice says "sold **in** April 2026", but B's date reader only understands "from X through Y", so it fell back to "bought before the recall date". **Fix:** also read "in Month Year", and the date of manufacture.
- **Miss:** "Hoovy Cooling Gel Car Seat Liner Pad". The recall product is "Hoovy Cooling Gel Insert **Pads** for Car Seats…", and "pad/liner/insert" isn't in B's list of product types, so the two never joined. **Fix:** grow the type list, or let the AI assign a type when the rules find none.

**Lesson:** rules are precise and explain themselves, but every new wording needs a new rule. The AI should fill gaps in the field extraction. It should not be the only judge.

### Strategy C (AI evidence verifier): attempted, failed due to timeouts and garbled replies

- Of the 16 pairs that passed B's brand + type join and date rules, **only 2 got an AI answer**. **5 calls failed**: 2 hit the time limit and 3 returned unreadable, cut-off JSON (the structured text format the script expects). The rest never ran, because the run hung for over 10 minutes on a call that never closed. A hard 120-second limit per call was added afterwards, and the run was stopped at the coordinator's request. Under the "no AI answer = reject" fail-safe, C raised **0 alerts and missed all 12**.
- **The 2 answers that did come back are telling:**
  - It correctly rejected the Babysense 7 monitor ("Different product lines").
  - It **wrongly rejected the real VEVOR gate match**, because the listing said 33" tall and 55" wide while the notice said 34.2" tall and "up to 60 inches". That is too strict. An AI verifier needs clear guidance that rounded sizes in a shop listing aren't a conflict.
- **This matches the app's AI Judge failure.** Calls to the NVIDIA model sometimes hang or return cut-off JSON. In our earlier quick checks the "fast" model returned an empty reply. Strategy A's 25 calls had worked in an earlier run (those answers were saved and re-used). **For the timeout fix:** set a hard limit on the whole call (the time-out on reading data alone did not stop the hang), raise the reply-length limit (the model's "thinking" uses up the budget, so the JSON gets cut off), and retry once before falling back.

---

## 4. Recommended strategy and data sources for Bundle

**Matching: use B as the backbone, with the AI only as a helper.**
1. **Pull fields from each recall once, when the feeds load,** and store them: brand(s), product type, product-line words, model numbers (from the description text), sale window, sellers, UPCs, and FDA status. Rules first. Ask the AI only when the rules find no brand or type (a few calls per new recall, saved, never per family).
2. **Pull fields from each purchase** with the same code: brand = the first words of an Amazon or Walmart title, plus type, size and model.
3. **Join in Zetaris on brand + type.** This is a simple equality join, which Spark SQL (the database language Zetaris runs) handles well. It replaces today's word-overlap net, which made 192 pairs for 30 purchases.
4. **Hard rules in code:** bought inside the sale window, seller consistent with the notice, FDA not "Terminated", formula bought within the shelf life of the recalled lots, and no size or model conflict.
5. **The alert must show its evidence,** for example "brand ✓ type ✓ bought inside the Aug 2024–Jul 2025 Amazon window ✓, check the label for model XX-BM-01". If a model number was matched, call it verified. If not, tell the parent what to check on the item.
6. **The AI's yes/no is optional, not the gate.** If it is used, show it the description and sale window, require copied quotes that the code checks, and never let a timeout decide the answer.

**Data sources:**
- **Keep Plaid** for merchant-level features: baby-spending summary, card-linked offers by merchant, Dependent Care FSA childcare detection (with a list of daycare names, because Plaid's labels are unreliable), and subscriptions.
- **Add one item-level source, which recalls need.** In order of effort for this week:
  1. **Amazon order-history CSV upload.** Already supported (`server/ingest/amazonCsv.ts`), so make it a first-class onboarding step.
  2. **Baby-registry import** (Babylist or Amazon registry link or CSV). This is the cleanest product data and catches recalls before birth.
  3. **Gmail receipts** (read-only), for Target, Walmart and buybuy BABY online orders. Roadmap slide.
  4. **Receipt photo**, for in-store purchases. Roadmap slide.
- **Link Plaid lines to orders** by store + amount + date (within 3 days), so the bank line becomes proof of purchase and the order supplies the product.

## 5. What it means for the plan

- Say plainly in the demo and pitch: **"Bank data tells us where you shop. Order history tells us what you bought. Recalls need the second."** That turns Lyndsay's worry into a design point judges will respect.
- **Quick fixes in `recall.ts`, roughly in order of value:**
  - (a) Filter out FDA `status = Terminated`.
  - (b) Stop feeding Plaid card rows into recall matching (they can only produce wrong alarms, such as "Amazon" against the Amazon Basics mattress recall).
  - (c) Replace the word net with a brand + type join, or at least require the brand to match.
  - (d) Add the sale-window and seller rules.
  - (e) Give the AI the description and sale window, not just the product name.
  - (f) Log when the 25-pair cap is hit.
- Fix the AI-call timeout and cut-off JSON (same root cause as the AI Judge).

## 6. Eval cases to add (to `bundle/evals/`)

Turn the labelled sets into a scoreboard and report precision and recall on every run.

| Case | Purchase | Must / must not |
|---|---|---|
| `recall_true_keawis` | KEAWIS Mini Crib Mattress, Amazon, Mar 2025 | **must** alert CPSC 10560 |
| `recall_true_maxview` | Babysense MaxView monitor | **must** alert CPSC 10650 (spelling variant) |
| `recall_true_brand_in_title_only` | Skip Hop Elmo teether | **must** alert CPSC 10943 (brand only in the recall title) |
| `no_false_recall_same_brand` | Babysense 7 movement monitor | **must not** alert 10650 |
| `no_false_recall_part_only` | Joolz Aer+ stroller | **must not** alert 10829 (only the adapter was recalled) |
| `no_false_recall_wrong_dates` | VEVOR swing BB702A, May 2024 | **must not** alert 10474 |
| `no_false_recall_shared_word` | Melissa & Doug giraffe; Graco Pack 'n Play | **must not** alert 10309 / 10584 / 10490 |
| `no_false_recall_brand_store` | Plaid line "AMAZON MKTPL*…" | **must not** alert Amazon Basics recalls (10369, 10667, 10773) |
| `no_terminated_fda` | a2 Platinum formula | **must not** alert H-0891-2026 |
| `no_stale_fda` | Similac 360, bought Jul 2026 | **must not** alert any 2022 Abbott recall |
| `fda_true_ongoing` | Nara Organics formula, May 2026 | **must** alert H-1137-2026 with "check the lot code" wording |
| `cap_not_hit_silently` | Full 30-item set | the trace must log when more than 25 loose pairs were cut |
| `plaid_childcare` | "BRIGHT HORIZONS TUITION ACH" | **must** be flagged for Dependent Care FSA despite Plaid's "EDUCATION" label |
| `plaid_not_childcare` | "BUYBUY BABY #1027" | **must not** be flagged as childcare despite Plaid's "CHILDCARE" label |

## Files

- `research/experiments/entity-resolution/plaid_sandbox.py`: makes the Plaid sandbox item and pulls the real-format transactions.
- `research/experiments/entity-resolution/er_test.py`: strategies A, B and C plus scoring.
  - `python3 er_test.py --no-ai` runs the rule strategies only.
  - `--set heldout.json` scores the held-out set.
  - `--cache-only` re-scores with saved AI answers and makes no new calls.
- `research/experiments/entity-resolution/data/`:
  - live feeds: `cpsc.json`, `fda.json`;
  - Plaid output: `plaid_sandbox_transactions.json`;
  - labelled sets: `purchases.json`, `heldout.json`;
  - results: `results_purchases.json`, `results_heldout.json`, `run_main.txt`;
  - saved AI answers: `ai_cache.json` (27 answers).

## Sources (all checked Oct 24, 2026)

- Plaid custom sandbox user: https://plaid.com/docs/sandbox/user-custom/
- Plaid Transactions API (`/transactions/sync` fields): https://plaid.com/docs/api/products/transactions/
- Plaid Enrich (`/transactions/enrich`): https://plaid.com/docs/api/products/enrich/
- Receipt line-item extraction (not Plaid): https://www.veryfi.com/fields-supported/line-items/, https://developers.taggun.io/docs/overall-expense-categorisation
- CPSC recall feed: https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=2025-06-01
- openFDA food enforcement: https://api.fda.gov/food/enforcement.json (field reference https://open.fda.gov/apis/food/enforcement/)
- Bundle code read (not changed): `bundle/server/agents/recall.ts`, `bundle/server/adapters/llm.ts`; earlier research: `research/research-matching-and-agent-api.md`

# Research: matching products, and sharing offer data with other agents

Written Sat Oct 24, 2026 for the Bundle hackathon entry (due Tue Oct 27). Research only: no code was changed.

## 5-line summary

1. **Today**, Bundle decides "this purchase is the recalled product" with plain word matching inside one Zetaris question (`bundle/server/agents/recall.ts:47-70`), then lets the AI double-check any loose match. Bar codes are stored but never used.
2. **Zetaris has no built-in fuzzy matching.** It runs Spark SQL (a common database language), so we get basic text tools (`LIKE`, `levenshtein`, `soundex`, word lists), and nothing smarter.
3. **The government feeds give little to match on.** Across 739 real CPSC recalls since June 2025, the `Model` field is blank in every one and only 22 list a bar code (UPC). Model numbers sit inside free text. The FDA feed has no bar-code field at all.
4. **For the 3 days left, add a layered match with a score:** bar code first, then brand plus name words in Zetaris, then the AI checks borderline pairs. Low scores become "check this item" rather than an alarm. Add 15 to 20 hand-labelled test pairs to the scoreboard so we can say how often it is right.
5. **For brand "offer audit" data:** make one Zetaris view that holds only per-brand totals, and put one read-only web address with a short machine-readable description (OpenAPI) in front of it. Pitch an MCP server as the next step rather than building it.

---

## Words used in this document

- **Entity resolution:** deciding that two differently worded records describe the same real thing, like "KEAWIS Crib Mattress, Dual-Sided Firm" and "KEAWIS Crib Mattress".
- **SQL:** the standard language for asking a database questions.
- **Zetaris:** the hackathon's required "data door". It asks one SQL question across several separate sources (our Neon database, the live government recall feeds) without copying them.
- **Neon:** the online database holding Bundle's fake family data.
- **CPSC:** the US Consumer Product Safety Commission. It publishes recalls of baby gear, toys and similar products through saferproducts.gov.
- **openFDA:** the Food and Drug Administration's public data service. Bundle uses it for infant-formula recalls.
- **UPC:** the 12-digit number under a product's bar code. **ASIN:** Amazon's own product ID.
- **False match (false positive):** we warn a parent about a product they don't own. **Missed match (false negative):** they own a recalled product and we say nothing.
- **Eval:** an automatic test that scores the app's answers against answers we already know are right.

---

# Question 1: Matching products (entity resolution)

## 1a. How Bundle does it today

### Recalls (the important one)

All file paths are inside `bundle/`.

| Step | What happens | Where |
|---|---|---|
| 1. Collect what the family bought | Amazon order titles plus the item text of card purchases. Services such as daycare and generic categories such as "groceries" are filtered out first. | `server/agents/recall.ts:25-41`; Zetaris view `v_recall_orders` in `scripts/zetaris/register.ts:42-44` |
| 2. Collect recalls | CPSC recalls are unpacked to one row per product (`p.Name`). FDA infant-formula recalls are unpacked to `product_description`. | `recall.ts:49-58`; feeds registered in `register.ts:51-52, 100-103` |
| 3. **Pair them up inside Zetaris** | A purchase and a recall become a candidate pair if **any one** of these is true: (a) the recalled name appears whole inside the purchase title (`LIKE '%name%'`); (b) they share **2 or more** real words, ignoring a stop list of generic words such as "baby", "crib" and "pack"; (c) the recall's **first word** (treated as the brand) is 4+ letters, isn't generic, and appears in the purchase title | `recall.ts:12-19` (stop list and word helpers), `recall.ts:63-67` (the join) |
| 4. Sort into exact and loose | **Exact** = the full recalled name appears in the title. These are accepted without asking the AI. | `recall.ts:72-77`, `recall.ts:92-93` |
| 5. AI check on loose pairs | For each loose pair (at most 25), the AI is asked "same brand and model?" and answers yes or no. **If the AI doesn't answer, the pair is rejected**, so the app fails safe and stays quiet. | `recall.ts:88-103`, cap at `recall.ts:7, 159-161` |
| 6. Label | Exact gives "verified"; AI-confirmed gives "likely". There is no number score. | `recall.ts:118` |
| 7. Fact-Checker | Re-checks only that the recall ID exists in the feed. It does not re-check that the product matches. | `server/agents/factChecker.ts:97-108` |

**What this looks like in the saved demo run** (`data/sample/zetaris-cache/462e8ca1...json`): Zetaris returned 3 candidate pairs for the demo family "maya":
- KEAWIS mattress → CPSC 10560 "KEAWIS Crib Mattress". Exact, correct.
- "Graco Pack 'n Play playard" → CPSC 10490 "Play Yards" (sold by Anna Queen, not Graco). Loose and **wrong**, matched only on the words "play" and "yards".
- KEAWIS mattress → CPSC 10453 Modera "Pack N Play Mattress Dual-Sided…". Loose and **wrong**, matched on "mattress" and "dual-sided".

Both wrong pairs were thrown out at step 5. In the saved offline run there is no AI, so the fallback rejected them (`logs/sample` shows "no model answer: loose match rejected"). The design is sound: the SQL casts a wide net and the AI acts as the filter. **But with the real AI switched on, nothing measures how often the AI wrongly says yes.**

### Gaps found

1. **Bar codes are stored but never used.** `amazon_orders` has `asin` and `upc` columns (`shared/schema.ts:44-52`, read in `server/ingest/amazonCsv.ts:12-13`). However, the `v_recall_orders` view doesn't pass them on (`register.ts:42-44`), and the recall question never looks at CPSC's `ProductUPCs`. The demo KEAWIS order has an ASIN but a blank UPC (`data/sample/amazon-orders.csv`).
2. **Finished FDA recalls are treated like live ones.** The FDA feed returns `status` values "Ongoing" and "Terminated". 42 formula recalls come back, some from 2020, and the app doesn't filter by status. A parent could get a scary card about a recall that ended years ago.
3. **The "brand" rule is a guess.** It assumes the first word of the recalled product name is the brand. CPSC names often start with a generic word ("Play Yards", "Children's…"), and the stop list only partly covers this.
4. **Card purchases rarely name a product.** Real card data shows a store name ("Target"), not an item. The saved run shows a "Target" row. Card rows can only match by luck. Amazon titles are where matching actually works.
5. **The eval only tests one hit.** The scoreboard trap `recalled_item` (`evals/expected.json:67-69`, `scripts/eval.ts:230`) checks that the KEAWIS card appears. Nothing checks that wrong recalls do *not* appear.

### Offers

Offers are matched to purchases by **one keyword per offer** (`trigger_keyword`, such as "diaper" or "formula"), checked as a whole word in code: `server/agents/finePrintCourt.ts:146-150, 166-168`. The keywords themselves come from `purchaseKeywords` in `server/agents/orchestrator.ts:169`. A wrong offer match only shows an irrelevant deal, so the stakes are much lower than for recalls. Leave it as it is.

## 1b. Does Zetaris have built-in matching?

**No, it doesn't.** To be plain about what exists:

- The local Zetaris command reference (`zetaris-getting-started/docs/guides/zetaris-lightning-sql-commands.md`, 23 sections) covers connecting sources, views, caching, data-quality rules, users and access. It has nothing on fuzzy matching, record matching or entity resolution.
- Zetaris's homepage (zetaris.com, checked Oct 24, 2026) talks about federation, a "unified semantic layer" and an MCP connection. It never mentions fuzzy matching or entity resolution. Its only join example matches on an exact `customer_id`.
- The Oct 7, 2026 launch article for the "AI Data Harness" (https://pulse2.com/zetaris-launches-cloud-based-ai-data-harness-and-adds-steve-nouri-as-ai-strategy-advisor/) covers governed access for agents, not matching.
- **What we do get:** Zetaris runs Spark SQL, which is why `LATERAL VIEW explode` and `filter(..., w -> ...)` already work in our queries. Spark's function list (https://spark.apache.org/docs/latest/api/sql/index.html, checked Oct 24, 2026) includes `levenshtein` (counts how many letter edits turn one word into another), `soundex` (a "sounds like" code), `array_intersect` (shared words), and `regexp_extract_all` (pulls out every piece of text matching a pattern, such as model numbers). There is **no** `jaro_winkler` or similarity score. *Not yet tested on our cluster:* `levenshtein` and `regexp_extract_all` should work because the other Spark functions do, but run one test query before relying on them.
- **Data-quality rules** (`REGISTER DQ`) exist but need an activated "USL table". We skipped that setup on Oct 23 (`docs/zetaris-notes.md`).

**Honest framing for judges:** "Zetaris finds the candidate pairs across private and public data in one question. The AI decides the hard cases." That is true, and it plays to each tool's strength.

## 1c. What the feeds actually give us to match on

Checked live on Oct 24, 2026 by downloading the same feeds Bundle uses.

### CPSC (saferproducts.gov, `.../RestWebServices/Recall?format=json&RecallDateStart=2025-06-01`)

Each recall has these top-level fields: `RecallID, RecallNumber, RecallDate, Description, URL, Title, ConsumerContact, LastPublishDate, Products, Inconjunctions, Images, Injuries, Manufacturers, Retailers, Importers, Distributors, SoldAtLabel, ManufacturerCountries, ProductUPCs, Hazards, Remedies, RemedyOptions`.

| Field | Looks useful | Reality across 739 recalls |
|---|---|---|
| `Products[].Name` | Product name | Always filled. Short, such as "KEAWIS Crib Mattress". **The main thing to match on.** |
| `Products[].Model` | Model number | **Blank in all 739** |
| `Products[].Description` | Product details | **Blank in all 739** |
| `ProductUPCs[].UPC` | Bar code | Filled in only **22** (3%) |
| `Manufacturers[].Name` | Brand or maker | Filled in 169 (23%) |
| `Importers`, `Distributors` | Company | Sometimes, such as "Yixing Trading of Richmond, Kentucky" |
| `Retailers[].Name` | Where it was sold | Always filled, as free text. **434 (59%) mention Amazon**, so most are relevant to Amazon order history |
| `Description` (top level) | Long text | **425 (58%) mention a model, item number, SKU or UPC** in the text, for example "model number TL1302Z" |
| `Title` | Headline | Usually names the brand and product |

So for CPSC, **model numbers can be found, but only by pulling them out of the `Description` text** with a pattern (`regexp_extract_all`) or by asking the AI to list them once per recall.

For KEAWIS specifically: no UPC, no model, no manufacturer. The importer is "Yixing Trading" and it was sold on Amazon between August 2024 and July 2025. **Name plus seller plus purchase date** is the evidence available.

### openFDA food enforcement (`api.fda.gov/food/enforcement.json`)

Fields: `status, city, state, country, classification, openfda, product_type, event_id, recalling_firm, address_1, address_2, postal_code, voluntary_mandated, initial_firm_notification, distribution_pattern, recall_number, product_description, product_quantity, reason_for_recall, recall_initiation_date, center_classification_date, termination_date, report_date, code_info`.

- There is **no UPC field.** Still, 34 of the 42 infant-formula recalls mention "UPC" inside `product_description` or `code_info` text.
- `code_info` holds lot and batch numbers, such as "Batch Numbers: BW3520316". These matter because formula recalls are usually limited to specific lots. A parent's receipt won't show the lot, so the honest message is "check the lot number on your can".
- `recalling_firm` is the company, for example "Abbott Nutrition…". The brand ("Similac") appears only in `product_description`.
- `openfda` (the cross-reference block) was **empty** on all 42 rows.
- `status` is "Ongoing" or "Terminated". **Filter on it** (see gap 2 above).
- Field reference: https://open.fda.gov/apis/food/enforcement/ (CPSC's API page: https://www.cpsc.gov/Recalls/CPSC-Recalls-Application-Program-Interface-API-Information).

## 1d. Recommended approach for the next 3 days

Keep the current shape (Zetaris casts the net, the AI filters) and make it **graded and measurable**. Five layers, from strongest evidence to weakest:

| Layer | Rule | Where it runs | Score | What the parent sees |
|---|---|---|---|---|
| 1. Bar code | Purchase `upc` equals a value in CPSC `ProductUPCs`, or appears in FDA `product_description`/`code_info` text | Zetaris SQL (pass `upc` through `v_recall_orders`) | 0.99 | Recall alert |
| 2. Model number | A model code pulled from the recall `Description` appears in the purchase title | Zetaris SQL with `regexp_extract_all` | 0.95 | Recall alert |
| 3. Full name | The whole recalled name appears inside the title (today's "exact") | Zetaris SQL (exists) | 0.90 | Recall alert |
| 4. Brand plus words | Today's loose rules, plus: the purchase date is not before the recall's sale window, and the seller matches (for example, recall says Amazon and order is from Amazon) | Zetaris SQL (exists, add date and seller) | 0.40–0.70 from shared words | Sent to layer 5 |
| 5. AI check | Ask for **yes / no / unsure plus a reason**, instead of a bare yes or no | `recall.ts:88-103` | yes gives +0.25, no drops the pair, unsure keeps the score as is | Depends on final score |

**Where the final score sends a pair:**
- **0.85 or higher: "Recall alert"** with the official link and a "how to confirm" line, such as "the model number is on the bottom sticker".
- **0.50 to 0.85: "Please check this item".** It is calmly worded, sits in the list rather than at the top, and has a one-tap "Not mine" button.
- **Below 0.50: hidden from parents.** It still appears in the owner's "Behind the scenes" trace as "considered and rejected", which is good evidence for judges.
- **Always:** drop FDA recalls with `status = 'Terminated'`. Formula recalls get "check the lot number on the can" wording, because receipts don't show lots.

**How false matches are handled (wrongly scaring a parent):** only bar-code, model or full-name matches can reach "alert" without an AI yes. Everything else needs the AI to agree, and even then it lands as "check this item", not an alarm. A "Not mine" tap feeds the existing Meterless learning loop, so the same wrong pair is suppressed next time. If the AI doesn't answer, the pair stays hidden (this already happens).

**How missed matches are handled (staying silent about a real recall):** layer 4's wide net stays wide. The loose-pair cap (25) is logged when it is hit, so we know when something might have been cut. The parent view says honestly "We checked 7 items against N recalls", never "you're safe". And we add a plain "Check any product" option on the roadmap slide. We don't build it.

**How it shows up in evals (the scoreboard):**
- Add a small **labelled match set** of 15 to 20 purchase-and-recall pairs, each marked "same" or "different". Use the real near-misses already in the saved cache (Graco vs "Play Yards", KEAWIS vs Modera), a few true matches, and one finished FDA recall.
- Report two plain numbers: **"Of the alerts we raised, X% were right"** (this is called *precision*) and **"Of the real recalls, we caught Y%"** (this is called *recall*, not to be confused with a product recall).
- Add a trap called `no_false_recall`: the maya run must **not** show CPSC 10490 or 10453. Today's scoreboard only checks the true hit.
- Run the set with the saved offline mode and with the real AI, and report both. This is honest, and it matches the "say what was real" rule in the plan.

**Effort:** about half a day. The view change and a `status` filter take about 1 hour, the score and three-way routing about 2 hours, the eval set and trap about 2 hours. A model-number pattern is optional: about 1 hour, but it would be hard to test well before Tuesday. If time runs short, do the FDA status filter, the `no_false_recall` trap and the labelled set first. They fix a real risk and give judges a number.

---

# Question 2: Agent-friendly brand data ("Strategy 3")

## What is being shared

Agents already read each offer's fine print in the Fine Print Court. The plan is to save each finding into a Neon table, `offer_checks`, and register that table in Zetaris as its own source. A simple shape:

`offer_id, store, check_type (hidden_fee | auto_renew | return_window | exclusion | other), finding (one sentence), severity (low | med | high), evidence_quote (copied from the public fine print), source_url, verdict (ok | warn | blocked), checked_at, agent, model`

**There is no family ID column at all.** The Judge's view already carries no family data (`v_judge_offers`, `register.ts:31-33`), and offers are public pages, so this table is family-free by design.

On top of it, a **per-brand totals view**, `v_offer_audit`: `store, offers_checked, offers_blocked, top_issue, last_checked`, plus the list of that brand's own findings with quotes and links.

## The three options compared

| | A. Zetaris view plus access rules | B. Small read-only web address plus OpenAPI | C. MCP server |
|---|---|---|---|
| **What it is** | A saved Zetaris question, `v_offer_audit`, that a named role may only read (`GRANT SELECT ON VIEW TABLE …`) | One web address, such as `GET /api/offer-audit?store=Pampers`, that returns JSON (structured text that programs read). It comes with an **OpenAPI** file, the standard way to describe a web address so any program or agent can learn how to call it | A small program speaking **MCP** (Model Context Protocol, the standard way AI agents plug into tools). An agent like Claude or Cursor could "see" a tool called `get_offer_audit` |
| **Who can use it** | Only people with a Zetaris login on our cluster | Anyone with the address (and a key if we add one) | Any MCP-capable AI app |
| **Effort** | 1–2 hours, **if** our hackathon account may create roles and grants (Administrator or "Access Control Write" rights per the command reference, sections 20–21). Unknown, so test it first | 3–4 hours: the route, a Zod check on inputs, OpenAPI file and tests. Express and `express-rate-limit` are **already installed** | 6–10 hours. The official TypeScript kit has just moved to v2 for the new spec (packages renamed to `@modelcontextprotocol/server`), so expect version friction. Not installed today |
| **Proves to judges** | Zetaris doing real governance work (a sponsor requirement) | It is real and can be shown in seconds: a live request returns clean JSON | The most "agentic" look, but it is a third thing to keep working |
| **Risk** | Grant rights may be locked down on a shared cluster | Low | Highest: new spec, beta kit, and the demo depends on one more moving part |

## Recommendation: A and B together, with C on a slide

1. **Build the Zetaris view (A) as the single source of truth.** `v_offer_audit` reads `offer_checks` and returns only per-brand totals and that brand's own findings. If grants work, create a role such as `brand_auditor` with `GRANT SELECT` on that one view only. If they don't, say on the slide that the view is the governed boundary and the role is the production step. Zetaris's own docs support this: grants exist on views, and its knowledge base lists row- and column-level security (https://kbase.zetaris.com/knowledge/data-security-in-zetaris, checked Oct 24, 2026).
2. **Put one read-only web address (B) in front of it.** `GET /api/offer-audit?store=<name>` runs one fixed query against `v_offer_audit` through Zetaris. Use saved answers in sample mode, so judges can run it with no keys. Ship `openapi.yaml` describing it, using OpenAPI 3.1 or 3.2. 3.2.0 was released September 2025 (https://www.openapis.org/?p=4078); 3.1 is the safer choice for older tools.
3. **MCP (C): pitch, don't build.** One slide: "Next: the same endpoint as an MCP tool, so a brand's own agent can ask 'how did our offers score?'" If time is truly left over on Monday, a thin MCP wrapper that calls the same function is the only acceptable version, with no new data paths. Note that Zetaris itself advertises an MCP connection on zetaris.com, but our starter guide only documents REST and JDBC (`zetaris-walkthrough.md:80`). Don't claim Zetaris MCP unless it has been tried.

**What is credible to show judges (about 30 seconds of the video or a slide):** a live request to `/api/offer-audit?store=Cuddle%20%26%20Co` returning `{"store": "Cuddle & Co", "offers_checked": 1, "offers_blocked": 1, "top_issue": "auto_renew", "findings": [{ "evidence_quote": "...automatically enrolled in a paid membership at $29.99/month...", "source_url": "..." }]}`, next to the OpenAPI file and a passing test titled "audit response has no family fields". That shows data built for agents, governed through Zetaris, with family privacy enforced, and no brand screens to build.

## Guardrails (each one is one line to state on the slide)

| Guardrail | How |
|---|---|
| **Read-only** | Only GET requests. The route runs one fixed, pre-written query, and callers never send SQL. The Zetaris role (if created) has SELECT only. In MCP terms, the tool would carry the `readOnlyHint` label. The spec says clients must treat such labels as untrusted hints, so the server itself must enforce read-only. |
| **No family data** | `offer_checks` has no family column, and the view is built only from it. A test asserts the response keys never include `family`, `income`, `zip` or purchase fields. |
| **Only totals or own-brand data** | `store` is required and checked against a fixed list (Zod). The response holds totals plus **that store's** findings only, and never another brand's quotes. In production, a key per brand would set `store` instead of trusting the caller; on the slide, call it "per-brand keys (next step)". |
| **Rate limits** | `express-rate-limit` (already in `package.json`), for example 30 requests per minute per address. The MCP spec itself says servers **must** "Validate all tool inputs, implement proper access controls, rate limit tool invocations, sanitize tool outputs" (https://modelcontextprotocol.io/specification/2026-07-28/server/tools, checked Oct 24, 2026). It is good practice for the plain web address too. |
| **Honest data** | Every finding carries `evidence_quote`, `source_url`, `checked_at` and which `model` produced it. Findings from the offline saved run are labelled as such. |
| **No promises** | Label it "beta, sample data", and don't call it real-time (this matches the Oct 24 decision in `TRACKING-oct24-plan-update.md`). |

## Current MCP facts (in case judges ask)

- The latest MCP spec revision is **2026-07-28** (https://modelcontextprotocol.io/specification/2026-07-28/changelog, checked Oct 24, 2026). The big change is that MCP is now "stateless": no opening handshake, and each request carries its own version and client details. There is a new `server/discover` call. The roots, sampling and logging features are deprecated.
- Tools can declare an `outputSchema` (the exact shape of the answer), and results can carry `structuredContent`. Our audit JSON would fit this directly.
- The official TypeScript kit's v2 targets this revision and splits into `@modelcontextprotocol/server` and `@modelcontextprotocol/client` (release notes via https://newreleases.io/project/github/modelcontextprotocol/typescript-sdk/release/@modelcontextprotocol%2Fexpress@2.0.0; this is a secondary source, so check the official repo before building).

---

## Sources (all checked Oct 24, 2026)

- Bundle code: `bundle/server/agents/recall.ts`, `bundle/scripts/zetaris/register.ts`, `bundle/server/agents/finePrintCourt.ts`, `bundle/server/agents/factChecker.ts`, `bundle/shared/schema.ts`, `bundle/server/ingest/amazonCsv.ts`, `bundle/evals/expected.json`, `bundle/data/sample/zetaris-cache/462e8ca1f0c0e54fed747169982210c44ded762e3b5dc821660e0a386874db86.json`
- Zetaris: `docs/zetaris-notes.md`; `zetaris-getting-started/docs/guides/zetaris-lightning-sql-commands.md` (sections 14, 17, 20, 21); https://www.zetaris.com; https://kbase.zetaris.com/knowledge/data-security-in-zetaris; https://pulse2.com/zetaris-launches-cloud-based-ai-data-harness-and-adds-steve-nouri-as-ai-strategy-advisor/ (Oct 7, 2026)
- Spark SQL functions: https://spark.apache.org/docs/latest/api/sql/index.html
- CPSC live feed: https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=2025-06-01 (739 records, counted directly); API info: https://www.cpsc.gov/Recalls/CPSC-Recalls-Application-Program-Interface-API-Information
- openFDA live feed: https://api.fda.gov/food/enforcement.json?search=product_description:%22infant%20formula%22&limit=100 (42 records, counted directly); field reference: https://open.fda.gov/apis/food/enforcement/
- MCP spec 2026-07-28: https://modelcontextprotocol.io/specification/2026-07-28/changelog and https://modelcontextprotocol.io/specification/2026-07-28/server/tools
- OpenAPI 3.2.0 announcement: https://www.openapis.org/?p=4078 (Sept 2025)

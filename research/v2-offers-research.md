# Live offer search: Tavily now, affiliate feeds later

Researched Oct 25, 2026, for Bundle (due Oct 27, 23:45 UTC). This follows on from `research/v2-feedback-research.md` section 6.

## Bottom line (plain English)

- **Build live offer search with Tavily now.** Tavily is a search service built for AI agents. You send it a question and a list of allowed websites, and it sends back matching pages and their text. It is free for 1,000 "credits" (units of use) a month with no credit card, and the Node add-on (`@tavily/core`) is current. It can be built and tested in one sitting.
- **Affiliate feeds can't work in 2 days, so apply this week and let approval come in after judging.** An **affiliate network** is a middleman that pays a website a commission (a small cut) when a reader buys through its link. Every network that offers a real, computer-readable **deals feed** wants an approved publisher account first, and most check your live website and its traffic. Bundle has neither yet.
- **Apply to two places now:**
  1. **Impact.com.** One account reaches **Babylist, Target and Walmart**, the three best baby-registry stores. Each store also approves you separately.
  2. **Awin.** Its Offers API is a published, documented feed of promotions and voucher codes. It can include stores you haven't joined yet.
  Skip Amazon for now. Its product data service needs 10 sales in the last 30 days first.
- **Instant coupon feeds you just pay for and get a key** (LinkMyDeals, Coupomated) do exist. But I could not find public prices, and their data is copied from coupon sites. That is the opposite of "checked offers," so don't use them for the demo.
- **For the demo, say it honestly:** "Today the offer finder searches about 12 trusted brand and store pages live through Tavily. Our affiliate applications are in. When they're approved, store deal feeds plug into the same checker." Then the business story (commission income) is real, and nothing is faked.

---

## 1. Affiliate and product feeds, one by one

"Feed" here means data a computer can read: a list of offers with codes, dates and terms. It does **not** mean just a tracking link.

| Route | Gives a real offers/deals feed? | Approval & typical time | Free? | Works with no live site or traffic? | Fit for 2 days |
|---|---|---|---|---|---|
| **Amazon Associates + Creators API** (Creators API replaced the old Product Advertising API, PA-API, which was switched off in 2026) | Product and price data only, no coupon feed | The Associates account is approved after your first sales. The **Creators API needs 10 qualifying sales in the last 30 days.** Below that, every call fails | Yes | No | **No** |
| **Amazon Baby Registry welcome box** (an offer to *show*, not a feed) | n/a. It's an offer page Bundle can point to | n/a | n/a | n/a | Yes, as an allow-list page |
| **Target Partners** (runs on Impact) | Links, plus promotion data through Impact if Target shares it | You apply on Target's own site even if you have an Impact account. They review your site, US audience, family-friendly content and followers | Yes | Unlikely | **No** |
| **Walmart affiliate / Walmart Creator** (Impact) | Links. I found no official feed for creators | Apply through Walmart. One unconfirmed vendor claims about 24-hour approval | Yes | Unlikely | **No** |
| **Babylist affiliate** (Impact) | Links. Promo data only if Babylist uses Impact's Deals feature | Impact review. I found no official commission page, and third-party numbers conflict ($1-8 per registry signup, about 1-20% of a sale) | Yes | Unlikely | **No** |
| **Impact.com** (network) | **Yes.** There is a partner-side "Deals" endpoint plus "Product Promotions" (codes and dates) by API or bulk download, but only for stores that approve you | Account first, then each store approves you | Yes | Weak without a site | No; **apply now** |
| **Rakuten Advertising** (formerly LinkShare) | **Yes.** It has a coupon web service (`/coupon/1.0`), "if enabled for your account" | Publisher approval, then each store approves you | Yes | Unlikely | No |
| **CJ (Commission Junction)** | **Yes.** It has a promotions/coupon feed and a product search; the product search needs stores you've joined | Publisher approval | Yes | Unlikely | No |
| **Awin** (ShareASale shut down Oct 6, 2025 and moved into Awin) | **Yes. This is the clearest public one:** an Offers API with promotions and voucher codes, filtered by date, **including stores you haven't joined** | Publisher approval. Awin has historically charged a small refundable sign-up deposit in some regions; confirm when you apply | Yes | Weak | No; **apply now** |
| **FlexOffers** | **Yes.** One feed of promotions and coupons from 12K+ stores, updated daily, by API or bulk file (XML/CSV) | Publisher approval; process not published | Yes | Unlikely | No |
| **Skimlinks** | One account turns ordinary store links into paying links across thousands of stores. Offer data is limited | Manual review, **3-5 business days** (longer in Q4). Needs a real content site | Yes (they take a cut) | No | No |
| **Sovrn Commerce** | Same idea as Skimlinks. Deals come through partners like FMTC | Every new site goes through a "Network Quality" review | Yes (they take a cut) | No | No |

**Do Skimlinks and Sovrn get you in with less approval?** No. You still need an approved site. They save you applying to each store one at a time, but they don't skip the review.

## 2. Is any coupon feed instant with just an API key?

(An **API key** is a password-like code a program uses to call a service.)

| Option | Instant? | Cost | Notes |
|---|---|---|---|
| **LinkMyDeals** | Sign up and get a key | **Price not public** (their pricing page returned "not found" today). The WordPress add-on is free, but the data isn't | "Daily coupon feeds from 4000+ online stores." Copied from coupon sites, so quality varies |
| **Coupomated** | Sign up and get a key | **Price not public** (pricing page "not found") | Same kind of aggregated coupon data |
| Rakuten coupon API, CJ promotions, Impact Deals, Awin Offers, FlexOffers | **No.** All need an approved publisher account | Free once approved | Reliable data straight from each store's network |
| Skimlinks / Sovrn | No | n/a | See above |

**Verdict:** nothing trustworthy is truly instant. The paid coupon copiers are instant, but their offers often expire or are fake, and the whole point of Bundle is that offers get checked. Leave them out.

## 3. Business angle and trust angle

**Business:** Commission on registry signups and baby purchases is a believable future income stream. Babylist reportedly pays per registry signup plus a share of each sale. Target pays up to about 8% (1-5% is typical) with a 7-day **cookie** (the window after a click during which a purchase still counts). Walmart pays about 1-4%. One Impact account covers all three, which makes it the best first application.

**Trust:** Does commission bias the "graded offers"? It can. To keep it from doing so:
1. **The grade never sees the commission.** Score offers on value, deadline and how well they fit the family *before* any affiliate link is attached. Never sort by commission.
2. **Free government and insurance benefits rank the same as paid ones,** and they will often rank higher. Many of Bundle's best items (WIC, the breast pump insurance must cover, the tax credit) earn nothing, and showing them proves the grades aren't for sale.
3. **Disclose it the FTC way.** The FTC (Federal Trade Commission, the US consumer-protection agency) publishes Endorsement Guides, 16 CFR Part 255, updated 2023. They require a "clear and conspicuous" disclosure, defined as easy to notice and easy to understand. Section 255.5's Example 11 covers commission links in independent reviews. The FTC's FAQ says "affiliate link" alone is **not** enough, while "paid link" right next to the link is. A sentence like "We get commissions for purchases made through links in this post" also works. Put it near the offer, not only in the page footer.
   - Suggested wording for Bundle: next to each paid link, a small **"Paid link"** label. On the offers screen: *"Bundle may earn a commission if you use some links. It never changes an offer's grade, and free benefits are ranked the same way."*
4. **For the demo:** there are no affiliate links yet, so there's nothing to disclose. But showing the planned label is a strong trust point with judges.

## 4. Tavily: how to build it

| Item | Fact (official docs, read Oct 25, 2026) |
|---|---|
| Search | `POST https://api.tavily.com/search`, with the key sent as `Authorization: Bearer tvly-...` |
| Key settings | `query`; `search_depth` = `basic` (1 credit), `advanced` (2), `fast` or `ultra-fast` (1); `max_results` 0-20 (default 10); `include_domains` up to 300, hard filter by default; `exclude_domains` up to 150; `time_range` day/week/month/year; `topic` general/news/finance; `include_raw_content` false/markdown/text; `chunks_per_source` 1-3 |
| Extract (read specific pages) | `POST https://api.tavily.com/extract`. Takes 1-20 page addresses; `extract_depth` basic or advanced; `format` markdown or text. **Costs 1 credit per 5 pages read** (advanced: 2 per 5). Failed pages are free |
| Free tier | **1,000 credits a month, no card.** After that, $0.008 per credit pay-as-you-go |
| Rate limits | Free (development) key: **100 requests a minute.** Paid key: 1,000 a minute |
| Node add-on | **`@tavily/core`, version 0.7.14** (last updated Oct 6, 2026, per npm) |
| Terms on saving results | The terms **don't specifically forbid saving results.** They cover the service "solely for Customer's internal business purposes," don't let you share your key or access, and make you responsible for following each website's own rules. Tavily may keep and reuse what you send it. **Practical reading:** saving a short summary plus the link and the date found (for SAMPLE_MODE and the checker) is fine. Don't republish whole pages; link to the source instead |

**Cost of a sensible design:** Once a day, run Extract on the ~12 fixed pages below (about 3 credits) plus about 5 basic searches limited to those domains (5 credits). That's about 8 credits a day, or about 250 a month, well inside the free tier.

**Suggested flow:** The offer-finder agent calls Tavily Extract on the allow-list pages, plus a few Search calls (`include_domains` = allow-list, `time_range: "month"`). For each result it saves the title, link, date found and a short excerpt. The existing checker agent then grades each offer before a parent sees it. Responses are saved to `bundle/data/sample/` so SAMPLE_MODE works without a key.

### Allow-list: about 12 trusted baby-offer pages (checked Oct 25, 2026)

"200" means the page loaded when I fetched it directly. "Blocks bots" means the site refused my plain request (it guards against automated visitors), but search results confirm the page exists. Tavily may or may not get through on those, so test them first.

| # | Page | Address | Check |
|---|---|---|---|
| 1 | Amazon Baby Registry | https://www.amazon.com/baby-reg/homepage | 200 |
| 2 | Amazon Welcome Box rules (Prime + 10 checklist items + $10 bought) | https://www.amazon.com/gp/help/customer/display.html?nodeId=GBLXVKVYG5SBG8HF | 200 |
| 3 | Target baby registry welcome kit (~$100 value) | https://www.target.com/help/article/000062588 | 200 |
| 4 | Target 15% registry completion coupon | https://www.target.com/help/article/000062273 | 200 |
| 5 | Walmart baby registry and welcome box | https://www.walmart.com/cp/baby-registry/1229485 | Blocks bots (exists per search) |
| 6 | Walmart welcome box offer rules (20 items, $25+ bought) | https://www.walmart.com/help/article/baby-registry-gift-box-offer/9cd45411397d425b8e88bc89583deb62 | Blocks bots (exists per search) |
| 7 | Babylist Hello Baby Box ($30 bought, $8.95 shipping) | https://www.babylist.com/hello-baby/babylist-hello-baby-box | 200 |
| 8 | Pampers Club rewards | https://www.pampers.com/en-us/rewards | 200 |
| 9 | Huggies Rewards | https://www.huggies.com/en-us/rewards | Blocks bots (exists per search) |
| 10 | Enfamil Family Beginnings | https://www.enfamil.com/help-center/enfamil-family-beginnings/ | 200 (old address redirects here) |
| 11 | MySimilac Rewards ("up to $400") | https://www.similac.com/rewards.html | 200 |
| 12 | Aeroflow (insurance-covered breast pumps) | https://aeroflowbreastpumps.com/ | 200 |
| 13 | Byram Healthcare (insurance breast pumps) | https://www.byramhealthcare.com/ | 200 |
| 14 | Massachusetts WIC (state food program for families) | https://www.mass.gov/wic | Blocks bots (official state site) |

Domains for `include_domains`: `amazon.com, target.com, walmart.com, babylist.com, pampers.com, huggies.com, enfamil.com, similac.com, aeroflowbreastpumps.com, byramhealthcare.com, mass.gov`.

Pages that **don't** work (don't use): `babylist.com/hello-baby-box` (404 "not found"), `similac.com/sign-up.html` (404), `costco.com/baby.html` (404).

## What's honestly possible by Oct 27

- **Yes:** a live Tavily offer finder over the allow-list, results run through the existing checker, a saved copy for SAMPLE_MODE, and a "Paid link" disclosure design.
- **Yes:** submit Impact and Awin publisher applications (Lyndsay fills these in herself). Mention them in the deck as "applied."
- **No:** any working affiliate deals feed, Amazon product data, or real commission links. Approval takes days to weeks and usually needs a live site with visitors.

## Sources (all read Oct 25, 2026 unless dated)

- Tavily search parameters: https://docs.tavily.com/documentation/api-reference/endpoint/search
- Tavily extract: https://docs.tavily.com/documentation/api-reference/endpoint/extract
- Tavily credits and pricing: https://docs.tavily.com/documentation/api-credits
- Tavily rate limits: https://docs.tavily.com/documentation/rate-limits
- Tavily terms: https://www.tavily.com/terms
- `@tavily/core` 0.7.14: npm registry (`npm view @tavily/core`), modified Oct 6, 2026
- Amazon PA-API retired / Creators API (third-party write-ups; Amazon's own notice is linked in v2-feedback-research.md): https://dev.to/th3nate/amazon-pa-api-v5-is-shutting-down-april-30-2026-here-is-what-changes-at-the-auth-layer-22ek ; https://affiliatexblocks.com/docs/amazon-creators-api/
- Amazon Welcome Box (Amazon help): https://www.amazon.com/gp/help/customer/display.html?nodeId=GBLXVKVYG5SBG8HF
- Impact partner Deals API: https://integrations.impact.com/partner-api-reference/reference/deals ; Product Promotions: https://impact.com/news/introducing-product-promotions/
- Walmart creator platform on Impact: https://impact.com/news/walmart-introduces-its-new-content-creator-platform-powered-by-impact-com/ ; Walmart welcome box: https://www.walmart.com/help/article/baby-registry-gift-box-offer/9cd45411397d425b8e88bc89583deb62
- Target Partners (secondary): https://loudcrowd.com/blog/target-affiliate-program-how-it-works/ ; https://entreresource.com/target-affiliate-program/ ; Target welcome kit: https://www.target.com/help/article/000062588 ; completion coupon: https://www.target.com/help/article/000062273
- Babylist affiliate (secondary, conflicting): https://linkclicky.com/affiliate-program/babylist/ ; https://www.flexoffers.com/affiliate-programs/babylist-affiliate-program ; Hello Baby Box: https://help.babylist.com/hc/en-us/articles/360054057353-How-do-I-get-a-Hello-Baby-Box
- Rakuten coupon endpoint (secondary): https://github.com/MeltanoLabs/tap-rakutenadvertising ; https://strackr.com/docs/rakuten-advertising
- CJ (secondary): https://marketplace.appthemes.com/plugins/cj-affiliate-coupons/comment-page-1/ ; https://apify.com/viralanalyzer/cj-affiliate-products
- Awin Offers API: https://developer.awin.com/apidocs/promotions ; ShareASale move: https://success.awin.com/articles/en_US/Knowledge/Essential-Awin-Tools-and-Features-for-Upgraded-ShareASale-Publishers
- FlexOffers feed: https://flexoffers.com/publishers/
- Skimlinks approval: https://support.skimlinks.com/hc/en-us/articles/37751190698013-Why-is-there-an-approval-process-for-Skimlinks
- Sovrn approval: https://authcore.atlassian.net/wiki/spaces/KB/pages/2693626921071 ; FMTC/Sovrn: https://www.fmtc.co/?p=113618
- LinkMyDeals: https://wordpress.org/plugins/linkmydeals/ (pricing page 404 today) ; Coupomated: https://discover.commoninja.com/wordpress/plugin/coupomated-connect
- FTC Endorsement Guides FAQ (official): https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking ; 2023 update analysis (Manatt): https://manatt.com/insights/newsletters/advertising-law/an-in-depth-look-at-the-ftcs-updates-2
- Similac Rewards: https://www.similac.com/rewards.html ; Huggies Rewards app: https://www.huggies.com/en-us/rewards/rewardsapp

**Caveats:** Several affiliate facts come from secondary sources (Target criteria, Babylist rates, Rakuten/CJ endpoints). Confirm them inside each network's dashboard when you apply. LinkMyDeals and Coupomated prices could not be found.

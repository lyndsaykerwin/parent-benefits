# Email receipts for Bundle: should we use them, and how?

Written Sat Oct 24, 2026, to answer Lyndsay's question: *"Why don't we use email data? Purchase receipts are likely there for many areas, and it's easier to match."* Research only. No app code was changed.

## Recommendation (read this first)

**Yes, email receipts are the right idea, and they are better than the Amazon upload.** One receipt names the product, the brand and often the model, and it does this for every store a parent buys from (Target, Walmart, Amazon, buybuy BABY, Babylist), not just Amazon. That is exactly what recall matching is missing.

**For the hackathon (by Oct 27): a forwarding address, not "Connect Gmail."**
- Each family gets an address to forward receipts to, run on the agents' existing **Agentmail** account. (Agentmail is an email service built for AI agents: it gives a program its own inbox that it can read through code.)
- The demo uses **fake receipts only**: a "Use sample receipts" button feeds 5 to 6 made-up receipt emails through the same reader, and (optional, if time allows) one live forward to the Agentmail address on camera.
- Code pulls out only the product fields and throws the rest of the email away (section 3).
- The items land in one new database table that Zetaris reads next to the Amazon sample orders, so the recall checker uses them with no other change.
- Effort: **about 5 to 6 hours** for the sample-receipt version, **about 8 to 10 hours** with a live forwarding inbox (section 4).
- It **replaces the "Upload Amazon orders" coming-soon tile** with "Forward your receipts." Plaid stays, with the same job the plan already gives it: store-level features and proving a purchase happened.

**For later (after the hackathon): two steps.**
1. Keep the forwarding address, and add a one-tap guide that sets up an **automatic Gmail filter** ("forward anything from Target, Amazon, Babylist... to my Bundle address"). This gets most of the benefit of connecting Gmail **without** Google's expensive security review, because Bundle never gets access to the inbox.
2. Only when Bundle has real users and money: build "Connect Gmail" properly, which means passing Google's yearly security assessment (section 1a).

**Why not "Connect Gmail" now:** Google classes inbox-reading permission as **restricted**, its strictest level. A public app needs a paid outside security assessment every 12 months, and the review takes weeks. A "testing" version is possible (up to 100 hand-picked test users, a scary "Google hasn't verified this app" warning, sign-in expiring every 7 days), but it would mean reading a real inbox. That breaks the project rule against real personal data unless we build a fake Gmail account full of fake receipts. That is more setup than the forwarding route for less demo value.

---

## 1. Ways to get receipts out of email

### 1a. "Connect Gmail" (Google sign-in that reads the inbox)

How it works: the parent clicks "Sign in with Google" and agrees to let Bundle read their mail. Bundle then uses the **Gmail API** (Google's official way for programs to read Gmail) to search for receipts.

What Google requires (all checked Oct 24, 2026):
- **The permission is "restricted."** Google labels permissions ("scopes") as non-sensitive, sensitive or restricted. Both `gmail.readonly` (read all mail) and even `gmail.metadata` (just senders and subject lines, no message text) are **restricted**. Only `gmail.labels` (see folder names) is non-sensitive, and that is useless for receipts. Source: Google, *Choose Gmail API scopes*, page last updated Sep 10, 2026, https://developers.google.com/workspace/gmail/api/auth/scopes
- **Security assessment.** An app that asks for restricted data and handles it on its own server "must go through a security assessment from Google-empanelled security assessors" (outside security firms Google approves), and must be "reverified … at least every 12 months." Source: Google, *Restricted scope verification*, last updated Aug 19, 2026, https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification . This assessment is called **CASA** (Cloud Application Security Assessment).
- **Cost and time (vendor estimates, not Google's).** Consultants quote roughly **$540 to $1,000 a year** with low-cost assessors, up to thousands for bigger reviews, and **2 to 8 weeks** to get through. Sources: Unipile, *Google OAuth Verification & Gmail API (2026)*, https://www.unipile.com/integrating-google-oauth-2-0-user-authentication-into-your-app/ ; DeepStrike, *Google CASA security assessment*, https://deepstrike.io/blog/google-casa-security-assessment-2025 . Treat these as rough: they come from companies that sell this service.
- **Testing mode (the hackathon loophole).** Apps still in "testing" don't need verification, but only users you add by hand can sign in, they see a warning screen, there is a user cap, and sign-in lapses. Google's help page says unverified apps are "limited to 100 new users until it is verified" (https://support.google.com/cloud/answer/7454865, checked Oct 24, 2026). Google says sign-in permissions given in testing mode "expire after 7 days" (https://developers.google.com/health/setup, checked Oct 24, 2026).

**Realistic for Oct 27?** Technically yes, in testing mode, with a throwaway Gmail account we fill with fake receipts. But it needs a Google Cloud project, a consent screen and test users, and it shows judges a "this app isn't verified" warning. It also points straight at the privacy question ("you read my whole inbox?"). **Not recommended for the hackathon.**

### 1b. A forwarding address (recommended for the hackathon)

How it works: Bundle gives each family an address. The parent forwards a receipt to it, or later sets an automatic filter. Bundle reads only what was sent to it and never touches the parent's inbox. No Google review applies, because Bundle never asks Google for permission to anything.

What Agentmail offers (docs checked Oct 24, 2026):
- **Receiving and notification.** When mail arrives, Agentmail can call our server. This is a **webhook**: a message one service sends another when something happens. The event is `message.received`, and it carries the sender, subject, plain text and HTML (the formatted version) of the email. Docs warn that text can be missing when the email is HTML-only, so the reader must handle HTML. https://agentmail.to/docs/events.md
- **No public web address needed.** Webhooks need a server the internet can reach. Agentmail also offers **polling** (our app asks "anything new?" every so often) and WebSockets (a connection that stays open), so it works from a laptop. https://agentmail.to/docs/knowledge-base/handling-inbound-emails.md , https://agentmail.to/docs/webhook-polling.md
- **Attachments** (PDF receipts). Each one has an ID. We ask for it and get a short-lived download link, and sometimes a text version of the attachment. https://agentmail.to/docs/attachments.md
- **Allowlist.** An inbox can accept mail only from listed addresses or domains. For the demo we can lock the inbox to our own sending address, so no stranger's real email can get in. https://agentmail.to/docs/lists.md
- **Free tier:** 3 inboxes and 100 emails a day, no card needed. https://docs.agentmail.to/
- **Plus-addressing / one inbox per family.** For the demo, one shared inbox and a family code in the subject line ("BUNDLE-maya") is enough. Separate inboxes per family come later.

Weaknesses: parents must remember to forward (fixed later by the auto-filter guide), and forwarded emails are messier: the original sits below a "Forwarded message" header. The reader must handle that.

### 1c. Outlook and others (brief)

- **Outlook / Microsoft 365:** Microsoft's version is the `Mail.Read` permission through Microsoft Graph (Microsoft's API). A personal Outlook user can usually agree for themselves. Work accounts often need their company's IT admin to approve, and apps without "publisher verification" show an "unverified" warning. Sources: Nylas, *Microsoft OAuth scopes* (https://developer.nylas.com/docs/cookbook/use-cases/build/microsoft-oauth-scopes.md); Intric, *Outlook setup* (https://help.intric.ai/en/docs/tools-and-integrations/microsoft/outlook/setup/), both checked Oct 24, 2026. Lighter than Google, but still a sign-in build. Later, not now.
- **Yahoo, iCloud and others:** no simple consumer API. The forwarding address covers all of them, which is another reason it is the better first step.
- **Middleman services** (Nylas, Unipile) give one API for all email providers, but they don't remove Google's restricted-scope review for our app. Later only.

### 1d. Receipt-reading services worth knowing

These turn a receipt (email, PDF or photo) into neat fields, including **line items** (one row per product bought):
- **Veryfi:** handles photos, PDFs and emailed receipts and returns line items. https://www.veryfi.com/fields-supported/line-items/
- **Mindee:** receipt API with a free tier. https://www.mindee.com/blog/parsing-receipts-with-mindees-machine-learning-api
- **Taggun:** API-only, noted for line items. https://parse.gl/brands/taggun-io
- Overview: Klippa, *Best receipt parsing APIs*, https://www.klippa.com/en/blog/information/best-receipt-parsing-apis/ (all checked Oct 24, 2026; I found no independent accuracy tests or current 2026 prices).

**For the hackathon we don't need any of them.** Store emails from Target, Amazon, Walmart and Babylist follow fixed layouts, so a small code reader per store plus an AI fallback for unknown stores is enough. It also keeps receipt data off yet another outside company's servers. Veryfi is the one to try later for photos of paper receipts.

---

## 2. What receipts contain, and how that changes matching

| Field | Bank / card line (Plaid) | Amazon order export (CSV file) | Email receipt |
|---|---|---|---|
| Store | Yes (often messy: "AMAZON MKTPL*2K4RT81Q3") | Amazon only | Yes, any store |
| Product name | **No** | Yes, full title | **Yes**, sometimes shortened |
| Brand | No | Inside the title | Inside the title, sometimes a separate line |
| Model / size / colour | No | Sometimes in the title | Often (e.g. "Color: Grey, Size: Standard") |
| Product ID | No | ASIN (Amazon's product code) | Sometimes the store's code or a product link |
| Order date | Charge date (can be days later) | Yes | Yes |
| Seller | No | Yes (who actually sold it on Amazon) | Often ("Sold by …" on Amazon and Walmart emails) |
| Price per item | Total only | Yes | Yes |
| Covers which stores | All | Amazon only | Every store that emails a receipt |
| Effort for parent | One sign-in | Request file from Amazon, wait hours to days, upload | Forward, or set a filter once |

Sources: Plaid fields from `research/entity-resolution-test.md` §1 (checked against Plaid docs Oct 24, 2026). Amazon's full export now comes through its "Request your data" page as a ZIP, and the wait "can take several days" (https://takeoutday.org/guides/how-to-download-amazon-data, checked Oct 24, 2026). That alone makes the upload a weak step for a tired new parent.

**How this changes matching.** The "brand + product type + date" matcher from the entity-resolution test (12 of 12 on the main set, 7 of 8 on fresh data, see `research/entity-resolution-test.md`) is built for exactly this kind of data. Receipts feed it **better** inputs than bank lines, and as good as or better than the Amazon file:
- **Brand + product type** come from the item title, the same as for Amazon orders. No new matching logic is needed.
- **Seller rule** gets stronger: receipts say which store sold it, so "sold only at Amazon, Aug 2024 to Jul 2025" can be checked for non-Amazon stores too.
- **Date rule** gets more accurate: the receipt has the order date, not the later charge date.
- **Model/size clash rule** gets more data: colour and size lines help rule out wrong alarms (for example a different mattress size).
- **New risk:** shortened titles ("Graco 4Ever DLX…") can lose the product-type word. The AI fallback may fill in the type when the rules find none, exactly as the plan already allows, and it never decides an alert on its own.
- **Linking to Plaid:** the plan's "store + amount + date within 3 days" link to a card line works across all stores, not just Amazon. So "the bank proves you bought it, the receipt says what it was" now covers Target and Walmart too.

Expected accuracy: the same as the matcher on the Amazon sample orders (about 88% found, 88% of alerts right on fresh data), minus a little for shortened titles. This is a reasoned estimate, not a test. A quick re-run of the ER test with the same items written as receipt emails would confirm it (about 1 hour).

**Other features receipts help:**
- **Dependent Care FSA (childcare bills):** daycare invoices and payment confirmations (Bright Horizons, Brightwheel, Procare) carry the provider name, child, dates and amount, which is what the FSA claim needs. (An FSA is a Flexible Spending Account, a work account that pays childcare costs with money that isn't taxed.) Better than Plaid, whose label was wrong on the daycare line.
- **Health FSA / HSA eligible items** (breast pumps, thermometers): the item name tells us it's eligible. A bank line can't. (An HSA is a Health Savings Account, a similar untaxed account for health costs.)
- **Price drops / money back:** the Clawback Hunter needs the exact item and price paid to spot a price drop inside a store's adjustment window. Receipts give both. (Live price feeds stay cut, so this only works with offers we already have.)
- **Return windows:** the order date plus the store's return policy gives a "return by" deadline.
- **Registry:** Babylist and Amazon registry "item purchased" emails show what was bought from the registry, a pre-birth recall watch with no extra sign-in.
- **Insurance:** hospital and insurer emails (explanations of benefits, bills) could later flag "your plan should cover the breast pump." Out of scope for the hackathon, and high privacy risk (medical data). Leave it off.

---

## 3. Privacy and guardrails

**Project rule: no real personal data.** For the demo:
- All receipts are **made up**: fake order numbers, fake names ("Maya Test"), fake addresses or none, real product names (they are public facts), and dates inside the recall windows so the matcher has something to find.
- The live inbox (if built) has an **allowlist** with only our own test sending address, so a real person's email can't get in.
- Store the sample receipts as files in `bundle/data/sample/receipts/` with "SAMPLE – NOT A REAL ORDER" in the subject.

**What the app keeps (keep only what you need):**
- **Keep** one row per item: `family_id`, `source` ("email"), `store`, `order_date`, `title`, `brand` (if found), `model/size/colour` (if found), `seller` (if found), `quantity`, `price_cents`, `receipt_hash` (a fingerprint of the email, used to stop counting the same receipt twice, which can't be turned back into the email).
- **Drop immediately:** the raw email body and HTML, sender and recipient addresses, names, shipping and billing addresses, phone numbers, payment card digits, order-tracking links, and any email that isn't a receipt (if a parent forwards something else, store nothing and reply "we only read receipts").
- **Delete from Agentmail** once read, so the email doesn't sit in a second inbox. Attachment links already expire on their own.
- The AI fallback gets **only the item lines**, never the whole email, so names and addresses never go to an AI model.
- A "forget my receipts" button deletes the family's rows. Later: tell parents plainly what we keep, in one sentence on the forward screen.

**How it fits with Zetaris** (the required "data door" that lets one SQL query read many sources):
- Add a Neon table `receipt_items` with the fields above. Register it as a Zetaris source next to `amazon_orders` and `transactions` (in `bundle/scripts/zetaris/register.ts`).
- Extend the existing `v_recall_orders` view (it already combines Amazon orders and card rows) to also include `receipt_items` with `'email' AS source`. The recall checker then sees receipt items with no other code change. The plan's "Plaid rows out of recall matching" change still applies.
- Add a **privacy view** (a saved query that shows only safe columns) for agents, for example `v_purchase_items`: store, date, title, brand, type, price, and no price for agents that don't need it. Agents only ever read the view, never the table. This is a good "Zetaris does real work" point for judges: one view joins items from three different sources (Amazon file, email receipts, card lines).
- Optional: a `v_receipt_card_link` view pairing a receipt with its card line (store + amount + date within 3 days) to show "proven purchase."

**How it fits with Meterless** (the required memory engine, H-MEM):
- Memory stores the parent's **feedback about items**, for example "not mine, it was a gift I gave away," "already returned," "wrong model." The next run then doesn't raise the same alert again. Memory points to the item by its row ID, not by copying receipt text.
- Never put raw email text into memory.
- Nice demo moment: parent taps "returned it" on a recall card, and the next run says "skipped: you told us you returned this."

---

## 4. Effort and what it replaces

Where order data comes in today (checked in code Oct 24, 2026):
- `bundle/data/sample/amazon-orders.csv`: 3 sample orders for family "maya" (crib mattress, swaddles, sound machine).
- `bundle/server/ingest/amazonCsv.ts`: reads that file (and Amazon's real export column names) into the `amazon_orders` table defined in `bundle/shared/schema.ts`. That table has only id, family, date, title, ASIN, UPC (barcode number) and price: no store, brand or seller.
- `bundle/scripts/zetaris/register.ts`: `v_recall_orders` combines `amazon_orders` with card `transactions`.
- `bundle/client/src/pages/Onboarding.tsx`: "Upload Amazon orders" and "Connecting a card" are coming-soon buttons.

The receipt reader slots in **next to** `amazonCsv.ts` as `server/ingest/emailReceipt.ts`, writing to a new `receipt_items` table. It doesn't change the existing order path.

| Piece | Hours |
|---|---|
| 5 to 6 fake receipt emails (Amazon, Target, Walmart, Babylist, a daycare invoice, one non-receipt) | 1 |
| Reader: per-store rules for 3 to 4 stores, handle "Forwarded message", AI fallback for item lines only, with timeout | 2 to 2.5 |
| `receipt_items` table, Zetaris registration, add to `v_recall_orders`, privacy view | 1 |
| "Use sample receipts" button replacing the Amazon tile, results update | 1 |
| Tests (each sample gives the expected items; non-receipt stores nothing; no address or name saved) | 0.5 to 1 |
| **Subtotal: sample-receipt version** | **about 5.5 to 6.5** |
| Live Agentmail inbox: create inbox, allowlist, polling route (no public address needed), delete after read, secrets in env file | 2 to 3 |
| Re-run the entity-resolution test with receipt-shaped items | 1 |
| **Total with live inbox** | **about 8.5 to 10.5** |

**What it replaces or cuts:**
- **Replaces the "Upload Amazon orders" tile** with "Forward your receipts" (plus "Use sample receipts"). The Amazon reader code stays, because the sample families still load from the CSV. The grade's "a small real order upload would make Product & UX a 9" (`plans/plan-grade-future-state.md` §2e/§4b) is met by receipts instead, and covers more stores.
- **Plaid keeps its role** as the plan sets it: store-level features (daycare bills for the Dependent Care FSA, spotting baby spending), linking a card line to its item, and out of recall matching. No Plaid work is cut.
- **Depends on the matcher upgrade.** Like the Amazon upload, receipts run through today's matcher would find almost nothing (0 of 12 without AI). Only build this if the brand + type matcher is built.
- **Where it goes in the cut order:** treat it as the same slot the Amazon upload had. If time is short, build the sample-receipt version only (about 6 hours) and put the live inbox and auto-forward filter on the roadmap slide.
- **Pitch line update:** "Bank data tells us where you shop. Your receipts tell us what you bought. Recalls need the second, so just forward them."

## Open questions for Lyndsay
1. Sample receipts only (about 6 hours), or also the live forwarding inbox (about 9 to 10 hours)?
2. OK to retire the Amazon upload tile in favour of receipts?
3. Should the daycare-invoice receipt feed the Dependent Care FSA card in the demo (small extra, about 1 hour)?

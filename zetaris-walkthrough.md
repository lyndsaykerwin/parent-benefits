# Zetaris walkthrough for the new-parent benefits app (Oct 21, 2026)

Sources: Zetaris's official hackathon starter guide (copied into [zetaris-getting-started/](zetaris-getting-started/START-HERE.md); online at https://github.com/zetaris/getting-started, last updated Oct 20, 2026), https://www.zetaris.com, and your hackathon files. Zetaris is **required in every submission** (hackathon-overview.md, faq.md, weak-submission-examples.md).

## Step 1: What Zetaris actually is

Think of it as a **librarian for data that lives in many buildings**. You don't move the books. You tell the librarian where each building is once. After that you ask questions in one language (SQL), and the librarian fetches from every building and combines the answers.

- **SQL** is a way of asking a question of tables. Example: "show me every offer where the state is MA and the baby's age is under 6 months."
- **Table** means rows and columns, like a spreadsheet tab.
- Zetaris's SQL flavor is "Spark SQL." You won't need to know the difference; Cursor and Claude can write it.

## Step 2: The one rule that shapes everything

**Zetaris reads tables. It does not read web pages.**

It is good at: JSON from an API (a website's machine-readable feed), CSV/Parquet files kept in online storage, and databases like Postgres.
It cannot (as documented): read a mass.gov web page, read a PDF in practice, read a file sitting on your laptop, or add new rows to a table. It is essentially read-only.

So every source in your app falls into one of two buckets:
- **Already a table:** Zetaris connects to it directly.
- **A messy web page:** an agent (your Scout) has to read it first and turn it into rows. Then Zetaris can read those rows.

## Step 3: Your data sources, one by one

| Source | What it is | Already a table? | How it reaches Zetaris |
|---|---|---|---|
| Government benefit pages (IRS Trump Account, MA paid leave, boston.gov) | Web pages | No | Scout reads the page → writes rows (name, amount, who qualifies, deadline, source link) to your database → Zetaris reads the database |
| Store and brand offers (registry discounts, free samples) | Web pages | No | Same as above |
| Saved copies of offer pages (so judging never depends on live sites) | Files | Partly | Save the extracted rows as a CSV in online storage (S3, Amazon's file storage) |
| Official reference numbers (e.g. federal poverty guidelines that set WIC and MassHealth income limits; ZIP code → city and state lists) | Published spreadsheets | **Yes** | CSV in S3, or a public JSON API |
| The 3 fake parent personas | Your test families | Yes, once you make them | Table in your database |
| Parent feedback ("this charged me shipping") | New rows written during the demo | Yes | Must live in your database, because Zetaris can't write rows. Meterless memory stores the lesson learned |

**Your database:** Supabase, which is a hosted Postgres database (an online database you don't have to run yourself). You already have Supabase connected to Claude. Zetaris officially supports Postgres. Nobody has documented testing Supabase specifically, so that's the first thing to check.

## Step 4: How the pieces fit

```
  web pages ──► Scout agent ──► Supabase (offers, personas, feedback)
                                      │
  reference CSVs in S3 ───────────────┤
  public JSON APIs ───────────────────┤
                                      ▼
                     ZETARIS: one place to ask questions
                     (a "virtual data mart" = a saved bundle of
                      tables from different places, nothing copied)
                                      │
            Checker, Reviewer and Matcher agents ask it questions in SQL
```

The agents talk to Zetaris by sending SQL over its **REST API** (a web address your code sends requests to). The starter guide has ready-made scripts for this (`scripts/query_zetaris.py`).

## Step 5: Making Zetaris do real work (not decoration)

The judges' test: **if you deleted Zetaris, would the app still work?** If yes, it's decoration. Jobs that make it load-bearing:

1. **Cross-checking (the strongest one).** The Checker asks Zetaris to join the Scout's offer rows against the official income-limit file: "Scout says WIC's income limit for a family of 3 is $X; the official table says $Y." The disagreement goes back to the Scout. This is exactly Track 1, "Solving Fragmented Intelligence."
2. **Matching.** One SQL question joins a persona's ZIP code, income and baby's age against every offer, across sources.
3. **Built-in quality rules.** Zetaris has data-quality checks (`REGISTER DQ` / `RUN DQ`), e.g. "every offer must have a source link and a deadline." Failures can block an offer.
4. **Shared definitions.** Its "semantic layer" stores one meaning of things like "eligible" so every agent uses the same rule.

## Step 6: The biggest risk is setup, not design

You need your own Zetaris instance. Two routes, both free to start:
- **On your Mac:** needs Docker (an app that runs packaged software). Not installed yet. Zetaris is built for Intel chips, and your Mac uses Apple's own chips, so it runs in a slower compatibility mode. It also needs 8GB of memory and 15GB of disk.
- **On Amazon's cloud (AWS):** about 30 minutes to set up. New accounts get $200 in credit; a week non-stop used about $80.

Other known snags from the starter guide: live API tables can be slow (one took 50 seconds until cached), and number fields sometimes arrive as text.

## Step 7: What to do tomorrow (Oct 22), in order

1. Register at https://cloud.enterprise.zetaris.com/register (free "Hobby" tier). Separately, make sure you're registered for the hackathon itself: it closes Oct 22, 23:45 UTC (faq.md).
2. Pick the install route, and get the sample query running. Stop here until it works.
3. Connect Supabase as a Postgres source and run one query against it.
4. Put one reference CSV in S3 and join it to a Supabase table in one query. Once this works, the core idea is proven.
5. If stuck for more than an hour, ask in the Zetaris Discord: https://discord.gg/GTmaNZyJnH

## Not confirmed yet
- Whether Zetaris has a working MCP connection (a plug that lets an AI use it directly). Its homepage shows one, but the starter guide only documents REST and JDBC.
- Whether Supabase connects cleanly (it should, since it's Postgres).
- Excel and Google Sheets: not supported as far as the docs show. Export to CSV instead.

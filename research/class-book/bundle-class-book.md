---
title: "Bundle: The Class Book"
subtitle: "Agents, Zetaris, Meterless, data, and what to build for families who spend a fortune on kids"
date: "October 22, 2026"
---

# How to read this

This is a study guide for one decision: **what should Bundle actually be?** It's written like a class for a smart 12-year-old. Every piece of jargon gets taught the first time it shows up and collected again in the glossary at the end. The recommendation comes first so you know where we're heading. The rest shows the work.

Facts were checked against sources dated mostly 2025–2026 (searched Oct 22, 2026). Anything shaky is marked **(check)**. Sources are listed by chapter at the end.

## The short version

1. **The problem is real and big.** Raising a US child to 18 costs roughly **$310,000–$390,000**. Infant daycare in Massachusetts runs about **$27,000 a year** (check). Families also leave money unclaimed: only **56%** of people eligible for WIC were enrolled in 2023, about **1 in 5** eligible workers miss the EITC, and about **half** of FSA holders forfeit money every year (average **$441**).
2. **"A bunch of government databases" is the weak version.** The strong version joins **the family's own private data** (what they actually spend) with **public rules and prices**, under strict privacy controls. That's exactly the job Zetaris was built for, and it's what makes the product feel like magic instead of a directory.
3. **The newsroom is still the right agent design, but it needs a better front page.** Instead of a ranked list of deals, the newsroom should publish **one number and a countdown**: *"Baby Maya: $9,840 found, 4 deadlines, the first in 6 days."* The agents argue in public before anything reaches the parent ("Fine Print Court"), and the Coach turns parent feedback into "case law" stored in Meterless memory.
4. **Recommended concept: "The First 100 Days" (working title).** It combines the 30-Day Window idea (deadlines and dollars unlocked by a birth), Fine Print Court (visible critique between agents), and a light Clawback (money back from what the family already spent, using fake bank data from Plaid's free test environment). Details in Part 6.

# Part 1: The problem, in numbers

## Kids are expensive, and getting more so

- **Raising a child to 17–18:** estimates range from about **$310,605** (Brookings, for a child born in 2015) to **$318,949** (Credit Karma's inflation-adjusted USDA figure for a 2025 baby) to about **$389,000** (LendingTree, 2023).
- **The first year:** BabyCenter's 2025 survey says about **$20,384**, not counting the birth, with childcare about half of that. (check: it came out as a sponsored press release.)
- **Childcare:** the national average is **$13,184 a year** (Child Care Aware, 2025). Massachusetts is the most expensive state for infant care in a center, at about **$27,067** (check: secondhand reports of that same report). The Department of Labor says one child in full-day care costs **9–16% of a family's median income**.
- **Gear prices jumped:** a congressional minority analysis of Babylist data found car seats, strollers and similar gear rose about **24% between April and June 2025**. About **97% of strollers** and **87% of car seats** are made in China, so tariffs (taxes on imported goods) hit them hard.

## Money families qualify for but never get

Economists call this the **take-up gap**: the difference between who *qualifies* for a benefit and who actually *gets* it.

| Program | Take-up | What it means |
|---|---|---|
| **WIC** (food program for pregnant women, babies and young kids) | **56.1%** of eligible people (2023) | 82% of eligible infants, but only 27% of eligible 4-year-olds |
| **EITC** (a tax refund for lower-income workers) | about **78%** claim it | Roughly 1 in 5 eligible people miss out |
| **FSA** (pre-tax account for health costs) | About **half** forfeit money each year | Average loss **$441**. The top reason is not knowing what counts |
| **Car seat recalls** | **42%** of parents register their seat | Only about **40%** of recalled seats ever get fixed |

## The "time tax"

Journalist Annie Lowrey coined **"time tax"**: the hours people lose to forms, phone queues and proving they qualify. It hits hardest the people who have the least time, and a new parent has almost no free time. NPR revisited the idea in August 2026. Nobody has measured the time tax for new parents specifically, which is itself an opening.

## 2026 changed the rules (so everyone's information is out of date)

- **Trump Accounts:** launched July 4, 2026. Every US child born **2025–2028** gets a **$1,000** federal deposit. Parents start by filing **IRS Form 4547** at trumpaccounts.gov. Families can add up to $5,000 a year.
- **Federal tax changes from the 2025 law (the "One Big Beautiful Bill Act"):**
  - The child tax credit is now **$2,200 per child**.
  - The **dependent-care FSA limit** rose from **$5,000 to $7,500**, the first change since 1986. Employers aren't forced to adopt it, so it depends on each employer's plan.
  - The childcare tax credit (CDCTC) now covers up to **50%** of costs for the lowest incomes. (check the exact income cutoffs on IRS Form 2441.)
- **Massachusetts:** the state child tax credit is **$440 per child**, paid even if you owe no tax. Paid family leave (PFML) now pays up to **$1,230.39 a week**.

**Why this matters for the pitch:** when the rules change this much in one year, even well-informed parents are working from old information. That gives a "you're probably missing this" product an urgent, timely hook.

# Part 2: The tech, from first principles

## What an "agent" is

A **model** (or **LLM**, "large language model") is the AI brain: you send it words and it sends words back. On its own it can't *do* anything.

An **agent** is a model plus three things:

1. **A job:** "you are the Fact-Checker."
2. **Tools:** things it can call, like "run this database query" or "read this web page." Using them is called **tool use**.
3. **A loop:** look → think → act → check the result → repeat until done.

A **multi-agent system** is a team of agents with different jobs. The code that decides who goes next is the **orchestrator** (in your plan, the "Coordinator"). The hackathon judges have a clear taste:

| Weak (they mark it down) | Strong (they reward it) |
|---|---|
| **Linear pipeline**: A → B → C, every time | **Branching**: the next step depends on what happened |
| Agents that just rephrase a prompt ("prompt wrappers") | **Critique**: one agent checks another and can reject its work |
| No memory | **Shared state / memory**: agents build on each other |
| One try | **Retries** and **escalation**: try again, or hand a hard case up to a supervisor or a human |
| No evidence | **Traces / logs**: a diary showing who did what and why |

**Where agents shine vs. ordinary code:** agents are good at *fuzzy* work: reading messy pages, judging "is this worth a tired parent's time?", explaining, arguing, planning. Ordinary code and databases are better at *exact* work: math, eligibility cutoffs, joining tables. A great design gives each side the work it's good at.

## Zetaris: the data door

**The problem it solves.** Useful facts live in many places, called **data sources**. Each has its own format, its own update schedule and its own way of being asked questions. Normally, to combine them, you'd copy everything into one big database. That's called **ETL** (extract, transform, load). Copies go stale, and keeping them fresh is a full-time job.

**What Zetaris does instead: data virtualisation.** It leaves every source where it lives and only records its **metadata** (data about the data: what tables exist, what the columns are called, where the source lives). Then you ask **one question in one language** (**SQL**, Structured Query Language) and Zetaris reaches into every source at once and combines the answers. Combining rows from different tables is called a **join**.

Think of a librarian who never moves the books. They keep a **catalog** of what's in every building, and when you ask a question they go read the original and bring back the answer.

**The four kinds of sources Zetaris can connect** (from its docs):

| Type | What it means | Bundle examples |
|---|---|---|
| **File sources** | Files like CSV, JSON, Parquet (a compressed, column-by-column table format) sitting in storage like AWS S3 | A hand-made "program rules" table; an Amazon order-history export |
| **Logical sources (databases)** | Any database with a **JDBC** connector (a universal database plug), like Postgres | Your Neon database: families, feedback, transactions |
| **REST APIs** | Websites that hand back raw data when you visit a special address (an **endpoint**) | CPSC recalls, openFDA recalls, Open Food Facts |
| **Streaming** | Data that keeps flowing in, like a river instead of a lake | Recall alert feeds, price-drop alerts |

**Other Zetaris powers worth knowing** (from its starter guide):

- **Governance:** rules about *who may see what*. `GRANT … ON VIEW` gives each user or agent its own **view** (a filtered window onto the data). Example: the Scout agent never sees a family's income; only the Planner does.
- **Data quality (DQ) rules:** `REGISTER DQ` / `RUN DQ` let you declare checks like "every offer must have a source link and a deadline," and flag rows that fail.
- **Semantic layer:** one stored definition of business words like "eligible," so every agent uses the same rule.
- **Catalog discovery:** agents can *ask Zetaris which sources exist* instead of having them written into the code. Add a new source and the agents find it on their own.

**Its limits:**

- It's **read-only**: it can't save new rows, so feedback has to be written to Neon.
- It reads web addresses that return data; it doesn't read normal web pages.
- Sources that need a sign-in step first (**OAuth**, the "allow this app to access your bank" button) probably can't be wired straight in. The safe pattern: a small script copies that data into Neon, and Zetaris reads Neon. (Inferred from the docs, not tested.)

**When Zetaris is worth it:** several sources, which change over time, which you need to combine, and some of which are private. **When it's decoration:** one source, or a token query. The judges' own words: a Zetaris call that does nothing scores **"near zero"** on Sponsor Tech.

## Meterless: the agents' organs

Meterless is one company with two halves.

**Half 1: the engines (blueprints plus ready-made code).** These give agents the "organs" a bare model lacks:

- **H-MEM (hierarchical memory):** a diary with a librarian. Each memory carries:
  - **provenance**: where it came from
  - a **confidence** score: how sure we are
  - a **layer**: short-term, working, or long-term
  - links like **supersedes**: this replaces that older rule

  Before an agent acts, H-MEM **retrieves** the most relevant memories and **reinjects** them into its instructions. When a memory proves right or wrong, its confidence moves up or down. When two memories conflict, it **auto-resolves**, escalating only close calls. Between runs it can **"dream"**: look across many memories and propose new general rules, which pass an approval step before they become permanent. Every change is written to an **audit ledger** in **JSONL** (plain text, one record per line) that judges can read.
- **World Model:** a shared whiteboard of **entities** (things like "Maya," "the Graco car seat," "Dad's employer") and how they relate. Every agent reads the same picture instead of re-figuring it out.
- **Markovian engine:** splits a very long task into small chunks and carries a compressed summary forward, so the model never runs out of room.
- **Scout Intent:** a safety guard that classifies what an agent is about to do and blocks risky actions until a person approves.

**Half 2: Nightshift, the "AI hotspot."** An app that turns your computer into a private AI server that other apps send questions to. Your Mac (M4) qualifies for the free version, which runs small models.

**For Bundle, the important engine is H-MEM.** It's what lets the app *learn*. The judges' rule of thumb from Meterless's own docs: **"stored ≠ loaded."** A memory nobody reads back is decoration.

## The rest of the stack (already set up)

| Tool | Job | Status |
|---|---|---|
| **NVIDIA Nemotron** | The models that power the agents | Key and credits still to claim |
| **Neon** | Postgres database for families, feedback and transactions | Connected |
| **Firebase** | Sign-in (email and Google) | Set up |
| **the VibeCode template** | Ready-made website: login, pages, Stripe payments, tests | Chosen |

# Part 3: Data sources that actually make this cool

## Why "only government databases" feels flat

Government data is *public*: everyone has the same copy, so the answer is the same for every family. A product built only on public data is a **directory**, and directories are commodities (hard to stand out with).

The magic happens when you join **public rules** with **private facts about one family**. The Points Guy didn't win by publishing card rules; it won by saying "*your* points are worth $X." Credit Karma's offers got good because it already knew *your* credit.

## The four families of data

| Family | Examples | Why it matters |
|---|---|---|
| **1. The family's own private data** | Card transactions, Amazon orders, employer benefits, daycare bills | The "you" in "you left $1,140 on the table." Needs governance. |
| **2. Rules and entitlements** | Program rules, tax credits, FSA-eligible lists, registry perks | Turns spending into money back |
| **3. Prices and products** | Barcodes, price history, product catalogs | "Is this a good price?" |
| **4. Safety and benchmarks** | Recalls; county childcare prices | "Is this safe?" and "am I overpaying?" |

## The best sources for a 5-day build

All free, or with free test versions that use fake data.

1. **Plaid Sandbox:** Plaid is the service most finance apps use to connect bank accounts. Its **sandbox** (a test environment with fake data) is free and unlimited, and the test login `user_transactions_dynamic` produces realistic, changing transactions. You can even design custom fake families. **This is the single biggest "wow" upgrade.**
2. **CPSC recalls API:** the Consumer Product Safety Commission's free recall data, no key needed. The easiest new Zetaris source.
3. **openFDA food recalls:** infant formula and baby food recalls, updated weekly.
4. **Open Food Facts:** product lookup by barcode. Zetaris **already has a verified recipe** for it.
5. **A fake Amazon order-history file:** Amazon lets real customers download their orders as a CSV, so we build a fake one in the same format and Zetaris reads it as a file source.
6. **DOL National Database of Childcare Prices:** county-by-county childcare prices (2008–2022, update in progress).
7. **A hand-made rules table with citations:** FSA-eligible baby categories (from IRS Publication 502), 2026 tax rules, registry perks, Massachusetts PFML.
8. **Bundle's own feedback database (Neon):** parent reports. This is where per-user privacy shows off.
9. **UPCitemdb:** turns a barcode into a product name (about 100 free lookups a day). The "bridge" between sources.
10. **Live feeds (CPSC recall RSS, Slickdeals RSS):** they make the app feel alive.

## Three "killer joins" (impossible without virtualisation)

1. **"Money you left on the table."** Plaid card transactions × Amazon orders × FSA-eligible list × 2026 tax rules → *"You spent $1,140 on FSA-eligible baby items with a regular card and $9,800 on daycare. Here's how to claim money back."* Four owners, four formats, and the bank data never gets copied into anyone else's system.
2. **"Is anything in my house recalled?"** Purchases → barcode → CPSC + openFDA + NHTSA (car seats) recalls, checked live. A recall list that's a week old is dangerous, which is the whole point of not copying it.
3. **"Am I overpaying?"** Daycare payments × the county's median childcare price × anonymized results from other Bundle families (*"3 nearby families switched and saved 12%"*). Per-user views let each parent see their own row against the crowd's totals, never another family's data.

## Sources to avoid this week

| Source | Why not |
|---|---|
| **Amazon's product data service** (PA-API) | Shut down in 2026; its replacement requires an approved affiliate account with recent sales |
| **Real Gmail inboxes** | Reading mail needs Google's paid security review; use a fake test inbox at most |
| **Reddit** | New data access reportedly takes 2–4 weeks to approve |
| **Keepa** (Amazon price history) | Costs money; only worth it if price history is the star feature |
| **Affiliate networks** (Impact, CJ) | Brand approvals take days to weeks |
| **Scraping** (Consumer Reports, Target, resale sites) | Breaks their terms |
| **Real family data of any kind** | Hackathon rules: fake data only |

# Part 4: Inspiration, and what to steal

## The Points Guy: turn rules into one number

A travel and credit-card advice site that makes money from card **affiliate** fees (a commission when you sign up through its link). Its magic was **valuation**: it says what a point is worth in cents (Chase points were 2.05¢ in August 2026). Its app also shows all your loyalty balances in one wallet and warns you before points expire.

**Steal:** put a dollar value on everything. *"Your family is leaving about $X a year unclaimed"* beats any list.

## Military benefits apps: prove it once, unlock everything

- **My Military OneSource** (the Defense Department's free app) has a **Benefits Finder**: answer a few questions and it shows only what you qualify for.
- **GovX ID** and **ID.me** check your status once, then let you unlock discounts at hundreds of stores without re-proving it. ID.me had 157M users by December 2025.

**Steal:** a reusable **"verified parent"** status (due date or kids' ages, state, employer) that unlocks everything, and only ever show what *this* family qualifies for.

## Honey, Rakuten, Capital One Shopping: watch in the background

You install once and savings appear at the moment you pay. **Warning:** Honey was sued in 2025 (the case was dismissed) over secretly swapping creators' affiliate links. Hidden money tricks wreck trust.

**Steal:** the "we'll tell you when it matters" habit. Be completely open about how you make money.

## Rocket Money and Paribus: do the boring work, get paid only when it works

- **Rocket Money** cancels subscriptions and negotiates bills, keeping **35–60% of the first year's savings**, and only if it succeeds. Rocket Companies bought it for $1.275B.
- **Paribus** read email receipts and automatically claimed refunds when prices dropped. Capital One bought it, and its founders went on to start Ramp.

**Steal:** a **success fee** (you pay only when you get money back) is a business model people trust, and receipts are a goldmine.

## Propel: build on one question people ask constantly

It started as a SNAP balance checker (SNAP is food stamps; EBT is the card the benefit is loaded on). Now about **5M people a month** use it, roughly a quarter of SNAP households. It grew from one habit, *"what's my balance?"*, and added everything else on top.

**Steal:** find the question parents ask over and over (*"what do I need to do this week?"*).

## Babylist: catch families at the start, then grow with them

A registry that works with any store. Revenue was **$750M+** in 2025, up 45%. Its **Health** business ships breast pumps paid for by insurance, turning a benefit people didn't know they had into a simple order. Its **completion discount** gives 15% off unbought registry items.

**Steal:** "you already have this benefit, here's the one-tap way to use it" is a proven model.

## Credit Karma and NerdWallet: free tool, personalized offers

Credit Karma made **$2.26B** in Intuit's 2025 financial year, and NerdWallet made **$836.6M** in 2025. The free profile is what makes their offers relevant ("your approval odds").

**Steal:** show **"likely eligible"** confidence the way they show approval odds.

## Agents that act for you, and a cautionary tale

- **Pine** (raised $25M in December 2025) is an AI agent that calls companies to lower bills and win refunds.
- **DoNotPay** called itself a "robot lawyer." The FTC (the US consumer-protection regulator) ordered refunds and banned unproven claims in January 2025.

**Steal:** do real work, but never overclaim. Bundle "finds and prepares." It isn't a lawyer or a tax adviser, and every claim shows its source.

## Precedents you might not have thought of

- **Estonia's "no application needed" family benefits:** once a birth is registered, parents get a pre-filled offer to confirm, and 84% looked at theirs. **This is the north star:** *"here's what you're owed, tap to confirm."*
- **GetCTC (Code for America):** a simple phone flow that helped about 200,000 households claim roughly **$685M** in child tax credits.
- **MissingMoney.com:** one search across every state's unclaimed-property records. States returned **$4.25B** in a year. That's "one data door across many sources," the Zetaris idea in consumer form.

# Part 5: Ten agent ideas, evolved

The scores are for a solo non-coder with an AI coding assistant and 4 days: **Feasibility** from 1 (hard) to 5 (easy), and **Upside** from 1 to 5.

| # | Idea | Pitch | Feas. | Upside |
|---|---|---|---|---|
| 1 | **Clawback** | Watches what the family already bought and claws money back: price-drop refunds, FSA reimbursement, rebates, plus recall alerts | 3 | 4 |
| 2 | **Childcare Tax Math Duel** | A "dependent-care FSA" advocate and a "tax credit" advocate each build a plan; a plain-math Auditor checks them | 4 | 4 |
| 3 | **The Newsroom** (current plan) | A weekly personal edition of checked offers | 4 | 3–4 |
| 4 | **Fine Print Court** | A Deal Hunter argues for an offer, a Fine Print Lawyer argues against, a Judge rules, and simulated families act as the jury | 4 | 4 |
| 5 | **Kid Cost Forecaster** | Simulates the next 12 months under different scenarios ("back to work in month 4 vs month 7") | 3 | 4 |
| 6 | **Registry Referee** | Coordinates gifts from grandparents so nobody buys duplicates; redirects extras to the Trump Account | 3 | 3 |
| 7 | **Resale Router** | When to sell, hand down or recycle outgrown gear (after a recall check) | 3 | 3 |
| 8 | **Caseworker** | Pre-fills applications (WIC, PFML, Form 4547) and stops before submitting | 2 | 5 |
| 9 | **Recall Guardian** | Registers car seats, watches for recalls | 4 | 3 |
| 10 | **The 30-Day Window** | A birth starts a countdown of deadlines with a dollar amount on each | 4 | 5 |

**Who else is doing this?**
- **Fambot** ($3.5M, September 2026) and **Ohai** ($6M) build AI "chiefs of staff" for families, but they focus on calendars and logistics, not money.
- **Paribus** and **Earny** did price-drop refunds but weren't baby-specific and didn't check FSA eligibility or recalls.
- **GoodBuy Gear** does baby gear resale.
- Nothing found does **money + deadlines + verification** for new parents.

# Part 6: The PM take

How would a sharp consumer product manager, in the spirit of Nikita Bier, shape this?

## Nikita Bier's principles, in one breath

He built tbh (sold to Facebook) and Gas (sold to Discord), then ran product at X. His principles:

- **Show the value within seconds.**
- **Prefill instead of asking:** he noticed requiring a profile photo caused high drop-off.
- **Launch to one tight community** at a time (Gas went one high school, one state at a time).
- **Run fast, repeatable experiments.**

## The recommendation: "The First 100 Days"

**Who it's for (tight):** a working parent in Massachusetts, expecting or within 100 days of a birth, whose job has benefits. They're exhausted, the deadlines are real, and the 2026 rule changes mean their information is stale.

**The 10-second magic (time to value):**
1. Three inputs: **due date (or birth date), ZIP code, employer.**
2. Optional: **"connect your card"** (Plaid's test environment in the demo).
3. One screen comes back, for example: **"Baby Maya: $9,840 found. 4 deadlines. First one in 6 days."** That's the **Bundle Receipt**, the screenshot a parent posts in the group chat.

**What sits underneath (the newsroom, upgraded):**

| Agent | Job | Strong-agent pattern it shows |
|---|---|---|
| **Scout** (reporter) | Reads official pages and offers, fills in the rules table with source links | Tool use |
| **Deal Hunter vs. Fine Print Lawyer** (Fine Print Court) | Argue for and against each offer or benefit; the **Judge** rules; the **Parent Panel** (3 simulated families) can veto | Critique, debate, veto |
| **Fact-Checker** | Re-runs a Zetaris query to confirm every number and deadline before it's stated; sends wrong work back to the Scout (max 2 retries) | Validation, retry, branching |
| **Clawback** (light) | Joins the family's transactions with the FSA-eligible list and recalls: "$312 you can claim back, 1 recalled item" | Private + public join |
| **Planner** | Turns approved items into a dated countdown ("Week 1: add baby to insurance") | Planning over time |
| **Coach** | Turns parent feedback into **"case law"** in H-MEM, with source and confidence; future cases cite it | Shared memory, learning |

**Zetaris's real job:**
- **Family profile and transactions** (Neon) × **program rules and tax rules** (files) × **recalls** (live APIs) × **county childcare prices** (DOL).
- Each agent gets its own **governed view**: the Scout and the Judge never see income.
- **Data-quality rules** block any benefit without a source link and a deadline.
- Remove Zetaris and the app can't answer "what are *you* owed?"

**Meterless's real job:**
- **H-MEM** stores case law and per-family memory, with provenance and confidence.
- **The demo moment:** run 1 approves a "free" offer, parents report shipping charges, the Coach writes a rule, and run 2's Fine Print Court cites that rule and rejects a similar offer. The audit log proves it.

**Why this beats the current plan:**
- It keeps everything already designed (Scout, Fact-Checker, Panel, Coach).
- It changes the front page from a list into **one number and a countdown**.
- It adds the one data move that makes Zetaris shine: **private × public, under governance**.

## How it scores

| Criterion | Points | How "First 100 Days" earns them |
|---|---|---|
| **Impact** | 30 | A specific user, real dollars, real deadlines; timely because of 2026 changes; backed by take-up-gap numbers |
| **Technical** | 20 | Debate, veto, retry, branching, shared memory, governed views, full traces |
| **Innovation** | 15 | Agents argue in public; case law that compounds; private × public join |
| **Demo** | 15 | The Bundle Receipt, a live Fine Print Court ruling, run 1 vs run 2 |
| **Product & UX** | 10 | Three inputs, one number, one countdown; built for phones |
| **Sponsor Tech** | 10 | Zetaris and Meterless are load-bearing, not bolted on |

## A 3½-minute demo storyboard

1. **0:00–0:20, the problem.** "$27K for infant care. $441 lost per FSA holder. 44% of WIC-eligible people aren't enrolled. And the rules changed this year."
2. **0:20–0:50, the magic.** Enter due date, ZIP and employer, connect a test card, and the Bundle Receipt appears.
3. **0:50–1:40, under the hood.** A live trace: the Scout finds a "free car seat" offer → Fine Print Court: the Lawyer finds a $40 shipping subscription → the Judge rules against → the Fact-Checker catches a wrong income limit and sends it back.
4. **1:40–2:20, the private × public join.** "$312 you can claim from your FSA; one recalled item in your Amazon orders." Show that the Judge's view hides income.
5. **2:20–3:00, it learns.** Parent feedback → the Coach writes case law (H-MEM, with confidence) → run 2 cites it. The before/after scoreboard.
6. **3:00–3:30, what's next.** Pre-filled applications (Caseworker), background watching, a success-fee business model.

## Scope guardrails (so it actually ships)

- **Build:** the Receipt, the countdown, Fine Print Court, the Fact-Checker loop, the Coach plus H-MEM, governed views, and Clawback-light on Plaid sandbox data.
- **Label "coming soon":** filling in applications, background watching, Forecaster, Registry Referee, Resale.
- **If time runs short, cut in this order:** Clawback → county childcare comparison → Parent Panel down to 1 family. **Never cut:** Fine Print Court, the Fact-Checker loop, the learning demo, traces.

# Part 7: Risks and open questions

- **Accuracy is the product.** A wrong deadline or dollar amount hurts a real family. Every number needs a source, the Fact-Checker must re-verify, and the UI should say "likely eligible," not "eligible."
- **Plaid into Zetaris:** Plaid needs a sign-in step, so plan to copy its test data into Neon and let Zetaris read it there. Test on day 1.
- **Facts to double-check before the demo:**
  - the Massachusetts infant-care figure
  - the CDCTC income cutoffs
  - Trump Account deposit status
  - whether "income drops during leave" really changes eligibility for specific programs
  - the 30-day insurance window for a given employer plan
- **Scope:** this is still a lot for 4 days. The cut list matters.
- **Positioning:** "finds and prepares." Never "advises" (the DoNotPay lesson).

# Glossary

- **Affiliate:** earning a commission when someone signs up or buys through your link.
- **Agent:** an AI model with a job, tools and a loop.
- **API / endpoint:** a web address that hands back raw data for programs instead of a page for people.
- **Audit ledger:** an append-only record of every change.
- **Catalog:** Zetaris's list of every connected source and what's in it.
- **Confidence score:** how sure the system is about a memory or claim, from 0 to 1.
- **Critique / validation:** one agent checking another's work and able to reject it.
- **Data virtualisation:** querying data where it lives instead of copying it.
- **DCFSA:** dependent-care FSA, pre-tax money for childcare (2026 limit: $7,500).
- **DQ rules:** data-quality checks that flag bad rows.
- **Escalation:** handing a hard case up to a supervisor agent or a human.
- **ETL:** extract, transform, load: copying data into one place.
- **FSA / HSA:** pre-tax accounts for health costs.
- **Governance / view:** rules for who sees what; a view is a filtered window onto data.
- **H-MEM:** Meterless's memory engine.
- **JDBC:** a universal plug for connecting to databases.
- **Join:** combining rows from different tables that share a key, such as a ZIP code.
- **JSONL:** a text file with one data record per line.
- **LLM / model:** the AI brain that reads and writes text.
- **Metadata:** data about data (table names, columns, locations).
- **OAuth:** the "allow this app to access your account" sign-in step.
- **Orchestrator:** the code that decides which agent goes next.
- **Provenance:** where a fact or memory came from.
- **Sandbox:** a test environment with fake data.
- **Semantic layer:** shared definitions of business terms.
- **SQL:** the standard language for asking databases questions.
- **Success fee:** you pay only if the service gets you money.
- **Take-up gap:** eligible people who don't get a benefit.
- **Time tax:** hours lost to paperwork and proving you qualify.
- **Trace:** a step-by-step log of what each agent did.

# Sources

**Part 1: The problem**

- Child cost: [Credit Karma](https://www.creditkarma.com/cash-flow/i/how-much-does-it-cost-to-raise-a-child) · [Good Morning America](https://www.goodmorningamerica.com/family/story/how-much-it-costs-to-raise-a-child-in-the-us-120376717) · [Fox 29 / BabyCenter 2025](https://www.fox29.com/news/heres-what-moms-spending-babies-first-year)
- Childcare: [Child Care Aware 2025](https://info.childcareaware.org/price-and-supply-2025) · [America's Health Rankings (MA)](https://www.americashealthrankings.org/explore/measures/Infant_Child_Care/MA) · [NBC Boston](https://nbcboston.com/news/local/2-mass-counties-rank-among-the-most-expensive-for-infant-care/2959511) · [DOL Nov 2024](https://www.dol.gov/newsroom/releases/wb/wb20241119)
- Take-up: [CBPP WIC, Mar 2026](https://www.cbpp.org/sites/default/files/3-26-26fa.pdf) · [IRS EITC TY2021](https://irs.gov/pub/irs-soi/24rpeitcunderclaimsty2021census.pdf) · [Retail Dive / EBRI FSA](https://www.retaildive.com/news/fsa-hsa-healthcare-shopper-awareness-beauty-retail-wellness/745339/) · [Safe Kids car seats](https://www.safekids.org/node/8977)
- Tariffs: [NBC News](https://www.nbcnews.com/business/consumer/prices-common-baby-items-are-rising-due-trumps-tariffs-congressional-a-rcna212753) · [Babylist](https://www.babylist.com/hello-baby/baby-products-tariffs-registry)
- Time tax: [KPBS/NPR, Aug 31 2026](https://www.kpbs.org/news/national/2026/08/31/paperwork-lines-hours-on-hold-theres-a-time-tax-on-americans-who-need-help-most) · [Yale Budget Lab](https://budgetlab.yale.edu/research/how-would-tcja-reforms-affect-time-burden-filing-taxes)
- 2026 changes: [WCAX, Trump Accounts](https://www.wcax.com/2026/08/03/how-trump-accounts-work-who-qualifies-1000-federal-deposit/) · [HWH Law, DCFSA $7,500](https://www.hwhlaw.com/advisory-dependent-care-fsa-limit-increased-to-7-500-for-2026) · [Axios, Trump Accounts](https://www.axios.com/2026/01/02/trump-accounts-signup-big-beautiful-bill) · [Doeren, 2026 IRS adjustments](https://www.doeren.com/viewpoint/irs-releases-2026-cost-of-living-adjustments-includes-amendments-from-obbba) · [Poppins Payroll](https://www.poppinspayroll.com/blog/2025-childcare-tax-savings-ctc-cdctc-dependent-care-fsa) · [NCSL state CTCs](https://www.ncsl.org/human-services/child-tax-credit-overview/maptype/tile) · [Kiplinger](https://www.kiplinger.com/taxes/states-that-offer-a-child-tax-credit) · [Seyfarth, MA PFML 2026](https://www.seyfarth.com/news-insights/2026-massachusetts-paid-family-and-medical-leave-updates-benefit-amount-contribution-rates-and-taxability-of-benefit-payments.html)

**Part 2: The tech**

- Zetaris and Meterless: your hackathon folder (setup/zetaris-getting-started/, setup/zetaris-walkthrough.md, setup/meterless-engines/) · [Zetaris getting-started repo](https://github.com/zetaris/getting-started) · [Meterless repo](https://github.com/Meterless/Meterless)

**Part 3: Data sources**

- [Plaid Sandbox test credentials](https://www.plaid.com/docs/sandbox/test-credentials/) · [Plaid Sandbox Studio](https://plaid.com/docs/sandbox/studio/) · [Plaid trial plan](https://support.plaid.com/hc/en-us/articles/16110110883479)
- [CPSC recalls API](https://www.cpsc.gov/node/5808) · [openFDA food enforcement](https://open.fda.gov/apis/food/enforcement) · [NHTSA recalls on data.gov](https://catalog.data.gov/dataset/nhtsas-office-of-defects-investigation-odi-recalls-nhtsa-api) · [DOL childcare prices](https://www.dol.gov/agencies/wb/topics/featured-childcare)
- [Amazon PA-API deprecation](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/paapiv5-deprecation) · [Keepa plans](https://keepa.com/api-docs/plans-tokens.html) · [Reddit API 2026](https://www.socialcrawl.dev/blog/reddit-data-api-2026) · [Open Referral HSDS](https://openreferral.readthedocs.io/en/v3.0/)

**Part 4: Inspiration**

- The Points Guy: [valuations](https://thepointsguy.com/news/monthly-valuations) · [advertising policy](https://thepointsguy.com/legal/advertising-policy) · [app launch](https://creditcards.com/news/the-points-guy-app-launch)
- Military: [Military OneSource app](https://www.army.mil/article/240721/app_for_military_resources_available_to_service_members_families) · [GovX ID](https://apps.shopify.com/govx-id) · [ID.me (Sacra)](https://sacra.com/research/id-me)
- Shopping: [Honey suit dismissed](https://news.bloomberglaw.com/litigation/paypals-honey-sheds-influencers-affiliate-link-hijacking-suit) · [Rocket Money fees](https://help.rocketmoney.com/en/articles/9744474-bill-negotiation-charge) · [Paribus acquisition](https://techcrunch.com/2016/10/06/capital-one-acquires-online-price-tracker-paribus/)
- Benefits and parents: [Propel (NPR)](https://www.npr.org/2025/11/04/nx-s1-5587728/snap-shutdown-propel-tech-startup-cash-donations) · [Babylist 2025 revenue](https://norfolkdailynews.com/online_features/press_releases/babylist-tops-750-million-in-revenue-in-2025-increasing-45-as-it-expands-ecosystem-for/article_026df4cc-0b39-5284-b0c4-f87a1ae5b2d3.html) · [Babylist completion discount](https://help.babylist.com/hc/en-us/articles/115006102688)
- Finance: [Intuit FY2025 report](https://www.sec.gov/Archives/edgar/data/896878/000089687825000061/intu014766-ars.pdf) · [NerdWallet 2025 results](https://www.businesswire.com/news/home/20260225448516/en/)
- Agents: [Pine Series A](https://fintech.global/2025/12/03/pine-launches-ai-agent-as-it-secures-25m-series-a/) · [FTC on DoNotPay](https://www.ftc.gov/node/87474) · [Fambot](https://techcrunch.com/2026/09/01/fambot-introduces-an-ai-chief-of-staff-for-families/)
- Precedents: [Estonia proactive benefits](https://news.err.ee/991789/parents-no-longer-have-to-apply-for-family-benefits) · [GetCTC](https://codeforamerica.org/programs/tax-benefits/child-tax-credit/) · [NAUPA unclaimed property FY25](https://unclaimed.org/wp-content/uploads/NAUPA-FY-25-Report.pdf)

**Part 6: The PM take**

- Nikita Bier: [Lenny's Newsletter](https://www.lennysnewsletter.com/p/how-to-consistently-go-viral-nikita-bier) · [X post on profile photos](https://x.com/nikitabier/status/1867270647912788365) · [The Hustle on Gas](https://thehustle.co/10-18-22-gas-app) · [Engadget](https://www.engadget.com/2231302/x-head-of-product-nikita-bier-leaving-the-company-one-year-after-joining/)

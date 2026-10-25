# Round 4 audit (Sat Oct 24, 2026)

Read-only check, done for Lyndsay's round-4 questions (`progress/tracking/TRACKING-oct24-round4.md`). No other files were changed and nothing was committed. Every claim has a file and line number. Code paths are relative to `bundle/`.

A few words used below:
- **Neon**: our online database, where families, purchases, rules and offers are stored.
- **Zetaris**: the required "data door". The app asks it one question in SQL (a database language), and it fetches the answer from Neon and from the live government recall feeds.
- **Read**: the app looks data up. **Write**: the app saves new data.
- **Drizzle**: the code library the app uses to talk to Neon *directly*, without going through Zetaris.
- **View**: a saved query that shows only some columns of a table, so each helper sees only what it needs.

---

## A. Does everything in Neon go through Zetaris?

**Short answer: every search and every join the agents make goes through Zetaris. There are four exceptions where the app reads Neon directly, plus some writes. Two of those reads are agent inputs that arguably should go through Zetaris (the family profile and the Coach's feedback). The other two are app housekeeping.**

### What does go through Zetaris (confirmed)
Every agent query uses `ctx.z.runQuery(...)`, which calls Zetaris (`server/adapters/zetaris.ts`):
- Benefits Planner: `bundle_pg.benefit_rules`, `v_planner_family`, `poverty_guidelines` (`server/agents/benefits.ts:21-39, 113, 128`).
- Clawback Hunter: `v_clawback_tx` joined with `fsa_eligible_categories`, `store_policies`, `price_observations` (`server/agents/clawback.ts:16-50, 61, 86, 132`).
- Recall Checker: `v_recall_orders` + `v_clawback_tx` joined with the live `bundle_live.cpsc_recalls` and `bundle_live.fda_food_recalls` (`server/agents/recall.ts:30-65, 143, 151`). This is the one cross-source join (Neon plus the live feeds in one question).
- Fine Print Court: `v_judge_offers` (`server/agents/finePrintCourt.ts:164-165, 191-192`).
- Fact-Checker: `benefit_rules`, `v_judge_offers`, live recall tables, `v_clawback_tx` (`server/agents/factChecker.ts:76-178`).
- Orchestrator's item count: `itemsSql` through Zetaris (`server/agents/orchestrator.ts:172`).
- Registration: `scripts/zetaris/register.ts:86-102` connects Neon as `bundle_pg`, registers all 13 tables (list at `shared/schema.ts:133-137`), creates 5 views (`register.ts:31-49`) and the two live recall tables.

### Places that read or write Neon directly (not through Zetaris)

| # | Where | Read or write | What | Should it go through Zetaris? |
|---|---|---|---|---|
| 1 | `server/agents/orchestrator.ts:48-55` (`defaultLoadFamily`), used by `server/bundleDeps.ts:43` | **Read** (live mode only; sample mode reads a file) | Loads the sample family's profile (birth/due date, state, `dcfsaOffered`, which means "does the job offer a Dependent Care FSA") straight from the Neon `families` table. All agents then use it: e.g. `clawback.ts:129` and `factChecker.ts:168` decide on the Dependent Care FSA from it. | **Yes, arguably.** It is agent input from Neon that skips Zetaris. A view for it already exists (`v_planner_family`), but only the Benefits Planner uses it (`benefits.ts:29-32`). Small fix. |
| 2 | `server/bundleStore.ts:76-79` (`listRecentIssues`), called by `server/routes/bundleRoutes.ts:178` | **Read** | The **Coach** (the agent that suggests new rules from parent complaints) reads the parents' "issue" reports straight from the Neon `feedback` table. `plans/architecture.md:129` admits this: "via the app store, not Zetaris". | **Yes, arguably.** It is an agent reading Neon data. `feedback` is already registered in Zetaris (`schema.ts:135`), so it could be a Zetaris query. |
| 3 | `server/bundleStore.ts:80-103` (`saveProposals`, `listProposals`, `getProposal`, `markApproved`); routes `bundleRoutes.ts:176, 201, 216, 220` | Mostly writes, plus reads for the case-law screen and to check for duplicates | Coach's suggested rules ("case law") and the reviewer's Approve. | **Fine as is.** This is the app's own record-keeping, not agent research. |
| 4 | `server/bundleStore.ts:66-70` (`zipState`), route `bundleRoutes.ts:82` | **Read** | Looks up the state from a ZIP code when a parent types in their details. | **Fine (housekeeping).** It runs before any agent starts. Could move to Zetaris if we want the claim to be 100% true. |
| 5 | `server/bundleStore.ts:71-74` (`addFeedback`), route `bundleRoutes.ts:173` | **Write** | Saves "I got this" / "Report issue" taps. | **Fine.** It is a write. Zetaris is a door for looking things up. |
| 6 | `scripts/seed.ts:132-161` | **Write** | Loads the made-up families, Plaid-style card rows, Amazon orders, rules, offers, etc. into Neon. | **Fine.** One-time setup script. |
| 7 | `scripts/scout.ts:120-131` (`upsertScoutRows`) | **Write**, plus a small duplicate-check read (`:128`) | Scout saves new rules and offers it found on web pages. Scout never queries Zetaris on purpose (`scout.ts:58`). | **Fine.** It is a write path. |
| 8 | `scripts/eval.ts:7, 290` (`--neon` option) | Write | Saves test feedback when asked. | Fine (test script). |
| — | Meterless memory (`server/adapters/memory.ts:1-20`) | — | Stored in local files (`data/hmem`), **not in Neon** | Not a Neon question. |

**A gap in the documents:** `plans/architecture.md:83` says "Every agent and the Fact-Checker read only through it [Zetaris]." That is true for agent *searches*, but not for the family profile (#1) or the Coach's feedback (#2). `plans/architecture.md:129` already admits #2. `plans/flow-chart.md:55-58` draws "Orchestrator: loads the family" next to the Zetaris arrow, but in live mode it loads the family directly (#1).

**Related point about privacy:** all 13 raw tables are registered in Zetaris, including `families` with income (`register.ts:89-91`). So the per-helper views are a habit we follow, not a lock that Zetaris enforces (`plans/architecture.md:361`).

### Planned new tables: which ones the plan says go into Zetaris
| Table | Registered in Zetaris? | Where it says so |
|---|---|---|
| `receipt_items` (one row per product from a receipt) | **Yes**, and agents read it only through the safe-columns view `v_purchase_items`, which shows only harmless columns. It is added to `v_recall_orders` | `bundle-plan-v3.md:10, 80, 85, 177` |
| `offer_checks` (the agents' grades of each offer) | **Yes**, "registered in Zetaris as its own source" | `bundle-plan-v3.md:84, 150, 196`; `progress/tracking/TRACKING-oct24-plan-update.md:19` |
| `tax_parameters` (IRS 2026 figures) | **Yes**: "Register both in Zetaris" | `bundle-plan-v3.md:134` |
| `state_programs` (MA/NY/CA paid leave) | **Yes**, same line | `bundle-plan-v3.md:134` |
| New views `v_purchase_items`, `v_offer_audit` | Zetaris views | `bundle-plan-v3.md:85, 148` |
| "Neon results table" (saved run results) | **Not stated.** It holds screen results, not agent inputs | `bundle-plan-v3.md:100, 254` |

Documents that are behind: `plans/architecture.md` mentions only `offer_checks` as planned (`:49, 95, 160, 170`). It does not mention `receipt_items`, `tax_parameters` or `state_programs`. Its `offer_checks` field list (`:160`) is also an older, shorter version than `bundle-plan-v3.md:145`. The exec summary (`bundle-plan-executive-summary.md:31`) and the flow chart (`plans/flow-chart.md:61-63`) list all four tables.

---

## B. FDA recalls: what is being dropped?

**Your reading is correct. Only finished ("Terminated") FDA recalls are filtered out. The openFDA feed (the FDA's public list of recalls) stays in. No plan version drops openFDA as a whole.**

Quotes:
- Round 1: "finished ("Terminated") FDA recalls are filtered out, a test proves wrong recalls don't show" (`plans/old-versions/bundle-plan-v3-2026-10-24-round1.md:9`). Round 1 also made it "never cut" (`:123`).
- Round 2: same wording (`plans/old-versions/bundle-plan-v3-2026-10-24-round2.md:14`). Must-do: "drop FDA recalls marked "Terminated" (finished)" (`:126`). The recall row uses "live CPSC and openFDA recall feeds (finished FDA recalls dropped)" (`:61`).
- Current v3: "finished ("Terminated") FDA recalls are filtered out" (`bundle-plan-v3.md:31`). "live CPSC and openFDA recall feeds (finished FDA recalls dropped)" (`:80`). "CPSC and openFDA are live outside feeds" (`:89`). 6a: "drop FDA recalls marked "Terminated" (finished)" (`:154`).
- Before the update: "live CPSC and FDA recall feeds" with no filter (`plans/old-versions/bundle-plan-v3-2026-10-24-before-update.md:39`).

**Why:** "The FDA feed returns `status` values "Ongoing" and "Terminated". 42 formula recalls come back, some from 2020, and the app doesn't filter by status. A parent could get a scary card about a recall that ended years ago." (`research/research-matching-and-agent-api.md:57`; the rule is at `:110, :129`). The matching test also shows a real wrong alarm this prevents: "a2 Platinum formula: rejected because "FDA status is Terminated"" (`research/entity-resolution-test.md:139`, test case `no_terminated_fda` at `:204`). The filter is not built yet (`plans/architecture.md:168, 260`; `progress/reviews/regrade-2026-10-24.md:81`).

---

## C. `offer_checks` dataset and the brand-audit read-only web address

**What was decided:**
- `progress/tracking/TRACKING-oct24-plan-update.md:19`: "Build the "agents' scorecard" table (`offer_checks`) in Neon and register it in Zetaris as its own source."
- `:21`: "Brand audit (Strategy 3): only the data, in an agent-friendly read-only format."
- Round 2, `:30`: "Brand audit: a Zetaris view plus a read-only endpoint with an OpenAPI description. MCP later." (An **endpoint** is a web address a program can call. An **OpenAPI description** is a standard file that tells any program how to call it. **MCP** is the standard plug-in format for AI agents.)
- `:32`: effort and details become part of `offer_checks`.

The decision has no "should-do" or "if time" condition on the endpoint.

**What the current plan says:**
| Piece | Status in `bundle-plan-v3.md` | Timeline |
|---|---|---|
| `offer_checks` table + fields, registered in Zetaris | **Must-do** (`:98, :141, :145`) | Saturday (`:196`) |
| 12 fine-print tests, Value Score, `v_offer_audit` view | **Must-do** (`:98, :141, :148, :150`) | Sunday (`:197`) |
| AI "soft" fields in `offer_checks` (summary, effort level) | Must-do, but **7th in the cut order** (`:203`) | — |
| **Read-only endpoint + OpenAPI** (`GET /api/offer-audit`) | **Should-do** (`:141, :148`). 4th of 5 in the should-do list (`:100`). **1st in the cut order** (`:203`) | **Not scheduled.** Only "should-dos only if green" on Monday (`:198`) |
| Brand audit + open recalls per brand (second join) | Should-do (`:87, :148`), 4th in the cut order (`:203`) | — |
| MCP server | Cut; pitch slide only (`:102, :148`) | — |

**Flags (the endpoint was demoted):**
1. **The demotion started in round 2, not round 3.** Lyndsay's round-2 decision has no condition. The round-2 plan still made the endpoint a should-do, though "first in line" (`plan-history/...round2.md:78, :121`) and first to cut (`:158`).
2. **Round 3 demoted it again.** It dropped from 1st to 4th in the should-do list, behind the daycare card, the second join and the Neon results table (`bundle-plan-v3.md:100`). It is still first to cut (`:203`). The exec summary repeats "Should-do" (`bundle-plan-executive-summary.md:41`).
3. `offer_checks` itself is still must-do and scheduled, which matches the decision. Only the AI soft fields can be cut.
4. `plans/architecture.md:368-372` already describes how the endpoint must be protected, so it is designed, just not scheduled.

---

## D. Every Plaid / bank / card and work-benefits mention

(**Plaid** is the service apps use to read bank and card purchases. **Dependent Care FSA** is a work account that pays for daycare before tax. **`dcfsaOffered`** is the yes/no field "does the job offer one".)

**Background:** the only recorded Plaid decision in the files is round 2's "KEEP Plaid" (`progress/tracking/TRACKING-oct24-plan-update.md:28`). Round 1 had cut it (`plan-history/...round1.md:8`). Lyndsay's round-4 note says she decided against it (`progress/tracking/TRACKING-oct24-round4.md:14`), so that decision was probably made in chat and is not written down anywhere. Work question: `design/onboarding/gap-answers.md:5` records **"Work question: dropped"** as Lyndsay's Oct 24 decision. The current plan still builds it.

### bundle-plan-v3.md
| Line | Note |
|---|---|
| 10 | Under "Decided by Lyndsay": "Plaid stays for store-level jobs." The Plaid part may not be her decision. |
| 14 | Recommendation 3: Plaid card rows out of recall matching |
| 27 | Round-2 record: "Plaid 'Connect a card' is back in" |
| 28 | Benefits Planner uses "work benefits" |
| 31 | "bank lines carry no product names" (matching finding) |
| 41 | "purchases from forwarded receipts **and a connected card**" |
| 48 | "Connect a card" (Plaid practice banks) tells it *where* you shop |
| 57 | Sunday timeline: "Plaid" |
| 67 | Parent/owner table: "Connect a card" + "which card lines came from Plaid" + receipt-to-card links |
| 80 | Recall row: "Plaid card rows are no longer included" |
| 81 | **Clawback Hunter runs on "Plaid card lines"** (money back, Dependent Care FSA daycare bills) |
| 82 | Benefits Planner uses "the parent's work-benefits answer" |
| 89 | Honest note: Plaid data copied into Neon |
| 98 | Must-do list: "6a ... Plaid rows out", "3 Plaid 'Connect a card'" |
| 123-130 | Whole item 3, "Plaid 'Connect a card'" (must-do, half a day), including the Bright Horizons daycare line meant to produce the FSA card (127) and the receipt-to-card link (128) |
| 137 | "Work benefits: the onboarding answer replaces today's always-'yes' FSA setting" |
| 154 | 6a: "stop feeding Plaid card rows into recall matching" |
| 165 | Onboarding **screen 4 "optional work benefits Yes / No / Not sure / Skip"** (must-do), plus "Connect a card" on the results page |
| 181 | Daycare invoice is "more reliable than Plaid's wrong label" |
| 192 | Time check: "Plaid ... about half a day" |
| 196, 197 | Timeline: Sat "Plaid rows out"; Sun "Item 3 Plaid (half day)", "Plaid rows in Neon" |
| 203 | Cut order: "Never cut: ... Plaid 'Connect a card'", and "Plaid vs sample receipts" is the next hardest call |
| 212 | "Plaid is sandbox only, demo families only" |
| 224 | Keys table: Plaid sandbox, "feature back in" |
| 236 | Decision 8.2: Dependent Care FSA by work answer; drop the employer box |
| 246 | Open decision 1: Plaid rows out of recall matching |
| 253 | Open decision 8: "raising Plaid vs. sample receipts" |
| 259 | Open decision 14: FSA display by work-benefits answer |

### bundle-plan-executive-summary.md
| Line | Note |
|---|---|
| 7 | "government **and work benefits**" |
| 15 | Onboarding: "optional 'Does your job offer benefits?'" |
| 16 | "Connect a card" uses Plaid |
| 18 | Clawback: "daycare bills for the work daycare account (Dependent Care FSA)". These come from card rows. |
| 31 | Neon: "`transactions` (Plaid rows)" |
| 40 | "card rows from Plaid stay out of recall matching" |
| 49 | Sunday timeline: "Plaid" |
| 54 | "Plaid runs in practice mode only" |
| 60 | Decide-now: "Plaid rows out of recall matching"; "how the daycare account card shows" |

### plans/flow-chart.md
| Line | Note |
|---|---|
| 13-18 | Input box "B. Bank link: Plaid practice bank"; box A includes "work benefits" |
| 37 | Guardrail: "Bank lines used for money-back jobs only; kept OUT of recall matching (planned)" |
| 46 | "Plaid practice bank only" |
| 59-60 | Clawback "(FSA, price drops, daycare)". The data comes from card rows. |
| 144 | Glossary: Plaid |
| 150 | Note [2]: Plaid practice bank adds store-level purchases |

### plans/onboarding-spec.md
| Line | Note |
|---|---|
| 14 | Glossary: Dependent Care FSA, "a work benefit" |
| 21 | Flow ends with "optional work-benefits question"; "no bank details" |
| 40 | "We never ask for bank details to get started" |
| 60-63 | **Section 4: work benefits screen** ("Does your job, or your partner's, offer benefits?"), mapped to `dcfsaOffered` |
| 111 | Screen 8: "Connect a card" (Coming soon) |
| 133 | Insurance tab: paid leave "Check with your job" |
| 142 | Today: optional employer box, "Connect a card" link |
| 147 | New: work benefits Yes/No/Not sure |
| 157 | Employer name changed to a yes/no/not sure question |
| 160 | Connect a card moved off the first screen |
| 173 | **The work answer should drive `dcfsaOffered`**, which 3 agents read |
| 189 | Connect a card stays "Coming soon" |
| 201-202 | Open questions 4-5: work answer mapping; employer name |
| 208 | Card connection stays demo |

### design/onboarding/gap-answers.md
| Line | Note |
|---|---|
| 5 | **Lyndsay's decision: "Work question: dropped." The Dependent Care FSA becomes a "Check with your job" card for every family, with no dollar amount and not in the total. The employer box is removed.** |
| 39-42 | Today: `dcfsaOffered: true` hard-coded; "Your employer offers" wording; employer box unused |
| 44-56 | Older yes/no/unknown recommendation (replaced by line 5) |
| 64-65 | Files to change: `factChecker.ts:168`, `clawback.ts:129,147`, `fallback.ts:33`, etc. |

### plans/architecture.md
| Line | Note |
|---|---|
| 149 | `transactions` = "Card-style purchases (Plaid-shaped fixture)" |
| 171 | "Store price feeds, **Plaid live: Cut on Oct 24**". This is the round-1 state and conflicts with the v3 plan. |
| 211 | Today's onboarding has an "optional employer" box |
| 220 | Screen 4 work benefits drives `dcfsaOffered` |
| 225 | "Cut for the hackathon: ... Connect a card" |
| 295-296 | Input checks: employer max 100 characters |

### What DEPENDS on them (flagged only; nothing decided here)
1. **The Dependent Care FSA card depends on the work answer.** In code, `dcfsaOffered` decides it: `benefits.ts:85` (skip if not offered), `benefits.ts:63` and `clawback.ts:147` ("Your employer offers..." wording), `clawback.ts:129`, `factChecker.ts:168`, `fallback.ts:33`. Today it is hard-coded to `true` for typed-in families (`server/routes/bundleRoutes.ts:97`), and the employer box is collected but unused (`:92`). If the work question is cut, the card needs a new rule. `gap-answers.md:5` already gives one: "Check with your job" for everyone, with no dollars. `bundle-plan-v3.md:236, 259` still recommends yes/no/not-sure logic.
2. **The Clawback Hunter's money back depends on card rows (Plaid-shaped).** All three of its queries read only `v_clawback_tx`, which is the `transactions` table (`clawback.ts:16-50`; view at `register.ts:39-40`): FSA-eligible buys, price drops and daycare bills. The plan says the same (`bundle-plan-v3.md:81`). The sample families' card rows come from a Plaid-shaped fake file loaded by `scripts/seed.ts:150` (`server/ingest/plaid.ts:37`). Removing Plaid as a feature does not have to remove these sample rows, but the "money back" and daycare cards need *some* purchase source. Receipts could fill it: the daycare invoice (`bundle-plan-v3.md:181`) and receipt items for price drops (`:81`).
3. **The Dependent Care FSA daycare demo was planned on Plaid data**: the "BRIGHT HORIZONS TUITION ACH" line (`bundle-plan-v3.md:127`).
4. **The "proven purchase" receipt-to-card link** (`bundle-plan-v3.md:67, 128`) only exists with card rows.
5. **The recall matcher reads card rows today.** `recall.ts:38` adds card rows (`source 'card'`), and `v_recall_orders` includes `transactions` (`register.ts:42-44`). "Plaid rows out" (recommendation 3) and "drop Plaid" both need this code changed.
6. The cut order's "Plaid vs sample receipts" fallback (`:203, :253`) and the Sunday half-day for Plaid (`:197`) would free up time if Plaid goes.

---

## E. Recommendations written in as if accepted (round 3)

`bundle-plan-v3.md:7` says it openly: "Items marked **Recommended, awaiting Lyndsay's OK** are written into the plan as if accepted, so the plan hangs together." Below is every such item, compared with round 2 (`plans/old-versions/bundle-plan-v3-2026-10-24-round2.md`, shortened to "R2").

| # | Item | Where it is baked into v3 | Round 2 (R2) said | What changed |
|---|---|---|---|---|
| 1 | **Plaid rows out of recall matching** | `:14`, recall row `:80`, must-do list `:98`, Plaid "done when" `:129`, 6a `:154`, Sat timeline `:196`; open decision `:246` | Only "recommend adding" it (R2 `:133`). Not in the must-do list (R2 `:77`). R2 recall row still *included* Plaid (R2 `:61`) | A suggestion became a must-do and a pass/fail check |
| 2 | **Matcher upgrade promoted to must-do** | `:15, :98, :156`; "Never cut" `:203`; Sun timeline `:197`; open decision `:247` | **Should-do** (R2 `:78, :128, :133`), 3rd in the cut order (R2 `:158`) | Should-do became must-do and never-cut, **with no hour estimate** (`:156, :192`) |
| 3 | New honest line for judges | `:16, :91`, evidence `:171`; open decision `:248` | "the AI decides the hard cases" (R2 `:70`) | Wording replaced everywhere (README, deck, video) |
| 4 | "Four joins" changed to "one cross-source join" | `:17, :76`; should-do second join `:87`; open decision `:249` | "After round 2 it does four joins" (R2 `:57`) | Corrected claim (a factual fix), plus a new should-do |
| 5 | **Parent taps feed Meterless memory** | `:18, :53, :70`, must-do list `:98`, item 10 `:186-188`, Mon timeline `:198`; open decision `:250` | Not present (R2 `:51` only had "I got this"/"Report issue") | New must-do, 1-2 h |
| 6 | **New cut order and "never cut" list** | `:203`; time check `:192`; open decision `:253` | Cut order R2 `:158` (endpoint, onboarding extras, matcher, AI soft fields, trim onboarding) | Matcher moved from cuttable to never-cut. Sample receipts became never-cut. Neon results table, second join, daycare card and live inbox were added to the cut order. "Plaid vs receipts" fallback added |
| 7 | **Live Agentmail inbox cut first** | `:99`, item 9 `:180`, cut order `:203`, Mon "if green" `:198`; open decision `:252` | Receipts didn't exist in R2 | Lyndsay decided "a forwarding address ... plus" sample receipts (`:10`). The plan now marks the forwarding address as first to cut and only "if green" on Monday |
| 8 | **Neon results table placement** | Should-do list `:100`, cut order 3rd `:203`; open decision `:254` | Not present | Placed as a should-do although its source (`plans/plan-grade-future-state.md` §5) wanted must-do |
| 9 | Nemotron 3 Super for the Judge | Only at `:255` ("can wait") | Not present | Not baked in, just recommended |
| 10 | **Local-only / no hosted live AI** | Cut list "a hosted site that runs live AI" `:102`; `:117, :209`; also under "Decided" `:11, :244`; open decision `:256` ("can wait") | "Paid hosting: none. Test locally only" (R2 `:164`) | Listed as "can wait" (`:256`) but already in the Cut list (`:102`). "Any hosted copy replays saved traces" is labelled as Lyndsay's decision (`:11`), but `progress/tracking/TRACKING-oct24-round3.md:7` shows she only asked how to wire Nightshift in |
| 11 | Year-one value table | Only `:257` ("can wait") | Not present | Not baked in |
| 12 | "Cash" wording | Only `:238, :260` (recommendation) | Same recommendation (R2 `:191`) | Not baked in; unchanged |
| 13 | **Single list vs tabs** | "Cut: ... tabbed layout" `:102`; `:240, :261` ("can wait") | Already "Cut: ... tabbed layout" (R2 `:80`) | Baked in since R2. **It conflicts with Lyndsay's recorded decision "Navigation: bottom tabs"** (`design/onboarding/gap-answers.md:7`) and her round-4 "version B (bottom navigation)" (`progress/tracking/TRACKING-oct24-round4.md:9`). `plans/architecture.md:225` also lists tabs as cut |
| 14 | **Location pre-fill** | "Cut: ... location pre-fill" `:102`; `:241, :262` ("can wait") | Already cut (R2 `:80`) | Listed as "can wait" but already cut since R2 |
| 15 | **FSA card logic / work question** | Screen 4 work benefits must-do `:165`; `:82, :137`; decisions `:236, :259` | Same (R2 `:63, :110, :137, :189`) | **It conflicts with Lyndsay's recorded "Work question: dropped"** (`gap-answers.md:5`), which was committed before round 3 (commit 3ebff9a), and with her round-4 note (`progress/tracking/TRACKING-oct24-round4.md:8`) |
| 16 | Accounts / sign-in | "Guest only: no sign-in" `:208`; Cut "save/reminders screen" `:102` | Same (R2 `:80, :163`) | **It conflicts with Lyndsay's recorded "Accounts: Better Auth on our Neon database, Google only"** (`gap-answers.md:6`). Better Auth is a free sign-in code library |
| 17 | State-not-covered wording | "We don't have [State] programs yet" `:136, :237` | Same (R2 `:109, :190`) | Lyndsay's wording is "Support for your state's programs is coming soon" (`gap-answers.md:4`) |
| 18 | Items labelled "Decided by Lyndsay" that look like recommendations | `:10` "Plaid stays for store-level jobs"; "Should-do: daycare invoices"; `:11` the exact fallback order, `LIVE_MODEL`, Mac-only live runs, Monday 9am go/no-go; repeated as "Already decided" in `:244` | — | `progress/tracking/TRACKING-oct24-round3.md:5-10` records only her asks ("use email receipts", "work out how to wire Nightshift + NVIDIA"). The details come from the research files. Worth confirming with her |
| 19 | Honest time check accepted | `:20, :192` | Not present | Framed as a fact. Acceptance is open decision `:253` |
| 20 | FDA "Terminated" filter, brand-audit endpoint as should-do | `:154`; `:100, :203` | Same (R2 `:126`; `:78, :158`) | See B and C. The endpoint demotion goes against the round-2 decision |

**Bottom line for E:** five round-3 suggestions are now must-dos or pass/fail checks: #1, #2, #5, #6 and #7. Three "can wait" items are already listed as cut: hosting (#10), tabs (#13) and location pre-fill (#14). The plan also goes against three of Lyndsay's recorded onboarding decisions in `gap-answers.md` (#13 tabs, #15 work question, #16 accounts), and against her round-2 decision on the endpoint (#20).

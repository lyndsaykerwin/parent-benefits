# Bundle "First 100 Days": executive summary (v2, Oct 23, 2026)

**One line:** Bundle connects a new family's real spending (bank card and Amazon orders) to public rules, prices and recall lists, then shows them money they can claw back, recalls to act on, discounts worth taking, and benefits with deadlines. A team of AI agents argues over and checks every claim before a parent sees it.

**For:** a working parent, expecting or within 100 days of a birth, who has employer benefits. Demo state: Massachusetts. Federal items work everywhere.

**Engineer plan:** [docs/superpowers/plans/2026-10-23-bundle-mvp.md](docs/superpowers/plans/2026-10-23-bundle-mvp.md). It matches this summary section by section; the QC table at the end maps each part to its tasks.

---

## Decisions locked Oct 23 (after the panel review)

Accepted, because they don't cost points:
- **Guest only:** no sign-in for the hackathon. Firebase sign-in moves to after the hackathon. That means using the template's current version and removing its Replit sign-in. *(Replaces exec §1 accounts, plan Task 1 Firebase steps, and Task 10 roles; the admin approve button becomes a demo "Reviewer mode" switch.)*
- **Plaid-format fake transactions loaded directly; no live Plaid connect.** Live Plaid becomes a coming-soon tile, and the README says so plainly. *(Plan Task 11: keep `mapPlaidTxn` and fixtures; drop the link-token and exchange routes.)*
- **Amazon upload is a bonus**, built only if everything else works by Sunday night.
- **The court judges at most 5 offers per run.** The scoreboard uses the stand-in AI, plus one saved scoreboard run with the real AI. Set an NVIDIA spending alert.
- **Pick the host today** (CTO call: Render paid starter vs. Replit). Record the video and slides **Monday**.
- **Split the Receipt:** "$X money back" (clawback only) and "$Y in benefits you likely qualify for."
- **Maya first:** pin the insurance-deadline card to the top of her feed, and build the video around her.

Kept (cutting them would cost points):
- **A mini-Scout** reads 3 saved pages (Trump Account, MA PFML, one store offer); the rest is hand-written with sources.
- **The learning demo uses the real AI** (no rigged run 1). The trap offer is genuinely tricky ("free," then auto-renews into a paid membership after 30 days). Real run 1 and run 2 traces are saved Sunday as a backup.

Also kept from the panel (cheap insurance that protects points):
- **Keep at least one real join inside Zetaris, even on Plan B:** family purchases × live recall list. (Zetaris is pass/fail.)
- **CPSC backup:** if the live recall data comes back nested or unreadable, use a saved, flattened copy as the fallback, and say so in `data/README.md`.
- **Speed:** batch Zetaris queries, cache results within a run, and show live agent progress while it runs (target: first card visible in under 30s).
- **Always-on hosting:** paid starter tier or a keep-awake ping, so a judge's first click never hits a sleeping server.
- **Ask HackOS #help today** what `metadata.json` must contain.
- **NVIDIA spending alert** on the account.
- **Pitch framing:** the feed is useful with no bank connected (never-empty); connecting data is the upgrade. This answers "would parents really link a bank?"
- **Timeline:** Fri setup + Zetaris decision · Sat agents + feed · Sun learning + scoreboard + saved runs · **Mon polish + video + slides** · Tue clean-setup test, repo public, submit by 5pm Boston.

---

## 1. What a parent experiences (low friction)

1. **Three inputs:** due date or birth date, ZIP code, employer. Or tap **"Try as guest,"** which opens one of 3 ready-made fake families. Judges never have to sign up.
2. **Optional "bring your data":** connect a card through **Plaid** (a test environment with fake transactions in the demo), and/or upload an **Amazon order history file** (the CSV Amazon lets customers download).
3. **The Bundle Receipt** (the headline): *"$X found · N deadlines (next in D days) · M items safety-checked."*
4. **The feed:** cards of five kinds, each with "how we checked" and the sources behind it:

| Card | What it says | Built or informational? |
|---|---|---|
| **Clawback** | "You paid $64 for FSA-eligible items with a regular card: claim it back." "Target dropped the price $18 within its price-adjustment window." "Your daycare payments qualify for your dependent-care FSA." | **Built** (the hero) |
| **Recall** | "The stroller in your Amazon orders was recalled on [date]." If nothing matches: "We checked 23 items: all clear." No purchases yet: "Connect your data to safety-check your items." | **Built** |
| **Discount** | Offers matched to the baby's age and the family's purchases (e.g. registry completion discount, store programs), each vetted by Fine Print Court | **Built** |
| **Benefit / deadline** | "$1,000 Trump Account: file Form 4547." "Add baby to insurance: 30-day window, 12 days left." MA child tax credit $440, MA paid leave, DCFSA life-event change | **Built** |
| **Coming soon** | "Pre-filled applications" and "We'll watch for price drops" | **Informational tiles** |

### The never-empty guarantee (new)

Every family sees a useful feed, even with no bank or Amazon data:
- **At least 2 benefit cards.** These are computable from the three inputs alone, since every new baby unlocks some (e.g. the $1,000 Trump Account and the $2,200 federal child tax credit apply in every state).
- **Exactly 1 recall card:** either the flags, or "We checked {n} items: all clear." If no purchases were provided: "Connect your data to safety-check your items."
- **At least 3 discount cards.** Matched to the baby's age; general newborn offers fill in if nothing personal matches. Fillers also go through Fine Print Court, so a rejected offer can never sneak back in.
- **Clawback cards only when real.** When there are none, one card says *"No money to claw back yet. Connect a card or upload Amazon orders,"* or, if data was connected, *"Nothing to claw back: you're doing great."*
- **2 coming-soon tiles.**

## 2. The agent team (the newsroom)

| Agent | Job | Pattern judges reward |
|---|---|---|
| **Orchestrator** (plain code) | Runs the agents, enforces the never-empty rules, writes the trace log | Branching, fallbacks |
| **Clawback Hunter** | Finds money back from transactions × FSA-eligible list × store price policies × sample price checks | Tool use (Zetaris) |
| **Recall Checker** | Matches purchases against live recall lists | Live data |
| **Deal Hunter vs. Fine Print Lawyer → Judge** ("Fine Print Court") | Argue for and against each discount; the Judge rules and cites past rulings ("case law") | Debate, critique, veto |
| **Benefits Planner** | Turns rules plus birth date into dated deadlines | Planning over time |
| **Fact-Checker** | Re-checks every dollar amount and deadline with its own Zetaris query; sends wrong work back (max 2 retries) or blocks it | Validation, retry, escalation |
| **Coach** | Turns parent feedback ("I got this" / "Report issue") into proposed rules; the admin approves; they're stored as case law in Meterless memory | Shared memory, learning |
| **Scout** (runs ahead of time) | Reads 10 saved official and offer pages and writes rules and offer rows with source links | Turning messy pages into data |

## 3. Sponsor tech, doing real work

- **Zetaris (required):** one SQL question joins the **family's private data** (Neon: transactions, Amazon orders, profile) × **curated rules** (Neon: FSA-eligible categories, store policies, benefit rules, offers) × **live recalls** (CPSC and openFDA APIs, plus NHTSA car seats if available).
  - Each agent gets its **own view**. The Judge and Scout never see income.
  - **Data-quality rules** block any card without a source.
  - Remove Zetaris and the app can't produce a single personalized card.
- **Meterless H-MEM (required):** case law and per-family memory, with source and confidence. Run 1 vs. run 2 shows the app learning. The audit log is saved in `logs/`.
- **NVIDIA Nemotron:** powers the agents through NVIDIA's API.
- **Neon + Firebase + Colin Matthews' template:** database, sign-in, and the app shell (login, pages, payments ready but unused).

## 4. Hackathon must-haves (from the checklist)

- A web address judges can call: `POST /api/run`
- `SAMPLE_MODE` (runs with sample inputs, never pre-written answers)
- A JSON trace log in `logs/`
- A public GitHub repo, `.env.example`, README, `data/README.md`, `metadata.json`
- An eval scoreboard (traps caught; before vs. after learning)
- A 1–4 minute video and slides

## 5. Infrastructure first (starts while you're at work)

| # | Step | Needs you? |
|---|---|---|
| 1 | Create the app from the template's **last Firebase version (Jan 4, 2026)**. The newest version switched to Replit's sign-in, and its README is out of date. Remove file storage and the OpenAI chat page | No |
| 2 | Database tables in Neon + 3 fake families + fake Plaid-format transactions + a fake Amazon order file | No |
| 3 | **Connect Neon to Zetaris** (the biggest unknown) + register CPSC and openFDA as live sources + per-agent views | No |
| 4 | Trace log, memory engine (vendored from Meterless), AI adapter with a stand-in until the NVIDIA key arrives | No |
| 5 | Firebase sign-in working locally + guest mode | Only if a Firebase setting is missing |
| 6 | GitHub repo | **Yes: OK to create it private now and make it public before submitting?** |

**Blockers only you can clear (anytime today):**
- **NVIDIA key** (HackOS → Resources → NVIDIA, then build.nvidia.com)
- **Plaid sandbox keys:** sign up free at dashboard.plaid.com. Until then, I use fake transactions in Plaid's exact format.
- **Firebase:** confirm Email/Password and Google sign-in are turned on

## 6. Timeline (5 days left; submit **Tue** Oct 27 by 5pm Boston)

Correction: Oct 27, 2026 is a **Tuesday**, not a Monday as the earlier plan said. That's one more build day. The deadline is 23:45 UTC (7:45pm Boston) on Tue Oct 27.

| Day | Done when |
|---|---|
| **Fri Oct 23** | Infrastructure 1–5 done. **Noon go/no-go on Zetaris ↔ Neon**; if it fails, Plan B is Zetaris file tables (CSV exports) for the curated data. One family runs end to end: guest → Receipt → at least one real card per type, with a trace |
| **Sat Oct 24** | All agents working; Fine Print Court live; Fact-Checker send-back loop; feed UI on a phone |
| **Sun Oct 25** | Coach + memory learning (run 1 vs. run 2); eval scoreboard; Plaid + Amazon upload |
| **Mon Oct 26** | Polish, speed-up, clean-setup rehearsal, README, data notes, metadata.json, **record video + slides** |
| **Tue Oct 27** | Final clean-setup test, repo public, submit by 5pm Boston |

**If behind, cut in this order:** Scout (hand-write the rules rows instead) → price-drop clawback → Amazon upload (keep Plaid) → login (guest only).
**Never cut:** clawback + FSA, recall check, Fine Print Court, the Fact-Checker loop, learning run 1 vs. 2, never-empty feed, traces.

## 7. Decisions for the CTO to weigh in on

1. **Sign-in:** port Firebase (the template's older version) vs. keep the template's newest Replit sign-in (only works when hosted on Replit).
2. **Zetaris speed:** about 5 seconds per query, so each run makes a few batched queries and caches results for that run.
3. **Plaid → Neon copy, then Zetaris reads Neon.** Zetaris can't do Plaid's sign-in step itself.
4. **Deterministic first, AI second:** dollar math and deadlines are computed in plain SQL and code; agents explain, argue and check. This lowers the risk of the AI making up numbers.
5. **Hosting:** Render vs. Replit, for a server that has to stay running.
6. **Speed:** a full run may take 1–3 minutes (about 5s per Zetaris query, plus AI calls). Mitigation: batched queries, parallel court calls with a cap, and a live progress view so waiting feels like watching the agents work.
7. **Open endpoint:** guests can only run the 3 sample families or an unsaved family; requests are rate-limited, so strangers can't fill the database or burn AI credits.
8. **Learning demo reliability:** run 1 must approve the trap offer before learning. If the live AI rejects it anyway, show a saved real run 1 next to a live run 2.

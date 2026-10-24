# Bundle: big-picture review (Oct 22, 2026, night)

Three questions Lyndsay asked: what is Zetaris really for, do our data sources make sense, and are we building the coolest part given how easy agents are to build? These are recommendations to discuss. Nothing here is decided yet.

## 1. Zetaris, from first principles

- **The problem it solves:** facts live in many places ("sources"). Each source has its own format, its own update schedule and its own way of being asked questions. To combine them, normally you'd **copy** everything into one big database (called "ETL": extract, transform, load). Copies go stale and take work to keep up.
- **What Zetaris does:** it leaves each source where it is and lets you ask **one question in one language (SQL)** that reaches into all of them at once and combines the answers (a "join"). It also controls **who may see what** ("governance").
- **When it's worth it:** (1) several separate sources, (2) they change over time, so freshness matters, (3) you need to combine them in one question, (4) some data is private.
- **When it's decoration:** one source, or a single token query. Judges call that "near zero" for Sponsor Tech.
- **Agents vs Zetaris:** agents are good at fuzzy jobs: reading messy pages, judging "is this worth it?", explaining. Zetaris is good at exact jobs: "which programs does a family of 3 earning $40k in ZIP 02134 qualify for?" Each should do what it's good at.

## 2. Do our data sources make sense?

Test each source: **does a parent's answer change because of it?**

| Source | Keep? | Why |
|---|---|---|
| **HHS poverty guidelines** (official income cutoffs) | ✅ Essential | Most benefits (WIC, Medicaid/MassHealth and more) set income limits as a percent of these. Without them the app can't say "you qualify." |
| **Program rules table**: one row per benefit (income limit as % of poverty, state, baby-age window, deadline, documents needed, source link) | ✅ **Add; it's the missing core** | Written by the Scout agent from official pages, stored in our Neon database. This is what Zetaris joins against. |
| **Families + feedback** (our Neon database) | ✅ Essential | Who's asking, and what parents reported. |
| **ZIP code → state / county list** (public Census/HUD file) | ✅ Add (cheap) | State and city benefits depend on where you live. Parents type a ZIP, not a county. |
| **CPSC recalls** (unsafe baby gear) | 🟡 Keep **one** | Great demo moment: "this discounted crib was recalled." It's a side feature, though, not the core. |
| **openFDA recalls** (formula and baby food) | 🟡 Optional | Only matters if we list formula deals. Drop it if time is short. |

**Result:** the core is **families × program rules × poverty limits × location**. That's four sources joined in one question, which is real, load-bearing Zetaris work. Recalls are a bonus safety check.

## 3. Are we building the coolest part?

**What's already strong:** agents checking each other (the Fact-Checker sends work back) and learning from parents (the Coach). Judges reward exactly these.

**What's weak:** the parent's payoff is a **ranked list**, which is basically a search result. Agents can do much more than sort.

**Upgrade idea: the Matcher becomes a "Planner" that writes a personal action plan, not a list.**
- **A timeline:** "Before birth: apply for paid leave. Week 1: add baby to insurance (30-day deadline). Month 1: WIC appointment."
- **For each step:** why you qualify (with the source), how much money, how long it takes, what documents to bring.
- **"What changes when" reasoning** (the clever part): family income often drops during parental leave, which can make a family newly eligible for income-based programs. The Planner can re-check eligibility for the leave months and flag it. ❓ The exact rules per program need checking before we claim this in the demo.
- **Why it's cooler:** it uses agents for what only agents do well (planning, explaining, reasoning about time) and Zetaris for what it does well (exact eligibility joins). And it's what a tired parent actually needs: *what do I do, and when?*

**Track check:** this still fits Track 1 (Fragmented Intelligence). The "why you qualify, with sources" part also touches Track 2 (Explain Why), but don't switch.

**Scope check:** it replaces the Matcher rather than adding a sixth agent, so the plan isn't bigger.

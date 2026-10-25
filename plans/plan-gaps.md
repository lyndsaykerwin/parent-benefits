# Bundle: what the plan is missing (Oct 22, 2026, night)

A review of [plans/build-plan.md](build-plan.md) for the "boring basics" a finished app needs. Each gap has a **recommendation for a 5-day hackathon**: what to build, what to fake honestly, and what to label "coming soon."

The frozen copy of the plan as of tonight is in [plans/old-versions/](old-versions/). Edit plans/build-plan.md freely; the copy stays as it is.

**Why this matters:** judges score a working, focused system and they **run it themselves** (hackathon-overview.md §12–16). A hackathon app is not a business yet. Most "real company" basics should be **deliberately skipped and named as future work**, not built. Building them burns days and adds ways for the demo to break.

---

## A. Decisions to make first (they block building)

| # | Gap | Why it matters | Recommendation |
|---|---|---|---|
| A1 | **Data sources not settled** (you're unsure about Supabase + poverty limits + FDA + CPSC recalls) | Zetaris is pass/fail. Its job depends on which sources it connects. Nothing gets built until this is decided. | Decide first thing tomorrow. Test: Zetaris must combine **2+ separate places** in one question, and deleting it must break the app. |
| A2 | **Tech stack not chosen** (which programming language, which website framework) | Everything else depends on it. The Meterless memory code is **TypeScript** (a common web language); Zetaris's helper scripts come in both Python and TypeScript. | ✅ **DECIDED Oct 22:** a **phone-friendly website** built on **Colin Matthews' template** (see B2a). It's TypeScript everywhere: a React website plus an Express server (the behind-the-scenes program that runs the agents). The Meterless memory code is also TypeScript, so it drops straight in. An App Store app can come after the hackathon, reusing the same server. |
| A3 | **Where it runs** (only on a judge's computer, or also online) | Judges must run it from the code, but a live link makes the demo easier to try. | Both: runs locally with one command, **plus** a live copy online, in sample mode so strangers can't burn your AI credits. ❓ Host to pick: the template's server needs a host that keeps a program running all the time, like Render or Replit (the template already includes Replit settings). Vercel suits it less well. |
| A4 | **AI model access** (NVIDIA key not yet claimed) | No key, no agents. | Claim credits via HackOS → Resources → NVIDIA; get the key at build.nvidia.com. Keep a backup model setting in case NVIDIA rate-limits you (one guide reports ~40 requests per minute). |
| A5 | **Cursor is now optional** (you told me organizers changed this) | The plan and checklist still list it as required. | Drop it. Remove it from the slides' sponsor list. ❓ Worth confirming in a HackOS announcement, since hackathon-overview.md still says "required." |

## B. Baseline app pieces the plan doesn't mention

| # | Basic | Build it? | What to do |
|---|---|---|---|
| B1 | **User accounts / login** | **Yes** (Lyndsay's call, Oct 22: build something real to keep growing after the hackathon) | Use the template's **Firebase** sign-in (Google's sign-in service): email/password plus "Sign in with Google," already built. **Must add a "Try as guest" button** that opens a ready-made fake family, so judges never have to sign up (rule: runs with no manual steps). A signed-in parent's family details and feedback are saved to their account. |
| B2 | **Who can approve the Coach's rules** (permissions) | **Yes, simple** | Two roles: **parent** and **admin** (you). Only an admin sees the "approve rule" button. Add a `role` field to the template's users table (it has none yet), and make every request check that a parent only sees their own family's data. |
| B2a | **Starter template**: Colin Matthews' [VibeCodeYourNextSideProject-Template](https://github.com/colinmatthews/VibeCodeYourNextSideProject-Template) | ✅ **DECIDED: use it** (Oct 22). Licences checked: MIT, and every add-on it pulls in is permissive (none force your code public). Restyle its desktop-looking screens for phones; swap its OpenAI chat page for NVIDIA or remove it. | Already has login (email + Google, via Firebase), profile, settings, pricing and file-upload pages, Stripe payments, SendGrid email, rate limiting (caps on how often someone can call the app) and tests. TypeScript, last updated Jan 4, 2026. **Trade-offs:** it uses **Firebase** (Google's sign-in service) + **Neon** (a hosted Postgres database) instead of Supabase, so 2 new free accounts; no admin role yet (small add); no LICENSE file in the repo, though its package.json says "MIT". Must be declared as a pre-existing component. Zetaris can read Neon just like Supabase, since both are Postgres. |
| B2b | **Which backend tool** (GenAI Works PDF lists Appwrite, Supabase, PocketBase, Coolify and n8n) | **None of them; the template's Neon + Firebase** | Superseded by B2a: the template uses **Neon** for the database and **Firebase** for sign-in. Neon is Postgres, so Zetaris reads it the same way it would have read Supabase. Appwrite, PocketBase and Supabase would all duplicate that. Coolify (hosting on your own server) isn't needed because Vercel covers hosting. n8n (drag-and-drop automations) isn't needed because the agents are code. |
| B3 | **Payments** | **No** | Bundle is free for parents. Put the business model (e.g. brands pay for verified listings, or employers offer it as a benefit) on the "future" slide. Building checkout earns zero points. |
| B4 | **Privacy of family info** (income, ZIP, due date) | **Yes** (more important now that accounts save real info) | (1) Fake families only in the demo and test data, which the rules require. (2) **Never write income into the logs**: the log format includes "input summary" fields, so blank it out there. (3) One line on screen: "Your family's details are private to your account. Guests' details are never saved." (4) Stretch goal already in the plan: per-agent privacy views in Zetaris. |
| B5 | **"Not official advice" note** | **Yes** | One line on the list screen and in the README: "Bundle checks public sources but isn't a government agency. Confirm with the program before applying." Cheap, and it builds trust. |
| B6 | **Where parent feedback is saved** ("I got this" / "Report issue") | **Yes** | Zetaris can only read, so feedback has to be written somewhere else. Save it in the template's Neon database, tied to the parent's account, or in local files in sample mode. |
| B7 | **Waiting screens** | **Yes** | A full agent run can take minutes. Show progress ("Checking 15 offers… Fact-Checker sent 2 back…") instead of a frozen screen. This doubles as a demo of agents working together. |
| B8 | **Empty and error screens** | **Yes, basic** | "No offers match this family yet," and "A data source didn't answer; using the saved copy" (the fallback the rules ask for). |
| B9 | **Works on a phone** | **Yes** | Tired parents use phones. Design for phone width first. |
| B10 | **Easy to read** (accessibility: usable for people with poor eyesight or other disabilities) | **Yes, basic** | Readable text size, good contrast, plain words. Product & UX is 10 points. |
| B11 | **A way for judges' code to run it** (`POST /run`) | **Yes** | The rules mark down screens-only apps. One web address that takes a family and returns the ranked list plus the trace. |
| B12 | **Sample mode** (`SAMPLE_MODE=true`) | **Yes** | Runs without live services. It may load sample *inputs*, never prewritten answers (weak-submission-examples.md:330). |
| B13 | **Limits on AI spending** | **Yes** | Cap retries (the plan says max 2) and the total AI calls per run. Save AI answers during testing. The live website runs in sample mode only. |
| B14 | **Public GitHub repo** created during the build window, with a licence | **Yes** | Create it tomorrow so all the work is dated inside the window. MIT licence (a short, standard "anyone can use this" licence). Keep secrets out from the first commit. |
| B15 | **Clean-setup test** | **Yes** | Before submitting, download the repo fresh, follow the README exactly, and confirm it runs with no extra steps. Planned for Mon Oct 27; do a rehearsal on Sat Oct 25 too. |
| B16 | **Declaring earlier work** | **Yes** | The Boston research and persona ideas existed before Oct 22. List them as "pre-existing components" in the submission form and README. |
| B17 | **`metadata.json` contents** | **Ask** | Every sponsor page says to fill it in, but no file says what goes in it. Ask in HackOS #help desk. |
| B18 | **Demo video and slides tools** | **Decide** | Screen recording: QuickTime (built into your Mac). Slides: Google Slides or a slide artifact. Pick before Monday. |

## C. Things deliberately NOT built (say so in the slides as "future")

Payments (nothing to charge parents for yet; add Stripe, a standard payment service, once there's a business model), emails and notifications beyond sign-in links, reading live websites, all 50 states, a native phone app, filling in application forms, analytics (tracking how people use the app), Meterless's safety engine (Scout Intent), and the Nightshift AI hotspot (optional).

---

## Handing this to another chat

Paste this into a new chat to keep working on the plan:

> I'm Lyndsay, a non-coder entering the Open Agent Hackathon 2026, solo, building "Bundle," a new-parent benefits app. My folder is /Users/lyndsay/Documents/hackathon. Read CLAUDE.md, plans/build-plan.md (the living plan), progress/reviews/big-picture-review.md (what Zetaris is for, data sources, the Planner idea), plans/plan-gaps.md (missing basics and recommendations), hackathon-resources/hackathon-checklist.md (every requirement) and setup/zetaris-aws-setup-notes.md. Zetaris is running on AWS and connected. Help me settle the open decisions in plans/plan-gaps.md section A, starting with the data sources, then update plans/build-plan.md. Don't edit anything in plans/old-versions/; that's my frozen backup.

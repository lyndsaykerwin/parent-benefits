# Bundle: hackathon requirements checklist

Every rule, required piece and judging signal from the hackathon files, in one place. Claude checks this before submission.

Created Oct 22, 2026, 7:55pm Boston. **Submission deadline: Tue Oct 27, 7:45pm Boston (23:45 UTC). Hard, no extensions.** (Oct 27, 2026 is a Tuesday.) Our own target is 5pm that day: if two entries tie, the one that submitted earlier wins (participant-journey-map.md:296).

Key: ✅ done · ⬜ to do · ❓ need to confirm · ⚠️ conflicts with our plan

Source files are named in brackets. "overview" = hackathon-overview.md, "weak/strong" = weak-/strong-submission-examples.md, "how-approach" = how-approach-solutioning-for-your-use-case.md.

---

## 0. Urgent

- ✅ **Registered on hackathon.genai.works** before the Oct 22, 7:45pm Boston deadline (Lyndsay confirmed Oct 22). [overview §1, faq §2]
- ❓ Logged in to HackOS, profile complete, **"happy to build solo"** selected. [faq §3]
- ❓ Only one account. A duplicate account disqualifies you. [overview §8]

## 1. Rules and eligibility

- ⬜ Pick exactly **one** track in HackOS: **Track 1, Solving Fragmented Intelligence**. You can change it before the deadline. [overview §6]
- ⬜ Name the track everywhere: README, slides, video. [weak:601]
- ⬜ All work done during Oct 22–27. **Declare anything made earlier** in the submission form, including research, the persona ideas and any data prepared before Oct 22. Undeclared earlier work = disqualification risk. [overview §12, how-approach:189, weak:37]
- ⬜ Use only open, legal data. **No real personal data**: the test families must be made up. [faq §5]
- ⬜ No hardcoded answers. This is a disqualification risk. [weak:30]

## 2. Required sponsor tech (worth 10 points, and two items are pass/fail)

**Zetaris (required, pass/fail)** [weak:25]
- ✅ AWS cluster created and Active (Oct 22). Details in zetaris-aws-setup-notes.md.
- ✅ Test question works (NY_TAXI, 5 rows), run from the Mac Oct 22.
- ✅ API key, org ID and web addresses saved in `zetaris-getting-started/.env.local` (private; ignored by git).
- ✅ Connection check passes; `SHOW LIGHTNING DATABASES` shows NY_TAXI and TPCDS_DB. [zetaris AGENTS.md:7,18]
- ✅ Neon (replaced Supabase) connected as Zetaris source `bundle_pg` (Spike 0, Oct 23).
- ⬜ HHS poverty, openFDA and CPSC feeds connected. Dry run first. [AGENTS.md:45-51]
- ✅ One question that joins across sources: Neon orders × live CPSC recalls, 1 correct match, about 2s (Spike 0; re-verified by Claude).
- ⬜ Zetaris does **real work**. If you deleted it, the app should stop working. A token call like `SELECT 1` scores "near zero." [weak:122,138]
- ⬜ Zetaris calls are never faked with fixed answers. [weak:324]

**Meterless (required, pass/fail)** [weak:25]
- ⬜ H-MEM memory copied in from Meterless's starter (ready-made code on GitHub).
- ⬜ The Coach saves rules with a source and a confidence score.
- ⬜ The Reviewer / Parent Panel **retrieves** rules before judging. Saved but never read = decoration. [meterless-engines/meterless-readme.md §7]
- ⬜ H-MEM's audit log (one record per line, a format called JSONL) is written to `logs/`.
- ⬜ Optional: the Nightshift "AI hotspot" for one small job. Cut it if it fights back.

**Cursor (now optional)**
- ✅ Not using it. Lyndsay confirmed on HackOS that Cursor is optional (Oct 23). Leave it out of the slides and sponsor section; say "Built with Claude Code."

**NVIDIA (where it helps)**
- ⬜ Claim NVIDIA credits: HackOS → Resources → NVIDIA. Our saved copy (nvidia-sponsor-overview.md) confirms "credits for NVIDIA Nemotron models, used through API keys" but says the claim steps were still to be added.
- ⬜ NVIDIA API key from build.nvidia.com, one test call made.
- ⬜ Nemotron models do the agents' thinking.

**Explain all four**
- ⬜ README + `metadata.json` say where each sponsor tool sits. [each sponsor overview]
  - ❓ No file describes what `metadata.json` should contain. Ask in HackOS #help desk, or check the HackOS submission page.
- ⬜ Say what was **unique** about how we used them. [overview §12]
- ⬜ Missing basics (accounts, privacy, hosting, waiting screens and more) are tracked in plan-gaps.md.

## 3. Agent design (Technical 20 + Innovation 15)

- ⬜ At least two agents that really interact; we plan five. [weak:726]
- ⬜ Each agent is a real separate step, not one prompt pretending to be several. Faking it is treated as an integrity problem. [weak:29]
- ⬜ Not a straight line (A → B → C). Show at least 3 of these: agents handing off work depending on the situation, one agent critiquing another, retries, shared memory, escalation, a checker that can block output, branching. [strong:105-115]
  - Ours: the Fact-Checker sends work back (retry, max 2), the Parent Panel can veto (block), shared memory (H-MEM), and the Fact-Checker picks sources from Zetaris's list (decides on the fly).
- ⬜ Failures handled gracefully, with a backup path when a website or API is down. [overview §16, faq §5]

## 4. Running it (judges must be able to run it themselves)

- ⬜ **GitHub repo is PUBLIC.** Test the link in a private browser window while logged out. [weak:32,383-387]
- ⬜ Runs from a fresh download with **no manual steps**. [overview §16]
- ⬜ Runs without a graphics card (GPU) on the judge's computer. [strong:607-608]
- ⬜ Docker setup (a packaged way to run the app) is suggested. [strong:243-248]
- ⬜ A web address judges can call directly (e.g. `POST /run`), not just screens. A UI-only app scores lower. [weak:455-469]
- ⬜ `SAMPLE_MODE=true` switch for running without live services. It may load sample *inputs*, **never** prewritten answers. [weak:330-339]
- ⬜ Judges will try their own inputs, so the app must handle new families and offers, not just the demo ones. [weak:309]
- ⬜ Fast: starts in under 30 seconds, full run in 5–10 minutes. [how-approach:392-403]
- ⬜ Secrets only in environment settings (`.env.local` / `.env`), never committed. **Committed keys = disqualification risk.** [overview §5, weak:35]
- ⬜ `.env.example` with fake placeholder values only. [overview §5]
- ⬜ `.gitignore` covers secrets files (`.env`, `.env.local`) [weak:530-538], plus the Meterless starter's own `.notebook/` and `vendor/` folders.
- ⬜ Folders: `app/agents/`, `app/orchestration/`, `app/adapters/` (zetaris, meterless, sample data), `data/sample/`, `input_examples/` (3+), `output_examples/` (3+), `logs/`. [strong:468-506]
- ⬜ `output_examples/` are saved from real runs, never shown as live results. [strong:555]
- ⬜ `data/README.md` gives, for each data source: link, licence, which part we used, record count, how to rebuild it, and limits. [how-approach:443-450]

## 5. Logs and proof (Technical score)

- ⬜ One JSON line per event in `logs/`. Fields: timestamp, trace_id, agent_name, action, input_summary, output_summary, target_agent, confidence, retry_count, status. [strong:121-148]
- ⬜ Logs show every Zetaris and Meterless call. [weak:108,361]
- ⬜ Sample inputs and outputs covering more than one case. [overview §12]
- ⬜ Eval scoreboard (a test with an answer key): 15 offers, 6 planted traps, before vs. after learning. [build-plan.md]
- ⬜ One command runs the evals and prints the scoreboard.

## 6. The four submission pieces (all required)

**1. Demo video** [overview §12]
- ⬜ **1–4 minutes.** Over 4 minutes counts as incomplete. [weak:36]
- ⬜ Shows: the main workflow, how it solves Track 1, key features, and how Zetaris and Meterless are used.
- ⬜ Suggested 3½-minute timing: problem 0:20, architecture 0:30, live run 0:50, logs and agents working together 0:40, sponsor tech 0:30, result 0:40. [strong:349-356]
- ⬜ No keys or private data on screen. [strong:399]
- ❓ Where to upload it (YouTube? HackOS?). Not stated. Check the HackOS submission page.

**2. Slide deck** (missing = incomplete) [weak:36]
- ⬜ About 8 slides, one per required point [strong:330-339]: problem and users · solution · agent workflow / architecture diagram · tech stack · how Zetaris and Meterless were used · what was unique about our sponsor tech use · product screenshots · future plans.

**3. GitHub repo + README** [overview §12, strong:188-324]
- ⬜ README sections: track name, problem, agent table (with a "can block / retry?" column), tech stack, setup, usage with a sample request and reply, sample mode, failure-handling table, data and licences, limitations, pre-existing components.

**4. Sponsor tech explanation**
- ⬜ Zetaris and Meterless integration, how Cursor was used, where NVIDIA helps, what was unique.

**Submit**
- ⬜ Submitted on HackOS by Tue Oct 27, 5pm Boston (our target; the real deadline is 7:45pm).
- ⬜ Final test from a fresh download before submitting. [faq §7]

## 7. Product (Impact 30, Product & UX 10)

- ⬜ Clear user (new parents) and a clear dollar value (~$9,210 in year one for a Boston family). Back value claims with evidence, since unsupported claims are discounted. [overview §14]
- ⬜ 3 screens: pick a family, "do these first" list, "Bundle got smarter." [build-plan.md]
- ⬜ Output a tired parent could actually use.

## 8. Optional community posts (from the week-1 slides, not scored)

- ⬜ Post the 8-line "Agent Loop Spec" (the plan for one agent's loop) in team chat. [slides p.9]
- ⬜ Post our autonomy level, L0–L3 (how much agents act without asking) in #project-ideas. [slides p.12]
- ⬜ Post our agent pairing (e.g. proposer/critic) in #use-case-help. [slides p.16]

## 9. After the hackathon: cleanup

- ⬜ Delete the Zetaris cluster, then the AWS stack, then delete the API key (it was shared in chat). Steps are in zetaris-aws-setup-notes.md.
- ⬜ Reset the Neon password and delete the Firebase server key. See accounts-and-keys.md.

---

## Where our plan needs updating

- ⚠️ build-plan.md Day 1 says "Install Docker, start the Zetaris download." We switched to **AWS**, so that step is done differently.
- ⚠️ build-plan.md has no **public repo**, **`POST /run` web address**, **`SAMPLE_MODE`** or **`data/README.md`**. All four are needed.
- ⚠️ build-plan.md calls the Meterless Runtime a "Mac app." It's Nightshift, and its free Mac version is limited to small models. It's already second on the cut list.
- ⚠️ The week-1 slides say "15–20 October." They look reused from another event. Trust the overview's dates.
- ⚠️ how-approach suggests solo builders use 2–4 agents and 1 data source. We plan 5 agents and 4+ sources. That's fine *if* version 1 works by Thursday night, as the plan says; otherwise use the cut list.

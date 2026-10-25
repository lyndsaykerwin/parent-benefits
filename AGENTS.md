# Folder map

This is the one and only copy of the hackathon project on this Mac: `~/Documents/hackathon`.
Every file lives in one of the folders below. Only `CLAUDE.md`, `AGENTS.md` and `.gitignore` sit at the top.

## What lives where

- `bundle/` — the app itself (the website and its AI helpers). On GitHub the project is called "parent-benefits", but the app folder is `bundle/`.
- `plans/` — the plans. The current one is `plans/bundle-plan-v3.md`; also the build plan, architecture (how the parts fit together), flow chart and onboarding spec.
  - `plans/old-versions/` — earlier copies of plans, kept for history.
  - `plans/lyndsay-directives/` — Lyndsay's own instructions and feedback.
- `hackathon-resources/` — the hackathon's rules and guides: `hackathon-overview.md` (judging rules), `strong-submission-examples.md`, `weak-submission-examples.md`, the FAQ and the checklist.
- `research/` — research notes, `research-boston-baby-benefits.html` (benefit amounts and sources), the learning brief (`research/learning-brief/`), the class book (`research/class-book/`) and small experiments (`research/experiments/`).
- `design/` — screen mockups and design notes: `design/onboarding/` (the first-run screens), `design/v2/` (clickable V2 mockups of the Oct 25 feedback changes, with screenshots in `design/v2/screens/`) and `design/inspiration-military-benefits/` (screenshots used for ideas).
- `presentation/` — what judges see: the slide deck (`presentation/deck/`), the demo video script and rehearsal notes (`presentation/demo-video/`), and the week-1 check-in slides.
- `setup/` — how the outside services were set up (Zetaris, Meterless, Neon, accounts list). `setup/zetaris-getting-started/` is a copy of Zetaris's public starter kit and is not uploaded to GitHub.
- `progress/` — the work diary:
  - `progress/tracking/` — tracking files (to-do lists for a piece of work).
  - `progress/handoffs/` — handoff notes, so the next session knows where things stand.
  - `progress/reviews/` — quality checks, audits and review reports.
- `docs/superpowers/` — plans saved automatically by the "superpowers" coding skill. Leave it where it is.
- `.secrets/` — passwords and keys (hidden folder, never uploaded). The app reads `.secrets/bundle.env.local`. Never copy, print or upload anything in here.
- `.claude/` — settings, skills and saved preferences for Claude (hidden folder).

## How to start the app

1. `cd ~/Documents/hackathon/bundle`
2. Practice mode with saved sample data: `SAMPLE_MODE=true npm run dev`
   Real AI mode (uses NVIDIA): `MODEL_PROVIDER=nvidia SAMPLE_MODE=false npm run dev`
3. Open http://localhost:5050 in a browser. (Not 5060: browsers block that number.)

## Rules for agents

- Every new file goes in one of the folders above. Never put files at the top level, except `CLAUDE.md` and `AGENTS.md`.
- Where new files go:
  - new tracking files: `progress/tracking/`
  - handoff notes: `progress/handoffs/`
  - quality-check, review and audit reports: `progress/reviews/`
  - research: `research/`
  - plans: `plans/`; when replacing a plan, save the old version in `plans/old-versions/`
  - design mockups: `design/`
  - slides and demo video: `presentation/`
- The app folder is `bundle/`, even though GitHub calls the project "parent-benefits".
- There are no other copies of the project anywhere on this Mac. Never create one.
- Keep this map up to date whenever you add or move a folder.

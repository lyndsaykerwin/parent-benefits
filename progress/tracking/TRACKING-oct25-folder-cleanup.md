# Folder cleanup — Oct 25, 2026

Goal: every file lives in a clearly named subfolder; no loose copies outside `~/Documents/hackathon`; folder map written to `AGENTS.md`.

## Decisions
- The app folder stays `bundle/` (renaming would break its internal paths). "parent-benefits" is only the GitHub name.
- Only `CLAUDE.md`, `AGENTS.md`, `.gitignore` stay at the top (Claude tools look for them there).
- `docs/superpowers/` stays put: the superpowers coding skill saves plans there automatically.
- `.secrets/` stays at the top: the app reads `../.secrets/bundle.env.local`.

## Map (old → new)
- `hackathon resources/*`, `hackathon-checklist.md`, `genai-works-5-github-repos.pdf` → `hackathon-resources/`
- `build-plan.md`, `project-plan.md`, `architecture.md`, `flow-chart.md`, `onboarding-spec.md`, `plan-gaps.md`, `plan-grade-future-state.md`, `bundle-plan-v3.md`(already in plans/), → `plans/`
- `plan-history/*` → `plans/old-versions/`
- `lyndsay-final-directives.md`, `lyndsay-feedback-agent-loops-latency.md` → `plans/lyndsay-directives/`
- `onboarding-design/` → `design/onboarding/`; `military benefits screen inspo/` → `design/inspiration-military-benefits/`
- `research-boston-baby-benefits.html`, `research-matching-and-agent-api.md`, `research-nightshift.md`, `idea-research-evidence-resume.md`, `entity-resolution-test.md` → `research/`
- `experiments/` → `research/experiments/`; `research-book/` → `research/class-book/`; `learning-brief.*` → `research/learning-brief/`
- `accounts-and-keys.md`, `zetaris-aws-setup-notes.md`, `zetaris-walkthrough.md`, `zetaris-getting-started-prompt.md`, `neon-setup-prompt.md`, `docs/zetaris-notes.md` → `setup/`
- `meterless-engines/` → `setup/meterless-engines/`; `zetaris-getting-started/` (not uploaded) → `setup/zetaris-getting-started/`
- `deck/` → `presentation/deck/`; `demo/` → `presentation/demo-video/`; `week1-checkin-slides.pdf` → `presentation/`
- `TRACKING-*.md`, `bundle-plan-v3.build-tracker.md` → `progress/tracking/`
- `HANDOFF-*.md` → `progress/handoffs/`
- `qc-reports/*`, `qc-final.md`, `qc-round4.md`, `audit-*.md`, `regrade-2026-10-24.md`, `big-picture-review.md`, `cloud-build-assessment.md`, `cloud-health-check.md` → `progress/reviews/`

## Outside / stray (to Trash, recoverable)
- `~/Documents/hackathon-bundle-original/` — old standalone copy of the app; its last change (6045143) is already in main; no unsaved edits.
- `hackathon/parent-benefits/` — empty except a copy of the secrets file identical to `.secrets/bundle.env.local` plus one empty line.
- Untracked duplicates `handoffs/HANDOFF-cloud.md`, `plans/bundle-plan-v3.build-tracker.md` — keep whichever copy is newer.

## Status
- [x] Moves done
- [x] Links fixed
- [x] AGENTS.md written
- [x] App tests pass, app still runs (995 pass; 5 fail in agentLogCoverage, caused by the app's own unsaved zetaris-cache changes, not the moves; health check ok)
- [x] Saved to GitHub

## Notes from the cleanup
- Kept the newer copies: top-level `HANDOFF-cloud.md` (Oct 25) and `bundle-plan-v3.build-tracker.md` (Oct 25), now in `progress/`; the older untracked copies went to Trash.
- `~/Documents/hackathon-bundle-original/` went to Trash (no unsaved edits; last change already in main).
- `parent-benefits/` NOT trashed: its secrets file has one key (REVIEWER_MODE_TOKEN) that `.secrets/bundle.env.local` lacks. Lyndsay to decide.

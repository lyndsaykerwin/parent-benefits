# Handoff: V2 build, Mac → cloud (Oct 25, 2026)

## Where things stand
- **Planning is done and pushed to `main`.** Nothing in the app code has changed yet.
- **Build from:** `plans/v2-build-plan.md` (revision 2). Read section 1 (change log and what was removed) and section 4 (build order).
- **What it should look like:** `design/v2/index.html` (clickable mockups) and `design/v2/screens/*.png` (screenshots of each story). `design/v2/README.md` maps screens to stories.
- **What "done" means:** 21 acceptance tests in `bundle/client/src/__acceptance__/v2/`. They all fail today, on purpose. Run them with `cd bundle && npm run test:v2`. The exact button names, text and request shapes the code must match are in `progress/reviews/v2-acceptance-tests.md`.
- **Background, read only if needed:**
  - `plans/v2-feedback-response.md` (the reasons behind each choice)
  - `progress/reviews/v2-code-map.md` (where things are in today's code, with line numbers)
  - `research/v2-*.md` (facts and sources)

## Rules for the cloud session
1. **Follow** `CLAUDE.md`, `AGENTS.md` and `.claude/lyndsay-global-instructions.md`.
   - Lyndsay is non-technical, so use plain English.
   - Use fictional data only.
   - Never print or commit secrets.
2. **Keys** come from the cloud environment's settings, not the repo.
   - `TAVILY_API_KEY` should be there.
   - If a key is missing, run with `SAMPLE_MODE=true`, and make features fall back the way the plan says.
3. **Budget: about $25 of credits.** Work so that running out mid-way loses nothing:
   - **Order:** Step 0 → Lane A → Lane B → Lane D → Lane C → Lane E. This order puts the plan's "never cut" items first.
   - **After each step or lane:** run `npm run test:v2`, `npm test` and `npm run check`. Commit with a clear message, push to `main`, then update this file's "Progress log" below and push again.
   - Use subagents for the work and ask for short replies. Keep the main conversation light, and don't re-read big files you don't need.
   - Follow the plan's cut line if credits are running low. Stop and write the handoff once roughly $5 is left.
4. **Quality-check against the mockups after every lane.**
   - Start the app: `cd bundle && SAMPLE_MODE=true npm run dev`, then open http://localhost:5050.
   - Click through that lane's story and screenshot it. Compare it with the matching `design/v2/screens/` image and the live mockup.
   - Copy, order and behaviour must match. Colours come from the existing app. List any differences in the progress log.
   - Mockup numbers marked "example" are not real data. Never copy them into the app.
5. **Leave for the Mac session:**
   - The Nightshift check (R4). It needs the Meterless Nightshift app on Lyndsay's Mac.
   - `npm run zetaris:record`, unless Zetaris keys are in the cloud environment.
   - `npm run record-vision` for the sample photos, unless NVIDIA keys are present.
   - Note each one in the log.
6. **Don't touch** the modified files in `bundle/data/sample/zetaris-cache/` or the `codebase_export/` folder. Both were left uncommitted on the Mac on purpose, and their origin is unclear.

## How to hand back to the Mac
Before stopping, whether finished or out of credits:
- Update the "Progress log" below with:
  - what's done (each lane, tests passing / failing, with counts)
  - what's half-done, and the exact next step
  - differences found against the mockups
  - anything left for the Mac
  - questions for Lyndsay
- Commit and push to `main`. The Mac session will read this file first.

## Progress log
- Oct 25 (Mac): planning, mockups and 21 failing acceptance tests pushed. Build not started.

### Task 14: Submission packaging

**Files:** Create `README.md` (sections per hackathon-checklist §6), `data/README.md` (source, licence, subset, count, regenerate, limits per source), `metadata.json`, `input_examples/` (3), `output_examples/` (3 saved real runs), `docs/architecture.md` (diagram), `LICENSE` (MIT; Colin's template credited as a pre-existing component). Modify `.env.example`.

- [ ] Step 0: SAMPLE_MODE must run with no secrets: families from `data/sample/families.json`, `firebase-admin` init skipped, Zetaris answered from the committed cache (README states these are saved real responses, with capture timestamps), LLM falling back to deterministic text when `MODEL_API_KEY` is empty. Commit sample traces to `logs/sample/` (not ignored).
- [ ] Step 1: Clean-setup test (in a temp dir with **no** `../.secrets` next to it):
  1. `git clone` to a temp dir
  2. `cp .env.example .env` with `SAMPLE_MODE=true`
  3. `npm ci && npm run dev`
  4. `curl -s -XPOST localhost:5000/api/run -H 'content-type: application/json' -d '{"familyId":"leo"}' | jq '.cards|length'`

  Expected: `≥ 9`, with no other manual steps.
- [ ] Step 2: `git grep -nE 'npg_|AIza|akiurs|BEGIN PRIVATE KEY'` returns nothing.
- [ ] Step 3: Check that the time from `npm run dev` to the server listening is under 30s.
- [ ] Step 4: README names the track (Track 1: Solving Fragmented Intelligence), lists pre-existing components (Colin Matthews' template at a9542c2, Meterless H-MEM reference, Zetaris starter scripts, pre-Oct-22 research), and maps the layout to the hackathon's suggested `app/agents`-style structure. Add `metadata.json` per the HackOS spec (still unknown; ask in #help desk).
- [ ] Step 5: Commit `docs: readme, data notes, metadata, examples`.
- [ ] Step 6 (human, Tue Oct 27): make the repo public, open its link in a logged-out private window, submit on HackOS.

---


---
**Binding context (read too):** overrides.md, global-constraints.md, and the "Rulings" section of progress.md, all in this folder. Where they conflict with the text above, they win. Key rulings: guest only (no Firebase; "Reviewer mode" token instead of admin); the Receipt is split into `moneyBackCents` + `likelyBenefitsCents`; the court caps at 5 offers; reuse the existing Zetaris objects `bundle_pg` and `bundle_live.cpsc_recalls`; never drop the Neon table `spike0_amazon_orders`. Repo: /Users/lyndsay/Documents/hackathon/bundle (local `main`, never push).

**Controller specifics:** `server/db.ts` currently throws at import without `DATABASE_URL`. SAMPLE_MODE must boot without it (lazy DB init, with families from `data/sample/families.json`). Dev port 5050. Never make the repo public or push; that's a human step on Tue Oct 27.
- **Also (controller):**
  - Set `app.set('trust proxy', 1)` behind an env flag `TRUST_PROXY=1` for hosting; NODE_ENV=production in the start script.
  - data/README.md must label the saved Scout pages as hand-written excerpts with source URLs and capture dates, and must say the Zetaris replay cache holds saved real responses over synthetic family data, with timestamps.
  - README names the track, credits pre-existing components, explains SAMPLE_MODE honestly (replayed real Zetaris responses; offline court/coach fallbacks when no MODEL_API_KEY), shows the scoreboard numbers from logs/scoreboard.json, and documents the demo date.
  - metadata.json: the schema is unknown. Create a sensible one (project name, track, team, sponsor tech used and where, repo, demo links as placeholders) and flag it in the report for Lyndsay to check against HackOS.
  - Do NOT make the repo public or push.

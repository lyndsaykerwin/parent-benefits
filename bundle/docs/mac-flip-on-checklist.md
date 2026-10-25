# Mac flip-on checklist

Plain-English steps for Lyndsay's Mac. "Flip-on" means switching the app from saved sample answers to the real services (Nightshift, NVIDIA, Zetaris, Neon). Run every command in the `bundle` folder. Last updated Oct 25, 2026.

**Words used here.** *Terminal* = the app where you type commands. *Neon* = the online database. *Zetaris* = the SQL "data door" that reads our scattered sources. *Nightshift* = Meterless's free Mac app that acts as an AI switchboard on your own computer. *Nemotron* = NVIDIA's family of AI models. *Replay* = a saved real Zetaris answer the app plays back when it has no keys. *Dry run* = shows what would happen, changes nothing.

**Ground rules**
- Never paste a key into chat, the repo or `.env.example`. Real values live only in your private file `~/Documents/hackathon/.secrets/bundle.env.local`.
- **Never run `npm run db:push`.** On Oct 24 it ignored a "no" and tried to apply its plan. Database changes are applied as reviewed SQL by hand (a person reads the SQL first), only with Lyndsay's OK (step 5).
- Every step that changes Neon or Zetaris needs Lyndsay's explicit yes each time.
- Never hand-write a replay. If Zetaris SQL text changed, re-record live (steps 7 and 8).
- After test or eval runs: `git checkout -- logs output_examples data/sample/zetaris-cache` unless you are regenerating on purpose.

## Steps

1. **Get the latest code.** `git pull`, then `npm ci` (installs the exact library versions). Use Node 24.
2. **Settings file.** In `~/Documents/hackathon/.secrets/bundle.env.local` set the names listed in `.env.example`: `MODEL_PROVIDER=auto`, `NIGHTSHIFT_TOKEN_FILE=<path>`, `MODEL_API_KEY`, `MODEL_REASONING`, `MODEL_FAST`, `MODEL_VISION`, `ZETARIS_BASE_URL`, `ZETARIS_ORG_ID`, `ZETARIS_API_KEY`, `DATABASE_URL`.
3. **Check both AI routes.** `npm run model:check -- --provider nightshift`, then `npm run model:check -- --provider nvidia`. Both should say ok and name the model that answered. Quit Nightshift and rerun the first one: it should say Nightshift isn't running.
4. **Check photo reading.** `npm run model:check -- --vision`.
5. **Database changes (only with Lyndsay's OK).** Read the SQL files in `migrations/` (or make one with `npm run db:generate`, which only writes a file). Show Lyndsay the SQL in plain English. Only after her yes, apply the reviewed SQL by hand (for example by pasting it into Neon's SQL editor). Do not use `db:push`.
6. **Register in Zetaris (needs Lyndsay's yes).** First a dry run: `npx tsx scripts/zetaris/register.ts`. Then
   `npx tsx scripts/zetaris/register.ts --apply --replace=v_offer_verdicts,v_recall_orders,v_clawback_tx,v_offer_audit` plus the two rerouted-read views (take their exact names from the dry run's "will replace" list). The `--replace` flag re-creates only the views you name.
7. **Record saved Zetaris answers.** Turn the AI off for this step (`MODEL_PROVIDER=offline`) so sample-mode traps behave as designed. Run `npm run zetaris:record`, then `npx tsx scripts/zetaris/agents-live.ts`, `npx tsx scripts/zetaris/benefits-live.ts` and `npx tsx scripts/zetaris/court-live.ts`. A "thrift" error usually passes after about 30 seconds; retry. Commit the new files in `data/sample/zetaris-cache/`.
8. **Record the photo answers.** `npm run record-vision`.
9. **9am Monday go/no-go (Boston time).** Decide if Nightshift to Nemotron works. If not, use `MODEL_PROVIDER=nvidia`; the README must then say Nightshift was tried but not used for that run.
10. **Nightshift settings after Meterless's Sunday Oct 25 evening (Pacific) update.** Reopen Nightshift and update it if offered. Meterless announced it would add: pick an exact model instead of automatic swapping, longer timeouts for NVIDIA reasoning models, a switch to turn "thinking" off, and NVIDIA catalog fixes ([Meterless announcement as recorded in `research-nightshift-setup.md`, read Oct 24, 2026](../../research-nightshift-setup.md); meterless.ai could not be reached from the cloud on Oct 25, so these details are unconfirmed until you see them in the app). Then:
    - Run `npm run model:check -- --provider nightshift` and copy the exact Nemotron name it prints.
    - Set `NIGHTSHIFT_REASONING=<that exact Nemotron name>`. This makes it the "deep" model (the one for hard questions).
    - Raise `NIGHTSHIFT_TIMEOUT_SECONDS` above the default 180, for example 300, because the big model is slow.
    - Turn thinking off (the big model otherwise starts some replies by thinking out loud). Use Nightshift's own switch if it has one; otherwise put the field Nightshift names into `NIGHTSHIFT_EXTRA_BODY` as one line of JSON. Do not guess the field name. For NVIDIA direct, `MODEL_THINKING=off` is already the default.
    - Rerun step 3 and step 11.
11. **Smoke test.** `SAMPLE_MODE=true LIVE_MODEL=true npm run dev`, open `http://localhost:5050`, run a sample family. The owner view trace should show which provider and model answered. Camera features work on `localhost` only.
12. **Real-AI scoreboard.** `SAMPLE_MODE=true LIVE_MODEL=true npm run eval:live-model`. Aim: scoreboard `llmMode` says `nightshift:` with a Nemotron name; report the real number if below 6 of 6.
13. **Regenerate examples.** With the AI off for Zetaris recording: `npm run examples:regen -- --live` (asks Zetaris live and refreshes saved answers). Plain `npm run examples:regen` replays saved answers offline.
14. **Keep one real run log.** The app writes `logs/run_bundle_<runId>.jsonl` for each run. Keep one from the live run, commit it with `logs/` and `output_examples/`, and label it as a real-AI run.
15. **Live demo and video, on the Mac only.** The hosted site and the cloud cannot reach Nightshift (it listens at `127.0.0.1:8088`, meaning "this same computer"). Record with Nightshift's window visible once.
16. **Fresh-download check.** In a clean copy with no keys: `SAMPLE_MODE=true npm test` and `SAMPLE_MODE=true npm run eval`.

## Optional: local test database
`npm run db:test` makes a throwaway Postgres on the Mac (Homebrew `postgresql@16`). It never touches Neon.

## If something breaks
- Nightshift misbehaves: `MODEL_PROVIDER=nvidia` (answers are labelled `nvidia-direct:`).
- No keys at all: `SAMPLE_MODE=true` always works offline.
- A changed Zetaris question shows "source unavailable" in sample mode until steps 7 and 13 are redone.

# Nightshift + NVIDIA Nemotron: setup guide and change list

Written Sat Oct 24, 2026 (cloud session). **No code was changed.** No secret values appear here. This builds on `research/research-nightshift.md` (especially its "Oct 24 afternoon update") and on plan v3 item 2 (`bundle-plan-v3.md`).

**Short version:** Nightshift runs on your Mac and becomes the one "address" Bundle sends its AI questions to. You add your NVIDIA key *inside* Nightshift so it can hand the hard questions to NVIDIA's Nemotron models. Bundle then tries, in order: **Nightshift → NVIDIA directly → saved offline text**. The hosted website cannot reach your Mac, so all live-AI runs (and the demo video) happen on your Mac.

---

## 1. What Nightshift is and what it does for us

Nightshift is a free Mac app from Meterless (one of the required hackathon sponsors) that turns your computer into a private "AI switchboard". Bundle sends every AI question to one address on your own Mac (`http://127.0.0.1:8088/v1`; `127.0.0.1` means "this same computer", and `8088` is the "port", like a door number). Nightshift then decides which AI model answers: a small one running on your Mac, or a big cloud model (such as NVIDIA's Nemotron) reached with **your own key**, billed by that cloud company, not by Meterless ([meterless.ai](https://meterless.ai/), read Oct 24, 2026). It speaks the "OpenAI-compatible" format (the same request layout OpenAI uses, which Bundle's code already speaks), so the code change is small. For us it does two jobs: it satisfies the judges' rule "Use Meterless Nightshift as its primary AI provider", and, with Nemotron behind it, the rule "Use NVIDIA technology wherever it contributes", in a single request.

Facts that matter (sources in section 6):
- **Connection rules ("the contract")**, Meterless Runtime 1.4 ([meterless.ai/engines.html](https://meterless.ai/engines.html), read Oct 24): address `http://127.0.0.1:8088/v1`; every request carries a **token** (a password Nightshift generates) that Nightshift writes into a file named `proxy-token` in its settings folder (the placeholder `rt-local` is rejected); two **headers** (labels on every request): `meterless-app: bundle` and, on chat requests, `meterless-scope: user`; wait up to **180 seconds**; "online" check = ask `/v1/models` (200 = online, 401/403 = wrong token).
- **"Model" names are routing modes**, not real models: `meterless/deep` (most capable), `meterless/fast`, `meterless/local` (never leaves the Mac), and class versions like `meterless/text.deep` (engines.html).
- **New since the docs (Meterless pinned announcement, Oct 24):** the Runtime connection and hotspot now work on M1–M4 Macs (yours is an M4, 24 GB); NVIDIA models are visible; cloud routing fixed. **Sunday Oct 25 evening (Pacific):** pick an exact model instead of automatic swapping, longer timeouts for NVIDIA "reasoning" models, a switch to turn "thinking" off, NVIDIA catalog fixes.
- **Not documented anywhere public yet:** the exact menu for adding a cloud key, the exact Mac folder holding `proxy-token`, and whether replies say which real model answered. Steps below tell you how to find out.

---

## 2. Setup on Lyndsay's Mac (step by step)

You already downloaded it. Budget about 30 minutes of clicking plus any model download time.

**A. Install and open**
1. Open your **Downloads** folder in Finder and double-click `Nightshift-Setup-mac-m1.dmg` (a ".dmg" is a Mac installer package).
2. In the window that opens, drag the **Nightshift** icon onto the **Applications** folder icon.
3. Open **Applications**, **right-click** Nightshift and choose **Open**, then **Open** again. (Meterless says this build is "ad-hoc signed, not notarized", meaning Apple hasn't stamped it, so a normal double-click shows a warning. If macOS still blocks it: Apple menu → System Settings → Privacy & Security → scroll down → **Open Anyway**.)
4. If it asks to download models, let it. A full local set was 11.5 GB and took almost 2 hours on slow wifi in Meterless's own test. You can keep working meanwhile.

**B. Sign in / first run**
5. If Nightshift asks you to sign in or make an account, use your normal email. If it offers "local-only" vs "cloud allowed", choose **cloud allowed** (we need it to reach Nemotron). Nothing in the public docs requires a sign-in; if there's none, skip this.

**C. Get your NVIDIA key (you already have one; check it still works)**
6. Go to [build.nvidia.com](https://build.nvidia.com), sign in, click your profile (top right) → **API Keys** (some guides say the "Get API Key" button on a model page is flaky; the settings page works). A key starts with `nvapi-`. If you need a new one, click **Generate API Key** and copy it. (Your current key already sits in your private file as `MODEL_API_KEY`.)

**D. Put the NVIDIA key inside Nightshift (Nemotron "behind" Nightshift)**
7. In Nightshift, look for **Settings** (or a gear icon) → a section named something like **Providers**, **Cloud**, or **Models** → **Add provider** → choose **NVIDIA** (or "OpenAI-compatible" with address `https://integrate.api.nvidia.com/v1`) → paste the `nvapi-` key → Save. *The exact menu names are not published yet; if you can't find it in 5 minutes, ask in HackOS "Help Meterless" (question 1 in section 5) and carry on.*
8. In Nightshift's model list, check that some **Nemotron** models now appear (for example "Nemotron 3 Super" or "Nemotron 3 Ultra"). Take a screenshot; it's good evidence for the README.

**E. Find the token and store it safely (never in the code folder)**
9. Open **Terminal** (press Cmd+Space, type "Terminal", Enter) and paste:
   `find ~/Library ~/.meterless ~/.config -name proxy-token 2>/dev/null`
   It prints where the token file lives (for example something under `~/Library/Application Support/...`). Copy that path.
10. Open your private settings file `parent-benefits/.secrets/bundle.env.local` (this folder is already blocked from GitHub by the `.gitignore` rule `.secrets/`) and add one line:
    `NIGHTSHIFT_TOKEN_FILE=<the path from step 9>`
    Pointing at the file (rather than pasting the token) means it keeps working if Nightshift changes the token. **Never** paste a key or token into the code, `.env.example`, slides, chat, or the video.

**F. Confirm it works (2 quick checks you can paste into Terminal)**
11. "Is it running?": `curl -s http://127.0.0.1:8088/healthz` → any reply means the app is on.
12. "Does my token work, and what models can it reach?":
    `curl -s -H "Authorization: Bearer $(cat '<path from step 9>')" -H "meterless-app: bundle" http://127.0.0.1:8088/v1/models`
    You should see a list including `meterless/deep`, `meterless/fast`, and hopefully Nemotron names. "unauthorized" = wrong token. Paste the list (not the token) to the coder; it decides which model names to use.
13. After the coder's changes (section 3), run `npm run model:check -- --provider nightshift` inside the `bundle` folder. Done when it prints "ok" for both the reasoning and fast tests.
14. **Sunday evening (after Meterless's update):** reopen Nightshift, update if offered, pick Nemotron as the exact model for the "deep" job, raise its timeout, and turn "thinking" off if the option appears. Rerun step 12–13.

---

## 3. How the app should talk to it: ready-to-execute change list (not done yet)

### 3a. How Bundle calls AI today (checked in the code)

- **One adapter** (a translator file between the app and an outside service): `bundle/server/adapters/llm.ts`.
  - Line 27: class `NvidiaGenerator`. Line 40: `new OpenAI({ apiKey, baseURL, timeout: timeoutMs, maxRetries: 0 })` (the official `openai` code library). Lines 48–52: sends `model`, `messages`, `temperature: 0.2`; **no reply-length cap (`max_tokens`), no headers, no "thinking off" setting**, and it ignores the reply's `model` field (which says which model really answered).
  - Lines 94–101: settings read from `MODEL_API_KEY`, `MODEL_BASE_URL` (default `https://integrate.api.nvidia.com/v1`), `MODEL_REASONING`, `MODEL_FAST`; timeout = `SOURCE_TIMEOUT_SECONDS` (default **20 seconds**, a setting meant for data sources, reused here).
  - Lines 104–107: `createGenerator()` returns an "unavailable" generator when the key or model names are missing, so every agent uses its offline text.
  - Lines 119–137 `askJson()`: tries twice for bad JSON, but **line 132 stops immediately on any model failure, including a timeout, so a slow call never gets a retry**.
- **Who calls it:** Fine Print Court (`server/agents/finePrintCourt.ts:77` "fast" debate text, `:103` the Judge's JSON ruling), `explain.ts:28`, `recall.ts:98`, `coach.ts:78`, `scripts/scout.ts:73`. All `askJson` calls use the "reasoning" model.
- **SAMPLE_MODE:** `server/bundleDeps.ts:12-20`: when `SAMPLE_MODE=true` the model is always off unless a script passes `live: true` (`scripts/run-family.ts:18`, `examples:regen --live`). The website server never goes live in sample mode.
- **Settings files:** `server/env.ts:6-26` loads, first wins: `../.secrets/bundle.env.local`, then `bundle/.env.local`, then `bundle/.env`.
- **Checker and scoreboard:** `npm run model:check` = `scripts/check-model.ts` (only picks names containing "nemotron", lines 32–40; NVIDIA default address line 75; 20 s list check line 83; 60 s test calls line 112). `npm run eval:live-model` = `scripts/eval.ts --require-model` (+ `--learning`); labels results `nvidia:<ids>` / `nvidia-partial:<ids>` (lines 28, 94–103) and counts `llmCalls {ok, failed}` (line 80).
- **Hosting:** `render.yaml:13-25` sets `SAMPLE_MODE=true`; model keys optional.

### 3b. New settings (go in `.secrets/bundle.env.local` on the Mac; placeholders only in `.env.example`)

| Setting | Meaning | Default |
|---|---|---|
| `MODEL_PROVIDER` | `auto` (Nightshift, then NVIDIA, then offline), `nightshift`, `nvidia`, or `offline` | `auto` |
| `NIGHTSHIFT_BASE_URL` | Nightshift's address | `http://127.0.0.1:8088/v1` |
| `NIGHTSHIFT_TOKEN_FILE` / `NIGHTSHIFT_TOKEN` | Where to read the token (file preferred) | none |
| `NIGHTSHIFT_REASONING` / `NIGHTSHIFT_FAST` | Model names sent to Nightshift | `meterless/text.deep` / `meterless/text.fast`; after Sunday, the exact Nemotron name from `/v1/models` |
| `NIGHTSHIFT_TIMEOUT_SECONDS` | Hard limit per call | `180` (Meterless's rule) |
| `MODEL_API_KEY`, `MODEL_BASE_URL`, `MODEL_REASONING`, `MODEL_FAST` | Unchanged; now mean "NVIDIA direct" (backup) | as today |
| `MODEL_TIMEOUT_SECONDS` | Hard limit per NVIDIA-direct call (stop borrowing `SOURCE_TIMEOUT_SECONDS`) | `90` |
| `MODEL_MAX_TOKENS` | Reply-length cap, big enough that "thinking" doesn't cut the JSON off | `4096` |
| `MODEL_THINKING` | `off` / `low` / `on` for NVIDIA direct | `off` |
| `RUN_DEADLINE_SECONDS` | Time limit for all AI calls in one family run; after it, remaining steps use offline text and say so | `300` |
| `LIVE_MODEL` | Lets the app on your Mac use real AI while Zetaris still replays saved answers (for the demo) | `false` |

### 3c. Code changes, file by file

1. **`server/adapters/llm.ts`** (main change)
   - Rename `NvidiaGenerator` → `OpenAICompatGenerator` with a `provider: 'nightshift' | 'nvidia'` label and optional `defaultHeaders`. For Nightshift: `defaultHeaders: { 'meterless-app': 'bundle', 'meterless-scope': 'user' }`.
   - Widen `ChatClient` (lines 15–25) to allow `max_tokens`, extra fields (`chat_template_kwargs`), a second "options" argument (`{ signal, timeout }`), and a reply `model` field.
   - **Timeout fix (plan-grade risk 3):** wrap each call in a hard stop for the *whole* call, not just the wait for data: pass `{ signal: AbortSignal.timeout(ms), timeout: ms }` to `create()` and also race it against a timer, so a hung call always ends. (The entity-resolution test saw calls hang past their timeout.)
   - **One retry** inside `generate()` for timeouts, HTTP 429 (too many requests) and 5xx (server errors), after a short random pause (1–3 s); never retry 401/403 (wrong key). Keep the library's own `maxRetries: 0` so retries are counted in one place.
   - Send `max_tokens: MODEL_MAX_TOKENS`. For NVIDIA direct with `MODEL_THINKING=off`, send `chat_template_kwargs: { enable_thinking: false }` (documented for Nemotron 3 Super on NVIDIA's model page; verify on Ultra with model:check). For Nightshift, add the Sunday "thinking off" option once Meterless names it.
   - Record per call: provider, mode sent, `res.model` (who really answered), milliseconds, ok/failed, retried. Stats become `{ ok, failed, retried, byProvider: {...}, answeredBy: Set }`.
   - **New `ChainGenerator`** for the fallback order: try Nightshift; if it can't connect, says 401/403, or doesn't know the model, mark it "down" for the rest of the run (so we don't wait on it 30 times) and use NVIDIA direct; if a call times out after its retry, try NVIDIA direct for that call only; if both fail, throw `ModelUnavailable`, and the agent uses its offline text exactly as today.
   - **Run deadline:** the chain refuses new calls after `RUN_DEADLINE_SECONDS` (throws `ModelUnavailable('run deadline')`), so one run can't take 30 minutes.
   - `generatorConfigFromEnv()` / `createGenerator()` build the chain from `MODEL_PROVIDER`; read the token from `NIGHTSHIFT_TOKEN_FILE` at start-up (never log it). If neither provider is configured → `UnavailableGenerator` (offline), same as today.
   - `askJson()` line 132: only stop early when the reason is "no provider configured" or "run deadline"; a timeout gets the second try.
2. **`server/bundleDeps.ts:18-20`**: `makeGenerator` goes live when `!isSampleMode() || opts.live || process.env.LIVE_MODEL === 'true'`. Zetaris stays on replay in sample mode (line 24 unchanged). Also reset the run deadline per run.
3. **`scripts/check-model.ts`**
   - Add `--provider nightshift|nvidia` (default: whatever `MODEL_PROVIDER` resolves to first).
   - Nightshift branch: read the token file; ask `/v1/models` with the token and `meterless-app` header; 401/403 → print "token is wrong" (not "offline"); connection refused → "Nightshift isn't running; open the app". Print every `meterless/*` mode **and** any `nemotron` names. Pick `meterless/text.deep`/`meterless/deep` and `.fast`, or the exact Nemotron names if listed; test each with a 180 s limit; print which model answered (`res.model`).
   - Update header comments (lines 2, 6), list timeout (line 83, 20 s → 30 s), test timeout (line 112, 60 s → provider's limit). `--write` saves `NIGHTSHIFT_REASONING/FAST` for Nightshift and `MODEL_REASONING/FAST` for NVIDIA.
4. **`scripts/eval.ts`**: follow the rename (lines 19, 39, 80, 91, 98); `LlmMode` (line 28) gains `nightshift:<mode→model>`, `nightshift-partial:...`, `nvidia-direct:...`, `mixed:...`; scoreboard adds `llmCalls: { ok, total, retried, byProvider }` ("AI calls that worked / total", from risk 3); `preflightModel` (line 85) names which provider failed.
5. **Tests** (`server/__tests__/llm.test.ts`, `checkModel.test.ts`, `offlineGuarantee.test.ts`): follow the rename, and add tests with fake clients for: headers sent to Nightshift; hung call is stopped at the limit; one retry then success; 401 does not retry; chain falls Nightshift → NVIDIA → offline; run deadline; `pickModels` finds `meterless/*` modes; label strings. The offline guarantee test must still prove `SAMPLE_MODE=true` never calls out unless `LIVE_MODEL=true`.
6. **Words:** `.env.example:19-26` (new settings, placeholders only), `render.yaml:19-25` (comment: "the host can't reach Nightshift on a Mac; leave empty"), README "AI" section, `metadata.json` `sponsor_tech` (Nightshift under Meterless; Nemotron via Nightshift under NVIDIA), `docs/architecture.md`, deck. Only after a real run, and only claiming what the scoreboard shows.

Effort: about 3–5 hours with tests (a bit more than the earlier 2–4 because of the chain, retry and deadline).

### 3d. Test plan

1. **Cloud/any machine, no keys:** `npm test` (all tests pass, including new ones; was 268 passing per `progress/reviews/cloud-health-check.md`) and `npm run check` (type check). `SAMPLE_MODE=true npm run eval` still gives the saved offline scoreboard unchanged.
2. **Mac, Saturday/Sunday daytime:** `npm run model:check -- --provider nightshift` (expect both tests "ok", model names printed) and `npm run model:check -- --provider nvidia` (proves the backup works). Then stop Nightshift and run `model:check` again: expect "Nightshift isn't running", and the chain test shows NVIDIA answering.
3. **Mac, Sunday evening smoke test (risk 3):** one family, live AI: `npx tsx scripts/run-family.ts maya` (note: this script also calls live Zetaris, so the Zetaris keys must be in the private file; with `LIVE_MODEL` built, starting the app with `SAMPLE_MODE=true LIVE_MODEL=true npm run dev` and running Maya in the browser is the replay-Zetaris alternative). Check the trace: each AI step shows provider + real model, no call over its limit, total run under `RUN_DEADLINE_SECONDS`.
4. **Mac, Monday morning, the one real run:** `npm run eval:live-model`. Done when the scoreboard's `llmMode` reads `nightshift:...` with a Nemotron name (or says honestly which provider answered), `llmCalls` shows worked/total, and run-1/run-2 learning traces are saved. Commit those logs. If below 6 of 6, report the real number.

---

## 4. Can the cloud app (or Render hosting) reach Nightshift on her Mac?

**No, not in any safe, supported way.** `127.0.0.1` only works on the Mac itself. Nightshift's "hotspot mode" can share to other devices **on the same home wifi** (example address `http://192.168.1.20:8088/v1`; meterless.ai and engines.html, read Oct 24), but Render's servers and this cloud machine are not on your wifi. Meterless's docs don't mention internet access. A "tunnel" (a tool like Cloudflare Tunnel or ngrok that gives your Mac a public web address) could technically work, but it puts your AI token on the open internet, depends on your Mac staying awake, and isn't documented by Meterless. **Not recommended.**

**Demo setup:**
- **Live AI = your Mac only.** Run the app on your Mac with `SAMPLE_MODE=true LIVE_MODEL=true` (saved Zetaris answers + real AI through Nightshift → Nemotron). Record the video there, with Nightshift's window visible once.
- **Judges' default = offline replay.** The hosted site (if used) and a fresh download from GitHub stay on `SAMPLE_MODE=true`, which replays the saved results, including the **saved traces from your real Nightshift run** labeled `nightshift:...`. The README says this plainly: "Live AI runs through Meterless Nightshift on the author's Mac; the saved traces in `logs/` came from that run; anyone with Nightshift (or an NVIDIA key) can rerun with `npm run eval:live-model`."
- **Backup if Nightshift misbehaves on Monday:** NVIDIA direct (`MODEL_PROVIDER=nvidia`) still gives real Nemotron answers, labeled `nvidia-direct:...`, and the README says Nightshift was attempted but not used for that run. (Plan v3's rule: decide by Monday 9am Boston.)

---

## 5. Open questions and decisions

**Ask in HackOS "Help Meterless" (copy-paste):**
1. "On an M4 Mac with the M1+ build, where do I add my NVIDIA key so cloud Nemotron routes through Nightshift? What's the menu path?"
2. "After Sunday's update, what model name do I send to pin Nemotron 3 Super/Ultra exactly (e.g. a `nvidia/...` id or a `meterless/...` id)? And what's the setting or request field for 'thinking off' and the longer timeout?"
3. "Does the chat reply's `model` field show the real model that answered? We want our logs to prove Nemotron answered via Nightshift."
4. "Where is `proxy-token` on macOS (the `<stateDir>` folder)?"
5. "Does the free M1+ build count as 'Meterless Nightshift as primary AI provider' for judging?"

**Ask NVIDIA (HackOS NVIDIA channel / Resources):**
6. "Are hackathon credits attached to our build.nvidia.com key, and what's the rate limit (requests per minute)? Public sources say about 40 per minute and that the old credits system may have ended."
7. "Is `chat_template_kwargs: {enable_thinking: false}` supported on `nvidia/nemotron-3-ultra-550b-a55b` as well as Super?"

**Decisions for Lyndsay:**
- **A. Which Nemotron for the Judge:** Super (`nvidia/nemotron-3-super-120b-a12b`, faster) or Ultra (`nvidia/nemotron-3-ultra-550b-a55b`, smarter but slower). *Recommendation: Super for the Judge with thinking off; Ultra only if Super's rulings look weak.* Fast steps: Nemotron 3.5 Lightning (`nvidia/nemotron-3.5-lightning-30b-a3b`).
- **B. Keep NVIDIA direct as a backup?** *Recommendation: yes* (it's already built; small extra code). Say in the README which provider produced the saved run.
- **C. Hosted site at all?** Plan v3 says local only. *Recommendation: stay local;* the GitHub repo + offline replay + video is enough.
- **D. Go/no-go deadline** for Nightshift → Nemotron: Monday 9am Boston (plan v3). Confirm.

---

## 6. Sources (read Sat Oct 24, 2026 unless noted)

- Meterless engines page, Runtime 1.4 contract (address, token, headers, modes, 180 s, LAN connect links): https://meterless.ai/engines.html
- "Add Meterless as a provider" (Runtime 0.90.0): https://github.com/Meterless/Meterless/blob/main/docs/agent-ready/add-meterless-provider.md
- Nightshift hotspot doc: https://github.com/Meterless/Meterless/blob/main/docs/products/nightshift/hotspot.md
- Meterless home (bring-your-own cloud key, local-network address example, Nemotron list): https://meterless.ai/ ; Mac page (M1+ free, "cloud providers are optional"): https://meterless.ai/mac.html ; models: https://meterless.ai/models.html
- Meterless pinned hackathon announcement, Oct 24, 2026 (screenshot from Lyndsay, summarized in `research/research-nightshift.md`).
- NVIDIA hosted model list, page updated Oct 23, 2026 (base `https://integrate.api.nvidia.com`, `POST /v1/chat/completions`, Nemotron ids above): https://docs.api.nvidia.com/nim/reference/llm-apis
- Nemotron 3 Super model page, updated Aug 6, 2026 (`chat_template_kwargs` → `enable_thinking: False`, `low_effort`): https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-super-120b-a12b
- NVIDIA key and OpenAI-compatible endpoint (community docs): https://docs.openclaw.ai/providers/nvidia/index.html ; Ultra how-to: https://pasqualepillitteri.it/en/news/4298/how-to-try-nemotron-3-ultra
- Rate limits / credits (unofficial, conflicting): https://forums.developer.nvidia.com/t/request-for-nvidia-nim-api-rate-limit-increase-40-200-rpm/375340 ; https://github.com/steipete/CodexBar/issues/2498 ; https://dev.to/lorenzojkrl/stop-paying-20month-use-nvidia-build-80-free-ai-models-17ih
- Nemotron 3.5 Lightning (released Aug 11, 2026): https://openrouter.ai/nvidia/nemotron-3.5-lightning
- Local: `research/research-nightshift.md`, `bundle-plan-v3.md` item 2, `plans/plan-grade-future-state.md` risk 3, `research/entity-resolution-test.md` §3, `plans/architecture.md` §7d, and the Bundle code cited in 3a.
- A web search for "Meterless Nightshift NVIDIA Nemotron" found nothing beyond Meterless's own pages.

**Unconfirmed:** cloud-key menu path; `proxy-token` folder on macOS; how to pin an exact model and turn thinking off in Nightshift (due Sunday); whether replies name the real model; NVIDIA credit amount and rate limit; `enable_thinking` on Ultra.

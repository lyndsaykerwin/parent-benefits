# Nightshift research: making it Bundle's main AI provider

Researched Sat Oct 24, 2026. No code was changed. No secret values are printed here.

## 5-line summary

1. **Nightshift** is Meterless's app that turns your own computer into a private "AI hotspot": other apps send their AI questions to it, at the address `http://127.0.0.1:8088/v1`, using the same request format as OpenAI. Free for your Mac (M1 to M4) and in a browser.
2. **The catch for your Mac (an M4 with 24 GB):** only the paid M5+ Mac version is a full hotspot. Your Mac gets the free **M1+ edition**, which gives "a local endpoint" running **small models only (1 to 4 billion "parameters", a rough measure of a model's size)**, such as Llama 3.2 3B. None of those small models is NVIDIA's.
3. **Code change is small:** Bundle already uses the OpenAI-style format through one file (`server/adapters/llm.ts`). It needs a new address, a token read from a file Nightshift writes, two extra "headers" (labels attached to each request), model names like `meterless/deep`, and a longer wait time (180 seconds). About 11 files touch it; about 2 to 4 hours of work with tests.
4. **NVIDIA can still honestly count**, mainly by using NVIDIA embeddings (a tool that turns text into numbers so similar meanings can be found) to make the Meterless memory smarter, and/or keeping Nemotron as a named second "brain" for the hardest step. Whether Nemotron can be reached *through* Nightshift on your Mac is **unconfirmed**.
5. **Meterless engines:** Bundle uses **H-MEM** (memory) in a real feature: the Fine Print Court recalls rules learned from parent feedback. That meets the "at least one engine" rule today.

**Biggest blocker:** the judges' Resource Center "Participant Setup Guide" needs sign-in, so I could not read it. Ask in the HackOS "Help Meterless" channel: (a) does the free M1+ edition count as "primary AI provider", and (b) can it reach Nemotron?

---

## 1. What Nightshift is

**In one sentence:** Nightshift is a program from Meterless (a hackathon sponsor) that makes one computer act as a private AI server for all your apps by day, and works on queued jobs overnight while you sleep. ([Meterless GitHub README](https://github.com/Meterless/Meterless), last commit Oct 19, 2026; [meterless.ai](https://meterless.ai/), read Oct 24, 2026)

- **"Meterless Runtime"** is the engine inside Nightshift. It is the part that answers your app's requests. Older notes in this folder (research/learning-brief/learning-brief.md) called it "Runtime"; it ships *inside* Nightshift.
- **"OpenAI-compatible"** means it accepts requests in the same format OpenAI's service uses. Most AI code (including Bundle's) already speaks that format, so you change the address and key rather than rewriting code. Confirmed: "Nightshift exposes the Meterless Runtime as an OpenAI-compatible provider." ([hotspot.md](https://github.com/Meterless/Meterless/blob/main/docs/products/nightshift/hotspot.md), read Oct 24, 2026)

### Editions (versions for different computers)

Source: [editions.md](https://github.com/Meterless/Meterless/blob/main/docs/products/nightshift/editions.md) and [meterless.ai](https://meterless.ai/), both read Oct 24, 2026.

| Edition | Runs on | Full hotspot for your apps? | Price |
|---|---|---|---|
| Web | Your browser | **No** | Free |
| Windows 1.2.x | Windows PC with a separate graphics card | Yes | "See the Windows page" |
| Mac M5+ | M5-or-newer Mac, 16 GB+ | Yes | $199 one-time preorder, delivery Q4 2026 (site also offers "free this week" insider access until Oct 28, **for M5 Macs only**) |
| **Mac M1+ (yours)** | Any Apple Silicon Mac (M1 to M4) | **"A local endpoint"** | **Free** |
| DGX Spark | NVIDIA's desktop AI computer | Yes | On request |

**Your Mac:** Apple M4, 24 GB memory, macOS 26.5 (checked on this machine). So you get the **free M1+ edition**. Nightshift is **not installed yet**, and nothing is answering on port 8088.

### What the M1+ edition actually does

From Meterless's own test report ([Mac M1 to M4 benchmark](https://github.com/Meterless/Meterless/blob/main/docs/benchmarks/mac-m1-m4.md) and [full results](https://meterless.ai/Benchmarks/MAC/M1-M4/BENCHMARK_RESULTS.md), measured Oct 14 to 15, 2026):

- Runs **8 small models on the Mac's graphics chip**: Llama 3.2 1B and 3B, Qwen 2.5 1.5B / 3B / Coder 3B, SmolLM2 1.7B, Gemma 2 2B, Phi 3.5 Mini. Best quality: Llama 3.2 3B (32 of 34 test questions right).
- Has a **local OpenAI-style endpoint at `127.0.0.1:8088`** with `/v1/models` (list of available "models") and `/healthz` (an "am I running?" check).
- Has a **"cloud relay"** (passes requests on to models hosted on the internet) with 50 relay models, named like `meterless-proxy/llama-3.1-8b`. Which company hosts them, and whether a key is needed, is **not stated**.
- First download: 8 models, **11.5 GB**, took 1 hour 52 minutes on a slow connection.
- Weak spots Meterless lists: measured on an M5 (newer than the Macs it's for), "a development build: ad-hoc signed, not notarized" (meaning macOS may warn it's from an unidentified developer).
- Download: `Nightshift-Setup-mac-m1.dmg`, **17.7 MB**, from `https://meterless.ai/Nightshift/M1+/`, updated Oct 23, 2026 (checked file headers only; nothing was downloaded). The models download later, inside the app.

### Models in the full catalog

The [model library](https://meterless.ai/models.html) (read Oct 24, 2026) lists about 235 models. NVIDIA ones:

| Model | Runs where |
|---|---|
| Nemotron 3.5 Lightning | Local or cloud |
| Nemotron 3 Nano 30B-A3B | Local (too big for the M1+ edition's 1–4B limit) |
| Nemotron 3 Super | Cloud |
| Nemotron 3 Ultra | Cloud |

The page does **not** say which company serves the cloud ones or how to add a key. **Unconfirmed:** whether the M1+ edition on your Mac can reach any Nemotron model.

### How an app connects (the "contract")

From [add-meterless-provider.md](https://github.com/Meterless/Meterless/blob/main/docs/agent-ready/add-meterless-provider.md) (Meterless Runtime 0.90.0, read Oct 24, 2026):

| Setting | Value |
|---|---|
| Address | `http://127.0.0.1:8088/v1` |
| Key ("token") | Real, even on your own computer. Nightshift writes it into a file called `proxy-token` in its settings folder. The placeholder `rt-local` shown on the website is **rejected**. |
| Extra labels on every request | `meterless-app: bundle` (identifies your app) and `meterless-scope: user` on chat requests |
| "Model" names | Not real model names but **routing modes** (instructions for which kind of model to pick): `meterless/auto`, `meterless/fast` (quickest), `meterless/deep` (most capable), `meterless/cheap`, `meterless/local` (never leaves the machine), `meterless/fusion` (combines models) |
| Status check | Ask `/v1/models`: answer 200 = online; 401/403 = wrong token |
| Wait time | **180 seconds**, because loading a model can take minutes |

Done when: a wrong token shows "unauthorized", and a plain text request to `meterless/auto` returns text.

### Cost and limits

- Local models: no per-use charge ("not metered"). Cloud models you add are billed by that cloud company to your own key. ([meterless.ai](https://meterless.ai/))
- No usage caps or rate limits (limits on requests per minute) are published.
- **Speed warning from Meterless itself:** "When someone is waiting, rent latency from the cloud." On their big machine, median wait was 36.8 seconds. ([hotspot.md](https://github.com/Meterless/Meterless/blob/main/docs/products/nightshift/hotspot.md)) On your Mac the small models answer in under a second to start, but loading a model takes 14 to 23 seconds.

---

## 2. Setup steps (for you, on your Mac)

1. Ask in HackOS **Help Meterless**: "On an M4 Mac, is the free M1+ edition enough to count as 'Meterless Nightshift as primary AI provider'? Can it route to Nemotron?" (Do this first; it decides step 6.)
2. Download `Nightshift-Setup-mac-m1.dmg` (17.7 MB) from meterless.ai/Nightshift/M1+/ and install it. macOS may warn it's unsigned; that's expected per Meterless's notes. *(Downloading is your call; I didn't download it.)*
3. Open it and let it download its small models (about 11.5 GB; allow up to 2 hours on slow wifi).
4. Find the token file `proxy-token` in Nightshift's settings folder and paste the token into `../.secrets/bundle.env.local` (your private settings file, outside the code folder). Never into the code.
5. Have the coder make the changes in section 3, then run the model check script and the live scoreboard.
6. If Meterless confirms a way to reach Nemotron through Nightshift, set the "deep" step to that; otherwise use section 4's NVIDIA options.

**Important limit:** the hosted demo site (on Render, a web hosting service) cannot reach `127.0.0.1` on your Mac. `127.0.0.1` means "this same computer". The live-AI runs must happen on your Mac; the hosted site keeps replaying the saved results (it already runs in offline `SAMPLE_MODE`). Say this plainly in the README.

---

## 3. Required code changes (file : line list)

Bundle sends all AI requests through **one adapter** (a small file that translates between the app and an outside service): `bundle/server/adapters/llm.ts`. It already uses the official `openai` code library, so the format is right. What needs to change:

### Must change

| File : line | What's there now | What to change |
|---|---|---|
| `server/adapters/llm.ts:27` | Class named `NvidiaGenerator` | Rename to something neutral (e.g. `OpenAICompatGenerator`), or add a `NightshiftGenerator`. Many files refer to this name (below). |
| `server/adapters/llm.ts:38` and `:100` | 20-second wait (`timeoutMs`, from `SOURCE_TIMEOUT_SECONDS`) | 180 seconds for Nightshift (Meterless's rule) |
| `server/adapters/llm.ts:40` | `new OpenAI({ apiKey, baseURL, ... })` | Also send `defaultHeaders: { 'meterless-app': 'bundle', 'meterless-scope': 'user' }` |
| `server/adapters/llm.ts:48-52` | Sends `model: this.models[model]` | Works as-is once the model settings are `meterless/deep` and `meterless/fast`. Also save the reply's real `model` field so the traces show which model actually answered. |
| `server/adapters/llm.ts:94-101` | Reads `MODEL_API_KEY`, `MODEL_BASE_URL` (default `https://integrate.api.nvidia.com/v1`, line 97), `MODEL_REASONING`, `MODEL_FAST` | Default address becomes `http://127.0.0.1:8088/v1`; optionally read the token straight from Nightshift's `proxy-token` file |
| `server/adapters/llm.ts:105-107` | Refuses to run without a key and both model names | Keep; defaults could become `meterless/deep` / `meterless/fast` |
| `scripts/check-model.ts:2, 6` | Comments say "NVIDIA-hosted Nemotron" | Update wording |
| `scripts/check-model.ts:25-39` (`pickModels`) | Only picks models whose names contain "nemotron" | Nightshift's list returns `meterless/*` modes, so this would find nothing and stop with an error. Add a branch: if the list has `meterless/*` ids, pick `meterless/deep` and `meterless/fast`. |
| `scripts/check-model.ts:75` | Default address = NVIDIA | Nightshift address |
| `scripts/check-model.ts:83` | Asks `/models` with only the key | Also send the `meterless-app` label; treat 401/403 as "wrong token", not "offline" |
| `scripts/check-model.ts:112` | 60-second test wait | 180 seconds |
| `scripts/eval.ts:28, 94-103` | Scoreboard label `nvidia:<ids>` / `nvidia-partial:<ids>` | Add `nightshift:<mode → routed model>` so the scoreboard honestly says Nightshift answered |
| `scripts/eval.ts:19, 39, 80, 85, 90, 99` | `instanceof NvidiaGenerator`, "NVIDIA model" wording | Follow the rename |
| `.env.example:19-24` | "AI model (NVIDIA-hosted)", NVIDIA address | Nightshift address, token instructions, `meterless/deep` / `meterless/fast` |
| `../.secrets/bundle.env.local` (private file) | `MODEL_BASE_URL` = NVIDIA address; `MODEL_REASONING`/`MODEL_FAST` = two Nemotron models | Switch to Nightshift values (keep the NVIDIA key line for section 4) |
| `render.yaml:20-25` | Model settings for the hosted site | Leave empty (the host can't reach your Mac); add a comment saying so |

### Tests to update (they check the old names)

- `server/__tests__/llm.test.ts:1, 47-73` (uses `NvidiaGenerator`)
- `server/__tests__/checkModel.test.ts:6, 11-46, 67-108` (Nemotron model lists, `nvidia:` labels)
- `server/__tests__/offlineGuarantee.test.ts:6, 68, 75, 77`

### Words to update (README, deck, metadata)

- `README.md:4, 45` ("NVIDIA-hosted models ... not exercised")
- `README.md:79-89` ("When you have an NVIDIA key" section)
- `README.md:191` ("Every saved run here is offline")
- `README.md:236` (NVIDIA sponsor line)
- `metadata.json:25` (`sponsor_tech.nvidia`); add a Nightshift line under `sponsor_tech.meterless` (line 24)
- `docs/architecture.md:63` and the deck (`presentation/deck/bundle-deck.html`, `presentation/deck/outline.md`) mention NVIDIA as the AI.

### Not changing

- The saved offline fallback answers (deterministic text in `server/agents/benefits.ts:49, 94`, `finePrintCourt.ts:41-82`, `coach.ts:59-61`, `recall.ts:73-101`) keep working whatever the provider. They kick in whenever Nightshift isn't running.
- `server/bundleDeps.ts:19` already picks "offline" in `SAMPLE_MODE` and calls `createGenerator()` otherwise; no change needed.

**Effort estimate:** 2 to 4 hours of coding plus tests, then a live run. **Quality risk:** a 3-billion-parameter local model is much weaker than Nemotron Ultra. The Fine Print Court and Coach ask for strict JSON answers; small models may fail more often and fall back to offline text. Measure it; report what's real.

---

## 4. Where NVIDIA can still honestly contribute

The rule now says: "Use NVIDIA technology wherever it contributes." You already have a working NVIDIA key (`MODEL_API_KEY` in your private file) set up for build.nvidia.com.

| Option | What it is, in plain English | Honest? | Effort |
|---|---|---|---|
| **A. Nemotron through Nightshift** | Nightshift's catalog lists Nemotron 3.5 Lightning, 3 Super, 3 Ultra. If the M1+ edition can relay to them, set `meterless/deep` (or a named relay model) to Nemotron. Then *both* sponsors are used in one request. | Best, **if it works. Unconfirmed** on M1+. | 30 min once Meterless confirms how |
| **B. NVIDIA embeddings for the Meterless memory** | H-MEM currently uses a fake "hash" embedder (vendored file `vendor/hmem/src/embeddings.ts:1` calls itself a "deterministic mock"). Bundle even lowered the match cut-off to work around it (`server/adapters/memory.ts:44-47`). Swapping in an NVIDIA embedding model (e.g. `nvidia/llama-3.2-nv-embedqa-1b-v2` on build.nvidia.com) makes "recall the right learned rule" genuinely better. Real job, visible in traces. | Yes, and a strong story: "NVIDIA powers the memory's understanding." | 2–4 hours (call NVIDIA's embeddings address, cache results, keep the hash version as offline fallback, test) |
| **C. Nemotron as named second brain** | Keep Nightshift as primary for most steps; send only the Judge's final ruling (the hardest step) to Nemotron Ultra directly. | Yes, as long as Nightshift handles most calls and the README says which step uses which. Check it doesn't contradict "primary". | 1–2 hours (two generators, one setting per agent) |
| **D. NeMo Guardrails** | NVIDIA's open-source safety checker that screens AI inputs/outputs against rules. | Possible but it's a Python tool; Bundle is TypeScript. Overkill now. | 1 day+; **not recommended** |
| **E. NVIDIA safety model** (e.g. a Nemotron "guard" model on build.nvidia.com) checking card text before it shows | One extra call per card. | Honest but low value vs. B. | 2–3 hours |

**Recommendation:** Ask Meterless about A. Build B regardless (it improves the one engine judges will look at). Add C only if Nightshift's small models make the Court unreliable.

---

## 5. Meterless engine compliance

**Rule:** "Implement at least one Meterless Engine (H-MEM, Markovian, World Model, or Scout Intent) in a working feature."

**Status: met, with H-MEM.**

- H-MEM is vendored (copied in unchanged, Apache-2.0 open-source licence) at `bundle/vendor/hmem/` (files: memory store, retrieval, conflict detection, sleep cycle, trust ledger). Credited in `LICENSE:30` and `metadata.json:24`.
- Wrapped by `bundle/server/adapters/memory.ts` (`addRule`, `recallRules`, `feedback`).
- **Write:** a reviewer approves a proposed rule → `server/routes/bundleRoutes.ts:219` stores it in H-MEM (also `scripts/eval.ts:150` in the learning demo).
- **Read ("stored ≠ loaded" test passed):** `server/agents/finePrintCourt.ts:87` recalls matching rules before every ruling, logs `rule_recalled`, and the Judge must cite rule ids. The saved learning demo shows run 2 blocking the auto-renew trial and citing `mem-1`.
- **Not used:** Markovian, World Model, Scout Intent. Not required.
- **Small gaps to tighten (optional):** H-MEM's `feedback()` (raises/lowers a rule's confidence) exists in the adapter but no parent tap calls it; wiring "I got this"/"Report issue" to it would show the confidence part working. The embedder is a mock (see option B). Vendored H-MEM has only a smoke test (`vendor/hmem/test/smoke.test.ts`), not the full conformance test from Meterless's engine spec.
- **Nightshift is separate:** using Nightshift as AI provider does *not* replace the engine rule. You need both, and Bundle will have both after section 3.

---

## 6. Risks

| Risk | Why it matters | What to do |
|---|---|---|
| Setup guide is behind sign-in | The judges point to it for setup; I couldn't read it ([hackathon.genai.works/resources](https://hackathon.genai.works/resources) shows a sign-in page, Oct 24, 2026). It may say something different (e.g. a hosted Nightshift address or hackathon keys). | You (signed in) read the Participant Setup Guide's Meterless section before coding starts. |
| M1+ edition is "a local endpoint", not the full hotspot | Judges may expect the hotspot. | Ask Help Meterless; cite their own editions table. |
| Small local models are weaker | More JSON failures → more offline fallback → lower live scores. | Report honestly; use option C for the Judge if needed. |
| Hosted site can't reach your Mac | Judges clicking the live site won't hit Nightshift. | Saved traces from your Mac show `nightshift:...`; demo video shows it live. |
| Time | 3 days left; 11.5 GB model download, new code, reruns of scoreboard and learning demo, README/deck rewrite. | Start the download today. |
| Unsigned Mac app | macOS warnings; it's a development build. | Expected per Meterless; open via right-click → Open. |
| Unknown cloud-relay billing | If you add a cloud key, that company bills you. | Stay local unless needed. |
| Rules say "Cursor is optional" now | Your metadata already says Cursor wasn't used; that's fine. | No action. |

---

## 7. Sources (all read Sat Oct 24, 2026 unless noted)

- Judges' rules reminder (quoted in the task, posted Oct 24, 2026).
- Meterless GitHub README: https://github.com/Meterless/Meterless (last commit Oct 19, 2026)
- Nightshift hotspot doc: https://github.com/Meterless/Meterless/blob/main/docs/products/nightshift/hotspot.md
- "Add Meterless as a provider" contract, Runtime 0.90.0: https://github.com/Meterless/Meterless/blob/main/docs/agent-ready/add-meterless-provider.md
- Nightshift editions and hardware: https://github.com/Meterless/Meterless/blob/main/docs/products/nightshift/editions.md
- How Nightshift works: https://github.com/Meterless/Meterless/blob/main/docs/products/nightshift/how-it-works.md
- Mac M1 to M4 benchmark (measured Oct 14–15, 2026): https://github.com/Meterless/Meterless/blob/main/docs/benchmarks/mac-m1-m4.md and https://meterless.ai/Benchmarks/MAC/M1-M4/BENCHMARK_RESULTS.md
- Meterless home page (editions, pricing, Nemotron list): https://meterless.ai/
- Model library: https://meterless.ai/models.html
- Mac page: https://www.meterless.ai/mac.html
- Mac M1+ download (header check only, file dated Oct 23, 2026): https://meterless.ai/Nightshift/M1+/
- Resource Center (sign-in required, not read): https://hackathon.genai.works/resources
- Local: `research/learning-brief/learning-brief.md` §A, `meterless-sponsor-overview.md`, `setup/meterless-engines/meterless-agent-engines-index.md:53`, `hackathon-resources/hackathon-checklist.md:139`, `bundle-plan-v3.md`, and the Bundle code listed above.
- A general web search for "Meterless Nightshift" found no news or posts beyond Meterless's own pages (Oct 24, 2026).

### Unconfirmed items

- Whether the free M1+ edition counts as "primary AI provider" for judging.
- Whether Nightshift on an M4 Mac can reach any Nemotron model (local or cloud relay), and which company hosts the cloud relay.
- Whether the M1+ local endpoint uses the same `proxy-token` file and folder as the full hotspot (the M1+ report doesn't mention a token).
- What the Participant Setup Guide says.

---

## Oct 24 afternoon update (replaces earlier points where they conflict)

**New source:** Meterless (Sam Cummings) pinned an announcement in the hackathon chat on Oct 24. It is newer than the GitHub docs and the website, which haven't caught up yet. It says:
- The Runtime API (the "talk to Nightshift" connection) and the AI hotspot now work on M1–M4 Macs.
- NVIDIA models are now visible in supported builds.
- Cloud model discovery and routing are fixed.
- Planned for Sunday evening, Oct 25 (Pacific time): exact model selection instead of automatic swapping, longer timeouts you can set for NVIDIA reasoning models, controls to turn off "thinking", and NVIDIA catalog fixes.

**Lyndsay's Mac (checked):** Apple M4 with 24 GB of memory. Nightshift is not installed yet.

**What changes from the earlier sections:**
- The "M1+ is only a small local endpoint" limit in section 1 is out of date. Per the announcement, an M4 now gets the real Runtime API. The written docs (GitHub editions.md, meterless.ai/mac.html) still describe the old limits.
- The best setup is: the app → Nightshift (primary provider) → Nemotron. Per meterless.ai/models.html, Nemotron 3 Super and 3 Ultra are cloud models, and Nemotron 3.5 Lightning is local or cloud. Per meterless.ai, cloud models are added with your own key and billed by that provider, so Lyndsay's NVIDIA key would most likely be added inside Nightshift. That meets both rules: Nightshift is primary, and NVIDIA contributes.
- The connection details are confirmed on meterless.ai/engines.html (Runtime 1.4):
  - base address `http://127.0.0.1:8088/v1`
  - `Authorization: Bearer <token from proxy-token>`; `rt-local` is rejected
  - headers `meterless-app` (every request) and `meterless-scope: user` (chat)
  - model ids are routing modes such as `meterless/auto`, `meterless/deep`, `meterless/text.deep`
  - a 180-second timeout
- Our AI Judge failures look like timeouts. The Oct 25 configurable timeouts and exact model selection target exactly this.
- The model explorer on meterless.ai/models.html only shows which models *fit in memory*. Its 24 GB example is a MacBook Air. It doesn't promise a given edition runs them.

**Still unconfirmed:** which local model sizes the M1–M4 build runs today, and whether "NVIDIA models visible" means cloud Nemotron through her own key. Install, then check `GET /v1/models`.

Sources: Meterless pinned hackathon announcement (Oct 24, 2026, screenshot from Lyndsay); https://meterless.ai/engines.html, https://meterless.ai/models.html, https://meterless.ai/mac.html (read Oct 24); https://github.com/Meterless/Meterless docs (read Oct 24).

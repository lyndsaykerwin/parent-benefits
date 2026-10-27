# Letting outside people test Bundle from their phones (Oct 26, 2026)

Research only. No code was changed, nothing was deployed and no accounts were created.
Goal: people who are not Lyndsay, on their own phones and not on her Mac, can use Bundle in **real mode**: real AI through NVIDIA, the Neon database, Zetaris, Tavily web search and Meterless memory. Judges may also need a link.

## Short answer

- **Recommended:** put the app on **Render**, using the **Starter** size (about **$7 a month**, charged only for the days it runs). It stays awake all the time, gives a private `https://bundle-xxxx.onrender.com` link that works on any phone, and needs no code change to start.
- **Before strangers use it**, add one small code change: a **tester access code**, meaning one shared password typed once on the first screen. Without it, anyone who finds the link can spend the NVIDIA and Tavily allowances. The existing `REVIEWER_MODE_TOKEN` does not do this job (see section 3).
- **Fallback for today only:** a free **Cloudflare quick tunnel** (a tunnel is a temporary public web address that points at the app running on Lyndsay's Mac). It works in minutes but stops whenever the Mac sleeps or the app stops, so it is not suitable as a judges' link.

---

## 1. What already exists in the code

| Item | What is there | Will it work on a host? |
|---|---|---|
| `bundle/render.yaml` | A Render "Blueprint" (a recipe file Render reads to set up the service). Plan `starter`. Build `npm ci --include=dev && npm run build`, start `npm start`. Sets `NODE_ENV=production`, **`SAMPLE_MODE=true`**, `TRUST_PROXY=1`, `NODE_VERSION=24`, and asks for `MODEL_API_KEY`, `MODEL_REASONING`, `MODEL_FAST` in the dashboard. | **Needs fixing.** (a) Render only reads `render.yaml` from the **top folder of the GitHub repo**, but this one sits in `bundle/`. (b) It has no `rootDir: bundle` line, so Render would look for `package.json` in the wrong folder. (c) It turns on practice mode. It is simpler to skip the Blueprint and create the web service by hand with **Root Directory = `bundle`** (see section 5). |
| Dockerfile | None. Not needed: Render, Railway and Fly can all build a Node app directly. | n/a |
| Production start | `npm run build` (Vite builds the screens and esbuild packs the server into `dist/index.js`), then `npm start`, which runs `node dist/index.js`. The server listens on `process.env.PORT` (default 5050) on all addresses, which is what hosts expect. | Works. |
| Settings (env vars) | `server/env.ts` reads `../.secrets/bundle.env.local`, then `.env.local`, then `.env`. Missing files are skipped, and **settings typed into the host dashboard always win**. Key **names** in the local secrets file: `DATABASE_URL`, `GOOGLE_APPLICATION_CREDENTIALS`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `FIREBASE_STORAGE_BUCKET`, `ZETARIS_BASE_URL`, `ZETARIS_ORG_ID`, `ZETARIS_API_KEY`, `MODEL_API_KEY`, `MODEL_BASE_URL`, `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`, `MODEL_REASONING`, `MODEL_FAST`, `NIGHTSHIFT_TOKEN_FILE`, `REVIEWER_MODE_TOKEN`, `TAVILY_API_KEY`. | Works. The host has no secrets file, so every needed key goes in the host dashboard. |
| CORS (the rule that says which other websites may call the app's server) | `server/index.ts`: during development only localhost; in production only the address in `FRONTEND_URL`. | Fine. The phone loads the screens and the server from the **same address**, so this rule does not block it. Set `FRONTEND_URL` to the Render address anyway. |
| Logins, cookies | No login and no cookies. Each family gets a random id like `guest-1a2b3c4d`, kept in the phone browser's own storage (`localStorage`). | Works. Each phone keeps its own family (see section 3). |
| Photo uploads | `<input type="file" accept="image/*" capture="environment">` (ScanSheet) opens the phone's back camera. `client/src/lib/photoPrep.ts` shrinks each photo on the phone to at most 1600 px, re-saves it as JPEG and removes hidden location data before upload. Server limit 5 MB, 30 photos per 15 minutes per connection. | Works on phones. |
| Rate limits (caps on how often one connection can call) | Whole API: 500 requests per 15 min per address. Bundle runs: 10 per 15 min. Photos: 30 per 15 min. Deal searches: 30 per 10 min. Deal checks: 10 per 15 min. Feedback: 30 per 15 min. | These cap one person, not the total. Ten testers can still use 10× as much. See section 3. |
| **Meterless "Nightshift"** (the AI gateway running on the Mac at `127.0.0.1:8088`) | `server/adapters/llm.ts` tries Nightshift first, then NVIDIA directly. | **Not reachable from a host.** It only exists on Lyndsay's Mac. Set `MODEL_PROVIDER=nvidia` on the host and leave out `NIGHTSHIFT_TOKEN_FILE`. Real AI then goes straight to NVIDIA. |
| **Meterless memory (H-MEM)** | Copied into the app (`vendor/hmem`) and saved as files in `bundle/data/hmem/` (7.3 MB on the Mac). | **Runs on the host but starts empty**, because `data/hmem/` is not in GitHub. The lessons Bundle has already learned on the Mac will not be there. Render's disk is also wiped on each redeploy or restart, so new lessons are lost then. Fixes: a Render **persistent disk** (about $0.25 per GB per month, paid sizes only), or saving a clean starting copy of the memory to GitHub. |
| Zetaris saved answers | `data/sample/zetaris-cache/` is only written by the deliberate `npm run zetaris:record` script and only read in practice mode. | Fine. Real mode calls Zetaris over the internet. |
| Run logs | `server/agents/trace.ts` adds lines to files under `bundle/logs/`. | Works, but they disappear on restart. The reviewer agent-log view reads them, so old runs vanish after a redeploy. |
| `GOOGLE_APPLICATION_CREDENTIALS`, `VITE_FIREBASE_*`, `FIREBASE_STORAGE_BUCKET`, `PLAID_*` | **Nothing** in `server/`, `shared/` or `client/src` uses these. | Leave them out of the host. `GOOGLE_APPLICATION_CREDENTIALS` is a path to a file on the Mac and would not work there anyway. |
| Active runs | Kept in the server's working memory (`bundleRoutes.ts`). | Fine with one server, which is the setup recommended here. |

## 2. Hosting options and current prices

| Option | Price | Asleep when idle? | Notes |
|---|---|---|---|
| **Render Starter** (recommended) | **$7/month** for 512 MB memory and half a processor, charged only for the time it runs. The Hobby workspace plan itself is $0. | **No**, always on. | Since Aug 1, 2026 the free Hobby workspace includes only **5 GB of outgoing data a month** across all services, then $0.15 per GB. That is plenty for a few dozen testers. Sources: [J.A. Watte, Render mid-2026 review (updated Aug 6, 2026)](https://jwatte.com/blog/render-com-platform-review.md), [Render pricing articles 2026](https://livemy.app/blog/render-pricing). Confirm the price on render.com/pricing at checkout. |
| Render Free | $0 | **Yes.** Sleeps after 15 minutes with no visitors and takes **about 1 minute** to wake. 750 free hours a month. Disk wiped on every sleep. | A judge's first visit would show about a minute of blank screen. Not recommended. [render.com/docs/free](https://render.com/docs/free) |
| Railway | Hobby **$5/month**, which includes $5 of usage. A 512 MB app always on costs roughly $5–10/month (memory about $10 per GB per month, processor about $20 per processor per month, billed by the second). Free trial: $5 credit for 30 days. | No | Equally good, but has no ready-made recipe file in this repo. [railway.com/pricing](https://railway.com/pricing) |
| Fly.io | shared-cpu-1x: **$3.69/month** at 512 MB, **$6.70/month** at 1 GB. No free allowance: the trial is only 2 hours of running time or 7 days. A card is needed after that. | Can be set to stay on | Cheapest, but it is set up from a command-line tool and needs a Fly settings file. More moving parts for a non-coder on the last day. [docs.fly.io/about/pricing](https://docs.fly.io/about/pricing) |
| Cloudflare quick tunnel (fallback) | Free, no account | Works only while the Mac is awake and the app is running | One command (`cloudflared tunnel --url http://localhost:5050`) gives a random `https://….trycloudflare.com` link. The address changes every time. Bonus: because the app runs on the Mac, **real Meterless Nightshift works too**. Good for a same-day friends test; bad as a judges' link. |
| ngrok free (fallback) | Free, needs an account | Same as above | Visitors first see an ngrok **warning page** they must click through. Limits: 20,000 requests and 1 GB a month. [ngrok free plan limits](https://ngrok.com/docs/pricing-limits/free-plan-limits) |

**Recommendation: Render Starter.** It is always on, has HTTPS (the padlock), is cheap, deploys again by itself whenever code is pushed to GitHub, and the repo already half-supports it. Expected cost: about **$7 for a month**, plus $0.25 a month if a 1 GB disk is added for memory. Cancel after judging. Render charges by the day, so a week costs about $2.

### What Lyndsay must do herself vs. what an agent can do

**Lyndsay (these are account, payment and permission steps, which an agent must not do):**
1. Sign up at render.com. Choose "Sign in with GitHub" as `lyndsaykerwin`.
2. When GitHub asks, **allow Render to see the private repo `parent-benefits`**. ("Only select repositories" → parent-benefits is enough.)
3. Add a payment card. Starter is a paid size.
4. Paste the secret values into Render's **Environment** page. The agent gives her the exact list of names. She copies each value from her own secrets file, so no agent ever prints or uploads a secret.
5. Optional: pick the tester access code and send the link to testers herself.

**An agent can:** fix `render.yaml` or write the click-by-click settings; add the tester access code (with tests); add a "use made-up details only" note on the first screen; pick the right environment list; push the code to GitHub after she approves; then check the live link at phone width and run one full real-mode test.

## 3. Safety for strangers in real mode with no login

**Spending caps**
- **NVIDIA** (build.nvidia.com free key): no dollar charges. The limit is about **40 requests per minute**, shared across all models and all testers ([pasqualepillitteri.it 2026 guide](https://pasqualepillitteri.it/en/news/1621/nvidia-build-free-api-100-ai-models-2026), [NVIDIA developer forum](https://forums.developer.nvidia.com/t/is-nim-free/369368)). NVIDIA's terms describe the free tier as being for trying things out, not production. **Risk:** one Bundle run makes several AI calls, so 3–5 testers running at once may hit the limit. The app then falls back to its "AI unavailable" message instead of crashing (`askJson` fallback). Tell testers to expect it to be slower if many people use it at once.
- **Tavily** (web search): **1,000 free credits a month**, no card. A basic search costs 1 credit and an advanced search 2. Credits reset on the 1st of the month ([docs.tavily.com API credits](https://docs.tavily.com/guides/api-credits)). The app runs **one shared search per day for everyone** (`offerRoutes.ts` live-search cache) and starts it when the server starts, so normal use is small. Each restart or redeploy costs one more search.
- **Zetaris and Neon:** check each dashboard's free-plan limit once. Bundle sends few, small queries.

**Abuse and rate limits**
- The per-connection limits in section 1 are already on, and `TRUST_PROXY=1` makes them see each phone's real address.
- **There is no overall gate on the app.** Add a **tester access code**: a setting called something like `TESTER_ACCESS_CODE`. The first screen asks for it once and the phone remembers it. Every `/api` call without it gets a polite "ask Lyndsay for the code" message. About 30 lines of code plus tests, size S. Do not put the code inside the link itself.

**What `REVIEWER_MODE_TOKEN` actually does** (from `server/routes/bundleRoutes.ts`, `agentLogRoutes.ts`, `client/src/pages/Smarter.tsx`): it is a **reviewer code, not an entry gate**. Without it, parents see the normal screens. With it (typed on the "Smarter" page and remembered only until the browser tab closes), the owner or judge can see the full agent log, the audit log and the scoreboard, and **approve a learned rule**. It is checked safely (`tokenOk`, a constant-time comparison). Give it to judges, not to general testers.

**Keeping people's data separate**
- Each phone gets its own random `guest-xxxxxxxx` family id and only ever asks for that id. One tester does not see another's family, gear or photos.
- It is not a real login: the id is 8 random characters, and clearing the browser loses that family. That is fine for testing.
- **Learned lessons are shared by design.** A rule learned from one tester's feedback can affect everyone's results, but only after someone with the reviewer code approves it.
- **Tell testers: made-up details only.** No real names, addresses, ZIP codes they care about, or real receipts. Use the sample photos in `bundle/data/sample/photos/`, or cover the card number on a receipt. The screens already say this ("cover or fold away your card number"), but say it in the invite too.

**Keys that must go in the Render dashboard (names only):**
`NODE_ENV=production`, `SAMPLE_MODE=false`, `MODEL_PROVIDER=nvidia`, `MODEL_API_KEY`, `MODEL_BASE_URL`, `MODEL_REASONING`, `MODEL_FAST`, `DATABASE_URL`, `ZETARIS_BASE_URL`, `ZETARIS_ORG_ID`, `ZETARIS_API_KEY`, `TAVILY_API_KEY`, `REVIEWER_MODE_TOKEN` (use a **new** value, not the Mac one), `TRUST_PROXY=1`, `NODE_VERSION=24`, `FRONTEND_URL=https://<your-render-address>`, plus `TESTER_ACCESS_CODE` once that change is built.
Leave out: `GOOGLE_APPLICATION_CREDENTIALS`, all `VITE_FIREBASE_*`, `FIREBASE_STORAGE_BUCKET`, `PLAID_*`, `NIGHTSHIFT_TOKEN_FILE`.

## 4. Phone readiness

- **Layout:** the screens are built for phones first, in a column at most 480 px wide, with the standard phone viewport setting in `client/index.html`. Earlier 375 px (iPhone-width) checks exist: `progress/reviews/2026-10-25-chip-375*.png`, `design/v2/screens/mobile-375-onboarding.png`, `mobile-375-switch-family.png`.
- **Not re-checked live today:** `http://localhost:5050` was **not running** (no answer) when this was written. Per the brief, the server was not started, so no new 375 px screenshot was taken. Do the live phone check on the Render link after deploying.
- **Camera:** the photo button uses the phone's built-in camera picker, not live in-page video. That picker works on iPhone and Android **even without HTTPS**. HTTPS is still needed for everything else (and Render gives it automatically). iPhone HEIC photos are accepted and turned into JPEG on the phone before upload.
- **First-visit speed:** on Render Starter there is no wake-up delay. Each Bundle run takes as long as NVIDIA does: about 13 seconds for live search, and AI runs can take up to 90 seconds per call.

## 5. Deployment checklist

| # | Step | Who | Size | Risk |
|---|---|---|---|---|
| 1 | Add the tester access code and a "use made-up details" line on the first screen, with tests. Commit to `main` and push. | Agent (Lyndsay says go) | S | Low. Keep it off in practice mode and in tests. |
| 2 | Either move a fixed `render.yaml` to the repo's top folder with `rootDir: bundle` and `SAMPLE_MODE=false`, **or** skip the Blueprint and use step 4. | Agent | S | Render ignores a `render.yaml` that sits in `bundle/`. |
| 3 | Make a Render account with GitHub, allow access to `parent-benefits`, add a card. | **Lyndsay** | S | Choose the paid Starter size, not Free (Free sleeps). |
| 4 | New → Web Service → `parent-benefits`, branch `main`, **Root Directory `bundle`**, Build `npm ci --include=dev && npm run build`, Start `npm start`, size Starter. | Lyndsay clicks, following the agent's sheet | S | Getting Root Directory wrong is the most likely build failure. |
| 5 | Paste the environment keys from section 3. Use a new `REVIEWER_MODE_TOKEN` and set `FRONTEND_URL` after the address exists. | **Lyndsay** | S | A typo in `MODEL_REASONING`/`MODEL_FAST` silently means "AI unavailable". Check the Render log for `[llm]` warnings. |
| 6 | Optional: add a 1 GB disk mounted at `/opt/render/project/src/bundle/data/hmem` so learned lessons survive restarts, and/or seed a clean starting memory. | Lyndsay clicks; agent prepares the seed | M | Without it, memory starts empty and resets on every deploy, which weakens the "learns from feedback" demo. |
| 7 | Smoke test (a first quick check that the basics work) on a real phone over mobile data: open the link, enter the code, run a sample family, take a photo, open Deals, give feedback, then check the reviewer view. | Agent at 375 px, then Lyndsay on her phone | M | NVIDIA's 40-per-minute limit, and Zetaris or Neon blocking requests from outside addresses (check whether either has an allowed-address list). |
| 8 | Send testers the link, the access code and a "made-up details only" note. Send judges the link and the reviewer code. | **Lyndsay** | S | The link spreads beyond testers: change the access code if needed. |
| 9 | After judging, suspend or delete the Render service. | **Lyndsay** | S | Billing continues until she does. |

**Overall size: M** (about half a day including the access code and the phone test).

**Top risks**
1. NVIDIA free-tier throttling when several testers run at once (slow, or an "AI unavailable" message).
2. No entry gate until the tester access code is built: anyone with the link can use up the free allowances.
3. Meterless runs differently on the host. Nightshift is not available there, and H-MEM memory starts empty and is wiped on redeploy unless a disk is added. Be honest about this in the submission: say "Meterless memory runs inside the app; the Nightshift gateway is used when running on the Mac."
4. `render.yaml` sits in the wrong place and sets practice mode, so following it as-is would deploy in practice mode or fail to build.
5. Testers typing real personal details. Mitigate with the on-screen note, the invite wording and the sample photos.

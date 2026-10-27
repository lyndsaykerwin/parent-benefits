# Putting Bundle online with Render (so testers can use it on their phones)

Written Oct 26, 2026. You already have a Render account. This takes about 20 minutes.

**What you end up with:** a link like `https://bundle-xxxx.onrender.com`. Anyone with the link **and** the tester code can use Bundle on their phone, in real mode (real AI, the Neon database, Zetaris, web search and Meterless memory).

**Words used below**
- **Render**: the company that runs the app on its computers so it is online all the time.
- **Blueprint**: a recipe file in the project (`render.yaml`, at the top of the repo) that tells Render how to set the app up, so you don't type the settings by hand.
- **Environment variable** (Render calls them "Environment"): a named setting, such as a key or password, that the app reads when it starts. You paste values into Render's website; they are never stored in the code.
- **Repo**: the project's folder on GitHub (`lyndsaykerwin/parent-benefits`).
- **Deploy**: Render copies the latest code from GitHub, builds it and starts it.

**Before you start:** the new code (tester gate and `render.yaml`) must be on GitHub's `main` branch. Ask Claude to commit and push it first. Render can only see what is on GitHub.

---

## Step 1. Let Render see the private repo

1. Go to **dashboard.render.com** and sign in.
2. Top right: click your account picture, then **Account Settings**. Find **GitHub** (under "Git Deployment" or "Connected accounts").
3. If `parent-benefits` is not listed, click **Configure GitHub** (or **Connect GitHub**). GitHub opens.
4. Under **Repository access**, choose **Only select repositories**, pick **parent-benefits**, and click **Save**.

## Step 2. Create the app from the Blueprint

1. On the Render dashboard, click **+ New** (top right), then **Blueprint**.
2. Pick the repo **lyndsaykerwin/parent-benefits**. Branch: **main**.
3. Blueprint name: type `bundle`. Render finds `render.yaml` by itself.
4. Render shows what it will create: one **web service called `bundle`**, size **Starter** (shown as 0.5 CPU / 512 MB, about **$7 a month**, charged by the day), and a **1 GB disk called `hmem`** (about $0.25 a month; it keeps what Bundle has learned when the app restarts).
5. Render then shows a box for each secret it needs. Fill them in using Step 3. **Do not click Apply until every box is filled.**

> If Render asks for a payment card, add it. The Starter size is paid; the free size falls asleep and takes about a minute to wake up.

## Step 3. Paste the secret settings

Open your secrets file on your Mac: **Finder > Go > Go to Folder…** and paste `~/Documents/hackathon/.secrets/`, then open **bundle.env.local** with TextEdit. Each line looks like `NAME=value`. Copy **only the part after the `=`** (without quote marks, if there are any) into the matching Render box.

| Render box | Where the value comes from |
|---|---|
| `DATABASE_URL` | Line 3 of `bundle.env.local` |
| `ZETARIS_BASE_URL` | Line 16 |
| `ZETARIS_ORG_ID` | Line 17 |
| `ZETARIS_API_KEY` | Line 18 |
| `MODEL_API_KEY` | Line 19 (your NVIDIA key, starts with `nvapi-`) |
| `MODEL_BASE_URL` | Line 20 |
| `MODEL_REASONING` | Line 24 |
| `MODEL_FAST` | Line 25 |
| `TAVILY_API_KEY` | Line 31 |
| `REVIEWER_MODE_TOKEN` | **Make up a NEW one**, don't reuse line 29. Any long phrase, e.g. three random words and a number. This is the code you give judges to see the agent log. |
| `TESTER_ACCESS_CODE` | **Make up the tester code** (see Step 4). |

(Line numbers are as of Oct 26. If they've moved, look for the name at the start of the line.)

**Do not add** these, the app doesn't use them online: `GOOGLE_APPLICATION_CREDENTIALS`, anything starting `VITE_FIREBASE_`, `FIREBASE_STORAGE_BUCKET`, anything starting `PLAID_`, `NIGHTSHIFT_TOKEN_FILE`.

These are already filled in by the Blueprint, so you won't see boxes for them: `NODE_ENV=production`, `NODE_VERSION=24`, `SAMPLE_MODE=false` (real mode), `MODEL_PROVIDER=nvidia`, `TRUST_PROXY=1`.

Then click **Apply**. The first build takes about 3 to 5 minutes.

## Step 4. Pick a tester code

- Short and easy to read out loud, for example `blue-otter-42`. Not a password you use anywhere else.
- Everyone types it once on their phone; the phone then remembers it for 30 days.
- If too many wrong codes are typed from one connection, that connection must wait 15 minutes.
- To change it later (for example, the link spread too far): Render > **bundle** > **Environment** > edit `TESTER_ACCESS_CODE` > **Save, rebuild and deploy**. Everyone then has to type the new code.

## Step 5. Check it works

1. In Render, open **bundle**. Wait until the top shows **Live** (green).
2. Copy the link under the name (`https://bundle-xxxx.onrender.com`).
3. On your phone, open the link. You should see **"Welcome, tester"**, the pink note **"Please use made-up details only — this is a test app."**, and one box. Type the tester code and tap **Start testing**.
4. Answer the five questions with made-up details and check that results appear (about 15 to 60 seconds).
5. If something looks wrong: Render > **bundle** > **Logs**. Lines with `[llm]` mean an AI setting is off (most often a typo in `MODEL_REASONING` or `MODEL_FAST`). You can ask Claude to read the log with you.

## Step 6. What to send testers

Copy, change the two bits in brackets, and send:

> Hi! Could you try Bundle, an app I built that finds money and deals for new parents? It works best on your phone.
> Link: [your Render link]
> Tester code: [your tester code]
> **Please use made-up details only — this is a test app.** Don't enter your real name, address or card numbers. If you take a photo of a receipt, cover the card number.
> Any feedback is welcome, just reply to this message.

For **judges**, send the same link and tester code, plus the reviewer code (`REVIEWER_MODE_TOKEN`) so they can open the agent log on the "Smarter" page.

## Good to know

- **New versions go live by themselves.** Each time code is pushed to GitHub's `main`, Render rebuilds and restarts the app (a few seconds offline while it swaps over).
- **Memory:** Bundle's learned lessons start empty online (your Mac's memory isn't copied). The 1 GB disk keeps new lessons through restarts.
- **AI route:** online, the AI goes straight to NVIDIA. The Meterless "Nightshift" gateway only runs on your Mac.
- **Limits:** NVIDIA's free key allows about 40 AI requests a minute shared by everyone, so many testers at once may be slow.
- **After judging:** Render > **bundle** > **Settings** > scroll down > **Suspend** (or **Delete**) so billing stops. Also delete the disk if you delete the service.

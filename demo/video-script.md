# Bundle demo video: plan and script (target 3:30, hard cap 4:00)

Record Monday Oct 26 with QuickTime. This script was rehearsed step by step against the real app on Oct 23 (see `demo/rehearsal-notes.md`). Button labels and numbers below are the exact words and figures on screen in the offline recording setup (section 2).

Plain-English terms used in this file:
- **Terminal**: the black window where you type commands.
- **SAMPLE_MODE**: a setting that lets the app run with no passwords or keys, using made-up families.
- **Trace**: the app's step-by-step diary of what every agent did (one line per step).
- **Zetaris**: the sponsor tool that lets the agents ask one question across several data sources at once.
- **Meterless memory (H-MEM)**: the sponsor tool that stores the rules the app learns from parents.
- **Court (Fine Print Court)**: the part of the app that argues over each deal and approves or blocks it.

Honest-wording rule (important, judges read the README too). In this recording:
- Zetaris answers are **saved real answers**, replayed (the screen says "saved real response"). Never say "live" about Zetaris.
- The AI model is switched off, so the court is a **plain rule screen**. The screen says so itself: "Court was offline" and "Offline screen: no flagged terms found. Not reviewed by the AI court." Never say "the AI court decided" or "the AI wrote this rule". Say "the rule-based screen" and "the mechanism".
- The memory rule is one of two pre-written sentences; what is real is the loop (parents report, a reviewer approves, memory stores it, the next run cites it).
- Your own feed screen will not show agents "working": offline, the whole run finishes in about a third of a second, so the "Live activity" list is gone before you can see it. Do not promise it on camera (see segment 2).

---

## 1. Timed table (3:30 final, about 3:55 raw before trimming)

Phone-sized browser window the whole time (see section 2). Speak slowly. Pauses are fine; they get trimmed. Spoken words total about 410, which is 2:45 to 3:05 at a calm pace; the rest is clicking and pauses.

| Time (raw) | Segment | On screen | Say (exact words) | Click-by-click |
|---|---|---|---|---|
| 0:00-0:20 | Problem | Onboarding: "Let's find what your family is owed." / "Three answers. About 30 seconds. No sign-up." | "Meet Maya. She just had a baby. She's owed money, benefits and safety alerts, but they're scattered across a dozen websites. And some 'free' baby offers hide a paid membership in the fine print. Bundle is our entry for Track 1, Solving Fragmented Intelligence." | Nothing yet. Let the screen sit. |
| 0:20-0:40 | Team of agents | Same onboarding screen while you talk, then the feed appears. | "Bundle is a team of agents, not one chat. One finds money to claw back. One checks recalls. One plans deadlines. A Fine Print Court argues over every deal. And a Fact-Checker can send work back, or throw a card out, before a parent sees it." | Say all of it on the onboarding screen. On the last words tap **Try as guest** ("Explore a sample family. No sign-up."). The feed appears almost at once (no waiting screen offline). |
| 0:40-1:10 | Main workflow: the feed | Feed titled "Baby Maya · day 20". Receipt: **$48.99** money back, **$3,640** in benefits you likely qualify for, **3 deadlines** (next in 10 days), **7 items safety-checked**, **1 recall**. Pinned card: "Add your baby to health insurance", "10 days left". | "Here's Maya's Bundle Receipt. Forty-nine dollars she can claim back, and thirty-six hundred in benefits she likely qualifies for. Likely, not guaranteed: Bundle prepares, you decide. Pinned at the top: add the baby to health insurance. Ten days left, and nobody told her." | Pause on the Receipt 3 sec. Scroll down slowly once past the section headings **Money back**, **Safety check**, **Benefits**, **Deals that passed Fine Print Court** (these are the four agents' work), then scroll back to the top. |
| 1:10-1:35 | Every card shows its work | Pinned card's detail page: "How we checked" with the steps "Benefits Planner found it: Passed (No amount, by 2026-11-02)" and "Fact-Checker re-checked the source: Passed (Amount, dates and source all match the official data)", then Sources. | "Every card shows how it was checked: each step the agents took, and the official source. Here the Fact-Checker re-checked the date against the source and passed it. The 'backup used' tags are honest: the AI writer is switched off in this recording, so a fixed template wrote the sentence." | On the pinned card tap **How we checked**. Pause on the two Passed steps, then the Sources line (healthcare.gov). Tap **Your feed** (top left) to go back. |
| 1:35-2:10 | Zetaris, shown in the app | Recall card "Recall alert: KEAWIS Crib Mattress", then its section **DATA SOURCES CHECKED (VIA ZETARIS)** listing "Your purchases (private, Neon)" and "CPSC recall list (live government feed)", with "3 queries across 2 sources · saved real response". | "Now the crib mattress recall. This section says which data sources were checked, through Zetaris. Two sources: Maya's private purchase list, and the federal recall list. One query joins them. That's how Bundle knew her KEAWIS mattress is on the recall list. These are saved real answers from Zetaris, which is how this runs with no keys." | In the feed, in **Safety check**, tap **How we checked** on the recall card. Scroll to **Data sources checked (via Zetaris)**. Tap **Show query** (text under it: "Values are hidden for privacy." then the SQL: first line `SELECT DISTINCT item_text, source FROM ... bundle_pg.v_recall_orders ...`, second `SELECT RecallID FROM bundle_live.cpsc_recalls ...`). Pause 3 sec. Tap **Your feed**. |
| 2:10-2:55 | Fine Print Court + learning, run 1 | Deals: "Free newborn diaper box" with the line "Offline screen: no flagged terms found. Not reviewed by the AI court." Near the bottom: **We caught these for you** with a badge "1" (open it: "Free baby registry welcome box: The fine print says a paid membership (Prime, membership or subscription) is required"). Then the diaper box detail, **Report issue**. | "Now the trap. This free diaper box looks fine, and our plain-rule court approves it. It does not catch a free trial that turns into a thirty-dollar-a-month membership. Down here, 'We caught these for you' shows what the court did block, with the rule it cited. The AI court is offline in this recording, so this is the rule-based screen. Maya and a second parent report the diaper box." | Scroll to the bottom of the feed and tap **We caught these for you** to open the list; pause 3 sec on the one blocked offer and its reason. Tap **See how we checked** on it if time allows (Judge step: "Blocked. Rejected. Court was offline; the fine print says a paid membership ... is required"), then **Your feed**. Scroll to **Deals that passed Fine Print Court**, tap **How we checked** on **Free newborn diaper box**. Tap **Report issue**; in **What went wrong?** type: `free box turned into a paid monthly membership`; tap **Send report** (message: "Thanks. Reports like yours teach Bundle..."). Tap **Your feed**, reopen the same card, report the same note again (cut this second round in editing). |
| 2:55-3:15 | Meterless: the rule | **Bundle got smarter** page. Under **Waiting for review**: "Proposed CL-01 / Reject offers whose free trial turns into a paid membership that renews automatically. / From 2 parent reports / 70% confident". After approval, under **Rules Bundle follows now**: "Case law CL-01 ... From 2 parent reports · approved by a reviewer / 70% confident". | "Two reports on the same problem make the Coach propose a rule. A reviewer approves it, and it's saved into Meterless memory as case law." | At the bottom of the feed tap **Bundle got smarter**. Pause on **Waiting for review** (it sits under an empty "Rules Bundle follows now" line, which is expected). Scroll to the bottom, tap **Reviewer mode** to open it, type the reviewer code in the box "Reviewer code" (it shows dots), tap **Turn on**. Scroll up, tap **Approve rule**. The rule moves up into **Rules Bundle follows now**. |
| 3:15-3:45 | Run 2: it learned | Fresh Maya feed. Receipt unchanged ($48.99, $3,640). **Deals** no longer has the diaper box. **We caught these for you** now shows "2": the diaper box ("A rule parents taught us applies: Reject offers whose free trial turns into a paid membership that renews automatically.") with a **MEMORY (METERLESS H-MEM)** block: "mem-1 / confidence 70% / learned from 2 parent reports / cited by the Judge". | "Run two, same family. The diaper box is gone. It's under 'We caught these for you', and the Memory section shows the rule from Meterless: remembered from two parent reports, seventy percent confident, cited by the judge. Nobody changed the code. The parents taught it." | Tap the "bundle." logo at the top left (this goes home; **Your feed** on the Smarter page would take you back to the OLD feed). Tap **Try as guest** again. Scroll the **Deals** section: the box is missing. Scroll to the bottom, tap **We caught these for you**. Pause on the Memory block. Optional: tap **See how we checked** on the diaper box: the Judge step says "Blocked ... [cited mem-1]" and the Memory section repeats. Say once: "CL-01 on the rules page, mem-1 in the trace: same rule." |
| 3:45-3:55 | Impact and close | Feed top (Receipt). | "Bundle finds, checks and prepares what new parents are owed, shows its work, and gets smarter from every parent who speaks up. Built with Claude Code, Zetaris and Meterless memory." | Tap **Your feed** or scroll to the Receipt. Stop recording 2 sec after you finish talking. |
| optional, +10 sec | Receipts: the raw trace | Browser tab 2 or 3 on `/api/runs/<run id>/trace`, text highlighted by Find. | "For the receipts: the raw trace. These lines are the actual Zetaris queries, and these are the memory lines, mem-1." | Only if you are under 3:30 after trimming. Run 1 tab: Cmd+F, type `query_cached` (24 matches, each line ends "(sample cache)"). Run 2 tab: Cmd+F, type `mem-1` (about 2 matches: the memory recall line and the judge line). Then back to tab 1. Skip if the video is running long. |

Raw length is about 3:55 (about 4:05 with the optional receipts moment). Trim to about 3:30 in editing (section 5). Keep the final under 4:00.

Cut-line options if you run long: shorten segment 1:10 to 15 seconds; drop the optional receipts moment; skip the second report in the live take (say "two parents report it", see Backup B).

---

## 2. Pre-recording checklist

Do this about 30 minutes before. Open Terminal (the black window).

**Step 1: go to the project folder**
```bash
cd /Users/lyndsay/Documents/hackathon/bundle
```
If a server from earlier is still running, press Control+C in its window first.

**Step 2: make the settings file (first time only)**
```bash
cp .env.example .env
```
Then open `.env` in a text editor (TextEdit is fine) and make sure these lines read exactly:
```
SAMPLE_MODE=true
PORT=5050
REVIEWER_MODE_TOKEN=demo
```
Leave `ZETARIS_*` and `MODEL_API_KEY` empty. Close the file and TextEdit. **Never show `.env` on camera.**

**Offline is guaranteed.** With `SAMPLE_MODE=true` the app never calls Zetaris or the model and never changes the saved answer files, even though your Mac has real keys in a private file (`hackathon/.secrets/bundle.env.local`). You do not need to blank any keys.

**Step 3: install (only if `node_modules` is missing) and start**
```bash
npm ci
```
(Skip this if the folder `node_modules` already exists; it was already installed during rehearsal. Needs Node 24 or newer: `node -v` should say v24 or higher.) Then start the server, as one single line:
```bash
SAMPLE_MODE=true PORT=5050 npm run dev
```
Wait for the line "serving on port 5050". Leave this window open but hide it before recording.

How to be sure it is offline: tap **Try as guest**; the feed should appear in about a second. If it shows a waiting screen for more than 3 seconds, you are live: stop, press Control+C, and rerun the line above exactly. Also, a recall card's "Data sources checked (via Zetaris)" must say "saved real response", not milliseconds.

**Step 4: start clean for learning.** Follow section 3 (Reset) now and after every take. On a fresh machine state the diaper box is approved and **We caught these for you** shows "1" (the registry welcome box).

**Step 5: browser setup (Chrome)**
1. Open a new Chrome window with **no other tabs, no bookmarks bar** (View > Always Show Bookmarks Bar off), and **use a Guest profile** (click profile icon > Guest) so no personal tabs or autofill appear.
2. Go to `http://localhost:5050`.
3. Easiest: drag the Chrome window edge until it is about 375px wide and about 800px tall, page zoom 100%. (Alternative: Option+Command+I, click the phone icon, choose Responsive, set 375 x 812, and dock DevTools to a separate window.) Compare with the screens in `bundle/docs/screens/` (use 03, 05, 10, 11, 12).
4. Tab 1 is the app. Trace tabs (optional receipts moment) are made in Step 7.
5. Click the address bar once and make sure no suggestion list shows personal URLs.

**Step 6: clean desktop**
- Turn on Do Not Disturb (Control Center > Focus > Do Not Disturb). Quit Mail, Slack, Messages, calendar.
- Hide the Dock if you can (System Settings > Desktop & Dock > Automatically hide the Dock).
- Close Terminal, the text editor and Cursor/Claude windows before recording, or put them on another Space (Control+Up arrow). Nothing with keys, `.env`, or environment settings may appear on screen at any point.
- The reviewer code `demo` is a demo word, not a real secret, and it types into a password-style box (dots), but still do not read it aloud.
- The detail pages show clock times next to each step (for example "7:15:55 PM"). That is your Mac's clock; fine, just be aware.

**Step 7: pre-stage the trace tabs (only for the optional receipts moment)**
The trace is the raw diary at `/api/runs/<run id>/trace`. The run id is the last part of the feed's address (`/feed/<run id>`). In a browser it shows as one very long line of text; use Cmd+F to find things.
1. Do a practice run through the whole flow once (Try as guest, report twice, approve, Try as guest again).
2. In a new tab open `http://localhost:5050/api/runs/<run 1 id>/trace` and confirm Cmd+F finds `query_cached` (24 matches) and `recall_match`.
3. In another tab open the run 2 trace and confirm Cmd+F finds `mem-1` (about 2 matches).
4. Those ids die with the reset. Offline runs are instant, so during the real recording just open the trace tab right after each run: copy the run id from the address bar, open a new tab, paste `http://localhost:5050/api/runs/<id>/trace`. Or skip the receipts moment (recommended if you are tight on time).

Do a full dry run once end to end with a stopwatch before pressing record. The app itself never makes you wait; only your talking and typing take time.

**Step 8: QuickTime**
- Open QuickTime Player > File > New Screen Recording. Click "Options": Microphone = your Mac mic (or headset), "Show Mouse Clicks in Recording" ON. Pick **Record Selected Portion** and drag a box around the phone-width browser window plus some padding (or full screen if you prefer a 16:9 look; a sliver of narrow video on a wide frame is normal, so consider putting the narrow window in the middle of a plain desktop).
- Do a 10-second test, play it back, check that your voice is audible and no notification appears.
- Check text is readable at 1080p.

---

## 3. Reset: back to a clean state for a second take

Use this before every take (and after any rehearsal). It uses only commands from the README. Reason it is needed: the learned rule is stored in the folder `data/hmem`. Restarting the server alone does NOT remove it (tested): the app would still block the diaper box from the very first run, and the "Rules Bundle follows now" list would look empty even though the rule is still working. The proposals and feedback live only in the running app's memory, so a restart clears those.

1. In the server window press Control+C (the server stops).
2. Run, in the `bundle` folder:
```bash
rm -rf data/hmem
SAMPLE_MODE=true PORT=5050 npm run dev
```
(`rm -rf data/hmem` deletes only the folder of learned rules. It is fine if the folder does not exist.)
3. Wait for "serving on port 5050". Reload the browser at `http://localhost:5050`.
4. Check it is clean: open `http://localhost:5050/api/case-law`. It must show `{"proposals":[],"approved":[]}`. In a fresh Maya feed the **Free newborn diaper box** card is in **Deals**, and **We caught these for you** shows "1".
5. Old browser tabs from the last take (feed addresses, trace tabs) stop making sense; close them and make new ones.
6. Housekeeping (optional): check nothing changed in the saved answers: in Terminal run `git status`. If it lists files under `data/sample/zetaris-cache/`, run `git checkout -- data/sample/zetaris-cache` and then `git clean -f data/sample/zetaris-cache`.

---

## 4. Where judges see Zetaris and Meterless doing real work

**Zetaris (the data door).** Show it in the app, not just the trace:
- On any card, **How we checked** now ends with a section **Data sources checked (via Zetaris)**: which sources, how many queries, and "saved real response" in this recording. **Show query** reveals the question the agents asked (values replaced by `?` for privacy).
- Best card: **Recall alert: KEAWIS Crib Mattress**. It lists two sources, "Your purchases (private, Neon)" and "CPSC recall list (live government feed)", "3 queries across 2 sources". The first query line joins `bundle_pg.v_recall_orders` (the private purchases) and the second reads `bundle_live.cpsc_recalls` (the federal list). That is the README section 13 trick: private data and a government feed through one door.
- All agent data goes through Zetaris (`server/adapters/zetaris.ts`); agents never call the database or recall sites directly.
- Honest wording: the label "(live government feed)" names the kind of source. In this recording the answer is a saved real response (the screen says so). Say "saved real answers".
- Optional receipts: the run trace has 24 Zetaris lines, each `query_cached` with "(sample cache)".

**Meterless (memory).** Show it in the app:
- **Bundle got smarter** page: "Waiting for review" ("Proposed CL-01", "From 2 parent reports", "70% confident"), then after approval "Rules Bundle follows now" ("Case law CL-01").
- Run 2: **We caught these for you** lists the diaper box with a **MEMORY (METERLESS H-MEM)** block: "mem-1 / confidence 70% / learned from 2 parent reports / cited by the Judge". The detail page repeats it and the Judge step reads "Blocked ... [cited mem-1]".
- Names: the rules page says **CL-01**; the memory block and the trace say **mem-1**. Same rule. Say it once.
- Honest wording: offline, the rule text is one of two pre-written sentences and the court is a plain rule screen ("Court was offline"). Say "the mechanism", not "the AI wrote it". Saved real example files: `output_examples/learning/run2.jsonl` (judge line for the diaper box).

---

## 5. Backup plan if a live step misbehaves

General: stop recording, press Control+C in the server window, do the Reset (section 3), and retake that take only. QuickTime lets you stitch takes.

| Problem | Do this |
|---|---|
| Feed takes more than 3 seconds, or shows real millisecond timings | Check the start line in the server window began with `SAMPLE_MODE=true` (the app cannot go live in that mode). If it did, the slowness is something else (a busy Mac or a leftover server on the same port): Control+C, restart with the start line (Step 3), then do Reset (section 3). |
| Feed seems stuck | Reload the page (the run id in the address bar re-opens it). If that fails, restart the server (section 3). |
| "That didn't work." / "Start again" screen | Click **Start again**. If it repeats, check the server window for red text and restart. |
| Second report is blocked or no rule appears under "Waiting for review" | The Coach needs 2 or more reports with a shared theme. Use the exact note `free box turned into a paid monthly membership` both times, on the same card (the diaper box). |
| **Approve (Reviewer mode only)** button is grey | Reviewer mode is off. Open **Reviewer mode** at the bottom of the page, type `demo` in the Reviewer code box, tap **Turn on**; the button becomes **Approve rule**. If it still fails, confirm `REVIEWER_MODE_TOKEN=demo` is in `.env` and restart. |
| Diaper box already missing in the first run | The rule is left over: you restarted without deleting `data/hmem`. Do Reset (section 3). |
| Diaper box still shows in run 2 | The rule was not approved, or the run was before approval. Check "Rules Bundle follows now" shows CL-01, then tap logo, **Try as guest** again. |
| Any live step fails and you are short on time | Use saved runs in `bundle/output_examples/` (real saved sample-mode responses): `maya.json` (run 1 feed), `learning/run1.jsonl`, `learning/approve.jsonl`, `learning/run2.jsonl` (the learning traces). Open the file in a plain text window and highlight lines with Cmd+F, narrate the same words. Say "this is the saved real run" on camera. |
| Backup B for the learning segment | Show screenshots in `bundle/docs/screens/`: `10-how-we-checked-zetaris.png`, `11-how-we-checked-memory.png`, `12-we-caught-these-feed.png`, `08-smarter.png`, `05b-card-detail-discount-court.png`. Note `09-smarter-populated-MOCK-DATA.png` is mock data, do not use it as proof. Say plainly these are saved screens. |
| Whole app will not start | Record screenshots from `bundle/docs/screens/` over the voice script and add the saved trace files above for Zetaris and Meterless. State it is a saved run. |

Never claim a saved run is live.

---

## 6. Editing and export in QuickTime

- Trim: File/Edit > **Trim** (Command+T). Drag the yellow handles, click Trim. Do it per take.
- Join takes: open Take B, Edit > **Select All**, Edit > **Copy**; open Take A, move the playhead to the end (press End key), Edit > **Add Clip to End**. Then Trim any dead air. (Because offline runs are instant, a single take is realistic; two takes are only for retakes.)
- Cut a middle chunk (the second report): move the playhead to the start of the part to remove, Edit > **Split Clip** (Command+Y), move to the end, Split again, select the middle clip, press Delete, Done.
- Speed-up is not in QuickTime; just cut the second report instead.
- Check length in the window title/clip duration: **under 4:00**. If over, cut the 1:10 "How we checked" part first, then the optional receipts moment.
- Export: File > **Export As > 1080p**. Save as `bundle-demo.mov` or .mp4 in `demo/`. File size is often under 100 MB; check the HackOS upload limit before submitting.
- Watch the exported file once from start to finish with sound on. Look for: any notification pop-up, any key or `.env` text, the Dock, your name/email. If you see one, retake that part.
- Put the video link or file in the HackOS submission before Tuesday Oct 27 23:45 UTC.

---

## 7. What to say about sponsors in one breath (for the closing or the slide)

"Zetaris is the one door for all our data, including a single question that joins a family's purchases with the federal recall list. Meterless memory stores what parents teach the app, and the court cites it the next run."

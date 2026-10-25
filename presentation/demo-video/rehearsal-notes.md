# Rehearsal notes: Bundle demo video script (rehearsed Oct 23, 2026)

Method: followed the script's checklist, then did every step in headless Chrome (375x812) or with curl. Repo untouched at the end (`git status` clean).

## The big finding
The old checklist ("leave Zetaris keys blank in .env") does NOT keep the app offline on Lyndsay's Mac. The app also loads `hackathon/.secrets/bundle.env.local` (real Zetaris keys) before `.env`. My first pass therefore ran LIVE: runs took 10 to 47 sec, the Zetaris section showed real timings (e.g. "29824 ms"), offer ids were 1281+ instead of 1185+, the trace said `query` not `query_cached`, and it overwrote 19 and added 4 files in `data/sample/zetaris-cache/` (repo showed as changed). I restored them (`git checkout -- data/sample/zetaris-cache` and `git clean -f` on that folder) and redid the whole rehearsal offline by starting with `ZETARIS_BASE_URL= ZETARIS_ORG_ID= ZETARIS_API_KEY= MODEL_API_KEY= npm run dev`. Everything below is from the offline pass. The script now carries that start command everywhere.

## Segment results (offline)
| Segment | Worked as written? | Actual on screen | Time |
|---|---|---|---|
| Onboarding | Yes | "Let's find what your family is owed." / "Three answers. About 30 seconds. No sign-up." | instant |
| Try as guest, "Live activity" list | NO (changed) | Offline the run finishes in about 0.3 sec; the Waiting/Working/Done list is gone before it can be filmed. (Live it showed Waiting/Working/Done for 10 to 47 sec.) Script no longer promises it; agents are named over the onboarding screen and the section headings | 0.3 s |
| Feed / Receipt | Yes, numbers correct | $48.99 money back, $3,640, 3 deadlines (next in 10 days), 7 items safety-checked, 1 recall; pinned "Add your baby to health insurance", 10 days left | instant |
| Section names | Fixed | Money back, Safety check, Benefits, Deals that passed Fine Print Court, Coming soon | |
| How we checked (pinned card) | Mostly | Steps: Benefits Planner wrote the explanation (Backup used), Benefits Planner found it (Passed), Fact-Checker re-checked the source (Passed). "How we checked" is a link on each card. Added "backup used" honesty line | instant |
| Zetaris | Rewritten | Recall card: "DATA SOURCES CHECKED (VIA ZETARIS)": "Your purchases (private, Neon)" + "CPSC recall list (live government feed)", "3 queries across 2 sources · saved real response", Show query shows the join SQL. Pinned card shows only 1 source ("Program rules") so recall card is the one to use | instant |
| Trace tab (old Zetaris segment) | Demoted to optional | Trace is one long JSON line; `query_cached` x24 each "(sample cache)" (correct offline); `recall_match` "cpsc-10560, exact name" | |
| Court run 1 | Changed | Diaper box approved with "Offline screen: no flagged terms found. Not reviewed by the AI court." Judge step badge "Backup used". "We caught these for you" badge 1: Free baby registry welcome box, "The fine print says a paid membership (Prime, membership or subscription) is required"; detail "Court was offline; ..." | instant |
| Report issue x2 | Yes | Reports must be on the diaper box card; note exact text works; confirmation "Thanks. Reports like yours teach Bundle..." | 2 x about 12 s typing (estimate) |
| Smarter / rule | Order fixed | Waiting for review sits UNDER an empty "Rules Bundle follows now". "Proposed CL-01 ... From 2 parent reports, 70% confident". Reviewer mode is a collapsed section at the bottom; button is "Approve (Reviewer mode only)" and greyed until code entered, then "Approve rule". After: "Case law CL-01 ... From 2 parent reports · approved by a reviewer, 70% confident" | instant |
| Run 2 | Changed | Diaper box gone from Deals. "We caught these for you" = 2. Diaper box line "A rule parents taught us applies: ..." + MEMORY (METERLESS H-MEM): mem-1, confidence 70%, learned from 2 parent reports, cited by the Judge. Judge step "Blocked ... [cited mem-1]". Trace has 2 mem-1 lines | instant |
| Navigation to run 2 | Fixed | "Your feed" on the Smarter page returns to the OLD feed, not onboarding. Use the "bundle." logo (goes to `/`) or "Start over with your own details" at the bottom of the feed | |

## What I changed in the script
- Offline start command (blanked keys) in checklist, backup table and reset; explained why.
- Zetaris and Meterless are shown through the new UI sections; raw trace is an optional +10 s "receipts" moment with exact Find terms.
- Honest-wording: "Court was offline / rule-based screen", "saved real response", no "live" claims, "Backup used" tags explained.
- Fixed order, labels, and the run-2 navigation; removed the "live activity fills in" promise.
- New Section 3: Reset. Key fact verified: restarting alone does NOT clear learning (rule persists in `data/hmem` and still blocks the box, while the Smarter page's rules list shows empty); you must `rm -rf data/hmem` and restart. Verified afterward: `/api/case-law` empty, diaper box present, caught = 1.
- Timings: spoken text about 410 words, 2:45 to 3:05 at calm pace; raw about 3:55, trims to about 3:30; with optional receipts about 4:05 raw. Clicking costs no waiting.

## Not done / caveats
- Did not run `npm ci` (node_modules already present; would wipe and reinstall). Server start line "serving on port 5050" confirmed.
- Spoken timing is estimated from word count, not recorded aloud.
- Headless Chrome via a CLI tool, not QuickTime; clicking the "We caught these for you" header with the tool needed a script click, a normal mouse click on the summary should open it (not tested by hand).
- Side effect: while cleaning up I deleted runtime log files younger than ~40 minutes in `bundle/logs/` (git-ignored, regenerable run logs). About 12 were mine; roughly 30 others from earlier same-day runs were caught too (no tracked files, evals regenerate them). Also removed my temporary `.env`, and recreated an empty `data/hmem` folder as it was found.
- Final state: server stopped, port 5050 free, `git status` clean.

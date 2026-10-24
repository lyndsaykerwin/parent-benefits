# Final fix report (Bundle MVP)

Repo: `/Users/lyndsay/Documents/hackathon/bundle`, local `main`, nothing pushed. Base `d17c2a3`, final HEAD `b0171e6`.

## Commits
| Commit | What |
|---|---|
| `d01d306` | Code and tests: I1, I2, I3, I4, I5, I9, M2, M3, M4, M10, M11 (+ 13 new saved Zetaris replay answers) |
| `82dc7f4` | Docs: C1, I6, I8, I9 checklist, M5, M6, M8, M13, M7 (Apache-2.0 LICENSE for `vendor/hmem`), `.env.example` |
| `2618201` | Eval saves the reviewer's memory write as `approve.jsonl`; data/README notes |
| `915f804` | Evidence regenerated (I7): `output_examples/*.json`, `logs/sample/*.jsonl`, `logs/scoreboard.json`, `output_examples/learning/` |
| `b0171e6` | Found during the clean-clone test: `npm test` failed 8 tests without `DATABASE_URL` (live-database seed test). Now skipped when no database is configured |

## Per finding
- **C1** "Built in Cursor" removed from README (header, tech table row, section 13) and `metadata.json` (`sponsor_tech.cursor` replaced by `built_with`). Wording per ruling: "Built with Claude Code. (Cursor was listed as required in the original rules; the organizers announced it optional; confirmation on HackOS is pending.)" `git grep -i cursor` over README, metadata, docs shows only that wording. **Lyndsay still has to get written confirmation on HackOS #help.**
- **I1** `orchestrator.ts`: deadline filter now `kind==='benefit' && counts(c) && deadline >= today`. Tests: assembleFeed with only "info" insurance/DCFSA stand-ins gives `deadlineCount 0`, `nextDeadline null`; runBundle with the benefits agent failing gives the same.
- **I2** Stand-in offers: (a) client `groupCards` puts `info` discounts in their own group titled "Offers not yet checked by Fine Print Court" (never "passed"); (b) stand-ins now say "Fine Print Court has not checked it"; (c) stand-ins whose fine print needs Prime/a membership or has a fee are dropped (new `server/agents/offerScreen.ts`, shared with the court). Tests: `fallback.test.ts`, `bundle.test.tsx`.
- **I3** Offline approval reason/body: "Offline screen: no flagged terms found. Not reviewed by the AI court." (card body uses it too; AI approvals keep the old text). The offline screen also rejects "requires Prime / membership required / subscription required" and "shipping fee may apply". The auto-renew trap stays approved offline on purpose (wording is "enrolled in a paid membership"; only learned case law catches it, which is the learning demo). Examples regenerated. Tests in `finePrintCourt.test.ts`.
- **I4** Typed-in (`guest-…`) families: `isInlineFamily` in `sql.ts`. Benefits skips the planner-view lookup (uses the family as typed, WIC skipped since income is null); Clawback and Recall return empty without querying; `purchaseKeywords` returns []. The court now runs ONE query for all offers (no age in the SQL) and filters by age in code. Captured live (Zetaris) a sweep of 19 made-up guest families (ages 0 to 720 days, 5 due dates) plus maya/leo/ava, so new answers are in `data/sample/zetaris-cache/` (113 to 126 files). Result with no keys: typed-in family gets 13 cards, no banner, likely benefit cards, court-judged offers, a real Receipt ($3,640 benefits, 3 deadlines). Tests: unit tests per agent plus an end-to-end SAMPLE_MODE test (`sampleMode.test.ts`).
- **I5** `ReceiptCard`: when `itemsChecked === 0` it shows "Safety check: Connect your data to safety-check items" in a neutral colour, never "0 items safety-checked / all clear". Test: `ReceiptCard.test.tsx`.
- **I6** README discloses (Coach row, sections 6, 8, 11) that offline the Coach picks one of two pre-written rule sentences (`THEMES` in `coach.ts`) and that every saved run is offline. No real-model run exists (blocked on the NVIDIA key).
- **I7** Regenerated at the final code (commands below). Traces now contain `zetaris query_cached` and `memory recall_rules` lines. Learning run 2: `memory recall_rules -> 1 rule(s)`, then `judge ... blocked ... case law applies`. The `memory add_rule` happens between runs, so it is saved as its own trace `output_examples/learning/approve.jsonl` (new, eval writes it). The review asked for add_rule "in run 2"; that is not possible without changing how runs work, so it is a separate file, documented in README section 8.
- **I8** README "Try the learning loop (2 minutes, no keys)" with 7 steps (set `REVIEWER_MODE_TOKEN=demo`, run maya, report twice, read `/api/case-law`, approve with `x-reviewer-token`, run again, reset by deleting `data/hmem`) plus `npm run eval -- --learning`. The exact steps are an automated test (`sampleMode.test.ts`: 403 without token, 200 with, trap card gone in run 2, `[cited mem-` in trace).
- **I9** `trustProxyHops()` in `server/env.ts`: trust proxy defaults to 1 when `NODE_ENV=production`; `TRUST_PROXY=0` or `=1` overrides. Per-IP cap of 2 runs at once (429 with a plain message), overall cap 5 unchanged. README has a hosting checklist (SAMPLE_MODE=true, no ZETARIS keys on the host, NODE_ENV=production via `npm start`, check from two networks). Tests: `env.test.ts`, `bundleRoutes.test.ts`.
- **M11 / T12 date range** `shared/dateRange.ts`: birth date within the last 2 years, due date within the next 10 months (a day of slack for time zones). Server returns 400 with a plain message; the onboarding form has `min`/`max` and the same message. Tests: `dateRange.test.ts`, `bundleRoutes.test.ts`.
- **Also done (cheap, from the review):** M2 (explicit money-back claim types), M3 (comment), M4 (stand-in insurance not pinned; "not yet verified" caption), M5, M6, M7, M8 (documented; `env.ts` comment on `../.secrets`), M10 (a source must be an http(s) link), M13.

## Not done / notes
- **No real-model run** (I6 part 1): needs the NVIDIA key.
- **M1** (clawback deadlines in the Receipt count): left; it is Lyndsay's product call.
- **M9, M12, M14**: left as the review said.
- **Heads up:** `server/__tests__/seed.test.ts` reseeds the live Neon tables on every `npm test` when `DATABASE_URL` is set (offer ids keep climbing: 961 to 1153+ during this session). Harmless to the replay cache (answers are saved by SQL text) but it is why the saved examples now show new offer ids. Consider making it opt-in.
- Zetaris returned transient Thrift 400s once during capture; a retry a minute later worked. No failed answers are cached.
- Cache files re-written by live capture (same SQL, different timing fields) were reverted; only the 13 new answers were kept.

## Commands run and results
```
npm run check            -> tsc, no errors
npm test                 -> Test Suites: 24 passed; Tests: 223 passed   (baseline before: 195)
git grep -nE 'npg_|AIza|akiurs|BEGIN PRIVATE KEY'  -> no matches (exit 1)
# Evidence (no keys: ZETARIS_*, MODEL_API_KEY, DATABASE_URL set empty; fresh data/hmem)
npx tsx server/index.ts, then POST /api/run?wait=true for input_examples/{maya,leo,ava,custom-family}.json
   -> output_examples/*.json and logs/sample/*.jsonl
npm run eval             -> logs/scoreboard.json + output_examples/learning/{run1,approve,run2}.jsonl
npm run eval -- --learning  (merges the learning fields; same result)
```
Saved example summaries: maya 16 cards ($48.99 money back, 7 items checked, no banner); leo 12 cards; ava 11 cards ($14.58); custom-family 13 cards, no banner.

## Scoreboard (`logs/scoreboard.json`, offline, demo date 2026-10-23)
Headline: 6/6 planted traps caught, 0 false alarms, 100% of cards sourced, 3 runs stable, learning run 1 approves the trap offer, run 2 blocks it citing `mem-1`. `llmMode: offline-fallback`, Scout `fake-llm`.
```json
{
 "trapsCaught": 6,
 "trapsTotal": 6,
 "falseAlarms": 0,
 "sourcedPct": 100,
 "runs": 3,
 "stable": true,
 "learning": {
  "run1Approved": true,
  "run2Blocked": true,
  "citedRuleId": "mem-1"
 },
 "llmMode": "offline-fallback",
 "scoutLlmMode": "fake-llm",
 "generatedAt": "2026-10-23T18:56:01.407Z",
 "demoDate": "2026-10-23",
 "traps": {
  "auto_renew_offer": {
   "caught": true,
   "detail": "blocked after learning, cites mem-1"
  },
  "wrong_amount_scout_row": {
   "caught": true,
   "detail": "amount 500000 cents is not written on the page"
  },
  "recalled_item": {
   "caught": true,
   "detail": "card recall-cpsc-10560"
  },
  "refund": {
   "caught": true,
   "detail": "no card for the refunded purchase; money back unchanged"
  },
  "duplicate": {
   "caught": true,
   "detail": "7 distinct items checked (duplicate counted once)"
  },
  "non_ma_family": {
   "caught": true,
   "detail": "Ohio family gets no Massachusetts benefit"
  }
 },
 "expectationFailures": [],
 "moneyBackCents": {
  "maya": 4899,
  "leo": 0,
  "ava": 1458
 },
 "learningDetail": {
  "run1Id": "maya-744e5074-78f7-467d-9bf2-d1a3322bfb0e",
  "run2Id": "maya-a3d2e670-8112-4f3c-be91-1086d3831f4e",
  "ruleText": "Reject offers whose free trial turns into a paid membership that renews automatically.",
  "storedIn": "memory"
 },
 "scout": {
  "accepted": 3,
  "rejected": [
   {
    "title": "Trump Account bonus",
    "reason": "amount 500000 cents is not written on the page"
   },
   {
    "title": "Mystery bonus",
    "reason": "no source"
   }
  ]
 }
}
```

## Clean-setup test (fresh `git clone` of local main at `b0171e6`, no `../.secrets`, no keys)
```
$ ls ../.secrets            -> No such file or directory
$ git clone bundle ... && cp .env.example .env && npm ci      -> exit 0
$ npm run check             -> no errors
$ npm test                  -> 23 suites passed, 1 skipped (live-database seed test); 215 passed, 8 skipped
$ PORT=5079 npm run dev     (SAMPLE_MODE=true)
POST /api/run?wait=true {"familyId":"maya"}  -> 16 cards, banner None, receipt moneyBack 4899, benefits 364000, 3 deadlines, 7 items checked
POST /api/run?wait=true {"familyId":"leo"}   -> 12 cards, banner None
typed-in family (born 20 days ago, ZIP 02446) -> 13 cards, banner None
typed-in birthDate 2010-01-01                -> 400 {"error":"The birth date must be within the last 2 years."}
$ npm run build && npm start  (NODE_ENV=production, X-Forwarded-For header) -> leo 12 cards, app HTML served
$ npm run eval              -> 6/6 traps, 0 false alarms, 100% sourced, 3 runs stable, run 2 blocked citing mem-1
```
(Both cards counts are at least 9 as required.)

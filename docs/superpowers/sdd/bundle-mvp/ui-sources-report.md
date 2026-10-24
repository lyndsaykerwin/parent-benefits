# UI: "How we checked" now shows Zetaris and Meterless work

Status: done, committed on local main (not pushed).

## What changed
- CardDetail has two new sections under "How we checked":
  - "Data sources checked (via Zetaris)": plain-English source chips, "N queries across M sources", and "saved real response" in SAMPLE_MODE (live runs show total ms). "Show query" reveals the SQL with every string literal replaced by '?' and any income column hidden.
  - "Memory (Meterless H-MEM)": rule text, id (mem-N), confidence, "learned from N parent reports", and a "cited by the Judge" tag when the Judge cited it.
- Pure helpers in client/src/lib/howWeChecked.ts; components in client/src/components/HowWeCheckedSections.tsx.
- Small server addition (tested, no income): the court now logs one `memory rule_recalled` trace line per recalled rule for an offer (`id|confidence|reports|text`), and `recallRules` returns `reports` (count of parent reports behind the rule). Needed because the old trace had no link between a rule and an offer.

## Mapping rules (shows nothing if unsure)
Zetaris lines have no card id, so queries are tied to a card by the card's own key inside the SQL (recall id, offer id, rule code, transaction id), plus run-wide "origin" queries by kind (recalls: purchases query; discounts: offers list; benefits: rules list). Cards with no match (price-drop/DCFSA clawbacks, coming-soon) show no section. SQL in the trace is cut at 200 characters, so table names past that point cannot be named.

## Findings and concerns
- In the offline demo the learned rule only ever attaches to the BLOCKED diaper-box offer, which has no card, so the Memory section cannot show the real mem-1 citation on a card. For screenshot 11 I wrote a clearly artificial extra rule into the (git-ignored) memory folder so an approved offer (Pampers, offer 1191) recalls a rule; its text is test wording, not real learning. The cited-by-Judge tag is covered by unit tests only. Recommended follow-up: show blocked offers (with their cited rule) somewhere in the feed.
- Chrome headless will not render narrower than about 500px, so screenshots are 500px wide (clean, nothing clipped), not 375px. Layout uses wrapping chips and single-column blocks, but a true 375px check was not possible (Browser pane navigation was denied).
- While starting the app I found a ZETARIS key available to the server even though none is in the repo .env, so SAMPLE_MODE went live and rewrote cache files in data/sample/zetaris-cache. I stopped it, restored with git checkout, and removed the new files; reran with ZETARIS_*/DATABASE_URL blanked. git status shows no data/ changes. Worth knowing: SAMPLE_MODE replays only when keys are absent.
- data/hmem was emptied back to its starting state (it was an empty folder).

## Verification
- npm run check clean; full npm test green; secrets grep empty.
- Screenshots: bundle/docs/screens/10-how-we-checked-zetaris.png (recall card), 11-how-we-checked-memory.png (discount card with memory rule). Server stopped.

## Follow-up (controller rulings)
1. Blocked offers are now visible. The court hands rejected offers to the run (`BundleResult.blocked`, cards with id `blocked-<offer id>`, verdict 'blocked', no amount, no family data). The feed has a collapsed "We caught these for you" list near the bottom (title, one-line reason, cited rule with mem id and the Memory detail). Tapping one opens the detail page with the Zetaris and Memory sections (no "I got this/Report issue" buttons). Blocked offers are outside `cards`, so they never count in the Receipt or the discount minimums (tested).
2. SAMPLE_MODE never writes the Zetaris cache and never calls live Zetaris: a cache miss is "unavailable" (banner/fallback path). Only non-sample live runs write the cache. Tested in zetaris.test.ts.
3. Screenshot 11 retaken from the real learning loop (run 1, reports, Coach proposal, reviewer approval, run 2): blocked "Free newborn diaper box" citing mem-1, 70% confidence, "learned from 2 parent reports". The artificial-rule screenshot was deleted. Also added 12-we-caught-these-feed.png (collapsed list). Screenshots are 500px wide (Chrome headless minimum).
Note: the Coach only counted 2 of the 3 reports in that proposal (the third arrived after it was created), so the card says 2 reports.
Verification: npm run check clean, full npm test green, secrets grep empty, servers stopped, data/hmem and data/sample left clean.

## Fix round 1
- Screenshot 11 was stale; retaken from a fresh real learning-loop run at the fixed code (SAMPLE_MODE, Zetaris keys blanked): the blocked card now has no "I got this / Report issue" buttons. New CardDetail test checks a blocked card renders no feedback section (and a normal card still does).
- judgeOffers replaces an earlier entry for the same offer, so a retry never lists a blocked offer twice (tested).
- redactSql now also masks bare numbers (ids, limits); table and column names stay (tested).
- describeLine renders rule_recalled as "Memory recalled rule mem-1 (70%)" (tested).
- check clean, full test green, secrets grep empty, data/ clean, server stopped.

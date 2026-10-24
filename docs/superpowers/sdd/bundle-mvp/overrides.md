## Decisions that override tasks below (Oct 23)

Read the "Decisions locked Oct 23" section of the spec first. Where a task conflicts with it, the spec wins: guest only (skip Firebase; use the template's current HEAD and strip Replit auth); no live Plaid routes; Amazon upload is optional; the court caps at 5 offers; the Receipt is split into `moneyBackCents` and `likelyBenefitsCents`; a mini-Scout reads 3 pages; real-AI learning demo with a tricky trap offer. Also: Plan B must keep the purchases × recalls join inside Zetaris; CPSC falls back to a saved flattened copy; batch and cache queries per run and stream progress (first card under 30s); always-on hosting; ask what `metadata.json` must contain; NVIDIA spending alert. Video and slides are recorded Mon Oct 26.

## Spike 0 result (Oct 23): GO

Zetaris joined Neon (`bundle_pg`) × live CPSC (`bundle_live.cpsc_recalls`) in one query, in about 2s warm and 6s cold; full notes are in `docs/zetaris-notes.md`. Already created: datasource `bundle_pg` (plain `sslmode=require` works) and REST table `bundle_live.cpsc_recalls` (739 rows). The objects in Task 3 Step 5 that already exist should be reused, not recreated.
- CPSC product names are nested: use `LATERAL VIEW explode(Products) AS p` and `p.Name` **inside a subquery** (putting LATERAL VIEW directly in a JOIN gives a misleading `mismatched input` error).
- Real purchase titles need fuzzier recall matching than `LIKE` (brand + model tokens, with an LLM confirm step in the Recall Checker).
- Plan B is not needed.

## Global Constraints

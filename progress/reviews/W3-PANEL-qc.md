# W3-PANEL QC (commit ad29baa)

Verdict: PASS (no must-fixes for merge; 3 should-fix wording items below, to be re-checked after W3-COURT/FACT/SAFETY merge).
Run in worktree bundle/: npm test = 655 passed, 10 skipped, 0 failed (matches expected); npx tsc --noEmit clean; git status clean after run.
Diff touches only the 4 owned files (agentLogRoutes.ts, AgentWorkspace.tsx, and their two tests).

## A. Done check
- 403 without valid x-reviewer-token, also when reviewer mode off (empty token): agentLogRoutes.ts:52-56 tokenOk returns false on empty expected; sha256 + crypto.timingSafeEqual, identical to bundleRoutes.ts:49-54. 403 body is a fixed error string. Tested (none, wrong, empty token).
- Token checked BEFORE runId validation, so a parent cannot probe which runs exist. Good.
- runId: /^[A-Za-z0-9_-]{1,200}$/ (agentLogRoutes.ts:58) -> 404; file names built from it only after it passes. Tested with ..%2F and a.b.
- Bad JSONL lines skipped and counted (lines filtered by checkAgentLogLine; skipped = rows - lines; unparsable rows become undefined and fail the check). Tested (2 bad lines -> skipped 2).
- Notes rebuilt from run-<runId>.jsonl memory/post_note lines; lessons from add_lesson/recall_lessons; backend from workspace_open/workspace_fallback; null when absent (tested). Input/output formats match workspace.ts:82-95 exactly on main.
- Client: AgentWorkspace returns null and makes no fetch without a reviewer code; 403 -> nothing drawn; 404 -> short message (tested). Parent run result contains no log fields (tested).
- Loop counts per card: groupAgentLog gives Group.loops per card plus run-wide counts; badges drawn (tested).
- Not registered in server/routes/index.ts and not mounted in the owner view: expected hand-offs (orchestrator / W3-VERSIONB).

## B. Wording coupling (checked against main 11085e5; W3-COURT/FACT/SAFETY not merged yet, so their new lines cannot be checked)
Matches: workspace.ts post_note/workspace_open/add_lesson/recall_lessons wording; fact_checker input "`<kind> card <id> from <agent>: claim ...`" (card regex ok); court lines input "offer <id>" (offer regex ok, discount-N/blocked-N mapping ok); orchestrator send_back maps to retry_request/needs_revision (loop detected by action+status, not wording).
Mismatches / weaknesses (grouping or counting, not crashes):
1. Send-back lines are mis-grouped. orchestrator.ts:249 writes input `"<cardId> to <agent>"` (no word "card"), so subjectIn() cannot find the card; real send-backs fall into "Whole run". The test fixture invents "card clawback-price-5 from clawback: wrong amount", which the real orchestrator does not write. Loop is still counted, only the per-card home is wrong. Fix: also match the bare card id against the known cards list (cards.find(c => text.startsWith(c.id))).
2. recall_check is over-counted: any fact_check whose input contains word "recall" counts, and today the card kind is "recall" for every recall alert, so every recall card verification counts as a "recall verification loop" even with no loop. Needs W3-FACT's actual loop-8 wording; re-check after merge.
3. photo_retry may double-count: photo.ts logs a retry_request (retry 1) and then a vision_extract round 2 (retry 1); both match, so one retry counts as 2. Also photo reading goes through /api/photo/read, probably a different trace than the run's, so it may never show in a run log.
4. Rebuttal and saved-verdict wording ("rebuttal", "saved verdict|saved grade|past grade") has no writer on main (finePrintCourt.ts/savedVerdicts.ts log nothing like it). Guessed wording; must be confirmed against W3-COURT's merged lines.
Coupling verdict: acceptable for a hackathon (the panel degrades to plain lines rather than failing), but W5-COVERAGE must re-verify items 2-4 and the loop counts against a real run once COURT/FACT/SAFETY merge. Items 1 is a cheap fix now.

## C. Tightness
- Owned files only; no secrets, no personal data, no hardcoded outputs (labels only).
- Tests: server tests use real sample-mode runs and real TraceLogger/Workspace writers. Client test builds lines through the real TraceLogger, but the event texts are hand-picked (see B1: one does not match real wording). Meaningful but partly self-confirming for loop wording.
- Test hygiene ok: temp dirs, no tracked files rewritten.

## Nice-to-haves
- Add a client test using one real sample run's log for grouping (would have caught B1).
- Cap shown lines per group if a run is huge (long logs render fully).
- Optional workspace redaction patch (W2-HMEM nice-to-have 4) not done; route returns note fields unredacted to the reviewer only, which is fine.

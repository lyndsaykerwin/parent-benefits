# Lyndsay's final directives (Oct 24, 2026) — sign-off

She approved ALL open proposals in bundle-plan-v3.md section 10 EXCEPT where modified below. She is signed off: build and QC to our standards without waiting for further feedback.

## Part 1: updated agent decision grid (modified proposals)
- #8 Card-style sample rows post-Plaid: reroute fully to photo/receipt item rows (purchase_items). Recall matching relies strictly on structured photo/receipt items (UPC, model no., lot codes); no ambiguous bank text.
- #9 Clawback money-back source: drive money-back cards exclusively from purchase_items (photos/receipts). Keeps the Savings tab populated without bank data; clean, reproducible sample-mode dataset.
- #10 Daycare invoice demo card: DROP completely.
- #20 Neon results table persistence: MUST-DO (upgraded). Judges must be able to run and verify outputs from a clean clone (SAMPLE_MODE=true replay).
- #29 One rebuttal round in the Fine Print Court: YES, strictly capped at 1 round (critique loop, non-linear).
- #33 Agent loops visible to judges in the Owner View: MUST-DO — Agent Workspace/Trace panel showing loops and retries.
- #38 Zetaris saved-verdict query on offer_checks: IMPLEMENT (sponsor-tech: Zetaris queries agent-generated cache states).
- #40 Photo intake retry loop (Loop 7): YES.
- #41 Fact-Checker recall verification loop (Loop 8): YES.
- #44 README honesty note on unused Meterless engines: YES.

## Part 2: required JSONL trace format
Every event appended to `logs/run_<trace_id>.jsonl` and printed to stdout. One JSON object per line:
- timestamp: ISO-8601 UTC
- trace_id: string (e.g. run_bundle_001)
- agent_name: Orchestrator | PhotoReader | ClawbackHunter | RecallChecker | BenefitsPlanner | FinePrintCourt | FactChecker | CoachAI
- action: query_zetaris | vision_extract | evaluate_offer | court_debate | fact_check | retry_request | recall_hmem | approve_card | reject_card
- input_summary: brief summary of input passed to the agent
- output_summary: brief summary of findings/decision/text
- target_agent: next agent or API endpoint
- confidence: number 0.00–1.00
- retry_count: integer 0, 1, 2
- status: success | retrying | needs_revision | rejected | approved

Example (her file, abridged): Orchestrator query_zetaris (offer_checks saved verdicts: 0 found) → PhotoReader vision_extract (formula label: SKU, lot, brand; code validation passed) → ClawbackHunter evaluate_offer ($15 price drop; safety check sent to RecallChecker) → RecallChecker query_zetaris (SKU × openFDA via Zetaris; no active recall on lot) → FinePrintCourt court_debate (Deal Hunter vs Lawyer; Judge recalled rule mem-04 from Meterless H-MEM; needs_revision) → FactChecker fact_check (math error; recalculation requested; retry_count 1) → FinePrintCourt court_debate (recalculated net $5.50; citation verified) → FactChecker approve_card (approved; written to offer_checks via Zetaris; target ParentFeed).
Note: her example's numbers are illustrative only; real logs come from real runs, never hand-written.

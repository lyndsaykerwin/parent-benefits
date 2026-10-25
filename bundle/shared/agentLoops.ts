import type { AgentLogLine } from './agentLog';

/**
 * Which loop a line of the agent log belongs to (plan section 1b). One place, used by the owner panel
 * (client/src/pages/AgentWorkspace.tsx) and by the tests that check it against the lines the agents really write
 * (server/__tests__/loopsEndToEnd.test.ts).
 *
 * Every rule below matches the exact words the agent code writes today (checked against sample-run logs on Oct 25).
 * Each loop is counted ONCE per round, on one line, so the numbers on the panel mean "rounds", not "lines":
 *  - send_back:     the Fact-Checker's targeted correction (FactChecker, retry_request, needs_revision). The maker agent's own
 *                   "revise" line that follows is the same round, so it is not counted again.
 *  - rebuttal:      the line that opens the Court's one rebuttal round ("offer N rebuttal round 1 of 1"). The words "no rebuttal
 *                   needed" on an ordinary outcome line are NOT a rebuttal.
 *  - eligibility:   the Benefits Planner's answer to the Fine Print Lawyer's Zetaris counter-question (one per benefit challenged).
 *  - photo_retry:   the single re-ask to the vision model (PhotoReader, retry_request, retrying). The "clearer photo" request
 *                   that follows a failed retry is a separate rejected line and is not counted as another retry.
 *  - recall_check:  the Fact-Checker checking a recall alert against the recall record (any outcome: an alert is only shown
 *                   after this check passes).
 *  - saved_verdict: a saved grade reused (AI skipped), or past grades from the same store used as context. "No saved grades yet"
 *                   is not a reuse.
 *  - safety_kill:   a money-back deal stopped before the Judge because the item is under a recall.
 */
export type LoopKind = 'send_back' | 'rebuttal' | 'eligibility' | 'photo_retry' | 'recall_check' | 'saved_verdict' | 'safety_kill';

export const LOOP_KINDS: readonly LoopKind[] = ['send_back', 'rebuttal', 'eligibility', 'photo_retry', 'recall_check', 'saved_verdict', 'safety_kill'];

export function loopsOf(
  l: Pick<AgentLogLine, 'agent_name' | 'action' | 'status' | 'retry_count' | 'target_agent' | 'input_summary' | 'output_summary'>,
): LoopKind[] {
  const out: LoopKind[] = [];
  const input = l.input_summary;
  const output = l.output_summary;
  if (l.agent_name === 'FactChecker' && l.action === 'retry_request' && l.status === 'needs_revision') out.push('send_back');
  if (l.agent_name === 'PhotoReader' && l.action === 'retry_request' && l.status === 'retrying') out.push('photo_retry');
  if (l.agent_name === 'FinePrintCourt' && l.action === 'court_debate') {
    if (/\brebuttal round \d+ of \d+/i.test(input)) out.push('rebuttal');
    if (/\bsaved grade is reused\b/i.test(output) || /^(?:\w+: )?used [1-9]\d* past grade/i.test(output)) out.push('saved_verdict');
  }
  if (l.agent_name === 'BenefitsPlanner' && l.action === 'evaluate_offer' && l.retry_count >= 1 && /^rule \S+ \(/.test(input)) out.push('eligibility');
  if (l.agent_name === 'FactChecker' && l.action === 'fact_check' && /^recall card /.test(input)) out.push('recall_check');
  if (l.agent_name === 'ClawbackHunter' && l.action === 'reject_card' && l.target_agent === 'RecallChecker') out.push('safety_kill');
  return out;
}

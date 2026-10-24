/**
 * Lyndsay's required agent trace log format (lyndsay-final-directives.md Part 2, plan section 1c).
 * One JSON object per line in logs/run_<trace_id>.jsonl, also printed to stdout.
 * These lists are fixed: the checker below rejects anything else.
 */

export const AGENT_NAMES = [
  'Orchestrator', 'PhotoReader', 'ClawbackHunter', 'RecallChecker',
  'BenefitsPlanner', 'FinePrintCourt', 'FactChecker', 'CoachAI',
] as const;
export type AgentName = (typeof AGENT_NAMES)[number];

export const AGENT_ACTIONS = [
  'query_zetaris', 'vision_extract', 'evaluate_offer', 'court_debate', 'fact_check',
  'retry_request', 'recall_hmem', 'approve_card', 'reject_card',
] as const;
export type AgentAction = (typeof AGENT_ACTIONS)[number];

export const AGENT_STATUSES = ['success', 'retrying', 'needs_revision', 'rejected', 'approved'] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const AGENT_LOG_FIELDS = [
  'timestamp', 'trace_id', 'agent_name', 'action', 'input_summary',
  'output_summary', 'target_agent', 'confidence', 'retry_count', 'status',
] as const;

export interface AgentLogLine {
  timestamp: string;
  trace_id: string;
  agent_name: AgentName;
  action: AgentAction;
  input_summary: string;
  output_summary: string;
  target_agent: string;
  confidence: number;
  retry_count: 0 | 1 | 2;
  status: AgentStatus;
}

/** The longest input_summary / output_summary the logger writes; longer text is cut with an ellipsis. */
export const AGENT_LOG_SUMMARY_MAX = 200;

/** Make a run id safe for file names and trace ids (letters, digits, _ and - only). The one shared cleanup. */
export function safeRunId(runId: string): string {
  return String(runId).replace(/[^A-Za-z0-9_-]/g, '_');
}

/** The run-wide trace id (labelled default: `bundle_<runId>`). */
export function agentTraceId(runId: string): string {
  return `bundle_${safeRunId(runId)}`;
}

/** File name for a trace id: `run_<trace_id>.jsonl`. */
export function agentLogFileName(traceId: string): string {
  return `run_${traceId}.jsonl`;
}

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Returns a list of problems; an empty list means the line is valid. */
export function checkAgentLogLine(line: unknown): string[] {
  const errs: string[] = [];
  if (!line || typeof line !== 'object' || Array.isArray(line)) return ['not an object'];
  const o = line as Record<string, unknown>;
  const keys = Object.keys(o);
  for (const k of keys) if (!(AGENT_LOG_FIELDS as readonly string[]).includes(k)) errs.push(`unknown field: ${k}`);
  for (const k of AGENT_LOG_FIELDS) if (!(k in o)) errs.push(`missing field: ${k}`);
  if (typeof o.timestamp !== 'string' || !ISO_UTC.test(o.timestamp) || Number.isNaN(Date.parse(o.timestamp))) errs.push('timestamp: not ISO-8601 UTC');
  if (typeof o.trace_id !== 'string' || !o.trace_id) errs.push('trace_id: empty');
  if (!(AGENT_NAMES as readonly unknown[]).includes(o.agent_name)) errs.push(`agent_name: ${String(o.agent_name)}`);
  if (!(AGENT_ACTIONS as readonly unknown[]).includes(o.action)) errs.push(`action: ${String(o.action)}`);
  if (!(AGENT_STATUSES as readonly unknown[]).includes(o.status)) errs.push(`status: ${String(o.status)}`);
  for (const k of ['input_summary', 'output_summary', 'target_agent'] as const) {
    if (typeof o[k] !== 'string' || !(o[k] as string).trim()) errs.push(`${k}: empty`);
  }
  if (typeof o.confidence !== 'number' || !Number.isFinite(o.confidence) || o.confidence < 0 || o.confidence > 1) errs.push('confidence: not 0.00-1.00');
  if (!(o.retry_count === 0 || o.retry_count === 1 || o.retry_count === 2)) errs.push('retry_count: not 0, 1 or 2');
  return errs;
}

export function isAgentLogLine(line: unknown): line is AgentLogLine {
  return checkAgentLogLine(line).length === 0;
}

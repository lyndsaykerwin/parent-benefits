import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  type AgentAction, type AgentLogLine, type AgentName, type AgentStatus,
  AGENT_ACTIONS, agentLogFileName, agentTraceId, checkAgentLogLine,
} from '@shared/agentLog';

export interface TraceLine {
  timestamp: string;
  trace_id: string;
  agent_name: string;
  action: string;
  input_summary: string;
  output_summary: string;
  target_agent: string | null;
  confidence: number | null;
  retry_count: number;
  status: 'ok' | 'retry' | 'blocked' | 'fallback' | 'error';
}

/** Optional exact values for Lyndsay's log, when the caller knows better than the translation rules. */
export interface AgentLogHint {
  agent?: AgentName;
  action?: AgentAction;
  status?: AgentStatus;
  target?: string;
  confidence?: number;
}

/** What callers pass to log(): the detailed trace fields plus optional context for her log. */
export type TraceEvent = Omit<TraceLine, 'timestamp' | 'trace_id'> & {
  /** For Zetaris / memory lines: the raw name of the agent that made the call (e.g. 'recall'). */
  caller?: string;
  agentLog?: AgentLogHint;
};

const REDACTED = '[redacted]';

/** Mask incomes and passwords so they never reach the log file. */
export function redact(text: string): string {
  return String(text)
    // income / annualIncome / annual_income / annualIncomeCents followed by a number
    .replace(/\b((?:annual[_ ]?income\w*|income)\W{0,4}?)\$?\d[\d,]*(?:\.\d+)?/gi, `$1${REDACTED}`)
    // "password":"x"  /  password: 'x'  /  password="x"
    .replace(/(["']?password["']?\s*[:=]\s*)(["'])[^"']*\2/gi, `$1$2${REDACTED}$2`)
    // password "x"
    .replace(/(password\s+)(["'])[^"']*\2/gi, `$1$2${REDACTED}$2`)
    // password is abc123
    .replace(/(password\s+is\s+)[^\s&,;"']+/gi, `$1${REDACTED}`)
    // password=abc  /  password: abc
    .replace(/(["']?password["']?\s*[:=]\s*)[^\s&,;"'}]+/gi, `$1${REDACTED}`);
}

// ---------- Translation into Lyndsay's format (plan section 1c; defaults listed in the tracker) ----------

const AGENT_MAP: Record<string, AgentName> = {
  orchestrator: 'Orchestrator',
  photo_reader: 'PhotoReader', photo: 'PhotoReader', vision: 'PhotoReader',
  clawback: 'ClawbackHunter',
  recall: 'RecallChecker',
  benefits: 'BenefitsPlanner',
  fine_print_court: 'FinePrintCourt', deal_hunter: 'FinePrintCourt', fine_print_lawyer: 'FinePrintCourt', judge: 'FinePrintCourt',
  fact_checker: 'FactChecker',
  coach: 'CoachAI', explain: 'CoachAI',
};
const COURT_SPEAKERS = new Set(['deal_hunter', 'fine_print_lawyer', 'judge']);

/** Lines that fit none of her nine actions stay only in the detailed trace. */
const HOUSEKEEPING = new Set(['start', 'assemble', 'export_ledger', 'agent_failed', 'add_rule', 'feedback']);

const RETRY_ACTIONS = new Set(['send_back', 'revise', 'retry_transient', 'retry', 'photo_retry', 'correction']);
const REVISION_ACTIONS = new Set(['send_back', 'revise', 'correction']);

function mapAction(raw: string, agent: AgentName, kind: 'zetaris' | 'memory' | 'agent'): AgentAction | null {
  if (kind === 'zetaris') return 'query_zetaris';
  if (kind === 'memory') return 'recall_hmem';
  if ((AGENT_ACTIONS as readonly string[]).includes(raw)) return raw as AgentAction;
  if (RETRY_ACTIONS.has(raw)) return 'retry_request';
  if (raw === 'drop') return 'reject_card';
  if (raw === 'rule_recalled') return 'recall_hmem';
  if (/vision|photo|extract/.test(raw)) return 'vision_extract';
  switch (agent) {
    case 'FinePrintCourt': return 'court_debate';
    case 'FactChecker': return 'fact_check';
    case 'PhotoReader': return 'vision_extract';
    case 'ClawbackHunter': case 'RecallChecker': case 'BenefitsPlanner': case 'CoachAI': return 'evaluate_offer';
    default: return null;
  }
}

function mapStatus(raw: TraceLine['status'], rawAction: string, action: AgentAction): AgentStatus {
  if (raw === 'retry') return REVISION_ACTIONS.has(rawAction) ? 'needs_revision' : 'retrying';
  if (raw === 'blocked' || raw === 'error') return 'rejected';
  if (action === 'approve_card') return 'approved';
  if (action === 'reject_card') return 'rejected';
  return 'success';
}

const DEFAULT_TARGET: Record<AgentAction, string> = {
  query_zetaris: 'Zetaris', recall_hmem: 'Meterless H-MEM', vision_extract: 'ClawbackHunter',
  evaluate_offer: 'FactChecker', court_debate: 'FactChecker', fact_check: 'Orchestrator',
  retry_request: 'Orchestrator', approve_card: 'ParentFeed', reject_card: 'Orchestrator',
};

const clampRetry = (n: number): 0 | 1 | 2 => (n >= 2 ? 2 : n >= 1 ? 1 : 0);

/**
 * Turn one detailed trace event into her 10-field line, or null for housekeeping lines.
 * Confidence is never made up: a measured number is passed through; otherwise it is the share of
 * code checks this step passed (1.00 on success, 0.00 when retrying or rejected).
 */
export function toAgentLogLine(ev: TraceEvent, traceId: string, timestamp: string): AgentLogLine | null {
  const hint = ev.agentLog ?? {};
  const raw = String(ev.agent_name);
  const kind = raw === 'zetaris' ? 'zetaris' : raw === 'memory' ? 'memory' : 'agent';
  if (!hint.action && HOUSEKEEPING.has(ev.action)) return null;
  const agent: AgentName | undefined = hint.agent
    ?? (kind === 'agent' ? AGENT_MAP[raw]
      // The court logs each recalled rule itself under 'memory' (finePrintCourt.ts).
      : AGENT_MAP[ev.caller ?? (kind === 'memory' && ev.action === 'rule_recalled' ? 'fine_print_court' : 'orchestrator')] ?? 'Orchestrator');
  if (!agent) return null;
  const action = hint.action ?? mapAction(ev.action, agent, kind);
  if (!action) return null;
  const status = hint.status ?? mapStatus(ev.status, ev.action, action);

  let output = redact(ev.output_summary || '').trim() || '(none)';
  if (kind === 'agent' && COURT_SPEAKERS.has(raw)) output = `${raw}: ${output}`;
  if (ev.status === 'fallback') output = `fallback: ${output}`;
  if (ev.status === 'error') output = `error: ${output}`;

  const measured = hint.confidence ?? ev.confidence;
  const confidence = typeof measured === 'number' && Number.isFinite(measured)
    ? Math.min(1, Math.max(0, Math.round(measured * 100) / 100))
    : status === 'success' || status === 'approved' ? 1 : 0;

  return {
    timestamp,
    trace_id: traceId,
    agent_name: agent,
    action,
    input_summary: redact(ev.input_summary || '').trim() || '(none)',
    output_summary: output,
    target_agent: (hint.target ?? ev.target_agent ?? '').trim() || DEFAULT_TARGET[action],
    confidence,
    retry_count: clampRetry(ev.retry_count),
    status,
  };
}


export class TraceLogger {
  private file: string;
  private dir: string;
  private all: TraceLine[] = [];
  private agentAll: AgentLogLine[] = [];
  /** Lyndsay's run-wide trace id, `bundle_<runId>`. */
  readonly agentTraceId: string;
  private agentFile: string;

  constructor(runId: string, dir: string = path.resolve(process.cwd(), 'logs')) {
    this.file = path.join(dir, `run-${runId.replace(/[^A-Za-z0-9_-]/g, '_')}.jsonl`);
    this.dir = dir;
    this.agentTraceId = agentTraceId(runId);
    this.agentFile = path.join(dir, agentLogFileName(this.agentTraceId));
  }

  log(line: TraceEvent): string {
    const trace_id = crypto.randomUUID();
    const full: TraceLine = {
      timestamp: new Date().toISOString(),
      trace_id,
      agent_name: line.agent_name,
      action: line.action,
      input_summary: redact(line.input_summary),
      output_summary: redact(line.output_summary),
      target_agent: line.target_agent,
      confidence: line.confidence,
      retry_count: line.retry_count,
      status: line.status,
    };
    this.all.push(full);
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.appendFileSync(this.file, JSON.stringify(full) + '\n', 'utf8');
    } catch {
      /* tracing must never crash a run; the in-memory copy still holds the line */
    }
    this.writeAgentLine(line, full.timestamp);
    return trace_id;
  }

  /** Same event, Lyndsay's format: logs/run_<trace_id>.jsonl plus stdout. Invalid lines are never written. */
  private writeAgentLine(ev: TraceEvent, timestamp: string): void {
    let agentLine: AgentLogLine | null = null;
    try { agentLine = toAgentLogLine(ev, this.agentTraceId, timestamp); } catch { return; }
    if (!agentLine) return;
    const problems = checkAgentLogLine(agentLine);
    if (problems.length) {
      process.stderr.write(`[agent-log] line rejected (${problems.join('; ')}): ${ev.agent_name}/${ev.action}\n`);
      return;
    }
    this.agentAll.push(agentLine);
    const text = JSON.stringify(agentLine);
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.appendFileSync(this.agentFile, text + '\n', 'utf8');
    } catch {
      /* never crash a run */
    }
    try { process.stdout.write(text + '\n'); } catch { /* ignore */ }
  }

  lines(): TraceLine[] {
    return [...this.all];
  }

  /** Lines written in Lyndsay's format this run. */
  agentLines(): AgentLogLine[] {
    return [...this.agentAll];
  }
}

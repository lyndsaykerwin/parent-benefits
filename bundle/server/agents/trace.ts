import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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

export class TraceLogger {
  private file: string;
  private dir: string;
  private all: TraceLine[] = [];

  constructor(runId: string, dir: string = path.resolve(process.cwd(), 'logs')) {
    this.file = path.join(dir, `run-${runId.replace(/[^A-Za-z0-9_-]/g, '_')}.jsonl`);
    this.dir = dir;
  }

  log(line: Omit<TraceLine, 'timestamp' | 'trace_id'>): string {
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
    return trace_id;
  }

  lines(): TraceLine[] {
    return [...this.all];
  }
}

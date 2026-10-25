import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Router } from 'express';
import { agentLogFileName, agentTraceId, checkAgentLogLine, type AgentLogLine } from '../../shared/agentLog';

/**
 * Owner-only agent log for one run (plan sections 1c and 4; tracker M11).
 * Returns Lyndsay's 10-field trace lines for the run, plus the agents' workspace notes (item 37) that
 * the run copied into its detailed trace. Parents never get it: no reviewer code means 403 and no body.
 */

export interface AgentLogRouteDeps {
  /** Reviewer-mode token (env REVIEWER_MODE_TOKEN). Empty means Reviewer mode is off. */
  reviewerToken: () => string;
  /** Folder the run wrote its trace files into (default `logs`). */
  logsDir?: () => string;
}

/** One workspace note as it is rebuilt from the run's trace (the trace keeps everything except the evidence SQL). */
export interface AgentLogNote {
  from_agent: string;
  to_agent: string;
  type: string;
  about: string;
  round: number;
  body: string;
}

/** A memory line about lessons (saved, or recalled for this run), shown beside the notes. */
export interface AgentLogLesson {
  action: 'add_lesson' | 'recall_lessons';
  input: string;
  output: string;
}

export interface AgentLogResponse {
  runId: string;
  traceId: string;
  lines: AgentLogLine[];
  /** Lines in the file that were damaged or not in her format. Never passed on. */
  skipped: number;
  notes: AgentLogNote[];
  lessons: AgentLogLesson[];
  /** Which store held the notes ('hmem-local' or 'fallback-memory'); null when the run never logged workspace_open. */
  backend: 'hmem-local' | 'fallback-memory' | null;
}

const RUN_ID = /^[A-Za-z0-9_-]{1,200}$/;

function tokenOk(supplied: unknown, expected: string): boolean {
  if (!expected || typeof supplied !== 'string' || !supplied) return false;
  const a = crypto.createHash('sha256').update(supplied).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function readJsonl(file: string): unknown[] | null {
  let text: string;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return null; }
  return text.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) as unknown; } catch { return undefined; } });
}

// workspace.ts writes: input "<type> <from> -> <to> about <about> (round <n>)", output "[fallback-memory] posted <type> to <to>: <body>".
const NOTE_INPUT = /^(\w+) (.+?) -> (.+?) about (.+) \(round (\d)\)$/;
const NOTE_OUTPUT = /^(?:\[fallback-memory\] )?posted \w+ to .+?: ([\s\S]*)$/;

interface DetailedLine { agent_name?: unknown; action?: unknown; input_summary?: unknown; output_summary?: unknown }

/** Rebuild notes and lesson lines from the run's detailed trace (agent 'memory' lines written by the workspace). */
function workspaceFrom(rows: unknown[]): Pick<AgentLogResponse, 'notes' | 'lessons' | 'backend'> {
  const notes: AgentLogNote[] = [];
  const lessons: AgentLogLesson[] = [];
  let backend: AgentLogResponse['backend'] = null;
  for (const raw of rows) {
    const r = raw as DetailedLine | undefined;
    if (!r || r.agent_name !== 'memory') continue;
    const input = String(r.input_summary ?? '');
    const output = String(r.output_summary ?? '');
    switch (r.action) {
      case 'workspace_open': {
        const m = /^backend (hmem-local|fallback-memory):/.exec(output);
        if (m) backend = m[1] as AgentLogResponse['backend'];
        break;
      }
      case 'workspace_fallback': backend = 'fallback-memory'; break;
      case 'post_note': {
        const i = NOTE_INPUT.exec(input);
        const o = NOTE_OUTPUT.exec(output);
        if (i && o) notes.push({ type: i[1], from_agent: i[2], to_agent: i[3], about: i[4], round: Number(i[5]), body: o[1] });
        break;
      }
      case 'add_lesson': case 'recall_lessons':
        lessons.push({ action: r.action, input, output });
        break;
      default: break;
    }
  }
  return { notes, lessons, backend };
}

export function createAgentLogRouter(deps: AgentLogRouteDeps): Router {
  const router = Router();
  const dir = () => deps.logsDir?.() ?? path.resolve('logs');

  router.get('/api/runs/:runId/agent-log', (req, res) => {
    if (!tokenOk(req.header('x-reviewer-token'), deps.reviewerToken())) {
      return res.status(403).json({ error: 'The agent log is for the reviewer only.' });
    }
    const runId = req.params.runId;
    if (!RUN_ID.test(runId)) return res.status(404).json({ error: 'Run not found' });
    const traceId = agentTraceId(runId);
    const rows = readJsonl(path.join(dir(), agentLogFileName(traceId)));
    if (!rows) return res.status(404).json({ error: 'No agent log for this run' });

    const lines = rows.filter((r): r is AgentLogLine => checkAgentLogLine(r).length === 0);
    const detailed = readJsonl(path.join(dir(), `run-${runId}.jsonl`)) ?? [];
    const body: AgentLogResponse = { runId, traceId, lines, skipped: rows.length - lines.length, ...workspaceFrom(detailed) };
    return res.json(body);
  });

  return router;
}

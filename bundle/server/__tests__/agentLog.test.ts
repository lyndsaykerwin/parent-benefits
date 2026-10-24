import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  AGENT_NAMES, AGENT_ACTIONS, AGENT_STATUSES, checkAgentLogLine, isAgentLogLine, agentTraceId, agentLogFileName,
} from '@shared/agentLog';
import { TraceLogger, toAgentLogLine, stdoutEnabled } from '../agents/trace';

const good = {
  timestamp: '2026-10-24T18:00:00.000Z', trace_id: 'bundle_r1', agent_name: 'FactChecker', action: 'fact_check',
  input_summary: 'card c1', output_summary: 'exact match', target_agent: 'ParentFeed', confidence: 1, retry_count: 0, status: 'success',
};

describe('agent log enums', () => {
  it('match Lyndsay\'s fixed lists exactly', () => {
    expect(AGENT_NAMES).toEqual(['Orchestrator', 'PhotoReader', 'ClawbackHunter', 'RecallChecker', 'BenefitsPlanner', 'FinePrintCourt', 'FactChecker', 'CoachAI']);
    expect(AGENT_ACTIONS).toEqual(['query_zetaris', 'vision_extract', 'evaluate_offer', 'court_debate', 'fact_check', 'retry_request', 'recall_hmem', 'approve_card', 'reject_card']);
    expect(AGENT_STATUSES).toEqual(['success', 'retrying', 'needs_revision', 'rejected', 'approved']);
  });
  it('trace id and file name follow the labelled default', () => {
    expect(agentTraceId('r1')).toBe('bundle_r1');
    expect(agentLogFileName('bundle_r1')).toBe('run_bundle_r1.jsonl');
  });
});

describe('checkAgentLogLine', () => {
  it('accepts a valid line', () => {
    expect(checkAgentLogLine(good)).toEqual([]);
    expect(isAgentLogLine(good)).toBe(true);
  });
  it.each([
    ['agent_name', 'fact_checker'], ['action', 'verify'], ['status', 'ok'], ['confidence', null],
    ['confidence', 1.5], ['retry_count', 3], ['retry_count', 0.5], ['timestamp', 'yesterday'],
    ['target_agent', ''], ['input_summary', 7],
  ])('rejects a wrong %s (%p)', (k, v) => {
    expect(checkAgentLogLine({ ...good, [k]: v }).length).toBeGreaterThan(0);
  });
  it('rejects extra and missing fields', () => {
    expect(checkAgentLogLine({ ...good, extra: 1 })).toContain('unknown field: extra');
    const { status: _s, ...noStatus } = good;
    expect(checkAgentLogLine(noStatus)).toContain('missing field: status');
    expect(checkAgentLogLine(null)).toEqual(['not an object']);
  });
});

const ev = (o: Partial<Parameters<typeof toAgentLogLine>[0]>) => ({
  agent_name: 'orchestrator', action: 'x', input_summary: 'in', output_summary: 'out',
  target_agent: null, confidence: null, retry_count: 0, status: 'ok' as const, ...o,
});

describe('translation rules (plan 1c)', () => {
  const t = (o: Partial<Parameters<typeof toAgentLogLine>[0]>) => toAgentLogLine(ev(o), 'bundle_r', '2026-10-24T18:00:00.000Z');

  it('maps agent names', () => {
    expect(t({ agent_name: 'clawback', action: 'price_adjustment' })?.agent_name).toBe('ClawbackHunter');
    expect(t({ agent_name: 'recall', action: 'recall_match' })?.agent_name).toBe('RecallChecker');
    expect(t({ agent_name: 'benefits', action: 'benefit_match' })?.agent_name).toBe('BenefitsPlanner');
    expect(t({ agent_name: 'judge', action: 'rule' })?.agent_name).toBe('FinePrintCourt');
    expect(t({ agent_name: 'deal_hunter', action: 'argue' })?.agent_name).toBe('FinePrintCourt');
    expect(t({ agent_name: 'fact_checker', action: 'verify' })?.agent_name).toBe('FactChecker');
    expect(t({ agent_name: 'coach', action: 'explain' })?.agent_name).toBe('CoachAI');
  });
  it('names the court speaker in output_summary', () => {
    expect(t({ agent_name: 'judge', action: 'rule', output_summary: 'keep' })?.output_summary).toBe('judge: keep');
  });
  it('writes Zetaris and memory lines under the calling agent', () => {
    const z = t({ agent_name: 'zetaris', action: 'query', caller: 'recall', status: 'ok' });
    expect(z).toMatchObject({ agent_name: 'RecallChecker', action: 'query_zetaris', status: 'success', target_agent: 'Zetaris' });
    const m = t({ agent_name: 'memory', action: 'recall_rules', caller: 'fine_print_court', confidence: 0.8 });
    expect(m).toMatchObject({ agent_name: 'FinePrintCourt', action: 'recall_hmem', confidence: 0.8, target_agent: 'Meterless H-MEM' });
    expect(t({ agent_name: 'zetaris', action: 'query' })?.agent_name).toBe('Orchestrator');
    expect(t({ agent_name: 'memory', action: 'rule_recalled' })).toMatchObject({ agent_name: 'FinePrintCourt', action: 'recall_hmem' });
  });
  it('maps actions and statuses', () => {
    expect(t({ agent_name: 'orchestrator', action: 'send_back', status: 'retry', retry_count: 1 })).toMatchObject({ action: 'retry_request', status: 'needs_revision', retry_count: 1 });
    expect(t({ agent_name: 'orchestrator', action: 'retry_transient', status: 'retry', retry_count: 1 })).toMatchObject({ action: 'retry_request', status: 'retrying' });
    expect(t({ agent_name: 'clawback', action: 'revise', status: 'blocked', retry_count: 2 })).toMatchObject({ action: 'reject_card', status: 'rejected' });
    expect(t({ agent_name: 'clawback', action: 'fsa_reimbursement' })).toMatchObject({ action: 'evaluate_offer', status: 'success' });
    expect(t({ agent_name: 'judge', action: 'rule' })?.action).toBe('court_debate');
    expect(t({ agent_name: 'fact_checker', action: 'verify', confidence: 1 })).toMatchObject({ action: 'fact_check', confidence: 1 });
    expect(t({ agent_name: 'orchestrator', action: 'drop', status: 'blocked' })).toMatchObject({ action: 'reject_card', status: 'rejected' });
  });
  it('writes fallbacks as success and errors as rejected, flagged in output_summary', () => {
    expect(t({ agent_name: 'recall', action: 'confirm_match', status: 'fallback', output_summary: 'x' })).toMatchObject({ status: 'success', output_summary: 'fallback: x' });
    expect(t({ agent_name: 'zetaris', action: 'query', status: 'error', output_summary: 'boom' })).toMatchObject({ status: 'rejected', output_summary: 'error: boom' });
  });
  it('lets the caller say exactly which of her fields apply', () => {
    expect(t({ agent_name: 'fact_checker', action: 'verify', agentLog: { action: 'approve_card', status: 'approved', target: 'ParentFeed', confidence: 1 } }))
      .toMatchObject({ action: 'approve_card', status: 'approved', target_agent: 'ParentFeed', confidence: 1 });
  });
  it('keeps housekeeping lines out', () => {
    for (const action of ['start', 'assemble', 'export_ledger']) expect(t({ agent_name: 'orchestrator', action })).toBeNull();
    expect(t({ agent_name: 'memory', action: 'add_rule' })).toBeNull();
    expect(t({ agent_name: 'memory', action: 'feedback' })).toBeNull();
    expect(t({ agent_name: 'mystery', action: 'x' })).toBeNull();
  });
  it('never makes up a confidence: no number measured means none claimed beyond code rules', () => {
    const l = t({ agent_name: 'clawback', action: 'price_adjustment', confidence: null });
    expect(l?.confidence).toBeGreaterThanOrEqual(0);
    expect(l?.confidence).toBeLessThanOrEqual(1);
  });
  it('writes agent_failed as a rejected line under the failed agent, starting "error:"', () => {
    const l = t({ agent_name: 'orchestrator', action: 'agent_failed', input_summary: 'clawback', output_summary: 'TypeError: x', status: 'error' });
    expect(l).toMatchObject({ agent_name: 'ClawbackHunter', action: 'reject_card', status: 'rejected', confidence: 0 });
    expect(l?.output_summary.startsWith('error:')).toBe(true);
    const o = t({ agent_name: 'orchestrator', action: 'agent_failed', input_summary: 'mystery', output_summary: 'boom', status: 'ok' });
    expect(o).toMatchObject({ agent_name: 'Orchestrator', status: 'rejected', output_summary: 'error: boom' });
  });
  it('confidence: code-only fallbacks get 0.50, never 1.00; Zetaris cache reads that pass keep 1.00', () => {
    expect(t({ agent_name: 'judge', action: 'rule_by_screen', status: 'fallback' })?.confidence).toBe(0.5);
    expect(t({ agent_name: 'judge', action: 'rule_by_screen', status: 'ok' })).toMatchObject({ confidence: 0.5, output_summary: 'fallback: judge: out' });
    expect(t({ agent_name: 'deal_hunter', action: 'argue', status: 'fallback' })?.confidence).toBe(0.5);
    expect(t({ agent_name: 'explain', action: 'explain', status: 'fallback' })?.confidence).toBe(0.5);
    expect(t({ agent_name: 'zetaris', action: 'query_fallback_cache', status: 'fallback', caller: 'benefits' })?.confidence).toBe(1);
    expect(t({ agent_name: 'zetaris', action: 'query', status: 'error' })?.confidence).toBe(0);
    expect(t({ agent_name: 'judge', action: 'rule_by_screen', status: 'blocked' })?.confidence).toBe(0);
    expect(t({ agent_name: 'explain', action: 'explain', status: 'fallback', confidence: 0.73 })?.confidence).toBe(0.73);
    expect(t({ agent_name: 'clawback', action: 'price_adjustment', status: 'ok' })?.confidence).toBe(1);
  });
  it('caps summaries at 200 characters', () => {
    const l = t({ agent_name: 'clawback', action: 'price_adjustment', input_summary: 'a'.repeat(500), output_summary: 'b'.repeat(500) });
    expect(l?.input_summary.length).toBe(200);
    expect(l?.output_summary.length).toBe(200);
    expect(l?.output_summary.endsWith('…')).toBe(true);
  });
  it('every translated line passes the checker', () => {
    const cases = [
      ev({ agent_name: 'clawback', action: 'revise', status: 'retry', retry_count: 5 }),
      ev({ agent_name: 'zetaris', action: 'query_fallback_cache', status: 'fallback', caller: 'benefits' }),
      ev({ agent_name: 'coach', action: 'explain', input_summary: '', output_summary: '' }),
    ];
    for (const c of cases) expect(checkAgentLogLine(toAgentLogLine(c, 'bundle_r', '2026-10-24T18:00:00.000Z'))).toEqual([]);
  });
});

describe('TraceLogger writes her log too', () => {
  let dir: string;
  let out: jest.SpyInstance;
  let err: jest.SpyInstance;
  const savedEnv = { NODE_ENV: process.env.NODE_ENV, AGENT_LOG_STDOUT: process.env.AGENT_LOG_STDOUT };
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlog-'));
    out = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    err = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    process.env.NODE_ENV = 'development'; // stdout is off under tests; turn it on for these checks
    delete process.env.AGENT_LOG_STDOUT;
  });
  afterEach(() => {
    out.mockRestore(); err.mockRestore();
    for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const errText = () => err.mock.calls.map((c) => String(c[0])).join('');
  const printedFor = (id: string) => out.mock.calls.map((c) => String(c[0])).filter((s) => s.includes(`"trace_id":"${id}"`));

  it('stdout switch: off when NODE_ENV=test or AGENT_LOG_STDOUT=false, on otherwise', () => {
    expect(stdoutEnabled({ NODE_ENV: 'test' })).toBe(false);
    expect(stdoutEnabled({ NODE_ENV: 'production', AGENT_LOG_STDOUT: 'false' })).toBe(false);
    expect(stdoutEnabled({ NODE_ENV: 'production', AGENT_LOG_STDOUT: 'FALSE' })).toBe(false);
    expect(stdoutEnabled({ NODE_ENV: 'production' })).toBe(true);
    expect(stdoutEnabled({})).toBe(true);
  });
  it('does not print to stdout when AGENT_LOG_STDOUT=false or NODE_ENV=test, but still writes the file', () => {
    process.env.AGENT_LOG_STDOUT = 'false';
    const a = new TraceLogger('off1', dir);
    a.log(ev({ agent_name: 'fact_checker', action: 'verify', confidence: 1 }));
    delete process.env.AGENT_LOG_STDOUT; process.env.NODE_ENV = 'test';
    const b = new TraceLogger('off2', dir);
    b.log(ev({ agent_name: 'fact_checker', action: 'verify', confidence: 1 }));
    expect(printedFor('bundle_off1')).toHaveLength(0);
    expect(printedFor('bundle_off2')).toHaveLength(0);
    expect(fs.readFileSync(path.join(dir, 'run_bundle_off1.jsonl'), 'utf8').trim().split('\n')).toHaveLength(1);
    expect(fs.readFileSync(path.join(dir, 'run_bundle_off2.jsonl'), 'utf8').trim().split('\n')).toHaveLength(1);
  });
  it('a failed file append warns on stderr, never throws, and keeps the line in memory', () => {
    const blocker = path.join(dir, 'not-a-dir');
    fs.writeFileSync(blocker, 'x'); // a file where the log folder should be: mkdir/append must fail
    const tl = new TraceLogger('af', blocker);
    expect(() => tl.log(ev({ agent_name: 'fact_checker', action: 'verify', confidence: 1 }))).not.toThrow();
    expect(errText()).toMatch(/\[agent-log\] append failed/);
    expect(tl.agentLines()).toHaveLength(1);
    expect(tl.lines()).toHaveLength(1);
  });
  it('warns on stderr when a line is rejected by the checker, the agent is unknown, or translation throws', () => {
    const tl = new TraceLogger('rj', dir);
    tl.log(ev({ agent_name: 'fact_checker', action: 'verify', agentLog: { target: 'X', confidence: 1, status: 'bogus' as never } }));
    expect(errText()).toMatch(/\[agent-log\] line rejected \(status: bogus\): fact_checker\/verify/);
    tl.log(ev({ agent_name: 'mystery', action: 'x' }));
    expect(errText()).toMatch(/\[agent-log\] line dropped \(unknown agent or action\): mystery\/x/);
    const bad = ev({ agent_name: 'fact_checker', action: 'verify' });
    Object.defineProperty(bad, 'agentLog', { get() { throw new Error('kaboom'); } });
    tl.log(bad);
    expect(errText()).toMatch(/\[agent-log\] line dropped \(translation failed: kaboom\)/);
    err.mockClear();
    tl.log(ev({ agent_name: 'orchestrator', action: 'start' })); // housekeeping is silent by design
    expect(errText()).toBe('');
    expect(tl.agentLines()).toHaveLength(0);
    expect(fs.existsSync(path.join(dir, 'run_bundle_rj.jsonl'))).toBe(false);
  });

  it('appends valid lines to logs/run_bundle_<runId>.jsonl and prints them to stdout, keeping the old file', () => {
    const tl = new TraceLogger('r9', dir);
    tl.log(ev({ agent_name: 'orchestrator', action: 'start' }));
    tl.log(ev({ agent_name: 'fact_checker', action: 'verify', confidence: 1, input_summary: 'income $90,000' }));
    tl.log(ev({ agent_name: 'orchestrator', action: 'send_back', status: 'retry', retry_count: 1 }));
    const old = fs.readFileSync(path.join(dir, 'run-r9.jsonl'), 'utf8').trim().split('\n');
    expect(old).toHaveLength(3);
    const lines = fs.readFileSync(path.join(dir, 'run_bundle_r9.jsonl'), 'utf8').trim().split('\n').map((s) => JSON.parse(s));
    expect(lines).toHaveLength(2);
    for (const l of lines) { expect(checkAgentLogLine(l)).toEqual([]); expect(l.trace_id).toBe('bundle_r9'); }
    expect(lines[0].input_summary).not.toContain('90,000');
    const printed = printedFor('bundle_r9');
    expect(printed).toHaveLength(2);
    expect(JSON.parse(printed[0])).toEqual(lines[0]);
    expect(tl.agentLines()).toEqual(lines);
  });
});

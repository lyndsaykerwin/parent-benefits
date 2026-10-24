import fs from 'fs';
import os from 'os';
import path from 'path';
import { TraceLogger } from '../agents/trace';

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

const base = {
  agent_name: 'a', action: 'x', input_summary: 'in', output_summary: 'out',
  target_agent: null, confidence: null, retry_count: 0, status: 'ok' as const,
};

describe('TraceLogger', () => {
  it('writes one JSON line per log with every required field', () => {
    const t = new TraceLogger('r1', dir);
    const id = t.log({ ...base, target_agent: 'b', confidence: 0.9, retry_count: 1, status: 'retry' });
    const raw = fs.readFileSync(path.join(dir, 'run-r1.jsonl'), 'utf8').trim().split('\n');
    expect(raw).toHaveLength(1);
    const line = JSON.parse(raw[0]);
    expect(Object.keys(line).sort()).toEqual([
      'action', 'agent_name', 'confidence', 'input_summary', 'output_summary',
      'retry_count', 'status', 'target_agent', 'timestamp', 'trace_id',
    ]);
    expect(line.trace_id).toBe(id);
    expect(new Date(line.timestamp).toString()).not.toBe('Invalid Date');
    expect(line).toMatchObject({ target_agent: 'b', confidence: 0.9, retry_count: 1, status: 'retry' });
  });

  it('gives unique trace ids and lines() returns them in order', () => {
    const t = new TraceLogger('r2', dir);
    const a = t.log(base); const b = t.log({ ...base, action: 'y' });
    expect(a).not.toBe(b);
    expect(t.lines().map((l) => l.action)).toEqual(['x', 'y']);
  });

  it('creates the directory if missing', () => {
    const nested = path.join(dir, 'a', 'b');
    new TraceLogger('r3', nested).log(base);
    expect(fs.existsSync(path.join(nested, 'run-r3.jsonl'))).toBe(true);
  });

  it.each([
    ['annualIncome: 85000', 'annualIncome: [redacted]'],
    ['{"annualIncome":85000}', '{"annualIncome":[redacted]}'],
    ['annual_income=85000', 'annual_income=[redacted]'],
    ['household income $85,000 a year', 'household income [redacted] a year'],
    ['annualIncomeCents: 8500000', 'annualIncomeCents: [redacted]'],
  ])('redacts income in %s', (input, expected) => {
    const t = new TraceLogger('r4', dir);
    t.log({ ...base, input_summary: input, output_summary: input });
    const l = t.lines()[0];
    expect(l.input_summary).toBe(expected);
    expect(l.output_summary).toBe(expected);
    expect(fs.readFileSync(path.join(dir, 'run-r4.jsonl'), 'utf8')).not.toContain('85000');
  });

  it('redacts passwords in both forms', () => {
    const t = new TraceLogger('r5', dir);
    t.log({ ...base, input_summary: 'login password "hunter2 x" ok', output_summary: 'password=s3cret&u=1' });
    const l = t.lines()[0];
    expect(l.input_summary).toBe('login password "[redacted]" ok');
    expect(l.output_summary).toBe('password=[redacted]&u=1');
    const raw = fs.readFileSync(path.join(dir, 'run-r5.jsonl'), 'utf8');
    expect(raw).not.toContain('hunter2');
    expect(raw).not.toContain('s3cret');
  });

  it.each([
    ['{"password":"abc123"}', '{"password":"[redacted]"}'],
    ["{'password': 'abc123'}", "{'password': '[redacted]'}"],
    ['Password is abc123', 'Password is [redacted]'],
    ['{"password":abc123}', '{"password":[redacted]}'],
  ])('redacts password in %s', (input, expected) => {
    const t = new TraceLogger('r7', dir);
    t.log({ ...base, input_summary: input });
    expect(t.lines()[0].input_summary).toBe(expected);
  });

  it('sanitises the run id in the file name', () => {
    new TraceLogger('../evil/id', dir).log(base);
    expect(fs.readdirSync(dir)).toEqual(['run-___evil_id.jsonl']);
  });

  it('leaves unrelated text alone', () => {
    const t = new TraceLogger('r6', dir);
    t.log({ ...base, input_summary: 'income tax credit lookup, 3 rows' });
    expect(t.lines()[0].input_summary).toBe('income tax credit lookup, 3 rows');
  });
});

import fs from 'fs';
import os from 'os';
import path from 'path';
import { BundleMemory } from '../adapters/memory';
import { TraceLogger } from '../agents/trace';
import { checkAgentLogLine } from '@shared/agentLog';
import { FEEDBACK_DELTAS } from '../../vendor/hmem/src/types';

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mem-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

const TEXT = 'free + >$5 shipping is not free';

describe('BundleMemory', () => {
  it('recalls a learned rule by a related query', () => {
    const m = new BundleMemory(path.join(dir, 'h'));
    const id = m.addRule(TEXT, 'feedback:3', 0.7, ['fb1']);
    const hits = m.recallRules('free shipping offer');
    expect(hits[0].id).toBe(id);
    expect(hits[0].text).toBe(TEXT);
    expect(hits[0].confidence).toBeCloseTo(0.7);
    expect(typeof hits[0].score).toBe('number');
  });

  it('returns nothing for an unrelated query', () => {
    const m = new BundleMemory(path.join(dir, 'h'));
    m.addRule(TEXT, 'feedback:3', 0.7, ['fb1']);
    expect(m.recallRules('quantum chromodynamics lattice')).toEqual([]);
  });

  it('feedback helpful raises confidence by the vendored delta; wrong lowers it', () => {
    const m = new BundleMemory(path.join(dir, 'h'));
    const id = m.addRule(TEXT, 'feedback:3', 0.7, ['fb1']);
    m.feedback(id, 'helpful');
    expect(m.recallRules('free shipping offer')[0].confidence).toBeCloseTo(0.7 + FEEDBACK_DELTAS.helpful);
    m.feedback(id, 'wrong');
    expect(m.recallRules('free shipping offer')[0].confidence)
      .toBeCloseTo(0.7 + FEEDBACK_DELTAS.helpful + FEEDBACK_DELTAS.wrong);
  });

  it('persists across instances and exports the ledger as JSON lines', () => {
    const h = path.join(dir, 'h');
    const id = new BundleMemory(h).addRule(TEXT, 'feedback:3', 0.7, ['fb1']);
    const m2 = new BundleMemory(h);
    expect(m2.recallRules('free shipping offer')[0].id).toBe(id);
    m2.feedback(id, 'helpful');
    const out = path.join(dir, 'out', 'ledger.jsonl');
    m2.exportLedger(out);
    const rows = fs.readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(['create', 'feedback']));
    expect(rows.every((r) => r.memoryId === id)).toBe(true);
  });

  it('traces adds, recalls and feedback', () => {
    const t = new TraceLogger('m1', path.join(dir, 'logs'));
    const m = new BundleMemory(path.join(dir, 'h'), t);
    const id = m.addRule(TEXT, 'feedback:3', 0.7, ['fb1']);
    m.recallRules('free shipping offer');
    m.feedback(id, 'helpful');
    expect(t.lines().map((l) => l.action)).toEqual(['add_rule', 'recall_rules', 'feedback']);
    expect(t.lines().every((l) => l.agent_name === 'memory')).toBe(true);
  });

  it('writes recall_hmem lines in Lyndsay\'s log under the calling agent', () => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const t = new TraceLogger('m2', path.join(dir, 'logs'));
    const base = new BundleMemory(path.join(dir, 'h'));
    const id = base.addRule(TEXT, 'feedback:3', 0.7, ['fb1']);
    const m = base.withTrace(t, 'fine_print_court');
    m.recallRules('free shipping offer');
    m.feedback(id, 'helpful');
    const her = t.agentLines();
    expect(her).toHaveLength(1);
    expect(her[0]).toMatchObject({ agent_name: 'FinePrintCourt', action: 'recall_hmem', status: 'success', confidence: 0.7 });
    expect(checkAgentLogLine(her[0])).toEqual([]);
    expect(t.lines()[0].agent_name).toBe('memory');
  });
});

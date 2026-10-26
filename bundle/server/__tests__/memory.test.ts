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

describe('BundleMemory notes and lessons (workspace storage)', () => {
  it('stores run notes with their tags and reads them back in order, scoped to the run', () => {
    const m = new BundleMemory(path.join(dir, 'h'));
    m.addNote('r1', '{"a":1}', ['about:o1'], 0.9);
    m.addNote('r1', '{"a":2}', ['about:o2'], 0.9);
    m.addNote('r2', '{"a":3}', ['about:o1'], 0.9);
    expect(m.notesForRun('r1').map((n) => n.content)).toEqual(['{"a":1}', '{"a":2}']);
    expect(m.notesForRun('r1')[0].tags).toEqual(expect.arrayContaining(['about:o1']));
    expect(m.notesForRun('r2')).toHaveLength(1);
  });

  it('a learned rule is still recalled after many runs of look-alike workspace notes (notes never crowd it out)', () => {
    const m = new BundleMemory(path.join(dir, 'h'));
    const rule = m.addRule('Reject offers whose savings depend on keeping a subscription active.', 'feedback:3', 0.8, ['a', 'b', 'c']);
    const finePrint = 'Save 20% on diapers when you keep a Subscribe & Save subscription active; savings end if the subscription is cancelled.';
    // Every run posts notes that quote the same fine print; they outscore the rule but are not case law.
    for (let run = 0; run < 12; run++) for (let i = 0; i < 4; i++) m.addNote(`run-${run}`, `claim about offer 1328: ${finePrint}`, ['claim'], 1);
    expect(m.recallRules(finePrint).map((r) => r.id)).toContain(rule);
  });

  it('a grading lesson is still recalled after many runs of look-alike workspace notes', () => {
    const m = new BundleMemory(path.join(dir, 'h'));
    const lesson = m.addLesson('A subscription discount ends when the subscription is cancelled.', '42', 0.9);
    const finePrint = 'Save 20% on diapers with an active subscription; the discount ends if the subscription is cancelled.';
    for (let run = 0; run < 12; run++) for (let i = 0; i < 4; i++) m.addNote(`run-${run}`, `verdict about offer 1328: ${finePrint}`, ['verdict'], 1);
    expect(m.recallLessons(finePrint).map((r) => r.id)).toContain(lesson);
  });

  it('keeps notes and lessons out of recallRules', () => {
    const m = new BundleMemory(path.join(dir, 'h'));
    m.addNote('r1', 'free shipping offer note', [], 0.9);
    m.addLesson('free shipping offer lesson', 'oc-1', 0.7);
    expect(m.recallRules('free shipping offer')).toEqual([]);
  });
});

import fs from 'fs';
import os from 'os';
import path from 'path';
import { BundleMemory } from '../adapters/memory';
import { TraceLogger } from '../agents/trace';
import { Workspace, WORKSPACE_NOTE_TYPES, type NoteStore } from '../agents/workspace';
import { checkAgentLogLine } from '@shared/agentLog';
import { FEEDBACK_DELTAS } from '../../vendor/hmem/src/types';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-'));
  jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
});
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

function make(runId = 'run1') {
  const trace = new TraceLogger(runId, path.join(dir, 'logs'));
  const memory = new BundleMemory(path.join(dir, 'h'));
  return { trace, memory, ws: new Workspace(runId, memory, trace) };
}

const note = (over: Record<string, unknown> = {}) => ({
  from_agent: 'ClawbackHunter', to_agent: 'RecallChecker', type: 'question' as const,
  about: 'offer-7', body: 'Is the Acme car seat on a recall list?', evidence_sql: 'SELECT * FROM v_recall_orders', round: 0,
  ...over,
}) as any;

describe('Workspace notes (item 37 message shape)', () => {
  it('posts a note and reads it back with every field, stamped with the run id', () => {
    const { ws } = make();
    const posted = ws.post(note());
    expect(posted.run_id).toBe('run1');
    const got = ws.read({ about: 'offer-7' });
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({
      run_id: 'run1', from_agent: 'ClawbackHunter', to_agent: 'RecallChecker', type: 'question',
      about: 'offer-7', body: 'Is the Acme car seat on a recall list?', evidence_sql: 'SELECT * FROM v_recall_orders', round: 0,
    });
  });

  it('accepts exactly the five note types', () => {
    expect([...WORKSPACE_NOTE_TYPES]).toEqual(['claim', 'question', 'answer', 'correction', 'verdict']);
    const { ws } = make();
    for (const t of WORKSPACE_NOTE_TYPES) expect(() => ws.post(note({ type: t }))).not.toThrow();
    expect(() => ws.post(note({ type: 'gossip' }))).toThrow(/type/);
  });

  it('rejects empty body, missing about, and a round outside 0-2', () => {
    const { ws } = make();
    expect(() => ws.post(note({ body: '  ' }))).toThrow(/body/);
    expect(() => ws.post(note({ about: '' }))).toThrow(/about/);
    expect(() => ws.post(note({ round: 3 }))).toThrow(/round/);
    expect(() => ws.post(note({ round: 1.5 }))).toThrow(/round/);
  });

  it('keeps notes in the order posted and filters by item, recipient, sender and type', () => {
    const { ws } = make();
    ws.post(note({ about: 'offer-1', body: 'first' }));
    ws.post(note({ about: 'offer-2', body: 'second', from_agent: 'RecallChecker', to_agent: 'ClawbackHunter', type: 'answer' }));
    ws.post(note({ about: 'offer-1', body: 'third', type: 'claim', to_agent: 'FactChecker' }));
    expect(ws.read({}).map((n: any) => n.body)).toEqual(['first', 'second', 'third']);
    expect(ws.read({ about: 'offer-1' }).map((n: any) => n.body)).toEqual(['first', 'third']);
    expect(ws.read({ to_agent: 'ClawbackHunter' }).map((n: any) => n.body)).toEqual(['second']);
    expect(ws.read({ from_agent: 'ClawbackHunter', type: 'claim' }).map((n: any) => n.body)).toEqual(['third']);
  });

  it('never shows one run\'s notes to another run, even on the same H-MEM folder', () => {
    const trace = new TraceLogger('a', path.join(dir, 'logs'));
    const memory = new BundleMemory(path.join(dir, 'h'));
    const a = new Workspace('runA', memory, trace);
    const b = new Workspace('runB', new BundleMemory(path.join(dir, 'h')), trace);
    a.post(note({ body: 'only in A' }));
    expect(b.read({})).toEqual([]);
    expect(a.read({})).toHaveLength(1);
  });

  it('masks incomes and passwords before a note is stored', () => {
    const { ws } = make();
    ws.post(note({ body: 'Family income $52,000 and password: hunter2 seen' }));
    const body = ws.read({})[0].body;
    expect(body).not.toContain('52,000');
    expect(body).not.toContain('hunter2');
  });

  it('notes never leak into the case-law rules the Judge recalls', () => {
    const { ws, memory } = make();
    ws.post(note({ body: 'free shipping offer looks fine' }));
    expect(memory.recallRules('free shipping offer')).toEqual([]);
  });

  it('survives a restart: a new Workspace on the same folder and run id reads the old notes', () => {
    const { ws } = make();
    ws.post(note());
    const trace = new TraceLogger('run1', path.join(dir, 'logs2'));
    const again = new Workspace('run1', new BundleMemory(path.join(dir, 'h')), trace);
    expect(again.read({ about: 'offer-7' })).toHaveLength(1);
  });
});

describe('Workspace trace copies', () => {
  it('copies every post and read into the detailed trace and Lyndsay\'s log', () => {
    const { ws, trace } = make();
    ws.post(note());
    ws.read({ about: 'offer-7' });
    const detailed = trace.lines().filter((l) => l.agent_name === 'memory');
    expect(detailed.map((l) => l.action)).toEqual(['workspace_open', 'post_note', 'read_notes']);
    const her = trace.agentLines();
    expect(her.length).toBeGreaterThanOrEqual(2);
    for (const l of her) expect(checkAgentLogLine(l)).toEqual([]);
    const posted = her.find((l) => l.input_summary.includes('question'));
    expect(posted).toMatchObject({ agent_name: 'ClawbackHunter', action: 'recall_hmem', target_agent: 'RecallChecker', status: 'success' });
    expect(posted!.output_summary).toMatch(/posted/i);
  });

  it('the copy of a note never contains an income or password', () => {
    const { ws, trace } = make();
    ws.post(note({ body: 'income $90,000 password is abc123' }));
    const all = JSON.stringify(trace.lines()) + JSON.stringify(trace.agentLines());
    expect(all).not.toContain('90,000');
    expect(all).not.toContain('abc123');
  });

  it('ledger export still works and records each note as a create', () => {
    const { ws, memory } = make();
    ws.post(note());
    const out = path.join(dir, 'ledger.jsonl');
    memory.exportLedger(out);
    const rows = fs.readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(rows.filter((r) => r.action === 'create')).toHaveLength(1);
  });
});

describe('Workspace backend honesty', () => {
  it('says it is running on the local H-MEM engine', () => {
    const { ws, trace } = make();
    expect(ws.backend).toBe('hmem-local');
    const open = trace.lines().find((l) => l.action === 'workspace_open')!;
    expect(open.output_summary).toMatch(/hmem-local/);
    expect(open.status).toBe('ok');
  });

  it('falls back to an in-process list when H-MEM fails, keeps working, and logs it as a fallback', () => {
    const boom = () => { throw new Error('disk full'); };
    const broken: NoteStore = {
      addNote: boom, notesForRun: boom, addLesson: boom, recallLessons: boom, feedback: boom,
    };
    const trace = new TraceLogger('fb', path.join(dir, 'logs'));
    const ws = new Workspace('fb', broken, trace);
    ws.post(note());
    expect(ws.backend).toBe('fallback-memory');
    expect(ws.read({ about: 'offer-7' })).toHaveLength(1);
    const lines = trace.lines().filter((l) => l.agent_name === 'memory');
    expect(lines.some((l) => l.status === 'fallback' && /fallback-memory/.test(l.output_summary))).toBe(true);
    // lessons keep working in the fallback too, and feedback still moves the trust number
    const id = ws.addLesson({ text: 'mail-in rebates at Acme pay in about 8 weeks', offerCheckId: 'oc-1', confidence: 0.6 });
    expect(ws.recallLessons('Acme rebate payout')[0]).toMatchObject({ id, offerCheckId: 'oc-1' });
    ws.feedbackLesson(id, 'helpful');
    expect(ws.recallLessons('Acme rebate payout')[0].confidence).toBeCloseTo(0.6 + FEEDBACK_DELTAS.helpful);
  });
});

describe('Workspace mid-run failure', () => {
  it('switches to fallback-memory honestly when the store fails after opening fine', () => {
    let broken = false;
    const real = new BundleMemory(path.join(dir, 'h'));
    const flaky: NoteStore = {
      addNote: (...a) => { if (broken) throw new Error('disk full'); return real.addNote(...a); },
      notesForRun: (r) => { if (broken) throw new Error('disk full'); return real.notesForRun(r); },
      addLesson: (...a) => real.addLesson(...a), recallLessons: (...a) => real.recallLessons(...a),
      feedback: (...a) => real.feedback(...a),
    };
    const trace = new TraceLogger('mid', path.join(dir, 'logs'));
    const ws = new Workspace('mid', flaky, trace);
    ws.post(note({ body: 'before failure' }));
    expect(ws.backend).toBe('hmem-local');
    broken = true;
    ws.post(note({ body: 'after failure' }));
    expect(ws.backend).toBe('fallback-memory');
    expect(ws.read({}).map((n: any) => n.body)).toEqual(['before failure', 'after failure']);
    const lines = trace.lines().filter((l) => l.agent_name === 'memory');
    expect(lines.some((l) => l.action === 'workspace_fallback' && l.status === 'fallback')).toBe(true);
    expect(lines.filter((l) => l.action === 'post_note').map((l) => l.status)).toEqual(['ok', 'fallback']);
  });

  it('masks sender, recipient and item names too', () => {
    const { ws } = make();
    const n = ws.post(note({ about: 'offer income $77,000', from_agent: 'password: zzz1', to_agent: 'income 88,000' }));
    expect(JSON.stringify(n)).not.toMatch(/77,000|88,000|zzz1/);
  });
});

describe('Workspace lessons', () => {
  it('stores a grading lesson pointing at an offer_checks row and recalls it by topic', () => {
    const { ws } = make();
    const id = ws.addLesson({ text: 'Acme mail-in rebates pay in about 8 weeks and take about 15 minutes', offerCheckId: 'oc-42', confidence: 0.7 });
    const hits = ws.recallLessons('Acme rebate payout');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ id, offerCheckId: 'oc-42' });
    expect(hits[0].confidence).toBeCloseTo(0.7);
  });

  it('lessons do not come back as case-law rules, and rules do not come back as lessons', () => {
    const { ws, memory } = make();
    ws.addLesson({ text: 'free shipping offers at Acme are not free', offerCheckId: 'oc-1', confidence: 0.7 });
    memory.addRule('free + >$5 shipping is not free', 'feedback:3', 0.7, ['fb1']);
    expect(memory.recallRules('free shipping offer').map((r) => r.text)).toEqual(['free + >$5 shipping is not free']);
    expect(ws.recallLessons('free shipping offer').map((r) => r.text)).toEqual(['free shipping offers at Acme are not free']);
  });

  it('helpful raises and wrong lowers a lesson\'s trust number by the engine\'s own amounts', () => {
    const { ws } = make();
    const id = ws.addLesson({ text: 'Acme mail-in rebates pay in about 8 weeks', offerCheckId: 'oc-1', confidence: 0.7 });
    ws.feedbackLesson(id, 'helpful');
    expect(ws.recallLessons('Acme rebate payout')[0].confidence).toBeCloseTo(0.7 + FEEDBACK_DELTAS.helpful);
    ws.feedbackLesson(id, 'wrong');
    expect(ws.recallLessons('Acme rebate payout')[0].confidence).toBeCloseTo(0.7 + FEEDBACK_DELTAS.helpful + FEEDBACK_DELTAS.wrong);
  });

  it('traces lesson writes, recalls and feedback', () => {
    const { ws, trace } = make();
    const id = ws.addLesson({ text: 'Acme rebates pay slowly', offerCheckId: 'oc-1', confidence: 0.7 });
    ws.recallLessons('Acme rebates');
    ws.feedbackLesson(id, 'wrong');
    expect(trace.lines().filter((l) => l.agent_name === 'memory').map((l) => l.action))
      .toEqual(['workspace_open', 'add_lesson', 'recall_lessons', 'lesson_feedback']);
  });

  it('uses no AI extraction, dreaming or sleep: only the local engine, no network', async () => {
    const realFetch = global.fetch;
    const calls: string[] = [];
    global.fetch = (async (u: any) => { calls.push(String(u)); throw new Error('network'); }) as typeof fetch;
    try {
      const { ws, memory } = make();
      ws.post(note());
      ws.addLesson({ text: 'x lesson text here', offerCheckId: 'oc-1', confidence: 0.5 });
      ws.recallLessons('lesson');
      expect(calls).toEqual([]);
      const out = path.join(dir, 'l.jsonl');
      memory.exportLedger(out);
      const actions = fs.readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l).action);
      expect(actions.some((a: string) => /^(sleep|dream)/.test(a))).toBe(false);
    } finally { global.fetch = realFetch; }
  });
});

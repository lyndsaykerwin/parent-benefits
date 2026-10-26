import os from 'os';
import fs from 'fs';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { createBundleRouter } from '../routes/bundleRoutes';
import { createDefaultApiDeps } from '../bundleDeps';
import { bodyParsers } from '../middleware/bodyLimit';
import { BundleMemory } from '../adapters/memory';
import { AGENT_ACTIONS, AGENT_NAMES, agentTraceId, checkAgentLogLine, type AgentLogLine } from '@shared/agentLog';
import { LOOP_KINDS, loopsOf } from '@shared/agentLoops';

/**
 * Trace-log coverage (plan section 1c, tracker M9/M11): a real sample run for every sample family, no keys, no database.
 * Every line of the agent log must pass Lyndsay's checker; each named agent must appear where it ran; every loop that
 * can happen offline must show up as a round; and none of it may reach a parent's response.
 */
const FAMILIES = ['maya', 'leo', 'ava', 'noor', 'cal', 'fern'] as const;
const saved = { ...process.env };

interface RunOut { runId: string; body: any; agentLines: AgentLogLine[]; detailed: any[]; file: string; stdoutLines: string[] }
const runs = new Map<string, RunOut>();

beforeAll(async () => {
  for (const k of ['DATABASE_URL', 'ZETARIS_BASE_URL', 'ZETARIS_ORG_ID', 'ZETARIS_API_KEY', 'MODEL_API_KEY', 'REVIEWER_MODE_TOKEN']) delete process.env[k];
  process.env.SAMPLE_MODE = 'true';
  const logsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-'));
  const memory = new BundleMemory(fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-mem-')));
  const deps = createDefaultApiDeps();
  const base = deps.makeRunDeps;
  deps.makeRunDeps = (f) => ({ ...base(f), logsDir, memory });
  deps.memory = memory;
  const app = express();
  app.use(...bodyParsers());
  app.use(createBundleRouter(deps));
  for (const id of FAMILIES) {
    const before = new Set(fs.readdirSync(logsDir));
    const res = await request(app).post('/api/run?wait=true').send({ familyId: id });
    expect(res.status).toBe(200);
    const fresh = fs.readdirSync(logsDir).filter((f) => !before.has(f));
    const agentFile = fresh.find((f) => f.startsWith('run_bundle_'))!;
    const detailedFile = fresh.find((f) => f.startsWith('run-'))!;
    const read = (f: string) => fs.readFileSync(path.join(logsDir, f), 'utf8').split('\n').filter(Boolean);
    const agentRaw = read(agentFile);
    runs.set(id, {
      runId: agentFile.replace(/^run_bundle_/, '').replace(/\.jsonl$/, ''), body: res.body, file: agentFile,
      agentLines: agentRaw.map((l) => JSON.parse(l)), detailed: read(detailedFile).map((l) => JSON.parse(l)), stdoutLines: agentRaw,
    });
  }
}, 120000);
afterAll(() => { process.env = { ...saved }; });

describe.each(FAMILIES)('agent log coverage: %s', (id) => {
  const run = () => runs.get(id)!;

  it('writes logs/run_bundle_<runId>.jsonl, one valid line per agent event, all under one trace id', () => {
    const { agentLines, runId, file } = run();
    expect(file).toBe(`run_${agentTraceId(runId)}.jsonl`);
    expect(agentLines.length).toBeGreaterThan(10);
    for (const l of agentLines) expect(checkAgentLogLine(l)).toEqual([]);
    expect(new Set(agentLines.map((l) => l.trace_id))).toEqual(new Set([agentTraceId(runId)]));
  });

  it('uses only her agent names and actions, with real 0.00-1.00 confidence and retry counts 0-2', () => {
    for (const l of run().agentLines) {
      expect(AGENT_NAMES).toContain(l.agent_name);
      expect(AGENT_ACTIONS).toContain(l.action);
      expect(l.confidence).toBeGreaterThanOrEqual(0);
      expect(l.confidence).toBeLessThanOrEqual(1);
      expect([0, 1, 2]).toContain(l.retry_count);
    }
  });

  it('is the same story as the detailed trace: every detailed event that fits her nine actions has a line, in order', () => {
    const { agentLines, detailed } = run();
    expect(agentLines.length).toBeLessThanOrEqual(detailed.length);
    // Housekeeping lines (run start, ledger export, memory writes) are the only ones allowed to be missing.
    const housekeeping = new Set(['start', 'assemble', 'export_ledger', 'add_rule', 'feedback']);
    const expected = detailed.filter((d) => !housekeeping.has(d.action)).length;
    expect(agentLines.length).toBe(expected);
    const times = agentLines.map((l) => Date.parse(l.timestamp));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('names the agents that ran: the Orchestrator, the maker agents, the Court, and the Fact-Checker with approvals', () => {
    const { agentLines } = run();
    const names = new Set(agentLines.map((l) => l.agent_name));
    for (const n of ['Orchestrator', 'BenefitsPlanner', 'FinePrintCourt', 'FactChecker'] as const) expect(names).toContain(n);
    expect(agentLines.some((l) => l.agent_name === 'FactChecker' && l.action === 'approve_card' && l.status === 'approved' && l.target_agent === 'ParentFeed')).toBe(true);
    // Zetaris questions are written under the agent that asked, never under a made-up name.
    const asked = agentLines.filter((l) => l.action === 'query_zetaris');
    expect(asked.length).toBeGreaterThan(0);
    expect(new Set(asked.map((l) => l.agent_name)).size).toBeGreaterThan(1);
  });

  it('approved cards each get an approve_card line (never more approvals than cards)', () => {
    const { agentLines, body } = run();
    const approved = agentLines.filter((l) => l.action === 'approve_card').length;
    // Fillers and stand-ins are not agent output, so the feed can have more cards than approvals, never fewer approvals than agent cards.
    expect(approved).toBeGreaterThan(0);
    expect(approved).toBeLessThanOrEqual(body.cards.length);
  });

  it('the loops that can happen offline are counted as rounds, and only from lines that are really loop lines', () => {
    for (const l of run().agentLines) {
      for (const k of loopsOf(l)) expect(LOOP_KINDS).toContain(k);
    }
    const counts: Record<string, number> = {};
    for (const l of run().agentLines) for (const k of loopsOf(l)) counts[k] = (counts[k] ?? 0) + 1;
    // Offline, with no model: the ordinary outcome line of a court case is not a rebuttal.
    expect(counts.rebuttal ?? 0).toBe(0);
    expect(counts.photo_retry ?? 0).toBe(0);
    // Saved grades: practice mode replays the recorded Zetaris answer, so an offer graded before is reused (no AI).
    // Every reuse line is the Court's, names one offer, says so plainly, and never reuses more grades than the read found.
    const court = run().agentLines.filter((l) => l.agent_name === 'FinePrintCourt');
    const read = court.find((l) => /^\d+ offer\(s\) in play$/.test(l.input_summary))!;
    expect(read.output_summary).toMatch(/^(no saved grades yet|saved grades unavailable.*|\d+ saved grade\(s\) found)$/);
    const found = Number(/^(\d+) saved grade\(s\) found$/.exec(read.output_summary)?.[1] ?? 0);
    const reuses = run().agentLines.filter((l) => loopsOf(l).includes('saved_verdict'));
    expect(reuses).toHaveLength(counts.saved_verdict ?? 0);
    expect(reuses.length).toBeLessThanOrEqual(found);
    for (const l of reuses) {
      expect(l.agent_name).toBe('FinePrintCourt');
      expect(l.action).toBe('court_debate');
      expect(l.input_summary).toMatch(/^offer \d+$/);
      expect(l.output_summary).toMatch(/^judge: \w+: same wording as when it was graded, so the saved grade is reused \(no AI\)$/);
    }
    expect(new Set(reuses.map((l) => l.input_summary)).size).toBe(reuses.length);
    if (found === 0) expect(reuses).toHaveLength(0);
  });

  it('the parent response carries none of it: no agent log, trace ids, debate text or SQL', () => {
    const text = JSON.stringify(run().body);
    for (const w of ['agent_name', 'input_summary', 'output_summary', 'target_agent', 'retry_count', 'trace_id', 'traceId', 'evidenceSql', 'bundle_' + run().runId, 'SELECT ']) {
      expect(text).not.toContain(w);
    }
  });
});

describe('agent log coverage: across all six families', () => {
  it('Maya shows the eligibility loop: one counter-question for Zetaris, then a confirm or drop per benefit', () => {
    const maya = runs.get('maya')!.agentLines;
    const asked = maya.filter((l) => l.agent_name === 'FinePrintCourt' && /one counter-question for Zetaris/.test(l.output_summary));
    expect(asked).toHaveLength(1);
    expect(maya.filter((l) => loopsOf(l).includes('eligibility')).length).toBeGreaterThanOrEqual(2);
    expect(asked[0].status).toBe('retrying');
    expect(asked[0].retry_count).toBe(1);
  });

  it('Maya shows the recall check on her KEAWIS alert, and the saved-verdict question answers honestly with no recording', () => {
    const maya = runs.get('maya')!.agentLines;
    const recall = maya.filter((l) => loopsOf(l).includes('recall_check'));
    expect(recall.length).toBeGreaterThanOrEqual(1);
    expect(recall[0].status).toBe('success');
    expect(maya.some((l) => l.agent_name === 'FinePrintCourt' && /no saved grades yet|saved grades unavailable|saved grade\(s\) found/.test(l.output_summary))).toBe(true);
  });

  it('every offer in court gets exactly one line: a fresh outcome or a reused saved grade; an ordinary outcome ("no rebuttal needed") is not a rebuttal', () => {
    let fresh = 0;
    let reused = 0;
    for (const [id, r] of runs) {
      const court = r.agentLines.filter((l) => l.agent_name === 'FinePrintCourt');
      const inPlay = Number(/^(\d+) offer\(s\) in play$/.exec(court.find((l) => /offer\(s\) in play$/.test(l.input_summary))!.input_summary)![1]);
      const outcomes = court.filter((l) => /^offer \d+ outcome$/.test(l.input_summary));
      const reuses = court.filter((l) => loopsOf(l).includes('saved_verdict'));
      for (const o of outcomes) {
        expect(o.output_summary).toMatch(/no rebuttal needed/);
        expect(loopsOf(o)).toEqual([]);
      }
      const ids = [...outcomes.map((l) => /^offer (\d+)/.exec(l.input_summary)![1]), ...reuses.map((l) => /^offer (\d+)/.exec(l.input_summary)![1])];
      expect(new Set(ids).size).toBe(ids.length); // no offer is both judged and reused, or listed twice
      expect({ id, lines: ids.length }).toEqual({ id, lines: inPlay });
      fresh += outcomes.length;
      reused += reuses.length;
    }
    // Across the sample families both paths show up: some offers are judged fresh, some reuse a recorded grade.
    expect(fresh).toBeGreaterThan(0);
    expect(reused).toBeGreaterThan(0);
  });

  it('no line in any run contains an income number or a password', () => {
    for (const r of runs.values()) {
      const text = r.stdoutLines.join('\n');
      expect(text).not.toMatch(/annual[_ ]?income\w*\W{0,4}\$?\d/i);
      expect(text).not.toMatch(/password["']?\s*[:=]\s*["']?(?!\[redacted\])\w/i);
    }
  });
});

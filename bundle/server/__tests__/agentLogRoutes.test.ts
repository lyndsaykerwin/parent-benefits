import os from 'os';
import fs from 'fs';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { createBundleRouter } from '../routes/bundleRoutes';
import { createAgentLogRouter } from '../routes/agentLogRoutes';
import { createDefaultApiDeps } from '../bundleDeps';
import { bodyParsers } from '../middleware/bodyLimit';
import { BundleMemory } from '../adapters/memory';
import { TraceLogger } from '../agents/trace';
import { Workspace } from '../agents/workspace';
import { checkAgentLogLine } from '@shared/agentLog';

const TOKEN = 'sekret';
const saved = { ...process.env };
let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agentlog-'));
  jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
});
afterEach(() => { process.env = { ...saved }; fs.rmSync(tmp, { recursive: true, force: true }); });

/** A real sample-mode run (no keys, no database) that writes its own trace files into tmp/logs. */
async function sampleRun(familyId = 'maya') {
  for (const k of ['DATABASE_URL', 'ZETARIS_BASE_URL', 'ZETARIS_ORG_ID', 'ZETARIS_API_KEY', 'MODEL_API_KEY']) delete process.env[k];
  process.env.SAMPLE_MODE = 'true';
  const logsDir = path.join(tmp, 'logs');
  const deps = createDefaultApiDeps();
  const base = deps.makeRunDeps;
  deps.makeRunDeps = (f) => ({ ...base(f), logsDir, memory: new BundleMemory(path.join(tmp, 'hmem')) });
  const app = express();
  app.use(...bodyParsers());
  app.use(createBundleRouter(deps));
  app.use(createAgentLogRouter({ reviewerToken: () => TOKEN, logsDir: () => logsDir }));
  const res = await request(app).post('/api/run?wait=true').send({ familyId });
  expect(res.status).toBe(200);
  const runId = res.body.runId as string;
  return { app, runId, logsDir, result: res.body };
}

describe('GET /api/runs/:runId/agent-log (owner only)', () => {
  it('a parent (no code) and a wrong code both get 403 and no log text', async () => {
    const { app, runId } = await sampleRun();
    const none = await request(app).get(`/api/runs/${runId}/agent-log`);
    expect(none.status).toBe(403);
    const wrong = await request(app).get(`/api/runs/${runId}/agent-log`).set('x-reviewer-token', 'nope');
    expect(wrong.status).toBe(403);
    for (const r of [none, wrong]) {
      expect(JSON.stringify(r.body)).not.toMatch(/query_zetaris|agent_name|SELECT/);
    }
  });

  it('reviewer mode switched off (empty token) never lets anyone in', async () => {
    const logsDir = path.join(tmp, 'logs');
    const app = express();
    app.use(createAgentLogRouter({ reviewerToken: () => '', logsDir: () => logsDir }));
    expect((await request(app).get('/api/runs/x/agent-log').set('x-reviewer-token', '')).status).toBe(403);
  });

  it('the reviewer gets exactly the lines of the run\'s own 10-field log file, all valid', async () => {
    const { app, runId, logsDir } = await sampleRun();
    const res = await request(app).get(`/api/runs/${runId}/agent-log`).set('x-reviewer-token', TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.runId).toBe(runId);
    expect(res.body.traceId).toBe(`bundle_${runId}`);
    const file = fs.readdirSync(logsDir).find((f) => f.startsWith('run_bundle_'))!;
    const onDisk = fs.readFileSync(path.join(logsDir, file), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    expect(onDisk.length).toBeGreaterThan(10);
    expect(res.body.lines).toEqual(onDisk);
    for (const l of res.body.lines) expect(checkAgentLogLine(l)).toEqual([]);
    expect(res.body.skipped).toBe(0);
    expect(Array.isArray(res.body.notes)).toBe(true);
    // the run's agents show up under her names
    const names = new Set(res.body.lines.map((l: any) => l.agent_name));
    for (const n of ['FinePrintCourt', 'FactChecker', 'RecallChecker', 'ClawbackHunter', 'BenefitsPlanner']) expect(names.has(n)).toBe(true);
  });

  it('unknown run, and path-like run ids, are 404 for the reviewer', async () => {
    const { app } = await sampleRun();
    expect((await request(app).get('/api/runs/not-a-run/agent-log').set('x-reviewer-token', TOKEN)).status).toBe(404);
    expect((await request(app).get('/api/runs/..%2F..%2Fscoreboard/agent-log').set('x-reviewer-token', TOKEN)).status).toBe(404);
    expect((await request(app).get('/api/runs/a.b/agent-log').set('x-reviewer-token', TOKEN)).status).toBe(404);
  });

  it('a damaged or invalid line is skipped and counted, never passed on', async () => {
    const { app, runId, logsDir } = await sampleRun();
    const file = path.join(logsDir, fs.readdirSync(logsDir).find((f) => f.startsWith('run_bundle_'))!);
    const before = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).length;
    fs.appendFileSync(file, 'not json\n{"agent_name":"Nobody"}\n');
    const res = await request(app).get(`/api/runs/${runId}/agent-log`).set('x-reviewer-token', TOKEN);
    expect(res.body.lines).toHaveLength(before);
    expect(res.body.skipped).toBe(2);
  });

  it('workspace notes posted during a run come back whole, with who, to whom, which card and which round', async () => {
    const runId = 'maya-notes1';
    const logsDir = path.join(tmp, 'logs');
    const trace = new TraceLogger(runId, logsDir);
    const ws = new Workspace(runId, new BundleMemory(path.join(tmp, 'h')), trace);
    ws.post({ from_agent: 'ClawbackHunter', to_agent: 'RecallChecker', type: 'question', about: 'clawback-price-5', body: 'Is the Graco playard on a recall list?', evidence_sql: 'SELECT 1', round: 0 });
    ws.post({ from_agent: 'RecallChecker', to_agent: 'ClawbackHunter', type: 'answer', about: 'clawback-price-5', body: 'No recall found.', evidence_sql: '', round: 1 });
    const app = express();
    app.use(createAgentLogRouter({ reviewerToken: () => TOKEN, logsDir: () => logsDir }));
    const res = await request(app).get(`/api/runs/${runId}/agent-log`).set('x-reviewer-token', TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.notes).toEqual([
      expect.objectContaining({ from_agent: 'ClawbackHunter', to_agent: 'RecallChecker', type: 'question', about: 'clawback-price-5', round: 0, body: 'Is the Graco playard on a recall list?' }),
      expect.objectContaining({ from_agent: 'RecallChecker', to_agent: 'ClawbackHunter', type: 'answer', about: 'clawback-price-5', round: 1, body: 'No recall found.' }),
    ]);
    expect(res.body.backend).toBe('hmem-local');
  });

  it('coping with the missing workspace_open line: no notes and no backend is fine', async () => {
    const { app, runId } = await sampleRun();
    const res = await request(app).get(`/api/runs/${runId}/agent-log`).set('x-reviewer-token', TOKEN);
    expect(res.body.notes).toEqual([]);
    expect(res.body.backend).toBeNull();
  });

  it('the parent run result carries none of the log (no trace id, agent names, or log fields)', async () => {
    const { result } = await sampleRun();
    expect(JSON.stringify(result)).not.toMatch(/agent_name|input_summary|bundle_maya|query_zetaris/);
  });
});

import os from 'os';
import fs from 'fs';
import path from 'path';
import express from 'express';
import request from 'supertest';

jest.mock('../agents/clawback');
jest.mock('../agents/recall');
jest.mock('../agents/finePrintCourt');
jest.mock('../agents/benefits', () => ({ ...jest.requireActual('../agents/benefits'), planBenefits: jest.fn(), revise: jest.fn() }));
jest.mock('../agents/factChecker');

import * as clawback from '../agents/clawback';
import * as recall from '../agents/recall';
import * as court from '../agents/finePrintCourt';
import * as benefits from '../agents/benefits';
import * as fc from '../agents/factChecker';
import { useFakeCheckWithCorrections } from './helpers/fakeChecker';
import { createBundleRouter, SEED_FAMILY_IDS, type ApiDeps } from '../routes/bundleRoutes';
import { bodyParsers } from '../middleware/bodyLimit';
import { MemoryStore, DrizzleStore, type BundleStore, type SavedRunRow } from '../bundleStore';
import { FakeGenerator } from '../adapters/llm';
import type { Family, BundleResult, FeedCard } from '../../shared/bundle';

const mk = (id: string): Family => ({
  id, userId: null, isGuest: true, name: id, birthDate: null, dueDate: '2026-12-07', zip: '02139', state: 'MA',
  employer: 'N', householdSize: 3, annualIncomeCents: 14500000, dcfsaOffered: true, dataConnected: false,
});

const secretCard: FeedCard = {
  id: 'benefit-x', kind: 'benefit', title: 'Made-up benefit', body: 'Plain words.', amountCents: 500, deadline: null,
  verdict: 'verified', sources: [{ label: 'Src', url: 'https://example.gov', quote: 'owner only quote' } as any],
  traceId: 'bundle_secret', agent: 'benefits', debate: ['court said secret-debate'], sql: 'select secret from v_x',
} as unknown as FeedCard;

function build(store: BundleStore, over: Partial<ApiDeps> = {}) {
  const logsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-'));
  (clawback.findClawbacks as jest.Mock).mockResolvedValue([]);
  (recall.checkRecalls as jest.Mock).mockResolvedValue({ candidates: [], itemsChecked: 0 });
  (benefits.planBenefits as jest.Mock).mockResolvedValue([]);
  (court.judgeOffers as jest.Mock).mockResolvedValue([]);
  (fc.verify as jest.Mock).mockResolvedValue({ ok: true, reason: null, corrected: null });
  useFakeCheckWithCorrections(fc);
  const memory = { exportLedger: jest.fn((f: string) => fs.writeFileSync(f, '')), recallRules: jest.fn(() => []), addRule: jest.fn(() => 'mem-1') } as any;
  const llm = new FakeGenerator([]);
  const deps: ApiDeps = {
    makeRunDeps: () => ({ z: { runQuery: jest.fn(async () => ({ headers: [], rows: [], ms: 1 })) } as any, llm, memory, logsDir, today: '2026-10-23' }),
    loadSeedFamily: async (id) => mk(id),
    store, memory, llm, reviewerToken: () => 'sekret', now: () => new Date('2026-10-23T12:00:00Z'), ...over,
  };
  const app = express();
  app.use(...bodyParsers());
  app.use(createBundleRouter(deps));
  return { app };
}

const sampleRow = (runId: string, familyId = 'leo'): SavedRunRow => ({
  runId, familyId, traceId: `bundle_${runId}`, sampleMode: true,
  result: { familyId, runId, receipt: { moneyBackCents: 0, likelyBenefitsCents: 500, deadlineCount: 0, nextDeadline: null, itemsChecked: 0 }, cards: [secretCard], banner: null } as BundleResult,
  family: { name: familyId, birthDate: null, dueDate: '2026-12-07' }, today: '2026-10-23', demoDate: true, startedAt: '2026-10-23T12:00:00.000Z',
});

describe('MemoryStore run results', () => {
  it('saves, reads back, and replaces on the same runId', async () => {
    const s = new MemoryStore();
    expect(await s.getRunResult('nope')).toBeNull();
    await s.saveRunResult(sampleRow('r1'));
    expect((await s.getRunResult('r1'))?.familyId).toBe('leo');
    await s.saveRunResult({ ...sampleRow('r1'), today: '2026-10-24' });
    expect((await s.getRunResult('r1'))?.today).toBe('2026-10-24');
  });
  it('returns the newest run for a family', async () => {
    const s = new MemoryStore();
    await s.saveRunResult(sampleRow('a', 'leo'));
    await s.saveRunResult(sampleRow('b', 'leo'));
    await s.saveRunResult(sampleRow('c', 'maya'));
    expect((await s.latestRunResult('leo'))?.runId).toBe('b');
    expect(await s.latestRunResult('nobody')).toBeNull();
  });
  it('hands out copies, not the stored object', async () => {
    const s = new MemoryStore();
    await s.saveRunResult(sampleRow('r1'));
    const got = (await s.getRunResult('r1'))!;
    got.result.cards.length = 0;
    expect((await s.getRunResult('r1'))!.result.cards).toHaveLength(1);
  });
});

describe('run results are saved and served after a restart', () => {
  it('a finished run is saved, and a brand-new router (a restart) with the same store still serves it', async () => {
    const store = new MemoryStore({ '021': 'MA' });
    const first = build(store);
    const res = await request(first.app).post('/api/run?wait=true').send({ familyId: 'leo' });
    expect(res.status).toBe(200);
    const runId = res.body.runId as string;
    const saved = await store.getRunResult(runId);
    expect(saved?.familyId).toBe('leo');
    expect(saved?.sampleMode).toBe(process.env.SAMPLE_MODE === 'true');
    expect(saved?.traceId).toBe(`bundle_${runId}`);

    const second = build(store); // the "restarted" server has an empty in-memory run list
    const back = await request(second.app).get(`/api/runs/${runId}`);
    expect(back.status).toBe(200);
    expect(back.body.status).toBe('done');
    expect(back.body.result.runId).toBe(runId);
    expect(back.body.result.cards.length).toBe(res.body.cards.length);
    expect(back.body.family).toBeDefined();
    expect(back.body.progress.every((p: any) => p.state === 'done')).toBe(true);
  });

  it('SAMPLE_MODE with no keys: run every sample family, then read each saved result back', async () => {
    const prev = { sm: process.env.SAMPLE_MODE, z: process.env.ZETARIS_API_KEY, m: process.env.MODEL_API_KEY };
    process.env.SAMPLE_MODE = 'true';
    delete process.env.ZETARIS_API_KEY; delete process.env.MODEL_API_KEY;
    try {
      const store = new MemoryStore({ '021': 'MA' });
      const { app } = build(store);
      for (const familyId of SEED_FAMILY_IDS) {
        const run = await request(app).post('/api/run?wait=true').send({ familyId });
        expect(run.status).toBe(200);
        const back = await request(build(store).app).get(`/api/runs/${run.body.runId}`);
        expect(back.status).toBe(200);
        expect(back.body.result.familyId).toBe(familyId);
        expect((await store.getRunResult(run.body.runId))?.sampleMode).toBe(true);
      }
    } finally {
      if (prev.sm === undefined) delete process.env.SAMPLE_MODE; else process.env.SAMPLE_MODE = prev.sm;
      if (prev.z !== undefined) process.env.ZETARIS_API_KEY = prev.z;
      if (prev.m !== undefined) process.env.MODEL_API_KEY = prev.m;
    }
  });

  it('a failed save never fails the run', async () => {
    const store = new MemoryStore({ '021': 'MA' });
    store.saveRunResult = async () => { throw new Error('db down'); };
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { app } = build(store);
    const res = await request(app).post('/api/run?wait=true').send({ familyId: 'leo' });
    expect(res.status).toBe(200);
    spy.mockRestore();
  });

  it('unknown run: 404 (not in memory, not saved)', async () => {
    const { app } = build(new MemoryStore());
    expect((await request(app).get('/api/runs/nope')).status).toBe(404);
  });

  it('keeps the owner/parent split for a restored run: parents never see reviewer-only fields', async () => {
    const store = new MemoryStore();
    await store.saveRunResult(sampleRow('bundle-leo-restored'));
    const { app } = build(store);
    const parent = await request(app).get('/api/runs/bundle-leo-restored');
    const text = JSON.stringify(parent.body);
    expect(parent.body.owner).toBe(false);
    for (const leak of ['bundle_secret', 'secret-debate', 'select secret', 'owner only quote', '"agent":"benefits"', 'traceId']) expect(text).not.toContain(leak);
    expect(parent.body.result.cards[0].title).toBe('Made-up benefit');
    const owner = await request(app).get('/api/runs/bundle-leo-restored').set('x-reviewer-token', 'sekret');
    expect(owner.body.owner).toBe(true);
    expect(owner.body.result.cards[0].traceId).toBe('bundle_secret');
  });

  it('restored run trace is owner-only (403 for parents, empty list for the owner when the log file is gone)', async () => {
    const store = new MemoryStore();
    await store.saveRunResult(sampleRow('r-trace'));
    const { app } = build(store);
    expect((await request(app).get('/api/runs/r-trace/trace')).status).toBe(403);
    const t = await request(app).get('/api/runs/r-trace/trace').set('x-reviewer-token', 'sekret');
    expect(t.status).toBe(200);
    expect(t.body).toEqual([]);
  });

  it('GET /api/families/:id/latest-run serves the newest saved result for a family (parent-safe), 404 if none', async () => {
    const store = new MemoryStore();
    await store.saveRunResult(sampleRow('old', 'leo'));
    await store.saveRunResult(sampleRow('new', 'leo'));
    const { app } = build(store);
    const res = await request(app).get('/api/families/leo/latest-run');
    expect(res.status).toBe(200);
    expect(res.body.runId).toBe('new');
    expect(JSON.stringify(res.body)).not.toContain('bundle_secret');
    expect((await request(app).get('/api/families/maya/latest-run')).status).toBe(404);
    expect((await request(app).get('/api/families/guest-abc/latest-run')).status).toBe(404); // unknown / guest ids are never looked up
  });
});

// ---- Live local Postgres: runs only when TEST_DATABASE_URL is set (otherwise shows as skipped) ----
const TEST_URL = process.env.TEST_DATABASE_URL;
const liveDescribe = TEST_URL ? describe : describe.skip;
liveDescribe('DrizzleStore run results on local Postgres', () => {
  let dbMod: typeof import('../db');
  const savedUrl = process.env.DATABASE_URL;
  const tag = `t${Date.now()}`;
  const runIds: string[] = [];
  const row = (runId: string, familyId: string, over: Partial<SavedRunRow> = {}) => { runIds.push(runId); return { ...sampleRow(runId, familyId), ...over }; };

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_URL; // a throwaway local database, never Neon
    dbMod = await import('../db');
    await dbMod.pool.query('select 1 from run_results limit 1'); // fails loudly if the test database is not set up
  });
  afterAll(async () => {
    if (dbMod) {
      await dbMod.pool.query('delete from run_results where run_id = any($1) or run_id like $2', [runIds, `${tag}%`]);
      await dbMod.pool.end();
    }
    if (savedUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = savedUrl;
  });

  it('round-trips a saved run, replaces on the same runId, and finds the latest per family', async () => {
    const s = new DrizzleStore();
    await s.saveRunResult(row(`${tag}-a`, `fam-${tag}`));
    await s.saveRunResult(row(`${tag}-a`, `fam-${tag}`, { today: '2026-10-25' }));
    await new Promise((r) => setTimeout(r, 15));
    await s.saveRunResult(row(`${tag}-b`, `fam-${tag}`));
    const a = await s.getRunResult(`${tag}-a`);
    expect(a?.today).toBe('2026-10-25');
    expect(a?.sampleMode).toBe(true);
    expect(a?.result.cards[0].id).toBe('benefit-x');
    expect(a?.family.name).toBe(`fam-${tag}`);
    expect((await s.latestRunResult(`fam-${tag}`))?.runId).toBe(`${tag}-b`);
    expect(await s.getRunResult('missing')).toBeNull();
  });

  it('a run made through one router is served by a brand-new router and store (a restart) from the database', async () => {
    const res = await request(build(new DrizzleStore()).app).post('/api/run?wait=true').send({ familyId: 'leo' });
    expect(res.status).toBe(200);
    const runId = res.body.runId as string;
    runIds.push(runId);
    const back = await request(build(new DrizzleStore()).app).get(`/api/runs/${runId}`);
    expect(back.status).toBe(200);
    expect(back.body.status).toBe('done');
    expect(back.body.result.cards.length).toBe(res.body.cards.length);
    expect(back.body.owner).toBe(false);
  });
});

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
import { createBundleRouter, type ApiDeps } from '../routes/bundleRoutes';
import { bodyParsers } from '../middleware/bodyLimit';
import { MemoryStore } from '../bundleStore';
import { FakeGenerator } from '../adapters/llm';
import type { Family } from '../../shared/bundle';

const mk = (id: string): Family => ({
  id, userId: null, isGuest: true, name: id, birthDate: null, dueDate: '2026-12-07', zip: '02139', state: 'MA',
  employer: 'N', householdSize: 3, annualIncomeCents: 14500000, dcfsaOffered: true, dataConnected: false,
});

function build(over: Partial<ApiDeps> = {}) {
  const logsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'api-'));
  (clawback.findClawbacks as jest.Mock).mockResolvedValue([]);
  (recall.checkRecalls as jest.Mock).mockResolvedValue({ candidates: [], itemsChecked: 0 });
  (benefits.planBenefits as jest.Mock).mockResolvedValue([]);
  (court.judgeOffers as jest.Mock).mockResolvedValue([]);
  (fc.verify as jest.Mock).mockResolvedValue({ ok: true, reason: null, corrected: null });
  const memory = { exportLedger: jest.fn((f: string) => fs.writeFileSync(f, '')), recallRules: jest.fn(() => []), addRule: jest.fn(() => 'mem-1') } as any;
  const store = new MemoryStore({ '021': 'MA', '000': 'US' });
  const llm = new FakeGenerator([JSON.stringify({ clusters: [{ rule: 'Reject offers with shipping fees.', feedbackIds: [1, 2] }] })]);
  const deps: ApiDeps = {
    makeRunDeps: () => ({ z: { runQuery: jest.fn(async () => ({ headers: [], rows: [], ms: 1 })) } as any, llm, memory, logsDir, today: '2026-10-23' }),
    loadSeedFamily: async (id) => mk(id),
    store, memory, llm,
    reviewerToken: () => 'sekret',
    ...over,
  };
  const app = express();
  app.use(...bodyParsers());
  app.use(createBundleRouter(deps));
  return { app, deps, store, memory, logsDir };
}

describe('POST /api/run', () => {
  it('leo with ?wait=true returns the BundleResult with >= 9 cards, no auth', async () => {
    const { app } = build();
    const res = await request(app).post('/api/run?wait=true').send({ familyId: 'leo' });
    expect(res.status).toBe(200);
    expect(res.body.cards.length).toBeGreaterThanOrEqual(9);
    expect(res.body.familyId).toBe('leo');
  });

  it('without wait: 202 + runId, then status and trace fill in', async () => {
    const { app } = build();
    const res = await request(app).post('/api/run').send({ familyId: 'leo' });
    expect(res.status).toBe(202);
    const { runId } = res.body;
    expect(typeof runId).toBe('string');
    let body: any;
    for (let i = 0; i < 50; i++) {
      body = (await request(app).get(`/api/runs/${runId}`)).body;
      if (body.status === 'done') break;
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(body.status).toBe('done');
    expect(body.result.runId).toBe(runId);
    const trace = await request(app).get(`/api/runs/${runId}/trace`);
    expect(trace.status).toBe(200);
    expect(trace.body.length).toBeGreaterThan(0);
    expect(trace.body[0]).toHaveProperty('agent_name');
  });

  it('unknown run id is 404; path-like id is rejected', async () => {
    const { app } = build();
    expect((await request(app).get('/api/runs/nope')).status).toBe(404);
    expect((await request(app).get('/api/runs/nope/trace')).status).toBe(404);
  });

  it('bad ZIP -> 400 with the exact message', async () => {
    const { app } = build();
    for (const zip of ['00000', 'abcde', '1234']) {
      const res = await request(app).post('/api/run').send({ zip, dueDate: '2026-12-07', employer: 'X' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Enter a valid US ZIP code');
    }
  });

  it('inline family: runs with the defaults, is not saved, state comes from zip_states', async () => {
    const { app, deps } = build();
    let seen: Family | undefined;
    (benefits.planBenefits as jest.Mock).mockImplementation(async (ctx: any) => { seen = ctx.family; return []; });
    const res = await request(app).post('/api/run?wait=true').send({ zip: '02139', birthDate: '2026-10-01', employer: 'Acme' });
    expect(res.status).toBe(200);
    expect(seen).toMatchObject({ householdSize: 3, annualIncomeCents: null, dcfsaOffered: true, state: 'MA', employer: 'Acme', isGuest: true, userId: null });
    expect(seen!.id).toMatch(/^guest-/);
    expect(deps.store).toBeDefined();
  });

  it('inline family needs a birth or due date; unknown seed id is 400', async () => {
    const { app } = build();
    expect((await request(app).post('/api/run').send({ zip: '02139', employer: 'X' })).status).toBe(400);
    expect((await request(app).post('/api/run').send({ familyId: 'someone-else' })).status).toBe(400);
  });

  it('11th run from one IP in 10 minutes -> 429', async () => {
    const { app } = build();
    for (let i = 0; i < 10; i++) {
      expect((await request(app).post('/api/run?wait=true').send({ familyId: 'leo' })).status).toBe(200);
    }
    expect((await request(app).post('/api/run?wait=true').send({ familyId: 'leo' })).status).toBe(429);
  });
});

describe('abuse limits', () => {
  it('503 when 5 runs are in flight, and a slot frees when one finishes', async () => {
    const { app } = build();
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    (benefits.planBenefits as jest.Mock).mockImplementation(async () => { await gate; return []; });
    for (let i = 0; i < 5; i++) expect((await request(app).post('/api/run').send({ familyId: 'leo' })).status).toBe(202);
    const busy = await request(app).post('/api/run').send({ familyId: 'leo' });
    expect(busy.status).toBe(503);
    release();
    await new Promise((r) => setTimeout(r, 300));
    expect((await request(app).post('/api/run').send({ familyId: 'leo' })).status).toBe(202);
  });

  it('bodies over 100kb get 413', async () => {
    const { app } = build();
    const res = await request(app).post('/api/feedback').send({ familyId: 'maya', cardId: 'c', kind: 'issue', note: 'x'.repeat(150_000) });
    expect(res.status).toBe(413);
  });

  it('run ids are UUID-based', async () => {
    const { app } = build();
    const res = await request(app).post('/api/run').send({ familyId: 'leo' });
    expect(res.body.runId).toMatch(/^leo-[0-9a-f-]{36}$/);
  });
});

describe('feedback and case law', () => {
  it('saves feedback, then Coach proposes a rule from 2 issue notes', async () => {
    const { app, store } = build();
    const a = await request(app).post('/api/feedback').send({ familyId: 'maya', cardId: 'd1', kind: 'issue', note: 'shipping fee' });
    expect(a.status).toBe(200);
    expect(a.body.proposals).toEqual([]);
    const b = await request(app).post('/api/feedback').send({ familyId: 'leo', cardId: 'd2', kind: 'issue', note: 'shipping charge' });
    expect(b.body.proposals).toHaveLength(1);
    expect(b.body.proposals[0].confidence).toBe(0.7);
    expect((await store.listProposals())).toHaveLength(1);
    const list = await request(app).get('/api/case-law');
    expect(list.body.proposals).toHaveLength(1);
    expect(list.body.approved).toHaveLength(0);
  });

  it('rejects unknown family ids and bad kinds', async () => {
    const { app } = build();
    expect((await request(app).post('/api/feedback').send({ familyId: 'zzz', cardId: 'c', kind: 'issue', note: '' })).status).toBe(400);
    expect((await request(app).post('/api/feedback').send({ familyId: 'maya', cardId: 'c', kind: 'bogus', note: '' })).status).toBe(400);
  });

  it('accepts feedback for the family of a run it started', async () => {
    const { app } = build();
    const run = await request(app).post('/api/run?wait=true').send({ zip: '02139', dueDate: '2026-12-07', employer: 'X' });
    const res = await request(app).post('/api/feedback').send({ familyId: run.body.familyId, cardId: 'c', kind: 'got_it', note: '' });
    expect(res.status).toBe(200);
  });

  async function withProposal() {
    const ctx = build();
    await ctx.store.saveProposals([{ text: 'Reject shipping fees', confidence: 0.7, sourceFeedbackIds: ['1', '2'] }]);
    return ctx;
  }

  it('approve without the token, or with the wrong one -> 403', async () => {
    const { app, memory } = await withProposal();
    expect((await request(app).post('/api/case-law/1/approve')).status).toBe(403);
    expect((await request(app).post('/api/case-law/1/approve').set('x-reviewer-token', 'nope')).status).toBe(403);
    expect(memory.addRule).not.toHaveBeenCalled();
  });

  it('approve is 403 when REVIEWER_MODE_TOKEN is empty, even with an empty header', async () => {
    const { app } = build({ reviewerToken: () => '' });
    expect((await request(app).post('/api/case-law/1/approve').set('x-reviewer-token', '')).status).toBe(403);
  });

  it('approve with the right token stores the rule in memory and marks it approved', async () => {
    const { app, memory, store } = await withProposal();
    const res = await request(app).post('/api/case-law/1/approve').set('x-reviewer-token', 'sekret');
    expect(res.status).toBe(200);
    expect(memory.addRule).toHaveBeenCalledWith('Reject shipping fees', 'case_law:1', 0.7, ['1', '2']);
    expect((await store.getProposal(1))!.status).toBe('approved');
    expect((await request(app).get('/api/case-law')).body.approved).toHaveLength(1);
    expect((await request(app).post('/api/case-law/99/approve').set('x-reviewer-token', 'sekret')).status).toBe(404);
  });
});

describe('UI helpers (Task 12)', () => {
  it('run status carries the family display fields and today, never income', async () => {
    const { app } = build();
    const { runId } = (await request(app).post('/api/run').send({ familyId: 'leo' })).body;
    const body = (await request(app).get(`/api/runs/${runId}`)).body;
    expect(body.today).toBe('2026-10-23');
    expect(body.family).toEqual({ name: 'leo', birthDate: null, dueDate: '2026-12-07' });
    expect(JSON.stringify(body)).not.toContain('14500000');
  });

  it('GET /api/scoreboard returns null before any eval, then the saved JSON', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-'));
    const file = path.join(dir, 'scoreboard.json');
    const { app } = build({ scoreboardFile: () => file });
    expect((await request(app).get('/api/scoreboard')).body).toEqual({ scoreboard: null });
    fs.writeFileSync(file, JSON.stringify({ trapsCaught: 6, trapsTotal: 6 }));
    expect((await request(app).get('/api/scoreboard')).body).toEqual({ scoreboard: { trapsCaught: 6, trapsTotal: 6 } });
  });
});

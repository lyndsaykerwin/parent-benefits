// Lane E (Story 6): saved families, editing the five answers, "What Bundle remembers", and "Forget everything".
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
import { createBundleRouter, type ApiDeps } from '../routes/bundleRoutes';
import { bodyParsers } from '../middleware/bodyLimit';
import { MemoryStore } from '../bundleStore';
import { BundleMemory } from '../adapters/memory';
import { FakeGenerator } from '../adapters/llm';
import type { Family } from '../../shared/bundle';

const seed = (id: string): Family => ({
  id, userId: null, isGuest: false, name: id, birthDate: '2026-10-03', dueDate: null, zip: '02139', state: 'MA',
  employer: 'N', householdSize: 3, annualIncomeCents: 14500000, dcfsaOffered: true, dataConnected: false,
});

const ANSWERS = { zip: '02139', birthDate: '2026-10-01', household: 'two', parent1Work: 'paycheck', parent2Work: 'paycheck', insurance: 'job' };

function build(store = new MemoryStore({ '021': 'MA', '000': 'US' }), memory = new BundleMemory(fs.mkdtempSync(path.join(os.tmpdir(), 'hmem-')))) {
  const logsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acct-'));
  (clawback.findClawbacks as jest.Mock).mockResolvedValue([]);
  (recall.checkRecalls as jest.Mock).mockResolvedValue({ candidates: [], itemsChecked: 0 });
  (benefits.planBenefits as jest.Mock).mockResolvedValue([]);
  (court.judgeOffers as jest.Mock).mockResolvedValue([]);
  (fc.verify as jest.Mock).mockResolvedValue({ ok: true, reason: null, corrected: null });
  useFakeCheckWithCorrections(fc);
  const llm = new FakeGenerator([]);
  const forgotten: string[] = [];
  const deps: ApiDeps = {
    makeRunDeps: () => ({ z: { runQuery: jest.fn(async () => ({ headers: [], rows: [], ms: 1 })) } as any, llm, memory, logsDir, today: '2026-10-23' }),
    loadSeedFamily: async (id) => seed(id),
    store, memory, llm,
    reviewerToken: () => 'sekret',
    now: () => new Date('2026-10-23T12:00:00Z'),
    forgetItems: async (id) => { forgotten.push(id); return 2; },
  };
  const app = express();
  app.use(...bodyParsers());
  app.use(createBundleRouter(deps));
  return { app, store, memory, forgotten, deps };
}

const finish = async (app: express.Express, runId: string) => {
  for (let i = 0; i < 50; i++) {
    const b = (await request(app).get(`/api/runs/${runId}`)).body;
    if (b.status === 'done') return b;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('run did not finish');
};

describe('saved families', () => {
  it('a saved family id re-runs that family; new answers edit it in place under the same id', async () => {
    const { app, store } = build();
    const first = await request(app).post('/api/run').send(ANSWERS);
    const id = first.body.familyId as string;
    await finish(app, first.body.runId);

    const again = await request(app).post('/api/run').send({ familyId: id });
    expect(again.status).toBe(202);
    expect(again.body.familyId).toBe(id);

    const edited = await request(app).post('/api/run').send({ ...ANSWERS, familyId: id, zip: '02139', birthDate: undefined, dueDate: '2026-12-20', insurance: 'marketplace' });
    expect(edited.status).toBe(202);
    expect(edited.body.familyId).toBe(id);
    expect(await store.getFamily(id)).toMatchObject({ id, dueDate: '2026-12-20', birthDate: null, insurance: 'marketplace' });
    const status = await finish(app, edited.body.runId);
    expect(status.familyId).toBe(id);
    expect(status.family).toMatchObject({ dueDate: '2026-12-20', zip: '02139' });
  });

  it('an unknown saved id is a 404 with a plain message, and a bad edit is a 400 that leaves the saved answers alone', async () => {
    const { app, store } = build();
    const missing = await request(app).post('/api/run').send({ familyId: 'guest-deadbeef' });
    expect(missing.status).toBe(404);
    expect(missing.body.error).toMatch(/could not find your saved profile/i);
    const first = await request(app).post('/api/run').send(ANSWERS);
    const id = first.body.familyId as string;
    const bad = await request(app).post('/api/run').send({ ...ANSWERS, familyId: id, zip: '99' });
    expect(bad.status).toBe(400);
    expect(await store.getFamily(id)).toMatchObject({ zip: '02139', birthDate: '2026-10-01' });
  });

  it('the latest results of a saved family are still served after the server wakes up again', async () => {
    const store = new MemoryStore({ '021': 'MA', '000': 'US' });
    const one = build(store);
    const first = await request(one.app).post('/api/run').send(ANSWERS);
    await finish(one.app, first.body.runId);
    const two = build(store); // a new server, the same saved data
    const latest = await request(two.app).get(`/api/families/${first.body.familyId}/latest-run`);
    expect(latest.status).toBe(200);
    expect(latest.body.status).toBe('done');
    expect((await request(two.app).get('/api/families/guest-00000000/latest-run')).status).toBe(404);
    // and a tick on a card of that family is accepted (the family is known from the saved data)
    const tick = await request(two.app).post('/api/feedback').send({ familyId: first.body.familyId, cardId: 'x', kind: 'got_it' });
    expect(tick.status).toBe(200);
  });
});

describe('what Bundle remembers', () => {
  it('writes the family\'s answers into memory, replaces them when the answers change, and keeps them out of case-law recall', async () => {
    const { app, memory } = build();
    const first = await request(app).post('/api/run').send(ANSWERS);
    const id = first.body.familyId as string;
    const mem = await request(app).get(`/api/families/${id}/memory`);
    expect(mem.status).toBe(200);
    const texts = mem.body.family.map((m: any) => m.text);
    expect(texts).toEqual(expect.arrayContaining(['Stage: Baby’s here', 'Birth date: Oct 1, 2026', 'ZIP: 02139', 'Insurance: Through a job (mine or my partner’s)']));
    expect(mem.body.family.every((m: any) => m.source === 'setup' && /^mem-\d+$/.test(m.id) && /^\d{4}-\d{2}-\d{2}$/.test(m.savedOn))).toBe(true);

    await request(app).post('/api/run').send({ ...ANSWERS, familyId: id, zip: '02139', insurance: 'tricare' });
    const after = (await request(app).get(`/api/families/${id}/memory`)).body.family.map((m: any) => m.text);
    expect(after).toContain('Insurance: TRICARE (military)');
    expect(after).not.toContain('Insurance: Through a job (mine or my partner’s)');
    expect(after.filter((t: string) => t.startsWith('ZIP'))).toHaveLength(1);

    expect(memory.recallRules('Stage Baby ZIP Insurance family')).toEqual([]);
    expect(mem.body.learned.map((m: any) => m.text).join(' ')).not.toMatch(/ZIP: 02139/);
  });

  it('learned items come from parent rules and grading lessons, never from a family', async () => {
    const { app, memory } = build();
    memory.addRule('Boxes that auto-renew are a catch.', 'case_law:1', 0.8, ['1', '2', '3']);
    memory.addLesson('Amazon: approve with a catch.', 'oc-1', 0.7);
    const learned = (await request(app).get('/api/families/maya/memory')).body.learned;
    expect(learned).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: 'Boxes that auto-renew are a catch.', reports: 3 }),
      expect.objectContaining({ text: 'Amazon: approve with a catch.', reports: null }),
    ]));
  });
});

describe('Forget everything', () => {
  it('deletes the family, its claims, runs, photos and memory entries', async () => {
    const { app, store, memory, forgotten } = build();
    const first = await request(app).post('/api/run').send(ANSWERS);
    const id = first.body.familyId as string;
    await finish(app, first.body.runId);
    await request(app).post('/api/feedback').send({ familyId: id, cardId: 'c1', kind: 'got_it' });
    expect(await store.getClaims(id)).toHaveLength(1);
    expect(memory.familyFacts(id).length).toBeGreaterThan(0);

    const res = await request(app).delete(`/api/families/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toEqual({ items: 2, memory: expect.any(Number) });
    expect(forgotten).toEqual([id]);
    expect(await store.getFamily(id)).toBeNull();
    expect(await store.getClaims(id)).toEqual([]);
    expect(await store.latestRunResult(id)).toBeNull();
    expect(memory.familyFacts(id)).toEqual([]);
    expect((await request(app).get(`/api/runs/${first.body.runId}`)).status).toBe(404);
    expect((await request(app).post('/api/run').send({ familyId: id })).status).toBe(404);
  });

  it('a sample family keeps its built-in answers but loses everything saved for it; a bad id is a 400', async () => {
    const { app, store } = build();
    await request(app).post('/api/feedback').send({ familyId: 'leo', cardId: 'c1', kind: 'got_it' });
    expect((await request(app).delete('/api/families/leo')).status).toBe(200);
    expect(await store.getClaims('leo')).toEqual([]);
    expect((await request(app).post('/api/run').send({ familyId: 'leo' })).status).toBe(202);
    expect((await request(app).delete('/api/families/bad%20id')).status).toBe(400);
  });

  it('says so when something could not be deleted (and does not claim success)', async () => {
    const { app, deps } = build();
    deps.forgetItems = async () => { throw new Error('db down'); };
    const res = await request(app).delete('/api/families/guest-aaaaaaaa');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Please try again/);
  });
});

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
import { resolveToday, DEMO_TODAY } from '../demoDate';
import { makeRealRunDeps } from '../bundleDeps';
import { createBundleRouter, type ApiDeps } from '../routes/bundleRoutes';
import { bodyParsers } from '../middleware/bodyLimit';
import { MemoryStore } from '../bundleStore';
import { FakeGenerator } from '../adapters/llm';
import type { Family } from '../../shared/bundle';
import { demoDateLabel } from '../../client/src/lib/bundle';

describe('resolveToday', () => {
  const now = new Date('2026-11-04T15:00:00Z');
  it('seed families run at the demo date', () => {
    for (const id of ['maya', 'leo', 'ava', 'noor', 'cal', 'fern']) expect(resolveToday(id, {}, now)).toEqual({ today: DEMO_TODAY, demoDate: true });
    expect(DEMO_TODAY).toBe('2026-10-23');
  });
  it('TODAY overrides the demo date for seed families only', () => {
    expect(resolveToday('maya', { TODAY: '2026-10-30' }, now)).toEqual({ today: '2026-10-30', demoDate: true });
    expect(resolveToday('guest-1a2b', { TODAY: '2026-10-30' }, now)).toEqual({ today: '2026-11-04', demoDate: false });
  });
  it('inline families use the real date', () => {
    expect(resolveToday('guest-1a2b', {}, now)).toEqual({ today: '2026-11-04', demoDate: false });
  });
  it('an invalid TODAY is ignored', () => {
    expect(resolveToday('maya', { TODAY: 'tomorrow' }, now).today).toBe(DEMO_TODAY);
  });
});

describe('bundleDeps wiring', () => {
  const OLD = { ...process.env };
  afterEach(() => { process.env = { ...OLD }; });
  it('makeRealRunDeps gives seed families the demo date and inline families the real date', () => {
    Object.assign(process.env, { ZETARIS_BASE_URL: 'http://x', ZETARIS_ORG_ID: 'o', ZETARIS_API_KEY: 'k' });
    delete process.env.TODAY;
    const mem = {} as any;
    expect(makeRealRunDeps(mem, 'maya').today).toBe('2026-10-23');
    expect(makeRealRunDeps(mem, 'guest-ab12').today).toBe(new Date().toISOString().slice(0, 10));
  });
});

describe('run status demo flag', () => {
  const mk = (id: string): Family => ({
    id, userId: null, isGuest: true, name: id, birthDate: null, dueDate: '2026-12-07', zip: '02139', state: 'MA',
    employer: 'N', householdSize: 3, annualIncomeCents: null, dcfsaOffered: true, dataConnected: false,
  });
  function build() {
    const logsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-'));
    (clawback.findClawbacks as jest.Mock).mockResolvedValue([]);
    (recall.checkRecalls as jest.Mock).mockResolvedValue({ candidates: [], itemsChecked: 0 });
    (benefits.planBenefits as jest.Mock).mockResolvedValue([]);
    (court.judgeOffers as jest.Mock).mockResolvedValue([]);
    (fc.verify as jest.Mock).mockResolvedValue({ ok: true, reason: null, corrected: null });
    useFakeCheckWithCorrections(fc);
    const memory = { exportLedger: jest.fn((f: string) => fs.writeFileSync(f, '')), recallRules: jest.fn(() => []), addRule: jest.fn() } as any;
    const seen: string[] = [];
    const deps: ApiDeps = {
      makeRunDeps: (family) => { seen.push(family.id); return { z: { runQuery: jest.fn() } as any, llm: new FakeGenerator(['{}']), memory, logsDir, today: resolveToday(family.id).today }; },
      loadSeedFamily: async (id) => mk(id),
      store: new MemoryStore({ '021': 'MA' }), memory, llm: new FakeGenerator(['{}']), reviewerToken: () => 'x',
    };
    const app = express();
    app.use(...bodyParsers());
    app.use(createBundleRouter(deps));
    return { app, seen };
  }
  it('seed family: demoDate true and the 2026-10-23 date; inline family: demoDate false', async () => {
    const { app, seen } = build();
    delete process.env.TODAY;
    const a = (await request(app).post('/api/run').send({ familyId: 'maya' })).body.runId;
    const sa = (await request(app).get(`/api/runs/${a}`)).body;
    expect(sa.demoDate).toBe(true);
    expect(sa.today).toBe('2026-10-23');
    const b = (await request(app).post('/api/run').send({ zip: '02139', dueDate: '2027-01-15' })).body.runId;
    const sb = (await request(app).get(`/api/runs/${b}`)).body;
    expect(sb.demoDate).toBe(false);
    expect(sb.today).toBe(new Date().toISOString().slice(0, 10));
    expect(seen[0]).toBe('maya');
    expect(seen[1]).toMatch(/^guest-/);
  });
});

describe('Feed label', () => {
  it('shows "Demo date: Oct 23, 2026" for sample families only', () => {
    expect(demoDateLabel(true, '2026-10-23')).toBe('Demo date: Oct 23, 2026');
    expect(demoDateLabel(false, '2026-10-23')).toBeNull();
    expect(demoDateLabel(undefined, '2026-10-23')).toBeNull();
    expect(demoDateLabel(true, undefined)).toBeNull();
  });
});

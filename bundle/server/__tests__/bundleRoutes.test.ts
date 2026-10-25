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
import { createBundleRouter, parentResult, parentCard, type ApiDeps } from '../routes/bundleRoutes';
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
  useFakeCheckWithCorrections(fc);
  const memory = { exportLedger: jest.fn((f: string) => fs.writeFileSync(f, '')), recallRules: jest.fn(() => []), addRule: jest.fn(() => 'mem-1') } as any;
  const store = new MemoryStore({ '021': 'MA', '000': 'US' });
  const llm = new FakeGenerator([JSON.stringify({ clusters: [{ rule: 'Reject offers with shipping fees.', feedbackIds: [1, 2] }] })]);
  const deps: ApiDeps = {
    makeRunDeps: () => ({ z: { runQuery: jest.fn(async () => ({ headers: [], rows: [], ms: 1 })) } as any, llm, memory, logsDir, today: '2026-10-23' }),
    loadSeedFamily: async (id) => mk(id),
    store, memory, llm,
    reviewerToken: () => 'sekret',
    now: () => new Date('2026-10-23T12:00:00Z'),
    ...over,
  };
  const app = express();
  app.use(...bodyParsers());
  app.use(createBundleRouter(deps));
  return { app, deps, store, memory, logsDir };
}

const FAMILY_VIEW_KEYS = ['birthDate', 'dueDate', 'hasItems', 'household', 'insurance', 'name', 'parent1Work', 'parent2Work', 'state', 'zip'];

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
    expect((await request(app).get(`/api/runs/${runId}/trace`)).status).toBe(403); // parents never get the trace
    const trace = await request(app).get(`/api/runs/${runId}/trace`).set('x-reviewer-token', 'sekret');
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

  it('inline family: runs with the defaults, state comes from zip_states', async () => {
    const { app, deps } = build();
    let seen: Family | undefined;
    (benefits.planBenefits as jest.Mock).mockImplementation(async (ctx: any) => { seen = ctx.family; return []; });
    const res = await request(app).post('/api/run?wait=true').send({ zip: '02139', birthDate: '2026-10-01', employer: 'Acme' });
    expect(res.status).toBe(200);
    expect(seen).toMatchObject({ householdSize: 3, annualIncomeCents: null, dcfsaOffered: true, state: 'MA', employer: 'Acme', isGuest: true, userId: null });
    expect(seen!.id).toMatch(/^guest-/);
    expect(deps.store).toBeDefined();
  });

  it('inline family: the Q4 and Q5 answers reach the family, the run and the saved family, and the new id comes back', async () => {
    const { app, store } = build();
    let seen: Family | undefined;
    (benefits.planBenefits as jest.Mock).mockImplementation(async (ctx: any) => { seen = ctx.family; return []; });
    const answers = { household: 'two', parent1Work: 'paycheck', parent2Work: 'not_working', insurance: 'tricare' };
    const res = await request(app).post('/api/run').send({ zip: '02139', birthDate: '2026-10-01', ...answers });
    expect(res.status).toBe(202);
    expect(res.body.familyId).toMatch(/^guest-/);
    expect(seen).toMatchObject({ ...answers, householdSize: 3 });
    const saved = await (store as any).getFamily(res.body.familyId);
    expect(saved).toMatchObject({ ...answers, zip: '02139', state: 'MA', birthDate: '2026-10-01', isGuest: true });
    const status = (await request(app).get(`/api/runs/${res.body.runId}`)).body;
    expect(status.family).toMatchObject({ ...answers, hasItems: false });
  });

  it('inline family: "just me" drops the second parent, and skipped questions stay empty (null)', async () => {
    const { app, store } = build();
    const one = await request(app).post('/api/run').send({ zip: '02139', dueDate: '2027-01-15', household: 'one', parent1Work: 'self_employed', parent2Work: 'paycheck', insurance: 'job' });
    expect(await (store as any).getFamily(one.body.familyId)).toMatchObject({ household: 'one', parent1Work: 'self_employed', parent2Work: null, householdSize: 2, insurance: 'job' });
    const skipped = await request(app).post('/api/run').send({ zip: '02139', dueDate: '2027-01-15', insurance: 'none_or_not_sure' });
    expect(skipped.status).toBe(202);
    expect(await (store as any).getFamily(skipped.body.familyId)).toMatchObject({ household: null, parent1Work: null, parent2Work: null, insurance: 'none_or_not_sure' });
  });

  it('inline family: an answer outside the lists is a 400', async () => {
    const { app } = build();
    for (const bad of [{ household: 'three' }, { parent1Work: 'W-2', household: 'one' }, { insurance: 'aetna' }]) {
      const res = await request(app).post('/api/run').send({ zip: '02139', birthDate: '2026-10-01', ...bad });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Choose one of the listed answers.');
    }
  });

  it('a family that cannot be saved still runs, and no id is returned', async () => {
    const { app, store } = build();
    jest.spyOn(store, 'saveFamily').mockRejectedValue(new Error('db down'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await request(app).post('/api/run').send({ zip: '02139', birthDate: '2026-10-01', insurance: 'job' });
    expect(res.status).toBe(202);
    expect(res.body.familyId).toBeUndefined();
    expect(typeof res.body.runId).toBe('string');
  });

  it('a sample family is not re-saved and gets no new id', async () => {
    const { app, store } = build();
    const spy = jest.spyOn(store, 'saveFamily');
    const res = await request(app).post('/api/run').send({ familyId: 'maya' });
    expect(res.status).toBe(202);
    expect(res.body.familyId).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });

  it('M11: birth date must be within the last 2 years, due date within the next 10 months', async () => {
    const { app } = build();
    const post = (b: object) => request(app).post('/api/run?wait=true').send({ zip: '02139', employer: 'X', ...b });
    expect((await post({ birthDate: '2010-05-01' })).status).toBe(400);
    expect((await post({ birthDate: '2010-05-01' })).body.error).toMatch(/last 2 years/);
    expect((await post({ birthDate: '2026-12-01' })).status).toBe(400); // a "birth" date in the future
    expect((await post({ dueDate: '2031-01-01' })).status).toBe(400);
    expect((await post({ dueDate: '2031-01-01' })).body.error).toMatch(/next 10 months/);
    expect((await post({ dueDate: '2026-01-01' })).status).toBe(400); // a "due" date long past
    expect((await post({ birthDate: '2024-11-01' })).status).toBe(200);
    expect((await post({ birthDate: '2026-10-23' })).status).toBe(200);
    expect((await post({ dueDate: '2027-08-01' })).status).toBe(200);
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
    const { app } = build({ maxInFlightPerIp: 100 });
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

  it('I9: one visitor (IP) can have only 2 runs going at once; a slot frees when one finishes', async () => {
    const { app } = build();
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    (benefits.planBenefits as jest.Mock).mockImplementation(async () => { await gate; return []; });
    expect((await request(app).post('/api/run').send({ familyId: 'leo' })).status).toBe(202);
    expect((await request(app).post('/api/run').send({ familyId: 'leo' })).status).toBe(202);
    const third = await request(app).post('/api/run').send({ familyId: 'leo' });
    expect(third.status).toBe(429);
    expect(third.body.error).toMatch(/2 runs going/);
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
    const b = await request(app).post('/api/feedback').set('x-reviewer-token', 'sekret').send({ familyId: 'leo', cardId: 'd2', kind: 'issue', note: 'shipping charge' });
    expect(b.body.proposals).toHaveLength(1);
    expect(b.body.proposals[0].confidence).toBe(0.7);
    expect((await store.listProposals())).toHaveLength(1);
    const list = await request(app).get('/api/case-law').set('x-reviewer-token', 'sekret');
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
    expect((await request(app).get('/api/case-law').set('x-reviewer-token', 'sekret')).body.approved).toHaveLength(1);
    expect((await request(app).post('/api/case-law/99/approve').set('x-reviewer-token', 'sekret')).status).toBe(404);
  });
});

describe('UI helpers (Task 12)', () => {
  it('run status carries the family display fields and today, never income', async () => {
    const { app } = build();
    const { runId } = (await request(app).post('/api/run').send({ familyId: 'leo' })).body;
    const body = (await request(app).get(`/api/runs/${runId}`)).body;
    expect(body.today).toBe('2026-10-23');
    expect(Object.keys(body.family).sort()).toEqual(FAMILY_VIEW_KEYS); // display fields and the Q4/Q5 answers, nothing else leaked
    expect(body.family).toEqual({ name: 'leo', birthDate: null, dueDate: '2026-12-07', state: 'MA', zip: '02139', household: null, parent1Work: null, parent2Work: null, insurance: null, hasItems: false }); // this test's stand-in family has no answers
    expect(JSON.stringify(body)).not.toContain('14500000');
  });

  it('GET /api/scoreboard returns null before any eval, then the saved JSON', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-'));
    const file = path.join(dir, 'scoreboard.json');
    const { app } = build({ scoreboardFile: () => file });
    const owner = () => request(app).get('/api/scoreboard').set('x-reviewer-token', 'sekret');
    expect((await owner()).body).toEqual({ scoreboard: null });
    fs.writeFileSync(file, JSON.stringify({ trapsCaught: 6, trapsTotal: 6 }));
    expect((await owner()).body).toEqual({ scoreboard: { trapsCaught: 6, trapsTotal: 6 } });
  });

  it('GET /api/scoreboard without the reviewer token is a 403 that leaks no rule text, memory ids, storage or model mode', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-'));
    const file = path.join(dir, 'scoreboard.json');
    fs.writeFileSync(file, JSON.stringify({ trapsCaught: 6, trapsTotal: 6, llmMode: 'live', learningDetail: { ruleText: 'Reject offers with shipping fees.', memoryIds: ['mem-42'], storedIn: 'meterless' } }));
    const { app } = build({ scoreboardFile: () => file });
    for (const res of [await request(app).get('/api/scoreboard'), await request(app).get('/api/scoreboard').set('x-reviewer-token', 'wrong')]) {
      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toMatch(/shipping|mem-42|meterless|llmMode|live/);
    }
    const full = await request(app).get('/api/scoreboard').set('x-reviewer-token', 'sekret');
    expect(full.body.scoreboard.learningDetail.ruleText).toBe('Reject offers with shipping fees.');
  });
});

describe('W1-OWNER: owner view split (parent response trimmed on the server)', () => {
  const HIDDEN_KEYS = ['traceId', 'agent', 'claim', 'evidenceSql', 'retryCount'];
  const HIDDEN_TEXT = [/zetaris/i, /\bv_[a-z_]+\b/, /cited mem-/i, /case law/i, /court was offline/i, /SELECT /i, /Reject offers that turn into paid memberships/];
  const PARENT_CARD_KEYS = ['amountCents', 'body', 'deadline', 'id', 'kind', 'sources', 'title', 'verdict'];
  const VALUE_SCORE_KEYS = ['catchTypes', 'effortLevel', 'effortMinutesEstimate', 'payoutWaitDays', 'reasons', 'stepsCount', 'timeLabel', 'trueValueCents', 'worthYourTime'];

  function withLeakyCards() {
    const ctx = build();
    (court.judgeOffers as jest.Mock).mockImplementation(async (c: any) => {
      c.blocked.push({ id: 'blocked-7', kind: 'discount', title: 'Free box', body: 'Court was offline; case law applies: Reject offers that turn into paid memberships. [cited mem-1]', amountCents: null, deadline: null, verdict: 'blocked', sources: [], traceId: 't-9' });
      return [{ id: 'discount-8', kind: 'discount', title: 'Wipes deal', body: 'Store X has an offer.', amountCents: 500, deadline: null, verdict: 'likely', sources: [{ label: 'Store X offer page', url: 'https://example.com' }], traceId: 't-8', agent: 'fine_print_court', claim: { type: 'offer', offerId: 8 }, evidenceSql: 'SELECT * FROM v_judge_offers WHERE id = 8', retryCount: 0 }];
    });
    return ctx;
  }
  const expectParentSafe = (result: any) => {
    for (const c of [...result.cards, ...(result.blocked ?? [])]) {
      // The Home bucket (category) and the minutes estimate are plain facts the parent's screen needs; everything else is the fixed list.
      expect(Object.keys(c).filter((k) => k !== 'category' && k !== 'minutes').sort()).toEqual(PARENT_CARD_KEYS);
      for (const k of HIDDEN_KEYS) expect(c).not.toHaveProperty(k);
    }
    const text = JSON.stringify(result);
    for (const re of HIDDEN_TEXT) expect(text).not.toMatch(re);
  };

  it('POST /api/run?wait=true without a token: no debate text, data-source names, memory rules or trace ids', async () => {
    const { app } = withLeakyCards();
    const res = await request(app).post('/api/run?wait=true').send({ familyId: 'leo' });
    expect(res.status).toBe(200);
    expect(res.body.blocked).toHaveLength(1);
    expect(res.body.blocked[0].body).toBe('Other parents reported a catch like this one, so we left it out.');
    expectParentSafe(res.body);
  });

  it('parentResult / parentCard keep a Value Score on offer cards, copying only its known fields; other cards get no valueScore key', () => {
    const vs = { trueValueCents: 500, effortLevel: 'low', effortMinutesEstimate: { min: 7, max: 15 }, stepsCount: 1, payoutWaitDays: { min: 14, max: 28 }, timeLabel: 'money in about 2–4 weeks', catchTypes: ['mail_in'], worthYourTime: true, reasons: ['$5.00 after the strings attached'], internalNote: 'SELECT secret' };
    const base = { kind: 'discount', title: 'T', body: 'B', amountCents: 500, deadline: null, verdict: 'likely', sources: [], traceId: 't-1' };
    const r: any = { familyId: 'leo', runId: 'r1', banner: null, receipt: { moneyBackCents: 0, likelyBenefitsCents: 0, deadlineCount: 0, nextDeadline: null, itemsChecked: 0 },
      cards: [{ ...base, id: 'discount-8', valueScore: vs }, { ...base, id: 'recall-1', kind: 'recall' }] };
    const out = parentResult(r).cards;
    expect(Object.keys(out[0]).sort()).toEqual([...PARENT_CARD_KEYS, 'valueScore'].sort());
    expect(Object.keys((out[0] as any).valueScore).sort()).toEqual(VALUE_SCORE_KEYS);
    expect(Object.keys(out[1]).sort()).toEqual(PARENT_CARD_KEYS);
    expect(JSON.stringify(out)).not.toMatch(/SELECT|internalNote|traceId/);
    expect(parentCard(r.cards[0]).valueScore!.payoutWaitDays).toEqual({ min: 14, max: 28 });
  });

  it('?wait=true returns the family with exactly the display fields and onboarding answers (no income, employer)', async () => {
    const { app } = withLeakyCards();
    for (const headers of [{}, { 'x-reviewer-token': 'sekret' }]) {
      const res = await request(app).post('/api/run?wait=true').set(headers).send({ familyId: 'leo' });
      expect(res.status).toBe(200);
      expect(Object.keys(res.body.family).sort()).toEqual(FAMILY_VIEW_KEYS);
      expect(JSON.stringify(res.body)).not.toMatch(/income|employer|householdSize/i); // the ZIP goes back only as the family's own display field (the Account tab shows it)
    }
  });

  it('GET /api/runs/:id without a token is trimmed and carries parent-safe progress steps', async () => {
    const { app } = withLeakyCards();
    const { runId } = (await request(app).post('/api/run').send({ familyId: 'leo' })).body;
    let body: any;
    for (let i = 0; i < 50; i++) { body = (await request(app).get(`/api/runs/${runId}`)).body; if (body.status === 'done') break; await new Promise((r) => setTimeout(r, 20)); }
    expect(body.owner).toBe(false);
    expectParentSafe(body.result);
    expect(body.progress).toHaveLength(5);
    for (const s of body.progress) {
      expect(Object.keys(s).sort()).toEqual(['key', 'label', 'state']);
      expect(s.state).toBe('done');
      expect(s.label).not.toMatch(/court|fact-checker|agent|zetaris|clawback/i);
    }
  });

  it('with the reviewer token: the full result (trace ids, debate text) and the trace come back', async () => {
    const { app } = withLeakyCards();
    const full = await request(app).post('/api/run?wait=true').set('x-reviewer-token', 'sekret').send({ familyId: 'leo' });
    expect(full.body.blocked[0].traceId).toBe('t-9');
    expect(full.body.blocked[0].body).toMatch(/case law applies/);
    expect(full.body.cards.some((c: any) => c.traceId)).toBe(true);
    const { runId } = full.body;
    expect((await request(app).get(`/api/runs/${runId}`).set('x-reviewer-token', 'sekret')).body.owner).toBe(true);
    expect((await request(app).get(`/api/runs/${runId}/trace`).set('x-reviewer-token', 'wrong')).status).toBe(403);
  });

  it('parentResult copies only the five known receipt fields', () => {
    const r: any = { familyId: 'leo', runId: 'r1', banner: null, cards: [],
      receipt: { moneyBackCents: 1, likelyBenefitsCents: 2, deadlineCount: 3, nextDeadline: null, itemsChecked: 4, debugSql: 'SELECT * FROM v_x', memoryId: 'mem-9' } };
    expect(parentResult(r).receipt).toEqual({ moneyBackCents: 1, likelyBenefitsCents: 2, deadlineCount: 3, nextDeadline: null, itemsChecked: 4 });
  });

  it('the court\'s offline approval already uses plain words, so parents and the owner see the same sentence', async () => {
    const { app } = build();
    (court.judgeOffers as jest.Mock).mockResolvedValue([{ id: 'discount-9', kind: 'discount', title: 'Diaper deal', body: "Store Y has an offer. No flagged terms found. We couldn't fully check this offer's fine print.", amountCents: 300, deadline: null, verdict: 'likely', sources: [], traceId: 't-1', agent: 'fine_print_court', claim: { type: 'offer', offerId: 9 }, evidenceSql: 'SELECT 1', retryCount: 0 }]);
    const parent = await request(app).post('/api/run?wait=true').send({ familyId: 'leo' });
    const card = parent.body.cards.find((c: any) => c.id === 'discount-9');
    expect(card.body).toBe("Store Y has an offer. No flagged terms found. We couldn't fully check this offer's fine print.");
    expect(JSON.stringify(parent.body)).not.toMatch(/AI court|Offline screen/);
    const owner = await request(app).post('/api/run?wait=true').set('x-reviewer-token', 'sekret').send({ familyId: 'leo' });
    expect(owner.body.cards.find((c: any) => c.id === 'discount-9').body).toBe("Store Y has an offer. No flagged terms found. We couldn't fully check this offer's fine print.");
  });

  it('GET /api/case-law hides rule text without the token, shows it with the token', async () => {
    const { app, store } = build();
    await store.saveProposals([{ text: 'Reject shipping fees', confidence: 0.7, sourceFeedbackIds: ['1', '2'] }]);
    const parent = await request(app).get('/api/case-law');
    expect(parent.status).toBe(200);
    expect(parent.body).toEqual({ proposals: [], approved: [], proposedCount: 1, approvedCount: 0 });
    expect(JSON.stringify(parent.body)).not.toContain('shipping');
    const owner = await request(app).get('/api/case-law').set('x-reviewer-token', 'sekret');
    expect(owner.body.proposals[0].text).toBe('Reject shipping fees');
  });

  it('POST /api/feedback without a token never returns the proposed rule text', async () => {
    const { app } = build();
    await request(app).post('/api/feedback').send({ familyId: 'maya', cardId: 'd1', kind: 'issue', note: 'shipping fee' });
    const b = await request(app).post('/api/feedback').send({ familyId: 'leo', cardId: 'd2', kind: 'issue', note: 'shipping charge' });
    expect(b.status).toBe(200);
    expect(b.body.proposals).toEqual([]);
    expect(b.body.proposedCount).toBe(1);
    expect(JSON.stringify(b.body)).not.toMatch(/Reject offers with shipping fees/);
  });

  it('an empty REVIEWER_MODE_TOKEN never unlocks the owner view', async () => {
    const { app } = build({ reviewerToken: () => '' });
    const { runId } = (await request(app).post('/api/run?wait=true').set('x-reviewer-token', '').send({ familyId: 'leo' })).body;
    expect((await request(app).get(`/api/runs/${runId}/trace`).set('x-reviewer-token', '')).status).toBe(403);
  });
});

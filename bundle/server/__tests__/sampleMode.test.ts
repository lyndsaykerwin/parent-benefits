import os from 'os';
import fs from 'fs';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { createBundleRouter } from '../routes/bundleRoutes';
import { createDefaultApiDeps, makeZetarisClient } from '../bundleDeps';
import { bodyParsers } from '../middleware/bodyLimit';

// SAMPLE_MODE must work with no keys and no database.
describe('SAMPLE_MODE with no secrets', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it('runs a sample family end to end and traces Zetaris calls', async () => {
    for (const k of ['DATABASE_URL', 'ZETARIS_BASE_URL', 'ZETARIS_ORG_ID', 'ZETARIS_API_KEY', 'MODEL_API_KEY']) delete process.env[k];
    process.env.SAMPLE_MODE = 'true';
    const logsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sample-'));
    const deps = createDefaultApiDeps();
    const base = deps.makeRunDeps;
    deps.makeRunDeps = (f) => ({ ...base(f), logsDir });
    const app = express();
    app.use(...bodyParsers());
    app.use(createBundleRouter(deps));

    const res = await request(app).post('/api/run?wait=true').send({ familyId: 'leo' });
    expect(res.status).toBe(200);
    expect(res.body.cards.length).toBeGreaterThanOrEqual(9);

    const file = fs.readdirSync(logsDir).find((f) => f.startsWith('run-leo'))!;
    const lines = fs.readFileSync(path.join(logsDir, file), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    expect(lines.some((l) => l.agent_name === 'zetaris' && l.action === 'query_cached')).toBe(true);
  });

  it('accepts a typed-in ZIP without a database', async () => {
    delete process.env.DATABASE_URL;
    process.env.SAMPLE_MODE = 'true';
    const deps = createDefaultApiDeps();
    expect(await deps.store.zipState('021')).toBe('MA');
  });
});

// The README's "Try the learning loop" steps, end to end, with no keys and no database.
describe('SAMPLE_MODE learning loop (README steps)', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  // Oct 26 blocking rule: the obvious free-box trap (card on file + paid plan) is now blocked by the code rules on run 1,
  // so the learning loop is shown on the subtler trap (savings that only last while a subscription stays active).
  it('maya shows the subscription-savings offer, two reports + a reviewer approval block it, and run 2 cites the learned rule', async () => {
    for (const k of ['DATABASE_URL', 'ZETARIS_BASE_URL', 'ZETARIS_ORG_ID', 'ZETARIS_API_KEY', 'MODEL_API_KEY']) delete process.env[k];
    process.env.SAMPLE_MODE = 'true';
    process.env.REVIEWER_MODE_TOKEN = 'demo';
    const logsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'learn-'));
    const { BundleMemory } = await import('../adapters/memory');
    const memory = new BundleMemory(fs.mkdtempSync(path.join(os.tmpdir(), 'learn-mem-')));
    const deps = createDefaultApiDeps();
    const base = deps.makeRunDeps;
    deps.makeRunDeps = (f) => ({ ...base(f), logsDir, memory });
    deps.memory = memory;
    const app = express();
    app.use(...bodyParsers());
    app.use(createBundleRouter(deps));
    const TRAP = 'Amazon Subscribe & Save diaper discount';
    const trap = (cards: { title: string; id: string }[]) => cards.find((c) => c.title === TRAP);

    const run1 = await request(app).post('/api/run?wait=true').send({ familyId: 'maya' });
    expect(run1.status).toBe(200);
    const t1 = trap(run1.body.cards);
    expect(t1).toBeDefined();

    expect(run1.body.blocked.map((c: { title: string }) => c.title)).toContain('Free newborn diaper box'); // the obvious trap: caught by the code rules
    for (const note of ['My savings disappeared the moment I stopped the delivery plan, and the price kept changing.', 'The discount only counts while the plan stays active; the price changed on the second order, so the savings were gone.']) {
      const fb = await request(app).post('/api/feedback').send({ familyId: 'maya', cardId: t1!.id, kind: 'issue', note });
      expect(fb.status).toBe(200);
    }
    const law = await request(app).get('/api/case-law').set('x-reviewer-token', 'demo'); // rule text is owner-only (W1-OWNER)
    expect(law.body.proposals).toHaveLength(1);
    const id = law.body.proposals[0].id;
    expect((await request(app).post(`/api/case-law/${id}/approve`)).status).toBe(403); // no token
    const ok = await request(app).post(`/api/case-law/${id}/approve`).set('x-reviewer-token', 'demo');
    expect(ok.status).toBe(200);

    const run2 = await request(app).post('/api/run?wait=true').send({ familyId: 'maya' });
    expect(trap(run2.body.cards)).toBeUndefined();
    expect(run2.body.blocked.map((c: { title: string }) => c.title)).toContain(TRAP); // parent sees it in "We caught these"
    expect(JSON.stringify(run2.body)).not.toMatch(/traceId|cited mem-|case law/i); // ...without the owner-only detail
    const file = fs.readdirSync(logsDir).filter((f) => f.startsWith('run-maya')).map((f) => fs.readFileSync(path.join(logsDir, f), 'utf8')).join('\n');
    expect(file).toMatch(/\[cited mem-/);
    expect(file).toMatch(/"agent_name":"memory"/);
  });

  it('a typed-in family gets checked cards from the saved shared data, a real Receipt and no banner (I4)', async () => {
    for (const k of ['DATABASE_URL', 'ZETARIS_BASE_URL', 'ZETARIS_ORG_ID', 'ZETARIS_API_KEY', 'MODEL_API_KEY']) delete process.env[k];
    process.env.SAMPLE_MODE = 'true';
    const logsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guest-'));
    const { BundleMemory } = await import('../adapters/memory');
    const memory = new BundleMemory(fs.mkdtempSync(path.join(os.tmpdir(), 'guest-mem-')));
    const deps = createDefaultApiDeps();
    const base = deps.makeRunDeps;
    deps.makeRunDeps = (f) => ({ ...base(f), logsDir, memory });
    const app = express();
    app.use(...bodyParsers());
    app.use(createBundleRouter(deps));
    const born = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10);
    const res = await request(app).post('/api/run?wait=true').send({ zip: '02139', birthDate: born, employer: 'X' });
    expect(res.status).toBe(200);
    expect(res.body.banner).toBeNull();
    expect(res.body.cards.length).toBeGreaterThanOrEqual(9);
    expect(res.body.cards.some((c: any) => c.kind === 'benefit')).toBe(true);
    expect(res.body.cards.some((c: any) => c.kind === 'discount' && c.verdict === 'likely')).toBe(true);
    expect(res.body.receipt.likelyBenefitsCents).toBeGreaterThan(0);
    expect(res.body.receipt.itemsChecked).toBe(0);
  });
});

// Live app runs must never rewrite data/sample/zetaris-cache (the recording SAMPLE_MODE and the tests replay).
describe('makeZetarisClient saved-answer writes', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });
  const records = (sample: boolean) => (makeZetarisClient(sample) as unknown as { opts: { record?: boolean } }).opts.record;

  it('a live run does not record unless ZETARIS_RECORD=true (set only by examples:regen --live)', () => {
    delete process.env.ZETARIS_RECORD;
    expect(records(false)).toBe(false);
    process.env.ZETARIS_RECORD = 'true';
    expect(records(false)).toBe(true);
  });

  it('SAMPLE_MODE never records, even with ZETARIS_RECORD=true', () => {
    process.env.ZETARIS_RECORD = 'true';
    expect(records(true)).toBe(false);
  });
});

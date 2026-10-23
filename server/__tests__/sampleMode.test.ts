import os from 'os';
import fs from 'fs';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { createBundleRouter } from '../routes/bundleRoutes';
import { createDefaultApiDeps } from '../bundleDeps';
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

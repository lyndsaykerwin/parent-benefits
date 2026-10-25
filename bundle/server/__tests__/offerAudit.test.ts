import fs from 'fs';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { createOfferAuditRouter, createDefaultOfferAuditDeps, BRAND_FIELDS } from '../routes/offerAuditRoutes';
import { offerAuditSql } from '../agents/savedVerdicts';

const COLS = ['store', 'offers_checked', 'offers_caught', 'catch_rate', 'avg_face_value_cents', 'avg_true_value_cents', 'avg_effort_minutes'];
const ROW = { store: 'Made-up Store', offers_checked: 4, offers_caught: 1, catch_rate: 0.25, avg_face_value_cents: 2000, avg_true_value_cents: 1500, avg_effort_minutes: 12 };

// Fake Zetaris: records the SQL it is asked and answers from a table (or fails).
function fakeZ(rows: Record<string, unknown>[] | Error) {
  const asked: string[] = [];
  return {
    asked,
    z: {
      runQuery: jest.fn(async (sql: string) => {
        asked.push(sql);
        if (rows instanceof Error) throw rows;
        return { headers: COLS, rows, ms: 1 };
      }),
    } as any,
  };
}

function build(rows: Record<string, unknown>[] | Error, limit?: { limit: number; windowMs: number }) {
  const f = fakeZ(rows);
  const app = express();
  app.use(createOfferAuditRouter({ zetaris: () => f.z, limit }));
  return { app, f };
}

describe('GET /api/offer-audit', () => {
  it('asks the exact saved question and returns per-brand totals in plain names', async () => {
    const { app, f } = build([ROW]);
    const res = await request(app).get('/api/offer-audit');
    expect(res.status).toBe(200);
    expect(f.asked).toEqual([offerAuditSql()]);
    expect(res.body.status).toBe('found');
    expect(res.body.brands).toEqual([{
      store: 'Made-up Store', offersChecked: 4, offersCaught: 1, catchRate: 0.25,
      avgFaceValueCents: 2000, avgTrueValueCents: 1500, avgEffortMinutes: 12,
    }]);
  });

  it('never returns family fields or reviewer-only text, even if the source row carried them', async () => {
    const dirty = { ...ROW, family_id: 'maya', annual_income_cents: 14500000, zip: '02139', employer: 'N', rule_citations: '["FP-07"]', note: 'owner only', sql: 'select 1' };
    const { app } = build([dirty]);
    const res = await request(app).get('/api/offer-audit');
    const text = JSON.stringify(res.body);
    expect(Object.keys(res.body.brands[0]).sort()).toEqual([...BRAND_FIELDS].sort());
    expect(text).not.toMatch(/family|income|zip|employer|maya|rule_citations|owner only|select|v_offer|zetaris|bundle_pg/i);
  });

  it('says none when nothing is saved yet (honest, not made-up)', async () => {
    const { app } = build([]);
    const res = await request(app).get('/api/offer-audit');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'none', brands: [] });
    expect(res.body.message).toMatch(/no offer grades/i);
  });

  it('says unavailable (503) when Zetaris cannot answer, without leaking the error text', async () => {
    const { app } = build(new Error('secret connection string bundle_pg at host x'));
    const res = await request(app).get('/api/offer-audit');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'unavailable', brands: [] });
    expect(JSON.stringify(res.body)).not.toMatch(/secret|bundle_pg|host x/);
  });

  it('supports ?store= for one brand using the fixed per-brand question', async () => {
    const { app, f } = build([ROW]);
    const res = await request(app).get('/api/offer-audit').query({ store: "Joe's Store" });
    expect(res.status).toBe(200);
    expect(f.asked).toEqual([offerAuditSql("Joe's Store")]);
  });

  it('rejects a store name that is not plain text, and never sends it to Zetaris', async () => {
    const { app, f } = build([ROW]);
    for (const bad of ['x; DROP TABLE y', "a' OR '1'='1;--", 'z'.repeat(200)]) {
      const res = await request(app).get('/api/offer-audit').query({ store: bad });
      expect(res.status).toBe(400);
    }
    expect((await request(app).get('/api/offer-audit?store=a&store=b')).status).toBe(400);
    expect(f.asked).toEqual([]);
  });

  it('is rate limited and the limit message is plain', async () => {
    const { app } = build([ROW], { limit: 2, windowMs: 60_000 });
    expect((await request(app).get('/api/offer-audit')).status).toBe(200);
    expect((await request(app).get('/api/offer-audit')).status).toBe(200);
    const res = await request(app).get('/api/offer-audit');
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/too many/i);
  });

  it('is read only: other methods are not served', async () => {
    const { app } = build([ROW]);
    expect((await request(app).post('/api/offer-audit').send({})).status).toBe(404);
  });
});

describe('sample mode with the real saved answers', () => {
  const OLD = process.env.SAMPLE_MODE;
  afterEach(() => { if (OLD === undefined) delete process.env.SAMPLE_MODE; else process.env.SAMPLE_MODE = OLD; });
  const sampleApp = () => {
    process.env.SAMPLE_MODE = 'true';
    const app = express();
    app.use(createOfferAuditRouter(createDefaultOfferAuditDeps()));
    return app;
  };

  it('replays the recorded answer for the all-brands question (honest none while nothing is graded)', async () => {
    const res = await request(sampleApp()).get('/api/offer-audit');
    expect(res.status).toBe(200);
    expect(['found', 'none']).toContain(res.body.status);
  });

  it('falls back honestly (503 unavailable) for a question that was never recorded, with no network call', async () => {
    const spy = jest.spyOn(global, 'fetch' as any);
    const res = await request(sampleApp()).get('/api/offer-audit').query({ store: 'Never Recorded Store' });
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unavailable');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('docs/openapi/offer-audit.yaml', () => {
  const yaml = fs.readFileSync(path.resolve('docs/openapi/offer-audit.yaml'), 'utf8');

  it('describes the endpoint, its statuses and every response field', () => {
    expect(yaml).toMatch(/^openapi: 3\./m);
    expect(yaml).toMatch(/\/api\/offer-audit:/);
    expect(yaml).toMatch(/get:/);
    for (const code of ["'200'", "'400'", "'429'", "'503'"]) expect(yaml).toContain(code);
    for (const f of [...BRAND_FIELDS, 'status', 'brands', 'message', 'store']) expect(yaml).toContain(f);
  });

  it('promises no family data and declares no family fields', () => {
    expect(yaml).toMatch(/no family/i);
    const props = yaml.split('\n').filter((l) => /^\s+[a-zA-Z]+:\s*$/.test(l)).join('\n');
    expect(props).not.toMatch(/familyId|income|zip|employer|birth|dueDate|parent/i);
  });

  it('has no keys, tokens or reviewer headers', () => {
    expect(yaml).not.toMatch(/Bearer\s+[A-Za-z0-9]|sk-[A-Za-z0-9]|x-reviewer-token/i);
  });
});

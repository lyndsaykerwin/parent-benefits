import os from 'os';
import fs from 'fs';
import path from 'path';
import { verify } from '../agents/factChecker';
import { TraceLogger } from '../agents/trace';
import { ZetarisUnavailable } from '../adapters/zetaris';
import { FakeGenerator } from '../adapters/llm';
import type { AgentContext, Candidate } from '../agents/types';

const family = {
  id: 'maya', userId: null, isGuest: true, name: 'Maya', birthDate: '2026-10-01', dueDate: null,
  zip: '02139', state: 'MA', employer: 'Acme', householdSize: 3, annualIncomeCents: 9000000,
  dcfsaOffered: true, dataConnected: true,
};

function ctxWith(run: (sql: string) => any) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-'));
  const trace = new TraceLogger('t', dir);
  const runQuery = jest.fn(async (sql: string) => run(sql));
  const ctx = { runId: 't', family, z: { runQuery } as any, llm: new FakeGenerator(['x']), memory: {} as any, trace } as AgentContext;
  return { ctx, runQuery, trace };
}
const res = (rows: any[]) => ({ headers: Object.keys(rows[0] ?? {}), rows, ms: 1 });

function cand(over: Partial<Candidate> = {}): Candidate {
  return {
    id: 'c1', kind: 'discount', title: 'Offer', body: 'b', amountCents: 2899, deadline: null,
    verdict: 'verified', sources: [{ label: 'Store', url: 'https://example.com' }], traceId: 't1',
    agent: 'judge', claim: { type: 'offer', offerId: 7 }, evidenceSql: 'SELECT 1', retryCount: 0, ...over,
  };
}

describe('fact-checker', () => {
  it('passes when the re-query matches the claimed amount', async () => {
    const { ctx, runQuery } = ctxWith(() => res([{ value_cents: 2899, max_age_days: 365 }]));
    const out = await verify(cand(), ctx);
    expect(out).toEqual({ ok: true, reason: null, corrected: null });
    expect(runQuery.mock.calls[0][0]).not.toBe('SELECT 1'); // independent of evidenceSql
    expect(runQuery.mock.calls[0][0]).toMatch(/v_judge_offers/);
  });

  it('fails with amount mismatch and offers the corrected amount', async () => {
    const { ctx } = ctxWith(() => res([{ value_cents: 2499, max_age_days: 365 }]));
    const out = await verify(cand(), ctx);
    expect(out.ok).toBe(false);
    expect(out.reason).toContain('amount mismatch');
    expect(out.corrected?.amountCents).toBe(2499);
  });

  it('fails with "no source" when sources is empty, without querying', async () => {
    const { ctx, runQuery } = ctxWith(() => res([]));
    const out = await verify(cand({ sources: [] }), ctx);
    expect(out).toEqual({ ok: false, reason: 'no source', corrected: null });
    expect(runQuery).not.toHaveBeenCalled();
  });

  it('tolerates a difference of 1 cent but not 2', async () => {
    const a = ctxWith(() => res([{ value_cents: 2900, max_age_days: 365 }]));
    expect((await verify(cand(), a.ctx)).ok).toBe(true);
    const b = ctxWith(() => res([{ value_cents: 2901, max_age_days: 365 }]));
    expect((await verify(cand(), b.ctx)).ok).toBe(false);
  });

  it('checks a benefit deadline computed from the birth date', async () => {
    const rule = { amount_cents: 100000, window_end_days_from_birth: 30 };
    const c = cand({ kind: 'benefit', amountCents: 100000, deadline: '2026-10-31', claim: { type: 'rule', ref: 'PFML' } });
    const good = ctxWith(() => res([rule]));
    expect((await verify(c, good.ctx)).ok).toBe(true); // 2026-10-01 + 30 = 2026-10-31
    const bad = ctxWith(() => res([rule]));
    const out = await verify({ ...c, deadline: '2026-12-01' }, bad.ctx);
    expect(out.ok).toBe(false);
    expect(out.reason).toContain('deadline mismatch');
    expect(out.corrected?.deadline).toBe('2026-10-31');
  });

  it('fails when the source row is missing', async () => {
    const { ctx } = ctxWith(() => res([]));
    const out = await verify(cand(), ctx);
    expect(out.ok).toBe(false);
    expect(out.reason).toContain('not found');
  });

  it('verifies a recall id exists in the live feed', async () => {
    const c = cand({ kind: 'recall', amountCents: null, claim: { type: 'recall', recallId: 10560 } });
    const ok = ctxWith(() => res([{ RecallID: 10560 }]));
    expect((await verify(c, ok.ctx)).ok).toBe(true);
    const none = ctxWith(() => ({ headers: [], rows: [], ms: 1 }));
    expect((await verify(c, none.ctx)).ok).toBe(false);
  });

  it('verifies a clawback transaction belongs to this family and has the claimed amount', async () => {
    const c = cand({ kind: 'clawback', amountCents: 500, claim: { type: 'clawback', txId: 'tx1', txAmountCents: 4000 } });
    const good = ctxWith(() => res([{ amount_cents: 4000, family_id: 'maya' }]));
    expect((await verify(c, good.ctx)).ok).toBe(true);
    expect(good.runQuery.mock.calls[0][0]).toContain("family_id = 'maya'");
    const bad = ctxWith(() => res([{ amount_cents: 3500, family_id: 'maya' }]));
    const out = await verify(c, bad.ctx);
    expect(out.ok).toBe(false);
    expect(out.reason).toContain('amount mismatch');
  });

  describe('clawback subtypes', () => {
    const clawCand = (type: string, over: Partial<Candidate> = {}) =>
      cand({ kind: 'clawback', agent: 'clawback', claim: { type, txId: 'maya-tx-02', txAmountCents: 8999, planYear: 2026 }, ...over });
    const priceRows = [
      { amount_cents: 8999, tx_date: '2026-10-09', window_days: 14, price_cents: 6999, observed_at: '2026-10-20' },
      { amount_cents: 8999, tx_date: '2026-10-09', window_days: 14, price_cents: 5000, observed_at: '2026-10-30' }, // outside window
    ];

    it('fsa_reimbursement: amount must equal the transaction', async () => {
      const c = clawCand('fsa_reimbursement', { amountCents: 8999 });
      const ok = ctxWith(() => res([{ amount_cents: 8999, family_id: 'maya' }]));
      expect((await verify(c, ok.ctx)).ok).toBe(true);
      const bad = ctxWith(() => res([{ amount_cents: 8999, family_id: 'maya' }]));
      const out = await verify({ ...c, amountCents: 100 }, bad.ctx);
      expect(out.ok).toBe(false);
      expect(out.corrected?.amountCents).toBe(8999);
    });

    it('price_adjustment: recomputes paid minus lowest in-window price and the deadline', async () => {
      const c = clawCand('price_adjustment', { amountCents: 2000, deadline: '2026-10-23' });
      const ok = ctxWith(() => res(priceRows));
      expect((await verify(c, ok.ctx)).ok).toBe(true);
      expect(ok.runQuery.mock.calls[0][0]).toContain("t.family_id = 'maya'");
      const wrongAmt = await verify({ ...c, amountCents: 3999 }, ctxWith(() => res(priceRows)).ctx);
      expect(wrongAmt.ok).toBe(false);
      expect(wrongAmt.corrected?.amountCents).toBe(2000);
      const wrongDay = await verify({ ...c, deadline: '2026-11-30' }, ctxWith(() => res(priceRows)).ctx);
      expect(wrongDay.corrected?.deadline).toBe('2026-10-23');
      const none = await verify(c, ctxWith(() => res([priceRows[1]])).ctx);
      expect(none.ok).toBe(false);
      expect(none.reason).toContain('no lower price');
    });

    it('dcfsa_childcare: sums distinct payments, caps at 750000, needs the employer benefit', async () => {
      const c = clawCand('dcfsa_childcare', { amountCents: 555000 });
      const ok = ctxWith(() => res([{ total_cents: 555000, n: 3 }]));
      expect((await verify(c, ok.ctx)).ok).toBe(true);
      expect(ok.runQuery.mock.calls[0][0]).toContain('SELECT DISTINCT');
      expect(ok.runQuery.mock.calls[0][0]).toContain("'2026-01-01'");
      const bad = await verify({ ...c, amountCents: 600000 }, ctxWith(() => res([{ total_cents: 555000, n: 3 }])).ctx);
      expect(bad.corrected?.amountCents).toBe(555000);
      const capped = await verify({ ...c, amountCents: 750000 }, ctxWith(() => res([{ total_cents: 900000, n: 6 }])).ctx);
      expect(capped.ok).toBe(true);
      const noBenefit = ctxWith(() => res([{ total_cents: 555000, n: 3 }]));
      noBenefit.ctx.family = { ...family, dcfsaOffered: false };
      expect((await verify(c, noBenefit.ctx)).ok).toBe(false);
      const badYear = ctxWith(() => res([]));
      expect((await verify({ ...c, claim: { ...c.claim, planYear: "2026'" } }, badYear.ctx)).ok).toBe(false);
      expect(badYear.runQuery).not.toHaveBeenCalled();
    });
  });

  it('fails closed on unknown claims and when Zetaris is down', async () => {
    const unk = ctxWith(() => res([]));
    const o1 = await verify(cand({ claim: { type: 'mystery' } }), unk.ctx);
    expect(o1.ok).toBe(false);
    expect(o1.reason).toContain('cannot verify');
    const down = ctxWith(() => { throw new ZetarisUnavailable('down'); });
    const o2 = await verify(cand(), down.ctx);
    expect(o2.ok).toBe(false);
    expect(o2.reason).toContain('could not verify');
    expect(o2.unavailable).toBe(true);
  });

  it('rejects unsafe or empty ids without querying', async () => {
    for (const ref of ["A'B", 'x\\', 'a b', '']) {
      const { ctx, runQuery } = ctxWith(() => res([]));
      const out = await verify(cand({ kind: 'benefit', claim: { type: 'rule', ref } }), ctx);
      expect(out).toEqual({ ok: false, reason: 'invalid id', corrected: null });
      expect(runQuery).not.toHaveBeenCalled();
    }
    const e1 = ctxWith(() => res([]));
    expect((await verify(cand({ claim: { type: 'offer', offerId: '' } }), e1.ctx)).ok).toBe(false);
    expect(e1.runQuery).not.toHaveBeenCalled();
    const e2 = ctxWith(() => res([]));
    e2.ctx.family = { ...family, id: "m\\" };
    const o = await verify(cand({ kind: 'clawback', claim: { type: 'clawback', txId: 'tx1', txAmountCents: 1 } }), e2.ctx);
    expect(o.reason).toBe('invalid id');
  });

  it('traces every verify as fact_checker and sends no trailing semicolon', async () => {
    const c = cand({ claim: { type: 'rule', ref: 'PFML_MA' }, kind: 'benefit', amountCents: 5 });
    const { ctx, runQuery, trace } = ctxWith(() => res([{ amount_cents: 5, window_end_days_from_birth: null }]));
    await verify(c, ctx);
    expect(runQuery.mock.calls[0][0]).toContain("'PFML_MA'");
    expect(runQuery.mock.calls[0][0]).not.toMatch(/;\s*$/);
    const l = trace.lines().filter((x) => x.agent_name === 'fact_checker');
    expect(l.length).toBe(1);
    expect(l[0].status).toBe('ok');
    await verify(cand({ sources: [] }), ctx);
    expect(trace.lines().filter((x) => x.agent_name === 'fact_checker')[1].status).toBe('blocked');
  });
});

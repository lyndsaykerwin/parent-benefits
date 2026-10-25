import os from 'os';
import fs from 'fs';
import path from 'path';
import { verify, checkWithCorrections, MAX_CORRECTION_ROUNDS } from '../agents/factChecker';
import { BundleMemory } from '../adapters/memory';
import { Workspace } from '../agents/workspace';
import { BENEFIT_RULES } from '../../scripts/seed';
import { FEEDBACK_DELTAS } from '../../vendor/hmem/src/types';
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

  it('an offer card is never given or corrected to a deadline made from max_age_days', async () => {
    const { ctx } = ctxWith(() => res([{ value_cents: 2899, max_age_days: 365 }]));
    // family born 2026-10-01: the old code "corrected" any other date to 2027-10-01 (birth + 365).
    const out = await verify(cand({ deadline: '2026-12-01' }), ctx);
    expect(out).toEqual({ ok: true, reason: null, corrected: null });
  });

  it('fails with amount mismatch and offers the corrected amount', async () => {
    const { ctx } = ctxWith(() => res([{ value_cents: 2499, max_age_days: 365 }]));
    const out = await verify(cand(), ctx);
    expect(out.ok).toBe(false);
    expect(out.reason).toContain('amount mismatch');
    expect(out.corrected?.amountCents).toBe(2499);
  });

  it('M10: a source that is not an http(s) link counts as no source', async () => {
    for (const url of ['', 'javascript:alert(1)', 'not a url']) {
      const { ctx, runQuery } = ctxWith(() => res([{ value_cents: 2899, max_age_days: 365 }]));
      const out = await verify(cand({ sources: [{ label: 'x', url }] }), ctx);
      expect(out).toEqual({ ok: false, reason: 'no source', corrected: null });
      expect(runQuery).not.toHaveBeenCalled();
    }
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
    const rule = { amount_cents: 100000, window_end_days_from_birth: 30, scope: 'federal' };
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
    const c = cand({ kind: 'recall', amountCents: null, claim: { type: 'recall', recallId: 10560, evidence: 'lot code ABC123 appears in the recall notice', evidenceType: 'lot', evidenceCode: 'ABC123', recalledProduct: 'Acme lot ABC123' } });
    const ok = ctxWith(() => res([{ RecallID: 10560 }]));
    expect((await verify(c, ok.ctx)).ok).toBe(true);
    const none = ctxWith(() => ({ headers: [], rows: [], ms: 1 }));
    expect((await verify(c, none.ctx)).ok).toBe(false);
  });

  it('verifies a clawback purchase item belongs to this family and has the claimed amount', async () => {
    const c = cand({ kind: 'clawback', amountCents: 500, claim: { type: 'clawback', itemId: 11, itemAmountCents: 4000 } });
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
      cand({ kind: 'clawback', agent: 'clawback', claim: { type, itemId: 2, itemAmountCents: 8999 }, ...over });
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
      expect(ok.runQuery.mock.calls[0][0]).toContain("p.family_id = 'maya'");
      const wrongAmt = await verify({ ...c, amountCents: 3999 }, ctxWith(() => res(priceRows)).ctx);
      expect(wrongAmt.ok).toBe(false);
      expect(wrongAmt.corrected?.amountCents).toBe(2000);
      const wrongDay = await verify({ ...c, deadline: '2026-11-30' }, ctxWith(() => res(priceRows)).ctx);
      expect(wrongDay.corrected?.deadline).toBe('2026-10-23');
      const none = await verify(c, ctxWith(() => res([priceRows[1]])).ctx);
      expect(none.ok).toBe(false);
      expect(none.reason).toContain('no lower price');
    });

    it('dcfsa_childcare is gone: the daycare card was dropped, so the claim type fails closed', async () => {
      const c = clawCand('dcfsa_childcare', { amountCents: 555000 });
      const h = ctxWith(() => res([{ total_cents: 555000, n: 3 }]));
      const out = await verify(c, h.ctx);
      expect(out.ok).toBe(false);
      expect(out.reason).toContain('unknown claim type');
      expect(h.runQuery).not.toHaveBeenCalled();
    });

    it('every clawback check reads purchase_items through v_purchase_items, never transactions', async () => {
      const seen: string[] = [];
      for (const type of ['clawback', 'fsa_reimbursement', 'price_adjustment']) {
        const h = ctxWith((sql) => { seen.push(sql); return res([{ amount_cents: 8999, family_id: 'maya', tx_date: '2026-10-09', window_days: 14, price_cents: 6999, observed_at: '2026-10-20' }]); });
        await verify(clawCand(type, { amountCents: 2000 }), h.ctx);
      }
      expect(seen).toHaveLength(3);
      for (const sql of seen) {
        expect(sql).toContain('bundle_pg.v_purchase_items');
        expect(sql).toContain("family_id = 'maya'");
        expect(sql).not.toMatch(/v_clawback_tx|transactions|amazon_orders/i);
      }
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
    const o = await verify(cand({ kind: 'clawback', claim: { type: 'clawback', itemId: 11, itemAmountCents: 1 } }), e2.ctx);
    expect(o.reason).toBe('invalid id');
  });

  it('traces every verify as fact_checker and sends no trailing semicolon', async () => {
    const c = cand({ claim: { type: 'rule', ref: 'PFML_MA' }, kind: 'benefit', amountCents: 5 });
    const { ctx, runQuery, trace } = ctxWith(() => res([{ amount_cents: 5, window_end_days_from_birth: null, scope: 'federal' }]));
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

// ---------- W3-FACT ----------

const recallCand = (claim: Record<string, string | number>, over: Partial<Candidate> = {}): Candidate =>
  cand({ id: 'recall-cpsc-10560', kind: 'recall', agent: 'recall', amountCents: null, claim: { type: 'recall', recallId: 10560, ...claim }, ...over });
const recallOk = { evidence: 'lot code ABC123 appears in the recall notice', evidenceType: 'lot', evidenceCode: 'ABC123', recalledProduct: 'Acme Formula 12oz, lot ABC123', itemText: 'Acme Formula 12oz' };

describe('wrong-state block', () => {
  const ruleRow = (code: string) => {
    const r = BENEFIT_RULES.find((x) => x.code === code)!;
    return { amount_cents: r.amountCents ?? null, window_end_days_from_birth: r.windowEndDaysFromBirth ?? null, scope: r.scope };
  };
  const ruleCard = (code: string) => cand({ kind: 'benefit', agent: 'benefits', amountCents: null, claim: { type: 'rule', ref: code } });

  it('asks the source which place a rule belongs to', async () => {
    const { ctx, runQuery } = ctxWith(() => res([ruleRow('FEDERAL_CHILD_TAX_CREDIT')]));
    await verify(ruleCard('FEDERAL_CHILD_TAX_CREDIT'), ctx);
    expect(runQuery.mock.calls[0][0]).toMatch(/\bscope\b/);
  });

  it("federal cards and the family's own state cards pass", async () => {
    const own = BENEFIT_RULES.find((r) => r.scope === family.state)!;
    for (const code of ['FEDERAL_CHILD_TAX_CREDIT', own.code]) {
      const { ctx } = ctxWith(() => res([ruleRow(code)]));
      expect((await verify(ruleCard(code), ctx)).ok).toBe(true);
    }
  });

  it.each(['maya', 'ava', 'noor', 'cal', 'fern'])("%s: a planted card for another state's program is blocked and never sent back", async (id) => {
    const fams: any[] = JSON.parse(fs.readFileSync(path.resolve('data/sample/families.json'), 'utf8'));
    const f = fams.find((x) => x.id === id);
    const foreign = BENEFIT_RULES.filter((r) => r.scope !== 'federal' && r.scope !== f.state);
    expect(foreign.length).toBeGreaterThan(0);
    for (const r of foreign) {
      const { ctx } = ctxWith(() => res([ruleRow(r.code)]));
      ctx.family = f;
      const out = await verify(ruleCard(r.code), ctx);
      expect(out.ok).toBe(false);
      expect(out.reason).toContain('wrong state');
      expect(out.sendBack).toBe(false);
      expect(out.corrected).toBeNull();
    }
  });

  it('fails closed when the source does not say which place the rule is for', async () => {
    const { ctx } = ctxWith(() => res([{ amount_cents: 5, window_end_days_from_birth: null }]));
    const out = await verify(ruleCard('X_RULE'), ctx);
    expect(out.ok).toBe(false);
    expect(out.reason).toContain('wrong state');
  });

  it('the correction loop drops a wrong-state card at once: no send-back, one reject line', async () => {
    const foreign = BENEFIT_RULES.find((r) => r.scope !== 'federal' && r.scope !== family.state)!;
    const { ctx, trace } = ctxWith(() => res([ruleRow(foreign.code)]));
    const revise = jest.fn();
    const out = await checkWithCorrections(ruleCard(foreign.code), ctx, revise);
    expect(out.decision).toBe('rejected');
    expect(revise).not.toHaveBeenCalled();
    expect(trace.lines().some((l) => l.action === 'reject_card')).toBe(true);
  });
});

describe('targeted corrections (loop 3)', () => {
  const OFFER = { value_cents: 2499, max_age_days: 400 };

  it('names the exact field, what the card said and what the source says', async () => {
    const { ctx } = ctxWith(() => res([OFFER]));
    const out = await verify(cand({ amountCents: 2899 }), ctx);
    expect(out.sendBack).toBe(true);
    expect(out.fixes).toEqual([{ field: 'amount', said: '$28.99', source: '$24.99' }]);
    expect(out.instruction).toContain('amount');
    expect(out.instruction).toContain('$28.99');
    expect(out.instruction).toContain('$24.99');
    expect(out.instruction).toMatch(/only/i);
  });

  it('gives one line per wrong field', async () => {
    // A benefit rule has a real end date to check (offers do not), so use one here.
    const { ctx } = ctxWith(() => res([{ amount_cents: 100000, window_end_days_from_birth: 30, scope: 'federal' }]));
    const out = await verify(cand({ kind: 'benefit', amountCents: 2899, deadline: '2026-12-01', claim: { type: 'rule', ref: 'PFML' } }), ctx);
    expect(out.fixes!.map((f) => f.field)).toEqual(['amount', 'deadline']);
    expect(out.instruction!.split('\n').filter((l) => l.startsWith('- ')).length).toBe(2);
  });

  it('a passing card has no fixes', async () => {
    const { ctx } = ctxWith(() => res([{ value_cents: 2899, max_age_days: 365 }]));
    const out = await verify(cand(), ctx);
    expect(out.fixes).toBeUndefined();
    expect(out.instruction).toBeUndefined();
  });

  it('caps the rounds at 2', () => { expect(MAX_CORRECTION_ROUNDS).toBe(2); });

  it('fixed in round 1: sent back once with the line-specific wording, then approved', async () => {
    const { ctx, trace } = ctxWith(() => res([OFFER]));
    const revise = jest.fn(async (c: Candidate, _why: string) => ({ ...c, amountCents: 2499, retryCount: c.retryCount + 1 }));
    const out = await checkWithCorrections(cand({ amountCents: 2899 }), ctx, revise);
    expect(out.decision).toBe('approved');
    expect(out.rounds).toBe(1);
    expect(out.card.amountCents).toBe(2499);
    expect(revise).toHaveBeenCalledTimes(1);
    expect(revise.mock.calls[0][1]).toContain('$24.99');
    expect(trace.lines().filter((l) => l.action === 'approve_card')).toHaveLength(1);
    expect(trace.agentLines().some((l) => l.agent_name === 'FactChecker' && l.action === 'approve_card' && l.status === 'approved' && l.target_agent === 'ParentFeed')).toBe(true);
    expect(trace.agentLines().some((l) => l.action === 'retry_request' && l.status === 'needs_revision')).toBe(true);
  });

  it('still wrong after 2 rounds: rejected, never a third send-back', async () => {
    const { ctx, runQuery, trace } = ctxWith(() => res([OFFER]));
    const revise = jest.fn(async (c: Candidate, _why: string) => ({ ...c, retryCount: c.retryCount + 1 })); // never fixes it
    const out = await checkWithCorrections(cand({ amountCents: 2899 }), ctx, revise);
    expect(out.decision).toBe('rejected');
    expect(out.rounds).toBe(2);
    expect(revise).toHaveBeenCalledTimes(2);
    expect(runQuery).toHaveBeenCalledTimes(3); // first look plus one re-check per round
    expect(trace.lines().filter((l) => l.action === 'reject_card')).toHaveLength(1);
  });

  it('the producing agent giving up (null) ends the loop as rejected', async () => {
    const { ctx } = ctxWith(() => res([OFFER]));
    const out = await checkWithCorrections(cand({ amountCents: 2899 }), ctx, async () => null);
    expect(out.decision).toBe('rejected');
    expect(out.rounds).toBe(1);
  });

  it('a card with no source is rejected without a send-back', async () => {
    const { ctx } = ctxWith(() => res([OFFER]));
    const revise = jest.fn();
    const out = await checkWithCorrections(cand({ sources: [] }), ctx, revise);
    expect(out.decision).toBe('rejected');
    expect(revise).not.toHaveBeenCalled();
  });

  it('a source that is down leaves the card unchecked, never approved, never sent back', async () => {
    const { ctx } = ctxWith(() => { throw new ZetarisUnavailable('down'); });
    const revise = jest.fn();
    const out = await checkWithCorrections(cand(), ctx, revise);
    expect(out.decision).toBe('unchecked');
    expect(revise).not.toHaveBeenCalled();
  });

  it('posts each send-back as a correction note in the shared workspace', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcw-'));
    const { ctx } = ctxWith(() => res([OFFER]));
    ctx.workspace = new Workspace('t', new BundleMemory(path.join(dir, 'h')), ctx.trace);
    await checkWithCorrections(cand({ amountCents: 2899 }), ctx, async (c) => ({ ...c, amountCents: 2499, retryCount: 1 }));
    const notes = ctx.workspace.read({ type: 'correction' });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ from_agent: 'FactChecker', about: 'c1', round: 1 });
    expect(notes[0].body).toContain('$24.99');
  });

  describe('confirm / correct signal on the lessons used', () => {
    const wsCtx = (rows: any[]) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcl-'));
      const h = ctxWith(() => res(rows));
      h.ctx.workspace = new Workspace('t', new BundleMemory(path.join(dir, 'h')), h.ctx.trace);
      const id = h.ctx.workspace.addLesson({ text: 'store sells baby wipes with hidden fees', offerCheckId: 'oc1', confidence: 0.5 });
      return { ...h, id };
    };
    const lessonLines = (t: any) => t.lines().filter((l: any) => l.action === 'lesson_feedback');

    it('a confirmed card marks its lessons helpful', async () => {
      const h = wsCtx([{ value_cents: 2899, max_age_days: 365 }]);
      await checkWithCorrections(cand(), h.ctx, jest.fn(), { lessonIds: [h.id] });
      expect(h.ctx.workspace!.recallLessons('baby wipes hidden fees')[0].confidence).toBeCloseTo(0.5 + FEEDBACK_DELTAS.helpful, 5);
      expect(lessonLines(h.trace)[0].input_summary).toContain('helpful');
    });

    it('a card that had to be corrected marks its lessons wrong', async () => {
      const h = wsCtx([OFFER]);
      await checkWithCorrections(cand({ amountCents: 2899 }), h.ctx, async (c) => ({ ...c, amountCents: 2499, retryCount: 1 }), { lessonIds: [h.id] });
      expect(lessonLines(h.trace).map((l: any) => l.input_summary.split(' ')[1])).toEqual(['wrong']);
    });

    it('an unchecked card (source down) sends no signal', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcl-'));
      const h = ctxWith(() => { throw new ZetarisUnavailable('down'); });
      h.ctx.workspace = new Workspace('t', new BundleMemory(path.join(dir, 'h')), h.ctx.trace);
      const id = h.ctx.workspace.addLesson({ text: 'lesson one here', offerCheckId: 'oc1', confidence: 0.5 });
      await checkWithCorrections(cand(), h.ctx, jest.fn(), { lessonIds: [id] });
      expect(lessonLines(h.trace)).toHaveLength(0);
    });
  });
});

describe('recall verification (loop 8)', () => {
  it('a recall with evidence that checks out against the recall record and the feed is approved', async () => {
    const { ctx, runQuery } = ctxWith(() => res([{ RecallID: 10560 }]));
    const out = await verify(recallCand(recallOk), ctx);
    expect(out.ok).toBe(true);
    expect(runQuery.mock.calls[0][0]).toMatch(/cpsc_recalls/);
  });

  it('a planted match with no evidence produces no alert, and does not even query', async () => {
    for (const claim of [{}, { evidence: '' }, { evidence: '   ' }] as Record<string, string>[]) {
      const { ctx, runQuery } = ctxWith(() => res([{ RecallID: 10560 }]));
      const out = await verify(recallCand(claim), ctx);
      expect(out.ok).toBe(false);
      expect(out.reason).toContain('no evidence');
      expect(out.sendBack).toBe(false);
      expect(runQuery).not.toHaveBeenCalled();
    }
  });

  it('evidence that the recall record does not back up is rejected (code not in the recalled product text)', async () => {
    const { ctx } = ctxWith(() => res([{ RecallID: 10560 }]));
    const out = await verify(recallCand({ ...recallOk, recalledProduct: 'Acme Formula 12oz, lot ZZZ999' }), ctx);
    expect(out.ok).toBe(false);
    expect(out.reason).toContain('evidence does not match');
  });

  it('a fragment of a longer code does not count', async () => {
    const { ctx } = ctxWith(() => res([{ RecallID: 10560 }]));
    const out = await verify(recallCand({ ...recallOk, recalledProduct: 'Acme Formula lot ABC1234' }), ctx);
    expect(out.ok).toBe(false);
  });

  it('upc evidence matches ignoring leading zeros; model and name evidence work too', async () => {
    const mk = (claim: Record<string, string | number>) => verify(recallCand(claim), ctxWith(() => res([{ RecallID: 10560 }])).ctx);
    expect((await mk({ evidence: 'UPC 0123456789012 appears in the recall notice', evidenceType: 'upc', evidenceCode: '0123456789012', recalledProduct: 'Widget UPC 123456789012', itemText: 'Widget' })).ok).toBe(true);
    expect((await mk({ evidence: 'model number KX-200 appears in the recall notice', evidenceType: 'model', evidenceCode: 'KX-200', recalledProduct: 'Kiddo seat model KX-200', itemText: 'Kiddo seat' })).ok).toBe(true);
    expect((await mk({ evidence: 'the recalled product name appears in what was bought', evidenceType: 'name', recalledProduct: 'Kiddo Seat', itemText: 'Kiddo Seat Deluxe' })).ok).toBe(true);
    expect((await mk({ evidence: 'the recalled product name appears in what was bought', evidenceType: 'name', recalledProduct: 'Kiddo Seat', itemText: 'Plain bib' })).ok).toBe(false);
  });

  it('an unknown evidence type is not accepted', async () => {
    const { ctx } = ctxWith(() => res([{ RecallID: 10560 }]));
    expect((await verify(recallCand({ ...recallOk, evidenceType: 'vibes' }), ctx)).ok).toBe(false);
  });

  it('good evidence but the recall is not in the live feed: rejected', async () => {
    const { ctx } = ctxWith(() => ({ headers: [], rows: [], ms: 1 }));
    expect((await verify(recallCand(recallOk), ctx)).ok).toBe(false);
  });

  it('an openFDA recall is checked the same way', async () => {
    const c = recallCand({ ...recallOk, recallSource: 'fda', recallNumber: 'F-1234-2026' });
    delete (c.claim as any).recallId;
    const { ctx, runQuery } = ctxWith(() => res([{ recall_number: 'F-1234-2026' }]));
    expect((await verify(c, ctx)).ok).toBe(true);
    expect(runQuery.mock.calls[0][0]).toContain('fda_food_recalls');
  });

  it('inside the loop: no evidence means rejected with no send-back, evidence ok means approved with no rounds', async () => {
    const bad = ctxWith(() => res([{ RecallID: 10560 }]));
    const revise = jest.fn();
    const o1 = await checkWithCorrections(recallCand({}), bad.ctx, revise);
    expect(o1).toMatchObject({ decision: 'rejected', rounds: 0 });
    expect(revise).not.toHaveBeenCalled();
    const good = ctxWith(() => res([{ RecallID: 10560 }]));
    const o2 = await checkWithCorrections(recallCand(recallOk), good.ctx, revise);
    expect(o2).toMatchObject({ decision: 'approved', rounds: 0 });
  });
});

import os from 'os';
import fs from 'fs';
import path from 'path';
import { planBenefits, revise } from '../agents/benefits';
import { BENEFIT_RULES } from '../../scripts/seed';
import { verify } from '../agents/factChecker';
import { TraceLogger } from '../agents/trace';
import { FakeGenerator } from '../adapters/llm';
import type { AgentContext } from '../agents/types';

const TODAY = '2026-10-23';

const maya = {
  id: 'maya', userId: null, isGuest: true, name: 'Maya', birthDate: '2026-10-03', dueDate: null,
  zip: '02139', state: 'MA', employer: '', householdSize: 3, annualIncomeCents: null,
  dcfsaOffered: false, dataConnected: true,
};
const leo = { ...maya, id: 'leo', birthDate: null, dueDate: '2026-12-07', dataConnected: false };
const ava = { ...maya, id: 'ava', birthDate: '2026-08-24', zip: '43215', state: 'OH' };

const res = (rows: any[]) => ({ headers: Object.keys(rows[0] ?? {}), rows, ms: 1 });

// Rows shaped exactly like the benefit_rules seed (federal rules + every state program), built from the real seed data.
const RULES = BENEFIT_RULES.map((r) => ({
  code: r.code, title: r.title, scope: r.scope, amount_cents: r.amountCents ?? null,
  window_start_days_from_birth: r.windowStartDaysFromBirth ?? null, window_end_days_from_birth: r.windowEndDaysFromBirth ?? null,
  condition: r.condition ?? '', source_url: r.sourceUrl,
}));

function ctxWith(family: any, opts: { llm?: FakeGenerator; rules?: any[] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ben-'));
  const trace = new TraceLogger('t', dir);
  const runQuery = jest.fn(async (sql: string) => {
    if (sql.includes('benefit_rules')) return res(opts.rules ?? RULES);
    throw new Error('unexpected sql ' + sql);
  });
  const ctx = { runId: 't', family, z: { runQuery } as any, llm: opts.llm ?? new FakeGenerator([]), memory: {} as any, trace } as AgentContext;
  return { ctx, runQuery, trace, dir };
}
const byRef = (cs: any[]) => Object.fromEntries(cs.map((c) => [c.claim.ref, c]));

describe('benefits planner', () => {
  beforeEach(() => { process.env.TODAY = TODAY; });

  it('maya: insurance deadline 2026-11-02, Trump Account 100000, MA credit 44000', async () => {
    const { ctx } = ctxWith(maya);
    const out = byRef(await planBenefits(ctx, TODAY));
    expect(out.INSURANCE_ADD_BABY.deadline).toBe('2026-11-02');
    expect(out.TRUMP_ACCOUNT.amountCents).toBe(100000);
    expect(out.MA_CHILD_TAX_CREDIT.amountCents).toBe(44000);
    expect(out.FEDERAL_CHILD_TAX_CREDIT.amountCents).toBe(220000);
    expect(out.FEDERAL_CHILD_TAX_CREDIT.deadline).toBeNull();
    expect(out.MA_PFML.deadline).toBe('2027-10-03');
    expect(out.WIC_SCREEN).toBeUndefined(); // poverty/WIC rule is gone
    for (const c of Object.values(out) as any[]) {
      expect(c.kind).toBe('benefit');
      expect(c.verdict).toBe(c.claim.ref === 'DCFSA_LIFE_EVENT' ? 'info' : 'likely');
      expect(c.agent).toBe('benefits');
      expect(c.claim.type).toBe('rule');
      expect(c.sources.length).toBeGreaterThan(0);
      expect(c.traceId).toBeTruthy();
      expect(c.retryCount).toBe(0);
      expect(c.title).not.toMatch(/after birth/);
    }
  });

  it('ava (OH) has no MA cards, still gets Trump Account and the federal credit', async () => {
    const { ctx } = ctxWith(ava);
    const out = await planBenefits(ctx, TODAY);
    expect(out.some((c) => String(c.claim.ref).startsWith('MA_'))).toBe(false);
    expect(out.some((c) => /Massachusetts/.test(c.title + c.body))).toBe(false);
    const refs = out.map((c) => c.claim.ref);
    expect(refs).toEqual(expect.arrayContaining(['TRUMP_ACCOUNT', 'FEDERAL_CHILD_TAX_CREDIT']));
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(refs).not.toContain('INSURANCE_ADD_BABY'); // born 60 days ago: the 30-day window is over
  });

  it('leo (due 2026-12-07): insurance deadline 2027-01-06 and "(after birth)" in the title', async () => {
    const { ctx } = ctxWith(leo);
    const out = byRef(await planBenefits(ctx, TODAY));
    expect(out.INSURANCE_ADD_BABY.deadline).toBe('2027-01-06');
    expect(out.INSURANCE_ADD_BABY.title).toContain('(after birth)');
  });

  it('a family born 2026-06-01 has no INSURANCE_ADD_BABY', async () => {
    const { ctx } = ctxWith({ ...maya, birthDate: '2026-06-01' });
    const out = await planBenefits(ctx, TODAY);
    expect(out.map((c) => c.claim.ref)).not.toContain('INSURANCE_ADD_BABY');
  });

  it('a deadline that is exactly today is still kept', async () => {
    const { ctx } = ctxWith({ ...maya, birthDate: '2026-09-23' }); // +30 days = 2026-10-23
    const out = byRef(await planBenefits(ctx, TODAY));
    expect(out.INSURANCE_ADD_BABY.deadline).toBe('2026-10-23');
  });

  it('Trump Account only for births 2025-01-01..2028-12-31', async () => {
    expect((await planBenefits(ctx2('2029-01-02'), TODAY)).map((c) => c.claim.ref)).not.toContain('TRUMP_ACCOUNT');
    expect((await planBenefits(ctx2('2024-12-31'), TODAY)).map((c) => c.claim.ref)).not.toContain('TRUMP_ACCOUNT');
    expect((await planBenefits(ctx2('2028-12-31'), TODAY)).map((c) => c.claim.ref)).toContain('TRUMP_ACCOUNT');
    function ctx2(birth: string) { return ctxWith({ ...maya, birthDate: birth }).ctx; }
  });

  it('Dependent Care FSA is a "Check with your job" card for every family: no dollars, no deadline, not counted, never "your employer offers"', async () => {
    for (const fam of [maya, leo, ava, { ...maya, dcfsaOffered: true }]) {
      const out = byRef(await planBenefits(ctxWith(fam, { llm: new FakeGenerator([JSON.stringify({ body: 'Your employer offers it, worth $7,500.' })]) }).ctx, TODAY));
      const c = out.DCFSA_LIFE_EVENT;
      expect(c).toBeDefined();
      expect(c.title).toMatch(/check with your job/i);
      expect(c.amountCents).toBeNull();
      expect(c.deadline).toBeNull();
      expect(c.verdict).toBe('info'); // 'info' cards never count in the Receipt
      expect(c.body).not.toMatch(/\$|your employer offers|employer offers a/i);
      expect(c.body).toMatch(/ask|check/i);
    }
  });

  it('never reads exact income or household size, and never puts income in the trace', async () => {
    const { ctx, trace, runQuery } = ctxWith({ ...maya, annualIncomeCents: 5000000, householdSize: 4 });
    const out = await planBenefits(ctx, TODAY);
    for (const [sql] of runQuery.mock.calls) expect(String(sql)).not.toMatch(/income|household|poverty|v_planner_family/i);
    const text = JSON.stringify(trace.lines()) + out.map((c) => c.body + c.title).join(' ');
    expect(text).not.toContain('5000000');
    expect(text).not.toContain('50000');
  });

  it('only asks for federal rules and the family\'s own state, and drops any other state\'s rule even if the source sends it', async () => {
    const { ctx, runQuery } = ctxWith(ava);
    const out = await planBenefits(ctx, TODAY);
    const sql = String(runQuery.mock.calls[0][0]);
    expect(sql).toMatch(/scope = 'federal' OR scope = 'OH'/);
    expect(out.map((c) => c.claim.ref)).not.toEqual(expect.arrayContaining(['MA_PFML']));
    expect(out.every((c) => !['MA_PFML', 'NY_PFL', 'CA_PFL', 'MA_CHILD_TAX_CREDIT'].includes(String(c.claim.ref)))).toBe(true);
  });

  it('a state with no programs in the table still gets the federal cards and a "coming soon" trace line, never an error', async () => {
    const { ctx, trace } = ctxWith({ ...ava, state: 'FL' });
    const out = await planBenefits(ctx, TODAY);
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(trace.lines())).toContain('Support for your state’s programs is coming soon');
  });

  it('uses the model body when it only mentions allowed dollar amounts, else the deterministic text', async () => {
    const good = new FakeGenerator([JSON.stringify({ body: 'You are likely eligible for $1,000 from the federal starter deposit.' })]);
    const a = byRef(await planBenefits(ctxWith(maya, { llm: good }).ctx, TODAY));
    expect(a.TRUMP_ACCOUNT.body).toBe('You are likely eligible for $1,000 from the federal starter deposit.');
    const bad = new FakeGenerator([JSON.stringify({ body: 'You get $5,000 for sure.' })]);
    const b = byRef(await planBenefits(ctxWith(maya, { llm: bad }).ctx, TODAY));
    expect(b.TRUMP_ACCOUNT.body).not.toContain('5,000');
    expect(b.TRUMP_ACCOUNT.body).toContain('$1,000.00');
    // no model at all: the app still works
    const c = byRef(await planBenefits(ctxWith(maya).ctx, TODAY));
    expect(c.INSURANCE_ADD_BABY.body).toContain('2026-11-02');
    expect(c.INSURANCE_ADD_BABY.body).toMatch(/likely/);
  });

  it('a typed-in family needs no family lookup and still gets benefit cards from the rules table', async () => {
    const guest = { ...maya, id: 'guest-ab12cd34', dataConnected: false, annualIncomeCents: null };
    const { ctx, runQuery } = ctxWith(guest);
    const cards = await planBenefits(ctx, TODAY);
    expect(runQuery.mock.calls.some(([sql]) => String(sql).includes('v_planner_family'))).toBe(false);
    const refs = cards.map((c) => c.claim.ref);
    expect(refs).toEqual(expect.arrayContaining(['TRUMP_ACCOUNT', 'FEDERAL_CHILD_TAX_CREDIT', 'INSURANCE_ADD_BABY']));
  });

  it('an unsafe state value is never put in the query: federal rules only', async () => {
    const { ctx, runQuery } = ctxWith({ ...maya, state: "MA' OR 1=1 --" });
    const out = await planBenefits(ctx, TODAY);
    expect(String(runQuery.mock.calls[0][0])).not.toContain('1=1');
    expect(String(runQuery.mock.calls[0][0])).toMatch(/scope = 'federal'/);
    expect(out.length).toBeGreaterThan(0);
  });

  it('every candidate passes the Fact-Checker when the source agrees', async () => {
    const { ctx } = ctxWith(maya);
    const truth = jest.fn(async (sql: string) => {
      const code = /code = '([A-Z_]+)'/.exec(sql)![1];
      const r = RULES.find((x) => x.code === code)!;
      return res([{ amount_cents: r.amount_cents, window_end_days_from_birth: r.window_end_days_from_birth }]);
    });
    const checkCtx = { ...ctx, z: { runQuery: truth } as any };
    const out = await planBenefits(ctx, TODAY);
    for (const c of out) {
      const v = await verify(c, checkCtx);
      expect(v).toEqual({ ok: true, reason: null, corrected: null });
    }
  });

  it('revise re-derives a card from the source, or gives up when it is gone', async () => {
    const { ctx } = ctxWith(maya);
    const [first] = await planBenefits(ctx, TODAY);
    const stale = { ...first, amountCents: 1 };
    const fixed = await revise(stale, 'amount mismatch', ctx);
    expect(fixed).not.toBeNull();
    expect(fixed!.claim.ref).toBe(first.claim.ref);
    expect(fixed!.amountCents).toBe(first.amountCents);
    expect(fixed!.retryCount).toBe(1);
    const gone = await revise({ ...first, claim: { type: 'rule', ref: 'NOT_A_RULE' } }, 'source not found', ctx);
    expect(gone).toBeNull();
  });
});

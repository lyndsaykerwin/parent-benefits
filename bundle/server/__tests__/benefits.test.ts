import os from 'os';
import fs from 'fs';
import path from 'path';
import { planBenefits, revise } from '../agents/benefits';
import { verify } from '../agents/factChecker';
import { TraceLogger } from '../agents/trace';
import { FakeGenerator } from '../adapters/llm';
import type { AgentContext } from '../agents/types';

const TODAY = '2026-10-23';

const maya = {
  id: 'maya', userId: null, isGuest: true, name: 'Maya', birthDate: '2026-10-03', dueDate: null,
  zip: '02139', state: 'MA', employer: 'Northwind', householdSize: 3, annualIncomeCents: 14500000,
  dcfsaOffered: true, dataConnected: true,
};
const leo = { ...maya, id: 'leo', birthDate: null, dueDate: '2026-12-07', householdSize: 2, annualIncomeCents: 9800000, dcfsaOffered: false, dataConnected: false };
const ava = { ...maya, id: 'ava', birthDate: '2026-08-24', zip: '43215', state: 'OH', annualIncomeCents: 6200000, dcfsaOffered: false };

const res = (rows: any[]) => ({ headers: Object.keys(rows[0] ?? {}), rows, ms: 1 });

// Rows shaped like the benefit_rules seed in scripts/seed.ts.
const RULES = [
  { code: 'TRUMP_ACCOUNT', title: 'Trump Account: $1,000 federal starter deposit', scope: 'federal', amount_cents: 100000, window_start_days_from_birth: null, window_end_days_from_birth: null, condition: 'born 2025-01-01..2028-12-31', source_url: 'https://trumpaccounts.gov' },
  { code: 'FEDERAL_CHILD_TAX_CREDIT', title: 'Federal Child Tax Credit', scope: 'federal', amount_cents: 220000, window_start_days_from_birth: null, window_end_days_from_birth: null, condition: 'claimed on the yearly tax return', source_url: 'https://www.irs.gov/ctc' },
  { code: 'INSURANCE_ADD_BABY', title: 'Add your baby to health insurance', scope: 'federal', amount_cents: null, window_start_days_from_birth: 0, window_end_days_from_birth: 30, condition: 'birth is a qualifying life event', source_url: 'https://www.healthcare.gov/sep' },
  { code: 'DCFSA_LIFE_EVENT', title: 'Start or change your Dependent Care FSA', scope: 'federal', amount_cents: null, window_start_days_from_birth: 0, window_end_days_from_birth: 30, condition: 'employer offers a Dependent Care FSA', source_url: 'https://www.irs.gov/p503' },
  { code: 'MA_CHILD_TAX_CREDIT', title: 'Massachusetts Child and Family Tax Credit', scope: 'MA', amount_cents: 44000, window_start_days_from_birth: null, window_end_days_from_birth: null, condition: 'MA resident', source_url: 'https://www.mass.gov/ctc' },
  { code: 'MA_PFML', title: 'Massachusetts Paid Family and Medical Leave', scope: 'MA', amount_cents: null, window_start_days_from_birth: 0, window_end_days_from_birth: 365, condition: 'worked in MA', source_url: 'https://www.mass.gov/pfml' },
  { code: 'WIC_SCREEN', title: 'WIC food benefits screening', scope: 'federal', amount_cents: null, window_start_days_from_birth: null, window_end_days_from_birth: null, condition: 'income <= 185% FPL', source_url: 'https://www.fns.usda.gov/wic' },
];
const POVERTY: Record<number, number> = { 1: 1596000, 2: 2164000, 3: 2732000, 4: 3300000 };

function ctxWith(family: any, opts: { income?: number | null; poverty?: Record<number, number>; llm?: FakeGenerator } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ben-'));
  const trace = new TraceLogger('t', dir);
  const income = opts.income === undefined ? family.annualIncomeCents : opts.income;
  const poverty = opts.poverty ?? POVERTY;
  const runQuery = jest.fn(async (sql: string) => {
    if (sql.includes('poverty_guidelines')) {
      const m = /household_size = (\d+)/.exec(sql);
      const size = m ? Number(m[1]) : -1;
      return res(poverty[size] ? [{ household_size: size, annual_cents: poverty[size], year: 2026 }] : []);
    }
    if (sql.includes('v_planner_family')) {
      return res([{ id: family.id, birth_date: family.birthDate, due_date: family.dueDate, state: family.state, household_size: family.householdSize, annual_income_cents: income, dcfsa_offered: family.dcfsaOffered }]);
    }
    if (sql.includes('benefit_rules')) return res(RULES);
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
    expect(out.DCFSA_LIFE_EVENT.deadline).toBe('2026-11-02'); // employer offers a DCFSA
    expect(out.MA_PFML.deadline).toBe('2027-10-03');
    expect(out.WIC_SCREEN).toBeUndefined(); // income is above 185% of the line
    for (const c of Object.values(out) as any[]) {
      expect(c.kind).toBe('benefit');
      expect(c.verdict).toBe('likely');
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
    expect(out.DCFSA_LIFE_EVENT).toBeUndefined(); // leo's employer has no DCFSA
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

  it('WIC: shown at or below 185% of the poverty line from the table, hidden above, skipped when income is unknown', async () => {
    // household of 3: line 27,320 dollars -> 185% = 50,542 dollars = 5054200 cents
    const at = byRef(await planBenefits(ctxWith(maya, { income: 5054200 }).ctx, TODAY));
    expect(at.WIC_SCREEN).toBeDefined();
    expect(at.WIC_SCREEN.amountCents).toBeNull();
    expect(at.WIC_SCREEN.deadline).toBeNull();
    const over = byRef(await planBenefits(ctxWith(maya, { income: 5054201 }).ctx, TODAY));
    expect(over.WIC_SCREEN).toBeUndefined();
    const unknown = byRef(await planBenefits(ctxWith(maya, { income: null }).ctx, TODAY));
    expect(unknown.WIC_SCREEN).toBeUndefined();
    // the line comes from the table, not from code: change the table and the answer changes
    const bigger = byRef(await planBenefits(ctxWith(maya, { income: 6000000, poverty: { 3: 4000000 } }).ctx, TODAY));
    expect(bigger.WIC_SCREEN).toBeDefined();
    // no table row for this household size: skipped, not guessed
    const none = byRef(await planBenefits(ctxWith(maya, { income: 100, poverty: {} }).ctx, TODAY));
    expect(none.WIC_SCREEN).toBeUndefined();
  });

  it('never puts income in the trace, even for a WIC card', async () => {
    const { ctx, trace } = ctxWith(maya, { income: 5000000 });
    const out = await planBenefits(ctx, TODAY);
    expect(out.map((c) => c.claim.ref)).toContain('WIC_SCREEN');
    const text = JSON.stringify(trace.lines()) + out.map((c) => c.body + c.title).join(' ');
    expect(text).not.toContain('5000000');
    expect(text).not.toContain('50000');
    expect(text).not.toMatch(/145000|14500000/);
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

  it('I4: a typed-in family skips the planner-view lookup and still gets benefit cards from the rules table', async () => {
    const guest = { ...maya, id: 'guest-ab12cd34', dataConnected: false, annualIncomeCents: null };
    const { ctx, runQuery } = ctxWith(guest);
    const cards = await planBenefits(ctx, TODAY);
    expect(runQuery.mock.calls.some(([sql]) => String(sql).includes('v_planner_family'))).toBe(false);
    expect(runQuery.mock.calls.some(([sql]) => String(sql).includes('poverty_guidelines'))).toBe(false);
    const refs = cards.map((c) => c.claim.ref);
    expect(refs).toEqual(expect.arrayContaining(['TRUMP_ACCOUNT', 'FEDERAL_CHILD_TAX_CREDIT', 'INSURANCE_ADD_BABY']));
    expect(refs).not.toContain('WIC_SCREEN');
  });

  it('refuses an unsafe family id without querying', async () => {
    const { ctx, runQuery } = ctxWith({ ...maya, id: "x'; DROP" });
    expect(await planBenefits(ctx, TODAY)).toEqual([]);
    expect(runQuery).not.toHaveBeenCalled();
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

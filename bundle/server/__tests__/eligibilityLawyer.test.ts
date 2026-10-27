import os from 'os';
import fs from 'fs';
import path from 'path';
import { BENEFIT_RULES, STATE_PROGRAM_ROWS, TAX_PARAMETER_ROWS } from '../../scripts/seed';
import { planBenefits, revise } from '../agents/benefits';
import {
  challengeBenefits, eligibilityCounterSql, resolveChallenge, rowsForState, runEligibilityLoop, UNVERIFIED_NOTE,
  type BenefitTerms,
} from '../agents/eligibilityLawyer';
import { TraceLogger } from '../agents/trace';
import { FakeGenerator } from '../adapters/llm';
import type { AgentContext } from '../agents/types';

const TODAY = '2026-10-23';
const maya = {
  id: 'maya', userId: null, isGuest: true, name: 'Maya', birthDate: '2026-10-03', dueDate: null,
  zip: '02139', state: 'MA', employer: '', householdSize: 3, annualIncomeCents: null,
  dcfsaOffered: false, dataConnected: true,
};
const nyFam = { ...maya, id: 'ny', state: 'NY', zip: '10001' };

const res = (rows: any[]) => ({ headers: Object.keys(rows[0] ?? {}), rows, ms: 1 });
const RULES = BENEFIT_RULES.map((r) => ({
  code: r.code, title: r.title, scope: r.scope, amount_cents: r.amountCents ?? null,
  window_start_days_from_birth: r.windowStartDaysFromBirth ?? null, window_end_days_from_birth: r.windowEndDaysFromBirth ?? null,
  condition: r.condition ?? '', source_url: r.sourceUrl,
}));

/** Rows shaped like the answer to eligibilityCounterSql, built from the real seed tables. */
function counterRows(state: string, tweak: (r: any) => any = (r) => r) {
  return [
    ...STATE_PROGRAM_ROWS.filter((r) => r.state === state).map((r) => ({
      source: 'state_program', code: r.code, year: r.year, amount_cents: r.amountCents ?? null,
      window_start_days_from_birth: r.windowStartDaysFromBirth ?? null, window_end_days_from_birth: r.windowEndDaysFromBirth ?? null,
    })),
    ...TAX_PARAMETER_ROWS.map((r) => ({
      source: 'tax_parameter', code: r.code, year: r.year, amount_cents: r.amountCents ?? null,
      window_start_days_from_birth: null, window_end_days_from_birth: null,
    })),
  ].map(tweak);
}

function ctxWith(family: any, counter: (sql: string) => Promise<any>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'elig-'));
  const trace = new TraceLogger('t', dir);
  const runQuery = jest.fn(async (sql: string) => {
    if (sql.includes('benefit_rules')) return res(RULES);
    if (sql.includes('state_programs')) return counter(sql);
    throw new Error('unexpected sql ' + sql);
  });
  const ctx = { runId: 't', family, z: { runQuery } as any, llm: new FakeGenerator([]), memory: {} as any, trace } as AgentContext;
  return { ctx, runQuery, trace };
}
const counterCalls = (runQuery: jest.Mock) => runQuery.mock.calls.filter(([sql]) => String(sql).includes('state_programs'));
const byRef = (cs: any[]) => Object.fromEntries(cs.map((c) => [c.claim.ref, c]));

const mapa: BenefitTerms = {
  code: 'MA_PFML', title: 'Massachusetts Paid Family and Medical Leave', scope: 'MA', amountCents: null,
  windowEndDays: 365, condition: 'worked in Massachusetts', deadline: '2027-10-03',
};
const ctc: BenefitTerms = {
  code: 'FEDERAL_CHILD_TAX_CREDIT', title: 'Federal Child Tax Credit', scope: 'federal', amountCents: 220000,
  windowEndDays: null, condition: 'claimed on the yearly tax return', deadline: null,
};

describe('eligibilityCounterSql: the one fixed Zetaris counter-question', () => {
  it('is fixed text (the same for every family and state), asks only the two program tables, and never mentions income or household', () => {
    const a = eligibilityCounterSql();
    expect(a).toBe(eligibilityCounterSql());
    expect(a).toMatch(/bundle_pg\.state_programs/);
    expect(a).toMatch(/bundle_pg\.tax_parameters/);
    expect(a).not.toContain("state = '");
    expect(a).not.toMatch(/income|household|poverty|v_planner_family|families/i);
    expect(a).not.toMatch(/;\s*$/);
  });
  it('an odd-looking state never reaches the SQL and keeps no state program rows (tax figures only)', () => {
    const rows = [
      { source: 'state_program', state: 'MA', code: 'MA_PFML' },
      { source: 'tax_parameter', state: null, code: 'CHILD_TAX_CREDIT' },
    ];
    expect(rowsForState(rows as any, "MA' OR 1=1 --").map((r) => r.code)).toEqual(['CHILD_TAX_CREDIT']);
    expect(rowsForState(rows as any, 'MA').map((r) => r.code)).toEqual(['MA_PFML', 'CHILD_TAX_CREDIT']);
  });
});

describe('challengeBenefits: the Lawyer tries to disprove eligibility', () => {
  it('challenges a state program with a time window and a federal tax credit; leaves the rest alone', () => {
    const others: BenefitTerms[] = [
      { code: 'TRUMP_ACCOUNT', title: 't', scope: 'federal', amountCents: 100000, windowEndDays: null, condition: 'born 2025-01-01..2028-12-31', deadline: null },
      { code: 'INSURANCE_ADD_BABY', title: 'i', scope: 'federal', amountCents: null, windowEndDays: 30, condition: 'birth is a qualifying life event', deadline: '2026-11-02' },
      { code: 'DCFSA_LIFE_EVENT', title: 'd', scope: 'federal', amountCents: null, windowEndDays: null, condition: 'ask your employer', deadline: null },
    ];
    const cs = challengeBenefits([mapa, ctc, ...others], maya, TODAY);
    expect(cs.map((c) => `${c.code}:${c.kind}`).sort()).toEqual(['FEDERAL_CHILD_TAX_CREDIT:tax_year', 'MA_PFML:window']);
    for (const c of cs) expect(c.question.length).toBeGreaterThan(20);
  });
  it('asks nothing when nothing can be disproved with the data we have', () => {
    expect(challengeBenefits([], maya, TODAY)).toEqual([]);
  });
  it('never asks about work, job tenure or pay', () => {
    const cs = challengeBenefits([mapa, ctc], maya, TODAY);
    expect(JSON.stringify(cs)).not.toMatch(/tenure|employer|start date|salary|income|wage/i);
  });
});

describe('resolveChallenge: confirm or drop from the Zetaris answer', () => {
  const [win] = challengeBenefits([mapa], maya, TODAY);
  const [tax] = challengeBenefits([ctc], maya, TODAY);
  it('confirms a window that matches the state program table', () => {
    const r = resolveChallenge(win, mapa, counterRows('MA'), maya, TODAY);
    expect(r.outcome).toBe('confirmed');
  });
  it('drops a state program whose table window says it has already closed', () => {
    const closed = counterRows('MA', (r) => (r.code === 'MA_PFML' ? { ...r, window_end_days_from_birth: 5 } : r));
    const r = resolveChallenge(win, mapa, closed, maya, TODAY);
    expect(r.outcome).toBe('dropped');
    expect(r.reason).toMatch(/window|closed|disagree/i);
  });
  it('drops when the table window disagrees with the rule even if still open', () => {
    const odd = counterRows('MA', (r) => (r.code === 'MA_PFML' ? { ...r, window_end_days_from_birth: 400 } : r));
    expect(resolveChallenge(win, mapa, odd, maya, TODAY).outcome).toBe('dropped');
  });
  it('is unverified (not dropped) when the table has no row for the program', () => {
    expect(resolveChallenge(win, mapa, [], maya, TODAY).outcome).toBe('unverified');
    expect(resolveChallenge(win, mapa, counterRows('NY'), maya, TODAY).outcome).toBe('unverified');
  });
  it('confirms a tax credit whose amount equals the tax table for the year, drops it when they differ', () => {
    expect(resolveChallenge(tax, ctc, counterRows('MA'), maya, TODAY).outcome).toBe('confirmed');
    const off = counterRows('MA', (r) => (r.source === 'tax_parameter' ? { ...r, amount_cents: 100 } : r));
    expect(resolveChallenge(tax, ctc, off, maya, TODAY).outcome).toBe('dropped');
  });
  it('is unverified when the tax table has no figure for that year or earlier', () => {
    const future = counterRows('MA', (r) => ({ ...r, year: 2099 }));
    expect(resolveChallenge(tax, ctc, future, maya, TODAY).outcome).toBe('unverified');
  });
  it('survives rows with missing columns (a stand-in Zetaris)', () => {
    expect(resolveChallenge(win, mapa, [{ foo: 1 } as any], maya, TODAY).outcome).toBe('unverified');
  });
});

describe('runEligibilityLoop', () => {
  it('asks Zetaris exactly one question for all challenged benefits and returns a resolution per challenge', async () => {
    const { ctx, runQuery } = ctxWith(maya, async () => res(counterRows('MA')));
    const out = await runEligibilityLoop(ctx, [mapa, ctc], TODAY);
    expect(counterCalls(runQuery)).toHaveLength(1);
    expect(String(counterCalls(runQuery)[0][0])).toBe(eligibilityCounterSql());
    expect(out.asked).toBe(true);
    expect(out.resolutions.get('MA_PFML')!.outcome).toBe('confirmed');
    expect(out.resolutions.get('FEDERAL_CHILD_TAX_CREDIT')!.outcome).toBe('confirmed');
  });
  it('asks nothing when there is nothing to challenge', async () => {
    const { ctx, runQuery } = ctxWith(maya, async () => res([]));
    const out = await runEligibilityLoop(ctx, [], TODAY);
    expect(out.asked).toBe(false);
    expect(runQuery).not.toHaveBeenCalled();
  });
  it('degrades honestly when the saved answer is missing: everything stays, marked unverified, trace says why', async () => {
    const { ctx, trace } = ctxWith(maya, async () => { throw new Error('No saved response for this query (sample mode never calls live Zetaris)'); });
    const out = await runEligibilityLoop(ctx, [mapa, ctc], TODAY);
    expect(out.resolutions.get('MA_PFML')!.outcome).toBe('unverified');
    expect(out.resolutions.get('FEDERAL_CHILD_TAX_CREDIT')!.outcome).toBe('unverified');
    const lines = trace.lines();
    expect(lines.some((l: any) => l.agent_name === 'benefits' && l.status === 'fallback' && /no answer.*not yet verified/i.test(l.output_summary))).toBe(true);
    expect(lines.some((l: any) => l.agent_name === 'fine_print_lawyer' && l.action === 'challenge_benefits')).toBe(true);
  });
  it('writes the whole exchange to the shared workspace when there is one', async () => {
    const { ctx } = ctxWith(maya, async () => res(counterRows('MA')));
    const posted: any[] = [];
    (ctx as any).workspace = { post: (n: any) => { posted.push(n); return n; } };
    await runEligibilityLoop(ctx, [mapa], TODAY);
    expect(posted.map((n) => `${n.from_agent}>${n.to_agent}:${n.type}`)).toEqual([
      'BenefitsPlanner>FinePrintLawyer:claim',
      'FinePrintLawyer>BenefitsPlanner:question',
      'BenefitsPlanner>FinePrintLawyer:answer',
      'FinePrintLawyer>BenefitsPlanner:verdict',
    ]);
    expect(posted.every((n) => n.about === 'benefit-ma_pfml')).toBe(true);
    expect(posted[1].evidence_sql).toBe(eligibilityCounterSql());
  });
  it('a broken workspace never stops the loop', async () => {
    const { ctx } = ctxWith(maya, async () => res(counterRows('MA')));
    (ctx as any).workspace = { post: () => { throw new Error('boom'); } };
    const out = await runEligibilityLoop(ctx, [mapa], TODAY);
    expect(out.resolutions.get('MA_PFML')!.outcome).toBe('confirmed');
  });
});

describe('planBenefits with the eligibility loop', () => {
  beforeEach(() => { process.env.TODAY = TODAY; });

  it('confirms: Maya keeps her state and credit cards after exactly one counter-question', async () => {
    const { ctx, runQuery } = ctxWith(maya, async () => res(counterRows('MA')));
    const out = byRef(await planBenefits(ctx, TODAY));
    expect(counterCalls(runQuery)).toHaveLength(1);
    expect(out.MA_PFML.claim.eligibility).toBe('confirmed');
    expect(out.MA_PFML.body).not.toContain(UNVERIFIED_NOTE);
    expect(out.FEDERAL_CHILD_TAX_CREDIT.claim.eligibility).toBe('confirmed');
    expect(out.MA_PFML.verdict).toBe('likely');
  });

  it('drops: a program the state table says is over disappears from the cards and the trace says so', async () => {
    const closed = counterRows('MA', (r) => (r.code === 'MA_PFML' ? { ...r, window_end_days_from_birth: 5 } : r));
    const { ctx, runQuery, trace } = ctxWith(maya, async () => res(closed));
    const out = byRef(await planBenefits(ctx, TODAY));
    expect(counterCalls(runQuery)).toHaveLength(1);
    expect(out.MA_PFML).toBeUndefined();
    expect(out.MA_CHILD_TAX_CREDIT).toBeDefined();
    expect(JSON.stringify(trace.lines())).toMatch(/MA_PFML.*(dropped|disagree)/i);
  });

  it('missing saved answer: cards stay, marked not yet verified, nothing invented', async () => {
    const { ctx } = ctxWith(maya, async () => { throw new Error('No saved response'); });
    const out = byRef(await planBenefits(ctx, TODAY));
    expect(out.MA_PFML.claim.eligibility).toBe('unverified');
    expect(out.MA_PFML.body).toContain(UNVERIFIED_NOTE);
    expect(out.FEDERAL_CHILD_TAX_CREDIT.body).toContain(UNVERIFIED_NOTE);
    expect(out.TRUMP_ACCOUNT.claim.eligibility).toBeUndefined();
    expect(out.MA_PFML.body).not.toMatch(/\$/);
  });

  it('never asks about a family that only has federal cards and no challengeable terms of its own state (state with no programs still asks about the tax credit once)', async () => {
    const fl = { ...maya, id: 'fl', state: 'FL', zip: '33101' };
    const { ctx, runQuery } = ctxWith(fl, async () => res(counterRows('FL')));
    await planBenefits(ctx, TODAY);
    expect(counterCalls(runQuery)).toHaveLength(1);
    expect(String(counterCalls(runQuery)[0][0])).toBe(eligibilityCounterSql()); // the same text for every state
  });

  it('works the same for a different state with no code change (NY)', async () => {
    const { ctx } = ctxWith(nyFam, async () => res(counterRows('NY')));
    const out = byRef(await planBenefits(ctx, TODAY));
    expect(out.NY_PFL.claim.eligibility).toBe('confirmed');
  });

  it('the Dependent Care FSA card is never challenged: still no dollars, no deadline', async () => {
    const { ctx } = ctxWith(maya, async () => res(counterRows('MA')));
    const out = byRef(await planBenefits(ctx, TODAY));
    expect(out.DCFSA_LIFE_EVENT.claim.eligibility).toBeUndefined();
    expect(out.DCFSA_LIFE_EVENT.amountCents).toBeNull();
    expect(out.DCFSA_LIFE_EVENT.deadline).toBeNull();
  });

  it('revise does not ask a second counter-question and keeps the loop result on the card', async () => {
    const { ctx, runQuery } = ctxWith(maya, async () => { throw new Error('No saved response'); });
    const cards = await planBenefits(ctx, TODAY);
    const pfml = cards.find((c) => c.claim.ref === 'MA_PFML')!;
    const before = counterCalls(runQuery).length;
    const fixed = await revise({ ...pfml, amountCents: 1 }, 'deadline mismatch', ctx, TODAY);
    expect(counterCalls(runQuery).length).toBe(before);
    expect(fixed!.claim.eligibility).toBe('unverified');
    expect(fixed!.body).toContain(UNVERIFIED_NOTE);
  });
});

/**
 * Practice mode (SAMPLE_MODE) replays saved Zetaris answers keyed by the exact question text. A question that names the
 * family's state only has a saved answer for the states someone happened to record, so a judge typing a Texas ZIP got
 * "Some sources didn't respond" and $0. These tests pin the fix: the per-run benefit questions are the SAME text for every
 * state (the state is applied in code), and the saved recording answers them, so every state works offline.
 */
import os from 'os';
import fs from 'fs';
import path from 'path';
import { BENEFIT_RULES, STATE_PROGRAM_ROWS, TAX_PARAMETER_ROWS } from '../../scripts/seed';
import { planBenefits, rulesSql, ruleCheckSql } from '../agents/benefits';
import { eligibilityCounterSql, runEligibilityLoop, type BenefitTerms } from '../agents/eligibilityLawyer';
import { verify } from '../agents/factChecker';
import { ZetarisClient } from '../adapters/zetaris';
import { TraceLogger } from '../agents/trace';
import { FakeGenerator } from '../adapters/llm';
import { buildQuestions, generalOfferSets } from '../../scripts/zetaris/record';
import { savedVerdictsSql } from '../agents/savedVerdicts';
import type { AgentContext } from '../agents/types';
import type { Family } from '../../shared/bundle';

const TODAY = '2026-10-23';
const STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];
const res = (rows: any[]) => ({ headers: Object.keys(rows[0] ?? {}), rows, ms: 1 });
const RULES = BENEFIT_RULES.map((r) => ({
  code: r.code, title: r.title, scope: r.scope, amount_cents: r.amountCents ?? null,
  window_start_days_from_birth: r.windowStartDaysFromBirth ?? null, window_end_days_from_birth: r.windowEndDaysFromBirth ?? null,
  condition: r.condition ?? '', source_url: r.sourceUrl,
}));
const guest = (state: string, zip: string): Family => ({
  id: `guest-${state.toLowerCase()}000001`, userId: null, isGuest: true, name: '', birthDate: '2026-10-10', dueDate: null,
  zip, state, employer: 'Example Co', householdSize: 3, annualIncomeCents: null, dcfsaOffered: true, dataConnected: false,
});
const ctxOf = (family: Family, z: any): AgentContext => ({
  runId: 't', family, z, llm: new FakeGenerator([]), memory: {} as any,
  trace: new TraceLogger('t', fs.mkdtempSync(path.join(os.tmpdir(), 'allstates-'))),
});

describe('one fixed benefit question for every state', () => {
  it('rulesSql is the same text for all 50 states + DC and has no state filter', () => {
    const texts = new Set(STATES.map(() => rulesSql()));
    expect(texts.size).toBe(1);
    expect(rulesSql()).toMatch(/FROM bundle_pg\.benefit_rules/);
    expect(rulesSql()).not.toMatch(/WHERE|scope =/);
  });
  it('eligibilityCounterSql is the same text for every state, carries a state column, and has no state filter', () => {
    const sql = eligibilityCounterSql();
    expect(sql).toMatch(/bundle_pg\.state_programs/);
    expect(sql).toMatch(/bundle_pg\.tax_parameters/);
    expect(sql).toMatch(/\bstate\b/);
    expect(sql).not.toMatch(/state = '/);
    expect(sql).not.toMatch(/income|household|families/i);
  });
  it('the planner asks rulesSql() for a Texas family and keeps only federal + Texas rules (none for TX yet)', async () => {
    const runQuery = jest.fn(async (sql: string) => {
      if (sql.includes('benefit_rules')) return res(RULES);
      if (sql.includes('state_programs')) return res([]);
      throw new Error('unexpected ' + sql);
    });
    const ctx = ctxOf(guest('TX', '75201'), { runQuery });
    const cards = await planBenefits(ctx, TODAY);
    expect(runQuery.mock.calls[0][0]).toBe(rulesSql());
    const scopes = cards.map((c) => RULES.find((r) => r.code === c.claim.ref)!.scope);
    expect(scopes.every((s) => s === 'federal')).toBe(true);
    expect(cards.map((c) => c.claim.ref)).toEqual(expect.arrayContaining(['TRUMP_ACCOUNT', 'FEDERAL_CHILD_TAX_CREDIT']));
    expect(ctx.stateCovered).toBe(false);
    // The trace does not list every other state's program as "skipped": they were never this family's to begin with.
    expect(JSON.stringify(ctx.trace.lines())).not.toMatch(/only for MA families/);
  });
  it('the Lawyer ignores another state\'s program row with the same code (the state is checked in code)', async () => {
    const term: BenefitTerms = { code: 'MA_PFML', title: 'MA leave', scope: 'MA', amountCents: null, windowEndDays: 365, condition: '', deadline: '2027-10-03' };
    const rows = [
      { source: 'state_program', state: 'NY', code: 'MA_PFML', year: 2026, amount_cents: null, window_start_days_from_birth: null, window_end_days_from_birth: 365 },
      ...TAX_PARAMETER_ROWS.map((r) => ({ source: 'tax_parameter', state: null, code: r.code, year: r.year, amount_cents: r.amountCents, window_start_days_from_birth: null, window_end_days_from_birth: null })),
    ];
    const ctx = ctxOf({ ...guest('MA', '02139'), birthDate: '2026-10-03' }, { runQuery: async () => res(rows) });
    const out = await runEligibilityLoop(ctx, [term], TODAY);
    expect(out.resolutions.get('MA_PFML')!.outcome).toBe('unverified');
    const right = [{ ...rows[0], state: 'MA' }, ...rows.slice(1)];
    const ctx2 = ctxOf({ ...guest('MA', '02139'), birthDate: '2026-10-03' }, { runQuery: async () => res(right) });
    expect((await runEligibilityLoop(ctx2, [term], TODAY)).resolutions.get('MA_PFML')!.outcome).toBe('confirmed');
  });
});

describe('the recording script asks every question a typed-in family can trigger', () => {
  const offers = [
    { id: 1, min_age_days: 0, max_age_days: 365, trigger_keyword: null },
    { id: 2, min_age_days: 0, max_age_days: 90, trigger_keyword: '' },
    { id: 3, min_age_days: 30, max_age_days: 730, trigger_keyword: 'diapers' },
    { id: 4, min_age_days: 100, max_age_days: 900, trigger_keyword: null },
  ];
  it('includes the all-states rules question, the all-states counter-question and a fact-check per rule code and offer', () => {
    const qs = buildQuestions({ offerIds: [1, 2, 3, 4], familyIds: ['maya'], ruleCodes: ['TRUMP_ACCOUNT', 'MA_PFML'], offerRows: offers });
    const sqls = qs.map((q) => q.sql);
    expect(sqls).toContain(rulesSql());
    expect(sqls).toContain(eligibilityCounterSql());
    expect(sqls).toContain(ruleCheckSql('TRUMP_ACCOUNT'));
    expect(sqls).toContain(ruleCheckSql('MA_PFML'));
    expect(sqls.some((s) => /v_judge_offers WHERE id = 4$/.test(s))).toBe(true);
    // the saved-grade question for every set of general offers a baby's age can pick
    for (const set of generalOfferSets(offers)) expect(sqls).toContain(savedVerdictsSql(set));
  });
  it('generalOfferSets follows the court: offers with no trigger word, in the age window, at most 5', () => {
    const sets = generalOfferSets(offers).map((s) => s.join(','));
    expect(sets).toEqual(expect.arrayContaining(['1,2', '1', '1,4', '4']));
    expect(sets.some((s) => s.includes('3'))).toBe(false);
  });
  it('ruleCheckSql is exactly the question the Fact-Checker asks for a benefit card', async () => {
    const seen: string[] = [];
    const z = { runQuery: async (sql: string) => { seen.push(sql); return res([{ amount_cents: 100000, window_end_days_from_birth: null, scope: 'federal' }]); } };
    const ctx = ctxOf(guest('TX', '75201'), z);
    await verify({ id: 'benefit-trump_account', kind: 'benefit', title: 't', body: 'b', amountCents: 100000, deadline: null, verdict: 'likely',
      sources: [{ label: 't', url: 'https://trumpaccounts.gov' }], traceId: 'x', agent: 'benefits', claim: { type: 'rule', ref: 'TRUMP_ACCOUNT' }, retryCount: 0 } as any, ctx);
    expect(seen).toEqual([ruleCheckSql('TRUMP_ACCOUNT')]);
  });
});

describe('practice mode replays the saved recording for any state (no keys, no live Zetaris)', () => {
  const z = new ZetarisClient({ baseUrl: '', orgId: '', apiKey: '', timeoutMs: 1000, sampleMode: true, cacheDir: path.resolve('data/sample/zetaris-cache') });
  it.each(STATES)('%s: benefit cards with real dollars, nothing marked unanswered', async (state) => {
    const ctx = ctxOf(guest(state, '00000'), z);
    const cards = await planBenefits(ctx, TODAY);
    const dollars = cards.filter((c) => c.verdict === 'likely').reduce((a, c) => a + (c.amountCents ?? 0), 0);
    expect(dollars).toBeGreaterThan(0);
    // The counter-question was answered from the recording, so no card says "not yet verified".
    expect(cards.every((c) => c.claim.eligibility !== 'unverified')).toBe(true);
    // Every card the planner made can also be fact-checked offline.
    for (const c of cards) expect((await verify(c, ctx)).unavailable).toBeFalsy();
  });
});

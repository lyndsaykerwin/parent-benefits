import os from 'os';
import fs from 'fs';
import path from 'path';
import { planBenefits, UNCOVERED_STATE_NOTE } from '../agents/benefits';
import { buildFallbackFillers } from '../agents/fallback';
import { TraceLogger } from '../agents/trace';
import { FakeGenerator } from '../adapters/llm';
import { zipRows, zipStateMap } from '../sampleZips';
import { BENEFIT_RULES, STATE_PROGRAMS_JSON, TAX_PARAMETERS_JSON, STATE_PROGRAM_ROWS, TAX_PARAMETER_ROWS } from '../../scripts/seed';
import type { AgentContext } from '../agents/types';
import type { Family } from '../../shared/bundle';

const TODAY = '2026-10-23';
const res = (rows: any[]) => ({ headers: Object.keys(rows[0] ?? {}), rows, ms: 1 });
const families: Family[] = JSON.parse(fs.readFileSync(path.resolve('data/sample/families.json'), 'utf8'));
const fam = (id: string): Family => families.find((f) => f.id === id)!;

// The source sends EVERY rule for EVERY state, so the planner's own filtering is what is tested (worst case).
const ALL_RULES = BENEFIT_RULES.map((r) => ({
  code: r.code, title: r.title, scope: r.scope, amount_cents: r.amountCents ?? null,
  window_start_days_from_birth: r.windowStartDaysFromBirth ?? null, window_end_days_from_birth: r.windowEndDaysFromBirth ?? null,
  condition: r.condition ?? '', source_url: r.sourceUrl,
}));

function ctxFor(family: Family): AgentContext {
  const trace = new TraceLogger('t', fs.mkdtempSync(path.join(os.tmpdir(), 'sa-')));
  const z = { runQuery: jest.fn(async () => res(ALL_RULES)) } as any;
  return { runId: 't', family, z, llm: new FakeGenerator([]), memory: {} as any, trace };
}
const COVERED = new Set(STATE_PROGRAMS_JSON.map((p) => p.state));
const scopeOf = (ref: string) => BENEFIT_RULES.find((r) => r.code === ref)!.scope;

describe('state_agnostic: any US state works', () => {
  it('has the five made-up families across five states', () => {
    expect(['maya', 'ava', 'noor', 'cal', 'fern'].map((id) => fam(id).state)).toEqual(['MA', 'OH', 'NY', 'CA', 'FL']);
    for (const id of ['maya', 'ava', 'noor', 'cal', 'fern']) {
      const f = fam(id);
      expect(f.annualIncomeCents).toBeNull(); // exact income is no longer kept for sample families
      expect(zipStateMap()[f.zip.slice(0, 3)]).toBe(f.state); // their ZIP really is in their state
    }
  });

  describe.each(['maya', 'ava', 'noor', 'cal', 'fern'])('%s', (id) => {
    it('every card is federal or the family\'s own state, federal date rules hold, and the result is never empty', async () => {
      const f = fam(id);
      const cards = await planBenefits(ctxFor(f), TODAY);
      expect(cards.length).toBeGreaterThan(0);
      for (const c of cards) {
        const scope = scopeOf(String(c.claim.ref));
        expect(['federal', f.state]).toContain(scope);
        expect(c.sources[0].url).toMatch(/^https:\/\//);
      }
      const refs = cards.map((c) => c.claim.ref);
      expect(refs).toContain('FEDERAL_CHILD_TAX_CREDIT');
      expect(refs).toContain('TRUMP_ACCOUNT');
      expect(refs).toContain('DCFSA_LIFE_EVENT'); // "Check with your job" for every family
      // insurance window: 30 days from birth or due date
      const anchor = f.birthDate ?? f.dueDate!;
      const end = new Date(Date.parse(`${anchor}T00:00:00Z`) + 30 * 86_400_000).toISOString().slice(0, 10);
      if (end >= TODAY) expect(cards.find((c) => c.claim.ref === 'INSURANCE_ADD_BABY')!.deadline).toBe(end);
      else expect(refs).not.toContain('INSURANCE_ADD_BABY');
      // state cards appear exactly when we have programs on file for that state
      const stateCards = cards.filter((c) => scopeOf(String(c.claim.ref)) !== 'federal');
      expect(stateCards.length > 0).toBe(COVERED.has(f.state));
      for (const c of cards) expect(c.body + c.title).not.toMatch(/poverty|WIC\b/);
    });

    it('the offline stand-ins work too (federal, never an error)', () => {
      const { federalBenefits } = buildFallbackFillers(fam(id), TODAY);
      expect(federalBenefits.length).toBeGreaterThan(0);
      expect(federalBenefits.every((c) => c.verdict === 'info')).toBe(true);
    });
  });

  it('uncovered states (OH, FL) get federal programs and the "coming soon" note; covered ones do not', async () => {
    for (const id of ['ava', 'fern']) {
      const ctx = ctxFor(fam(id));
      await planBenefits(ctx, TODAY);
      expect(JSON.stringify(ctx.trace.lines())).toContain(UNCOVERED_STATE_NOTE);
    }
    for (const id of ['maya', 'noor', 'cal']) {
      const ctx = ctxFor(fam(id));
      await planBenefits(ctx, TODAY);
      expect(JSON.stringify(ctx.trace.lines())).not.toContain(UNCOVERED_STATE_NOTE);
    }
  });

  it('swap test: the same family moved to another state gets that state\'s cards and none of the old ones', async () => {
    const base = fam('maya');
    const refsIn = async (state: string) => (await planBenefits(ctxFor({ ...base, state }), TODAY)).map((c) => String(c.claim.ref));
    const fed = (await refsIn('FL')).sort();
    expect(await refsIn('MA')).toEqual(expect.arrayContaining(['MA_PFML', 'MA_CHILD_TAX_CREDIT']));
    expect(await refsIn('NY')).toContain('NY_PFL');
    expect(await refsIn('CA')).toContain('CA_PFL');
    for (const [state, own] of [['MA', 'MA_'], ['NY', 'NY_'], ['CA', 'CA_']] as const) {
      const refs = await refsIn(state);
      for (const r of refs) if (/^(MA|NY|CA)_/.test(r)) expect(r.startsWith(own)).toBe(true);
      expect(refs.filter((r) => !r.startsWith(own)).sort()).toEqual(fed); // everything else is exactly the federal set
    }
    // and the family's name, ZIP and other facts do not change the answer
    const other = await planBenefits(ctxFor({ ...base, name: 'Someone Else', zip: '10001', employer: 'Other Inc', householdSize: 5, state: 'MA' }), TODAY);
    const same = await planBenefits(ctxFor(base), TODAY);
    expect(other.map((c) => c.claim.ref)).toEqual(same.map((c) => c.claim.ref));
  });

  it('agent code never names a state', () => {
    const dir = path.resolve('server/agents');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) {
      const text = fs.readFileSync(path.join(dir, f), 'utf8');
      expect({ f, hit: /\bMA\b|Massachusetts/.test(text) }).toEqual({ f, hit: false });
      expect({ f, hit: /\b(New York|California|Ohio|Florida)\b/.test(text) }).toEqual({ f, hit: false });
    }
  });
});

describe('ZIP prefixes: any US ZIP works', () => {
  const map = zipStateMap();
  it('loads every assigned 3-digit prefix for all 50 states and DC', () => {
    const rows = zipRows();
    expect(rows.length).toBeGreaterThan(900);
    const states = new Set(Object.values(map));
    for (const st of 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ')) expect(states.has(st)).toBe(true);
    expect(map['000']).toBe('US'); // unknown-prefix default row stays
  });

  it.each([
    ['10001', 'NY'], ['02139', 'MA'], ['43215', 'OH'], ['94110', 'CA'], ['33101', 'FL'], ['60601', 'IL'], ['98101', 'WA'],
    ['99501', 'AK'], ['96813', 'HI'], ['20001', 'DC'], ['77001', 'TX'], ['59101', 'MT'], ['05401', 'VT'], ['05501', 'MA'],
    ['00901', 'PR'], ['19019', 'PA'], ['73301', 'TX'], ['88510', 'TX'], ['04101', 'ME'], ['82001', 'WY'],
  ])('ZIP %s is in %s', (zip, state) => {
    expect(map[zip.slice(0, 3)]).toBe(state);
  });

  it('every row is a 3-digit prefix and a 2-letter code, with no duplicates', () => {
    const rows = zipRows();
    for (const r of rows) { expect(r.zip3).toMatch(/^\d{3}$/); expect(r.state).toMatch(/^[A-Z]{2}$/); }
    expect(new Set(rows.map((r) => r.zip3)).size).toBe(rows.length);
  });
});

describe('tax and state-program data carry a year and a source link on every row', () => {
  it('has year, an official https source, and an explicit verified flag', () => {
    expect(TAX_PARAMETERS_JSON.length).toBeGreaterThan(0);
    expect(STATE_PROGRAMS_JSON.length).toBeGreaterThan(0);
    for (const r of [...TAX_PARAMETERS_JSON, ...STATE_PROGRAMS_JSON]) {
      expect(r.year).toBeGreaterThanOrEqual(2026);
      expect(r.sourceUrl).toMatch(/^https:\/\/[^/]+\.gov(\/|$)/);
      expect(typeof r.verified).toBe('boolean');
    }
    for (const r of STATE_PROGRAMS_JSON.filter((p) => !p.verified)) expect(r.unverifiedNote).toBeTruthy();
  });

  it('unverified rows are flagged in the stored rows themselves', () => {
    // every state program is now confirmed; the UNVERIFIED flag mechanism still works for any row marked verified:false
    expect(STATE_PROGRAM_ROWS.every((r) => !/UNVERIFIED/.test(r.condition ?? ''))).toBe(true);
    for (const r of STATE_PROGRAM_ROWS.filter((x) => x.code === 'MA_PFML')) expect(r.condition).not.toMatch(/UNVERIFIED/);
    expect(TAX_PARAMETER_ROWS.every((r) => r.sourceUrl && r.year)).toBe(true);
  });

  it('the figures that matter are the ones in the data, and benefit rules are built from them', () => {
    const tax = (code: string) => TAX_PARAMETERS_JSON.find((r) => r.code === code)!;
    expect(tax('CHILD_TAX_CREDIT').amountCents).toBe(220000);
    expect(tax('DEPENDENT_CARE_FSA_LIMIT').amountCents).toBe(750000);
    expect(BENEFIT_RULES.find((r) => r.code === 'FEDERAL_CHILD_TAX_CREDIT')!.amountCents).toBe(tax('CHILD_TAX_CREDIT').amountCents);
    for (const p of STATE_PROGRAMS_JSON) {
      const rule = BENEFIT_RULES.find((r) => r.code === p.code)!;
      expect(rule.scope).toBe(p.state);
      expect(rule.amountCents).toBe(p.amountCents);
      expect(rule.sourceUrl).toBe(p.sourceUrl);
    }
  });

  it('the poverty/WIC rule is gone from every rule list', () => {
    expect(BENEFIT_RULES.some((r) => r.code === 'WIC_SCREEN' || /poverty|WIC/i.test(r.title + r.condition))).toBe(false);
    const fallback = JSON.parse(fs.readFileSync(path.resolve('data/sample/fallback-rules.json'), 'utf8'));
    expect(fallback.some((r: any) => r.code === 'WIC_SCREEN')).toBe(false);
  });
});

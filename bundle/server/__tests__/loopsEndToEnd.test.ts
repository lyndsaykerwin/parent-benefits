import os from 'os';
import fs from 'fs';
import path from 'path';
import { judgeOffers, revise as reviseOffer } from '../agents/finePrintCourt';
import { checkWithCorrections, MAX_CORRECTION_ROUNDS } from '../agents/factChecker';
import { findClawbacks } from '../agents/clawback';
import { planBenefits } from '../agents/benefits';
import { readPhoto, createMemoryPhotoStore, MAX_READ_ATTEMPTS, NO_MODEL_MESSAGE, type PhotoDeps } from '../ingest/photo';
import { fingerprint } from '../agents/finePrintRules';
import { BENEFIT_RULES, STATE_PROGRAM_ROWS, TAX_PARAMETER_ROWS } from '../../scripts/seed';
import { TraceLogger } from '../agents/trace';
import { BundleMemory } from '../adapters/memory';
import { FakeGenerator, type Generator, type SeeRequest } from '../adapters/llm';
import type { AgentContext, Candidate } from '../agents/types';
import { LOOP_KINDS, loopsOf, type LoopKind } from '@shared/agentLoops';
import type { AgentLogLine } from '@shared/agentLog';

/**
 * Every loop, end to end, with the REAL agent code writing the REAL log lines (nothing here is a hand-written log).
 * The panel's wording rules (shared/agentLoops.ts) are checked against what the agents actually write.
 *
 * What needs a fake model: loops that need AI answers cannot appear in an offline sample run with no model, so these use
 * a scripted stand-in model (FakeGenerator): the Court's rebuttal round, the Fact-Checker send-back that re-judges an offer,
 * and the photo retry (a scripted stand-in for the vision model). Everything else runs on code and made-up rows only:
 * the eligibility loop, recall verification, the safety kill, saved-grade reuse. The Court's rebuttal with a REAL model
 * is not covered here (Mac step: eval:live-model).
 */

const TODAY = '2026-10-23';
const maya = {
  id: 'maya', userId: null, isGuest: true, name: 'Maya', birthDate: '2026-10-03', dueDate: null,
  zip: '02139', state: 'MA', employer: '', householdSize: 3, annualIncomeCents: null,
  dcfsaOffered: false, dataConnected: true,
};
const res = (rows: any[]) => ({ headers: Object.keys(rows[0] ?? {}), rows, ms: 1 });
const tmpDir = (p: string) => fs.mkdtempSync(path.join(os.tmpdir(), p));

const counts = (lines: AgentLogLine[]): Record<LoopKind, number> => {
  const out = Object.fromEntries(LOOP_KINDS.map((k) => [k, 0])) as Record<LoopKind, number>;
  for (const l of lines) for (const k of loopsOf(l)) out[k]++;
  return out;
};
const only = (c: Record<LoopKind, number>, kind: LoopKind, n: number) => {
  const expected = Object.fromEntries(LOOP_KINDS.map((k) => [k, k === kind ? n : 0]));
  expect(c).toEqual(expected);
};

// ---------- the Court: rebuttal round, saved grades ----------

const offer = (id: number, over: any = {}) => ({
  id, title: `Offer ${id}`, store: 'Store', min_age_days: -280, max_age_days: 365, trigger_keyword: '',
  value_cents: 1000, fine_print: 'Registry required.', source_url: 'https://x.test', ...over,
});
const APPROVE = '{"verdict":"approve","citedRuleIds":[],"reason":"fine"}';
const IN = { ageDays: 20, purchaseKeywords: [] as string[], includeGeneral: true };
const savedRow = (over: any = {}) => ({
  offer_id: '1', store: 'Store', verdict: 'approve', status: 'agreed', rule_citations: '[]',
  true_value_cents: 1000, effort_minutes_estimate: 12, steps_count: 1, payout_wait_days_max: 56, claim_window_days: 30,
  fine_print_hash: fingerprint('Registry required.'), universal_rule: false, checked_at: '2026-10-20T00:00:00Z', ...over,
});

function courtCtx(rows: any[], llm: any, saved: any[] = []) {
  const trace = new TraceLogger('t', tmpDir('loops-court-'));
  const runQuery = jest.fn(async (sql: string) => res(/v_offer_verdicts/.test(sql) ? saved : rows));
  const memory = new BundleMemory(tmpDir('loops-mem-'));
  const ctx = { runId: 't', family: maya, z: { runQuery } as any, llm, memory, trace } as AgentContext;
  return { ctx, trace, runQuery };
}

describe('loop 5: the Court rebuttal round (needs a scripted model)', () => {
  beforeEach(() => { process.env.TODAY = TODAY; });
  const feeOffer = offer(60, { title: 'Free box', store: 'Fee Co', fine_print: 'Free box. $7.99 shipping applies.', value_cents: 500 });

  it('a disputed offer counts exactly one rebuttal round; the hunter, lawyer, rule and outcome lines are not extra rounds', async () => {
    const llm = new FakeGenerator(['pro', 'con', APPROVE, 'hunter rebuts', 'lawyer rebuts', APPROVE]);
    const { ctx, trace } = courtCtx([feeOffer], llm);
    await judgeOffers(ctx, IN);
    const lines = trace.agentLines();
    only(counts(lines), 'rebuttal', 1);
    const opener = lines.find((l) => loopsOf(l).includes('rebuttal'))!;
    expect(opener).toMatchObject({ agent_name: 'FinePrintCourt', action: 'court_debate', status: 'retrying', retry_count: 1 });
    expect(opener.input_summary).toContain('rebuttal round 1 of 1');
    // the outcome line mentions the round, but it is the same round
    expect(lines.some((l) => /after 1 rebuttal round/.test(l.output_summary) && l.retry_count === 1)).toBe(true);
  });

  it('an agreed offer has no rebuttal: "no rebuttal needed" on the outcome line is not a rebuttal', async () => {
    const { ctx, trace } = courtCtx([offer(1)], new FakeGenerator(['pro', 'con', APPROVE]));
    await judgeOffers(ctx, IN);
    const lines = trace.agentLines();
    expect(lines.some((l) => /no rebuttal needed/.test(l.output_summary))).toBe(true);
    only(counts(lines), 'rebuttal', 0);
  });

  it('a send-back re-judge of the same offer never opens a second round', async () => {
    const llm = new FakeGenerator(['pro', 'con', APPROVE, 'hr', 'lr', APPROVE]);
    const { ctx, trace } = courtCtx([feeOffer], llm);
    await judgeOffers(ctx, IN);
    await reviseOffer({ id: 'discount-60', claim: { type: 'offer', offerId: 60 }, retryCount: 0 } as any, 'check again', ctx);
    expect(counts(trace.agentLines()).rebuttal).toBe(1);
  });
});

describe('loops 6 and the newsroom: saved grades', () => {
  beforeEach(() => { process.env.TODAY = TODAY; });

  it('a saved agreed grade with an unchanged wording is reused: counted once, no AI call', async () => {
    const llm = new FakeGenerator(['p', 'c', APPROVE]);
    const { ctx, trace } = courtCtx([offer(1)], llm, [savedRow()]);
    await judgeOffers(ctx, IN);
    expect(llm.calls).toBe(0);
    const lines = trace.agentLines();
    expect(counts(lines).saved_verdict).toBe(1);
    const reuse = lines.find((l) => loopsOf(l).includes('saved_verdict'))!;
    expect(reuse.output_summary).toMatch(/saved grade is reused \(no AI\)/);
    expect(counts(lines).rebuttal).toBe(0);
  });

  it('"no saved grades yet" and "saved grades unavailable" are not reuses', async () => {
    const none = courtCtx([offer(1)], new FakeGenerator(['p', 'c', APPROVE]), []);
    await judgeOffers(none.ctx, IN);
    expect(none.trace.agentLines().some((l) => /no saved grades yet/.test(l.output_summary))).toBe(true);
    only(counts(none.trace.agentLines()), 'saved_verdict', 0);
  });

  it('past grades used only as context for a second offer are NOT counted as a reuse (the AI still runs)', async () => {
    const llm = new FakeGenerator(['p', 'c', APPROVE, 'p', 'c', APPROVE]);
    const { ctx, trace } = courtCtx([offer(1), offer(2)], llm);
    await judgeOffers(ctx, IN);
    const ctxLines = trace.agentLines().filter((l) => /^(?:\w+: )?used [1-9]\d* past grade/.test(l.output_summary));
    expect(ctxLines.length).toBeGreaterThanOrEqual(1);
    expect(llm.calls).toBeGreaterThan(0);
    for (const l of ctxLines) expect(loopsOf(l)).not.toContain('saved_verdict');
    expect(counts(trace.agentLines()).saved_verdict).toBe(0);
  });
});

// ---------- the Fact-Checker: targeted corrections (max 2) and recall verification ----------

function checkerCtx(rows: (sql: string) => any[]) {
  const trace = new TraceLogger('t', tmpDir('loops-fc-'));
  const runQuery = jest.fn(async (sql: string) => res(rows(sql)));
  const ctx = { runId: 't', family: maya, z: { runQuery } as any, llm: new FakeGenerator(['x']), memory: {} as any, trace } as AgentContext;
  return { ctx, trace, runQuery };
}
const card = (over: Partial<Candidate> = {}): Candidate => ({
  id: 'c1', kind: 'discount', title: 'Offer', body: 'b', amountCents: 2899, deadline: null, verdict: 'verified',
  sources: [{ label: 'Store', url: 'https://example.com' }], traceId: 't1', agent: 'judge',
  claim: { type: 'offer', offerId: 7 }, evidenceSql: 'SELECT 1', retryCount: 0, ...over,
});

describe('loop 3: Fact-Checker targeted corrections (max 2)', () => {
  it('fixed in round 1: one send-back counted (the maker\'s own "revise" line is the same round)', async () => {
    const { ctx, trace } = checkerCtx(() => [{ value_cents: 2499, max_age_days: 400 }]);
    const out = await checkWithCorrections(card(), ctx, async (c) => ({ ...c, amountCents: 2499, retryCount: c.retryCount + 1 }));
    expect(out).toMatchObject({ decision: 'approved', rounds: 1 });
    only(counts(trace.agentLines()), 'send_back', 1);
  });

  it('with the real Court re-judging the card: still one send-back, even though two agents wrote retry lines', async () => {
    process.env.TODAY = TODAY;
    const llm = new FakeGenerator(['p', 'c', APPROVE, 'p', 'c', APPROVE]);
    const { ctx, trace } = courtCtx([offer(3, { value_cents: 2500 })], llm);
    const [first] = await judgeOffers(ctx, IN);
    const wrong: Candidate = { ...first, amountCents: 9999 };
    const out = await checkWithCorrections(wrong, ctx, (c, why) => reviseOffer(c, why, ctx) as Promise<Candidate | null>);
    expect(out.rounds).toBe(1);
    const retries = trace.agentLines().filter((l) => l.action === 'retry_request');
    expect(retries.length).toBeGreaterThanOrEqual(2);
    expect(counts(trace.agentLines()).send_back).toBe(1);
  });

  it('never fixed: exactly 2 send-backs, then rejected; never a third', async () => {
    const { ctx, trace } = checkerCtx(() => [{ value_cents: 2499, max_age_days: 400 }]);
    const out = await checkWithCorrections(card(), ctx, async (c) => ({ ...c, retryCount: c.retryCount + 1 }));
    expect(out).toMatchObject({ decision: 'rejected', rounds: 2 });
    expect(MAX_CORRECTION_ROUNDS).toBe(2);
    const lines = trace.agentLines();
    only(counts(lines), 'send_back', 2);
    expect(lines[lines.length - 1]).toMatchObject({ action: 'reject_card', status: 'rejected' });
    expect(Math.max(...lines.map((l) => l.retry_count))).toBe(2);
  });
});

describe('loop 8: recall verification (inside the same cap)', () => {
  const recall = (claim: Record<string, string | number>): Candidate =>
    card({ id: 'recall-cpsc-10560', kind: 'recall', agent: 'recall', amountCents: null, claim: { type: 'recall', recallId: 10560, ...claim } });
  const ok = { evidence: 'lot code ABC123 appears in the recall notice', evidenceType: 'lot', evidenceCode: 'ABC123', recalledProduct: 'Acme Formula 12oz, lot ABC123', itemText: 'Acme Formula 12oz' };

  it('an alert with evidence is checked against the recall record once and approved, with no send-back', async () => {
    const { ctx, trace } = checkerCtx(() => [{ RecallID: 10560 }]);
    expect((await checkWithCorrections(recall(ok), ctx, jest.fn())).decision).toBe('approved');
    only(counts(trace.agentLines()), 'recall_check', 1);
  });

  it('no evidence, no alert: the check is counted, the alert is rejected, nothing is sent back', async () => {
    const { ctx, trace } = checkerCtx(() => [{ RecallID: 10560 }]);
    const reviser = jest.fn();
    expect((await checkWithCorrections(recall({}), ctx, reviser)).decision).toBe('rejected');
    expect(reviser).not.toHaveBeenCalled();
    const lines = trace.agentLines();
    only(counts(lines), 'recall_check', 1);
    expect(lines.find((l) => loopsOf(l).includes('recall_check'))!.status).toBe('rejected');
    expect(lines.some((l) => l.action === 'reject_card')).toBe(true);
  });

  it('a non-recall card is never counted as a recall check', async () => {
    const { ctx, trace } = checkerCtx(() => [{ value_cents: 2899, max_age_days: 365 }]);
    await checkWithCorrections(card(), ctx, jest.fn());
    only(counts(trace.agentLines()), 'recall_check', 0);
  });
});

// ---------- safety-value loop ----------

describe('loop 1: safety-value loop (Clawback Hunter asks the Recall Checker)', () => {
  const PRICE = { item_id: 9, merchant: 'Target', date: '2026-10-08', amount_cents: 8999, item: 'KEAWIS Crib Mattress, Dual-Sided Firm Baby Mattress', window_days: 14, observed_price_cents: 6999, observed_at: '2026-10-20', store_source_url: 'https://help.target.com/x', price_source_url: 'https://www.target.com/c/x' };
  const ITEMS = [{ item_text: PRICE.item, source: 'email' }];
  const PAIR = {
    item_text: PRICE.item, purchased_on: '2026-01-20', source: 'email', recall_source: 'cpsc', recall_id: 10560, recall_number: '26191',
    recall_date: '2026-01-15', recall_title: 'Yixing Trading Recalls KEAWIS Crib Mattresses', recall_url: 'https://www.cpsc.gov/Recalls/2026/Yixing', recalled_product: 'KEAWIS Crib Mattress',
  };
  function ctxFor(pairs: any[]) {
    const trace = new TraceLogger('t', tmpDir('loops-safe-'));
    const runQuery = jest.fn(async (sql: string) => {
      if (sql.includes('store_policies')) return res([PRICE]);
      if (sql.includes('fsa_eligible_categories')) return res([]);
      if (sql.includes('bundle_live.') || sql.includes('SELECT DISTINCT item_text')) {
        if (sql.includes("= 'terminated'") || sql.includes('AS description')) return res([]);
        if (sql.includes('LATERAL VIEW')) return res(pairs);
        return res(ITEMS);
      }
      throw new Error('unexpected sql ' + sql);
    });
    return { ctx: { runId: 't', family: maya, z: { runQuery } as any, llm: new FakeGenerator([]), memory: {} as any, trace } as AgentContext, trace };
  }

  beforeEach(() => { process.env.TODAY = TODAY; });

  it('a recalled item\'s deal is killed before the Judge: one safety kill, no card, nothing reaches the Court', async () => {
    const { ctx, trace } = ctxFor([PAIR]);
    expect(await findClawbacks(ctx)).toEqual([]);
    const lines = trace.agentLines();
    only(counts(lines), 'safety_kill', 1);
    const kill = lines.find((l) => loopsOf(l).includes('safety_kill'))!;
    expect(kill).toMatchObject({ agent_name: 'ClawbackHunter', action: 'reject_card', status: 'rejected', target_agent: 'RecallChecker' });
    expect(kill.output_summary).toMatch(/killed before the Judge/);
    expect(lines.some((l) => l.agent_name === 'FinePrintCourt')).toBe(false);
  });

  it('with no recall on the item the deal stays and nothing is counted', async () => {
    const { ctx, trace } = ctxFor([]);
    expect((await findClawbacks(ctx)).length).toBe(1);
    only(counts(trace.agentLines()), 'safety_kill', 0);
  });
});

// ---------- eligibility loop ----------

describe('loop 2: eligibility loop (Benefits Planner and Fine Print Lawyer, one Zetaris counter-question)', () => {
  beforeEach(() => { process.env.TODAY = TODAY; });
  const RULES = BENEFIT_RULES.map((r) => ({
    code: r.code, title: r.title, scope: r.scope, amount_cents: r.amountCents ?? null,
    window_start_days_from_birth: r.windowStartDaysFromBirth ?? null, window_end_days_from_birth: r.windowEndDaysFromBirth ?? null,
    condition: r.condition ?? '', source_url: r.sourceUrl,
  }));
  const counterRows = (tweak: (r: any) => any = (r) => r) => [
    ...STATE_PROGRAM_ROWS.filter((r) => r.state === 'MA').map((r) => ({
      source: 'state_program', code: r.code, year: r.year, amount_cents: r.amountCents ?? null,
      window_start_days_from_birth: r.windowStartDaysFromBirth ?? null, window_end_days_from_birth: r.windowEndDaysFromBirth ?? null,
    })),
    ...TAX_PARAMETER_ROWS.map((r) => ({ source: 'tax_parameter', code: r.code, year: r.year, amount_cents: r.amountCents ?? null, window_start_days_from_birth: null, window_end_days_from_birth: null })),
  ].map(tweak);
  function ctxWith(counter: any[]) {
    const trace = new TraceLogger('t', tmpDir('loops-elig-'));
    const runQuery = jest.fn(async (sql: string) => {
      if (sql.includes('benefit_rules')) return res(RULES);
      if (sql.includes('state_programs')) return res(counter);
      throw new Error('unexpected sql ' + sql);
    });
    return { ctx: { runId: 't', family: maya, z: { runQuery } as any, llm: new FakeGenerator([]), memory: {} as any, trace } as AgentContext, trace, runQuery };
  }
  const counterCalls = (q: jest.Mock) => q.mock.calls.filter(([sql]) => String(sql).includes('state_programs')).length;

  it('confirms: one counter-question, then one eligibility line per challenged benefit (the challenge itself is not counted twice)', async () => {
    const { ctx, trace, runQuery } = ctxWith(counterRows());
    await planBenefits(ctx, TODAY);
    expect(counterCalls(runQuery)).toBe(1);
    const lines = trace.agentLines();
    const challenge = lines.filter((l) => /one counter-question for Zetaris/.test(l.output_summary));
    expect(challenge).toHaveLength(1);
    expect(challenge[0]).toMatchObject({ agent_name: 'FinePrintCourt', action: 'court_debate', status: 'retrying', retry_count: 1 });
    const c = counts(lines);
    expect(c.eligibility).toBe(2); // the state leave program and the federal tax credit
    expect(c.rebuttal).toBe(0); // the old wording check took this retry line for a rebuttal
    expect(lines.filter((l) => loopsOf(l).includes('eligibility')).every((l) => /^confirmed:/.test(l.output_summary))).toBe(true);
  });

  it('drops: a program the state table says is over is dropped after that one question', async () => {
    const { ctx, trace, runQuery } = ctxWith(counterRows((r) => (r.code === 'MA_PFML' ? { ...r, window_end_days_from_birth: 5 } : r)));
    await planBenefits(ctx, TODAY);
    expect(counterCalls(runQuery)).toBe(1);
    const dropped = trace.agentLines().filter((l) => loopsOf(l).includes('eligibility') && /^dropped:/.test(l.output_summary));
    expect(dropped).toHaveLength(1);
    expect(dropped[0].status).toBe('rejected');
  });
});

// ---------- photo intake loop (scripted vision model) ----------

describe('loop 7: photo intake retry (needs a scripted vision model; max 1)', () => {
  const photo = (tag: string) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(`synthetic-${tag}`)]);
  const GOOD = JSON.stringify({ rejected: null, readText: 'Model No: RV001 is printed on a label under the walker seat. UPC 669028116546', store: null, purchasedOn: null,
    items: [{ productName: 'Baby walker', brand: 'Kmaier', modelNumber: 'RV001', lotCode: null, upc: '669028116546', sizeText: null, priceCents: null, quantity: 1 }] });
  const BAD = JSON.stringify({ rejected: null, readText: 'Model No: RV001 under the seat', store: null, purchasedOn: null,
    items: [{ productName: 'Baby walker', brand: 'Kmaier', modelNumber: 'ZZ999', lotCode: null, upc: '669028116547', sizeText: null, priceCents: null, quantity: 1 }] });
  const vision = (steps: string[]): Generator => {
    let n = 0;
    return { async generate() { throw new Error('not used'); }, async see(_r: SeeRequest) { return steps[Math.min(n++, steps.length - 1)]; } };
  };
  const run = async (steps: string[], tag: string) => {
    const dir = tmpDir('loops-photo-');
    const trace = new TraceLogger('photo-loop', path.join(dir, 'logs'));
    const deps: PhotoDeps = { gen: vision(steps), store: createMemoryPhotoStore(), sampleMode: false, cacheDir: path.join(dir, 'cache'), trace, env: {} };
    const out = await readPhoto({ familyId: 'maya', kind: 'item', mimeType: 'image/png', bytes: photo(tag) }, deps);
    return { out, lines: trace.agentLines() };
  };

  it('a bad first reading then a good one: one retry counted', async () => {
    const { out, lines } = await run([BAD, GOOD], 'a');
    expect(out.status).toBe('ok');
    only(counts(lines), 'photo_retry', 1);
    expect(lines.find((l) => loopsOf(l).includes('photo_retry'))).toMatchObject({ agent_name: 'PhotoReader', action: 'retry_request', status: 'retrying', retry_count: 1 });
  });

  // Oct 26 (Lane C, approved by Lyndsay): a reading with problems is the model's fault, not the photo's, so it is asked
  // again up to MAX_READ_ATTEMPTS answers (3 retries). The loop still ends: never a guessed code, never past the cap.
  it('bad every time: at most MAX_READ_ATTEMPTS - 1 retries, then it stops without guessing a model number', async () => {
    const { out, lines } = await run([BAD], 'b');
    only(counts(lines), 'photo_retry', MAX_READ_ATTEMPTS - 1);
    const last = lines[lines.length - 1];
    expect(last).toMatchObject({ action: 'vision_extract', status: 'rejected' });
    expect(last.output_summary).toMatch(/no model number/);
    expect(out).toMatchObject({ status: 'needs_clearer_photo', message: NO_MODEL_MESSAGE });
    expect(Math.max(...lines.map((l) => l.retry_count))).toBeLessThanOrEqual(MAX_READ_ATTEMPTS - 1);
  });

  it('a good first reading: no retry', async () => {
    const { lines } = await run([GOOD], 'c');
    only(counts(lines), 'photo_retry', 0);
  });
});

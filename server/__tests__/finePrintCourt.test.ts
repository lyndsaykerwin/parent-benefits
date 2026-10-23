import os from 'os';
import fs from 'fs';
import path from 'path';
import { judgeOffers, revise } from '../agents/finePrintCourt';
import { TraceLogger } from '../agents/trace';
import { FakeGenerator, UnavailableGenerator } from '../adapters/llm';
import { BundleMemory } from '../adapters/memory';
import type { AgentContext } from '../agents/types';

const maya = {
  id: 'maya', userId: null, isGuest: true, name: 'Maya', birthDate: '2026-10-03', dueDate: null,
  zip: '02139', state: 'MA', employer: 'Northwind', householdSize: 3, annualIncomeCents: 14500000,
  dcfsaOffered: true, dataConnected: true,
};
const offer = (id: number, over: any = {}) => ({
  id, title: `Offer ${id}`, store: 'Store', min_age_days: -280, max_age_days: 365, trigger_keyword: '',
  value_cents: 1000, fine_print: 'Registry required.', source_url: 'https://x.test', ...over,
});
// The trap's auto-renew wording (without the shipping sentence, which the offline fee check would catch).
const TRAP_PRINT = 'Free box requires a card on file. After a 30-day trial you are automatically enrolled in a paid membership at $29.99/month until you cancel.';
const trap = offer(50, { title: 'Free newborn diaper box', store: 'Cuddle & Co', fine_print: TRAP_PRINT });
const REJECT = '{"verdict":"reject","citedRuleIds":[],"reason":"hidden paid membership"}';
const APPROVE = '{"verdict":"approve","citedRuleIds":[],"reason":"fine"}';

function setup(rows: any[], llm: any, memory?: BundleMemory) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fpc-'));
  const trace = new TraceLogger('t', dir);
  const runQuery = jest.fn(async (_sql: string) => ({ headers: [], rows, ms: 1 }));
  const mem = memory ?? new BundleMemory(fs.mkdtempSync(path.join(os.tmpdir(), 'mem-')));
  const ctx = { runId: 't', family: maya, z: { runQuery } as any, llm, memory: mem, trace } as AgentContext;
  return { ctx, trace, runQuery, mem };
}
const IN = { ageDays: 20, purchaseKeywords: [] as string[], includeGeneral: true };

describe('fine print court', () => {
  beforeEach(() => { process.env.TODAY = '2026-10-23'; });

  it('rejects the trap when the Judge says reject, and traces it as blocked', async () => {
    const llm = new FakeGenerator(['Great free box!', 'Auto-renews into $40 shipping subscription.', REJECT]);
    const { ctx, trace } = setup([trap], llm);
    expect(await judgeOffers(ctx, IN)).toEqual([]);
    expect(trace.lines().find((l) => l.agent_name === 'judge')!.status).toBe('blocked');
  });

  it('puts recalled case-law text and ids in the Judge prompt', async () => {
    const llm = new FakeGenerator(['pro', 'con', REJECT]);
    const { ctx, mem } = setup([trap], llm);
    const id = mem.addRule('free trials that auto-renew into paid memberships are not free', 'test', 0.8, []);
    await judgeOffers(ctx, IN);
    const judgePrompt = llm.prompts[2];
    expect(judgePrompt).toContain('free trials that auto-renew into paid memberships are not free');
    expect(judgePrompt).toContain(id);
  });

  it('makes exactly 3 LLM calls and 3 trace lines per offer', async () => {
    const llm = new FakeGenerator(['pro', 'con', APPROVE]);
    const { ctx, trace } = setup([offer(1), offer(2)], llm);
    const out = await judgeOffers(ctx, IN);
    expect(llm.calls).toBe(6);
    const court = trace.lines().filter((l) => ['deal_hunter', 'fine_print_lawyer', 'judge'].includes(l.agent_name));
    expect(court.map((l) => l.agent_name)).toEqual(['deal_hunter', 'fine_print_lawyer', 'judge', 'deal_hunter', 'fine_print_lawyer', 'judge']);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ kind: 'discount', verdict: 'likely', claim: { type: 'offer', offerId: 1 }, amountCents: 1000, deadline: '2027-10-03' });
  });

  it('judges at most 5 offers, triggered ones first', async () => {
    const rows = [1, 2, 3, 4, 5, 6].map((i) => offer(i)).concat([offer(7, { trigger_keyword: 'diaper' })]);
    const llm = new FakeGenerator(['pro', 'con', APPROVE]);
    const { ctx } = setup(rows, llm);
    const out = await judgeOffers(ctx, { ...IN, purchaseKeywords: ['pampers diapers size 1'] });
    expect(llm.calls).toBe(15);
    expect(out).toHaveLength(5);
    expect(out[0].claim.offerId).toBe(7);
  });

  it('includeGeneral adds general offers; without it only triggered offers go to court', async () => {
    const rows = [offer(1), offer(2, { trigger_keyword: 'stroller' })];
    const a = setup(rows, new FakeGenerator(['p', 'c', APPROVE]));
    expect((await judgeOffers(a.ctx, { ...IN, includeGeneral: false, purchaseKeywords: ['Baby Jogger stroller'] })).map((c) => c.claim.offerId)).toEqual([2]);
    const b = setup(rows, new FakeGenerator(['p', 'c', APPROVE]));
    expect((await judgeOffers(b.ctx, { ...IN, purchaseKeywords: ['stroller'] })).map((c) => c.claim.offerId)).toEqual([2, 1]);
    const c = setup(rows, new FakeGenerator(['p', 'c', APPROVE]));
    expect(await judgeOffers(c.ctx, { ...IN, includeGeneral: false, purchaseKeywords: [] })).toEqual([]);
  });

  describe('model unavailable: deterministic screen', () => {
    const off = () => new UnavailableGenerator('no key');
    it('(a) no case law: trap approved as likely, traced as fallback', async () => {
      const { ctx, trace } = setup([trap], off());
      const out = await judgeOffers(ctx, IN);
      expect(out).toHaveLength(1);
      expect(out[0].verdict).toBe('likely');
      expect(trace.lines().find((l) => l.agent_name === 'judge')!.status).toBe('fallback');
    });
    it('(b) case law on auto-renew rejects the trap and cites the rule', async () => {
      const { ctx, mem, trace } = setup([trap], off());
      const id = mem.addRule('free trials that auto-renew into paid memberships are not free', 'test', 0.8, []);
      expect(await judgeOffers(ctx, IN)).toEqual([]);
      const j = trace.lines().find((l) => l.agent_name === 'judge')!;
      expect(j.status).toBe('blocked');
      expect(j.output_summary).toContain(id);
    });
    it('(b2) an unrelated rule does not reject a harmless offer', async () => {
      const { ctx, mem } = setup([offer(1, { fine_print: 'Registry required. One per household.' })], off());
      mem.addRule('free trials that auto-renew into paid memberships are not free', 'test', 0.8, []);
      expect(await judgeOffers(ctx, IN)).toHaveLength(1);
    });
    it('(c) an explicit $7.99 shipping fee is rejected, $3.99 is not', async () => {
      const bad = setup([offer(1, { fine_print: 'Free box. $7.99 shipping applies.' })], off());
      expect(await judgeOffers(bad.ctx, IN)).toEqual([]);
      const ok = setup([offer(2, { fine_print: 'Free box. $3.99 shipping applies.' })], off());
      expect(await judgeOffers(ok.ctx, IN)).toHaveLength(1);
    });
    it('(c2) thresholds and free shipping are not fees; attached fees are', async () => {
      for (const fp of ['Free shipping on orders over $50.', 'Free shipping with a $25 minimum purchase. Handling is free.', 'Spend $75 and shipping is free.']) {
        const { ctx } = setup([offer(1, { fine_print: fp })], off());
        expect(await judgeOffers(ctx, IN)).toHaveLength(1);
      }
      for (const fp of ['Shipping and handling $7.95.', 'A shipping fee of $9 applies.', 'Plus $12 postage.', 'Free box. Shipping: $6.50']) {
        const { ctx } = setup([offer(1, { fine_print: fp })], off());
        expect(await judgeOffers(ctx, IN)).toEqual([]);
      }
    });
  });

  it('I4: asks for all offers in one query and applies the baby\'s age in code', async () => {
    const rows = [offer(1), offer(2, { min_age_days: 100, max_age_days: 365 }), offer(3, { min_age_days: -280, max_age_days: 10 })];
    const { ctx, runQuery } = setup(rows, new FakeGenerator(['p', 'c', APPROVE]));
    const out = await judgeOffers(ctx, IN);
    expect(out.map((c) => c.claim.offerId)).toEqual([1]);
    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(runQuery.mock.calls[0][0]).not.toMatch(/WHERE/i);
  });

  it('I3: an AI approval keeps the full-check wording; an offline approval never claims one', async () => {
    const online = setup([offer(1)], new FakeGenerator(['p', 'c', APPROVE]));
    expect((await judgeOffers(online.ctx, IN))[0].body).toContain('Our fine-print check found nothing that makes it costly');
    const offline = setup([offer(1)], new UnavailableGenerator('no key'));
    const body = (await judgeOffers(offline.ctx, IN))[0].body;
    expect(body).toContain('Offline screen: no flagged terms found. Not reviewed by the AI court.');
    expect(body).not.toMatch(/found nothing that makes it costly|Likely a good deal/);
    expect(offline.trace.lines().find((l) => l.agent_name === 'judge')!.output_summary).toContain('Offline screen: no flagged terms found. Not reviewed by the AI court.');
  });

  it('I3: the offline screen rejects offers that need a paid membership, but not the auto-renew trap (only case law catches that)', async () => {
    for (const fp of ['Requires Prime and a registry with at least one item; limited to one per household.', 'Costco membership required.', 'Box ships after you add 10 items; shipping fee may apply.']) {
      const { ctx } = setup([offer(1, { fine_print: fp })], new UnavailableGenerator('no key'));
      expect(await judgeOffers(ctx, IN)).toEqual([]);
    }
    for (const fp of ['Autoship must remain active for 2 deliveries.', 'First bundle only; subscription is optional and can be skipped.', TRAP_PRINT]) {
      const { ctx } = setup([offer(1, { fine_print: fp })], new UnavailableGenerator('no key'));
      expect(await judgeOffers(ctx, IN)).toHaveLength(1);
    }
  });

  it('matches trigger keywords as whole words only', async () => {
    const rows = [offer(1, { trigger_keyword: 'diaper' }), offer(2, { trigger_keyword: 'car seat' })];
    const run = async (kw: string) => {
      const { ctx } = setup(rows, new FakeGenerator(['p', 'c', APPROVE]));
      return (await judgeOffers(ctx, { ...IN, includeGeneral: false, purchaseKeywords: [kw] })).map((c) => c.claim.offerId);
    };
    expect(await run('Pampers diapers size 1')).toEqual([1]);
    expect(await run('dia')).toEqual([]);
    expect(await run('diaper-genie refill')).toEqual([1]);
    expect(await run('carseat')).toEqual([]);
  });

  it('drops cited rule ids the court never recalled, and traces a Judge approve as ok', async () => {
    const llm = new FakeGenerator(['pro', 'con', '{"verdict":"approve","citedRuleIds":["made-up-id"],"reason":"fine"}']);
    const { ctx, trace } = setup([offer(1)], llm);
    expect(await judgeOffers(ctx, IN)).toHaveLength(1);
    const j = trace.lines().find((l) => l.agent_name === 'judge')!;
    expect(j.status).toBe('ok');
    expect(j.output_summary).not.toContain('made-up-id');
    const llm2 = new FakeGenerator(['pro', 'con', '{"verdict":"reject","citedRuleIds":["made-up-id"],"reason":"no"}']);
    const s2 = setup([trap], llm2);
    await judgeOffers(s2.ctx, IN);
    expect(s2.trace.lines().find((l) => l.agent_name === 'judge')!.output_summary).not.toContain('made-up-id');
  });

  it('revise re-judges one offer with the reason in the prompts', async () => {
    const llm = new FakeGenerator(['pro', 'con', APPROVE]);
    const { ctx, runQuery } = setup([offer(1)], llm);
    const c = (await judgeOffers(ctx, IN))[0];
    runQuery.mockClear();
    const r = await revise(c, 'amount mismatch', ctx);
    expect(r?.retryCount).toBe(1);
    expect(llm.prompts[5]).toContain('amount mismatch');
    expect(runQuery.mock.calls[0][0]).toContain('WHERE id = 1');
  });
});

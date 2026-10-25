import os from 'os';
import fs from 'fs';
import path from 'path';

jest.mock('../agents/clawback');
jest.mock('../agents/recall');
jest.mock('../agents/finePrintCourt');
jest.mock('../agents/benefits', () => ({ ...jest.requireActual('../agents/benefits'), planBenefits: jest.fn(), revise: jest.fn() }));
jest.mock('../agents/factChecker');

import * as clawback from '../agents/clawback';
import * as recall from '../agents/recall';
import * as court from '../agents/finePrintCourt';
import * as benefits from '../agents/benefits';
import * as fc from '../agents/factChecker';
import { runBundle, assembleFeed, BANNER } from '../agents/orchestrator';
import { UNCOVERED_STATE_NOTE } from '../agents/benefits';
import { RunEventHub } from '../agents/runEvents';
import { Workspace } from '../agents/workspace';
import { ZetarisUnavailable } from '../adapters/zetaris';
import { ChainGenerator, FakeGenerator, OpenAICompatGenerator } from '../adapters/llm';
import { makeGenerator } from '../bundleDeps';
import type { Candidate } from '../agents/types';
import { useFakeCheckWithCorrections as useFake } from './helpers/fakeChecker';
import type { Family } from '../../shared/bundle';

const maya: Family = {
  id: 'maya', userId: null, isGuest: true, name: 'Maya', birthDate: '2026-10-03', dueDate: null,
  zip: '02139', state: 'MA', employer: 'N', householdSize: 3, annualIncomeCents: 14500000, dcfsaOffered: true, dataConnected: true,
};
const leo: Family = { ...maya, id: 'leo', birthDate: null, dueDate: '2026-12-07', dataConnected: false };
const TODAY = '2026-10-23';

function cand(id: string, kind: Candidate['kind'], agent: string, over: Partial<Candidate> = {}): Candidate {
  return {
    id, kind, title: id, body: 'b', amountCents: null, deadline: null, verdict: 'likely', sources: [{ label: 's', url: 'https://x' }],
    traceId: 't', agent, claim: { type: 'rule', ref: id }, evidenceSql: 'SELECT 1', retryCount: 0, ...over,
  };
}
const ben = (n: string, over: Partial<Candidate> = {}) => cand(`benefit-${n}`, 'benefit', 'benefits', over);
const disc = (n: number) => cand(`discount-${n}`, 'discount', 'fine_print_court', { amountCents: 1000 });
const fillers = () => ({
  approvedGeneralOffers: [disc(1), disc(2), disc(3)],
  federalBenefits: [ben('a', { amountCents: 100 }), ben('b', { amountCents: 200 })],
});

describe('assembleFeed', () => {
  it('empty input still meets every minimum, with the exact empty-state copy', () => {
    const { cards } = assembleFeed([], leo, 0, fillers(), TODAY);
    const of = (k: string) => cards.filter((c) => c.kind === k);
    expect(of('benefit').length).toBeGreaterThanOrEqual(2);
    expect(of('recall')).toHaveLength(1);
    expect(of('recall')[0].body).toBe('Connect your data to safety-check your items.');
    expect(of('discount').length).toBeGreaterThanOrEqual(3);
    expect(of('clawback')).toHaveLength(1);
    expect(of('clawback')[0].body).toBe('No money to claw back yet. Connect a card or upload Amazon orders.');
    expect(of('coming_soon').map((c) => c.title)).toEqual(['Pre-filled applications', "We'll watch for price drops"]);
  });

  it('data connected, no clawbacks: doing-great copy', () => {
    const { cards } = assembleFeed([], maya, 5, fillers(), TODAY);
    expect(cards.find((c) => c.kind === 'clawback')!.body).toBe("Nothing to claw back: you're doing great.");
  });

  it('all clear names the number of items checked', () => {
    const { cards } = assembleFeed([], maya, 23, fillers(), TODAY);
    const r = cards.find((c) => c.kind === 'recall')!;
    expect(r.body).toBe('We checked 23 items: all clear.');
    expect(r.verdict).toBe('all_clear');
  });

  it('orders insurance first, then clawback, recall, benefit, discount, coming_soon; builds the split receipt', () => {
    const verified = [
      disc(1), disc(2), disc(3),
      ben('tax', { amountCents: 220000 }),
      ben('x', { amountCents: 50, deadline: '2026-10-10' }),
      cand('benefit-insurance_add_baby', 'benefit', 'benefits', { deadline: '2026-11-02' }),
      cand('benefit-pfml', 'benefit', 'benefits', { deadline: '2027-10-03' }),
      cand('clawback-1', 'clawback', 'clawback', { amountCents: 5000, claim: { type: 'fsa_reimbursement', txId: 't1', txAmountCents: 5000 } }),
      cand('clawback-2', 'clawback', 'clawback', { amountCents: 700, verdict: 'blocked' }),
    ];
    const { cards, receipt } = assembleFeed(verified, maya, 12, fillers(), TODAY);
    expect(cards[0].id).toBe('benefit-insurance_add_baby');
    const kinds = cards.map((c) => c.kind);
    const order = ['clawback', 'recall', 'benefit', 'discount', 'coming_soon'];
    const rest = kinds.slice(1);
    expect([...rest].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(rest);
    expect(receipt).toEqual({
      moneyBackCents: 5000, likelyBenefitsCents: 220000 + 50,
      deadlineCount: 2, nextDeadline: '2026-11-02', itemsChecked: 12,
    });
  });

  it('I1: deadline count and next deadline ignore unverified stand-ins (same filter as the totals)', () => {
    const insuranceFiller = cand('fallback-benefit-insurance_add_baby', 'benefit', 'fallback', { verdict: 'info', deadline: '2026-11-02' });
    const dcfsaFiller = cand('fallback-benefit-dcfsa_life_event', 'benefit', 'fallback', { verdict: 'info', deadline: '2026-11-05' });
    const { cards, receipt } = assembleFeed([], maya, 0, { approvedGeneralOffers: [], federalBenefits: [insuranceFiller, dcfsaFiller] }, TODAY);
    expect(cards.map((c) => c.id)).toEqual(expect.arrayContaining(['fallback-benefit-insurance_add_baby']));
    expect(receipt.deadlineCount).toBe(0);
    expect(receipt.nextDeadline).toBeNull();
    expect(receipt.likelyBenefitsCents).toBe(0);
  });

  it('M2: only fsa_reimbursement and price_adjustment cards count as money back', () => {
    const { receipt } = assembleFeed([
      cand('clawback-x', 'clawback', 'clawback', { amountCents: 1234, claim: { type: 'clawback', txId: 'x', txAmountCents: 1234 } }),
      cand('clawback-price-y', 'clawback', 'clawback', { amountCents: 2000, claim: { type: 'price_adjustment', txId: 'y', txAmountCents: 9000 } }),
    ], maya, 3, fillers(), TODAY);
    expect(receipt.moneyBackCents).toBe(2000);
  });

  it('does not duplicate a filler already verified', () => {
    const f = fillers();
    const { cards } = assembleFeed([f.federalBenefits[0], ben('c'), ben('d')], maya, 1, f, TODAY);
    expect(cards.filter((c) => c.id === 'benefit-a')).toHaveLength(1);
  });
});

function useFakeCheckWithCorrections() {
  (court.lessonIdsFor as jest.Mock).mockReturnValue([]);
  useFake(fc);
}

function setup(opts: { family?: Family; verify?: (c: Candidate) => any } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orch-'));
  const family = opts.family ?? maya;
  (clawback.findClawbacks as jest.Mock).mockResolvedValue([]);
  (recall.checkRecalls as jest.Mock).mockResolvedValue({ candidates: [], itemsChecked: 9 });
  (benefits.planBenefits as jest.Mock).mockResolvedValue([ben('a', { amountCents: 100 }), ben('b', { amountCents: 200 })]);
  (court.judgeOffers as jest.Mock).mockResolvedValue([disc(1), disc(2), disc(3)]);
  (fc.verify as jest.Mock).mockImplementation(async (c: Candidate) => (opts.verify ? opts.verify(c) : { ok: true, reason: null, corrected: null }));
  useFakeCheckWithCorrections();
  const z = { runQuery: jest.fn(async () => ({ headers: [], rows: [], ms: 1 })) } as any;
  const memory = { exportLedger: jest.fn((f: string) => fs.writeFileSync(f, '')), recallRules: jest.fn(() => []) } as any;
  const deps = { z, llm: new FakeGenerator([]), memory, loadFamily: async () => family, logsDir: dir, today: TODAY };
  return { dir, deps, memory };
}

describe('Receipt honesty (maya-like)', () => {
  it('DCFSA card is shown but excluded from both totals: moneyBack = 2899 + 2000', () => {
    const verified = [
      cand('clawback-fsa-maya-tx-01', 'clawback', 'clawback', { amountCents: 2899, claim: { type: 'fsa_reimbursement', txId: 'tx-01', txAmountCents: 2899 } }),
      cand('clawback-price-maya-tx-02', 'clawback', 'clawback', { amountCents: 2000, claim: { type: 'price_adjustment', txId: 'tx-02', txAmountCents: 9000 } }),
      cand('clawback-dcfsa-maya-2026', 'clawback', 'clawback', { amountCents: 555000, claim: { type: 'dcfsa_childcare', txId: 'tx-9', txAmountCents: 1, planYear: 2026 } }),
      ben('a', { amountCents: 100 }), ben('b', { amountCents: 200 }),
    ];
    const { cards, receipt } = assembleFeed(verified, maya, 7, fillers(), TODAY);
    expect(cards.find((c) => c.id === 'clawback-dcfsa-maya-2026')).toBeDefined();
    expect(receipt.moneyBackCents).toBe(4899);
    expect(receipt.likelyBenefitsCents).toBe(300);
  });
});

describe('runBundle', () => {
  it('I1: when the benefits agent fails, the insurance stand-in does not reach the Receipt deadlines', async () => {
    const { deps } = setup();
    (benefits.planBenefits as jest.Mock).mockRejectedValue(new Error('boom'));
    const r = await runBundle('maya', deps);
    expect(r.cards.some((c) => c.id.startsWith('fallback-benefit-'))).toBe(true);
    expect(r.receipt.deadlineCount).toBe(0);
    expect(r.receipt.nextDeadline).toBeNull();
  });

  it('I4: a typed-in family triggers no purchase lookup (nothing saved to look up)', async () => {
    const guest: Family = { ...maya, id: 'guest-ab12cd34', isGuest: true, dataConnected: false, annualIncomeCents: null };
    const { deps } = setup({ family: guest });
    const r = await runBundle(guest.id, deps);
    expect(deps.z.runQuery).not.toHaveBeenCalled();
    expect(r.banner).toBeNull();
    expect(r.cards.length).toBeGreaterThanOrEqual(9);
  });

  it('survives ZetarisUnavailable on recalls: banner set, minimums met', async () => {
    const { deps } = setup();
    (recall.checkRecalls as jest.Mock).mockRejectedValue(new ZetarisUnavailable('down'));
    const r = await runBundle('maya', deps);
    expect(r.banner).toBe("Some sources didn't respond: showing what we could check.");
    expect(r.cards.filter((c) => c.kind === 'recall')).toHaveLength(1);
    expect(r.cards.filter((c) => c.kind === 'benefit').length).toBeGreaterThanOrEqual(2);
    expect(r.cards.filter((c) => c.kind === 'discount').length).toBeGreaterThanOrEqual(3);
    expect(BANNER).toBe(r.banner);
  });

  it('retries an agent once after a transient Zetaris Thrift error', async () => {
    const { deps } = setup();
    (recall.checkRecalls as jest.Mock)
      .mockRejectedValueOnce(new Error('Zetaris rejected the query (HTTP 400): TTransportException thrift'))
      .mockResolvedValue({ candidates: [], itemsChecked: 4 });
    const r = await runBundle('maya', deps);
    expect(r.banner).toBeNull();
    expect(r.receipt.itemsChecked).toBe(4);
  });

  it('no banner when everything answers; exports the ledger', async () => {
    const { deps, memory, dir } = setup();
    const r = await runBundle('maya', deps);
    expect(r.banner).toBeNull();
    expect(memory.exportLedger).toHaveBeenCalledTimes(1);
    expect(fs.readdirSync(dir).some((f) => f.startsWith('ledger-'))).toBe(true);
    expect(r.receipt.itemsChecked).toBe(9);
  });

  it('a filler offer the court rejected never appears (only court output is used)', async () => {
    const { deps } = setup();
    (court.judgeOffers as jest.Mock).mockResolvedValue([disc(1), disc(2), disc(3)]);
    const r = await runBundle('maya', deps);
    expect(r.cards.filter((c) => c.kind === 'discount').map((c) => c.id).sort()).toEqual(['discount-1', 'discount-2', 'discount-3']);
    expect((court.judgeOffers as jest.Mock).mock.calls[0][1].includeGeneral).toBe(true);
  });

  it('exposes court-blocked offers in result.blocked, outside cards and the Receipt', async () => {
    const { deps } = setup();
    const withoutBlocked = await runBundle('maya', deps);
    (court.judgeOffers as jest.Mock).mockImplementation(async (ctx: any) => {
      ctx.blocked.push({ id: 'blocked-9', kind: 'discount', title: 'Trap box', body: 'Auto-renews.', amountCents: null, deadline: null, verdict: 'blocked', sources: [], traceId: 't' });
      return [disc(1), disc(2), disc(3)];
    });
    const r = await runBundle('maya', deps);
    expect(r.blocked!.map((c) => c.id)).toEqual(['blocked-9']);
    expect(r.cards.some((c) => c.verdict === 'blocked' || c.id === 'blocked-9')).toBe(false);
    expect(r.receipt).toEqual(withoutBlocked.receipt);
    expect(JSON.stringify(r.blocked)).not.toMatch(/income/i);
  });

  it('a candidate failing fact-check 3 times is dropped after 2 retries and traced as blocked', async () => {
    const bad = ben('bad', { amountCents: 999 });
    const { deps, dir } = setup({ verify: (c) => (c.id === 'benefit-bad' ? { ok: false, reason: 'amount mismatch', corrected: { amountCents: 1 } } : { ok: true, reason: null, corrected: null }) });
    (benefits.planBenefits as jest.Mock).mockResolvedValue([bad, ben('a'), ben('b')]);
    (benefits.revise as jest.Mock).mockImplementation(async (c: Candidate) => ({ ...c, retryCount: c.retryCount + 1 }));
    const r = await runBundle('maya', deps);
    expect(r.cards.find((c) => c.id === 'benefit-bad')).toBeUndefined();
    expect(benefits.revise).toHaveBeenCalledTimes(2);
    expect((benefits.revise as jest.Mock).mock.calls[0][1]).toContain('amount mismatch');
    expect((benefits.revise as jest.Mock).mock.calls[0][1]).toContain('amountCents');
    const file = fs.readdirSync(dir).find((f) => f.startsWith('run-'))!;
    const lines = fs.readFileSync(path.join(dir, file), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    const blocked = lines.find((l) => l.status === 'blocked' && l.retry_count === 2);
    expect(blocked).toBeTruthy();
    expect(blocked.input_summary).toContain('benefit-bad');
  });

  it('fact-check outage: banner, no send-back, card dropped, one verify call each', async () => {
    const { deps } = setup({ verify: () => ({ ok: false, reason: 'could not verify: Zetaris unreachable or timed out', corrected: null, unavailable: true }) });
    const r = await runBundle('maya', deps);
    expect(r.banner).toBe(BANNER);
    expect(benefits.revise).not.toHaveBeenCalled();
    expect(court.revise).not.toHaveBeenCalled();
    expect(fc.verify).toHaveBeenCalledTimes(5); // 2 benefits + 3 offers, once each
    expect(r.cards.filter((c) => c.kind === 'benefit').length).toBeGreaterThanOrEqual(2);
    expect(r.cards.filter((c) => c.kind === 'discount').length).toBeGreaterThanOrEqual(3);
    expect(r.cards.filter((c) => c.verdict === 'likely' || c.verdict === 'verified')).toHaveLength(0);
  });

  it('benefits AND court both fail: minimums hold from bundled fallbacks, marked info, outside the Receipt', async () => {
    const { deps } = setup();
    (benefits.planBenefits as jest.Mock).mockRejectedValue(new ZetarisUnavailable('down'));
    (court.judgeOffers as jest.Mock).mockRejectedValue(new ZetarisUnavailable('down'));
    const r = await runBundle('maya', deps);
    expect(r.banner).toBe(BANNER);
    const ben = r.cards.filter((c) => c.kind === 'benefit');
    const dis = r.cards.filter((c) => c.kind === 'discount');
    expect(ben.length).toBeGreaterThanOrEqual(2);
    expect(dis.length).toBeGreaterThanOrEqual(3);
    for (const c of [...ben, ...dis]) {
      expect(c.verdict).toBe('info');
      expect(c.body).toContain("Not yet verified: some sources didn't respond.");
      expect(c.sources[0].url).toMatch(/^https:/);
    }
    expect(dis.some((c) => /Cuddle/i.test(c.title))).toBe(false);
    expect(r.receipt.likelyBenefitsCents).toBe(0);
    expect(r.receipt.moneyBackCents).toBe(0);
  });

  it('a transient Thrift error during fact-check is retried once', async () => {
    let n = 0;
    const { deps } = setup({ verify: (c) => (c.id === 'benefit-a' && n++ === 0 ? { ok: false, reason: 'could not verify: Thrift TTransportException', corrected: null, unavailable: true } : { ok: true, reason: null, corrected: null }) });
    const r = await runBundle('maya', deps);
    expect(r.banner).toBeNull();
    expect(r.cards.find((c) => c.id === 'benefit-a')).toBeDefined();
  });

  it('invalid MAX_RETRIES falls back to 2; a weird family id is made file-safe', async () => {
    process.env.MAX_RETRIES = '-1';
    const { deps, dir } = setup();
    (benefits.planBenefits as jest.Mock).mockResolvedValue([ben('bad'), ben('a'), ben('b')]);
    (fc.verify as jest.Mock).mockImplementation(async (c: Candidate) => (c.id === 'benefit-bad' ? { ok: false, reason: 'x', corrected: null } : { ok: true, reason: null, corrected: null }));
    (benefits.revise as jest.Mock).mockImplementation(async (c: Candidate) => c);
    try {
      const r = await runBundle('maya/../x', { ...deps, loadFamily: async () => maya });
      expect(r.runId).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(benefits.revise).toHaveBeenCalledTimes(2);
      expect(fs.readdirSync(dir).every((f) => /^[A-Za-z0-9_.-]+$/.test(f))).toBe(true);
    } finally {
      delete process.env.MAX_RETRIES;
    }
  });

  it('a candidate fixed by revise is kept', async () => {
    let n = 0;
    const { deps } = setup({ verify: (c) => (c.id === 'benefit-fix' && n++ === 0 ? { ok: false, reason: 'wrong', corrected: null } : { ok: true, reason: null, corrected: null }) });
    (benefits.planBenefits as jest.Mock).mockResolvedValue([ben('fix'), ben('a'), ben('b')]);
    (benefits.revise as jest.Mock).mockImplementation(async (c: Candidate) => ({ ...c, retryCount: 1 }));
    const r = await runBundle('maya', deps);
    expect(r.cards.find((c) => c.id === 'benefit-fix')).toBeDefined();
  });
});

describe('runBundle wiring (W4-ORCH)', () => {
  const sampleScore = { trueValueCents: 900, effortLevel: 'low', effortMinutesEstimate: { min: 1, max: 5 }, stepsCount: 2, payoutWaitDays: null, timeLabel: 'right away', catchTypes: [], worthYourTime: true, reasons: ['ok'] } as const;

  it('gives every agent a shared Workspace and the offer-check writer from deps', async () => {
    const { deps } = setup();
    const writer = { insert: jest.fn(async () => '1') };
    await runBundle('maya', { ...deps, offerChecks: writer });
    for (const fn of [clawback.findClawbacks, recall.checkRecalls, benefits.planBenefits, court.judgeOffers]) {
      const ctx = (fn as jest.Mock).mock.calls[0][0];
      expect(ctx.workspace).toBeInstanceOf(Workspace);
      expect(ctx.offerChecks).toBe(writer);
    }
    const spaces = [clawback.findClawbacks, benefits.planBenefits, court.judgeOffers].map((f) => (f as jest.Mock).mock.calls[0][0].workspace);
    expect(new Set(spaces).size).toBe(1);
  });

  it('leaves offerChecks empty when deps has no writer', async () => {
    const { deps } = setup();
    await runBundle('maya', deps);
    expect((court.judgeOffers as jest.Mock).mock.calls[0][0].offerChecks).toBeUndefined();
  });

  it('opens the workspace in the run trace', async () => {
    const { deps, dir } = setup();
    await runBundle('maya', deps);
    const file = fs.readdirSync(dir).find((f) => f.startsWith('run-'))!;
    expect(fs.readFileSync(path.join(dir, file), 'utf8')).toContain('workspace_open');
  });

  it('labels each agent in the trace: z and memory get withTrace(trace, agentName)', async () => {
    const { deps } = setup();
    const z: any = { runQuery: jest.fn(async () => ({ headers: [], rows: [], ms: 1 })) };
    z.withTrace = jest.fn((_t: unknown, name?: string) => ({ ...z, who: name }));
    const memory: any = { exportLedger: jest.fn(), withTrace: jest.fn((_t: unknown, name?: string) => ({ exportLedger: jest.fn(), who: name })) };
    await runBundle('maya', { ...deps, z, memory });
    const who = (fn: unknown) => (fn as jest.Mock).mock.calls[0][0].z.who;
    expect(who(clawback.findClawbacks)).toBe('clawback');
    expect(who(recall.checkRecalls)).toBe('recall');
    expect(who(benefits.planBenefits)).toBe('benefits');
    expect(who(court.judgeOffers)).toBe('fine_print_court');
    expect((court.judgeOffers as jest.Mock).mock.calls[0][0].memory.who).toBe('fine_print_court');
  });

  it('checks every card with checkWithCorrections and hands benefits a reviser (with today)', async () => {
    const { deps } = setup();
    await runBundle('maya', deps);
    expect(fc.checkWithCorrections).toHaveBeenCalledTimes(5);
    const [card, , revise] = (fc.checkWithCorrections as jest.Mock).mock.calls.find((c) => c[0].id === 'benefit-a')!;
    (benefits.revise as jest.Mock).mockResolvedValue(card);
    await revise(card, 'because');
    const call = (benefits.revise as jest.Mock).mock.calls.pop()!;
    expect(call[1]).toBe('because');
    expect(call[2].workspace).toBeInstanceOf(Workspace);
    expect(call[3]).toBe(TODAY);
  });

  it('passes the lessons a discount card relied on to the checker', async () => {
    const { deps } = setup();
    (court.lessonIdsFor as jest.Mock).mockImplementation((_ctx: unknown, id: string) => (id === 'discount-1' ? ['lesson-x'] : []));
    await runBundle('maya', deps);
    const calls = (fc.checkWithCorrections as jest.Mock).mock.calls;
    expect(calls.find((c) => c[0].id === 'discount-1')![3].lessonIds).toEqual(['lesson-x']);
    expect(calls.find((c) => c[0].id === 'discount-2')![3].lessonIds).toEqual([]);
    expect(calls.find((c) => c[0].id === 'benefit-a')![3].lessonIds).toEqual([]);
  });

  it('a card that cannot be fixed logs reject_card and is dropped; approved ones log approve_card', async () => {
    const { deps, dir } = setup({ verify: (c) => (c.id === 'benefit-bad' ? { ok: false, reason: 'no', corrected: null } : { ok: true, reason: null, corrected: null }) });
    (benefits.planBenefits as jest.Mock).mockResolvedValue([ben('bad'), ben('a'), ben('b')]);
    (benefits.revise as jest.Mock).mockResolvedValue(null);
    const r = await runBundle('maya', deps);
    expect(r.cards.find((c) => c.id === 'benefit-bad')).toBeUndefined();
    const file = fs.readdirSync(dir).find((f) => f.startsWith('run-'))!;
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    expect(text).toContain('approve_card');
    expect(text).toContain('reject_card');
  });

  it('streams agent status and approved cards to the event hub, then finishes the run', async () => {
    const { deps } = setup();
    const events = new RunEventHub();
    const r = await runBundle('maya', { ...deps, runId: 'maya-evt', events });
    const seen = events.history('maya-evt');
    expect(events.isFinished('maya-evt')).toBe(true);
    const states = seen.filter((e) => e.type === 'agent_status') as any[];
    for (const agent of ['clawback', 'recall', 'benefits', 'fine_print_court']) {
      expect(states.filter((e) => e.agent === agent).map((e) => e.state)).toEqual(['working', 'done']);
    }
    const ready = seen.filter((e) => e.type === 'card_ready').map((e: any) => e.card.id).sort();
    expect(ready).toEqual(['benefit-a', 'benefit-b', 'discount-1', 'discount-2', 'discount-3']);
    expect(r.runId).toBe('maya-evt');
  });

  it('marks a failed agent as failed, announces a dropped card, and still finishes', async () => {
    const { deps } = setup({ verify: (c) => (c.id === 'benefit-a' ? { ok: false, reason: 'nope', corrected: null, unavailable: true } : { ok: true, reason: null, corrected: null }) });
    (recall.checkRecalls as jest.Mock).mockRejectedValue(new Error('boom'));
    const events = new RunEventHub();
    await runBundle('maya', { ...deps, runId: 'maya-evt2', events });
    const seen = events.history('maya-evt2') as any[];
    expect(seen.find((e) => e.type === 'agent_status' && e.agent === 'recall' && e.state === 'failed')).toBeTruthy();
    expect(seen.find((e) => e.type === 'card_removed' && e.cardId === 'benefit-a')).toBeTruthy();
    expect(events.isFinished('maya-evt2')).toBe(true);
  });

  it('finishes the event stream even when the run throws', async () => {
    const { deps } = setup();
    const events = new RunEventHub();
    await expect(runBundle('maya', { ...deps, runId: 'maya-evt3', events, loadFamily: async () => { throw new Error('no family'); } })).rejects.toThrow('no family');
    expect(events.isFinished('maya-evt3')).toBe(true);
  });

  it('sets stateNote only when the family state has no programs on file', async () => {
    const { deps } = setup();
    (benefits.planBenefits as jest.Mock).mockImplementation(async (ctx: any) => { ctx.stateCovered = false; return [ben('a'), ben('b')]; });
    const uncovered = await runBundle('maya', deps);
    expect(uncovered.stateNote).toBe(UNCOVERED_STATE_NOTE);
    (benefits.planBenefits as jest.Mock).mockImplementation(async (ctx: any) => { ctx.stateCovered = true; return [ben('a'), ben('b')]; });
    expect((await runBundle('maya', deps)).stateNote).toBeUndefined();
    (benefits.planBenefits as jest.Mock).mockRejectedValue(new Error('down'));
    expect((await runBundle('maya', deps)).stateNote).toBeUndefined(); // unknown is not "uncovered"
  });

  it('copies valueScore onto the feed card', () => {
    const { cards } = assembleFeed([cand('discount-9', 'discount', 'fine_print_court', { valueScore: sampleScore as any })], maya, 0, fillers(), TODAY);
    expect(cards.find((c) => c.id === 'discount-9')!.valueScore).toEqual(sampleScore);
    expect('valueScore' in cards.find((c) => c.id === 'benefit-a')!).toBe(false);
  });
});

describe('run clock resets per family run', () => {
  afterEach(() => { jest.restoreAllMocks(); });

  it('two runs more than 300 s apart both get real AI answers (no stale deadline)', async () => {
    let now = Date.parse('2026-10-24T12:00:00Z');
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const okClient = { chat: { completions: { create: jest.fn().mockResolvedValue({ choices: [{ message: { content: 'ok' } }] }) } } };
    const provider = new OpenAICompatGenerator('k', 'http://x', { reasoning: 'r', fast: 'f' }, okClient, 1000, { provider: 'nvidia', runDeadlineMs: 300_000, retryDelayMs: 0 });
    const chain = new ChainGenerator([provider], { runDeadlineMs: 300_000 });
    const { deps } = setup();
    const answers: string[] = [];
    (benefits.planBenefits as jest.Mock).mockImplementation(async (ctx: { llm: { generate(p: string): Promise<string> } }) => {
      answers.push(await ctx.llm.generate('q').catch((e: { reason?: string }) => `failed:${e.reason}`));
      return [ben('a', { amountCents: 100 }), ben('b', { amountCents: 200 })];
    });
    now += 10_000;
    await runBundle('maya', { ...deps, llm: chain });
    now += 400_000; // more than the 300 s run limit after the first run started
    await runBundle('maya', { ...deps, llm: chain });
    expect(answers).toEqual(['ok', 'ok']);
  });

  it('LIVE_MODEL=true with SAMPLE_MODE=true picks the live chain generator', () => {
    const keys = ['SAMPLE_MODE', 'LIVE_MODEL', 'MODEL_PROVIDER', 'NIGHTSHIFT_TOKEN', 'NIGHTSHIFT_TOKEN_FILE', 'MODEL_API_KEY', 'MODEL_REASONING', 'MODEL_FAST'];
    const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    try {
      Object.assign(process.env, { SAMPLE_MODE: 'true', LIVE_MODEL: 'true', MODEL_PROVIDER: 'auto', NIGHTSHIFT_TOKEN: 'fake-token', MODEL_API_KEY: 'fake-key', MODEL_REASONING: 'r', MODEL_FAST: 'f' });
      delete process.env.NIGHTSHIFT_TOKEN_FILE;
      expect(makeGenerator()).toBeInstanceOf(ChainGenerator);
      process.env.LIVE_MODEL = 'false';
      expect(makeGenerator()).not.toBeInstanceOf(ChainGenerator);
    } finally {
      for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    }
  });
});

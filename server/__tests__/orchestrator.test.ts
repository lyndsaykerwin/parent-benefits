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
import { ZetarisUnavailable } from '../adapters/zetaris';
import { FakeGenerator } from '../adapters/llm';
import type { Candidate } from '../agents/types';
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
      cand('clawback-1', 'clawback', 'clawback', { amountCents: 5000 }),
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

  it('does not duplicate a filler already verified', () => {
    const f = fillers();
    const { cards } = assembleFeed([f.federalBenefits[0], ben('c'), ben('d')], maya, 1, f, TODAY);
    expect(cards.filter((c) => c.id === 'benefit-a')).toHaveLength(1);
  });
});

function setup(opts: { family?: Family; verify?: (c: Candidate) => any } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orch-'));
  const family = opts.family ?? maya;
  (clawback.findClawbacks as jest.Mock).mockResolvedValue([]);
  (recall.checkRecalls as jest.Mock).mockResolvedValue({ candidates: [], itemsChecked: 9 });
  (benefits.planBenefits as jest.Mock).mockResolvedValue([ben('a', { amountCents: 100 }), ben('b', { amountCents: 200 })]);
  (court.judgeOffers as jest.Mock).mockResolvedValue([disc(1), disc(2), disc(3)]);
  (fc.verify as jest.Mock).mockImplementation(async (c: Candidate) => (opts.verify ? opts.verify(c) : { ok: true, reason: null, corrected: null }));
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

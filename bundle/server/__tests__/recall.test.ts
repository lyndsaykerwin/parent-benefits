import os from 'os';
import fs from 'fs';
import path from 'path';
import { checkRecalls, revise } from '../agents/recall';
import { TraceLogger } from '../agents/trace';
import { FakeGenerator, UnavailableGenerator } from '../adapters/llm';
import type { AgentContext } from '../agents/types';

const maya = {
  id: 'maya', userId: null, isGuest: true, name: 'Maya', birthDate: '2026-10-03', dueDate: null,
  zip: '02139', state: 'MA', employer: 'Northwind', householdSize: 3, annualIncomeCents: 14500000,
  dcfsaOffered: true, dataConnected: true,
};
const leo = { ...maya, id: 'leo', dcfsaOffered: false, dataConnected: false };
const res = (rows: any[]) => ({ headers: Object.keys(rows[0] ?? {}), rows, ms: 1 });

// Maya's purchases: 3 Amazon orders + distinct card items (refund excluded, Walgreens pair counted once).
const ITEMS = [
  { item_text: 'KEAWIS Crib Mattress, Dual-Sided Firm Baby Mattress', source: 'amazon' },
  { item_text: 'Aden + Anais Muslin Swaddle Blankets, 4 Pack', source: 'amazon' },
  { item_text: 'Hatch Baby Rest Sound Machine and Night Light', source: 'amazon' },
  { item_text: 'Frida baby thermometer', source: 'card' },
  { item_text: 'Pampers Swaddlers newborn diapers', source: 'card' },
];
const CPSC_PAIR = {
  item_text: 'KEAWIS Crib Mattress, Dual-Sided Firm Baby Mattress', purchased_on: '2026-09-10', source: 'amazon',
  recall_source: 'cpsc', recall_id: 10560, recall_number: '26191', recall_date: '2026-01-15',
  recall_title: 'Yixing Trading Recalls KEAWIS Crib Mattresses Due to Risk of Serious Injury or Death from Entrapment and Suffocation',
  recall_url: 'https://www.cpsc.gov/Recalls/2026/Yixing-Trading-Recalls-KEAWIS-Crib-Mattresses', recalled_product: 'KEAWIS Crib Mattress',
};
// A loose token match that is NOT the same product (the model must say no).
const LOOSE_PAIR = {
  item_text: 'Hatch Baby Rest Sound Machine and Night Light', purchased_on: '2026-10-02', source: 'amazon',
  recall_source: 'cpsc', recall_id: 777, recall_number: '25001', recall_date: '2026-02-01',
  recall_title: 'Acme Recalls Baby Night Lights', recall_url: 'https://www.cpsc.gov/Recalls/2026/acme', recalled_product: 'Acme Baby Night Light',
};
const FDA_PAIR = {
  item_text: 'Enfamil NeuroPro infant formula', purchased_on: '2026-09-02', source: 'card',
  recall_source: 'fda', recall_id: null, recall_number: 'F-0123-2026', recall_date: '2026-03-04',
  recall_title: 'Infant formula recall', recall_url: 'https://www.fda.gov/safety/recalls', recalled_product: 'Enfamil NeuroPro Infant Formula powder 12.5 oz',
};

function ctxWith(family: any, items: any[], pairs: any[], llm: any) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-'));
  const trace = new TraceLogger('t', dir);
  const runQuery = jest.fn(async (sql: string) => {
    if (sql.includes("= 'terminated'")) return { headers: ['recall_number'], rows: [], ms: 1 };
    if (sql.includes('LATERAL VIEW')) return res(pairs);
    if (sql.includes('v_recall_orders')) return res(items);
    throw new Error('unexpected sql ' + sql);
  });
  const ctx = { runId: 't', family, z: { runQuery } as any, llm, memory: {} as any, trace } as AgentContext;
  return { ctx, runQuery };
}
const yes = () => new FakeGenerator([JSON.stringify({ same: true })]);
const no = () => new FakeGenerator([JSON.stringify({ same: false })]);

describe('recall checker', () => {
  it('maya: 1 KEAWIS recall candidate; itemsChecked is her distinct purchase items', async () => {
    const llm = new FakeGenerator([JSON.stringify({ same: false })]);
    const { ctx } = ctxWith(maya, ITEMS, [CPSC_PAIR, LOOSE_PAIR], llm);
    const out = await checkRecalls(ctx);
    expect(out.itemsChecked).toBe(5);
    expect(out.candidates).toHaveLength(1);
    const c = out.candidates[0];
    expect(c.kind).toBe('recall');
    expect(c.claim).toMatchObject({ type: 'recall', recallId: 10560 });
    expect(c.title).toContain('KEAWIS');
    expect(c.sources[0].url).toContain('cpsc.gov');
    expect(c.amountCents).toBeNull();
    expect(c.agent).toBe('recall');
  });

  it('leo (no purchases): no candidates, itemsChecked 0, and no recall query needed', async () => {
    const { ctx, runQuery } = ctxWith(leo, [], [], yes());
    expect(await checkRecalls(ctx)).toEqual({ candidates: [], itemsChecked: 0 });
    expect(runQuery.mock.calls.some((c) => String(c[0]).includes('LATERAL VIEW'))).toBe(false);
  });

  it('ordinary items with no pairs give no candidates but still count', async () => {
    const { ctx } = ctxWith(maya, ITEMS, [], yes());
    const out = await checkRecalls(ctx);
    expect(out.candidates).toEqual([]);
    expect(out.itemsChecked).toBe(5);
  });

  it('without a model, accepts only exact product-name containment (KEAWIS yes, loose match no)', async () => {
    const { ctx } = ctxWith(maya, ITEMS, [CPSC_PAIR, LOOSE_PAIR, FDA_PAIR], new UnavailableGenerator('off'));
    const out = await checkRecalls(ctx);
    expect(out.candidates.map((c) => c.claim.recallId)).toEqual([10560]);
  });

  it('an exact product-name match is accepted without asking the model, even if the model would say no', async () => {
    const llm = no();
    const { ctx } = ctxWith(maya, ITEMS, [CPSC_PAIR], llm);
    const out = await checkRecalls(ctx);
    expect(out.candidates).toHaveLength(1);
    expect(out.candidates[0].verdict).toBe('verified');
    expect(llm.prompts.some((p) => p.includes('SAME product'))).toBe(false);
  });

  it('a loose pair accepted by the model is only likely', async () => {
    const { ctx } = ctxWith(maya, ITEMS, [LOOSE_PAIR], yes());
    const out = await checkRecalls(ctx);
    expect(out.candidates[0].verdict).toBe('likely');
  });

  it('keeps every exact pair even when 30 noise pairs sort ahead of it', async () => {
    const noise = Array.from({ length: 30 }, (_, i) => ({ ...LOOSE_PAIR, recall_id: 1000 + i, recalled_product: `Noise Product ${i}` }));
    const { ctx } = ctxWith(maya, ITEMS, [...noise, CPSC_PAIR], no());
    const out = await checkRecalls(ctx);
    expect(out.candidates.map((c) => c.claim.recallId)).toEqual([10560]);
  });

  it('item list leaves out services and generic categories (daycare, groceries) but keeps products', async () => {
    const { ctx, runQuery } = ctxWith(maya, ITEMS, [], yes());
    await checkRecalls(ctx);
    const sql = String(runQuery.mock.calls[0][0]);
    expect(sql).toContain("lower(category) LIKE '%daycare%'");
    expect(sql).toContain("'groceries'");
  });

  it('an FDA match carries recallSource fda and the recall number', async () => {
    const { ctx } = ctxWith(maya, ITEMS, [FDA_PAIR], yes());
    const c = (await checkRecalls(ctx)).candidates[0];
    expect(c.claim).toMatchObject({ type: 'recall', recallSource: 'fda', recallNumber: 'F-0123-2026' });
  });

  it('one card per recall even if two items hit it', async () => {
    const two = [CPSC_PAIR, { ...CPSC_PAIR, item_text: 'KEAWIS Crib Mattress 2nd' }];
    const { ctx } = ctxWith(maya, ITEMS, two, yes());
    expect((await checkRecalls(ctx)).candidates).toHaveLength(1);
  });

  it('keeps the join in one Zetaris query: LATERAL VIEW inside a subquery, FDA dates normalised, no trailing semicolon', async () => {
    const { ctx, runQuery } = ctxWith(maya, ITEMS, [], yes());
    await checkRecalls(ctx);
    const sqls = runQuery.mock.calls.map((c) => String(c[0]));
    const pair = sqls.find((s) => s.includes('LATERAL VIEW'))!;
    expect(pair).toMatch(/FROM \(SELECT[^]*LATERAL VIEW explode\(Products\)/);
    expect(pair).toContain('fda_food_recalls');
    expect(pair).toContain('recall_initiation_date');
    expect(pair).toContain("family_id = 'maya'");
    for (const s of sqls) expect(s).not.toMatch(/;\s*$/);
  });

  it('refuses an unsafe family id without querying', async () => {
    const { ctx, runQuery } = ctxWith({ ...maya, id: "a'b" }, ITEMS, [CPSC_PAIR], yes());
    expect(await checkRecalls(ctx)).toEqual({ candidates: [], itemsChecked: 0 });
    expect(runQuery).not.toHaveBeenCalled();
  });

  it('revise re-derives the recall, or gives up', async () => {
    const h = ctxWith(maya, ITEMS, [CPSC_PAIR], yes());
    const first = (await checkRecalls(h.ctx)).candidates[0];
    const fixed = await revise({ ...first, title: 'wrong' }, 'source not found', h.ctx);
    expect(fixed?.title).toContain('KEAWIS');
    expect(fixed?.retryCount).toBe(1);
    const gone = ctxWith(maya, ITEMS, [], yes());
    expect(await revise(first, 'source not found', gone.ctx)).toBeNull();
  });
});

describe('I4: typed-in family', () => {
  it('queries nothing and reports 0 items checked', async () => {
    const { ctx, runQuery } = ctxWith({ ...maya, id: 'guest-ab12cd34', dataConnected: false }, ITEMS, [], yes());
    expect(await checkRecalls(ctx)).toEqual({ candidates: [], itemsChecked: 0 });
    expect(runQuery).not.toHaveBeenCalled();
  });
});

describe('W1-RECALL: finished FDA recalls and no false recalls', () => {
  it('finished ("Terminated") FDA recalls are dropped; ongoing FDA recalls stay', async () => {
    const sql = (await import('../agents/recall')).finishedFdaSql();
    expect(sql).toContain('bundle_live.fda_food_recalls');
    expect(sql).toMatch(/lower\(x\.status\) = 'terminated'/);
    const DONE = { ...FDA_PAIR, recall_number: 'H-0891-2026', recalled_product: 'a2 Platinum Premium infant formula', item_text: 'a2 Platinum Premium infant formula' };
    const LIVE = { ...FDA_PAIR, item_text: 'Enfamil NeuroPro Infant Formula powder 12.5 oz' };
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-'));
    const runQuery = jest.fn(async (q: string) => {
      if (q.includes("= 'terminated'")) return res([{ recall_number: 'H-0891-2026' }]);
      if (q.includes('LATERAL VIEW')) return res([DONE, LIVE]);
      return res(ITEMS);
    });
    const ctx = { runId: 't', family: maya, z: { runQuery } as any, llm: new UnavailableGenerator('offline'), memory: {} as any, trace: new TraceLogger('t', dir) } as AgentContext;
    const ids = (await checkRecalls(ctx)).candidates.map((c) => c.id);
    expect(ids).toEqual(['recall-fda-F-0123-2026']);
  });

  it('if the finished-recall list cannot be read, FDA rows are kept (never hide a live recall)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-'));
    const runQuery = jest.fn(async (q: string) => {
      if (q.includes("= 'terminated'")) throw new Error('No saved response for this query');
      if (q.includes('LATERAL VIEW')) return res([{ ...FDA_PAIR, item_text: 'Enfamil NeuroPro Infant Formula powder 12.5 oz' }]);
      return res(ITEMS);
    });
    const ctx = { runId: 't', family: maya, z: { runQuery } as any, llm: new UnavailableGenerator('offline'), memory: {} as any, trace: new TraceLogger('t', dir) } as AgentContext;
    expect((await checkRecalls(ctx)).candidates.map((c) => c.id)).toEqual(['recall-fda-F-0123-2026']);
  });

  it('no_false_recall: Maya never gets CPSC 10490 (Play Yards) or 10453 (Pack N Play pad) without a real match', async () => {
    const shared = (id: number, product: string) => ({
      ...CPSC_PAIR, item_text: 'Graco Pack n Play Portable Playard', recall_id: id, recall_number: String(id),
      recall_title: `Recall ${id}`, recall_url: `https://www.cpsc.gov/${id}`, recalled_product: product,
    });
    const pairs = [CPSC_PAIR, shared(10490, 'Play Yards'), shared(10453, 'Organic Cotton Pack N Play Mattress Dual-Sided Portable Baby Crib Pad')];
    const { ctx } = ctxWith(maya, ITEMS, pairs, new UnavailableGenerator('offline'));
    const { candidates } = await checkRecalls(ctx);
    const ids = candidates.map((c) => c.id);
    expect(ids).toEqual(['recall-cpsc-10560']);
    expect(ids.some((i) => i.includes('10490') || i.includes('10453'))).toBe(false);
  });
});

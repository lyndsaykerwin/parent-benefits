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

// Maya's purchase_items: an email receipt line, receipt-photo lines and item-photo lines (read through v_purchase_items).
const ITEMS = [
  { item_text: 'KEAWIS Crib Mattress, Dual-Sided Firm Baby Mattress', source: 'email' },
  { item_text: 'Aden + Anais Muslin Swaddle Blankets, 4 Pack', source: 'email' },
  { item_text: 'Hatch Baby Rest Sound Machine and Night Light', source: 'email' },
  { item_text: 'Frida baby thermometer', source: 'photo_receipt' },
  { item_text: 'Pampers Swaddlers newborn diapers', source: 'photo_receipt' },
];
const CPSC_PAIR = {
  item_text: 'KEAWIS Crib Mattress, Dual-Sided Firm Baby Mattress', purchased_on: '2026-01-20', source: 'email',
  recall_source: 'cpsc', recall_id: 10560, recall_number: '26191', recall_date: '2026-01-15',
  recall_title: 'Yixing Trading Recalls KEAWIS Crib Mattresses Due to Risk of Serious Injury or Death from Entrapment and Suffocation',
  recall_url: 'https://www.cpsc.gov/Recalls/2026/Yixing-Trading-Recalls-KEAWIS-Crib-Mattresses', recalled_product: 'KEAWIS Crib Mattress',
};
// A loose token match that is NOT the same product (the model must say no).
const LOOSE_PAIR = {
  item_text: 'Hatch Baby Rest Sound Machine and Night Light', purchased_on: '2026-10-02', source: 'email',
  recall_source: 'cpsc', recall_id: 777, recall_number: '25001', recall_date: '2026-02-01',
  recall_title: 'Acme Recalls Baby Night Lights', recall_url: 'https://www.cpsc.gov/Recalls/2026/acme', recalled_product: 'Acme Baby Night Light',
};
const FDA_PAIR = {
  item_text: 'Enfamil NeuroPro infant formula', purchased_on: '2026-09-02', source: 'photo_receipt',
  recall_source: 'fda', recall_id: null, recall_number: 'F-0123-2026', recall_date: '2026-03-04',
  recall_title: 'Infant formula recall', recall_url: 'https://www.fda.gov/safety/recalls', recalled_product: 'Enfamil NeuroPro Infant Formula powder 12.5 oz',
};

function ctxWith(family: any, items: any[], pairs: any[], llm: any, details: any[] | 'throw' = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-'));
  const trace = new TraceLogger('t', dir);
  const runQuery = jest.fn(async (sql: string) => {
    if (sql.includes("= 'terminated'")) return { headers: ['recall_number'], rows: [], ms: 1 };
    if (sql.includes('AS description')) {
      if (details === 'throw') throw new Error('No saved response for this query');
      return res(details);
    }
    if (sql.includes('LATERAL VIEW')) return res(pairs);
    if (sql.includes('v_purchase_items')) return res(items);
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

  it('a loose pair (different brand) is rejected by the fixed rules even if a model would say yes', async () => {
    const llm = yes();
    const { ctx } = ctxWith(maya, ITEMS, [LOOSE_PAIR], llm);
    expect((await checkRecalls(ctx)).candidates).toEqual([]);
    expect(llm.prompts.some((p) => p.includes('SAME product'))).toBe(false);
  });

  it('a same-brand, same-type match with no exact name is accepted by the rules, as likely, with an evidence line', async () => {
    const RULES = { ...CPSC_PAIR, item_text: 'KEAWIS Mini Crib Mattress 38 x 24', recalled_product: 'KEAWIS Crib Mattress' };
    const { ctx } = ctxWith(maya, ITEMS, [RULES], no());
    const c = (await checkRecalls(ctx)).candidates[0];
    expect(c.verdict).toBe('likely');
    expect(c.body).toMatch(/Matched on: .*brand "keawis".*type (mattress|crib)/i);
  });

  it('keeps every exact pair even when 30 noise pairs sort ahead of it', async () => {
    const noise = Array.from({ length: 30 }, (_, i) => ({ ...LOOSE_PAIR, recall_id: 1000 + i, recalled_product: `Noise Product ${i}` }));
    const { ctx } = ctxWith(maya, ITEMS, [...noise, CPSC_PAIR], no());
    const out = await checkRecalls(ctx);
    expect(out.candidates.map((c) => c.claim.recallId)).toEqual([10560]);
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

describe('W2-PURCH: purchase_items is the only purchase source (#8)', () => {
  it('reads only v_purchase_items: no card transactions, Amazon orders or old views, and every query is scoped to the family', async () => {
    const { ctx, runQuery } = ctxWith(maya, ITEMS, [CPSC_PAIR], yes());
    await checkRecalls(ctx);
    const sqls = runQuery.mock.calls.map((c) => String(c[0]));
    // The finished-FDA list and the recall-record query read recall tables only (no family data); every other query reads the view.
    for (const s of sqls.filter((x) => !x.includes("= 'terminated'") && !x.includes('AS description'))) {
      expect(s).toContain('bundle_pg.v_purchase_items');
      expect(s).not.toMatch(/v_recall_orders|v_clawback_tx|transactions|amazon_orders|bank|plaid/i);
    }
    expect(sqls.filter((s) => s.includes('v_purchase_items')).every((s) => s.includes("family_id = 'maya'"))).toBe(true);
  });

  it('the item list sent to Zetaris carries the structured codes (UPC, model number, lot code) and no bank-text category filter', async () => {
    const { itemsSql, pairsSql } = await import('../agents/recall');
    for (const sql of [itemsSql('maya'), pairsSql('maya')]) {
      expect(sql).not.toMatch(/daycare|childcare|groceries|category/i);
    }
    const pairs = pairsSql('maya');
    for (const c of ['upc', 'lot_code', 'model_number']) expect(pairs).toContain(c);
  });

  it('a UPC found in the recall text is an exact match: accepted without the model, with an evidence line', async () => {
    const UPC_PAIR = {
      ...FDA_PAIR, item_text: 'Little Sprout Infant Formula 12.4 oz', upc: '070074123456', lot_code: null, model_number: null,
      recalled_product: 'Brightstar Infant Formula Powder 12.4 oz can UPC 070074123456 lot 26A1234',
    };
    const llm = no();
    const { ctx } = ctxWith(maya, ITEMS, [UPC_PAIR], llm);
    const out = await checkRecalls(ctx);
    expect(out.candidates).toHaveLength(1);
    expect(out.candidates[0].verdict).toBe('verified');
    expect(out.candidates[0].body).toContain('UPC 070074123456');
    expect(llm.prompts.some((p) => p.includes('SAME product'))).toBe(false);
  });

  it('a lot code found in the recall text is an exact match too', async () => {
    const LOT_PAIR = {
      ...FDA_PAIR, item_text: 'Little Sprout Infant Formula 12.4 oz', upc: null, lot_code: '26A1234', model_number: null,
      recalled_product: 'Brightstar Infant Formula Powder 12.4 oz can lot 26A1234 exp 2027',
    };
    const { ctx } = ctxWith(maya, ITEMS, [LOT_PAIR], no());
    const out = await checkRecalls(ctx);
    expect(out.candidates).toHaveLength(1);
    expect(out.candidates[0].body).toContain('lot code 26A1234');
  });

  it('a code that is only a short fragment of another number does not count as a match', async () => {
    const SHORT = { ...FDA_PAIR, item_text: 'Little Sprout Infant Formula', upc: null, lot_code: '12', model_number: null, recalled_product: 'Brightstar Infant Formula lot 1234' };
    const { ctx } = ctxWith(maya, ITEMS, [SHORT], new UnavailableGenerator('off'));
    expect((await checkRecalls(ctx)).candidates).toEqual([]);
  });
});


describe('W3-SAFETY: recallMatch wired in, evidence on every alert, formula lot line', () => {
  const KEA_DETAILS = {
    recall_source: 'cpsc', recall_id: 10560, recall_number: null,
    description: 'This recall involves KEAWIS crib mattresses. Model number "XX-BM-01" is printed on a label.',
    sold_at: 'Online at Amazon.com from August 2024 through July 2025 for between $50 and $60.', firm: '', models: '', upcs: '', lots: '',
  };

  it('every alert carries an evidence line: exact-name, rules-matched and code-matched alike', async () => {
    const RULES = { ...CPSC_PAIR, recall_id: 11, recall_number: '11', item_text: 'KEAWIS Mini Crib Mattress', recalled_product: 'KEAWIS Crib Mattress' };
    const UPC = { ...FDA_PAIR, item_text: 'Little Sprout Infant Formula 12.4 oz', upc: '070074123456', recalled_product: 'Brightstar Infant Formula 12.4 oz UPC 070074123456' };
    const { ctx } = ctxWith(maya, ITEMS, [CPSC_PAIR, RULES, UPC], no());
    const out = (await checkRecalls(ctx)).candidates;
    expect(out).toHaveLength(3);
    for (const c of out) {
      expect(String(c.claim.evidence).length).toBeGreaterThan(10);
      expect(c.body).toContain('Matched on:');
      expect(c.body).toContain(String(c.claim.evidence).replace(/\.$/, ''));
    }
  });

  it('uses the recall record read through Zetaris: a purchase outside the real sale window gives no alert', async () => {
    const late = { ...CPSC_PAIR, purchased_on: '2026-09-10' };
    const { ctx } = ctxWith(maya, ITEMS, [late], no(), [KEA_DETAILS]);
    expect((await checkRecalls(ctx)).candidates).toEqual([]);
    const inside = { ...CPSC_PAIR, purchased_on: '2025-03-10' };
    const h = ctxWith(maya, ITEMS, [inside], no(), [KEA_DETAILS]);
    const c = (await checkRecalls(h.ctx)).candidates[0];
    expect(c.claim.recallId).toBe(10560);
    expect(c.body).toContain('Matched on:');
  });

  it('a purchase long after a recall began, with no sale window known, is not shown (newer product)', async () => {
    const late = { ...CPSC_PAIR, purchased_on: '2026-09-10' };
    const { ctx } = ctxWith(maya, ITEMS, [late], no());
    expect((await checkRecalls(ctx)).candidates).toEqual([]);
  });

  it('the recall-record query is separate (the three recorded queries keep their exact text) and reads only recall tables', async () => {
    const m = await import('../agents/recall');
    const sql = m.recallDetailsSql([{ source: 'cpsc', id: 10560 }, { source: 'fda', id: 'F-0123-2026' }]);
    expect(sql).toContain('bundle_live.cpsc_recalls');
    expect(sql).toContain('bundle_live.fda_food_recalls');
    expect(sql).toContain('10560');
    expect(sql).toContain("'F-0123-2026'");
    expect(sql).not.toMatch(/family_id|v_purchase_items/);
    expect(sql).not.toMatch(/;\s*$/);
    expect(() => m.recallDetailsSql([{ source: 'fda', id: "x'; DROP" }])).toThrow();
  });

  it('if the recall record cannot be read, the match still runs on the pair row and the fallback is logged', async () => {
    const { ctx } = ctxWith(maya, ITEMS, [CPSC_PAIR], no(), 'throw');
    const out = await checkRecalls(ctx);
    expect(out.candidates).toHaveLength(1);
    expect((ctx.trace as any).lines().some((l: any) => l.action === 'recall_record' && l.status === 'fallback')).toBe(true);
  });

  it('pad / liner / insert count as one product type', async () => {
    const PAD = { ...CPSC_PAIR, recall_id: 12, recall_number: '12', item_text: 'Foobar Cooling Gel Car Seat Liner', recalled_product: 'Foobar Car Seat Pad', recall_title: 'Foobar Recalls Car Seat Pads' };
    const { ctx } = ctxWith(maya, ITEMS, [PAD], no());
    expect((await checkRecalls(ctx)).candidates).toHaveLength(1);
  });

  it('formula recall cards say "check the lot number on the can" (once), whichever way they matched', async () => {
    const rules = { ...FDA_PAIR, purchased_on: '2026-03-20' };
    const upc = { ...FDA_PAIR, recall_number: 'F-9-2026', item_text: 'Little Sprout Infant Formula 12.4 oz', upc: '070074123456', recalled_product: 'Brightstar Infant Formula 12.4 oz UPC 070074123456' };
    const { ctx } = ctxWith(maya, ITEMS, [rules, upc], no());
    const out = (await checkRecalls(ctx)).candidates;
    expect(out).toHaveLength(2);
    for (const c of out) expect(c.body.toLowerCase().match(/check the lot number on the can/g)).toHaveLength(1);
  });

  it('non-formula recall cards do not carry the lot line', async () => {
    const { ctx } = ctxWith(maya, ITEMS, [CPSC_PAIR], no());
    expect((await checkRecalls(ctx)).candidates[0].body.toLowerCase()).not.toContain('lot number on the can');
  });

  it('no_false_recall still holds with the real matcher: 10490 and 10453 never appear for a Pack n Play', async () => {
    const mk = (id: number, product: string) => ({ ...CPSC_PAIR, item_text: 'Graco Pack n Play Portable Playard', recall_id: id, recall_number: String(id), recall_title: `Recall ${id}`, recalled_product: product });
    const { ctx } = ctxWith(maya, ITEMS, [mk(10490, 'Play Yards'), mk(10453, 'Organic Cotton Pack N Play Mattress Dual-Sided Portable Baby Crib Pad')], no());
    expect((await checkRecalls(ctx)).candidates).toEqual([]);
  });

  it('shares one lookup between the recall card and the clawback check (one pairs query per run) but revise re-reads', async () => {
    const m = await import('../agents/recall');
    const h = ctxWith(maya, ITEMS, [CPSC_PAIR], no());
    await checkRecalls(h.ctx);
    await m.findRecalledItems(h.ctx);
    const pairsCalls = () => h.runQuery.mock.calls.filter((c) => String(c[0]).includes('LATERAL VIEW')).length;
    expect(pairsCalls()).toBe(1);
    const first = (await checkRecalls(h.ctx)).candidates[0];
    await revise(first, 'x', h.ctx);
    expect(pairsCalls()).toBe(2);
  });

  it('every recall claim carries structured proof for the Fact-Checker: evidence, evidenceType, evidenceCode, recalledProduct, itemText', async () => {
    const UPC = { ...FDA_PAIR, item_text: 'Little Sprout Infant Formula 12.4 oz', upc: '070074123456', recalled_product: 'Brightstar Infant Formula 12.4 oz UPC 070074123456' };
    const LOT = { ...FDA_PAIR, recall_number: 'F-2-2026', item_text: 'Little Sprout Infant Formula 12.4 oz', lot_code: '26A1234', recalled_product: 'Brightstar Infant Formula lot 26A1234' };
    const MODEL = { ...CPSC_PAIR, recall_id: 21, recall_number: '21', item_text: 'Zed Walker', model_number: 'RV001', recalled_product: 'Zed Walker Model RV001' };
    const RULES = { ...CPSC_PAIR, recall_id: 11, recall_number: '11', item_text: 'KEAWIS Mini Crib Mattress', recalled_product: 'KEAWIS Crib Mattress' };
    const { ctx } = ctxWith(maya, ITEMS, [CPSC_PAIR, RULES, UPC, LOT, MODEL], no());
    const by = Object.fromEntries((await checkRecalls(ctx)).candidates.map((c) => [c.id, c.claim]));
    expect(by['recall-cpsc-10560']).toMatchObject({ evidenceType: 'name', evidenceCode: '', recalledProduct: 'KEAWIS Crib Mattress', itemText: ITEMS[0].item_text });
    expect(String(by['recall-cpsc-10560'].evidence)).toContain('keawis');
    expect(by['recall-cpsc-11']).toMatchObject({ evidenceType: 'confirmed', itemText: 'KEAWIS Mini Crib Mattress' });
    expect(by['recall-fda-F-0123-2026']).toMatchObject({ evidenceType: 'upc', evidenceCode: '070074123456', recalledProduct: UPC.recalled_product });
    expect(by['recall-fda-F-2-2026']).toMatchObject({ evidenceType: 'lot', evidenceCode: '26A1234' });
    expect(by['recall-cpsc-21']).toMatchObject({ evidenceType: 'model', evidenceCode: 'RV001' });
  });

  it("Maya's planted KEAWIS purchase (from the sample purchase file) matches the REAL recall 10560 record", () => {
    const { matchRecall, fromCpsc } = require('../agents/recallMatch');
    const sample = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/sample/purchase-items.json'), 'utf8'));
    const receipt = sample.receipts.find((r: any) => r.familyId === 'maya' && r.items.some((i: any) => /KEAWIS/.test(i.productName)));
    const item = receipt.items.find((i: any) => /KEAWIS/.test(i.productName));
    const feed = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../research/experiments/entity-resolution/data/cpsc.json'), 'utf8'));
    const rec = fromCpsc(feed.find((r: any) => r.RecallID === 10560));
    const m = matchRecall({ text: item.productName, date: receipt.purchasedOn, source: receipt.source }, rec);
    expect(m.match).toBe(true);
    expect(receipt.purchasedOn >= '2024-08' && receipt.purchasedOn <= '2025-07').toBe(true);
  });
});

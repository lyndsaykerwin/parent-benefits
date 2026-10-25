import os from 'os';
import fs from 'fs';
import path from 'path';
import { findClawbacks, revise } from '../agents/clawback';
import { TraceLogger } from '../agents/trace';
import { FakeGenerator } from '../adapters/llm';
import type { AgentContext } from '../agents/types';

const maya = {
  id: 'maya', userId: null, isGuest: true, name: 'Maya', birthDate: '2026-10-03', dueDate: null,
  zip: '02139', state: 'MA', employer: 'Northwind', householdSize: 3, annualIncomeCents: 14500000,
  dcfsaOffered: true, dataConnected: true,
};
const leo = { ...maya, id: 'leo', birthDate: null, dueDate: '2026-12-07', dcfsaOffered: false, dataConnected: false };

const res = (rows: any[]) => ({ headers: Object.keys(rows[0] ?? {}), rows, ms: 1 });

// Rows shaped like the sample receipt rows in data/sample/purchase-items.json (read through v_purchase_items).
const FSA_ROWS = [
  // a zero-price line, a negative price and a same-day duplicate must never come out as candidates, even if a query returned them
  { item_id: 1, merchant: 'Target', date: '2026-10-05', amount_cents: 2899, item: 'Frida baby thermometer', keyword: 'thermometer', fsa_category: 'Baby thermometer', account: 'FSA', source_url: 'https://fsastore.com/baby-thermometers.html' },
  { item_id: 4, merchant: 'Target', date: '2026-10-14', amount_cents: -2400, item: 'Carter onesies (returned)', keyword: 'onesies', fsa_category: 'x', account: 'FSA', source_url: 'https://x.test' },
  { item_id: 5, merchant: 'Walgreens', date: '2026-10-15', amount_cents: 3149, item: 'Pampers Swaddlers diaper rash cream', keyword: 'diaper rash', fsa_category: 'Diaper rash ointment', account: 'FSA', source_url: 'https://fsastore.com/skin-care.html' },
  { item_id: 6, merchant: 'Walgreens', date: '2026-10-15', amount_cents: 3149, item: 'Pampers Swaddlers diaper rash cream', keyword: 'diaper rash', fsa_category: 'Diaper rash ointment', account: 'FSA', source_url: 'https://fsastore.com/skin-care.html' },
];
const PRICE_ROWS = [
  { item_id: 2, merchant: 'Target', date: '2026-10-09', amount_cents: 8999, item: "Graco Pack 'n Play playard", window_days: 14, observed_price_cents: 6999, observed_at: '2026-10-20', store_source_url: 'https://help.target.com/x', price_source_url: 'https://www.target.com/c/playards/-/N-5xtbz' },
];

function ctxWith(family: any, rows: { fsa?: any[]; price?: any[]; items?: any[]; pairs?: any[]; recallFails?: boolean }, llm = new FakeGenerator([]), workspace?: any) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-'));
  const trace = new TraceLogger('t', dir);
  const runQuery = jest.fn(async (sql: string) => {
    if (sql.includes('store_policies')) return res(rows.price ?? []);
    if (sql.includes('fsa_eligible_categories')) return res(rows.fsa ?? []);
    // The Recall Checker's questions (the safety check before a deal is published).
    if (sql.includes('bundle_live.') || sql.includes('SELECT DISTINCT item_text')) {
      if (rows.recallFails) throw new Error('No saved response for this query');
      if (sql.includes("= 'terminated'")) return res([]);
      if (sql.includes('AS description')) return res([]);
      if (sql.includes('LATERAL VIEW')) return res(rows.pairs ?? []);
      return res(rows.items ?? []);
    }
    throw new Error('unexpected sql ' + sql);
  });
  const ctx = { runId: 't', family, z: { runQuery } as any, llm, memory: {} as any, trace, workspace } as AgentContext;
  return { ctx, runQuery, trace };
}

describe('clawback hunter', () => {
  beforeEach(() => { process.env.TODAY = '2026-10-23'; });

  it('maya: finds the FSA thermometer (2899) and the Pack n Play price adjustment (2000), and nothing about daycare', async () => {
    const { ctx } = ctxWith(maya, { fsa: FSA_ROWS, price: PRICE_ROWS });
    const out = await findClawbacks(ctx);
    const by: Record<string, any> = Object.fromEntries(out.map((c) => [c.claim.type, c]));
    by.fsa_reimbursement = out.find((c) => c.claim.itemId === '1')!;
    expect(by.fsa_reimbursement.amountCents).toBe(2899);
    expect(by.fsa_reimbursement.claim.itemAmountCents).toBe(2899);
    expect(by.price_adjustment.amountCents).toBe(2000);
    expect(by.price_adjustment.deadline).toBe('2026-10-23'); // 2026-10-09 + 14 days
    expect(out.some((c) => c.claim.type === 'dcfsa_childcare' || c.id.includes('dcfsa'))).toBe(false);
    for (const c of out) {
      expect(c.kind).toBe('clawback');
      expect(c.sources.length).toBeGreaterThan(0);
      expect(c.claim.itemId).toBeTruthy();
      expect(c.claim.itemAmountCents).toBeGreaterThan(0);
      expect(c.agent).toBe('clawback');
      expect(c.retryCount).toBe(0);
      expect(c.traceId).toBeTruthy();
    }
  });

  it('reads only purchase_items (through v_purchase_items): never card transactions, Amazon orders or the old views', async () => {
    const { ctx, runQuery } = ctxWith(maya, { fsa: FSA_ROWS, price: PRICE_ROWS });
    await findClawbacks(ctx);
    const money = runQuery.mock.calls.filter(([q]) => /fsa_eligible_categories|store_policies/.test(String(q)));
    expect(money.length).toBe(2); // FSA + price; the daycare query is gone
    for (const [sql] of runQuery.mock.calls) {
      expect(sql).toContain('bundle_pg.v_purchase_items');
      expect(sql).not.toMatch(/v_clawback_tx|v_recall_orders|transactions|amazon_orders|DCFSA/i);
    }
  });

  it('does not make candidates from the refund or the duplicate pair', async () => {
    const { ctx } = ctxWith(maya, { fsa: FSA_ROWS, price: [] });
    const out = await findClawbacks(ctx);
    const fsa = out.filter((c) => c.claim.type === 'fsa_reimbursement');
    expect(fsa.map((c) => c.claim.itemId)).toEqual(['1', '5']); // one Walgreens, no refund
    expect(out.some((c) => c.amountCents !== null && c.amountCents <= 0)).toBe(false);
  });

  it('a family with no purchase items gets []', async () => {
    const { ctx } = ctxWith(leo, {});
    expect(await findClawbacks(ctx)).toEqual([]);
  });

  it('a seller-only receipt (no store) still gets cards: the store falls back to the seller in every query', async () => {
    const { ctx, runQuery } = ctxWith(maya, { fsa: FSA_ROWS, price: PRICE_ROWS });
    await findClawbacks(ctx);
    for (const [sql] of runQuery.mock.calls.filter(([q]) => /fsa_eligible_categories|store_policies/.test(String(q)))) {
      expect(sql).toContain('COALESCE(p.store, p.seller)');
      expect(String(sql).split('COALESCE(p.store, p.seller)').join('')).not.toMatch(/\bp\.store/);
    }
    const { fsaSql, priceSql } = await import('../agents/clawback');
    expect(priceSql('maya')).toContain('lower(sp.store) = lower(COALESCE(p.store, p.seller))');
    expect(fsaSql('maya')).toContain('COALESCE(p.store, p.seller) AS merchant');
  });

  it('only prices lines that have a price (a line with no price cannot be money back)', async () => {
    const { ctx, runQuery } = ctxWith(maya, {});
    await findClawbacks(ctx);
    for (const [sql] of runQuery.mock.calls) expect(sql).toMatch(/price_cents > 0/);
    expect(runQuery.mock.calls.length).toBe(2); // nothing to publish, so no safety question is asked
  });

  it('ignores a price observation outside the store window or not lower', async () => {
    const late = { ...PRICE_ROWS[0], observed_at: '2026-10-30' };
    const same = { ...PRICE_ROWS[0], observed_at: '2026-10-12', observed_price_cents: 8999 };
    const out = await findClawbacks(ctxWith(maya, { price: [late, same] }).ctx);
    expect(out).toEqual([]);
  });

  it('uses the lowest in-window price when there are several', async () => {
    const lower = { ...PRICE_ROWS[0], observed_price_cents: 6500, observed_at: '2026-10-12' };
    const out = await findClawbacks(ctxWith(maya, { price: [PRICE_ROWS[0], lower] }).ctx);
    expect(out[0].amountCents).toBe(2499);
  });

  it('uses the LLM body when it only repeats known amounts, else the deterministic text', async () => {
    const good = new FakeGenerator([JSON.stringify({ body: 'You bought a thermometer for $28.99; it is likely FSA eligible.' })]);
    const a = await findClawbacks(ctxWith(maya, { fsa: [FSA_ROWS[0]] }, good).ctx);
    expect(a[0].body).toContain('likely FSA eligible');
    const invented = new FakeGenerator([JSON.stringify({ body: 'Claim $999.00 back now!' })]);
    const b = await findClawbacks(ctxWith(maya, { fsa: [FSA_ROWS[0]] }, invented).ctx);
    expect(b[0].body).toContain('$28.99');
    expect(b[0].body).not.toContain('999');
  });

  it('never puts income in the model prompt', async () => {
    const g = new FakeGenerator([JSON.stringify({ body: 'ok' })]);
    await findClawbacks(ctxWith(maya, { fsa: [FSA_ROWS[0]] }, g).ctx);
    expect(g.prompts.join('\n')).not.toContain('14500000');
  });

  it('keeps unsafe family ids out of SQL', async () => {
    const { ctx, runQuery } = ctxWith({ ...maya, id: "m'; DROP" }, { fsa: FSA_ROWS });
    await expect(findClawbacks(ctx)).resolves.toEqual([]);
    expect(runQuery).not.toHaveBeenCalled();
  });

  it('sends no trailing semicolons and scopes every query to the family', async () => {
    const { ctx, runQuery } = ctxWith(maya, { fsa: FSA_ROWS, price: PRICE_ROWS });
    await findClawbacks(ctx);
    for (const [sql] of runQuery.mock.calls) {
      expect(sql).not.toMatch(/;\s*$/);
      expect(sql).toContain("family_id = 'maya'");
    }
  });

  it('revise re-derives a fresh candidate, bumps retryCount, or gives up with null', async () => {
    const h = ctxWith(maya, { fsa: FSA_ROWS, price: PRICE_ROWS });
    const first = (await findClawbacks(h.ctx)).find((c) => c.claim.type === 'price_adjustment')!;
    const stale = { ...first, amountCents: 1, retryCount: 0 };
    const fixed = await revise(stale, 'amount mismatch', h.ctx);
    expect(fixed?.amountCents).toBe(2000);
    expect(fixed?.retryCount).toBe(1);
    const gone = ctxWith(maya, { fsa: [], price: [] });
    expect(await revise(stale, 'source not found', gone.ctx)).toBeNull();
  });
});

describe('I4: typed-in family', () => {
  it('queries nothing (no saved purchases can exist)', async () => {
    const { ctx, runQuery } = ctxWith({ ...maya, id: 'guest-ab12cd34', dataConnected: false }, {});
    expect(await findClawbacks(ctx)).toEqual([]);
    expect(runQuery).not.toHaveBeenCalled();
  });
});


describe('W3-SAFETY: the safety-value loop (Clawback Hunter asks the Recall Checker before publishing a deal)', () => {
  beforeEach(() => { process.env.TODAY = '2026-10-23'; });
  // A made-up recalled item: it is in the planted purchase_items AND in a (made-up) recall pair; no recall is invented.
  const RECALLED_PRICE = { ...PRICE_ROWS[0], item_id: 9, date: '2026-10-08', item: 'KEAWIS Crib Mattress, Dual-Sided Firm Baby Mattress' };
  const KEA_ITEMS = [{ item_text: 'KEAWIS Crib Mattress, Dual-Sided Firm Baby Mattress', source: 'email' }, { item_text: "Graco Pack 'n Play playard", source: 'photo_receipt' }];
  const KEA_PAIR = {
    item_text: 'KEAWIS Crib Mattress, Dual-Sided Firm Baby Mattress', purchased_on: '2026-01-20', source: 'email',
    recall_source: 'cpsc', recall_id: 10560, recall_number: '26191', recall_date: '2026-01-15',
    recall_title: 'Yixing Trading Recalls KEAWIS Crib Mattresses', recall_url: 'https://www.cpsc.gov/Recalls/2026/Yixing', recalled_product: 'KEAWIS Crib Mattress',
  };
  function fakeWorkspace() {
    const notes: any[] = [];
    return { notes, post: (n: any) => { notes.push(n); return n; } };
  }

  it("a recalled item's price-drop deal is killed before it is published; the other deal stays", async () => {
    const { ctx } = ctxWith(maya, { price: [RECALLED_PRICE, PRICE_ROWS[0]], items: KEA_ITEMS, pairs: [KEA_PAIR] });
    const out = await findClawbacks(ctx);
    expect(out.map((c) => c.claim.itemId)).toEqual(['2']);
  });

  it("a recalled item's FSA reimbursement is killed too", async () => {
    const fsa = { ...FSA_ROWS[0], item_id: 9, item: 'KEAWIS Crib Mattress, Dual-Sided Firm Baby Mattress' };
    const { ctx } = ctxWith(maya, { fsa: [fsa, FSA_ROWS[2]], items: KEA_ITEMS, pairs: [KEA_PAIR] });
    const out = await findClawbacks(ctx);
    expect(out.map((c) => c.claim.itemId)).toEqual(['5']);
  });

  it('the kill is explained in the trace: blocked line with the recall and its evidence, "do not encourage buying or claiming a rebate"', async () => {
    const { ctx, trace } = ctxWith(maya, { price: [RECALLED_PRICE], items: KEA_ITEMS, pairs: [KEA_PAIR] });
    await findClawbacks(ctx);
    const kill = trace.lines().find((l) => l.action === 'safety_kill')!;
    expect(kill.status).toBe('blocked');
    expect(kill.output_summary).toContain('cpsc-10560');
    expect(kill.output_summary).toMatch(/do not encourage buying or claiming a rebate/i);
    expect(kill.output_summary).toContain('Matches recall cpsc-10560');
  });

  it("the two agents talk through the workspace: a question, the Recall Checker's answer with evidence, and a kill verdict", async () => {
    const ws = fakeWorkspace();
    const { ctx } = ctxWith(maya, { price: [RECALLED_PRICE, PRICE_ROWS[0]], items: KEA_ITEMS, pairs: [KEA_PAIR] }, new FakeGenerator([]), ws);
    await findClawbacks(ctx);
    const mine = ws.notes.filter((n) => n.about === 'clawback-price-9');
    expect(mine.map((n) => [n.from_agent, n.to_agent, n.type])).toEqual([
      ['ClawbackHunter', 'RecallChecker', 'question'],
      ['RecallChecker', 'ClawbackHunter', 'answer'],
      ['ClawbackHunter', 'Orchestrator', 'verdict'],
    ]);
    expect(mine[1].body).toContain('cpsc-10560');
    expect(mine[1].body).toContain('Matches recall');
    expect(mine[2].body).toMatch(/do not encourage buying or claiming a rebate/i);
    // the clean item gets a question and a "no recall" answer, no verdict
    expect(ws.notes.filter((n) => n.about === 'clawback-price-2').map((n) => n.type)).toEqual(['question', 'answer']);
  });

  it('works without a workspace (the orchestrator creates it later): the trace still shows the check', async () => {
    const { ctx, trace } = ctxWith(maya, { price: [PRICE_ROWS[0]], items: KEA_ITEMS, pairs: [] });
    expect((await findClawbacks(ctx)).length).toBe(1);
    expect(trace.lines().some((l) => l.action === 'safety_check' && /no recall/i.test(l.output_summary))).toBe(true);
  });

  it('a workspace that fails never breaks the check', async () => {
    const broken = { post: () => { throw new Error('H-MEM down'); } };
    const { ctx } = ctxWith(maya, { price: [RECALLED_PRICE, PRICE_ROWS[0]], items: KEA_ITEMS, pairs: [KEA_PAIR] }, new FakeGenerator([]), broken);
    expect((await findClawbacks(ctx)).map((c) => c.claim.itemId)).toEqual(['2']);
  });

  it('asks Zetaris once per run for all deals (no per-deal query), only about this family', async () => {
    const { ctx, runQuery } = ctxWith(maya, { fsa: FSA_ROWS, price: PRICE_ROWS, items: KEA_ITEMS, pairs: [] });
    await findClawbacks(ctx);
    const recallQs = runQuery.mock.calls.map(([q]) => String(q)).filter((q) => q.includes('SELECT DISTINCT item_text') || q.includes('LATERAL VIEW'));
    expect(recallQs.length).toBe(2);
    for (const q of recallQs) expect(q).toContain("family_id = 'maya'");
  });

  it('if the recall check cannot run, the deals are kept and the trace says the safety check was unavailable', async () => {
    const { ctx, trace } = ctxWith(maya, { price: PRICE_ROWS, recallFails: true });
    expect(await findClawbacks(ctx)).toHaveLength(1);
    expect(trace.lines().some((l) => l.action === 'safety_check' && l.status === 'fallback')).toBe(true);
  });

  it('a revised deal for a recalled item is still killed (revise gives up)', async () => {
    const h = ctxWith(maya, { price: [PRICE_ROWS[0], RECALLED_PRICE], items: KEA_ITEMS, pairs: [KEA_PAIR] });
    const first = (await findClawbacks(h.ctx))[0];
    const killed = { ...first, claim: { ...first.claim, itemId: '9' } };
    expect(await revise(killed, 'amount mismatch', h.ctx)).toBeNull();
  });
});

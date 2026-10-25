import fs from 'fs';
import path from 'path';
import {
  matchRecall, matchAll, fromCpsc, fromFda, extractModels, extractUpcs, extractLots, saleWindow, typesIn, normUpc,
  type PurchaseItem, type RecallRecord,
} from '../agents/recallMatch';

// Saved live feeds and FAKE labelled purchases from the entity-resolution test (research/entity-resolution-test.md).
const DATA = path.resolve(__dirname, '../../../research/experiments/entity-resolution/data');
const load = (f: string) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const CPSC: RecallRecord[] = load('cpsc.json').map(fromCpsc);
const FDA: RecallRecord[] = load('fda.json').results.map(fromFda);
const ALL = [...CPSC, ...FDA];
const byId = (id: string) => {
  const r = ALL.find((x) => x.id === id);
  if (!r) throw new Error('missing recall ' + id);
  return r;
};
interface Labelled extends PurchaseItem { id: string; should_alert: string[] }
const PURCHASES: Labelled[] = load('purchases.json').purchases;
const HELDOUT: Labelled[] = load('heldout.json').purchases;

function score(set: Labelled[]) {
  let tp = 0, fp = 0, fn = 0;
  const wrong: string[] = [];
  for (const p of set) {
    const got = new Set(matchAll(p, ALL).map((m) => m.recallId));
    for (const id of got) if (p.should_alert.includes(id)) tp++; else { fp++; wrong.push(`${p.id} false alarm ${id}`); }
    for (const id of p.should_alert) if (!got.has(id)) { fn++; wrong.push(`${p.id} missed ${id}`); }
  }
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 1;
  return { tp, fp, fn, precision, recall, wrong };
}

describe('recallMatch: code extractors', () => {
  it('reads model numbers, UPCs, lot codes and sale windows out of recall text', () => {
    expect(extractModels('Model No.: RV001 is printed on a label under the walker\'s seat.')).toEqual(['rv001']);
    expect(extractUpcs('NET WT 24.7 OZ (700 G); UPC: 860013251901 b.)')).toContain('860013251901');
    expect(extractLots('Recalled Lot Codes - 408125075E14F2 - 708125076E14F2')).toEqual(expect.arrayContaining(['408125075e14f2', '708125076e14f2']));
    expect(saleWindow('Online at Amazon.com from August 2024 through July 2025 for $50')).toEqual({ start: '2024-08', end: '2025-07' });
    expect(saleWindow('Sold in April 2026 at Target')).toEqual({ start: '2026-04', end: '2026-04' });
  });

  it('fixed type list: pad/liner/insert count as one type, and "adapter for stroller" is an adapter', () => {
    expect(typesIn('Cooling Gel Car Seat Liner Pad')).toContain('pad');
    expect(typesIn('Joolz Aer2 Car Seat Adapters')).toEqual(new Set(['car seat adapter']));
    expect(typesIn('KEAWIS Crib Mattresses')).toContain('mattress');
  });

  it('loads every saved recall row: 739 CPSC + 42 FDA, with FDA status read', () => {
    expect(CPSC).toHaveLength(739);
    expect(FDA).toHaveLength(42);
    expect(FDA.filter((r) => r.status === 'terminated')).toHaveLength(17);
  });
});

describe('recallMatch: exact codes come first', () => {
  const nara = () => byId('fda-H-1137-2026');
  it('a UPC from a barcode photo matches the FDA recall that lists it', () => {
    const m = matchRecall({ text: 'formula can', upc: '860013251901', date: '2026-05-28' }, nara());
    expect(m).toMatchObject({ match: true, level: 'exact', reason: 'exact_upc' });
    expect(m.evidence).toContain('860013251901');
  });
  it('a lot code from a can-bottom photo matches exactly', () => {
    expect(matchRecall({ text: 'formula can', lot: '408125075E14F2' }, nara())).toMatchObject({ match: true, level: 'exact', reason: 'exact_lot' });
  });
  it('a model number from a label photo matches exactly, and a different model number is a clash', () => {
    const withModel = CPSC.find((r) => r.models.length > 0 && r.productNames.some((n) => typesIn(n).size > 0))!;
    expect(withModel).toBeDefined();
    expect(matchRecall({ text: 'label photo', model: withModel.models[0] }, withModel)).toMatchObject({ match: true, reason: 'exact_model' });
    const brandWord = withModel.productNames[0].split(' ')[0];
    const typeWord = [...typesIn(withModel.productNames[0])][0];
    // Same letter/digit pattern as the recalled model, different digits: a real model clash.
    const otherModel = withModel.models[0].replace(/\d/g, (d) => String((Number(d) + 1) % 10)).toUpperCase();
    const clash = matchRecall({ text: `${brandWord} ${typeWord} ${otherModel}` }, withModel);
    expect(clash).toMatchObject({ match: false, reason: 'model_clash' });
  });
  it('a matching model number bought before the sale window is not an alert (VEVOR BB702A, May 2024)', () => {
    const m = matchRecall({ text: 'VEVOR Electric Baby Swing BB702A', date: '2024-05-15' }, byId('cpsc-10474'));
    expect(m).toMatchObject({ match: false, reason: 'outside_sale_dates' });
    expect(matchRecall({ text: 'VEVOR Electric Baby Swing BB702A', date: '2025-03-01' }, byId('cpsc-10474'))).toMatchObject({ match: true, reason: 'exact_model' });
  });
  it('a finished FDA recall never matches, even on an exact UPC', () => {
    const done = FDA.find((r) => r.status === 'terminated' && r.upcs.length)!;
    expect(matchRecall({ text: 'formula', upc: done.upcs[0] }, done)).toMatchObject({ match: false, reason: 'fda_terminated' });
  });
});

// A small hand-made recall for rule tests (FAKE data, not a real recall).
const fake = (over: Partial<RecallRecord>): RecallRecord => ({
  id: 'cpsc-test', source: 'cpsc', title: 'Acme Recalls Baby Walkers', productNames: ['Acme Baby Walker'],
  description: 'This recall involves Acme baby walkers.', recallDate: '2026-03-01', status: 'ongoing',
  upcs: [], models: [], lots: [], soldAt: '', firm: 'Acme', ...over,
});

describe('recallMatch: barcode, phone, brand and model-clash rules', () => {
  const nara = () => byId('fda-H-1137-2026');
  it('barcode match needs a full 11–14 digit code: "1" or a short tail never matches', () => {
    for (const upc of ['1', '5', '901', '13251901', '0013251901']) {
      expect(matchRecall({ text: 'formula can', upc }, nara()).reason).not.toBe('exact_upc');
    }
    const seven = fake({ upcs: ['7'], productNames: ['Acme Baby Walker'] });
    expect(matchRecall({ text: 'walker', upc: '5' }, seven).match).toBe(false);
    expect(normUpc('1')).toBeNull();
    expect(normUpc('123456789012345')).toBeNull();
  });
  it('a single extra leading zero still matches (EAN-13 form of a UPC)', () => {
    expect(matchRecall({ text: 'formula can', upc: '0860013251901' }, nara())).toMatchObject({ match: true, reason: 'exact_upc' });
    expect(matchRecall({ text: 'formula can', upc: '00860013251901' }, nara())).toMatchObject({ match: true, reason: 'exact_upc' });
    expect(matchRecall({ text: 'formula can', upc: '860013251902' }, nara()).reason).not.toBe('exact_upc');
  });
  it('phone numbers in recall text are not read as barcodes', () => {
    expect(extractUpcs('Call Acme toll-free at 1-800-555-1234 from 9 a.m.')).toEqual([]);
    expect(extractUpcs('Contact (800) 555-1234 or 1 800 555 1234')).toEqual([]);
    expect(extractUpcs('Call 1-800-555-1234. UPC: 860013251901')).toEqual(['860013251901']);
  });
  it('a model-number match also needs the brand to agree when the purchase names one', () => {
    const r = byId('cpsc-10474');
    expect(matchRecall({ text: 'Graco Electric Baby Swing BB702A', date: '2025-03-01' }, r)).toMatchObject({ match: false, reason: 'brand_mismatch' });
    expect(matchRecall({ text: 'VEVOR Electric Baby Swing BB702A', date: '2025-03-01' }, r)).toMatchObject({ match: true, reason: 'exact_model' });
    expect(matchRecall({ text: 'label photo', model: 'BB702A', date: '2025-03-01' }, r)).toMatchObject({ match: true, reason: 'exact_model' });
  });
  it('a letters+digits product name ("Aer2") is not a model clash; a model-shaped word is', () => {
    const r = fake({ title: 'Joolz Recalls Aer2 Car Seat Adapters', productNames: ['Joolz Aer2 Car Seat Adapters'], firm: 'Joolz', models: ['jz12345'] });
    expect(matchRecall({ text: 'Joolz Aer2 Car Seat Adapters', date: '2026-02-01' }, r)).toMatchObject({ match: true, reason: 'rules' });
    expect(matchRecall({ text: 'Joolz Aer2 Car Seat Adapters JZ54321', date: '2026-02-01' }, r)).toMatchObject({ match: false, reason: 'model_clash' });
    expect(matchRecall({ text: 'Joolz Aer2 Car Seat Adapters', model: 'JZ99999', date: '2026-02-01' }, r)).toMatchObject({ match: false, reason: 'model_clash' });
  });
  it('real Joolz adapter recall still matches the adapter purchase despite "Aer2" in the name', () => {
    const r = byId('cpsc-10829');
    const m = matchRecall({ text: 'Joolz Aer2 Car Seat Adapters', source: 'amazon', date: r.recallDate }, r);
    expect(m.reason).not.toBe('model_clash');
  });
  it('seller check: sold only at Target, bought at Walmart → no alert; bought at Target → alert', () => {
    const r = fake({ soldAt: 'Sold exclusively at Target stores and Target.com' });
    expect(matchRecall({ text: 'Acme Baby Walker', merchant: 'Walmart', date: '2026-02-01' }, r)).toMatchObject({ match: false, reason: 'seller_mismatch' });
    const ok = matchRecall({ text: 'Acme Baby Walker', merchant: 'Target', date: '2026-02-01' }, r);
    expect(ok).toMatchObject({ match: true, reason: 'rules' });
    expect(ok.evidence).toContain('sold at target');
    // Not "only/exclusively": the store is not a reason to reject.
    expect(matchRecall({ text: 'Acme Baby Walker', merchant: 'Walmart', date: '2026-02-01' }, fake({ soldAt: 'Sold at Target and online' })).match).toBe(true);
  });
  it('size clash: a 12.4 oz can is not the recalled 24.7 oz can; the same size still alerts', () => {
    const r = fake({ id: 'fda-test', source: 'fda', title: 'FDA recall: Acme Nutrition', productNames: ['Acme Infant Formula Powder, NET WT 24.7 OZ'], firm: 'Acme Nutrition', recallDate: '2026-05-01' });
    expect(matchRecall({ text: 'Acme Infant Formula 12.4 oz', date: '2026-05-10' }, r)).toMatchObject({ match: false, reason: 'size_clash' });
    expect(matchRecall({ text: 'Acme Infant Formula 24.7 oz', date: '2026-05-10' }, r)).toMatchObject({ match: true, reason: 'rules' });
  });
});

describe('recallMatch: the new eval cases (entity-resolution-test.md section 6)', () => {
  const must = (p: PurchaseItem, id: string) => {
    const m = matchRecall(p, byId(id));
    expect(m.match).toBe(true);
    expect(m.evidence.length).toBeGreaterThan(10);
    return m;
  };
  const mustNot = (p: PurchaseItem, id: string) => expect(matchRecall(p, byId(id)).match).toBe(false);

  it('recall_true_keawis', () => { must({ text: 'KEAWIS Mini Crib Mattress 38 x 24, Dual-Sided', source: 'amazon', date: '2025-03-10' }, 'cpsc-10560'); });
  it('recall_true_maxview (spelling variant)', () => { must({ text: 'Babysense MaxView 5.5" HD Split-Screen Video Baby Monitor', source: 'amazon', date: '2024-11-22' }, 'cpsc-10650'); });
  it('recall_true_brand_in_title_only', () => { must({ text: 'Skip Hop x Sesame Street Elmo Teether Toy w/ Crayon Box', source: 'carters', date: '2025-08-14' }, 'cpsc-10943'); });
  it('no_false_recall_same_brand', () => mustNot({ text: 'Babysense 7 Under-The-Mattress Baby Movement Monitor', source: 'amazon', date: '2025-02-10' }, 'cpsc-10650'));
  it('no_false_recall_part_only', () => mustNot({ text: 'Joolz Aer+ Compact Lightweight Stroller, Midnight Black', source: 'amazon', date: '2025-09-19' }, 'cpsc-10829'));
  it('no_false_recall_wrong_dates', () => mustNot({ text: 'VEVOR Electric Baby Swing for Infants, Bluetooth, 5 Speeds, BB702A', source: 'amazon', date: '2024-05-15' }, 'cpsc-10474'));
  it('no_false_recall_shared_word', () => {
    const giraffe = { text: 'Melissa & Doug Giant Giraffe Lifelike Stuffed Animal Plush', source: 'amazon', date: '2025-11-30' };
    const graco = { text: "Graco Pack 'n Play Playard with Bassinet and Changer, Reign", source: 'amazon', date: '2025-06-21' };
    for (const id of ['cpsc-10309', 'cpsc-10584', 'cpsc-10490']) { mustNot(giraffe, id); mustNot(graco, id); }
    mustNot(graco, 'cpsc-10453');
  });
  it('no_false_recall_brand_store', () => {
    for (const id of ['cpsc-10369', 'cpsc-10667', 'cpsc-10773']) mustNot({ text: 'AMAZON MKTPL*2K4RT81Q3 Amzn.com/bill', merchant: 'Amazon', source: 'plaid', date: '2026-09-02' }, id);
  });
  it('no_terminated_fda', () => mustNot({ text: 'a2 Platinum Premium Infant Formula Milk-Based Powder with Iron, 31.7 oz', source: 'amazon', date: '2026-04-10' }, 'fda-H-0891-2026'));
  it('no_stale_fda', () => {
    const similac = { text: 'Similac 360 Total Care Infant Formula Powder, 30.8 oz Tub', source: 'target', date: '2026-07-02' };
    const old = FDA.filter((r) => r.recallDate.startsWith('2022') && /abbott/i.test(r.firm));
    for (const r of old) expect(matchRecall(similac, r).match).toBe(false);
    expect(matchAll(similac, ALL)).toEqual([]);
  });
  it('fda_true_ongoing says "check the lot code"', () => {
    const m = must({ text: 'Nara Organics Whole Milk Organic Infant Formula Powder, 0-12 Months, 24.7 oz', source: 'amazon', date: '2026-05-28' }, 'fda-H-1137-2026');
    expect(m.evidence).toMatch(/check the lot code/i);
  });
});

describe('recallMatch: scored on every saved recall row (739 CPSC + 42 FDA)', () => {
  it('labelled purchase set (30 fake purchases)', () => {
    const s = score(PURCHASES);
    // eslint-disable-next-line no-console
    console.log(`recallMatch purchases.json: TP ${s.tp} FP ${s.fp} FN ${s.fn} precision ${s.precision.toFixed(2)} recall ${s.recall.toFixed(2)}\n  ${s.wrong.join('\n  ')}`);
    expect(s.precision).toBeGreaterThanOrEqual(0.9);
    expect(s.recall).toBeGreaterThanOrEqual(0.8);
  });
  it('held-out set (15 fake purchases written after the rules were frozen)', () => {
    const s = score(HELDOUT);
    // eslint-disable-next-line no-console
    console.log(`recallMatch heldout.json: TP ${s.tp} FP ${s.fp} FN ${s.fn} precision ${s.precision.toFixed(2)} recall ${s.recall.toFixed(2)}\n  ${s.wrong.join('\n  ')}`);
    expect(s.precision).toBeGreaterThanOrEqual(0.85);
    expect(s.recall).toBeGreaterThanOrEqual(0.85);
  });
});

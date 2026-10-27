// Recalls for car seats (NHTSA) and strollers (CPSC) cover units made between two dates, and sometimes name lot codes.
// The photo reader now captures the date of manufacture and the lot code; these tests check the recall match uses them.
import { manufactureWindow, matchRecall, outsideMadeDates, type RecallRecord } from '../agents/recallMatch';
import { checkCarSeat, checkItemRecall } from '../ingest/gearRecall';

const rec = (over: Partial<RecallRecord> = {}): RecallRecord => ({
  id: 'cpsc-1', source: 'cpsc', title: 'Made-up Co. Recalls TM-ST200 Strollers', productNames: ['Trundlemoth City Stroller'],
  description: 'Model No. TM-ST200 strollers manufactured between January 1, 2026 and February 28, 2026 are included.',
  recallDate: '2026-06-01', status: 'ongoing', upcs: [], models: ['tmst200'], lots: [], soldAt: '', firm: 'Trundlemoth', ...over,
});

describe('manufacture dates in recall notices', () => {
  it('reads the common ways a notice writes them', () => {
    expect(manufactureWindow('all dates of manufacture between Feb 28 2023 and Mar 7 2025')).toEqual({ start: '2023-02-28', end: '2025-03-07' });
    expect(manufactureWindow('Strollers manufactured from June 2021 through December 2022')).toEqual({ start: '2021-06-01', end: '2022-12-31' });
    expect(manufactureWindow('manufactured 2023/01/01 to 2023/06/30')).toEqual({ start: '2023-01-01', end: '2023-06-30' });
    expect(manufactureWindow('no dates here')).toBeNull();
  });
  it('a month-only label date counts as inside when any of that month is', () => {
    expect(outsideMadeDates('2025-03', 'manufactured between February 28, 2023 and March 7, 2025')).toBeNull();
    expect(outsideMadeDates('2025-04', 'manufactured between February 28, 2023 and March 7, 2025')).toMatch(/made 2025-04/);
  });
});

describe('matchRecall with the label date and lot', () => {
  const p = { text: 'Trundlemoth City Stroller', model: 'TM-ST200' };
  it('same model, made inside the dates: a match that says so', () => {
    const m = matchRecall({ ...p, madeOn: '2026-02-09' }, rec());
    expect(m).toMatchObject({ match: true, reason: 'exact_model' });
    expect(m.evidence).toMatch(/Made 2026-02-09, inside the recalled manufacture dates/);
  });
  it('same model, made after the recalled dates: not this unit', () => {
    expect(matchRecall({ ...p, madeOn: '2026-03-14' }, rec())).toMatchObject({ match: false, reason: 'outside_manufacture_dates' });
  });
  it('no label date: the model match stands (we never assume a unit is safe)', () => {
    expect(matchRecall(p, rec()).match).toBe(true);
  });
  it('a lot code printed in the notice is an exact match', () => {
    const r = rec({ models: [], description: 'Lot numbers 0314A2 and 0314B2 are affected.' });
    expect(matchRecall({ text: 'Trundlemoth City Stroller', lot: '0314A2' }, r)).toMatchObject({ match: true, reason: 'exact_lot' });
  });
});

describe('car seats (NHTSA) use the label date', () => {
  const rows = [{ campaignNumber: '26C999000', manufacturer: 'Zooblefern Inc.', brands: ['Zooblefern'], models: ['ZF-CS100'], components: [], recallDate: '2026-05-01',
    summary: 'Zooblefern is recalling ZF-CS100 seats manufactured between January 1, 2026 and January 31, 2026.' }];
  const seat = { productName: 'Zooblefern infant car seat', brand: 'Zooblefern', modelNumber: 'ZF-CS100', upc: null };
  it('made inside the dates: found', () => {
    expect(checkCarSeat({ ...seat, manufacturedOn: '2026-01-20' }, '2026-10-26', rows as never).found).toBe(true);
  });
  it('made outside the dates: not found, with a plain note naming the recall', () => {
    const r = checkCarSeat({ ...seat, manufacturedOn: '2026-02-09' }, '2026-10-26', rows as never);
    expect(r.found).toBe(false);
    expect(r.note).toMatch(/26C999000.*made 2026-02-09/);
  });
  it('no date read: found, and asks the parent to check the date on the sticker', () => {
    const r = checkCarSeat(seat, '2026-10-26', rows as never);
    expect(r.found).toBe(true);
    expect(r.note).toMatch(/Check the date of manufacture/);
  });
  it('checkItemRecall passes the date and lot through for CPSC items', async () => {
    const z = { runQuery: async (sql: string) => sql.includes('count(*)')
      ? { rows: [{ n: 9000 }] }
      : { rows: [{ recall_id: 1, recall_date: '2026-06-01', recall_title: 'Trundlemoth recalls TM-ST200 strollers', recall_url: 'https://example.test', recalled_product: 'Trundlemoth City Stroller', recalled_model: 'TM-ST200', description: 'Strollers manufactured between January 1, 2026 and February 28, 2026.' }] } };
    const item = { productName: 'Trundlemoth City Stroller', brand: 'Trundlemoth', modelNumber: 'TM-ST200', upc: null };
    expect((await checkItemRecall({ ...item, manufacturedOn: '2026-03-14' }, '2026-10-26', z)).found).toBe(false);
    expect((await checkItemRecall({ ...item, manufacturedOn: '2026-02-01' }, '2026-10-26', z)).found).toBe(true);
  });
});

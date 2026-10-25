import { checkFinePrint } from '../agents/finePrintRules';
import { buildOfferCheckRow, createOfferCheckWriter } from '../agents/offerChecks';

const check = (text: string) => checkFinePrint(text, { today: '2026-10-23' });
const offer = { id: 12, store: 'Wait Co', sourceUrl: 'https://x.test' };
const TEXT = 'Free gift ($20 value). Mail-in form required. Allow 6-8 weeks for your prepaid card.';

describe('buildOfferCheckRow', () => {
  it('copies the value-and-time grade from the fine print check, with no family field', () => {
    const c = check(TEXT);
    const row = buildOfferCheckRow(offer, c, 'approve_with_catch', ['r1'], 'agreed');
    expect(row).toMatchObject({
      offerId: '12', store: 'Wait Co', sourceUrl: 'https://x.test', finePrintHash: c.finePrintHash, agent: 'fine_print_court',
      faceValueCents: 2000, trueValueCents: 2000, payoutWaitDaysMin: 42, payoutWaitDaysMax: 56,
      verdict: 'approve_with_catch', status: 'agreed', ruleCitations: ['r1'], mailIn: true, effortLevel: c.effortLevel,
    });
    expect(row.effortMinutesEstimate).toBe(c.effortMinutesEstimate.max);
    expect(row.catchSummary).toBe(c.reasons.join('; '));
    expect(Object.keys(row).join(' ')).not.toMatch(/family|income|zip|user/i);
  });

  it('keeps the wait unknown when the fine print gives no range (never invents the other end)', () => {
    const row = buildOfferCheckRow(offer, check('Free gift. Mail-in form required.'), 'approve_with_catch', [], 'agreed');
    expect(row.payoutWaitDaysMin).toBeNull();
    expect(row.payoutWaitDaysMax).toBeNull();
  });
});

describe('offer check writer', () => {
  const fakeDb = () => {
    const values = jest.fn((_r: any) => ({ returning: async () => [{ id: 41 }] }));
    return { values, db: { insert: jest.fn(() => ({ values })) } as any };
  };

  it('writes an agreed row and returns the new row id as text', async () => {
    const { db, values } = fakeDb();
    const w = createOfferCheckWriter(db);
    const id = await w.insert(buildOfferCheckRow(offer, check(TEXT), 'approve_with_catch', [], 'agreed'));
    expect(id).toBe('41');
    expect(values).toHaveBeenCalledTimes(1);
  });

  it('refuses a disputed or pending row, so an unagreed grade can never be reused later', async () => {
    const { db, values } = fakeDb();
    const w = createOfferCheckWriter(db);
    const row = { ...buildOfferCheckRow(offer, check(TEXT), 'reject', [], 'agreed'), status: 'disputed' };
    await expect(w.insert(row as any)).rejects.toThrow(/agreed/);
    expect(values).not.toHaveBeenCalled();
  });
});

// ---- live local Postgres (skipped unless TEST_DATABASE_URL is a local database with the Bundle tables) ----
const TEST_URL = process.env.TEST_DATABASE_URL;
(TEST_URL ? describe : describe.skip)('offer check writer on local Postgres', () => {
  it('inserts an agreed row that the saved-verdict reader can reuse (canSkipAi)', async () => {
    if (!/(localhost|127\.0\.0\.1|\[::1\])/.test(TEST_URL!)) throw new Error('TEST_DATABASE_URL must be a local database');
    const pg = (await import('pg')).default;
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const schema = await import('../../shared/schema');
    const { canSkipAi, fetchSavedVerdicts } = await import('../agents/savedVerdicts');
    const pool = new pg.Pool({ connectionString: TEST_URL });
    try {
      const db = drizzle({ client: pool, schema });
      await pool.query('DELETE FROM offer_checks WHERE offer_id = $1', ['w3court-1']);
      const w = createOfferCheckWriter(db as any);
      const c = check(TEXT);
      const id = await w.insert(buildOfferCheckRow({ ...offer, id: 'w3court-1' }, c, 'approve_with_catch', [], 'agreed'));
      expect(Number(id)).toBeGreaterThan(0);
      const { rows } = await pool.query('SELECT offer_id, status, verdict, true_value_cents, effort_minutes_estimate, steps_count, payout_wait_days_min, payout_wait_days_max, claim_window_days, fine_print_hash FROM offer_checks WHERE id = $1', [id]);
      expect(rows[0]).toMatchObject({ offer_id: 'w3court-1', status: 'agreed', verdict: 'approve_with_catch', true_value_cents: 2000, payout_wait_days_min: 42, payout_wait_days_max: 56 });
      const saved = await fetchSavedVerdicts({ runQuery: async () => ({ rows: rows.map((r: any) => ({ ...r, store: 'Wait Co', rule_citations: '[]', universal_rule: false })) }) } as any, ['w3court-1']);
      expect(canSkipAi(saved.verdicts[0], c.finePrintHash)).toBe('same_fingerprint');
      await pool.query('DELETE FROM offer_checks WHERE id = $1', [id]);
    } finally { await pool.end(); }
  });
});

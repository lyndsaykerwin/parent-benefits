// Runs the real seed() against the Bundle tables in Neon. seed() only ever
// clears and refills Bundle's own tables, so this is safe to repeat.
import { loadEnv } from '../env';

loadEnv();

describe('seed()', () => {
  let db: any;
  let s: any;
  let pool: any;

  beforeAll(async () => {
    const { seed } = await import('../../scripts/seed');
    ({ db, pool } = await import('../db'));
    s = await import('@shared/schema');
    await seed();
  }, 60000);

  afterAll(async () => {
    await pool.end();
  });

  it('creates the three seed families', async () => {
    const rows = await db.select().from(s.families);
    const ids = rows.map((r: any) => r.id).sort();
    expect(ids).toEqual(['ava', 'leo', 'maya']);
    const ava = rows.find((r: any) => r.id === 'ava');
    expect(ava.state).toBe('OH');
    expect(ava.zip).toBe('43215');
  });

  it('has the federal child tax credit rule', async () => {
    const rows = await db.select().from(s.benefitRules);
    expect(rows.map((r: any) => r.code)).toContain('FEDERAL_CHILD_TAX_CREDIT');
    expect(rows.length).toBeGreaterThanOrEqual(7);
  });

  it('gives every curated row a non-empty sourceUrl', async () => {
    for (const table of [s.benefitRules, s.offers, s.fsaEligibleCategories, s.storePolicies]) {
      const rows = await db.select().from(table);
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) expect((r.sourceUrl ?? '').trim()).not.toBe('');
    }
  });

  it('has enough offers, general offers and a trap offer', async () => {
    const rows = await db.select().from(s.offers);
    expect(rows.length).toBeGreaterThanOrEqual(15);
    const general = rows.filter(
      (r: any) => r.triggerKeyword === '' && r.minAgeDays === -280 && r.maxAgeDays === 365,
    );
    expect(general.length).toBeGreaterThanOrEqual(4);
    const trap = rows.find((r: any) => /\$29\.99\/month/.test(r.finePrint)) as any;
    expect(trap).toBeDefined();
    expect(trap.triggerKeyword).toBe('diaper'); // so it ranks into the court's top 5 for a family that buys diapers
    expect(trap.finePrint).not.toMatch(/shipping/i); // the fee must not decide it offline; case law should
  });

  it('seeds fixtures for maya, ava but not leo', async () => {
    const tx = await db.select().from(s.transactions);
    const by = (id: string) => tx.filter((t: any) => t.familyId === id);
    expect(by('maya').length).toBeGreaterThan(0);
    expect(by('ava').length).toBeGreaterThan(0);
    expect(by('leo').length).toBe(0);
    expect(by('maya').some((t: any) => t.amountCents === 2899 && /thermometer/i.test(t.category + t.merchant))).toBe(true);
    expect(by('maya').some((t: any) => t.amountCents < 0)).toBe(true);
    const orders = await db.select().from(s.amazonOrders);
    expect(orders.every((o: any) => o.familyId === 'maya')).toBe(true);
    expect(orders.length).toBeGreaterThan(0);
  });

  it('seeds zip prefixes, poverty guidelines and is repeatable', async () => {
    const zips = await db.select().from(s.zipStates);
    expect(zips.some((z: any) => z.zip3 === '021' && z.state === 'MA')).toBe(true);
    expect(zips.some((z: any) => z.zip3 === '432' && z.state === 'OH')).toBe(true);
    const pg = await db.select().from(s.povertyGuidelines);
    expect(pg.find((p: any) => p.householdSize === 4).annualCents).toBe(3300000);
    const { seed } = await import('../../scripts/seed');
    await seed();
    expect((await db.select().from(s.families)).length).toBe(3);
  }, 60000);
  it('keeps every planted trap in the fixtures', async () => {
    const tx = await db.select().from(s.transactions);
    const maya = tx.filter((t: any) => t.familyId === 'maya');
    const dups = maya.filter((t: any) => t.merchant === 'Walgreens' && t.date === '2026-10-15' && t.amountCents === 3149);
    expect(dups.length).toBe(2);
    expect(new Set(dups.map((d: any) => d.id)).size).toBe(2);
    const daycare = maya.filter((t: any) => t.merchant === 'Bright Horizons');
    expect(daycare.length).toBe(3);
    expect(daycare.every((t: any) => t.amountCents === 185000)).toBe(true);
    expect(maya.some((t: any) => /Pack 'n Play/.test(t.category) && t.amountCents === 8999 && t.merchant === 'Target')).toBe(true);

    const orders = await db.select().from(s.amazonOrders);
    const keawis = orders.find((o: any) => /KEAWIS Crib Mattress/.test(o.title));
    expect(keawis).toBeDefined();
    expect(keawis.familyId).toBe('maya');
    expect(keawis.priceCents).toBe(8999);

    const obs = await db.select().from(s.priceObservations);
    const pnp = obs.find((o: any) => o.store === 'Target' && /Pack 'n Play/.test(o.keyword));
    expect(pnp.priceCents).toBe(6999);
    expect(pnp.priceCents).toBeLessThan(8999);
    for (const o of obs) expect((o.sourceUrl ?? '').trim()).not.toBe('');
  });

  it('pins the fixed ISO dates and cites the poverty guidelines', async () => {
    const fams = await db.select().from(s.families);
    const f = (id: string) => fams.find((x: any) => x.id === id);
    expect(f('maya').birthDate).toBe('2026-10-03');
    expect(f('leo').dueDate).toBe('2026-12-07');
    expect(f('leo').birthDate).toBeNull();
    expect(f('ava').birthDate).toBe('2026-08-24');
    const pg = await db.select().from(s.povertyGuidelines);
    expect(pg.length).toBeGreaterThanOrEqual(8);
    for (const p of pg) {
      expect(p.year).toBe(2026);
      expect(p.sourceUrl).toMatch(/aspe\.hhs\.gov/);
    }
  });
});

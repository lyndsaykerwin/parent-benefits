// The real database store for photo intake, on a throwaway local Postgres (never Neon).
// Skipped with a note unless TEST_DATABASE_URL points at a local database that has the Bundle tables.
const TEST_URL = process.env.TEST_DATABASE_URL;

async function ready(): Promise<boolean> {
  if (!TEST_URL) return false;
  const { Client } = await import('pg');
  const c = new Client({ connectionString: TEST_URL, connectionTimeoutMillis: 1500 });
  try { await c.connect(); await c.query('select 1 from purchase_items limit 1'); return true; }
  catch { return false; } finally { await c.end().catch(() => undefined); }
}

describe('createDbPhotoStore on a local Postgres', () => {
  let ok = false;
  let dbMod: typeof import('../db') | undefined;
  const saved = process.env.DATABASE_URL;

  beforeAll(async () => {
    ok = await ready();
    if (!ok) { console.warn('[photoDb.test] TEST_DATABASE_URL not set or not ready; skipping the live database checks'); return; }
    if (!/(localhost|127\.0\.0\.1|\[::1\])/.test(TEST_URL!)) throw new Error('TEST_DATABASE_URL must be a local database');
    process.env.DATABASE_URL = TEST_URL;
    dbMod = await import('../db');
  });
  afterAll(async () => {
    if (dbMod) await dbMod.pool.end();
    if (saved === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = saved;
  });

  const row = (family: string, hash: string, line: number, source: 'photo_item' | 'email' = 'photo_item') => ({
    familyId: family, source, productName: 'Made-up walker', inputHash: hash, lineIndex: line,
  });

  it('inserts rows, skips a repeat of the same photo line, and forgets ALL of one family only', async () => {
    if (!ok) return;
    const { createDbPhotoStore } = await import('../ingest/photo');
    const store = createDbPhotoStore();
    const tag = `w2photo_${Date.now()}`;
    const a = `${tag}_a`; const b = `${tag}_b`;
    expect(await store.insertItems([row(a, 'h1', 0), row(a, 'h1', 1), row(a, 'h2', 0, 'email'), row(b, 'h1', 0)])).toBe(4);
    expect(await store.insertItems([row(a, 'h1', 0)])).toBe(0); // same family + photo + line: not counted twice
    expect(await store.insertItems([])).toBe(0);
    expect(await store.deleteForFamily(a)).toBe(3); // photo rows and the email row: the plan says all of the family's rows
    expect(await store.deleteForFamily(b)).toBe(1);
  });

  it('background reading: saves a photo as reading, then stores its status, message and result', async () => {
    if (!ok) return;
    const { createDbPhotoStore } = await import('../ingest/photo');
    const store = createDbPhotoStore();
    const fam = `test-lane-c-db-${Date.now()}`;
    const id = await store.savePhoto({ familyId: fam, kind: 'gear', thumbnail: null, receiptImage: null, status: 'reading' });
    expect((await store.getPhoto(id))?.status).toBe('reading');
    await store.updatePhoto(id, { status: 'done', readError: null, readResult: { items: [{ productName: 'Made-up seat' }] } });
    expect(await store.getPhoto(id)).toMatchObject({ status: 'done', readResult: { items: [{ productName: 'Made-up seat' }] } });
    expect(await store.insertItems([{ ...row(fam, 'h9', 0), manufacturedOn: '2026-02-09', photoId: id }])).toBe(1);
    expect((await store.listItems(fam))[0].manufacturedOn).toBe('2026-02-09');
    await store.deleteForFamily(fam);
  });
});

import fs from 'fs';
import path from 'path';
import { ZetarisClient } from '../adapters/zetaris';
import { familyProfileSql } from '../agents/savedVerdicts';
import { familyFromRow, loadFamilyViaZetaris, defaultLoadFamily, loadSampleFamily } from '../agents/orchestrator';
import { SEED_FAMILY_IDS } from '../demoDate';

const cacheDir = path.resolve('data/sample/zetaris-cache');
const sampleZ = (misses?: string[]) => {
  const traced: string[] = [];
  const z = new ZetarisClient({
    baseUrl: 'http://sample-mode.invalid', orgId: 'sample', apiKey: 'sample', timeoutMs: 1000, sampleMode: true, cacheDir,
    trace: { log: (l: any) => { traced.push(`${l.action}|${l.status}`); if (l.status === 'error') misses?.push(l.input_summary); } } as any,
  });
  return { z, traced };
};

const withSampleMode = async (value: string, fn: () => Promise<void>) => {
  const saved = process.env.SAMPLE_MODE;
  process.env.SAMPLE_MODE = value;
  try { await fn(); } finally { if (saved === undefined) delete process.env.SAMPLE_MODE; else process.env.SAMPLE_MODE = saved; }
};

describe('family profile through Zetaris', () => {
  it('uses the existing family-profile question (the one with saved replays)', async () => {
    const asked: string[] = [];
    const z = { runQuery: async (sql: string) => { asked.push(sql); return { headers: [], rows: [], ms: 1 }; } };
    await loadFamilyViaZetaris(z, 'maya').catch(() => undefined);
    expect(asked).toEqual([familyProfileSql('maya')]);
  });

  it('every sample family comes back from the saved replay exactly like the sample file, with no cache misses', async () => {
    const misses: string[] = [];
    const { z, traced } = sampleZ(misses);
    for (const id of SEED_FAMILY_IDS) {
      expect(await loadFamilyViaZetaris(z, id)).toEqual(await loadSampleFamily(id));
    }
    expect(misses).toEqual([]);
    expect(traced).toHaveLength(SEED_FAMILY_IDS.length);
    expect(traced.every((t) => t === 'query_cached|ok')).toBe(true);
  });

  it('turns Zetaris text values into a proper family (booleans, zip with leading zero, empty employer)', () => {
    const f = familyFromRow({
      id: 'x1', is_guest: 'false', name: 'N', birth_date: '2026-10-10 00:00:00', due_date: null, zip: 2446, state: 'MA',
      employer: null, household_size: '3', annual_income_cents: '9000000', dcfsa_offered: 'true', data_connected: 1,
    });
    expect(f).toEqual({
      id: 'x1', userId: null, isGuest: false, name: 'N', birthDate: '2026-10-10', dueDate: null, zip: '02446', state: 'MA',
      employer: '', householdSize: 3, annualIncomeCents: 9000000, dcfsaOffered: true, dataConnected: true,
    });
  });

  it('live mode: Zetaris answers, Neon is not touched', async () => {
    await withSampleMode('false', async () => {
      const { z } = sampleZ();
      const neon = jest.fn();
      const f = await defaultLoadFamily('ava', { z, neon, log: () => undefined });
      expect(f.id).toBe('ava');
      expect(neon).not.toHaveBeenCalled();
    });
  });

  it('live mode: if Zetaris fails, it says so in the log and falls back to Neon', async () => {
    await withSampleMode('false', async () => {
      const z = { runQuery: async () => { throw new Error('Zetaris unreachable'); } };
      const fam = JSON.parse(fs.readFileSync('data/sample/families.json', 'utf8'))[0];
      const neon = jest.fn(async () => fam);
      const lines: string[] = [];
      const f = await defaultLoadFamily('maya', { z, neon, log: (m) => lines.push(m) });
      expect(f).toEqual(fam);
      expect(neon).toHaveBeenCalledWith('maya');
      expect(lines.join(' ')).toMatch(/Zetaris.*Neon/i);
    });
  });

  it('live mode: an empty Zetaris answer also falls back (logged)', async () => {
    await withSampleMode('false', async () => {
      const z = { runQuery: async () => ({ headers: [], rows: [], ms: 1 }) };
      const neon = jest.fn(async () => ({ id: 'maya' } as any));
      const lines: string[] = [];
      await defaultLoadFamily('maya', { z, neon, log: (m) => lines.push(m) });
      expect(neon).toHaveBeenCalled();
      expect(lines).toHaveLength(1);
    });
  });

  it('sample mode reads the saved replay (no Neon)', async () => {
    await withSampleMode('true', async () => {
      const { z } = sampleZ();
      const neon = jest.fn();
      expect(await defaultLoadFamily('noor', { z, neon })).toEqual(await loadSampleFamily('noor'));
      expect(neon).not.toHaveBeenCalled();
    });
  });
});

import path from 'path';
import { ZetarisClient } from './adapters/zetaris';
import { createGenerator, isLiveModel, UnavailableGenerator, type Generator } from './adapters/llm';
import { BundleMemory } from './adapters/memory';
import { defaultLoadFamily, type RunDeps } from './agents/orchestrator';
import { createOfferCheckWriter } from './agents/offerChecks';
import type { OfferCheckWriter } from './agents/types';
import { DrizzleStore, MemoryStore } from './bundleStore';
import { zipStateMap } from './sampleZips';
import type { ApiDeps } from './routes/bundleRoutes';
import type { Family } from '../shared/bundle';
import { resolveToday } from './demoDate';

export const isSampleMode = (): boolean => process.env.SAMPLE_MODE === 'true';

/** Scripts that exist to talk to the real services (run-family, examples:regen --live) pass live: true. The server never does. */
export interface LiveOpts { live?: boolean }

/** The model for a run. SAMPLE_MODE is offline (keys ignored) unless LIVE_MODEL=true asks for the real AI chain. */
export function makeGenerator(opts: LiveOpts = {}): Generator {
  return isSampleMode() && !opts.live && !isLiveModel() ? new UnavailableGenerator('SAMPLE_MODE is on (offline)') : createGenerator();
}

/** Real Zetaris + model + memory for one run. Shared by the API and scripts/run-family.ts. */
export function makeRealRunDeps(memory: BundleMemory, familyId?: string, opts: LiveOpts = {}): Omit<RunDeps, 'loadFamily' | 'runId'> {
  const sample = isSampleMode() && !opts.live;
  const missing = ['ZETARIS_BASE_URL', 'ZETARIS_ORG_ID', 'ZETARIS_API_KEY'].filter((k) => !process.env[k]);
  // SAMPLE_MODE needs no keys and ignores any that are present: Zetaris answers come only from the saved responses
  // in data/sample/zetaris-cache (the client never calls out and never writes the cache in this mode).
  if (missing.length && !sample) throw new Error(`Missing settings: ${missing.join(', ')}`);
  const z = new ZetarisClient({
    baseUrl: process.env.ZETARIS_BASE_URL || 'http://sample-mode.invalid', orgId: process.env.ZETARIS_ORG_ID || 'sample',
    apiKey: process.env.ZETARIS_API_KEY || 'sample',
    timeoutMs: (Number(process.env.SOURCE_TIMEOUT_SECONDS) || 20) * 1000 * 4, sampleMode: sample,
    cacheDir: path.resolve('data/sample/zetaris-cache'),
  });
  // Real runs save agreed court grades to Neon. The database is opened only when a grade is saved (server/db.ts throws without
  // DATABASE_URL), and SAMPLE_MODE never saves.
  const offerChecks: OfferCheckWriter | undefined = sample ? undefined : {
    insert: async (row) => {
      const { db } = await import('./db');
      return createOfferCheckWriter(db).insert(row);
    },
  };
  return { z, llm: makeGenerator(opts), memory, offerChecks, logsDir: path.resolve('logs'), today: familyId ? resolveToday(familyId).today : (process.env.TODAY || resolveToday('maya').today) };
}

export function createDefaultApiDeps(opts: LiveOpts = {}): ApiDeps {
  const memory = new BundleMemory(path.resolve('data/hmem'));
  const llm = makeGenerator(opts);
  return {
    makeRunDeps: (family: Family) => ({ ...makeRealRunDeps(memory, family.id, opts), llm }),
    loadSeedFamily: defaultLoadFamily,
    // SAMPLE_MODE keeps everything in memory (no database); otherwise Neon through Drizzle.
    store: isSampleMode() ? new MemoryStore(zipStateMap()) : new DrizzleStore(),
    memory,
    llm,
    reviewerToken: () => process.env.REVIEWER_MODE_TOKEN ?? '',
  };
}

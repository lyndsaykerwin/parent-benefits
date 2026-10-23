import path from 'path';
import { ZetarisClient } from './adapters/zetaris';
import { createGenerator, UnavailableGenerator, type Generator } from './adapters/llm';
import { BundleMemory } from './adapters/memory';
import { defaultLoadFamily, type RunDeps } from './agents/orchestrator';
import { DrizzleStore, MemoryStore } from './bundleStore';
import { zipStateMap } from './sampleZips';
import type { ApiDeps } from './routes/bundleRoutes';
import type { Family } from '../shared/bundle';
import { resolveToday } from './demoDate';

export const isSampleMode = (): boolean => process.env.SAMPLE_MODE === 'true';

/** The model for a run. SAMPLE_MODE is always offline: keys in the environment or the secrets file are ignored. */
export function makeGenerator(): Generator {
  return isSampleMode() ? new UnavailableGenerator('SAMPLE_MODE is on (offline)') : createGenerator();
}

/** Real Zetaris + model + memory for one run. Shared by the API and scripts/run-family.ts. */
export function makeRealRunDeps(memory: BundleMemory, familyId?: string): Omit<RunDeps, 'loadFamily' | 'runId'> {
  const sample = isSampleMode();
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
  return { z, llm: makeGenerator(), memory, logsDir: path.resolve('logs'), today: familyId ? resolveToday(familyId).today : (process.env.TODAY || resolveToday('maya').today) };
}

export function createDefaultApiDeps(): ApiDeps {
  const memory = new BundleMemory(path.resolve('data/hmem'));
  const llm = makeGenerator();
  return {
    makeRunDeps: (family: Family) => ({ ...makeRealRunDeps(memory, family.id), llm }),
    loadSeedFamily: defaultLoadFamily,
    // SAMPLE_MODE keeps everything in memory (no database); otherwise Neon through Drizzle.
    store: isSampleMode() ? new MemoryStore(zipStateMap()) : new DrizzleStore(),
    memory,
    llm,
    reviewerToken: () => process.env.REVIEWER_MODE_TOKEN ?? '',
  };
}

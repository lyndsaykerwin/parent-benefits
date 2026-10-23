import path from 'path';
import { ZetarisClient } from './adapters/zetaris';
import { createGenerator } from './adapters/llm';
import { BundleMemory } from './adapters/memory';
import { defaultLoadFamily, type RunDeps } from './agents/orchestrator';
import { DrizzleStore } from './bundleStore';
import type { ApiDeps } from './routes/bundleRoutes';
import type { Family } from '../shared/bundle';
import { resolveToday } from './demoDate';

/** Real Zetaris + model + memory for one run. Shared by the API and scripts/run-family.ts. */
export function makeRealRunDeps(memory: BundleMemory, familyId?: string): Omit<RunDeps, 'loadFamily' | 'runId'> {
  const missing = ['ZETARIS_BASE_URL', 'ZETARIS_ORG_ID', 'ZETARIS_API_KEY'].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing settings: ${missing.join(', ')}`);
  const z = new ZetarisClient({
    baseUrl: process.env.ZETARIS_BASE_URL!, orgId: process.env.ZETARIS_ORG_ID!, apiKey: process.env.ZETARIS_API_KEY!,
    timeoutMs: (Number(process.env.SOURCE_TIMEOUT_SECONDS) || 20) * 1000 * 4, sampleMode: false,
    cacheDir: path.resolve('data/sample/zetaris-cache'),
  });
  return { z, llm: createGenerator(), memory, logsDir: path.resolve('logs'), today: familyId ? resolveToday(familyId).today : (process.env.TODAY || resolveToday('maya').today) };
}

export function createDefaultApiDeps(): ApiDeps {
  const memory = new BundleMemory(path.resolve('data/hmem'));
  const llm = createGenerator();
  return {
    makeRunDeps: (family: Family) => ({ ...makeRealRunDeps(memory, family.id), llm }),
    loadSeedFamily: defaultLoadFamily,
    store: new DrizzleStore(),
    memory,
    llm,
    reviewerToken: () => process.env.REVIEWER_MODE_TOKEN ?? '',
  };
}

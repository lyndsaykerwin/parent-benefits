import os from 'os';
import fs from 'fs';
import path from 'path';
import { makeRealRunDeps, createDefaultApiDeps } from '../bundleDeps';
import { ZetarisClient } from '../adapters/zetaris';
import { ModelUnavailable } from '../adapters/llm';
import { BundleMemory } from '../adapters/memory';

// SAMPLE_MODE means offline, no matter which keys are present in the environment or the secrets file.
describe('SAMPLE_MODE is offline even when real keys are present', () => {
  const saved = { ...process.env };
  const realFetch = global.fetch;
  let fetchCalls: string[];
  beforeEach(() => {
    fetchCalls = [];
    global.fetch = (async (url: any) => { fetchCalls.push(String(url)); throw new Error('network call in SAMPLE_MODE'); }) as typeof fetch;
    Object.assign(process.env, {
      SAMPLE_MODE: 'true', ZETARIS_BASE_URL: 'https://zetaris.example.test', ZETARIS_ORG_ID: 'org-test',
      ZETARIS_API_KEY: 'test-key', MODEL_API_KEY: 'test-model-key', MODEL_REASONING: 'm-r', MODEL_FAST: 'm-f',
    });
  });
  afterEach(() => { process.env = { ...saved }; global.fetch = realFetch; });

  it('the Zetaris client from the factory never calls out and never writes the cache', async () => {
    const memory = new BundleMemory(fs.mkdtempSync(path.join(os.tmpdir(), 'off-mem-')));
    const deps = makeRealRunDeps(memory, 'maya');
    const cacheDir = path.resolve('data/sample/zetaris-cache');
    const before = fs.readdirSync(cacheDir).sort();
    await expect(deps.z.runQuery('SELECT no_such_saved_query_' + Date.now())).rejects.toThrow(/sample mode/i);
    expect(fetchCalls).toEqual([]);
    expect(fs.readdirSync(cacheDir).sort()).toEqual(before);
  });

  it('a client built with sampleMode never calls its fetch even on a cache miss', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'off-cache-'));
    const fetchFn = jest.fn(async () => { throw new Error('should not be called'); });
    const c = new ZetarisClient({ baseUrl: 'https://x.test', orgId: 'o', apiKey: 'k', timeoutMs: 1000, sampleMode: true, cacheDir: dir, fetchFn: fetchFn as any });
    await expect(c.runQuery('SELECT 1')).rejects.toBeDefined();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('the model generator is offline (every call says unavailable, no network)', async () => {
    const memory = new BundleMemory(fs.mkdtempSync(path.join(os.tmpdir(), 'off-mem2-')));
    await expect(makeRealRunDeps(memory, 'maya').llm.generate('hi')).rejects.toBeInstanceOf(ModelUnavailable);
    await expect(createDefaultApiDeps().llm.generate('hi')).rejects.toBeInstanceOf(ModelUnavailable);
    expect(fetchCalls).toEqual([]);
  });

  it('without SAMPLE_MODE the factory still builds a live client (guard is not too broad)', () => {
    process.env.SAMPLE_MODE = 'false';
    const memory = new BundleMemory(fs.mkdtempSync(path.join(os.tmpdir(), 'off-mem3-')));
    const deps = makeRealRunDeps(memory, 'maya');
    expect((deps.z as any).opts.sampleMode).toBe(false);
  });
});

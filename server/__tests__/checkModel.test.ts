import fs from 'fs';
import os from 'os';
import path from 'path';
import { pickModels, updateEnvText, writeEnvFileAtomic } from '../../scripts/check-model';
import { llmModeOf, llmCallsOf, preflightModel } from '../../scripts/eval';
import { FakeGenerator, NvidiaGenerator, UnavailableGenerator } from '../adapters/llm';

const payload = {
  data: [
    { id: 'meta/llama-3.3-70b-instruct' },
    { id: 'nvidia/llama-3.1-nemotron-70b-instruct' },
    { id: 'nvidia/llama-3.3-nemotron-super-49b-v1' },
    { id: 'nvidia/llama-3.3-nemotron-super-49b-v1.5' },
    { id: 'nvidia/llama-3.1-nemotron-nano-8b-v1' },
    { id: 'nvidia/nemotron-nano-9b-v2' },
    { id: 'nvidia/llama-3.2-nemoretriever-embed' },
    { id: 'nvidia/llama-3.2-nv-embedqa-1b-v2' },
    { id: 'nvidia/nemotron-4-340b-reward' },
    { id: 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1' },
  ],
};

describe('pickModels', () => {
  const ids = payload.data.map((m) => m.id);

  it('lists only nemotron ids and prefers super for reasoning, nano for fast', () => {
    const p = pickModels(ids);
    expect(p.nemotron).toContain('nvidia/nemotron-nano-9b-v2');
    expect(p.nemotron).not.toContain('meta/llama-3.3-70b-instruct');
    expect(p.reasoning).toBe('nvidia/llama-3.3-nemotron-super-49b-v1.5');
    expect(p.fast).toBe('nvidia/nemotron-nano-9b-v2');
  });

  it('ranks every candidate best-first so a listed-but-uncallable model can be skipped', () => {
    const p = pickModels([...ids, 'nvidia/nemotron-nano-3-30b-a3b', 'nvidia/nemotron-3.5-lightning-30b-a3b']);
    expect(p.fastRanked?.[0]).toBe('nvidia/nemotron-nano-9b-v2');
    expect(p.fastRanked).toContain('nvidia/nemotron-3.5-lightning-30b-a3b');
    expect(p.reasoningRanked?.[0]).toBe(p.reasoning);
  });

  it('prefers ultra over super', () => {
    expect(pickModels([...ids, 'nvidia/llama-3.1-nemotron-ultra-253b-v1']).reasoning).toBe('nvidia/llama-3.1-nemotron-ultra-253b-v1');
  });

  it('never suggests embedding, reward or vision models', () => {
    const p = pickModels(['nvidia/nemotron-4-340b-reward', 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1', 'nvidia/llama-3.2-nemoretriever-embed']);
    expect(p.reasoning).toBeNull();
    expect(p.fast).toBeNull();
  });

  it('returns nothing for an empty or unrelated list', () => {
    expect(pickModels([])).toMatchObject({ nemotron: [], reasoning: null, fast: null });
    expect(pickModels(['meta/llama-3.3-70b-instruct']).reasoning).toBeNull();
  });
});

describe('updateEnvText', () => {
  it('replaces the two lines in place and leaves everything else alone', () => {
    const before = 'A=1\nMODEL_REASONING=\nB=2\nMODEL_FAST=old\n';
    expect(updateEnvText(before, { MODEL_REASONING: 'r', MODEL_FAST: 'f' })).toBe('A=1\nMODEL_REASONING=r\nB=2\nMODEL_FAST=f\n');
  });
  it('appends missing lines', () => {
    expect(updateEnvText('A=1', { MODEL_FAST: 'f' })).toBe('A=1\nMODEL_FAST=f\n');
  });
});

describe('scoreboard llmMode', () => {
  it('stays honest with no key or a scripted model', () => {
    expect(llmModeOf(new UnavailableGenerator('x'))).toBe('offline-fallback');
    expect(llmModeOf(new FakeGenerator(['{}']))).toBe('fake-llm');
  });
});

const fakeClient = (fn: () => Promise<any>) => ({ chat: { completions: { create: fn } } });
const good = async () => ({ choices: [{ message: { content: 'ok' } }] });
const bad = async () => { throw new Error('boom'); };

describe('llmMode only claims a model that really answered', () => {
  it('counts ok and failed calls', async () => {
    let n = 0;
    const g = new NvidiaGenerator('k', 'http://x', { reasoning: 'r', fast: 'f' }, fakeClient(() => (n++ === 1 ? bad() : good())));
    await g.generate('a');
    await expect(g.generate('b')).rejects.toThrow();
    await g.generate('c');
    expect(llmCallsOf(g)).toEqual({ ok: 2, failed: 1 });
    expect(llmModeOf(g)).toBe('nvidia-partial:r+f');
  });
  it('all ok is nvidia:, all failed is offline-fallback, no calls is not a real-model claim', async () => {
    const ok = new NvidiaGenerator('k', 'http://x', { reasoning: 'r', fast: 'f' }, fakeClient(good));
    await ok.generate('a');
    expect(llmModeOf(ok)).toBe('nvidia:r+f');
    const dead = new NvidiaGenerator('k', 'http://x', { reasoning: 'r', fast: 'f' }, fakeClient(bad));
    await expect(dead.generate('a')).rejects.toThrow();
    expect(llmModeOf(dead)).toBe('offline-fallback');
    expect(llmModeOf(new NvidiaGenerator('k', 'http://x', { reasoning: 'r', fast: 'f' }, fakeClient(good)))).toBe('offline-fallback');
    expect(llmCallsOf(new FakeGenerator(['x']))).toBeNull();
  });
});

describe('preflightModel', () => {
  it('fails with no key', async () => {
    expect(await preflightModel(new UnavailableGenerator('no key'))).toMatch(/Nothing was changed/);
  });
  it('fails when a test call fails', async () => {
    expect(await preflightModel(new NvidiaGenerator('k', 'http://x', { reasoning: 'r', fast: 'f' }, fakeClient(bad)))).toMatch(/failed: boom/);
  });
  it('passes and resets the counters so test calls are not counted in the eval', async () => {
    const g = new NvidiaGenerator('k', 'http://x', { reasoning: 'r', fast: 'f' }, fakeClient(good));
    expect(await preflightModel(g)).toBeNull();
    expect(g.stats).toEqual({ ok: 0, failed: 0 });
  });
});

describe('writeEnvFileAtomic', () => {
  it('updates the two lines, keeps permissions and leaves no temp file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envw-'));
    const file = path.join(dir, 'x.env');
    fs.writeFileSync(file, 'KEEP=1\nMODEL_FAST=\n', { mode: 0o600 });
    fs.chmodSync(file, 0o600);
    writeEnvFileAtomic(file, { MODEL_REASONING: 'r', MODEL_FAST: 'f' });
    expect(fs.readFileSync(file, 'utf8')).toBe('KEEP=1\nMODEL_FAST=f\nMODEL_REASONING=r\n');
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(fs.readdirSync(dir)).toEqual(['x.env']);
  });
});

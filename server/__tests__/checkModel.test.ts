import { pickModels, updateEnvText } from '../../scripts/check-model';
import { llmModeOf } from '../../scripts/eval';
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

  it('prefers ultra over super', () => {
    expect(pickModels([...ids, 'nvidia/llama-3.1-nemotron-ultra-253b-v1']).reasoning).toBe('nvidia/llama-3.1-nemotron-ultra-253b-v1');
  });

  it('never suggests embedding, reward or vision models', () => {
    const p = pickModels(['nvidia/nemotron-4-340b-reward', 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1', 'nvidia/llama-3.2-nemoretriever-embed']);
    expect(p.reasoning).toBeNull();
    expect(p.fast).toBeNull();
  });

  it('returns nothing for an empty or unrelated list', () => {
    expect(pickModels([])).toEqual({ nemotron: [], reasoning: null, fast: null });
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
  it('records the model ids when a real NVIDIA model is behind the run', () => {
    const g = new NvidiaGenerator('k', 'http://x', { reasoning: 'r-id', fast: 'f-id' }, { chat: { completions: { create: async () => ({ choices: [] }) } } });
    expect(llmModeOf(g)).toBe('nvidia:r-id+f-id');
  });
  it('stays honest with no key or a scripted model', () => {
    expect(llmModeOf(new UnavailableGenerator('x'))).toBe('offline-fallback');
    expect(llmModeOf(new FakeGenerator(['{}']))).toBe('fake-llm');
  });
});

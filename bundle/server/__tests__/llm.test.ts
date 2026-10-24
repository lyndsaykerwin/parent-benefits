import { FakeGenerator, NvidiaGenerator, askJson, createGenerator, generatorConfigFromEnv, ModelUnavailable } from '../adapters/llm';

type Ok = { ok: boolean };
const isOk = (x: unknown): x is Ok => typeof x === 'object' && x !== null && typeof (x as Ok).ok === 'boolean';

describe('askJson', () => {
  it('retries once after bad JSON and returns the parsed value', async () => {
    const g = new FakeGenerator(['not json', '{"ok":true}']);
    const r = await askJson(g, 'p', isOk, { ok: false });
    expect(r).toEqual({ value: { ok: true }, usedFallback: false });
    expect(g.calls).toBe(2);
  });

  it('returns the fallback after exactly 2 failed calls', async () => {
    const g = new FakeGenerator(['x', 'y']);
    const r = await askJson(g, 'p', isOk, { ok: false });
    expect(r).toEqual({ value: { ok: false }, usedFallback: true });
    expect(g.calls).toBe(2);
  });

  it('rejects JSON that fails validation', async () => {
    const g = new FakeGenerator(['{"nope":1}', '{"also":2}']);
    const r = await askJson(g, 'p', isOk, { ok: false });
    expect(r.usedFallback).toBe(true);
  });

  it('accepts JSON wrapped in a code fence', async () => {
    const g = new FakeGenerator(['```json\n{"ok":true}\n```']);
    const r = await askJson(g, 'p', isOk, { ok: false });
    expect(r).toEqual({ value: { ok: true }, usedFallback: false });
  });

  it('falls back at once when the model is unavailable', async () => {
    const g = createGenerator({ apiKey: '', baseUrl: 'http://x', reasoning: '', fast: '' });
    await expect(g.generate('hi')).rejects.toBeInstanceOf(ModelUnavailable);
    const r = await askJson(g, 'p', isOk, { ok: false });
    expect(r).toEqual({ value: { ok: false }, usedFallback: true });
  });

  it('falls back when the generator throws any error', async () => {
    const g = { generate: async () => { throw new Error('boom'); } };
    const r = await askJson(g, 'p', isOk, { ok: false });
    expect(r.usedFallback).toBe(true);
  });
});

describe('NvidiaGenerator', () => {
  it('sends the right model, system and user messages to an injected client', async () => {
    const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: 'hello' } }] });
    const client = { chat: { completions: { create } } };
    const g = new NvidiaGenerator('k', 'http://base', { reasoning: 'R-model', fast: 'F-model' }, client);
    expect(await g.generate('hi', 'be brief', 'fast')).toBe('hello');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      model: 'F-model',
      messages: [{ role: 'system', content: 'be brief' }, { role: 'user', content: 'hi' }],
    }));
    await g.generate('hi');
    expect(create.mock.calls[1][0].model).toBe('R-model');
    expect(create.mock.calls[1][0].messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('throws ModelUnavailable when the client call fails or returns nothing', async () => {
    const bad = { chat: { completions: { create: jest.fn().mockRejectedValue(new Error('net')) } } };
    const g = new NvidiaGenerator('k', 'u', { reasoning: 'r', fast: 'f' }, bad);
    await expect(g.generate('x')).rejects.toBeInstanceOf(ModelUnavailable);
    const empty = { chat: { completions: { create: jest.fn().mockResolvedValue({ choices: [] }) } } };
    const g2 = new NvidiaGenerator('k', 'u', { reasoning: 'r', fast: 'f' }, empty);
    await expect(g2.generate('x')).rejects.toBeInstanceOf(ModelUnavailable);
  });

  it('createGenerator with a key and model ids gives a working NvidiaGenerator', () => {
    const g = createGenerator({ apiKey: 'k', baseUrl: 'http://x', reasoning: 'r', fast: 'f' });
    expect(g).toBeInstanceOf(NvidiaGenerator);
  });

  it('generatorConfigFromEnv uses SOURCE_TIMEOUT_SECONDS (default 20)', () => {
    expect(generatorConfigFromEnv({}).timeoutMs).toBe(20000);
    expect(generatorConfigFromEnv({ SOURCE_TIMEOUT_SECONDS: '5' }).timeoutMs).toBe(5000);
  });

  it('createGenerator with a key but missing model ids is unavailable', async () => {
    const g = createGenerator({ apiKey: 'k', baseUrl: 'http://x', reasoning: '', fast: '' });
    await expect(g.generate('x')).rejects.toBeInstanceOf(ModelUnavailable);
  });
});

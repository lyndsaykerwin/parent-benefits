import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { llmModeOf } from '../../scripts/eval';
import {
  FakeGenerator, NvidiaGenerator, OpenAICompatGenerator, ChainGenerator, askJson, createGenerator,
  generatorConfigFromEnv, ModelUnavailable, withRunDeadline, NIGHTSHIFT_HEADERS, providerLabel, isLiveModel,
} from '../adapters/llm';
import { startFakeOpenAiServer, type FakeOpenAiServer } from './helpers/fakeOpenAiServer';
import { checkNightshift } from '../../scripts/check-model';

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
    }), expect.objectContaining({ timeout: 90000 }));
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

  it('generatorConfigFromEnv uses MODEL_TIMEOUT_SECONDS (default 90) for NVIDIA direct', () => {
    expect(generatorConfigFromEnv({}).timeoutMs).toBe(90000);
    expect(generatorConfigFromEnv({ MODEL_TIMEOUT_SECONDS: '5' }).timeoutMs).toBe(5000);
  });

  it('createGenerator with a key but missing model ids is unavailable', async () => {
    const g = createGenerator({ apiKey: 'k', baseUrl: 'http://x', reasoning: '', fast: '' });
    await expect(g.generate('x')).rejects.toBeInstanceOf(ModelUnavailable);
  });
});

describe('OpenAI-compatible providers against a fake server', () => {
  let srv: FakeOpenAiServer;
  afterEach(async () => { await srv?.close(); });

  const nightshift = (timeoutMs = 2000) =>
    new OpenAICompatGenerator('tok', srv.baseUrl, { reasoning: 'meterless/text.deep', fast: 'meterless/text.fast' }, undefined, timeoutMs,
      { provider: 'nightshift', headers: NIGHTSHIFT_HEADERS, retryDelayMs: 0 });
  const nvidia = (baseUrl: string, timeoutMs = 2000, extra: Record<string, unknown> = {}) =>
    new OpenAICompatGenerator('k', baseUrl, { reasoning: 'nvidia/nemotron-3-super', fast: 'nvidia/nano' }, undefined, timeoutMs,
      { provider: 'nvidia', retryDelayMs: 0, ...extra });

  it('sends the Nightshift labels and token, a reply cap, and records who answered', async () => {
    srv = await startFakeOpenAiServer({ token: 'tok', script: [{ kind: 'reply', content: 'hi', model: 'nvidia/nemotron-x' }] });
    const g = nightshift();
    expect(await g.generate('q')).toBe('hi');
    const r = srv.requests[0];
    expect(r.headers['meterless-app']).toBe('bundle');
    expect(r.headers['meterless-scope']).toBe('user');
    expect(r.headers.authorization).toBe('Bearer tok');
    expect(r.body.max_tokens).toBe(4096);
    expect(g.lastAnswer).toEqual(expect.objectContaining({ provider: 'nightshift', model: 'nvidia/nemotron-x' }));
    expect(g.stats.ok).toBe(1);
    expect(providerLabel(g.lastAnswer!)).toBe('nightshift:meterless/text.deep→nvidia/nemotron-x');
  });

  it('stops a hung call at the limit (then retries once, then gives up)', async () => {
    srv = await startFakeOpenAiServer({ script: [{ kind: 'hang' }] });
    const g = nightshift(300);
    const t0 = Date.now();
    await expect(g.generate('q')).rejects.toBeInstanceOf(ModelUnavailable);
    expect(Date.now() - t0).toBeLessThan(2500);
    expect(srv.requests.length).toBe(2);
    expect(g.stats.failed).toBe(1);
    expect(g.details.retried).toBe(1);
  });

  it('retries once after a server error and succeeds', async () => {
    srv = await startFakeOpenAiServer({ script: [{ kind: 'status', status: 503 }, { kind: 'reply', content: 'second' }] });
    const g = nightshift();
    expect(await g.generate('q')).toBe('second');
    expect(srv.requests.length).toBe(2);
    expect(g.stats.ok).toBe(1);
    expect(g.details).toEqual({ retried: 1, answeredBy: ['meterless/text.deep'] });
  });

  it('does not retry a wrong password (401) and marks it as an auth failure', async () => {
    srv = await startFakeOpenAiServer({ token: 'right' });
    const g = nightshift();
    const err = await g.generate('q').catch((e) => e);
    expect(err).toBeInstanceOf(ModelUnavailable);
    expect(err.reason).toBe('auth');
    expect(srv.requests.length).toBe(1);
  });

  it('NVIDIA direct with thinking off sends enable_thinking false and no Nightshift labels', async () => {
    srv = await startFakeOpenAiServer();
    const g = nvidia(srv.baseUrl, 2000, { thinking: 'off', maxTokens: 1234 });
    await g.generate('q');
    const r = srv.requests[0];
    expect(r.body.chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(r.body.max_tokens).toBe(1234);
    expect(r.headers['meterless-app']).toBeUndefined();
  });

  it('see() sends an image to the vision model and returns text', async () => {
    srv = await startFakeOpenAiServer({ script: [{ kind: 'reply', content: '{"items":[]}' }] });
    const g = nvidia(srv.baseUrl, 2000, { vision: { item: 'nvidia/omni', receipt: 'nvidia/vl-12b' } });
    const out = await g.see({ prompt: 'read this', imageBase64: 'AAAA', mimeType: 'image/jpeg', kind: 'receipt' });
    expect(out).toBe('{"items":[]}');
    const body = srv.requests[0].body;
    expect(body.model).toBe('nvidia/vl-12b');
    const parts = body.messages[body.messages.length - 1].content;
    expect(parts).toEqual(expect.arrayContaining([
      { type: 'text', text: 'read this' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } },
    ]));
    await g.see({ prompt: 'x', imageBase64: 'B', mimeType: 'image/png' });
    expect(srv.requests[1].body.model).toBe('nvidia/omni');
  });

  it('see() without a vision model setting is unavailable', async () => {
    srv = await startFakeOpenAiServer();
    await expect(nvidia(srv.baseUrl).see({ prompt: 'x', imageBase64: 'A', mimeType: 'image/png' })).rejects.toBeInstanceOf(ModelUnavailable);
  });
});

describe('ChainGenerator (Nightshift → NVIDIA direct → offline)', () => {
  const servers: FakeOpenAiServer[] = [];
  afterEach(async () => { while (servers.length) await servers.pop()!.close(); });
  const mk = async (o: Parameters<typeof startFakeOpenAiServer>[0]) => { const s = await startFakeOpenAiServer(o); servers.push(s); return s; };
  const gen = (provider: 'nightshift' | 'nvidia', baseUrl: string, token = 't') =>
    new OpenAICompatGenerator(token, baseUrl, { reasoning: 'r', fast: 'f' }, undefined, 300,
      { provider, headers: provider === 'nightshift' ? NIGHTSHIFT_HEADERS : undefined, retryDelayMs: 0 });

  it('uses Nightshift when it answers', async () => {
    const ns = await mk({ script: [{ kind: 'reply', content: 'from-ns' }] });
    const nv = await mk({ script: [{ kind: 'reply', content: 'from-nv' }] });
    const c = new ChainGenerator([gen('nightshift', ns.baseUrl), gen('nvidia', nv.baseUrl)]);
    expect(await c.generate('q')).toBe('from-ns');
    expect(nv.requests.length).toBe(0);
  });

  it('falls to NVIDIA when Nightshift rejects the token, and stops asking Nightshift for the rest of the run', async () => {
    const ns = await mk({ token: 'right' });
    const nv = await mk({ script: [{ kind: 'reply', content: 'from-nv' }] });
    const c = new ChainGenerator([gen('nightshift', ns.baseUrl, 'wrong'), gen('nvidia', nv.baseUrl)]);
    expect(await c.generate('q')).toBe('from-nv');
    expect(await c.generate('q2')).toBe('from-nv');
    expect(ns.requests.length).toBe(1);
    expect(c.lastAnswer?.provider).toBe('nvidia');
  });

  it('falls to NVIDIA when Nightshift is not running (connection refused)', async () => {
    const nv = await mk({ script: [{ kind: 'reply', content: 'from-nv' }] });
    const c = new ChainGenerator([gen('nightshift', 'http://127.0.0.1:1/v1'), gen('nvidia', nv.baseUrl)]);
    expect(await c.generate('q')).toBe('from-nv');
  });

  it('throws ModelUnavailable when both fail, so askJson uses the offline text', async () => {
    const ns = await mk({ script: [{ kind: 'status', status: 500 }] });
    const nv = await mk({ script: [{ kind: 'status', status: 500 }] });
    const c = new ChainGenerator([gen('nightshift', ns.baseUrl), gen('nvidia', nv.baseUrl)]);
    await expect(c.generate('q')).rejects.toBeInstanceOf(ModelUnavailable);
    const r = await askJson(c, 'p', isOk, { ok: false });
    expect(r.usedFallback).toBe(true);
  });

  it('scoreboard label names the provider that really answered (Nightshift down, NVIDIA answers)', async () => {
    const ns = await mk({ script: [{ kind: 'status', status: 500 }] });
    const nv = await mk({ script: [{ kind: 'reply', content: 'from-nv' }] });
    const nsGen = new OpenAICompatGenerator('t', ns.baseUrl, { reasoning: 'meterless/text.deep', fast: 'meterless/text.fast' }, undefined, 300,
      { provider: 'nightshift', headers: NIGHTSHIFT_HEADERS, retryDelayMs: 0 });
    const nvGen = new OpenAICompatGenerator('t', nv.baseUrl, { reasoning: 'nvidia/nemotron-3-super', fast: 'nvidia/nano' }, undefined, 300,
      { provider: 'nvidia', retryDelayMs: 0 });
    const c = new ChainGenerator([nsGen, nvGen]);
    expect(await c.generate('q')).toBe('from-nv');
    const mode = llmModeOf(c);
    expect(mode).toBe('nvidia-direct:nvidia/nemotron-3-super+nvidia/nano');
    expect(mode).not.toContain('meterless');
  });

  it('scoreboard label says mixed (with counts) when both providers answered in one eval', async () => {
    const ns = await mk({ script: [{ kind: 'reply', content: 'a' }, { kind: 'status', status: 500 }] });
    const nv = await mk({ script: [{ kind: 'reply', content: 'b' }] });
    const c = new ChainGenerator([gen('nightshift', ns.baseUrl), gen('nvidia', nv.baseUrl)]);
    expect(await c.generate('q1')).toBe('a');
    expect(await c.generate('q2')).toBe('b');
    expect(llmModeOf(c)).toBe('mixed:nightshift=1(r+f),nvidia-direct=1(r+f)');
  });

  it('scoreboard label is offline-fallback when nothing answered, and -partial when some calls got no answer', async () => {
    const ns = await mk({ script: [{ kind: 'status', status: 500 }] });
    const nv = await mk({ script: [{ kind: 'status', status: 500 }] });
    const c = new ChainGenerator([gen('nightshift', ns.baseUrl), gen('nvidia', nv.baseUrl)]);
    await expect(c.generate('q')).rejects.toBeInstanceOf(ModelUnavailable);
    expect(llmModeOf(c)).toBe('offline-fallback');
    const ns2 = await mk({ script: [{ kind: 'reply', content: 'a' }, { kind: 'status', status: 500 }] });
    const nv2 = await mk({ script: [{ kind: 'status', status: 500 }] });
    const c2 = new ChainGenerator([gen('nightshift', ns2.baseUrl), gen('nvidia', nv2.baseUrl)]);
    expect(await c2.generate('q1')).toBe('a');
    await expect(c2.generate('q2')).rejects.toBeInstanceOf(ModelUnavailable);
    expect(llmModeOf(c2)).toBe('nightshift-partial:r+f');
  });

  it('refuses new calls after the run deadline', async () => {
    const nv = await mk({ script: [{ kind: 'reply', content: 'x' }] });
    const c = new ChainGenerator([gen('nvidia', nv.baseUrl)], { runDeadlineMs: 50 });
    c.startRun();
    await new Promise((r) => setTimeout(r, 80));
    const err = await c.generate('q').catch((e) => e);
    expect(err).toBeInstanceOf(ModelUnavailable);
    expect(err.reason).toBe('deadline');
    expect(nv.requests.length).toBe(0);
  });
});

describe('ChainGenerator run clock (long server uptime)', () => {
  afterEach(() => { jest.useRealTimers(); });
  const okClient = () => ({ chat: { completions: { create: jest.fn().mockResolvedValue({ choices: [{ message: { content: 'ok' } }] }) } } });

  it('startRun() resets every provider clock, so calls work after 5+ minutes of uptime', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-24T12:00:00Z') });
    const mkP = (provider: 'nightshift' | 'nvidia') =>
      new OpenAICompatGenerator('k', 'http://x', { reasoning: 'r', fast: 'f' }, okClient(), 1000, { provider, runDeadlineMs: 300_000, retryDelayMs: 0 });
    const c = new ChainGenerator([mkP('nightshift'), mkP('nvidia')], { runDeadlineMs: 300_000 });
    jest.setSystemTime(new Date('2026-10-24T12:06:00Z')); // 6 minutes after the chain (and providers) were built
    c.startRun();
    await expect(c.generate('q')).resolves.toBe('ok');
    expect(c.lastAnswer?.provider).toBe('nightshift');
  });

  it('the Generator interface exposes startRun so callers can reset any generator', () => {
    const g: import('../adapters/llm').Generator = new ChainGenerator([]);
    expect(typeof g.startRun).toBe('function');
  });
});

describe('ChainGenerator.see without a vision provider', () => {
  it('fails with a clear config error and makes no call', async () => {
    const create = jest.fn();
    const p = new OpenAICompatGenerator('k', 'http://x', { reasoning: 'r', fast: 'f' }, { chat: { completions: { create } } }, 1000, { provider: 'nightshift' });
    const c = new ChainGenerator([p]);
    const err = await c.see({ prompt: 'x', imageBase64: 'A', mimeType: 'image/png' }).catch((e) => e);
    expect(err).toBeInstanceOf(ModelUnavailable);
    expect(err.reason).toBe('config');
    expect(err.message).toMatch(/vision model/);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('withRunDeadline', () => {
  it('returns the value when in time and throws ModelUnavailable when late', async () => {
    expect(await withRunDeadline(Promise.resolve(1), 100)).toBe(1);
    await expect(withRunDeadline(new Promise(() => {}), 20)).rejects.toBeInstanceOf(ModelUnavailable);
  });

  it('reports "deadline" even with a custom label, unless a reason is given', async () => {
    const e1 = (await withRunDeadline(new Promise(() => {}), 10, 'family run').catch((e) => e)) as ModelUnavailable;
    expect(e1.reason).toBe('deadline');
    expect(e1.message).toMatch(/family run/);
    const e2 = (await withRunDeadline(new Promise(() => {}), 10, 'call time limit', 'timeout').catch((e) => e)) as ModelUnavailable;
    expect(e2.reason).toBe('timeout');
  });
});

describe('settings → chain', () => {
  it('reads the Nightshift token from NIGHTSHIFT_TOKEN_FILE and builds the chain in auto mode', () => {
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ns-')), 'proxy-token');
    fs.writeFileSync(f, 'secret-token\n');
    const cfg = generatorConfigFromEnv({ NIGHTSHIFT_TOKEN_FILE: f, MODEL_API_KEY: 'k', MODEL_REASONING: 'r', MODEL_FAST: 'f' });
    expect(cfg.provider).toBe('auto');
    expect(cfg.nightshift?.token).toBe('secret-token');
    expect(cfg.nightshift?.baseUrl).toBe('http://127.0.0.1:8088/v1');
    expect(cfg.nightshift?.timeoutMs).toBe(180000);
    expect(cfg.nightshift?.reasoning).toBe('meterless/text.deep');
    expect(cfg.maxTokens).toBe(4096);
    expect(cfg.thinking).toBe('off');
    const g = createGenerator(cfg);
    expect(g).toBeInstanceOf(ChainGenerator);
    expect((g as ChainGenerator).providers.map((p) => p.provider)).toEqual(['nightshift', 'nvidia']);
  });

  it('warns on stderr (path, never a token) when NIGHTSHIFT_TOKEN_FILE cannot be read, and skips Nightshift', () => {
    const missing = path.join(os.tmpdir(), 'ns-missing-dir-xyz', 'proxy-token');
    const spy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const cfg = generatorConfigFromEnv({ NIGHTSHIFT_TOKEN_FILE: missing, NIGHTSHIFT_TOKEN: 'env-secret', MODEL_API_KEY: 'k', MODEL_REASONING: 'r', MODEL_FAST: 'f' });
      expect(cfg.nightshift?.token).toBe('');
      const out = spy.mock.calls.map((c) => String(c[0])).join('');
      expect(out).toContain(missing);
      expect(out).toMatch(/warning/i);
      expect(out).not.toContain('env-secret');
      expect(createGenerator(cfg)).toBeInstanceOf(NvidiaGenerator);
    } finally {
      spy.mockRestore();
    }
  });

  it('checkNightshift says "not-running" when nothing listens at the address', async () => {
    const r = await checkNightshift('http://127.0.0.1:1/v1', 'tok', 2000);
    expect(r.status).toBe('not-running');
  });

  it('MODEL_PROVIDER=nvidia skips Nightshift; offline gives the unavailable generator', async () => {
    const env = { NIGHTSHIFT_TOKEN: 't', MODEL_API_KEY: 'k', MODEL_REASONING: 'r', MODEL_FAST: 'f' };
    const g = createGenerator(generatorConfigFromEnv({ ...env, MODEL_PROVIDER: 'nvidia' }));
    expect(g).toBeInstanceOf(NvidiaGenerator);
    const off = createGenerator(generatorConfigFromEnv({ ...env, MODEL_PROVIDER: 'offline' }));
    await expect(off.generate('x')).rejects.toBeInstanceOf(ModelUnavailable);
  });

  it('reads vision and judge settings with the approved defaults', () => {
    const cfg = generatorConfigFromEnv({});
    expect(cfg.vision).toEqual({ item: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', receipt: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning' });
    expect(cfg.judge).toBe('');
    expect(generatorConfigFromEnv({ MODEL_VISION: 'a', MODEL_VISION_RECEIPT: 'b', MODEL_JUDGE: 'j' })).toEqual(
      expect.objectContaining({ vision: { item: 'a', receipt: 'b' }, judge: 'j' }));
  });

  it('isLiveModel follows LIVE_MODEL=true', () => {
    expect(isLiveModel({ LIVE_MODEL: 'true' })).toBe(true);
    expect(isLiveModel({})).toBe(false);
  });
});

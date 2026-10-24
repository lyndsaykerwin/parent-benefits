import fs from 'node:fs';
import OpenAI from 'openai';

/**
 * The AI adapter. Every AI question goes through here.
 * Provider order (a setting, MODEL_PROVIDER=auto): Meterless Nightshift on the Mac → NVIDIA Nemotron direct →
 * the agent's saved offline text (callers catch ModelUnavailable and use their fallback).
 */

export type ModelMode = 'reasoning' | 'fast' | 'judge';
export type ProviderName = 'nightshift' | 'nvidia';

export interface SeeRequest {
  prompt: string;
  imageBase64: string;
  mimeType: string;
  /** 'receipt' uses MODEL_VISION_RECEIPT; anything else uses MODEL_VISION. */
  kind?: 'item' | 'receipt';
  system?: string;
}

export interface Generator {
  generate(prompt: string, system?: string, model?: ModelMode): Promise<string>;
  /** Vision: an image plus a question in, text out. Only some generators have it. */
  see?(req: SeeRequest): Promise<string>;
  /** Start a new family run: resets the run time limit. Only some generators keep one. */
  startRun?(): void;
}

/** Why a model call did not give text. */
export type FailReason = 'config' | 'deadline' | 'auth' | 'connect' | 'model' | 'timeout' | 'server' | 'empty' | 'unknown';

export class ModelUnavailable extends Error {
  constructor(message: string, readonly reason: FailReason = 'unknown') {
    super(message);
    this.name = 'ModelUnavailable';
  }
}

type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
type ChatMessage = { role: 'system' | 'user'; content: string | ContentPart[] };

/** The small slice of the OpenAI SDK we use, so tests can inject a fake. */
export interface ChatClient {
  chat: {
    completions: {
      create(
        args: {
          model: string;
          messages: ChatMessage[];
          temperature?: number;
          max_tokens?: number;
          [extra: string]: unknown;
        },
        options?: { signal?: AbortSignal; timeout?: number },
      ): Promise<{ model?: string; choices: { message?: { content?: string | null } }[] }>;
    };
  };
}

/** Labels Meterless Nightshift requires on every chat request (Runtime 1.4 contract). */
export const NIGHTSHIFT_HEADERS: Record<string, string> = { 'meterless-app': 'bundle', 'meterless-scope': 'user' };

/** Who answered one call: which provider, which model we asked for, and which model really answered. */
export interface AnswerInfo {
  provider: ProviderName;
  requested: string;
  model: string;
  ms: number;
  retried: boolean;
}

/** Short label for traces and the scoreboard, e.g. "nightshift:meterless/text.deep→nvidia/nemotron-x". */
export function providerLabel(a: AnswerInfo): string {
  const who = a.provider === 'nvidia' ? 'nvidia-direct' : a.provider;
  return a.model && a.model !== a.requested ? `${who}:${a.requested}→${a.model}` : `${who}:${a.requested}`;
}

/** Calls that returned text (ok) and calls that failed (callers then used offline text). Shape kept for the scoreboard. */
export interface CallStats {
  ok: number;
  failed: number;
}
/** Extra per-run detail: calls retried once, and the model names that really answered. */
export interface CallDetails {
  retried: number;
  answeredBy: string[];
}
const emptyStats = (): CallStats => ({ ok: 0, failed: 0 });
const emptyDetails = (): CallDetails => ({ retried: 0, answeredBy: [] });

/** Time limit for every AI call in one family run. After it, calls throw ModelUnavailable('deadline'). */
class RunClock {
  private startedAt = Date.now();
  constructor(private deadlineMs?: number) {}
  start(): void { this.startedAt = Date.now(); }
  check(): void {
    if (this.deadlineMs && Date.now() - this.startedAt > this.deadlineMs) {
      throw new ModelUnavailable('run deadline reached; using offline text', 'deadline');
    }
  }
}

/**
 * Race any promise against a hard time limit. Used for the per-call stop and by the orchestrator for a whole run.
 * The failure reason is 'deadline' unless the caller says otherwise (the per-call stop passes 'timeout' so it is retried);
 * the label only changes the message.
 */
export function withRunDeadline<T>(p: Promise<T>, ms: number, what = 'run deadline', reason: FailReason = 'deadline'): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ModelUnavailable(`${what} (${ms} ms) reached`, reason)), ms);
  });
  return Promise.race([p, late]).finally(() => clearTimeout(timer));
}

function classify(e: unknown): FailReason {
  if (e instanceof ModelUnavailable) return e.reason;
  const err = e as { status?: number; name?: string; message?: string; constructor?: { name?: string } };
  const status = typeof err?.status === 'number' ? err.status : undefined;
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'model';
  if (status === 429 || (status !== undefined && status >= 500)) return 'server';
  const name = `${err?.constructor?.name ?? ''} ${err?.name ?? ''}`;
  if (/Timeout|Abort/i.test(name) || /timed? ?out|aborted/i.test(err?.message ?? '')) return 'timeout';
  if (/Connection/i.test(name) || /ECONNREFUSED|ENOTFOUND|fetch failed|Connection error/i.test(err?.message ?? '')) return 'connect';
  return 'unknown';
}
const RETRYABLE: FailReason[] = ['timeout', 'server'];

export interface ProviderOptions {
  provider?: ProviderName;
  headers?: Record<string, string>;
  /** Reply-length cap (MODEL_MAX_TOKENS). */
  maxTokens?: number;
  /** NVIDIA direct "thinking" switch (MODEL_THINKING). */
  thinking?: 'off' | 'low' | 'on';
  /** Extra request fields merged into every call (e.g. Nightshift's "thinking off" option once Meterless names it). */
  extraBody?: Record<string, unknown>;
  /** Pause before the one retry; default a random 1–3 s. */
  retryDelayMs?: number;
  vision?: { item: string; receipt: string };
  runDeadlineMs?: number;
}

/** One OpenAI-compatible provider (Nightshift and NVIDIA both use this layout). */
export class OpenAICompatGenerator implements Generator {
  private client: ChatClient;
  readonly provider: ProviderName;
  private clock: RunClock;
  /** How many calls returned text (ok), failed (callers then use offline text), and were retried once. */
  stats: CallStats = emptyStats();
  details: CallDetails = emptyDetails();
  lastAnswer?: AnswerInfo;
  resetStats(): void { this.stats = emptyStats(); this.details = emptyDetails(); }
  startRun(): void { this.clock.start(); }

  constructor(
    apiKey: string,
    baseUrl: string,
    readonly models: { reasoning: string; fast: string; judge?: string },
    client?: ChatClient,
    readonly timeoutMs: number = 90000,
    private opts: ProviderOptions = {},
  ) {
    this.provider = opts.provider ?? 'nvidia';
    this.clock = new RunClock(opts.runDeadlineMs);
    this.client = client ?? (new OpenAI({
      apiKey,
      baseURL: baseUrl,
      timeout: timeoutMs,
      maxRetries: 0, // retries are counted in one place: callOnce/withRetry below
      defaultHeaders: opts.headers,
    }) as unknown as ChatClient);
  }

  private body(model: string, messages: ChatMessage[]) {
    const body: Parameters<ChatClient['chat']['completions']['create']>[0] = {
      model,
      messages,
      temperature: 0.2,
      max_tokens: this.opts.maxTokens ?? 4096,
    };
    if (this.provider === 'nvidia' && this.opts.thinking) {
      body.chat_template_kwargs = { enable_thinking: this.opts.thinking !== 'off' };
    }
    return { ...body, ...(this.opts.extraBody ?? {}) };
  }

  private async callOnce(model: string, messages: ChatMessage[]): Promise<{ text: string; model: string }> {
    const ac = new AbortController();
    const req = this.client.chat.completions.create(this.body(model, messages), { signal: ac.signal, timeout: this.timeoutMs });
    req.catch(() => {}); // the race below may abandon it
    try {
      const res = await withRunDeadline(req, this.timeoutMs, 'call time limit', 'timeout');
      const text = res.choices[0]?.message?.content;
      if (!text) throw new ModelUnavailable('empty response', 'empty');
      return { text, model: res.model ?? model };
    } finally {
      ac.abort(); // a hung call always ends
    }
  }

  private async call(model: string, messages: ChatMessage[]): Promise<string> {
    this.clock.check();
    const t0 = Date.now();
    let retried = false;
    try {
      let out: { text: string; model: string };
      try {
        out = await this.callOnce(model, messages);
      } catch (e) {
        if (!RETRYABLE.includes(classify(e))) throw e;
        retried = true;
        this.details.retried++;
        const pause = this.opts.retryDelayMs ?? 1000 + Math.random() * 2000;
        if (pause > 0) await new Promise((r) => setTimeout(r, pause));
        this.clock.check();
        out = await this.callOnce(model, messages);
      }
      this.stats.ok++;
      this.lastAnswer = { provider: this.provider, requested: model, model: out.model, ms: Date.now() - t0, retried };
      if (!this.details.answeredBy.includes(out.model)) this.details.answeredBy.push(out.model);
      return out.text;
    } catch (e) {
      this.stats.failed++;
      const reason = classify(e);
      throw new ModelUnavailable(`${this.provider} (${reason}) model call failed: ${(e as Error).message}`, reason);
    }
  }

  async generate(prompt: string, system?: string, model: ModelMode = 'reasoning'): Promise<string> {
    const messages: ChatMessage[] = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });
    const id = model === 'judge' ? this.models.judge || this.models.reasoning : this.models[model];
    return this.call(id, messages);
  }

  hasVision(): boolean { return Boolean(this.opts.vision?.item || this.opts.vision?.receipt); }

  async see(req: SeeRequest): Promise<string> {
    const v = this.opts.vision;
    const id = req.kind === 'receipt' ? v?.receipt || v?.item : v?.item || v?.receipt;
    if (!id) throw new ModelUnavailable(`${this.provider}: no vision model set (MODEL_VISION / MODEL_VISION_RECEIPT)`, 'config');
    const messages: ChatMessage[] = [];
    if (req.system) messages.push({ role: 'system', content: req.system });
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: req.prompt },
        { type: 'image_url', image_url: { url: `data:${req.mimeType};base64,${req.imageBase64}` } },
      ],
    });
    return this.call(id, messages);
  }
}

/** Old name kept so existing scripts keep working. */
export const NvidiaGenerator = OpenAICompatGenerator;
export type NvidiaGenerator = OpenAICompatGenerator;

/** Reasons that mean "this provider is down for the rest of the run": don't wait on it 30 times. */
const DOWN_FOR_RUN: FailReason[] = ['auth', 'connect', 'model'];

/** Tries each provider in order; the caller's offline text is the last step (ModelUnavailable). */
export class ChainGenerator implements Generator {
  private down = new Set<ProviderName>();
  private clock: RunClock;
  lastAnswer?: AnswerInfo;

  constructor(readonly providers: OpenAICompatGenerator[], opts: { runDeadlineMs?: number } = {}) {
    this.clock = new RunClock(opts.runDeadlineMs);
  }

  /**
   * Call at the start of each family run: resets the deadline (the chain's and every provider's own clock,
   * which otherwise keeps counting from server start) and gives every provider another chance.
   */
  startRun(): void {
    this.clock.start();
    for (const p of this.providers) p.startRun();
    this.down.clear();
  }

  get stats(): CallStats {
    const s = emptyStats();
    for (const p of this.providers) { s.ok += p.stats.ok; s.failed += p.stats.failed; }
    return s;
  }
  get details(): CallDetails {
    const d = emptyDetails();
    for (const p of this.providers) {
      d.retried += p.details.retried;
      for (const m of p.details.answeredBy) if (!d.answeredBy.includes(m)) d.answeredBy.push(m);
    }
    return d;
  }
  /** Calls no provider answered (the caller used its offline text instead). */
  unanswered = 0;
  resetStats(): void { this.unanswered = 0; for (const p of this.providers) p.resetStats(); }
  /** The first provider's model names. Not proof of who answered: use each provider's stats for labels. */
  get models() { return this.providers[0].models; }

  private async run(fn: (p: OpenAICompatGenerator) => Promise<string>, eligible: (p: OpenAICompatGenerator) => boolean): Promise<string> {
    try { return await this.tryProviders(fn, eligible); }
    catch (e) { this.unanswered++; throw e; }
  }

  private async tryProviders(fn: (p: OpenAICompatGenerator) => Promise<string>, eligible: (p: OpenAICompatGenerator) => boolean): Promise<string> {
    this.clock.check();
    let last: ModelUnavailable | undefined;
    for (const p of this.providers) {
      if (this.down.has(p.provider) || !eligible(p)) continue;
      try {
        const out = await fn(p);
        this.lastAnswer = p.lastAnswer;
        return out;
      } catch (e) {
        last = e instanceof ModelUnavailable ? e : new ModelUnavailable((e as Error).message);
        if (last.reason === 'deadline') throw last;
        if (DOWN_FOR_RUN.includes(last.reason)) this.down.add(p.provider);
      }
    }
    throw last ?? new ModelUnavailable('no AI provider is available', 'config');
  }

  generate(prompt: string, system?: string, model: ModelMode = 'reasoning'): Promise<string> {
    return this.run((p) => p.generate(prompt, system, model), () => true);
  }

  see(req: SeeRequest): Promise<string> {
    if (!this.providers.some((p) => p.hasVision())) {
      return Promise.reject(new ModelUnavailable('no AI provider in the chain has a vision model (MODEL_VISION / MODEL_VISION_RECEIPT)', 'config'));
    }
    return this.run((p) => p.see(req), (p) => p.hasVision());
  }
}

/** Used when there is no API key (or no model ids): every call throws ModelUnavailable. */
export class UnavailableGenerator implements Generator {
  constructor(private reason: string) {}
  async generate(): Promise<string> {
    throw new ModelUnavailable(this.reason, 'config');
  }
  async see(): Promise<string> {
    throw new ModelUnavailable(this.reason, 'config');
  }
}

/** Test double: returns the canned responses in order (the last one repeats). */
export class FakeGenerator implements Generator {
  calls = 0;
  prompts: string[] = [];
  constructor(private responses: string[]) {}
  async generate(prompt: string): Promise<string> {
    this.prompts.push(prompt);
    const i = Math.min(this.calls, this.responses.length - 1);
    this.calls += 1;
    if (i < 0) throw new ModelUnavailable('FakeGenerator has no responses', 'config');
    return this.responses[i];
  }
}

export type ProviderSetting = 'auto' | 'nightshift' | 'nvidia' | 'offline';

export interface GeneratorConfig {
  /** NVIDIA direct (the backup). */
  apiKey: string;
  baseUrl: string;
  reasoning: string;
  fast: string;
  timeoutMs?: number;
  provider?: ProviderSetting;
  nightshift?: {
    baseUrl: string;
    token: string;
    reasoning: string;
    fast: string;
    judge?: string;
    timeoutMs: number;
    extraBody?: Record<string, unknown>;
  };
  maxTokens?: number;
  thinking?: 'off' | 'low' | 'on';
  /** Judge model for NVIDIA direct (Nemotron 3 Super, thinking off). Empty = use the reasoning model. */
  judge?: string;
  vision?: { item: string; receipt: string };
  runDeadlineMs?: number;
}

/** LIVE_MODEL=true: real AI even while Zetaris replays saved answers (SAMPLE_MODE). */
export const isLiveModel = (env: NodeJS.ProcessEnv = process.env): boolean => env.LIVE_MODEL === 'true';

function readToken(env: NodeJS.ProcessEnv): string {
  if (env.NIGHTSHIFT_TOKEN_FILE) {
    try {
      return fs.readFileSync(env.NIGHTSHIFT_TOKEN_FILE, 'utf8').trim();
    } catch (e) {
      // Never print the token itself; only the file path and why it could not be read.
      const why = (e as NodeJS.ErrnoException)?.code ?? 'unreadable';
      process.stderr.write(`[llm] warning: could not read NIGHTSHIFT_TOKEN_FILE at ${env.NIGHTSHIFT_TOKEN_FILE} (${why}); Nightshift will be skipped.\n`);
      return '';
    }
  }
  return (env.NIGHTSHIFT_TOKEN ?? '').trim();
}

function parseJsonObject(s: string | undefined): Record<string, unknown> | undefined {
  if (!s) return undefined;
  try { const v = JSON.parse(s); return v && typeof v === 'object' && !Array.isArray(v) ? v : undefined; } catch { return undefined; }
}

const secs = (v: string | undefined, d: number) => (Number(v) > 0 ? Number(v) : d) * 1000;

export function generatorConfigFromEnv(env: NodeJS.ProcessEnv = process.env): GeneratorConfig {
  const p = (env.MODEL_PROVIDER ?? 'auto').toLowerCase();
  const thinking = (env.MODEL_THINKING ?? 'off').toLowerCase();
  return {
    provider: (['auto', 'nightshift', 'nvidia', 'offline'].includes(p) ? p : 'auto') as ProviderSetting,
    apiKey: env.MODEL_API_KEY ?? '',
    baseUrl: env.MODEL_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    reasoning: env.MODEL_REASONING ?? '',
    fast: env.MODEL_FAST ?? '',
    timeoutMs: secs(env.MODEL_TIMEOUT_SECONDS, 90),
    nightshift: {
      baseUrl: env.NIGHTSHIFT_BASE_URL || 'http://127.0.0.1:8088/v1',
      token: readToken(env), // never logged
      reasoning: env.NIGHTSHIFT_REASONING || 'meterless/text.deep',
      fast: env.NIGHTSHIFT_FAST || 'meterless/text.fast',
      judge: env.NIGHTSHIFT_JUDGE || '',
      timeoutMs: secs(env.NIGHTSHIFT_TIMEOUT_SECONDS, 180),
      extraBody: parseJsonObject(env.NIGHTSHIFT_EXTRA_BODY),
    },
    maxTokens: Number(env.MODEL_MAX_TOKENS) > 0 ? Number(env.MODEL_MAX_TOKENS) : 4096,
    thinking: (['off', 'low', 'on'].includes(thinking) ? thinking : 'off') as 'off' | 'low' | 'on',
    judge: env.MODEL_JUDGE ?? '',
    vision: {
      item: env.MODEL_VISION || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
      receipt: env.MODEL_VISION_RECEIPT || 'nvidia/nemotron-nano-12b-v2-vl',
    },
    runDeadlineMs: secs(env.RUN_DEADLINE_SECONDS, 300),
  };
}

/** Builds Nightshift and/or NVIDIA direct from the settings. One provider → that provider; two → a chain; none → offline. */
export function createGenerator(cfg: GeneratorConfig = generatorConfigFromEnv()): Generator {
  const mode = cfg.provider ?? 'auto';
  if (mode === 'offline') return new UnavailableGenerator('MODEL_PROVIDER=offline');
  const list: OpenAICompatGenerator[] = [];
  const reasons: string[] = [];
  const ns = cfg.nightshift;
  if (mode === 'auto' || mode === 'nightshift') {
    if (ns?.token) {
      list.push(new OpenAICompatGenerator(ns.token, ns.baseUrl, { reasoning: ns.reasoning, fast: ns.fast, judge: ns.judge }, undefined, ns.timeoutMs, {
        provider: 'nightshift',
        headers: NIGHTSHIFT_HEADERS,
        maxTokens: cfg.maxTokens,
        extraBody: ns.extraBody,
        runDeadlineMs: cfg.runDeadlineMs,
      }));
    } else reasons.push('no Nightshift token (NIGHTSHIFT_TOKEN_FILE)');
  }
  if (mode === 'auto' || mode === 'nvidia') {
    if (!cfg.apiKey) reasons.push('MODEL_API_KEY is not set');
    else if (!cfg.reasoning || !cfg.fast) reasons.push('MODEL_REASONING / MODEL_FAST are not set');
    else {
      list.push(new OpenAICompatGenerator(cfg.apiKey, cfg.baseUrl, { reasoning: cfg.reasoning, fast: cfg.fast, judge: cfg.judge }, undefined, cfg.timeoutMs ?? 90000, {
        provider: 'nvidia',
        maxTokens: cfg.maxTokens,
        thinking: cfg.thinking,
        vision: cfg.vision,
        runDeadlineMs: cfg.runDeadlineMs,
      }));
    }
  }
  if (list.length === 0) return new UnavailableGenerator(reasons.join('; ') || 'no AI provider configured');
  if (list.length === 1) return list[0];
  return new ChainGenerator(list, { runDeadlineMs: cfg.runDeadlineMs });
}

function parseLoose(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(t);
}

/**
 * Ask for JSON. Up to 2 tries; if both fail (bad JSON, failed validation, or the
 * model is unavailable) return the fallback so the app never breaks.
 * Stops early when retrying can't help (no provider, run deadline, wrong key, not running).
 */
export async function askJson<T>(
  g: Generator,
  prompt: string,
  validate: (x: unknown) => x is T,
  fallback: T,
): Promise<{ value: T; usedFallback: boolean }> {
  let p = prompt;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await g.generate(p, 'Reply with valid JSON only. No prose, no code fences.', 'reasoning');
      const parsed = parseLoose(raw);
      if (validate(parsed)) return { value: parsed, usedFallback: false };
    } catch (e) {
      if (e instanceof ModelUnavailable && !['timeout', 'server', 'empty'].includes(e.reason)) break;
    }
    p = `${prompt}\n\nYour last reply was not valid JSON in the requested shape. Reply with JSON only.`;
  }
  return { value: fallback, usedFallback: true };
}

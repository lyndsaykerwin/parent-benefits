import OpenAI from 'openai';

export interface Generator {
  generate(prompt: string, system?: string, model?: 'reasoning' | 'fast'): Promise<string>;
}

export class ModelUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelUnavailable';
  }
}

/** The small slice of the OpenAI SDK we use, so tests can inject a fake. */
export interface ChatClient {
  chat: {
    completions: {
      create(args: {
        model: string;
        messages: { role: 'system' | 'user'; content: string }[];
        temperature?: number;
      }): Promise<{ choices: { message?: { content?: string | null } }[] }>;
    };
  };
}

export class NvidiaGenerator implements Generator {
  private client: ChatClient;
  /** How many model calls returned text (ok) and how many failed (failed; callers then use offline text). */
  stats = { ok: 0, failed: 0 };
  resetStats(): void { this.stats = { ok: 0, failed: 0 }; }

  constructor(
    apiKey: string,
    baseUrl: string,
    readonly models: { reasoning: string; fast: string },
    client?: ChatClient,
    timeoutMs: number = 20000,
  ) {
    this.client = client ?? (new OpenAI({ apiKey, baseURL: baseUrl, timeout: timeoutMs, maxRetries: 0 }) as unknown as ChatClient);
  }

  async generate(prompt: string, system?: string, model: 'reasoning' | 'fast' = 'reasoning'): Promise<string> {
    const messages: { role: 'system' | 'user'; content: string }[] = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });
    try {
      const res = await this.client.chat.completions.create({
        model: this.models[model],
        messages,
        temperature: 0.2,
      });
      const text = res.choices[0]?.message?.content;
      if (!text) throw new Error('empty response');
      this.stats.ok++;
      return text;
    } catch (e) {
      this.stats.failed++;
      throw new ModelUnavailable(`model call failed: ${(e as Error).message}`);
    }
  }
}

/** Used when there is no API key (or no model ids): every call throws ModelUnavailable. */
export class UnavailableGenerator implements Generator {
  constructor(private reason: string) {}
  async generate(): Promise<string> {
    throw new ModelUnavailable(this.reason);
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
    if (i < 0) throw new ModelUnavailable('FakeGenerator has no responses');
    return this.responses[i];
  }
}

export interface GeneratorConfig {
  apiKey: string;
  baseUrl: string;
  reasoning: string;
  fast: string;
  timeoutMs?: number;
}

export function generatorConfigFromEnv(env: NodeJS.ProcessEnv = process.env): GeneratorConfig {
  return {
    apiKey: env.MODEL_API_KEY ?? '',
    baseUrl: env.MODEL_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    reasoning: env.MODEL_REASONING ?? '',
    fast: env.MODEL_FAST ?? '',
    timeoutMs: (Number(env.SOURCE_TIMEOUT_SECONDS) || 20) * 1000,
  };
}

export function createGenerator(cfg: GeneratorConfig = generatorConfigFromEnv()): Generator {
  if (!cfg.apiKey) return new UnavailableGenerator('MODEL_API_KEY is not set');
  if (!cfg.reasoning || !cfg.fast) return new UnavailableGenerator('MODEL_REASONING / MODEL_FAST are not set');
  return new NvidiaGenerator(cfg.apiKey, cfg.baseUrl, { reasoning: cfg.reasoning, fast: cfg.fast }, undefined, cfg.timeoutMs ?? 20000);
}

function parseLoose(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(t);
}

/**
 * Ask for JSON. Up to 2 tries; if both fail (bad JSON, failed validation, or the
 * model is unavailable) return the fallback so the app never breaks.
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
      if (e instanceof ModelUnavailable) break; // no point retrying
    }
    p = `${prompt}\n\nYour last reply was not valid JSON in the requested shape. Reply with JSON only.`;
  }
  return { value: fallback, usedFallback: true };
}

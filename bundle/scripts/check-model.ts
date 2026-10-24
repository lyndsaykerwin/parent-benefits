/**
 * Finds which NVIDIA-hosted Nemotron models your key can use, suggests the two Bundle needs, and tests them.
 *   npm run model:check             list models, suggest MODEL_REASONING / MODEL_FAST, send one tiny test message to each
 *   npm run model:check -- --write  also saves the two suggested ids into (only after both test messages work) ../.secrets/bundle.env.local
 *
 *   npm run model:check -- --provider nightshift   check Meterless Nightshift on this Mac (token from NIGHTSHIFT_TOKEN_FILE)
 *   npm run model:check -- --provider nvidia       check NVIDIA direct (the steps above)
 *   npm run model:check -- --vision                send a tiny made-up image to MODEL_VISION and MODEL_VISION_RECEIPT
 *
 * Reads MODEL_API_KEY and MODEL_BASE_URL (default https://integrate.api.nvidia.com/v1) the same way the app does.
 * The key itself is never printed. Exits with an error (non-zero) if there is no key or a model test fails.
 */
import fs from 'fs';
import path from 'path';
import { loadEnv } from '../server/env';
import { NvidiaGenerator, OpenAICompatGenerator, NIGHTSHIFT_HEADERS, generatorConfigFromEnv, providerLabel } from '../server/adapters/llm';

export interface ModelPick {
  /** Every candidate in preference order (best first), so the checker can fall back when a listed model is not callable on this account. */
  reasoningRanked?: string[];
  fastRanked?: string[];
  /** Every model id containing "nemotron" (sorted). */
  nemotron: string[];
  reasoning: string | null;
  fast: string | null;
}

// Models that are not general chat models (or are not text-only), so they are never suggested.
const NOT_CHAT = /embed|rerank|reward|guard|safety|\bvl\b|-vl|vision|parse|retriever|nv-clip|translate/i;
const newest = (ids: string[]) => [...ids].sort().reverse()[0] ?? null;

/**
 * Pure model picking from the /models list. Reasoning prefers an "ultra" model, then "super", then any other
 * non-nano chat Nemotron. Fast prefers "nano". Within a size, the highest id (usually the newest version) wins.
 */
export function pickModels(ids: string[]): ModelPick {
  const nemotron = [...new Set(ids.filter((i) => /nemotron/i.test(i)))].sort();
  const chat = nemotron.filter((i) => !NOT_CHAT.test(i));
  const has = (re: RegExp) => chat.filter((i) => re.test(i));
  const desc = (xs: string[]) => [...xs].sort().reverse();
  const reasoningRanked = [...new Set([...desc(has(/ultra/i)), ...desc(has(/super/i)), ...desc(chat.filter((i) => !/nano/i.test(i)))])];
  const fastRanked = [...new Set([...desc(has(/nano/i)), ...desc(has(/lightning|bolt/i))])];
  return { nemotron, reasoning: reasoningRanked[0] ?? null, fast: fastRanked[0] ?? null, reasoningRanked, fastRanked };
}

/**
 * Picks the models to send to Nightshift: its own "meterless/*" modes (deep for reasoning, fast for fast),
 * replaced by exact Nemotron names when Nightshift lists them (expected after Meterless's Sunday update).
 */
export function pickNightshiftModels(ids: string[]): { modes: string[]; nemotron: string[]; reasoning: string | null; fast: string | null } {
  const modes = ids.filter((i) => /^meterless\//i.test(i));
  const deep = modes.find((m) => /text\.deep$/i.test(m)) ?? modes.find((m) => /deep/i.test(m)) ?? null;
  const fastMode = modes.find((m) => /text\.fast$/i.test(m)) ?? modes.find((m) => /fast/i.test(m)) ?? null;
  const nv = pickModels(ids);
  return { modes, nemotron: nv.nemotron, reasoning: nv.reasoning ?? deep, fast: nv.fast ?? fastMode };
}

export type NightshiftStatus =
  | { status: 'ok'; ids: string[] }
  | { status: 'wrong-token' | 'not-running' | 'error'; message: string };

/** Asks Nightshift's /models with the token and the meterless-app label. 401/403 = wrong token; no answer = not running. */
export async function checkNightshift(baseUrl: string, token: string, timeoutMs = 30000): Promise<NightshiftStatus> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl.replace(/\/+$/, '')}/models`, {
      headers: { Authorization: `Bearer ${token}`, 'meterless-app': NIGHTSHIFT_HEADERS['meterless-app'] },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    return { status: 'not-running', message: `Nightshift isn't running; open the app. (${(e as Error).message})` };
  }
  if (res.status === 401 || res.status === 403) return { status: 'wrong-token', message: `Nightshift says the token is wrong (${res.status}). Check NIGHTSHIFT_TOKEN_FILE.` };
  if (!res.ok) return { status: 'error', message: `Nightshift /models answered ${res.status}` };
  const body = (await res.json()) as { data?: { id?: string }[] };
  return { status: 'ok', ids: (body.data ?? []).map((m) => m.id ?? '').filter(Boolean) };
}

/** A 1x1 white PNG: enough to prove the vision model accepts an image. No real photo. */
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC';

async function testGenerators(gen: (id: string) => OpenAICompatGenerator, pick: { reasoning: string | null; fast: string | null }): Promise<boolean> {
  let allOk = true;
  for (const label of ['reasoning', 'fast'] as const) {
    const id = pick[label];
    if (!id) { console.error(`No ${label} model found.`); allOk = false; continue; }
    const g = gen(id);
    const t0 = Date.now();
    try {
      const reply = await g.generate('Reply with the single word: ready', undefined, label);
      console.log(`Test ${label} (${id}): ok in ${Date.now() - t0} ms; answered by ${g.lastAnswer ? providerLabel(g.lastAnswer) : id}; reply "${reply.trim().slice(0, 40)}"`);
    } catch (e) {
      console.error(`Test ${label} (${id}): FAILED after ${Date.now() - t0} ms: ${(e as Error).message.slice(0, 160)}`);
      allOk = false;
    }
  }
  return allOk;
}

async function mainNightshift(write: boolean) {
  const cfg = generatorConfigFromEnv();
  const ns = cfg.nightshift!;
  if (!ns.token) {
    console.error('No Nightshift token. Set NIGHTSHIFT_TOKEN_FILE=<path to proxy-token> in ../.secrets/bundle.env.local.');
    process.exit(2);
  }
  const r = await checkNightshift(ns.baseUrl, ns.token);
  if (r.status !== 'ok') { console.error(r.message); process.exit(1); }
  const pick = pickNightshiftModels(r.ids);
  console.log(`Nightshift lists ${r.ids.length} models. Meterless modes: ${pick.modes.join(', ') || '(none)'}; Nemotron: ${pick.nemotron.join(', ') || '(none)'}`);
  const ok = await testGenerators(
    (id) => new OpenAICompatGenerator(ns.token, ns.baseUrl, { reasoning: id, fast: id }, undefined, ns.timeoutMs,
      { provider: 'nightshift', headers: NIGHTSHIFT_HEADERS, maxTokens: cfg.maxTokens, extraBody: ns.extraBody }),
    pick,
  );
  if (!ok) process.exit(1);
  if (write && pick.reasoning && pick.fast) {
    writeEnvFileAtomic(SECRETS_FILE, { NIGHTSHIFT_REASONING: pick.reasoning, NIGHTSHIFT_FAST: pick.fast });
    console.log(`Saved NIGHTSHIFT_REASONING and NIGHTSHIFT_FAST to ${SECRETS_FILE}`);
  }
}

async function mainVision() {
  const cfg = generatorConfigFromEnv();
  if (!cfg.apiKey) { console.error('Vision runs on NVIDIA direct: set MODEL_API_KEY first.'); process.exit(2); }
  let failed = false;
  for (const kind of ['item', 'receipt'] as const) {
    const id = cfg.vision![kind];
    const g = new OpenAICompatGenerator(cfg.apiKey, cfg.baseUrl, { reasoning: id, fast: id }, undefined, cfg.timeoutMs,
      { provider: 'nvidia', thinking: cfg.thinking, maxTokens: cfg.maxTokens, vision: { item: id, receipt: id } });
    const t0 = Date.now();
    try {
      const reply = await g.see({ prompt: 'What colour is this image? One word.', imageBase64: TINY_PNG, mimeType: 'image/png', kind });
      console.log(`Vision ${kind} (${id}): ok in ${Date.now() - t0} ms; reply "${reply.trim().slice(0, 40)}"`);
    } catch (e) {
      console.error(`Vision ${kind} (${id}): FAILED: ${(e as Error).message.slice(0, 160)}`);
      failed = true;
    }
  }
  if (failed) process.exit(1);
}

/** Sets (or appends) KEY=value lines in an env file's text. Other lines are left exactly as they are. */
export function updateEnvText(text: string, values: Record<string, string>): string {
  let out = text;
  for (const [key, value] of Object.entries(values)) {
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(out)) out = out.replace(re, () => `${key}=${value}`);
    else out = `${out}${out === '' || out.endsWith('\n') ? '' : '\n'}${key}=${value}\n`;
  }
  return out;
}

/** Updates the given lines in an env file safely: writes a temp file next to it, keeps its permissions, then renames it over the original. */
export function writeEnvFileAtomic(file: string, values: Record<string, string>): void {
  const exists = fs.existsSync(file);
  const text = exists ? fs.readFileSync(file, 'utf8') : '';
  const mode = exists ? fs.statSync(file).mode & 0o777 : 0o600;
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tmp, updateEnvText(text, values), { mode });
    fs.chmodSync(tmp, mode);
    fs.renameSync(tmp, file);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch { /* nothing to clean */ }
    throw e;
  }
}

export const SECRETS_FILE = path.resolve(process.cwd(), '../.secrets/bundle.env.local');

async function main() {
  loadEnv();
  const argv = process.argv.slice(2);
  const args = new Set(argv);
  const providerArg = argv.find((a) => a.startsWith('--provider='))?.split('=')[1] ?? (argv.includes('--provider') ? argv[argv.indexOf('--provider') + 1] : undefined);
  if (args.has('--vision')) return mainVision();
  const provider = providerArg ?? (process.env.MODEL_PROVIDER === 'nvidia' ? 'nvidia' : generatorConfigFromEnv().nightshift?.token ? 'nightshift' : 'nvidia');
  if (provider === 'nightshift') return mainNightshift(args.has('--write'));
  const apiKey = process.env.MODEL_API_KEY ?? '';
  const baseUrl = (process.env.MODEL_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
  if (!apiKey) {
    console.error('No MODEL_API_KEY found. Add it to ../.secrets/bundle.env.local (or .env), then run this again.');
    process.exit(2);
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(20000) });
  } catch (e) {
    console.error(`Could not reach ${baseUrl}/models: ${(e as Error).message}`);
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`${baseUrl}/models answered ${res.status} ${res.statusText}. Check that MODEL_API_KEY is valid.`);
    process.exit(1);
  }
  const body = (await res.json()) as { data?: { id?: string }[] };
  const ids = (body.data ?? []).map((m) => m.id ?? '').filter(Boolean);
  const pick = pickModels(ids);

  console.log(`${ids.length} models available; ${pick.nemotron.length} contain "nemotron":`);
  for (const id of pick.nemotron) console.log(`  ${id}`);
  console.log(`\nSuggested MODEL_REASONING: ${pick.reasoning ?? '(none found)'}`);
  console.log(`Suggested MODEL_FAST:      ${pick.fast ?? '(none found)'}`);
  if (!pick.reasoning || !pick.fast) {
    console.error('\nCould not suggest both models. Pick ids from the list above (or build.nvidia.com) and set them by hand.');
    process.exit(1);
  }

  // A model can be listed by /models yet not callable on this account (404), so try candidates best-first.
  let failed = false;
  const chosen: Record<'reasoning' | 'fast', string> = { reasoning: pick.reasoning, fast: pick.fast };
  for (const label of ['reasoning', 'fast'] as const) {
    const ranked = (label === 'reasoning' ? pick.reasoningRanked : pick.fastRanked) ?? [chosen[label]];
    let ok = false;
    for (const id of ranked.slice(0, 4)) {
      const gen = new NvidiaGenerator(apiKey, baseUrl, { reasoning: id, fast: id }, undefined, 60000);
      const t0 = Date.now();
      try {
        const reply = await gen.generate('Reply with the single word: ready', undefined, label);
        console.log(`Test ${label} (${id}): ok in ${Date.now() - t0} ms, reply "${reply.trim().slice(0, 40)}"`);
        chosen[label] = id;
        ok = true;
        break;
      } catch (e) {
        console.error(`Test ${label} (${id}): FAILED after ${Date.now() - t0} ms: ${(e as Error).message.slice(0, 160)}`);
      }
    }
    if (!ok) failed = true;
  }
  if (failed) {
    if (args.has('--write')) console.error('\nNot saved: a test call failed, so the settings file was left as it was.');
    process.exit(1);
  }
  if (args.has('--write')) {
    writeEnvFileAtomic(SECRETS_FILE, { MODEL_REASONING: chosen.reasoning, MODEL_FAST: chosen.fast });
    console.log(`\nSaved MODEL_REASONING and MODEL_FAST to ${SECRETS_FILE}`);
  } else {
    console.log('\n(Not saved. Add --write to store these two ids in ../.secrets/bundle.env.local after the tests pass.)');
  }
}

if (/scripts[\\/]check-model\.ts$/.test(process.argv[1] ?? '')) {
  main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
}

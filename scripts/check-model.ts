/**
 * Finds which NVIDIA-hosted Nemotron models your key can use, suggests the two Bundle needs, and tests them.
 *   npm run model:check             list models, suggest MODEL_REASONING / MODEL_FAST, send one tiny test message to each
 *   npm run model:check -- --write  also saves the two suggested ids into ../.secrets/bundle.env.local
 *
 * Reads MODEL_API_KEY and MODEL_BASE_URL (default https://integrate.api.nvidia.com/v1) the same way the app does.
 * The key itself is never printed. Exits with an error (non-zero) if there is no key or a model test fails.
 */
import fs from 'fs';
import path from 'path';
import { loadEnv } from '../server/env';
import { NvidiaGenerator } from '../server/adapters/llm';

export interface ModelPick {
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
  const reasoning = newest(has(/ultra/i)) ?? newest(has(/super/i)) ?? newest(chat.filter((i) => !/nano/i.test(i)));
  const fast = newest(has(/nano/i));
  return { nemotron, reasoning, fast };
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

export const SECRETS_FILE = path.resolve(process.cwd(), '../.secrets/bundle.env.local');

async function main() {
  loadEnv();
  const args = new Set(process.argv.slice(2));
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

  if (args.has('--write')) {
    const file = SECRETS_FILE;
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    fs.writeFileSync(file, updateEnvText(text, { MODEL_REASONING: pick.reasoning, MODEL_FAST: pick.fast }));
    console.log(`\nSaved MODEL_REASONING and MODEL_FAST to ${file}`);
  } else {
    console.log('\n(Not saved. Add --write to store these two ids in ../.secrets/bundle.env.local.)');
  }

  const gen = new NvidiaGenerator(apiKey, baseUrl, { reasoning: pick.reasoning, fast: pick.fast }, undefined, 60000);
  let failed = false;
  for (const [label, id] of [['reasoning', pick.reasoning], ['fast', pick.fast]] as const) {
    const t0 = Date.now();
    try {
      const reply = await gen.generate('Reply with the single word: ready', undefined, label);
      console.log(`Test ${label} (${id}): ok in ${Date.now() - t0} ms, reply "${reply.trim().slice(0, 40)}"`);
    } catch (e) {
      failed = true;
      console.error(`Test ${label} (${id}): FAILED after ${Date.now() - t0} ms: ${(e as Error).message}`);
    }
  }
  if (failed) process.exit(1);
}

if (/scripts[\\/]check-model\.ts$/.test(process.argv[1] ?? '')) {
  main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
}

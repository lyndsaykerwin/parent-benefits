/**
 * Finds which NVIDIA-hosted Nemotron models your key can use, suggests the two Bundle needs, and tests them.
 *   npm run model:check             list models, suggest MODEL_REASONING / MODEL_FAST, send one tiny test message to each
 *   npm run model:check -- --write  also saves the two suggested ids into (only after both test messages work) ../.secrets/bundle.env.local
 *
 * Reads MODEL_API_KEY and MODEL_BASE_URL (default https://integrate.api.nvidia.com/v1) the same way the app does.
 * The key itself is never printed. Exits with an error (non-zero) if there is no key or a model test fails.
 */
import fs from 'fs';
import path from 'path';
import { loadEnv } from '../server/env';
import { NvidiaGenerator } from '../server/adapters/llm';

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

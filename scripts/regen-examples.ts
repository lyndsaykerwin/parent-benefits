/**
 * Re-runs the saved example inputs (input_examples/*.json) through the real POST /api/run code path and rewrites
 *   output_examples/<name>.json   (the result)   and   logs/sample/<name>.jsonl   (that run's trace).
 *   npm run examples:regen            replays the saved Zetaris answers
 *   npm run examples:regen -- --live  asks Zetaris live (needs ZETARIS_* keys) and refreshes the saved answers
 * Uses whatever model settings are in your env files (a model key makes the explanations and court lines real).
 */
import fs from 'fs';
import path from 'path';
import express from 'express';
import type { AddressInfo } from 'net';
import { loadEnv } from '../server/env';

loadEnv();
process.env.SAMPLE_MODE = 'true';
// Replay the saved Zetaris answers (fast, free, repeatable) unless you pass --live, which queries Zetaris for real
// and refreshes the saved answers in data/sample/zetaris-cache/.
if (!process.argv.includes('--live')) for (const k of ['ZETARIS_BASE_URL', 'ZETARIS_ORG_ID', 'ZETARIS_API_KEY']) delete process.env[k];

async function main() {
  const { createBundleRouter } = await import('../server/routes/bundleRoutes');
  const { createDefaultApiDeps } = await import('../server/bundleDeps');
  const app = express();
  app.use(express.json());
  app.use(createBundleRouter(createDefaultApiDeps()));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const inDir = path.resolve('input_examples');
  const outDir = path.resolve('output_examples');
  const traceDir = path.resolve('logs/sample');
  fs.mkdirSync(traceDir, { recursive: true });
  try {
    for (const file of fs.readdirSync(inDir).filter((f) => f.endsWith('.json')).sort()) {
      const name = file.replace(/\.json$/, '');
      const res = await fetch(`${base}/api/run?wait=true`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: fs.readFileSync(path.join(inDir, file), 'utf8') });
      const result = (await res.json()) as { runId?: string; error?: string };
      if (!res.ok || !result.runId) throw new Error(`${name}: run failed (${res.status}) ${result.error ?? ''}`);
      fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(result));
      const trace = path.resolve('logs', `run-${result.runId.replace(/[^A-Za-z0-9_-]/g, '_')}.jsonl`);
      fs.copyFileSync(trace, path.join(traceDir, `${name}.jsonl`));
      console.log(`${name}: wrote output_examples/${name}.json and logs/sample/${name}.jsonl`);
    }
  } finally {
    server.close();
  }
}

main().then(() => process.exit(0), (e) => { console.error(String(e?.message ?? e)); process.exit(1); });

/**
 * Re-runs the saved example inputs (input_examples/*.json) through the real POST /api/run code path and rewrites
 *   output_examples/<name>.json   (the result)   and   logs/sample/<name>.jsonl   (that run's trace)
 *   plus logs/sample/<name>.agent.jsonl (the agent log, logs/run_bundle_<runId>.jsonl).
 *   npm run examples:regen            replays the saved Zetaris answers
 *   npm run examples:regen -- --live  asks Zetaris live (needs ZETARIS_* keys) and refreshes the saved answers
 * Replay mode is fully offline (no Zetaris, no model, offline explanation and court text). With --live, Zetaris and the
 * model (if MODEL_API_KEY is set in your env files) are called for real.
 */
import fs from 'fs';
import path from 'path';
import express from 'express';
import type { AddressInfo } from 'net';
import { loadEnv } from '../server/env';
import { agentLogFileName, agentTraceId } from '../shared/agentLog';

loadEnv();
process.env.SAMPLE_MODE = 'true'; // sample families + in-memory store; --live below makes the clients live anyway
const LIVE = process.argv.includes('--live');
// Replay the saved Zetaris answers (fast, free, repeatable) unless you pass --live, which queries Zetaris for real
// and refreshes the saved answers in data/sample/zetaris-cache/.
if (!LIVE) for (const k of ['ZETARIS_BASE_URL', 'ZETARIS_ORG_ID', 'ZETARIS_API_KEY']) delete process.env[k];
// Only a deliberate --live regen may rewrite the saved answers; ordinary live app runs never do (see ZetarisOptions.record).
if (LIVE) process.env.ZETARIS_RECORD = 'true'; else delete process.env.ZETARIS_RECORD;

async function main() {
  const { createBundleRouter } = await import('../server/routes/bundleRoutes');
  const { createDefaultApiDeps } = await import('../server/bundleDeps');
  const app = express();
  app.use(express.json());
  app.use(createBundleRouter(createDefaultApiDeps({ live: LIVE })));
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
      // Label the saved file so nobody mistakes it for a live, AI-written result.
      const label = LIVE ? 'live Zetaris run' : 'OFFLINE sample-mode run: AI off, made-up sample families, saved Zetaris answers replayed (no live Zetaris, no model)';
      fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify({ ...result, evidenceLabel: label }));
      const trace = path.resolve('logs', `run-${result.runId.replace(/[^A-Za-z0-9_-]/g, '_')}.jsonl`);
      fs.copyFileSync(trace, path.join(traceDir, `${name}.jsonl`));
      console.log(`${name}: wrote output_examples/${name}.json and logs/sample/${name}.jsonl`);
      // The agent log (one line per agent action, the shape judges read) sits beside it as <name>.agent.jsonl.
      const agentLog = path.resolve('logs', agentLogFileName(agentTraceId(result.runId)));
      if (fs.existsSync(agentLog)) {
        fs.copyFileSync(agentLog, path.join(traceDir, `${name}.agent.jsonl`));
        console.log(`${name}: wrote logs/sample/${name}.agent.jsonl`);
      } else console.log(`${name}: no agent log found at logs/${path.basename(agentLog)} (not copied)`);
    }
  } finally {
    server.close();
  }
}

main().then(() => process.exit(0), (e) => { console.error(String(e?.message ?? e)); process.exit(1); });

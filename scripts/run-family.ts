/**
 * Runs the whole Bundle pipeline LIVE for one family and prints a summary (no income, no secrets).
 *   npx tsx scripts/run-family.ts maya
 */
import path from 'path';
import { loadEnv } from '../server/env';
import { ZetarisClient } from '../server/adapters/zetaris';
import { createGenerator } from '../server/adapters/llm';
import { BundleMemory } from '../server/adapters/memory';
import { runBundle, defaultLoadFamily } from '../server/agents/orchestrator';

loadEnv();
process.env.TODAY = process.env.TODAY || '2026-10-23';

async function main() {
  const familyId = process.argv[2];
  if (!familyId) throw new Error('Usage: npx tsx scripts/run-family.ts <familyId>');
  const missing = ['ZETARIS_BASE_URL', 'ZETARIS_ORG_ID', 'ZETARIS_API_KEY'].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing settings: ${missing.join(', ')}`);
  process.env.SAMPLE_MODE = 'true'; // families come from the sample file; Zetaris below is still live
  const logsDir = path.resolve('logs');
  const memory = new BundleMemory(path.resolve('data/hmem'));
  const z = new ZetarisClient({
    baseUrl: process.env.ZETARIS_BASE_URL!, orgId: process.env.ZETARIS_ORG_ID!, apiKey: process.env.ZETARIS_API_KEY!,
    timeoutMs: (Number(process.env.SOURCE_TIMEOUT_SECONDS) || 20) * 1000 * 4, sampleMode: false,
    cacheDir: path.resolve('data/sample/zetaris-cache'),
  });
  const t0 = Date.now();
  const r = await runBundle(familyId, { z, llm: createGenerator(), memory, loadFamily: defaultLoadFamily, logsDir, today: process.env.TODAY! });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const kinds: Record<string, number> = {};
  for (const c of r.cards) kinds[c.kind] = (kinds[c.kind] ?? 0) + 1;
  console.log(`\n=== ${familyId} (run ${r.runId}) ===`);
  console.log(`cards by kind: ${JSON.stringify(kinds)}  total ${r.cards.length}`);
  console.log(`receipt: ${JSON.stringify(r.receipt)}`);
  console.log(`banner: ${r.banner ?? '(none)'}`);
  console.log(`elapsed: ${secs}s`);
  for (const c of r.cards) console.log(`  [${c.kind}/${c.verdict}] ${c.id} | ${c.title} | ${c.amountCents ?? '-'} | ${c.deadline ?? '-'}`);
  console.log(`trace: logs/run-${r.runId}.jsonl`);
}
main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });

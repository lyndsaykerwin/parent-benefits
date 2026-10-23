/**
 * Runs the whole Bundle pipeline LIVE for one family and prints a summary (no income, no secrets).
 *   npx tsx scripts/run-family.ts maya
 */
import path from 'path';
import { loadEnv } from '../server/env';
import { BundleMemory } from '../server/adapters/memory';
import { runBundle, loadSampleFamily } from '../server/agents/orchestrator';
import { makeRealRunDeps } from '../server/bundleDeps';

loadEnv();
process.env.TODAY = process.env.TODAY || '2026-10-23';

async function main() {
  const familyId = process.argv[2];
  if (!familyId) throw new Error('Usage: npx tsx scripts/run-family.ts <familyId>');
  const memory = new BundleMemory(path.resolve('data/hmem'));
  const base = makeRealRunDeps(memory, undefined, { live: true }); // live Zetaris + model, whatever SAMPLE_MODE says
  const t0 = Date.now();
  const r = await runBundle(familyId, { ...base, loadFamily: loadSampleFamily }); // families come from the sample file
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

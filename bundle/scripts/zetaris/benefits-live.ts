/**
 * Runs the Benefits Planner (and the Fact-Checker on what it finds) LIVE against Zetaris for the
 * three sample families. Every query result is saved to data/sample/zetaris-cache/ so SAMPLE_MODE can replay it.
 *
 *   npx tsx scripts/zetaris/benefits-live.ts
 *
 * Read-only: Zetaris only ever receives SELECTs. Secrets and incomes are never printed.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadEnv } from '../../server/env';
import { ZetarisClient } from '../../server/adapters/zetaris';
import { createGenerator } from '../../server/adapters/llm';
import { TraceLogger } from '../../server/agents/trace';
import { planBenefits } from '../../server/agents/benefits';
import { verify } from '../../server/agents/factChecker';
import type { AgentContext } from '../../server/agents/types';
import type { Family } from '../../shared/bundle';

loadEnv();
process.env.TODAY = process.env.TODAY || '2026-10-23';

async function main() {
  const need = ['ZETARIS_BASE_URL', 'ZETARIS_ORG_ID', 'ZETARIS_API_KEY'];
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing settings: ${missing.join(', ')}`);
  const families: Family[] = JSON.parse(fs.readFileSync(path.resolve('data/sample/families.json'), 'utf8'));
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-benefits-live-'));
  let failures = 0;

  for (const family of families) {
    const trace = new TraceLogger(`live-benefits-${family.id}`, logDir);
    const z = new ZetarisClient({
      baseUrl: process.env.ZETARIS_BASE_URL!, orgId: process.env.ZETARIS_ORG_ID!, apiKey: process.env.ZETARIS_API_KEY!,
      timeoutMs: 90_000, sampleMode: false, cacheDir: path.resolve('data/sample/zetaris-cache'), record: true, trace,
    });
    const ctx: AgentContext = { runId: `live-benefits-${family.id}`, family, z, llm: createGenerator(), memory: {} as any, trace };
    console.log(`\n=== ${family.id} (${family.state}) ===`);
    const t0 = Date.now();
    const cards = await planBenefits(ctx, process.env.TODAY!);
    console.log(`benefits (${Date.now() - t0} ms): ${cards.length}`);
    for (const c of cards) {
      const v = await verify(c, ctx);
      if (!v.ok) failures++;
      console.log(`  - ${c.claim.ref} amount=${c.amountCents} deadline=${c.deadline} verdict=${c.verdict} | "${c.title}" | verify=${v.ok ? 'OK' : 'FAIL ' + v.reason}`);
      console.log(`      body: ${c.body}`);
    }
  }
  console.log(`\nverify failures: ${failures}\ntrace logs (temp): ${logDir}`);
  if (failures) process.exit(2);
}

main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });

/**
 * Runs the Fine Print Court LIVE against Zetaris for the sample families (read-only SELECTs).
 * Without a model key every ruling comes from the offline screen. Results are cached in data/sample/zetaris-cache/.
 *   npx tsx scripts/zetaris/court-live.ts
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadEnv } from '../../server/env';
import { ZetarisClient } from '../../server/adapters/zetaris';
import { createGenerator } from '../../server/adapters/llm';
import { BundleMemory } from '../../server/adapters/memory';
import { TraceLogger } from '../../server/agents/trace';
import { judgeOffers, babyAgeDays } from '../../server/agents/finePrintCourt';
import { verify } from '../../server/agents/factChecker';
import type { AgentContext } from '../../server/agents/types';
import type { Family } from '../../shared/bundle';

loadEnv();
process.env.TODAY = process.env.TODAY || '2026-10-23';

async function main() {
  const families: Family[] = JSON.parse(fs.readFileSync(path.resolve('data/sample/families.json'), 'utf8'));
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-court-live-'));
  for (const family of families.filter((f) => ['maya', 'leo'].includes(f.id))) {
    const trace = new TraceLogger(`court-${family.id}`, logDir);
    const z = new ZetarisClient({
      baseUrl: process.env.ZETARIS_BASE_URL!, orgId: process.env.ZETARIS_ORG_ID!, apiKey: process.env.ZETARIS_API_KEY!,
      timeoutMs: 90_000, sampleMode: false, cacheDir: path.resolve('data/sample/zetaris-cache'), trace,
    });
    const memory = new BundleMemory(fs.mkdtempSync(path.join(os.tmpdir(), 'court-mem-')), trace);
    const ctx: AgentContext = { runId: `court-${family.id}`, family, z, llm: createGenerator(), memory, trace };
    const ageDays = babyAgeDays(ctx);
    console.log(`\n=== ${family.id} (age ${ageDays} days) ===`);
    const out = await judgeOffers(ctx, { ageDays, purchaseKeywords: ['diaper', 'formula'], includeGeneral: true });
    console.log(`approved: ${out.length}`);
    for (const c of out) {
      const v = await verify(c, ctx);
      console.log(`  - ${c.title} amount=${c.amountCents} deadline=${c.deadline} verify=${v.ok ? 'OK' : 'FAIL ' + v.reason}`);
    }
    for (const l of trace.lines().filter((l) => l.agent_name === 'judge')) console.log(`  judge [${l.status}] ${l.input_summary}: ${l.output_summary}`);
  }
}
main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });

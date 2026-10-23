/**
 * Runs the Clawback Hunter and Recall Checker (and the Fact-Checker on what they find)
 * LIVE against Zetaris for the three sample families. Every query result is saved to
 * data/sample/zetaris-cache/ so SAMPLE_MODE can replay it later.
 *
 *   npx tsx scripts/zetaris/agents-live.ts
 *
 * Read-only: Zetaris only ever receives SELECTs. Secrets are never printed.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadEnv } from '../../server/env';
import { ZetarisClient } from '../../server/adapters/zetaris';
import { createGenerator } from '../../server/adapters/llm';
import { TraceLogger } from '../../server/agents/trace';
import { findClawbacks } from '../../server/agents/clawback';
import { checkRecalls } from '../../server/agents/recall';
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
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-agents-live-'));

  for (const family of families) {
    const trace = new TraceLogger(`live-${family.id}`, logDir);
    const z = new ZetarisClient({
      baseUrl: process.env.ZETARIS_BASE_URL!, orgId: process.env.ZETARIS_ORG_ID!, apiKey: process.env.ZETARIS_API_KEY!,
      timeoutMs: 90_000, sampleMode: false, cacheDir: path.resolve('data/sample/zetaris-cache'), trace,
    });
    const ctx: AgentContext = { runId: `live-${family.id}`, family, z, llm: createGenerator(), memory: {} as any, trace };
    console.log(`\n=== ${family.id} ===`);
    const t0 = Date.now();
    const claws = await findClawbacks(ctx);
    console.log(`clawbacks (${Date.now() - t0} ms): ${claws.length}`);
    const rc = await checkRecalls(ctx);
    console.log(`recalls (${Date.now() - t0} ms total): ${rc.candidates.length}, itemsChecked ${rc.itemsChecked}`);
    for (const c of [...claws, ...rc.candidates]) {
      const v = await verify(c, ctx);
      console.log(`  - ${c.claim.type} ${c.claim.txId ?? c.claim.recallId ?? c.claim.recallNumber} amount=${c.amountCents} deadline=${c.deadline} verdict=${c.verdict} | "${c.title}" | verify=${v.ok ? 'OK' : 'FAIL ' + v.reason}`);
      console.log(`      body: ${c.body}`);
    }
  }
  console.log(`\ntrace logs (temp): ${logDir}`);
}

main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });

/**
 * Records Zetaris's answers for the fixed plan v3 questions so SAMPLE_MODE can replay them offline.
 *
 *   npm run zetaris:record        (needs real Zetaris keys; refuses to run in SAMPLE_MODE)
 *
 * It asks, LIVE: the saved-verdict question for every offer, the per-brand audit, each sample family's profile
 * (the rerouted live-mode read) and the Coach's newest issue reports. The Zetaris client saves each live answer into
 * data/sample/zetaris-cache/ (keyed by the exact SQL text). Nothing is written by hand: if a question fails or the
 * view is not registered yet, no answer is saved for it and sample mode keeps saying "no saved verdicts".
 * Read-only: Zetaris only ever receives SELECTs. Afterwards commit the new files in data/sample/zetaris-cache/.
 *
 * The recall and money-back questions are recorded by scripts/zetaris/agents-live.ts.
 */
import fs from 'fs';
import path from 'path';
import { loadEnv } from '../../server/env';
import { ZetarisClient } from '../../server/adapters/zetaris';
import { savedVerdictsSql, offerAuditSql, familyProfileSql, coachIssuesSql } from '../../server/agents/savedVerdicts';

export interface Question { label: string; sql: string }
type Asker = { runQuery(sql: string): Promise<{ rows: Record<string, unknown>[]; ms?: number }> };

/** How many of the Coach's newest issue reports one read asks for. */
export const COACH_ISSUE_LIMIT = 50;

export function buildQuestions(o: { offerIds: (string | number)[]; familyIds: string[]; issueLimit?: number }): Question[] {
  const qs: Question[] = [];
  if (o.offerIds.length) qs.push({ label: 'saved verdicts', sql: savedVerdictsSql(o.offerIds) });
  qs.push({ label: 'offer audit (all brands)', sql: offerAuditSql() });
  for (const id of o.familyIds) qs.push({ label: `family profile ${id}`, sql: familyProfileSql(id) });
  qs.push({ label: 'coach issue reports', sql: coachIssuesSql(o.issueLimit ?? COACH_ISSUE_LIMIT) });
  return qs;
}

/** Ask every question; a failure is reported and the rest still run. Returns how many failed. */
export async function recordAll(z: Asker, questions: Question[], log: (line: string) => void = console.log): Promise<number> {
  let failed = 0;
  for (const q of questions) {
    try {
      const r = await z.runQuery(q.sql);
      log(`ok     ${q.label}: ${r.rows.length} row(s)${r.ms === undefined ? '' : ` in ${r.ms} ms`}`);
    } catch (e: any) {
      failed++;
      log(`FAILED ${q.label}: ${String(e.message ?? e).slice(0, 300)}`);
    }
  }
  return failed;
}

async function main() {
  loadEnv();
  if (process.env.SAMPLE_MODE === 'true') throw new Error('zetaris:record needs live Zetaris. Unset SAMPLE_MODE (it never calls Zetaris).');
  const need = ['ZETARIS_BASE_URL', 'ZETARIS_ORG_ID', 'ZETARIS_API_KEY'];
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing settings: ${missing.join(', ')} (recording only works with real keys)`);

  const z = new ZetarisClient({
    baseUrl: process.env.ZETARIS_BASE_URL!, orgId: process.env.ZETARIS_ORG_ID!, apiKey: process.env.ZETARIS_API_KEY!,
    timeoutMs: 90_000, sampleMode: false, cacheDir: path.resolve('data/sample/zetaris-cache'),
  });
  const families: { id: string }[] = JSON.parse(fs.readFileSync(path.resolve('data/sample/families.json'), 'utf8'));
  const offers = await z.runQuery('SELECT id FROM bundle_pg.v_judge_offers ORDER BY id');
  const offerIds = offers.rows.map((r) => String(Object.values(r)[0]));

  const failed = await recordAll(z, buildQuestions({ offerIds, familyIds: families.map((f) => f.id) }));
  console.log(failed ? `${failed} question(s) failed; nothing was saved for those.` : 'All answers recorded. Commit the new files in data/sample/zetaris-cache/.');
  if (failed) process.exit(1);
}

// Run only when started as a script (npm run zetaris:record), not when a test imports it.
if (/record\.ts$/.test(process.argv[1] ?? '')) {
  main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
}

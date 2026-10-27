/**
 * Records Zetaris's answers for the fixed plan v3 questions so SAMPLE_MODE can replay them offline.
 *
 *   npm run zetaris:record        (needs real Zetaris keys; refuses to run in SAMPLE_MODE)
 *
 * It asks, LIVE: the saved-verdict question for every offer, the per-brand audit, the V2 report card (per brand and source), each sample family's profile
 * (the rerouted live-mode read) and the Coach's newest issue reports. The Zetaris client saves each live answer into
 * data/sample/zetaris-cache/ (keyed by the exact SQL text). Nothing is written by hand: if a question fails or the
 * view is not registered yet, no answer is saved for it and sample mode keeps saying "no saved verdicts".
 * Read-only: Zetaris only ever receives SELECTs. Afterwards commit the new files in data/sample/zetaris-cache/.
 *
 * It also asks every question a family TYPED IN on the website can trigger, so practice mode works for any of the 50 states
 * + DC: the one all-states benefit rules question, the one all-states eligibility counter-question, the Fact-Checker's
 * re-read of every rule code and every offer, and the saved-grade question for every set of general offers a baby's age
 * can pick. None of these name a family or a state, so one recording covers everyone.
 *
 * The recall and money-back questions are recorded by scripts/zetaris/agents-live.ts.
 */
import fs from 'fs';
import path from 'path';
import { loadEnv } from '../../server/env';
import { ZetarisClient } from '../../server/adapters/zetaris';
import { savedVerdictsSql, offerAuditSql, offerAuditBySourceSql, familyProfileSql, coachIssuesSql } from '../../server/agents/savedVerdicts';
import { rulesSql, ruleCheckSql } from '../../server/agents/benefits';
import { eligibilityCounterSql } from '../../server/agents/eligibilityLawyer';
import { col } from '../../server/agents/sql';

export interface Question { label: string; sql: string }
type Asker = { runQuery(sql: string): Promise<{ rows: Record<string, unknown>[]; ms?: number }> };

/** How many of the Coach's newest issue reports one read asks for. */
export const COACH_ISSUE_LIMIT = 50;

/** The court's one question for every offer (finePrintCourt.judgeOffers asks exactly this text). */
export const ALL_OFFERS_SQL =
  'SELECT id, title, store, min_age_days, max_age_days, trigger_keyword, value_cents, fine_print, source_url FROM bundle_pg.v_judge_offers ORDER BY id';
/** The court sends at most this many offers to court per run (finePrintCourt MAX_OFFERS). */
const COURT_MAX_OFFERS = 5;
/** The Fact-Checker's re-read of one offer (factChecker.ts asks exactly this text). */
export const offerCheckSql = (id: string | number): string =>
  `SELECT value_cents, max_age_days FROM bundle_pg.v_judge_offers WHERE id = ${Number(id)}`;

export interface OfferRow { id: unknown; min_age_days: unknown; max_age_days: unknown; trigger_keyword: unknown }

/**
 * Every set of offer ids the court can pick for a typed-in family (it has no purchases, so only offers with no trigger word),
 * at every baby age from a long way before birth to past the oldest offer. Mirrors finePrintCourt.judgeOffers: age window,
 * id order, at most 5. Each set is one saved-grade question (savedVerdictsSql), so each needs its own recording.
 */
export function generalOfferSets(rows: OfferRow[]): string[][] {
  const offers = rows
    .map((r) => ({ id: Number(r.id), min: Number(r.min_age_days), max: Number(r.max_age_days), trigger: String(r.trigger_keyword ?? '').trim() }))
    .filter((o) => Number.isFinite(o.id) && !o.trigger)
    .sort((a, b) => a.id - b.id);
  if (!offers.length) return [];
  const lo = Math.min(-400, ...offers.map((o) => o.min));
  const hi = Math.max(...offers.map((o) => o.max)) + 1;
  const sets = new Map<string, string[]>();
  for (let age = lo; age <= hi; age++) {
    const ids = offers.filter((o) => o.min <= age && o.max >= age).slice(0, COURT_MAX_OFFERS).map((o) => String(o.id));
    if (ids.length) sets.set(ids.join(','), ids);
  }
  return [...sets.values()];
}

export function buildQuestions(o: {
  offerIds: (string | number)[]; familyIds: string[]; issueLimit?: number;
  /** Every benefit rule code (from the rules answer): one Fact-Checker question each. */
  ruleCodes?: string[];
  /** The offers (from ALL_OFFERS_SQL): one saved-grade question per set a typed-in family can get. */
  offerRows?: OfferRow[];
}): Question[] {
  const qs: Question[] = [];
  if (o.offerIds.length) qs.push({ label: 'saved verdicts', sql: savedVerdictsSql(o.offerIds) });
  qs.push({ label: 'offer audit (all brands)', sql: offerAuditSql() });
  qs.push({ label: 'offer report card (by source)', sql: offerAuditBySourceSql() });
  for (const id of o.familyIds) qs.push({ label: `family profile ${id}`, sql: familyProfileSql(id) });
  qs.push({ label: 'coach issue reports', sql: coachIssuesSql(o.issueLimit ?? COACH_ISSUE_LIMIT) });
  // Typed-in families, any state: these questions never name a family or a state.
  qs.push({ label: 'benefit rules (all states)', sql: rulesSql() });
  qs.push({ label: 'eligibility counter-question (all states)', sql: eligibilityCounterSql() });
  for (const code of o.ruleCodes ?? []) qs.push({ label: `fact-check rule ${code}`, sql: ruleCheckSql(code) });
  for (const id of o.offerIds) qs.push({ label: `fact-check offer ${id}`, sql: offerCheckSql(id) });
  const seen = new Set(qs.map((q) => q.sql));
  for (const set of generalOfferSets(o.offerRows ?? [])) {
    const sql = savedVerdictsSql(set);
    if (!seen.has(sql)) { seen.add(sql); qs.push({ label: `saved verdicts for offers ${set.join(',')}`, sql }); }
  }
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
    timeoutMs: 90_000, sampleMode: false, cacheDir: path.resolve('data/sample/zetaris-cache'), record: true,
  });
  const families: { id: string }[] = JSON.parse(fs.readFileSync(path.resolve('data/sample/families.json'), 'utf8'));
  const offers = await z.runQuery(ALL_OFFERS_SQL);
  const offerRows: OfferRow[] = offers.rows.map((r: any) => ({
    id: col(r, 'id'), min_age_days: col(r, 'min_age_days'), max_age_days: col(r, 'max_age_days'), trigger_keyword: col(r, 'trigger_keyword'),
  }));
  const offerIds = offerRows.map((r) => String(r.id));
  const rules = await z.runQuery(rulesSql());
  const ruleCodes = rules.rows.map((r: any) => String(col(r, 'code')));

  const failed = await recordAll(z, buildQuestions({
    offerIds, familyIds: families.map((f) => f.id), ruleCodes, offerRows,
  }));
  console.log(failed ? `${failed} question(s) failed; nothing was saved for those.` : 'All answers recorded. Commit the new files in data/sample/zetaris-cache/.');
  if (failed) process.exit(1);
}

// Run only when started as a script (npm run zetaris:record), not when a test imports it.
if (/record\.ts$/.test(process.argv[1] ?? '')) {
  main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
}

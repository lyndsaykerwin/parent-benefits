/**
 * Eval scoreboard + learning demo.
 *   npx tsx scripts/eval.ts              full eval (3 sample families x 3 runs, plus the learning demo)
 *   npx tsx scripts/eval.ts --learning   just the learning demo (run 1 vs run 2) and copy the traces
 *   add --require-model to stop (exit 2 no key / 1 failed test call) before touching anything unless a real model works
 *   add --live to refresh the Zetaris replay cache from the live service
 *   add --neon to save the fixture feedback and proposals in Neon (needs DATABASE_URL)
 *
 * Honesty labels: `llmMode` says whether a real model, no model (the Court's offline screen and the Coach's keyword
 * fallback) or a scripted FakeGenerator was behind the numbers. Scout's wrong-amount trap always uses a scripted
 * fake row on purpose and is labelled `fake-llm`.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { BundleResult, Family } from '../shared/bundle';
import { loadEnv } from '../server/env';
import { ZetarisClient } from '../server/adapters/zetaris';
import { createGenerator, FakeGenerator, NvidiaGenerator, UnavailableGenerator, type Generator } from '../server/adapters/llm';
import { BundleMemory } from '../server/adapters/memory';
import { runBundle } from '../server/agents/orchestrator';
import { TraceLogger } from '../server/agents/trace';
import { proposeRules, type FeedbackRow } from '../server/agents/coach';
import { MemoryStore, type BundleStore } from '../server/bundleStore';
import { resolveToday } from '../server/demoDate';
import { scout, type ScoutResult } from './scout';

export type LlmMode = 'real-model' | 'offline-fallback' | 'fake-llm' | `nvidia:${string}` | `nvidia-partial:${string}`;

export interface Scoreboard {
  trapsCaught: number;
  trapsTotal: number;
  falseAlarms: number;
  sourcedPct: number;
  runs: number;
  stable: boolean;
  learning: { run1Approved: boolean; run2Blocked: boolean; citedRuleId: string | null };
  llmMode: LlmMode;
  /** Real-model calls that returned text vs. failed (a failure means that step used offline text). Null when no NVIDIA model was behind the run. */
  llmCalls: { ok: number; failed: number } | null;
  scoutLlmMode: 'fake-llm' | 'real-model';
  generatedAt: string;
  demoDate: string;
  traps: Record<string, { caught: boolean; detail: string }>;
  expectationFailures: string[];
  moneyBackCents: Record<string, number>;
  learningDetail: { run1Id: string; run2Id: string; ruleText: string | null; storedIn: 'neon' | 'memory' };
  scout: { accepted: number; rejected: { title: string; reason: string }[] };
}

export interface EvalOptions {
  z?: ZetarisClient;
  llm?: Generator;
  store?: BundleStore;
  logsDir?: string;
  expectedFile?: string;
  pagesDir?: string;
  /** If set, run 1 and run 2 traces are copied here as run1.jsonl / run2.jsonl. */
  copyTracesTo?: string;
  /** Skip the 3x3 eval and only do the learning demo. */
  learningOnly?: boolean;
  runsPerFamily?: number;
}

const FAMILIES = ['maya', 'leo', 'ava'];
export const ISSUE_FIXTURES = [
  'The free diaper box needed a card, and then I was charged $29.99 for a membership I never signed up for.',
  'It said free, but after the trial it automatically enrolled us in a paid monthly membership.',
  'Hard to cancel: the free box turned into a paid subscription that kept renewing.',
];

const loadFamilies = (): Family[] => JSON.parse(fs.readFileSync(path.resolve('data/sample/families.json'), 'utf8'));
const loadFamily = async (id: string): Promise<Family> => {
  const f = loadFamilies().find((x) => x.id === id);
  if (!f) throw new Error(`Unknown sample family: ${id}`);
  return f;
};

export function llmCallsOf(llm: Generator): { ok: number; failed: number } | null {
  return llm instanceof NvidiaGenerator ? { ...llm.stats } : null;
}

/** Before a real-model eval: needs a key and model ids, and one tiny call to each model must work. Returns an error message, or null if fine. */
export async function preflightModel(llm: Generator): Promise<string | null> {
  if (llm instanceof UnavailableGenerator) return 'No usable model settings (set MODEL_API_KEY, MODEL_REASONING and MODEL_FAST; npm run model:check -- --write does the last two). Nothing was changed.';
  for (const which of ['reasoning', 'fast'] as const) {
    try { await llm.generate('Reply with one word: ok', undefined, which); }
    catch (e) { return `Pre-flight call to the ${which} model failed: ${(e as Error).message}. Nothing was changed.`; }
  }
  if (llm instanceof NvidiaGenerator) llm.resetStats();
  return null;
}

export function llmModeOf(llm: Generator): LlmMode {
  if (llm instanceof UnavailableGenerator) return 'offline-fallback';
  if (llm instanceof FakeGenerator) return 'fake-llm';
  // A real NVIDIA model: record exactly which ids were behind the numbers.
  // Only claim a real model if calls actually succeeded; any failed call (offline text used instead) makes it "partial".
  if (llm instanceof NvidiaGenerator) {
    const ids = `${llm.models.reasoning}+${llm.models.fast}`;
    const { ok, failed } = llm.stats;
    if (ok === 0) return 'offline-fallback';
    return failed > 0 ? `nvidia-partial:${ids}` : `nvidia:${ids}`;
  }
  return 'real-model';
}

/** Zetaris for the eval: the saved replay cache first; with credentials, a cache miss goes live (`live` refreshes everything). */
export function makeEvalZetaris(opts: { live?: boolean } = {}): ZetarisClient {
  const have = process.env.ZETARIS_BASE_URL && process.env.ZETARIS_ORG_ID && process.env.ZETARIS_API_KEY;
  return new ZetarisClient({
    baseUrl: process.env.ZETARIS_BASE_URL ?? 'http://127.0.0.1:9', orgId: process.env.ZETARIS_ORG_ID ?? 'none', apiKey: process.env.ZETARIS_API_KEY ?? 'none',
    timeoutMs: (Number(process.env.SOURCE_TIMEOUT_SECONDS) || 20) * 4000, sampleMode: !opts.live,
    cacheDir: path.resolve('data/sample/zetaris-cache'),
    ...(have ? {} : { fetchFn: (async () => { throw new Error('no Zetaris credentials: replay cache only'); }) as unknown as typeof fetch }),
  });
}

const sig = (r: BundleResult) => r.cards.map((c) => `${c.id}|${c.verdict}|${c.amountCents}|${c.deadline}`).sort().join('\n') + `\n${JSON.stringify(r.receipt)}`;
const hasCard = (r: BundleResult, spec: { kind: string; idContains: string }) => r.cards.some((c) => c.kind === spec.kind && c.id.includes(spec.idContains));

function readTrace(logsDir: string, runId: string) {
  const file = path.join(logsDir, `run-${runId.replace(/[^A-Za-z0-9_-]/g, '_')}.jsonl`);
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { agent_name: string; status: string; output_summary: string });
  return { file, lines };
}

/** Learning demo: run 1 -> parents report problems -> Coach proposes -> a reviewer approves -> run 2. */
export async function runLearning(o: { z: ZetarisClient; llm: Generator; memory: BundleMemory; store: BundleStore; logsDir: string; trapTitle: string; copyTracesTo?: string }) {
  const run = (id: string) => runBundle(id, { z: o.z, llm: o.llm, memory: o.memory, loadFamily, logsDir: o.logsDir, today: resolveToday(id).today });
  const isTrap = (r: BundleResult) => r.cards.find((c) => c.kind === 'discount' && c.title === o.trapTitle);

  const r1 = await run('maya');
  const trap1 = isTrap(r1);

  // Three (fake) parents report the same problem. Saved through the same store the API uses.
  const rows: FeedbackRow[] = [];
  for (const note of ISSUE_FIXTURES) rows.push(await o.store.addFeedback({ familyId: 'eval-fixture', cardId: trap1?.id ?? 'discount-trap', kind: 'issue', note }));
  const proposed = await proposeRules(rows, o.llm);
  const saved = await o.store.saveProposals(proposed);
  // saveProposals skips text it already has (a re-run): reuse that proposal instead of losing it.
  const all = await o.store.listProposals();
  const mine = proposed.map((p) => saved.find((s) => s.text === p.text) ?? all.find((s) => s.text.trim().toLowerCase() === p.text.trim().toLowerCase())).filter((x): x is NonNullable<typeof x> => !!x);
  // The eval plays the reviewer: same two steps as POST /api/case-law/:id/approve (store the rule in memory, mark it approved).
  // The approval gets its own small trace (memory add_rule), saved between run 1 and run 2, so the memory write is visible too.
  const approveId = `approve-${r1.runId}`;
  const approveTrace = new TraceLogger(approveId, o.logsDir);
  const memoryIds: string[] = [];
  for (const p of mine) {
    const memoryId = o.memory.withTrace(approveTrace).addRule(p.text, `case_law:${p.id}`, p.confidence, p.sourceFeedbackIds);
    await o.store.markApproved(p.id, memoryId);
    memoryIds.push(memoryId);
  }

  const r2 = await run('maya');
  const trap2 = isTrap(r2);
  const t2 = readTrace(o.logsDir, r2.runId);
  const citing = t2.lines.find((l) => l.agent_name === 'judge' && l.status === 'blocked' && memoryIds.some((id) => l.output_summary.includes(id)));
  const citedRuleId = citing ? memoryIds.find((id) => citing.output_summary.includes(id)) ?? null : null;

  if (o.copyTracesTo) {
    fs.mkdirSync(o.copyTracesTo, { recursive: true });
    fs.copyFileSync(readTrace(o.logsDir, r1.runId).file, path.join(o.copyTracesTo, 'run1.jsonl'));
    if (memoryIds.length) fs.copyFileSync(readTrace(o.logsDir, approveId).file, path.join(o.copyTracesTo, 'approve.jsonl'));
    fs.copyFileSync(t2.file, path.join(o.copyTracesTo, 'run2.jsonl'));
  }
  return {
    r1, r2,
    learning: { run1Approved: !!trap1, run2Blocked: !!trap1 && !trap2 && citedRuleId !== null, citedRuleId },
    ruleText: mine[0]?.text ?? null,
  };
}

/** The scripted Scout trap: 3 good rows, one wrong-amount row ($5,000 on a $1,000 page) and one row with no source. */
function scriptedScoutModel(): FakeGenerator {
  const pfml = { kind: 'rule', title: 'Massachusetts Paid Family and Medical Leave', code: 'MA_PFML', scope: 'MA', amountCents: null, windowEndDaysFromBirth: 365, condition: 'worked in Massachusetts', sourceUrl: 'https://www.mass.gov/paid-family-and-medical-leave-pfml' };
  const offer = { kind: 'offer', title: 'Free newborn diaper box', store: 'Cuddle & Co', amountCents: 4000, finePrint: 'Free box requires a card on file. After a 30-day trial you are automatically enrolled in a paid membership at $29.99/month until you cancel.', triggerKeyword: 'diaper', sourceUrl: 'https://example.com/cuddle-and-co/free-diaper-box' };
  const trump = { kind: 'rule', title: 'Trump Account: $1,000 federal starter deposit', code: 'TRUMP_ACCOUNT', scope: 'federal', amountCents: 100000, condition: 'born 2025 to 2028', sourceUrl: 'https://trumpaccounts.gov' };
  const wrong = { ...trump, title: 'Trump Account bonus', code: 'TRUMP_ACCOUNT_BONUS', amountCents: 500000 };
  const noSource = { kind: 'rule', title: 'Mystery bonus', code: 'MYSTERY_BONUS', scope: 'federal', amountCents: null };
  // Pages are read in file-name order: ma-pfml, store-offer, trump-account.
  return new FakeGenerator([JSON.stringify({ rows: [pfml] }), JSON.stringify({ rows: [offer] }), JSON.stringify({ rows: [trump, wrong, noSource] })]);
}

export async function runEval(opts: EvalOptions = {}): Promise<Scoreboard> {
  const expected = JSON.parse(fs.readFileSync(opts.expectedFile ?? path.resolve('evals/expected.json'), 'utf8'));
  const llm = opts.llm ?? new UnavailableGenerator('MODEL_API_KEY is not set');
  const z = opts.z ?? makeEvalZetaris();
  const store = opts.store ?? new MemoryStore();
  const logsDir = opts.logsDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-eval-logs-'));
  const memory = new BundleMemory(fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-eval-mem-')));
  const trapTitle: string = expected.traps.auto_renew_offer.offerTitle;

  const learn = await runLearning({ z, llm, memory, store, logsDir, trapTitle, copyTracesTo: opts.copyTracesTo });

  const perFamily: Record<string, BundleResult[]> = { maya: [learn.r2], leo: [], ava: [] };
  const n = opts.runsPerFamily ?? 3;
  if (!opts.learningOnly) {
    perFamily.maya = [];
    for (const id of FAMILIES) {
      for (let i = 0; i < n; i++) perFamily[id].push(await runBundle(id, { z, llm, memory, loadFamily, logsDir, today: resolveToday(id).today }));
    }
  }

  // Scout (scripted model: its wrong-amount trap needs a known bad row)
  const scoutLlm = scriptedScoutModel();
  const sc: ScoutResult = await scout(opts.pagesDir ?? path.resolve('data/sample/saved-pages'), { llm: scoutLlm, logsDir });

  const failures: string[] = [];
  let falseAlarms = 0;
  const moneyBack: Record<string, number> = {};
  for (const id of FAMILIES) {
    const exp = expected.families[id];
    const runs = perFamily[id];
    if (!runs.length) continue;
    moneyBack[id] = runs[0].receipt.moneyBackCents;
    for (const spec of exp.mustInclude) if (!runs.every((r) => hasCard(r, spec))) { falseAlarms++; failures.push(`${id}: expected card ${spec.idContains} is missing`); }
    for (const r of runs) if (r.receipt.moneyBackCents !== exp.moneyBackCents) { failures.push(`${id}: moneyBack ${r.receipt.moneyBackCents} (expected ${exp.moneyBackCents})`); break; }
  }

  const T = expected.traps;
  const mayaRuns = perFamily.maya;
  const avaRuns = perFamily.ava;
  const traps: Scoreboard['traps'] = {};
  const set = (k: string, caught: boolean, detail: string) => { traps[k] = { caught, detail }; };
  set('auto_renew_offer', mayaRuns.every((r) => !r.cards.some((c) => c.title === trapTitle)) && learn.learning.run2Blocked,
    learn.learning.run2Blocked ? `blocked after learning, cites ${learn.learning.citedRuleId}` : 'not blocked after learning');
  const wrongRow = sc.rejected.find((r) => /5000|500000/.test(r.reason));
  set('wrong_amount_scout_row', !!wrongRow && !sc.rules.some((r) => r.amountCents === T.wrong_amount_scout_row.wrongAmountCents), wrongRow?.reason ?? 'wrong row was not rejected');
  set('recalled_item', mayaRuns.length > 0 && mayaRuns.every((r) => r.cards.some((c) => c.id === T.recalled_item.cardId && c.verdict === 'verified')), `card ${T.recalled_item.cardId}`);
  set('refund', mayaRuns.length > 0 && mayaRuns.every((r) => !r.cards.some((c) => T.refund.mustNotHaveIdContains.some((s: string) => c.id.includes(s))) && r.receipt.moneyBackCents === expected.families.maya.moneyBackCents), 'no card for the refunded purchase; money back unchanged');
  set('duplicate', mayaRuns.length > 0 && mayaRuns.every((r) => r.receipt.itemsChecked === T.duplicate.itemsChecked && !r.cards.some((c) => T.duplicate.mustNotHaveIdContains.some((s: string) => c.id.includes(s)))), `${mayaRuns[0]?.receipt.itemsChecked} distinct items checked (duplicate counted once)`);
  set('non_ma_family', avaRuns.length > 0 && avaRuns.every((r) => !r.cards.some((c) => c.id.startsWith(T.non_ma_family.mustNotHaveIdPrefix))), 'Ohio family gets no Massachusetts benefit');
  if (opts.learningOnly) for (const k of ['recalled_item', 'refund', 'duplicate', 'non_ma_family']) if (!traps[k].caught) traps[k].detail += ' (learning-only run: not measured)';

  // Every verified/likely card, and every accepted Scout row, must carry a source link.
  const cards = Object.values(perFamily).flat().flatMap((r) => r.cards).filter((c) => c.verdict === 'verified' || c.verdict === 'likely');
  const cardOk = cards.filter((c) => c.sources.some((s) => /^https?:\/\//.test(s.url))).length;
  const scoutRows = [...sc.rules, ...sc.offers];
  const scoutOk = scoutRows.filter((r) => /^https:\/\//.test(r.sourceUrl)).length;
  const total = cards.length + scoutRows.length;
  const sourcedPct = total ? Math.round(((cardOk + scoutOk) / total) * 1000) / 10 : 0;

  const stable = FAMILIES.every((id) => perFamily[id].length < 2 || new Set(perFamily[id].map(sig)).size === 1);
  return {
    trapsCaught: Object.values(traps).filter((t) => t.caught).length, trapsTotal: Object.keys(traps).length, falseAlarms, sourcedPct,
    runs: n, stable, learning: learn.learning, llmMode: llmModeOf(llm), llmCalls: llmCallsOf(llm), scoutLlmMode: 'fake-llm', generatedAt: new Date().toISOString(),
    demoDate: resolveToday('maya').today, traps, expectationFailures: failures, moneyBackCents: moneyBack,
    learningDetail: { run1Id: learn.r1.runId, run2Id: learn.r2.runId, ruleText: learn.ruleText, storedIn: store instanceof MemoryStore ? 'memory' : 'neon' },
    scout: { accepted: scoutRows.length, rejected: sc.rejected.map((r) => ({ title: r.title, reason: r.reason })) },
  };
}

/**
 * A --learning run only measured the learning demo, so it updates just the `learning` and `learningDetail` fields of the
 * saved scoreboard. With no saved scoreboard it starts one with nulls for everything it did not measure.
 */
export function mergeLearning(existing: Record<string, unknown> | null, sb: Scoreboard): Record<string, unknown> {
  const base = existing ?? {
    trapsCaught: null, trapsTotal: null, falseAlarms: null, sourcedPct: null, runs: null, stable: null,
    llmMode: sb.llmMode, llmCalls: sb.llmCalls, scoutLlmMode: null, demoDate: sb.demoDate, traps: null, expectationFailures: null,
    moneyBackCents: null, scout: null,
  };
  return { ...base, generatedAt: sb.generatedAt, learning: sb.learning, learningDetail: sb.learningDetail, learningLlmMode: sb.llmMode, learningLlmCalls: sb.llmCalls };
}

async function main() {
  loadEnv();
  const args = new Set(process.argv.slice(2));
  const llm = createGenerator();
  if (args.has('--require-model')) {
    const problem = await preflightModel(llm);
    if (problem) { console.error(problem); process.exit(llm instanceof UnavailableGenerator ? 2 : 1); }
  }
  const store: BundleStore = args.has('--neon') ? new (await import('../server/bundleStore')).DrizzleStore() : new MemoryStore();
  const sb = await runEval({
    z: makeEvalZetaris({ live: args.has('--live') }), llm, store, logsDir: path.resolve('logs'),
    copyTracesTo: path.resolve('output_examples/learning'), learningOnly: args.has('--learning'),
  });
  fs.mkdirSync(path.resolve('logs'), { recursive: true });
  const file = path.resolve('logs/scoreboard.json');
  let out: unknown = sb;
  if (args.has('--learning')) {
    let existing: Record<string, unknown> | null = null;
    try { existing = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* none yet */ }
    out = mergeLearning(existing, sb);
  }
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out, null, 2));
  if (args.has('--neon')) { const { pool } = await import('../server/db'); await pool.end(); }
}

if (/scripts[\\/]eval\.ts$/.test(process.argv[1] ?? '')) {
  main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
}

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
import { ChainGenerator, createGenerator, FakeGenerator, isLiveModel, NvidiaGenerator, UnavailableGenerator, type Generator } from '../server/adapters/llm';
import { BundleMemory } from '../server/adapters/memory';
import { runBundle } from '../server/agents/orchestrator';
import { TraceLogger } from '../server/agents/trace';
import { proposeRules, type FeedbackRow } from '../server/agents/coach';
import { MemoryStore, type BundleStore } from '../server/bundleStore';
import { resolveToday } from '../server/demoDate';
import { checkFinePrint, quoteIsExact } from '../server/agents/finePrintRules';
import { scout, type ScoutResult } from './scout';

/**
 * Which model really produced the numbers, named after the provider that answered (never just the first one configured):
 * `nightshift:<reasoning>+<fast>` / `nvidia-direct:<reasoning>+<fast>`; `-partial` when some calls got no answer (offline text used);
 * `mixed:` with per-provider answer counts when both providers answered during one eval.
 */
export type ProviderMode = 'nightshift' | 'nvidia-direct';
export type LlmMode = 'real-model' | 'offline-fallback' | 'fake-llm'
  | `${ProviderMode}:${string}` | `${ProviderMode}-partial:${string}` | `mixed:${string}` | `mixed-partial:${string}`;

export interface Scoreboard {
  trapsCaught: number;
  trapsTotal: number;
  falseAlarms: number;
  sourcedPct: number;
  runs: number;
  stable: boolean;
  /** The learning demo on the subtler trap. `collateralBlocked` = other approved offers that run 2 wrongly blocked (target 0). */
  learning: { run1Approved: boolean; run2Blocked: boolean; citedRuleId: string | null; collateralBlocked?: number };
  llmMode: LlmMode;
  /** Real-model calls that returned text vs. failed (a failure means that step used offline text). Null when no NVIDIA model was behind the run. */
  llmCalls: { ok: number; failed: number } | null;
  scoutLlmMode: 'fake-llm' | 'real-model';
  generatedAt: string;
  demoDate: string;
  traps: Record<string, { caught: boolean; detail: string }>;
  expectationFailures: string[];
  moneyBackCents: Record<string, number>;
  learningDetail: { run1Id: string; run2Id: string; ruleText: string | null; storedIn: 'neon' | 'memory'; trapTitle?: string; obviousTrap?: { title: string; run1Approved: boolean; run2Blocked: boolean; citedRuleId: string | null } };
  scout: { accepted: number; rejected: { title: string; reason: string }[] };
  /** Fine-print code rules graded against the answer key (data/sample/fine-print-cases). No AI involved. */
  finePrint: FinePrintScore;
  /** Recall Checker graded against the answer key: expected recalls shown, look-alike and finished recalls kept out. */
  recall: { expected: number; caught: number; wrongShown: number; lookAlikesChecked: number };
  /** Photo intake. Null means "not measured offline" (no saved vision replay), never a made-up zero. */
  photo: { measured: boolean; madeUpRate: number | null; note: string };
  /** What the loops did in each run, counted from the agent trace lines (nothing typed in). */
  loops: Record<string, LoopCounts[]>;
}

export interface FinePrintScore {
  cases: number;
  /** Cases whose answer key lists catch types: how many had every listed catch found. */
  catchesFound: number;
  catchesTotal: number;
  /** Controls (CTRL-*) that raised any catch at all. Target 0. */
  controlFalseAlarms: number;
  controlsTotal: number;
  /** Individual answer-key fields (amounts, dates, flags, verdict) the rules got exactly right. */
  fieldsCorrect: number;
  fieldsTotal: number;
  fieldAccuracyPct: number;
  /** Cases whose quoted evidence was not exact words from the fine print. Target 0. */
  inexactQuotes: number;
}

export interface LoopCounts {
  runId: string;
  sendBacks: number;
  corrections: number;
  rebuttals: number;
  courtRulings: number;
  courtBlocks: number;
  savedVerdictReads: number;
  eligibilityQuestions: number;
  recallVerifications: number;
  safetyChecks: number;
  cardsApproved: number;
  cardsRejected: number;
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
/** Fake parent reports written for the offline demo (no real people): no "free trial" or "auto-renew" words, just savings that depend on a plan. */
export const SUBTLE_ISSUE_FIXTURES = [
  'My savings disappeared the moment I stopped the delivery plan, and the price kept changing.',
  'The discount only counts while the plan stays active; the price changed on the second order, so the savings were gone.',
  'The discount vanished as soon as I cancelled my subscription, and then the price went up.',
];
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
  return llm instanceof NvidiaGenerator || llm instanceof ChainGenerator ? { ...llm.stats } : null;
}

/** Before a real-model eval: needs a key and model ids, and one tiny call to each model must work. Returns an error message, or null if fine. */
export async function preflightModel(llm: Generator): Promise<string | null> {
  if (llm instanceof UnavailableGenerator) return 'No usable model settings (set MODEL_API_KEY, MODEL_REASONING and MODEL_FAST; npm run model:check -- --write does the last two). Nothing was changed.';
  for (const which of ['reasoning', 'fast'] as const) {
    try { await llm.generate('Reply with one word: ok', undefined, which); }
    catch (e) { return `Pre-flight call to the ${which} model failed: ${(e as Error).message}. Nothing was changed.`; }
  }
  if (llm instanceof NvidiaGenerator || llm instanceof ChainGenerator) llm.resetStats();
  return null;
}

const providerMode = (p: NvidiaGenerator): ProviderMode => (p.provider === 'nvidia' ? 'nvidia-direct' : 'nightshift');

export function llmModeOf(llm: Generator): LlmMode {
  if (llm instanceof UnavailableGenerator) return 'offline-fallback';
  if (llm instanceof FakeGenerator) return 'fake-llm';
  // Only claim a real model if calls actually succeeded, and name the provider(s) that really answered.
  // Any call that got no answer at all (offline text used instead) makes it "partial".
  if (llm instanceof NvidiaGenerator || llm instanceof ChainGenerator) {
    const providers = llm instanceof ChainGenerator ? llm.providers : [llm];
    const unanswered = llm instanceof ChainGenerator ? llm.unanswered : llm.stats.failed;
    const answered = providers.filter((p) => p.stats.ok > 0);
    if (answered.length === 0) return 'offline-fallback';
    const partial = unanswered > 0 ? '-partial' : '';
    if (answered.length === 1) {
      const p = answered[0];
      return `${providerMode(p)}${partial}:${p.models.reasoning}+${p.models.fast}` as LlmMode;
    }
    const counts = answered.map((p) => `${providerMode(p)}=${p.stats.ok}(${p.models.reasoning}+${p.models.fast})`).join(',');
    return `mixed${partial}:${counts}` as LlmMode;
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
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { agent_name: string; action: string; status: string; input_summary: string; output_summary: string });
  return { file, lines };
}

/**
 * Learning demo: run 1 -> parents report problems -> Coach proposes -> a reviewer approves -> run 2.
 * Two traps are taught at once, both from offers already in the saved sample data: the obvious one (a "free" box that turns
 * into a paid membership) and the subtler one (savings that only last while a subscription stays active). The headline
 * result is the subtler trap; the obvious one is kept as a second line so the older proof still shows.
 */
export async function runLearning(o: { z: ZetarisClient; llm: Generator; memory: BundleMemory; store: BundleStore; logsDir: string; trapTitle: string; subtleTitle: string; copyTracesTo?: string }) {
  const run = (id: string) => runBundle(id, { z: o.z, llm: o.llm, memory: o.memory, loadFamily, logsDir: o.logsDir, today: resolveToday(id).today });
  const findCard = (r: BundleResult, title: string) => r.cards.find((c) => c.kind === 'discount' && c.title === title);

  const r1 = await run('maya');
  const obvious1 = findCard(r1, o.trapTitle);
  const subtle1 = findCard(r1, o.subtleTitle);

  // Three (fake) parents report each problem. Saved through the same store the API uses.
  const rows: FeedbackRow[] = [];
  for (const note of ISSUE_FIXTURES) rows.push(await o.store.addFeedback({ familyId: 'eval-fixture', cardId: obvious1?.id ?? 'discount-trap', kind: 'issue', note }));
  for (const note of SUBTLE_ISSUE_FIXTURES) rows.push(await o.store.addFeedback({ familyId: 'eval-fixture', cardId: subtle1?.id ?? 'discount-subtle-trap', kind: 'issue', note }));
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
  const ruleTextById = new Map<string, string>();
  for (const p of mine) {
    const memoryId = o.memory.withTrace(approveTrace).addRule(p.text, `case_law:${p.id}`, p.confidence, p.sourceFeedbackIds);
    await o.store.markApproved(p.id, memoryId);
    memoryIds.push(memoryId);
    ruleTextById.set(memoryId, p.text);
  }

  const r2 = await run('maya');
  const t2 = readTrace(o.logsDir, r2.runId);
  // The rule a blocked ruling cited for one specific offer (trace lines say "offer <id>").
  const citedFor = (card: { id: string } | undefined): string | null => {
    if (!card) return null;
    const offerId = card.id.replace(/^discount-/, '');
    const citing = t2.lines.find((l) => l.agent_name === 'judge' && l.status === 'blocked' && l.input_summary ===`offer ${offerId}` && memoryIds.some((id) => l.output_summary.includes(id)));
    return citing ? memoryIds.find((id) => citing.output_summary.includes(id)) ?? null : null;
  };
  const subtleCited = citedFor(subtle1);
  const obviousCited = citedFor(obvious1);
  const subtle2 = findCard(r2, o.subtleTitle);
  const obvious2 = findCard(r2, o.trapTitle);
  // Collateral damage: any other offer approved in run 1 that run 2 wrongly blocked.
  const trapIds = new Set([obvious1?.id, subtle1?.id]);
  const r2Ids = new Set(r2.cards.map((c) => c.id));
  const collateralBlocked = r1.cards.filter((c) => c.kind === 'discount' && !trapIds.has(c.id) && !r2Ids.has(c.id)).length;

  if (o.copyTracesTo) {
    fs.mkdirSync(o.copyTracesTo, { recursive: true });
    fs.copyFileSync(readTrace(o.logsDir, r1.runId).file, path.join(o.copyTracesTo, 'run1.jsonl'));
    if (memoryIds.length) fs.copyFileSync(readTrace(o.logsDir, approveId).file, path.join(o.copyTracesTo, 'approve.jsonl'));
    fs.copyFileSync(t2.file, path.join(o.copyTracesTo, 'run2.jsonl'));
  }
  return {
    r1, r2,
    learning: { run1Approved: !!subtle1, run2Blocked: !!subtle1 && !subtle2 && subtleCited !== null, citedRuleId: subtleCited, collateralBlocked },
    obvious: { title: o.trapTitle, run1Approved: !!obvious1, run2Blocked: !!obvious1 && !obvious2 && obviousCited !== null, citedRuleId: obviousCited },
    ruleText: subtleCited ? ruleTextById.get(subtleCited) ?? null : null,
  };
}

/** Counts what the loops did in one run, straight from its agent trace lines. */
export function loopCountsOf(runId: string, lines: { agent_name: string; action?: string; status: string }[]): LoopCounts {
  const n = (f: (l: { agent_name: string; action?: string; status: string }) => boolean) => lines.filter(f).length;
  return {
    runId,
    sendBacks: n((l) => l.action === 'challenge_benefits' && l.status === 'retry'),
    corrections: n((l) => l.agent_name === 'fact_checker' && l.action === 'correction'),
    rebuttals: n((l) => l.action === 'rebut'),
    courtRulings: n((l) => l.agent_name === 'judge'),
    courtBlocks: n((l) => l.agent_name === 'judge' && l.status === 'blocked'),
    savedVerdictReads: n((l) => l.action === 'saved_verdicts'),
    eligibilityQuestions: n((l) => l.action === 'eligibility_check'),
    recallVerifications: n((l) => l.agent_name === 'recall' && l.action === 'check_recalls'),
    safetyChecks: n((l) => l.action === 'safety_check'),
    cardsApproved: n((l) => l.action === 'approve_card'),
    cardsRejected: n((l) => l.action === 'reject_card'),
  };
}

const FINE_PRINT_FIELDS = [
  'hiddenCostCents', 'trueValueCents', 'deadlineDate', 'expired', 'daysLeft', 'mailIn', 'needsReceipt', 'needsProofOfPurchase',
  'claimWindowDays', 'payoutWaitDaysMin', 'payoutWaitDaysMax', 'payoutForm', 'needsPhoneCall', 'needsForms', 'autoRenew',
  'renewalPriceCents', 'renewalPeriod', 'cancelMethod', 'cardRequired', 'minPurchaseCents', 'limitedStock', 'regionsExcluded',
  'inStoreOnly', 'accountRequired', 'appRequired', 'marketingOptInRequired', 'injectionDetected', 'onePerHousehold', 'verdict',
] as const;

/** Grades the fine-print code rules (no AI) against the made-up cases and their answer key. Every number is computed here. */
export function scoreFinePrint(casesFile = path.resolve('data/sample/fine-print-cases/cases.json')): FinePrintScore {
  const file = JSON.parse(fs.readFileSync(casesFile, 'utf8')) as { today: string; cases: { id: string; text: string; expect: Record<string, unknown> }[] };
  let catchesFound = 0, catchesTotal = 0, controlFalseAlarms = 0, controlsTotal = 0, fieldsCorrect = 0, fieldsTotal = 0, inexactQuotes = 0;
  for (const c of file.cases) {
    const r = checkFinePrint(c.text, { today: file.today });
    const got = r as unknown as Record<string, unknown>;
    for (const f of FINE_PRINT_FIELDS) if (f in c.expect) { fieldsTotal++; if (JSON.stringify(got[f]) === JSON.stringify(c.expect[f])) fieldsCorrect++; }
    const want = (c.expect.catchTypes as string[] | undefined) ?? [];
    if (want.length) { catchesTotal++; if (want.every((t) => r.catchTypes.includes(t as never))) catchesFound++; }
    if (c.id.startsWith('CTRL')) { controlsTotal++; if (r.catchTypes.length) controlFalseAlarms++; }
    if (!quoteIsExact(r.evidenceQuote, c.text)) inexactQuotes++;
  }
  return {
    cases: file.cases.length, catchesFound, catchesTotal, controlFalseAlarms, controlsTotal, fieldsCorrect, fieldsTotal,
    fieldAccuracyPct: fieldsTotal ? Math.round((fieldsCorrect / fieldsTotal) * 1000) / 10 : 0, inexactQuotes,
  };
}

/** Photo intake is only measurable with a saved vision replay; with none, say so instead of reporting a made-up zero. */
export function photoMetrics(dir = path.resolve('data/sample/vision-cache')): Scoreboard['photo'] {
  const saved = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  return saved.length
    ? { measured: false, madeUpRate: null, note: `${saved.length} saved vision replay(s) found, but the made-up-field check needs a labelled photo answer key: not measured offline` }
    : { measured: false, madeUpRate: null, note: 'not measured offline: no saved vision replay (needs a real vision model; target made-up rate 0)' };
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

  const subtleTitle: string = expected.traps.subtle_subscription_savings.offerTitle;

  const learn = await runLearning({ z, llm, memory, store, logsDir, trapTitle, subtleTitle, copyTracesTo: opts.copyTracesTo });

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
  set('duplicate', mayaRuns.length > 0 && mayaRuns.every((r) => r.receipt.itemsChecked === T.duplicate.itemsChecked && !r.cards.some((c) => T.duplicate.mustNotHaveIdContains.some((s: string) => c.id.includes(s)))), `${mayaRuns[0]?.receipt.itemsChecked} distinct items checked (duplicate counted once)`);
  set('non_ma_family', avaRuns.length > 0 && avaRuns.every((r) => !r.cards.some((c) => c.id.startsWith(T.non_ma_family.mustNotHaveIdPrefix))), 'Ohio family gets no Massachusetts benefit');
  set('subtle_subscription_savings', learn.learning.run1Approved && learn.learning.run2Blocked && mayaRuns.every((r) => !r.cards.some((c) => c.title === subtleTitle)) && !learn.learning.collateralBlocked,
    learn.learning.run2Blocked ? `approved in run 1, blocked after learning, cites ${learn.learning.citedRuleId}; ${learn.learning.collateralBlocked} other offer(s) wrongly blocked` : 'not blocked after learning');
  const lookAlikes: string[] = [...T.no_false_recall.mustNotHaveIdContains, ...T.no_terminated_fda.mustNotHaveIdContains];
  const wrongRecalls = mayaRuns.flatMap((r) => r.cards.filter((c) => c.kind === 'recall' && lookAlikes.some((s) => c.id.includes(s))).map((c) => c.id));
  set('no_false_recall', mayaRuns.length > 0 && !mayaRuns.some((r) => r.cards.some((c) => T.no_false_recall.mustNotHaveIdContains.some((s: string) => c.id.includes(s)))), 'look-alike products (shared words, different product) get no recall card');
  set('no_terminated_fda', mayaRuns.length > 0 && !mayaRuns.some((r) => r.cards.some((c) => T.no_terminated_fda.mustNotHaveIdContains.some((s: string) => c.id.includes(s)))), 'finished (Terminated) FDA recalls get no card');
  if (opts.learningOnly) for (const k of ['recalled_item', 'duplicate', 'non_ma_family', 'no_false_recall', 'no_terminated_fda']) if (!traps[k].caught) traps[k].detail += ' (learning-only run: not measured)';

  // Every verified/likely card, and every accepted Scout row, must carry a source link.
  const cards = Object.values(perFamily).flat().flatMap((r) => r.cards).filter((c) => c.verdict === 'verified' || c.verdict === 'likely');
  const cardOk = cards.filter((c) => c.sources.some((s) => /^https?:\/\//.test(s.url))).length;
  const scoutRows = [...sc.rules, ...sc.offers];
  const scoutOk = scoutRows.filter((r) => /^https:\/\//.test(r.sourceUrl)).length;
  const total = cards.length + scoutRows.length;
  const sourcedPct = total ? Math.round(((cardOk + scoutOk) / total) * 1000) / 10 : 0;

  const finePrint = scoreFinePrint();
  // Other kinds of false alarm: a control fine print that raised a catch, a good offer the learned rules wrongly blocked, a wrong recall shown.
  falseAlarms += finePrint.controlFalseAlarms + (learn.learning.collateralBlocked ?? 0) + wrongRecalls.length;
  if (finePrint.controlFalseAlarms) failures.push(`fine print: ${finePrint.controlFalseAlarms} control(s) raised a catch`);
  if (learn.learning.collateralBlocked) failures.push(`learning: ${learn.learning.collateralBlocked} good offer(s) wrongly blocked after learning`);
  for (const id of wrongRecalls) failures.push(`recall: wrong recall card shown (${id})`);
  const recall = {
    expected: Object.values(T).filter((t) => (t as { cardId?: string }).cardId?.startsWith('recall-')).length, caught: mayaRuns.length > 0 && mayaRuns.every((r) => r.cards.some((c) => c.id === T.recalled_item.cardId && c.verdict === 'verified')) ? 1 : 0,
    wrongShown: wrongRecalls.length, lookAlikesChecked: lookAlikes.length,
  };
  const loops: Scoreboard['loops'] = {};
  for (const id of FAMILIES) if (perFamily[id].length) loops[id] = perFamily[id].map((r) => loopCountsOf(r.runId, readTrace(logsDir, r.runId).lines));

  const stable = FAMILIES.every((id) => perFamily[id].length < 2 || new Set(perFamily[id].map(sig)).size === 1);
  return {
    trapsCaught: Object.values(traps).filter((t) => t.caught).length, trapsTotal: Object.keys(traps).length, falseAlarms, sourcedPct,
    runs: n, stable, learning: learn.learning, llmMode: llmModeOf(llm), llmCalls: llmCallsOf(llm), scoutLlmMode: 'fake-llm', generatedAt: new Date().toISOString(),
    demoDate: resolveToday('maya').today, traps, expectationFailures: failures, moneyBackCents: moneyBack,
    learningDetail: { run1Id: learn.r1.runId, run2Id: learn.r2.runId, ruleText: learn.ruleText, storedIn: store instanceof MemoryStore ? 'memory' : 'neon', trapTitle: subtleTitle, obviousTrap: learn.obvious },
    scout: { accepted: scoutRows.length, rejected: sc.rejected.map((r) => ({ title: r.title, reason: r.reason })) },
    finePrint, recall, photo: photoMetrics(), loops,
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
    moneyBackCents: null, scout: null, finePrint: null, recall: null, photo: null, loops: null,
  };
  return { ...base, generatedAt: sb.generatedAt, learning: sb.learning, learningDetail: sb.learningDetail, learningLlmMode: sb.llmMode, learningLlmCalls: sb.llmCalls };
}

async function main() {
  loadEnv();
  const args = new Set(process.argv.slice(2));
  // Only build a live model chain when asked (LIVE_MODEL=true or --require-model); otherwise the eval runs offline on purpose.
  const wantLive = args.has('--require-model') || isLiveModel();
  const llm = wantLive ? createGenerator() : new UnavailableGenerator('live model not requested (set LIVE_MODEL=true or pass --require-model)');
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

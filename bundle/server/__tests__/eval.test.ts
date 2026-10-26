import fs from 'fs';
import os from 'os';
import path from 'path';
import { runEval, makeEvalZetaris, mergeLearning, ISSUE_FIXTURES } from '../../scripts/eval';
import { scout } from '../../scripts/scout';
import { loopsOf, type LoopKind } from '@shared/agentLoops';
import type { AgentLogLine } from '@shared/agentLog';
import { FakeGenerator } from '../adapters/llm';

const PAGES = path.resolve('data/sample/saved-pages');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'eval-'));

// Replay cache only: with no credentials in the test environment, any cache miss fails the test instead of calling the network.
const OLD = { ...process.env };
beforeAll(() => { delete process.env.ZETARIS_BASE_URL; delete process.env.ZETARIS_ORG_ID; delete process.env.ZETARIS_API_KEY; });
afterAll(() => { process.env = { ...OLD }; });

describe('runEval (offline: no model key, replayed Zetaris, fake families)', () => {
  jest.setTimeout(120000);
  let sb: Awaited<ReturnType<typeof runEval>>;
  const logsDir = tmp();
  beforeAll(async () => { sb = await runEval({ z: makeEvalZetaris({ freshVerdicts: true }), logsDir }); });

  it('has 8 traps, all sourced, stable across 3 runs', () => {
    expect(sb.trapsTotal).toBe(8);
    expect(sb.sourcedPct).toBe(100);
    expect(sb.runs).toBe(3);
    expect(sb.stable).toBe(true);
    expect(sb.expectationFailures).toEqual([]);
    expect(sb.falseAlarms).toBe(0);
    expect(sb.trapsCaught).toBe(8);
  });

  it('maya money back is exactly $48.99 and does not depend on the clock (price window ends on the demo date)', () => {
    expect(sb.moneyBackCents.maya).toBe(4899);
    expect(sb.moneyBackCents.leo).toBe(0);
    expect(sb.moneyBackCents.ava).toBe(1458);
  });

  it('learning demo flips the trap offer from approved to blocked, citing the learned rule', () => {
    expect(sb.learning.run1Approved).toBe(true);
    expect(sb.learning.run2Blocked).toBe(true);
    expect(sb.learning.citedRuleId).toEqual(expect.any(String));
    expect(sb.learningDetail.ruleText).toMatch(/subscription/i);
    expect(sb.learningDetail.trapTitle).toBe('Amazon Subscribe & Save diaper discount');
    expect(sb.learning.collateralBlocked).toBe(0);
    expect(sb.learningDetail.obviousTrap).toMatchObject({ run1Approved: true, run2Blocked: true });
    const run2 = fs.readFileSync(path.join(logsDir, `run-${sb.learningDetail.run2Id}.jsonl`), 'utf8');
    expect(run2).toContain(`[cited ${sb.learning.citedRuleId}]`);
    const approve = fs.readFileSync(path.join(logsDir, `run-approve-${sb.learningDetail.run1Id}.jsonl`), 'utf8');
    expect(approve).toContain('"action":"add_rule"');
    expect(run2).toContain('"action":"recall_rules"');
    expect(run2).toMatch(/"agent_name":"zetaris"/);
    const run1 = fs.readFileSync(path.join(logsDir, `run-${sb.learningDetail.run1Id}.jsonl`), 'utf8');
    expect(run1).not.toContain('[cited ');
  });

  it('demo date comes from the demo-date rule', () => {
    expect(sb.demoDate).toBe('2026-10-23');
  });

  it('a --learning run keeps the full scoreboard and only refreshes the learning fields', () => {
    const merged = mergeLearning({ ...sb, trapsCaught: 8 }, { ...sb, learning: { run1Approved: false, run2Blocked: false, citedRuleId: null } });
    expect(merged.trapsCaught).toBe(8);
    expect(merged.trapsTotal).toBe(8);
    expect(merged.learning).toEqual({ run1Approved: false, run2Blocked: false, citedRuleId: null });
    const fresh = mergeLearning(null, sb);
    expect(fresh.learning).toEqual(sb.learning);
    expect(fresh.trapsCaught).toBeNull();
    expect(fresh.traps).toBeNull();
  });

  it('labels what was behind the numbers', () => {
    expect(sb.llmMode).toBe('offline-fallback');
    expect(sb.scoutLlmMode).toBe('fake-llm');
  });

  it('scores the fine-print rules against the answer key, with controls and honest nulls', () => {
    expect(sb.finePrint.cases).toBe(15);
    expect(sb.finePrint.controlsTotal).toBe(3);
    expect(sb.finePrint.controlFalseAlarms).toBe(0);
    expect(sb.finePrint.catchesFound).toBe(sb.finePrint.catchesTotal);
    expect(sb.finePrint.fieldsCorrect).toBe(sb.finePrint.fieldsTotal);
    expect(sb.finePrint.fieldsTotal).toBeGreaterThan(30);
    expect(sb.finePrint.inexactQuotes).toBe(0);
    expect(sb.photo).toMatchObject({ measured: false, madeUpRate: null });
    expect(sb.recall).toMatchObject({ expected: 1, caught: 1, wrongShown: 0 });
  });

  it('counts the loops from the real trace of every run', () => {
    expect(Object.keys(sb.loops).sort()).toEqual(['ava', 'leo', 'maya']);
    for (const runs of Object.values(sb.loops)) {
      expect(runs).toHaveLength(3);
      for (const r of runs) {
        const trace = fs.readFileSync(path.join(logsDir, `run-${r.runId}.jsonl`), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
        expect(r.cardsApproved).toBe(trace.filter((l: { action: string }) => l.action === 'approve_card').length);
        expect(r.courtRulings).toBe(trace.filter((l: { agent_name: string }) => l.agent_name === 'judge').length);
        // the loop rounds use the owner panel's rules (shared/agentLoops.ts) on the agent log, so the two never disagree
        const agentLog = fs.readFileSync(path.join(logsDir, `run_bundle_${r.runId.replace(/[^A-Za-z0-9_-]/g, '_')}.jsonl`), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
        const rounds = (k: LoopKind) => agentLog.filter((l: AgentLogLine) => loopsOf(l).includes(k)).length;
        expect(r.eligibilityQuestions).toBe(rounds('eligibility'));
        expect(r.sendBacks).toBe(rounds('send_back'));
        expect(r.rebuttals).toBe(rounds('rebuttal'));
        expect(r.recallVerifications).toBe(rounds('recall_check'));
        expect(r.eligibilityQuestions).toBeLessThanOrEqual(trace.filter((l: { action: string }) => l.action === 'eligibility_check').length);
      }
    }
    expect(sb.loops.maya[0].courtBlocks).toBeGreaterThan(0);
  });

  it('fixture feedback is three auto-renew complaints (no personal data)', () => {
    expect(ISSUE_FIXTURES).toHaveLength(3);
  });
});

describe('scout', () => {
  const page = (rows: unknown[]) => new FakeGenerator([JSON.stringify({ rows })]);
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'a.html'), '<html><head><link rel="canonical" href="https://trumpaccounts.gov"></head><body><p>You get a $1,000 deposit.</p></body></html>');
  const good = { kind: 'rule', title: 'Trump Account', code: 'TRUMP_ACCOUNT', scope: 'federal', amountCents: 100000, sourceUrl: 'https://trumpaccounts.gov' };

  it('keeps a sourced, on-page row', async () => {
    const r = await scout(dir, { llm: page([good]), logsDir: tmp() });
    expect(r.rules).toHaveLength(1);
    expect(r.rejected).toEqual([]);
  });
  it('rejects a row with no source (Fact-Checker `no source` rule), a wrong amount, and a foreign source', async () => {
    const r = await scout(dir, { llm: page([{ ...good, sourceUrl: '' }, { ...good, amountCents: 500000 }, { ...good, sourceUrl: 'https://evil.example.org/x' }]), logsDir: tmp() });
    expect(r.rules).toHaveLength(0);
    expect(r.rejected.map((x) => x.reason)).toEqual([
      'no source',
      expect.stringContaining('not written on the page'),
      expect.stringContaining("not the page's own site"),
    ]);
  });
  it('with no model it extracts nothing and says so', async () => {
    const r = await scout(dir, { llm: { generate: async () => { throw Object.assign(new Error('x'), { name: 'ModelUnavailable' }); } } as any, logsDir: tmp() });
    expect(r.rules).toEqual([]);
    expect(r.llmMode).toBe('unavailable');
  });
  it('reads the 3 saved pages in the repo', () => {
    expect(fs.readdirSync(PAGES).filter((f) => f.endsWith('.html'))).toHaveLength(3);
  });
});

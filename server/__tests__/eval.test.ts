import fs from 'fs';
import os from 'os';
import path from 'path';
import { runEval, makeEvalZetaris, ISSUE_FIXTURES } from '../../scripts/eval';
import { scout } from '../../scripts/scout';
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
  beforeAll(async () => { sb = await runEval({ z: makeEvalZetaris(), logsDir }); });

  it('has 6 traps, all sourced, stable across 3 runs', () => {
    expect(sb.trapsTotal).toBe(6);
    expect(sb.sourcedPct).toBe(100);
    expect(sb.runs).toBe(3);
    expect(sb.stable).toBe(true);
    expect(sb.expectationFailures).toEqual([]);
    expect(sb.falseAlarms).toBe(0);
    expect(sb.trapsCaught).toBe(6);
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
    expect(sb.learningDetail.ruleText).toMatch(/membership/i);
    const run2 = fs.readFileSync(path.join(logsDir, `run-${sb.learningDetail.run2Id}.jsonl`), 'utf8');
    expect(run2).toContain(`[cited ${sb.learning.citedRuleId}]`);
    const run1 = fs.readFileSync(path.join(logsDir, `run-${sb.learningDetail.run1Id}.jsonl`), 'utf8');
    expect(run1).not.toContain('[cited ');
  });

  it('labels what was behind the numbers', () => {
    expect(sb.llmMode).toBe('offline-fallback');
    expect(sb.scoutLlmMode).toBe('fake-llm');
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

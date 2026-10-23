import type { FeedCard } from '@shared/bundle';
import type { TraceLine } from '../bundle';
import { sourceNames, redactSql, zetarisForCard, memoryForCard, blockedReason } from '../howWeChecked';

const card = (id: string, kind: FeedCard['kind']): FeedCard => ({ id, kind, title: id, body: '', amountCents: null, deadline: null, verdict: 'verified', sources: [], traceId: '' });
let n = 0;
const line = (agent_name: string, action: string, input_summary: string, output_summary = '', extra: Partial<TraceLine> = {}): TraceLine => ({
  timestamp: '2026-10-23T00:00:00Z', trace_id: `t${n++}`, agent_name, action, input_summary, output_summary, target_agent: null, confidence: null, retry_count: 0, status: 'ok', ...extra,
});
const z = (sql: string, action = 'query_cached', out = '1 rows (sample cache)') => line('zetaris', action, sql, out);

describe('sourceNames', () => {
  it('maps tables to plain-English names', () => {
    expect(sourceNames('SELECT x FROM bundle_pg.v_recall_orders WHERE family_id = 1')).toEqual(['Your purchases (private, Neon)']);
    expect(sourceNames('SELECT RecallID FROM bundle_live.cpsc_recalls')).toEqual(['CPSC recall list (live government feed)']);
    expect(sourceNames('FROM bundle_live.fda_food_recalls')).toEqual(['openFDA food recalls']);
    expect(sourceNames('FROM bundle_pg.benefit_rules')).toEqual(['Program rules']);
    expect(sourceNames('FROM bundle_pg.v_judge_offers')).toEqual(['Offers']);
  });
  it('lists several sources once each, and nothing for unknown tables', () => {
    expect(sourceNames('FROM bundle_pg.v_recall_orders i JOIN bundle_live.cpsc_recalls r JOIN bundle_live.fda_food_recalls f')).toHaveLength(3);
    expect(sourceNames('FROM mystery.table')).toEqual([]);
  });
});

describe('redactSql', () => {
  it('hides string literals and income columns', () => {
    const out = redactSql("SELECT annual_income_cents FROM v WHERE family_id = 'maya' AND note = 'it''s'");
    expect(out).not.toMatch(/maya|income|it''s/);
    expect(out).toContain("family_id = '?'");
  });
});

describe('zetarisForCard', () => {
  const lines = [
    z("SELECT i.item_text FROM bundle_pg.v_recall_orders i JOIN bundle_live.cpsc_recalls r ON 1=1"),
    z('SELECT RecallID FROM bundle_live.cpsc_recalls WHERE RecallID = 10560'),
    z('SELECT RecallID FROM bundle_live.cpsc_recalls WHERE RecallID = 99999'),
    z('SELECT value_cents, max_age_days FROM bundle_pg.v_judge_offers WHERE id = 1191'),
    z('SELECT id, title FROM bundle_pg.v_judge_offers ORDER BY id'),
    z("SELECT amount_cents FROM bundle_pg.v_clawback_tx WHERE id = 'maya-tx-01' AND family_id = 'maya'"),
  ];
  it('ties a recall card to its own recall and the purchases query, not other recalls', () => {
    const v = zetarisForCard(card('recall-cpsc-10560', 'recall'), lines)!;
    expect(v.queries).toBe(2);
    expect(v.sources).toEqual(['Your purchases (private, Neon)', 'CPSC recall list (live government feed)']);
    expect(v.saved).toBe(true);
    expect(v.sql.join(' ')).not.toMatch(/maya|99999/);
  });
  it('ties a discount card to its offer id', () => {
    const v = zetarisForCard(card('discount-1191', 'discount'), lines)!;
    expect(v.sources).toEqual(['Offers']);
    expect(v.queries).toBe(2);
  });
  it('ties a clawback card to its transaction, with literals redacted', () => {
    const v = zetarisForCard(card('clawback-fsa-maya-tx-01', 'clawback'), lines)!;
    expect(v.queries).toBe(1);
    expect(v.sql[0]).not.toContain('maya');
  });
  it('shows nothing when no query maps (unknown card, other offer, or errored query)', () => {
    expect(zetarisForCard(card('coming-soon-x', 'coming_soon'), lines)).toBeNull();
    expect(zetarisForCard(card('discount-4242', 'discount'), [lines[3]])).toBeNull();
    expect(zetarisForCard(card('benefit-ma_pfml', 'benefit'), [{ ...z("SELECT 1 FROM bundle_pg.benefit_rules WHERE code = 'MA_PFML'", 'query', 'unavailable'), status: 'error' as const }])).toBeNull();
  });
  it('sums live timing and is not "saved" for live queries', () => {
    const live = [z('SELECT RecallID FROM bundle_live.cpsc_recalls WHERE RecallID = 7', 'query', '1 rows in 120 ms'), z('SELECT x FROM bundle_pg.v_recall_orders', 'query', '3 rows in 30 ms')];
    const v = zetarisForCard(card('recall-cpsc-7', 'recall'), live)!;
    expect(v).toMatchObject({ saved: false, ms: 150, queries: 2 });
  });
});

describe('memoryForCard', () => {
  const base = [
    line('memory', 'recall_rules', 'Free box requires a card', '1 rule(s)', { confidence: 0.8 }),
    line('memory', 'rule_recalled', 'offer 1190', 'mem-1|0.80|2|Reject offers whose free trial auto-renews | into paid'),
    line('memory', 'rule_recalled', 'offer 1191', 'mem-2|0.60|1|Other rule'),
    line('judge', 'rule_by_screen', 'offer 1190', 'reject: nope [cited mem-1]', { status: 'blocked' }),
  ];
  it('returns the rule text, id, confidence, report count and cited flag for that offer only', () => {
    expect(memoryForCard(card('discount-1190', 'discount'), base)).toEqual([
      { id: 'mem-1', text: 'Reject offers whose free trial auto-renews | into paid', confidence: 0.8, reports: 2, cited: true },
    ]);
  });
  it('shows nothing for other kinds, no recalled rule, or malformed lines', () => {
    expect(memoryForCard(card('recall-cpsc-1', 'recall'), base)).toEqual([]);
    expect(memoryForCard(card('discount-5', 'discount'), base)).toEqual([]);
    expect(memoryForCard(card('discount-1190', 'discount'), [line('memory', 'rule_recalled', 'offer 1190', 'garbage')])).toEqual([]);
  });
});

describe('blocked offers', () => {
  const lines = [
    z('SELECT id, title FROM bundle_pg.v_judge_offers ORDER BY id'),
    line('memory', 'rule_recalled', 'offer 1190', 'mem-1|0.70|2|Reject offers whose free trial auto-renews.'),
    line('judge', 'rule_by_screen', 'offer 1190', 'reject: x [cited mem-1]', { status: 'blocked' }),
  ];
  const blocked = { ...card('blocked-1190', 'discount'), verdict: 'blocked' as const, body: 'Court was offline; case law applies: Reject offers whose free trial auto-renews. More text.' };
  it('finds the cited rule and the Zetaris offers source for a blocked-N card', () => {
    expect(memoryForCard(blocked, lines)).toEqual([{ id: 'mem-1', text: 'Reject offers whose free trial auto-renews.', confidence: 0.7, reports: 2, cited: true }]);
    expect(zetarisForCard(blocked, lines)!.sources).toEqual(['Offers']);
  });
  it('gives a one-line plain reason', () => {
    expect(blockedReason(blocked)).toBe('A rule parents taught us applies: Reject offers whose free trial auto-renews.');
    expect(blockedReason({ ...blocked, body: 'x'.repeat(300) }).length).toBeLessThanOrEqual(120);
  });
});

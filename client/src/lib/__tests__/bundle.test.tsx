import type { FeedCard } from '@shared/bundle';
import { groupCards, traceForCard, familyChip, fmtUsdShort, type TraceLine } from '../bundle';

const c = (id: string, kind: FeedCard['kind'], traceId = ''): FeedCard => ({
  id, kind, title: id, body: '', amountCents: null, deadline: null, verdict: 'verified', sources: [], traceId,
});
const line = (trace_id: string, agent_name: string, action: string, input_summary: string): TraceLine => ({
  timestamp: '2026-10-23T00:00:00Z', trace_id, agent_name, action, input_summary, output_summary: '', target_agent: null, confidence: null, retry_count: 0, status: 'ok',
});

describe('groupCards', () => {
  it('pins the insurance card, then orders clawback, recall, benefit, discount, coming_soon, and adds the Plaid tile', () => {
    const cards = [c('discount-1', 'discount'), c('benefit-trump_account', 'benefit'), c('coming-soon-prefilled', 'coming_soon'),
      c('benefit-insurance_add_baby', 'benefit'), c('recall-cpsc-1', 'recall'), c('clawback-fsa-x', 'clawback')];
    const { pinned, groups } = groupCards(cards);
    expect(pinned?.id).toBe('benefit-insurance_add_baby');
    expect(groups.map((g) => g.kind)).toEqual(['clawback', 'recall', 'benefit', 'discount', 'coming_soon']);
    expect(groups[2].cards.map((x) => x.id)).toEqual(['benefit-trump_account']);
    expect(groups[4].cards.map((x) => x.title)).toEqual(['coming-soon-prefilled', 'Connect your bank (Plaid)']);
  });
});

describe('traceForCard', () => {
  it('keeps the card line, its explanation, court arguments and fact-checks only', () => {
    const lines = [
      line('a', 'judge', 'rule', 'offer 673'),
      line('b', 'fine_print_lawyer', 'argue', 'offer 674'),
      line('c', 'benefits', 'explain', 'Benefit: x'),
      line('d', 'benefits', 'benefit_match', 'rule X'),
      line('e', 'fact_checker', 'verify', 'discount card discount-673 from fine_print_court: claim'),
      line('f', 'fact_checker', 'verify', 'discount card discount-6730 from fine_print_court: claim'),
    ];
    expect(traceForCard(c('discount-673', 'discount', 'a'), lines).map((l) => l.trace_id)).toEqual(['a', 'e']);
    expect(traceForCard(c('benefit-x', 'benefit', 'd'), lines).map((l) => l.trace_id)).toEqual(['c', 'd']);
  });
});

describe('formatting', () => {
  it('family chip and short receipt numbers', () => {
    expect(familyChip({ name: 'Maya (sample family)', birthDate: '2026-10-03', dueDate: null }, '2026-10-23')).toBe('Baby Maya · day 20');
    expect(fmtUsdShort(364000)).toBe('$3,640');
    expect(fmtUsdShort(4899)).toBe('$48.99');
  });
});

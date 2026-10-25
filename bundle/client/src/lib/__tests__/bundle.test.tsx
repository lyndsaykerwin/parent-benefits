import type { FeedCard } from '@shared/bundle';
import { groupCards, amountCaption, UNCHECKED_DEALS_SECTION, traceForCard, describeLine, familyChip, fmtUsdShort, type TraceLine } from '../bundle';

const c = (id: string, kind: FeedCard['kind'], traceId = ''): FeedCard => ({
  id, kind, title: id, body: '', amountCents: null, deadline: null, verdict: 'verified', sources: [], traceId,
});
const line = (trace_id: string, agent_name: string, action: string, input_summary: string): TraceLine => ({
  timestamp: '2026-10-23T00:00:00Z', trace_id, agent_name, action, input_summary, output_summary: '', target_agent: null, confidence: null, retry_count: 0, status: 'ok',
});

describe('groupCards', () => {
  it('pins the insurance card, then orders clawback, recall, benefit, discount, coming_soon', () => {
    const cards = [c('discount-1', 'discount'), c('benefit-trump_account', 'benefit'), c('coming-soon-prefilled', 'coming_soon'),
      c('benefit-insurance_add_baby', 'benefit'), c('recall-cpsc-1', 'recall'), c('clawback-fsa-x', 'clawback')];
    const { pinned, groups } = groupCards(cards);
    expect(pinned?.id).toBe('benefit-insurance_add_baby');
    expect(groups.map((g) => g.kind)).toEqual(['clawback', 'recall', 'benefit', 'discount', 'coming_soon']);
    expect(groups[2].cards.map((x) => x.id)).toEqual(['benefit-trump_account']);
    expect(groups[4].cards.map((x) => x.title)).toEqual(['coming-soon-prefilled']);
  });
});

describe('I2: deals the court has not checked', () => {
  const info = (id: string, kind: FeedCard['kind']): FeedCard => ({ ...c(id, kind), verdict: 'info', amountCents: 3500 });

  it('puts "Not yet verified" discounts in their own group, after the checked deals', () => {
    const { groups } = groupCards([info('fallback-offer-1', 'discount'), c('discount-1', 'discount')]);
    const discounts = groups.filter((g) => g.kind === 'discount');
    expect(discounts.map((g) => g.unchecked ?? false)).toEqual([false, true]);
    expect(discounts[0].cards.map((x) => x.id)).toEqual(['discount-1']);
    expect(discounts[1].cards.map((x) => x.id)).toEqual(['fallback-offer-1']);
    expect(UNCHECKED_DEALS_SECTION).not.toMatch(/passed/i);
  });

  it('with only stand-in deals there is no "passed Fine Print Court" group at all', () => {
    const { groups } = groupCards([info('fallback-offer-1', 'discount'), info('fallback-offer-2', 'discount')]);
    expect(groups.filter((g) => g.kind === 'discount').every((g) => g.unchecked)).toBe(true);
  });

  it('M4: an unverified insurance stand-in is not pinned, and "info" cards are captioned "not yet verified"', () => {
    const filler = info('fallback-benefit-insurance_add_baby', 'benefit');
    expect(groupCards([filler]).pinned).toBeNull();
    expect(groupCards([c('benefit-insurance_add_baby', 'benefit')]).pinned?.id).toBe('benefit-insurance_add_baby');
    expect(amountCaption(filler)).toBe('not yet verified');
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

describe('describeLine for memory rules', () => {
  it('says which rule was recalled in plain English, not raw pipe text', () => {
    const l = line('t', 'memory', 'rule_recalled', 'offer 1190');
    expect(describeLine({ ...l, output_summary: 'mem-1|0.70|2|Reject offers whose trial auto-renews' })).toBe('Memory recalled rule mem-1 (70%)');
  });
});

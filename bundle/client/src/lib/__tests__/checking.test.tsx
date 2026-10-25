import { checkLines } from '../checking';
import { applyInsuranceAnswer, isAddBabyCard, taxYearFor } from '../insurance';
import type { FeedCard } from '@shared/bundle';

const titles = (f?: Parameters<typeof checkLines>[0]) => checkLines(f).map((l) => l.title);
const base = { name: 'x', birthDate: '2026-10-03', dueDate: null };

describe('checkLines: the checking screen is built from the answers', () => {
  it('both working: benefits, insurance, daycare + FSA, gifts, double-check (no recall line without items)', () => {
    expect(titles({ ...base, household: 'two', parent1Work: 'paycheck', parent2Work: 'paycheck', insurance: 'job' })).toEqual([
      'State and federal family benefits', 'Insurance deadline to add your baby', 'Daycare tax savings and Dependent Care FSA',
      'Free registry gifts and welcome boxes', 'Every result double-checked against its official source',
    ]);
  });
  it('the recall line shows only when the family has items, just before the double-check', () => {
    const t = titles({ ...base, household: 'one', parent1Work: 'paycheck', hasItems: true });
    expect(t).toContain('Your items vs. official recall lists');
    expect(t.at(-2)).toBe('Your items vs. official recall lists');
    expect(titles({ ...base, household: 'one', parent1Work: 'paycheck', hasItems: false })).not.toContain('Your items vs. official recall lists');
  });
  it('the daycare line follows the eligibility rule', () => {
    expect(titles({ ...base, household: 'one', parent1Work: 'self_employed' })).toContain('Childcare tax credit');
    expect(titles({ ...base, household: 'one', parent1Work: 'self_employed' }).join()).not.toMatch(/FSA/);
    expect(titles({ ...base, household: 'two', parent1Work: 'paycheck', parent2Work: 'not_working' }).join()).not.toMatch(/aycare|FSA/);
    expect(titles({ ...base, household: null, parent1Work: null })).toContain('Daycare tax savings (general)');
    expect(titles(undefined)).toContain('Daycare tax savings (general)');
  });
  it('only the double-check line waits for the run to finish', () => {
    const lines = checkLines({ ...base, household: 'one', parent1Work: 'paycheck', hasItems: true });
    expect(lines.filter((l) => l.final).map((l) => l.key)).toEqual(['double_check']);
    expect(lines.at(-1)!.final).toBe(true);
  });
});

const card = (over: Partial<FeedCard> = {}): FeedCard => ({
  id: 'benefit-insurance_add_baby', kind: 'benefit', title: 'Add your baby to health insurance', body: 'Do this by 2026-11-02.', amountCents: null,
  deadline: '2026-11-02', verdict: 'likely', sources: [], traceId: 't', ...over,
});

describe('applyInsuranceAnswer: the insurance card follows Q5', () => {
  const fam = (insurance: any, extra: object = {}) => ({ ...base, insurance, ...extra });
  it('job keeps 30 days; marketplace moves it to 60; TRICARE to 90', () => {
    expect(applyInsuranceAnswer([card()], fam('job'))[0].deadline).toBe('2026-11-02');
    expect(applyInsuranceAnswer([card()], fam('marketplace'))[0].deadline).toBe('2026-12-02');
    expect(applyInsuranceAnswer([card()], fam('tricare'))[0].deadline).toBe('2027-01-01');
  });
  it('Medicaid and "not sure" have no countdown, and the sentence matches the answer', () => {
    const med = applyInsuranceAnswer([card()], fam('medicaid'))[0];
    expect(med.deadline).toBeNull();
    expect(med.body).toMatch(/Report the birth within 10 days/);
    expect(applyInsuranceAnswer([card()], fam('none_or_not_sure', { state: 'MA' }))[0].deadline).toBeNull();
  });
  it('counts from the due date while expecting', () => {
    expect(applyInsuranceAnswer([card()], { name: 'x', birthDate: null, dueDate: '2026-12-07', insurance: 'job' })[0].deadline).toBe('2027-01-06');
  });
  it('no answer leaves every card exactly as the server made it; other cards are untouched', () => {
    const cards = [card(), card({ id: 'benefit-ma_pfml', deadline: '2027-10-03' })];
    expect(applyInsuranceAnswer(cards, base)).toBe(cards);
    expect(applyInsuranceAnswer(cards, undefined)).toBe(cards);
    expect(applyInsuranceAnswer(cards, fam('marketplace'))[1]).toBe(cards[1]);
    expect(isAddBabyCard(cards[0])).toBe(true);
    expect(isAddBabyCard(cards[1])).toBe(false);
  });
  it('tax year comes from the baby’s birth or due date', () => {
    expect(taxYearFor({ ...base, birthDate: '2026-10-03' }, '2026-10-23')).toBe(2026);
    expect(taxYearFor({ name: 'x', birthDate: null, dueDate: '2027-01-15' }, '2026-10-23')).toBe(2027);
    expect(taxYearFor(undefined, '2026-10-23')).toBe(2026);
  });
});

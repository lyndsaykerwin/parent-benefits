import { daycareRoute, insuranceChoices, insuranceDeadline, insuranceDeadlineDate, insuranceLabel, medicaidName, questionsToAsk } from '../../shared/eligibility';

describe('daycareRoute: Dependent Care FSA vs childcare credit vs nothing', () => {
  it('two parents with a paycheck: Dependent Care FSA', () => {
    expect(daycareRoute({ household: 'two', parent1Work: 'paycheck', parent2Work: 'paycheck' })).toBe('dcfsa');
  });
  it('one paycheck and one self-employed still has a work account to use', () => {
    expect(daycareRoute({ household: 'two', parent1Work: 'self_employed', parent2Work: 'paycheck' })).toBe('dcfsa');
  });
  it('a single parent with a paycheck: Dependent Care FSA', () => {
    expect(daycareRoute({ household: 'one', parent1Work: 'paycheck' })).toBe('dcfsa');
  });
  it('everyone self-employed: childcare tax credit, no FSA', () => {
    expect(daycareRoute({ household: 'one', parent1Work: 'self_employed' })).toBe('childcare_credit');
    expect(daycareRoute({ household: 'two', parent1Work: 'self_employed', parent2Work: 'self_employed' })).toBe('childcare_credit');
  });
  it('a parent not working: nothing (daycare savings usually need earned income)', () => {
    expect(daycareRoute({ household: 'two', parent1Work: 'paycheck', parent2Work: 'not_working' })).toBe('none');
    expect(daycareRoute({ household: 'two', parent1Work: 'not_working', parent2Work: 'self_employed' })).toBe('none');
    expect(daycareRoute({ household: 'one', parent1Work: 'not_working' })).toBe('none');
  });
  it('a second parent answer is ignored for "Just me"', () => {
    expect(daycareRoute({ household: 'one', parent1Work: 'paycheck', parent2Work: 'not_working' })).toBe('dcfsa');
  });
  it('missing answers (prefer not to say, or an older family) give the general rules', () => {
    expect(daycareRoute({})).toBe('general');
    expect(daycareRoute({ household: null, parent1Work: null })).toBe('general');
    expect(daycareRoute({ household: 'two', parent1Work: 'paycheck' })).toBe('general'); // partner never answered
    expect(daycareRoute({ household: 'two', parent2Work: 'paycheck' })).toBe('general');
  });
});

describe('insuranceDeadline: which add-your-baby deadline applies', () => {
  it('job: 30 days, with "Check your plan"', () => {
    const d = insuranceDeadline('job');
    expect(d).toMatchObject({ kind: 'countdown', days: 30, pill: '30 days from birth to add baby' });
    expect(d.detail).toMatch(/Check your plan/);
  });
  it('marketplace: 60 days', () => {
    expect(insuranceDeadline('marketplace')).toMatchObject({ kind: 'countdown', days: 60, pill: '60 days from birth to add baby' });
  });
  it('TRICARE: 90 days in DEERS, 120 overseas', () => {
    const d = insuranceDeadline('tricare');
    expect(d).toMatchObject({ kind: 'countdown', days: 90, pill: '90 days to register baby in DEERS' });
    expect(d.detail).toMatch(/120 days/);
  });
  it('Medicaid: covered for a year, no countdown, a to-do to report the birth in 10 days', () => {
    const d = insuranceDeadline('medicaid');
    expect(d).toMatchObject({ kind: 'covered', days: null, pill: 'Baby is covered automatically for 1 year' });
    expect(d.todo).toMatch(/within 10 days/);
  });
  it('no insurance / not sure: may qualify, using the state’s own program name', () => {
    expect(insuranceDeadline('none_or_not_sure', 'MA')).toMatchObject({ kind: 'may_qualify', days: null, pill: 'Your baby may qualify for MassHealth', apply: true });
    expect(insuranceDeadline('none_or_not_sure', 'CA').pill).toBe('Your baby may qualify for Medi-Cal');
    expect(insuranceDeadline('none_or_not_sure', 'OH').pill).toBe('Your baby may qualify for Medicaid');
  });
  it('no answer: no exact deadline is claimed', () => {
    for (const v of [null, undefined]) {
      const d = insuranceDeadline(v);
      expect(d.kind).toBe('unknown');
      expect(d.days).toBeNull();
      expect(d.detail).toMatch(/Add your insurance later/);
    }
  });
});

describe('insuranceDeadlineDate', () => {
  it('counts from the birth date (Maya: born Oct 3, 2026)', () => {
    expect(insuranceDeadlineDate('job', '2026-10-03')).toBe('2026-11-02');
    expect(insuranceDeadlineDate('marketplace', '2026-10-03')).toBe('2026-12-02');
    expect(insuranceDeadlineDate('tricare', '2026-10-03')).toBe('2027-01-01');
  });
  it('is null when there is no countdown or no date', () => {
    expect(insuranceDeadlineDate('medicaid', '2026-10-03')).toBeNull();
    expect(insuranceDeadlineDate('none_or_not_sure', '2026-10-03')).toBeNull();
    expect(insuranceDeadlineDate('job', null)).toBeNull();
    expect(insuranceDeadlineDate('job', 'soon')).toBeNull();
  });
});

describe('insurance choices', () => {
  it('shows the state’s own names first', () => {
    const ma = insuranceChoices('MA').map((c) => c.label);
    expect(ma).toEqual([
      'Through a job (mine or my partner’s)', 'Health Connector / Healthcare.gov', 'MassHealth / Medicaid / CHIP', 'TRICARE (military)', 'No insurance right now / not sure',
    ]);
    expect(insuranceChoices('OH').map((c) => c.label)).toContain('Medicaid / CHIP');
    expect(insuranceChoices('OH').map((c) => c.label)).toContain('Healthcare.gov / your state marketplace');
  });
  it('maps an answer back to its label and a state to its Medicaid name', () => {
    expect(insuranceLabel('job')).toBe('Through a job (mine or my partner’s)');
    expect(insuranceLabel(null)).toBeNull();
    expect(medicaidName('MA')).toBe('MassHealth');
    expect(medicaidName(undefined)).toBe('Medicaid');
  });
});

describe('questionsToAsk (HR list)', () => {
  it('job insurance and both working: all four questions', () => {
    const q = questionsToAsk({ household: 'two', parent1Work: 'paycheck', parent2Work: 'paycheck', insurance: 'job' }, 2026);
    expect(q.title).toBe('Questions to ask HR');
    expect(q.items).toEqual([
      'Do we have 30 or 60 days to add our baby?',
      'Does our plan offer paid parental leave top-up (extra pay on top of state leave)?',
      'Do we offer a Dependent Care FSA, and what’s the cap?',
      'When does the FSA life-event window close?',
    ]);
  });
  it('a parent not working drops the FSA questions', () => {
    const q = questionsToAsk({ household: 'two', parent1Work: 'paycheck', parent2Work: 'not_working', insurance: 'job' }, 2026);
    expect(q.items).toHaveLength(2);
    expect(q.items.join(' ')).not.toMatch(/FSA/);
  });
  it('insurance from somewhere else drops the 30-or-60-days question', () => {
    const q = questionsToAsk({ household: 'one', parent1Work: 'paycheck', insurance: 'marketplace' }, 2026);
    expect(q.items.join(' ')).not.toMatch(/30 or 60 days/);
    expect(q.items.join(' ')).toMatch(/Dependent Care FSA/);
  });
  it('everyone self-employed gets questions for a tax preparer instead', () => {
    const q = questionsToAsk({ household: 'one', parent1Work: 'self_employed', insurance: 'job' }, 2026);
    expect(q.title).toBe('Questions for your tax preparer');
    expect(q.items).toHaveLength(3);
    expect(q.items[2]).toMatch(/2026 return/);
    expect(q.items.join(' ')).not.toMatch(/FSA|HR/);
  });
  it('prefer not to say keeps the general questions', () => {
    const q = questionsToAsk({ insurance: 'job' }, 2026);
    expect(q.title).toBe('Questions to ask HR');
    expect(q.items).toHaveLength(4);
  });
});

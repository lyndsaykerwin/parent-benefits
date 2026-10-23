import { dateLimits, dateRangeError, BIRTH_ERROR, DUE_ERROR } from '../../shared/dateRange';

const TODAY = '2026-10-23';

describe('dateRange (M11)', () => {
  it('limits: birth within 2 years back, due within 10 months ahead (a day of slack each side)', () => {
    expect(dateLimits(TODAY)).toEqual({ birthMin: '2024-10-23', birthMax: '2026-10-24', dueMin: '2026-10-22', dueMax: '2027-08-23' });
  });
  it('accepts sensible dates and rejects odd ones with a plain message', () => {
    expect(dateRangeError('birth', '2026-10-03', TODAY)).toBeNull();
    expect(dateRangeError('birth', '2010-01-01', TODAY)).toBe(BIRTH_ERROR);
    expect(dateRangeError('birth', '2026-12-01', TODAY)).toBe(BIRTH_ERROR);
    expect(dateRangeError('due', '2026-12-07', TODAY)).toBeNull();
    expect(dateRangeError('due', '2031-01-01', TODAY)).toBe(DUE_ERROR);
    expect(dateRangeError('due', '2026-01-01', TODAY)).toBe(DUE_ERROR);
  });
  it('handles month ends (Mar 31 -> Jan 31)', () => {
    expect(dateLimits('2026-03-31').dueMax).toBe('2027-01-31');
    expect(dateLimits('2026-12-31').dueMax).toBe('2027-10-31');
    expect(dateLimits('2028-02-29').birthMin).toBe('2026-02-28');
  });
});

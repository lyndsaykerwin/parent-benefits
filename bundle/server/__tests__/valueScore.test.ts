import { checkFinePrint } from '../agents/finePrintRules';
import { valueScore, worthSettings, WORTH_DEFAULTS, payoutWaitLabel } from '../agents/valueScore';

const TODAY = '2026-10-23';
const score = (text: string, env: Record<string, string | undefined> = {}) =>
  valueScore(checkFinePrint(text, { today: TODAY }), worthSettings(env));

describe('worth-your-time settings', () => {
  it('has the four labelled defaults', () => {
    expect(WORTH_DEFAULTS).toEqual({ minValueCents: 500, maxEffortMinutes: 30, effortValueCents: 2000, maxPayoutDays: 90 });
    expect(worthSettings({})).toEqual(WORTH_DEFAULTS);
  });
  it('reads overrides from settings and ignores junk', () => {
    expect(worthSettings({ WORTH_MIN_VALUE_CENTS: '1000', WORTH_MAX_PAYOUT_DAYS: 'abc' })).toEqual({ ...WORTH_DEFAULTS, minValueCents: 1000 });
  });
});

describe('Value Score: true value after strings + time to get it', () => {
  it('FP-01: true value $30.05, low effort, worth it', () => {
    const s = score('Free nursing pillow ($45 value). Just pay $14.95 shipping and handling.');
    expect(s.trueValueCents).toBe(3005);
    expect(s.worthYourTime).toBe(true);
  });

  it('FP-02 and FP-11: negative true value is never worth it', () => {
    expect(score('Free sample pack of wipes ($6 value). Shipping $8.99.').worthYourTime).toBe(false);
    expect(score('Free baby carrier ($80 value) with a 12-month membership at $9.99/month. $5.99 shipping.').worthYourTime).toBe(false);
  });

  it('FP-05: $50 is enough to justify the high effort; 70-day wait is under 90', () => {
    const s = score('$50 back on a stroller by mail-in rebate. Mail the form, original receipt and UPC cut from the box within 30 days of purchase. Allow 8–10 weeks for a prepaid card.');
    expect(s.effortLevel).toBe('high');
    expect(s.payoutWaitDays).toEqual({ min: 56, max: 70 });
    expect(s.worthYourTime).toBe(true);
    expect(s.timeLabel).toContain('8–10 weeks');
  });

  it('a stricter payout setting flips FP-05 to not worth it, with a plain reason', () => {
    const s = score('$50 back on a stroller by mail-in rebate. Mail the form, original receipt and UPC cut from the box within 30 days of purchase. Allow 8–10 weeks for a prepaid card.', { WORTH_MAX_PAYOUT_DAYS: '60' });
    expect(s.worthYourTime).toBe(false);
    expect(s.reasons.join(' ')).toMatch(/wait/i);
  });

  it('small value + high effort is not worth it', () => {
    const s = score('$10 back by mail-in rebate. Mail the form, original receipt and UPC within 30 days.');
    expect(s.trueValueCents).toBe(1000);
    expect(s.worthYourTime).toBe(false);
  });

  it('under the minimum value is not worth it', () => {
    expect(score('$3 off any pack of wipes.').worthYourTime).toBe(false);
  });

  it('no dollar figure in the fine print gives an unknown value, never a made-up one', () => {
    const s = score('15% off car seats. Ends 2026-10-26.');
    expect(s.trueValueCents).toBeNull();
    expect(s.worthYourTime).toBeNull();
  });

  it('a rejected offer is never worth your time', () => {
    expect(score('Free first box. Card required. Renews at $34.99/month unless cancelled online 48 hours before your renewal date.').worthYourTime).toBe(false);
  });
});

describe('payout wait wording', () => {
  it('uses the minimum and maximum honestly', () => {
    expect(payoutWaitLabel({ min: 56, max: 70 })).toBe('money in about 8–10 weeks');
    expect(payoutWaitLabel({ min: 14, max: 21 })).toBe('money in about 2–3 weeks');
    expect(payoutWaitLabel({ min: 5, max: 5 })).toBe('money in about 5 days');
    expect(payoutWaitLabel(null)).toBe('right away');
  });
});

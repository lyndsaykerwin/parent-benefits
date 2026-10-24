import fs from 'fs';
import path from 'path';
import { checkFinePrint, finalVerdict, fingerprint, availableInState, quoteIsExact } from '../agents/finePrintRules';

interface Case { id: string; text: string; expect: Record<string, unknown> }
const file = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/sample/fine-print-cases/cases.json'), 'utf8')) as { today: string; cases: Case[] };
const TODAY = file.today;

const FLAG_FIELDS = [
  'hiddenCostCents', 'trueValueCents', 'deadlineDate', 'expired', 'daysLeft', 'mailIn', 'needsReceipt', 'needsProofOfPurchase',
  'claimWindowDays', 'payoutWaitDaysMin', 'payoutWaitDaysMax', 'payoutForm', 'needsPhoneCall', 'needsForms', 'autoRenew',
  'renewalPriceCents', 'renewalPeriod', 'cancelMethod', 'cardRequired', 'minPurchaseCents', 'limitedStock', 'regionsExcluded',
  'inStoreOnly', 'accountRequired', 'appRequired', 'marketingOptInRequired', 'injectionDetected', 'onePerHousehold', 'verdict',
] as const;

describe('fine-print code rules: FP-01..FP-12 and 3 controls', () => {
  it('has all 15 made-up cases', () => {
    expect(file.cases.map((c) => c.id)).toHaveLength(15);
  });

  for (const c of file.cases) {
    it(`${c.id} matches the answer key`, () => {
      const r = checkFinePrint(c.text, { today: TODAY });
      const got = r as unknown as Record<string, unknown>;
      for (const f of FLAG_FIELDS) {
        if (f in c.expect) expect([f, got[f]]).toEqual([f, c.expect[f]]);
      }
      if (c.expect.steps !== undefined) expect(r.stepsCount).toBe(c.expect.steps);
      if (c.expect.minSteps !== undefined) expect(r.stepsCount).toBeGreaterThanOrEqual(c.expect.minSteps as number);
      if (c.expect.effortLevel !== undefined) expect(r.effortLevel).toBe(c.expect.effortLevel);
      if (c.expect.catchTypes) for (const t of c.expect.catchTypes as string[]) expect(r.catchTypes).toContain(t);
      if (c.expect.evidenceIncludes) expect(r.evidenceQuote).toContain(c.expect.evidenceIncludes);
      // The evidence quote is always exact words from the fine print.
      expect(quoteIsExact(r.evidenceQuote, c.text)).toBe(true);
    });
  }

  it('controls raise no false alarms (no catches at all)', () => {
    for (const c of file.cases.filter((x) => x.id.startsWith('CTRL'))) {
      expect([c.id, checkFinePrint(c.text, { today: TODAY }).catchTypes]).toEqual([c.id, []]);
    }
  });

  it('FP-08 minimum purchase is not read as a shipping fee', () => {
    const r = checkFinePrint('$20 off your first order of $100 or more.', { today: TODAY });
    expect(r.catchTypes).not.toContain('shipping_fee');
    expect(r.hiddenCostCents).toBe(0);
  });

  it('FP-06 effort minutes is a range, not one figure', () => {
    const fp6 = file.cases.find((c) => c.id === 'FP-06')!;
    const r = checkFinePrint(fp6.text, { today: TODAY });
    expect(r.effortMinutesEstimate.max).toBeGreaterThan(r.effortMinutesEstimate.min);
  });

  it('FP-07 auto-renew is rejected for every family with no learned rule (code check alone)', () => {
    const fp7 = file.cases.find((c) => c.id === 'FP-07')!;
    for (const state of ['MA', 'OH', 'NY', 'CA', 'AK']) {
      expect(checkFinePrint(fp7.text, { today: TODAY, familyState: state }).verdict).toBe('reject');
    }
  });

  it('FP-09 is hidden for an Alaska family, shown elsewhere', () => {
    const fp9 = file.cases.find((c) => c.id === 'FP-09')!;
    const r = checkFinePrint(fp9.text, { today: TODAY });
    expect(availableInState(r, 'AK')).toBe(false);
    expect(availableInState(r, 'MA')).toBe(true);
  });

  it('every dollar figure in the result appears in the fine print or is computed from figures that do', () => {
    for (const c of file.cases) {
      const r = checkFinePrint(c.text, { today: TODAY });
      for (const a of r.quotedAmountsCents) {
        const dollars = (a / 100).toFixed(2).replace(/\.00$/, '');
        expect([c.id, c.text.includes(`$${dollars}`)]).toEqual([c.id, true]);
      }
    }
  });

  it('flags an evidence quote that is not in the text', () => {
    expect(quoteIsExact('Free stroller', 'Free nursing pillow')).toBe(false);
    expect(quoteIsExact('', 'anything')).toBe(true);
  });
});

describe('finalVerdict: a code reject always overrides an AI approve', () => {
  it.each([
    ['reject', 'approve', 'reject'],
    ['reject', 'approve_with_catch', 'reject'],
    ['approve_with_catch', 'approve', 'approve_with_catch'],
    ['approve', 'approve', 'approve'],
    ['approve', 'reject', 'reject'],
    ['approve', 'approve_with_catch', 'approve_with_catch'],
  ] as const)('code %s + AI %s = %s', (code, ai, want) => {
    expect(finalVerdict(code, ai)).toBe(want);
  });
  it('no AI answer falls back to the code verdict', () => {
    expect(finalVerdict('approve_with_catch', null)).toBe('approve_with_catch');
  });
});

describe('fingerprint', () => {
  it('is stable for the same words and ignores spacing and case', () => {
    expect(fingerprint('Free box.  Shipping $5.99')).toBe(fingerprint('free box. shipping $5.99'));
  });
  it('changes when the wording changes', () => {
    expect(fingerprint('Free box. Shipping $5.99')).not.toBe(fingerprint('Free box. Shipping $6.99'));
  });
  it('is a 64-character hex string', () => {
    expect(fingerprint('x')).toMatch(/^[0-9a-f]{64}$/);
  });
});

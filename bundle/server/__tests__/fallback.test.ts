import { buildFallbackFillers } from '../agents/fallback';
import type { Family } from '../../shared/bundle';

const fam: Family = {
  id: 'guest-ab12cd34', userId: null, isGuest: true, name: 'Guest', birthDate: '2026-10-03', dueDate: null,
  zip: '02139', state: 'MA', employer: '', householdSize: 3, annualIncomeCents: null, dcfsaOffered: true, dataConnected: false,
};

describe('bundled stand-ins (I2)', () => {
  it('every stand-in is "info" and says the court has not checked it', () => {
    const { approvedGeneralOffers } = buildFallbackFillers(fam, '2026-10-23');
    expect(approvedGeneralOffers.length).toBeGreaterThanOrEqual(3);
    for (const o of approvedGeneralOffers) {
      expect(o.verdict).toBe('info');
      expect(o.body).toMatch(/Not yet verified/);
      expect(o.body).toMatch(/Fine Print Court has not checked it/);
    }
  });

  it('drops stand-ins whose fine print needs Prime/a membership or has a shipping fee', () => {
    const titles = buildFallbackFillers(fam, '2026-10-23').approvedGeneralOffers.map((o) => o.title);
    expect(titles).not.toContain('Free baby registry welcome box');
    expect(titles).not.toContain('Babylist registry welcome box');
    expect(titles).toContain('15% registry completion discount');
  });

  it('stand-in offers carry no deadline (max age is an eligibility limit, not an end date)', () => {
    for (const o of buildFallbackFillers(fam, '2026-10-23').approvedGeneralOffers) {
      expect(o.deadline).toBeNull();
      expect(o.body).toMatch(/Fits babies up to \d+ months old\./);
    }
  });
});

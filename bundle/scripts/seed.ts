// Seed script: fills Bundle's own tables with fake sample families and curated
// public rules/offers. Safe to run repeatedly. It only ever touches Bundle's
// tables (never other tables in the shared Neon database).
import fs from 'fs';
import { zipRows } from '../server/sampleZips';
import path from 'path';
import { inArray } from 'drizzle-orm';
import { loadEnv } from '../server/env';
import * as s from '../shared/schema';
import type { Family } from '../shared/bundle';
import { loadPurchaseItems } from '../server/ingest/purchaseItems';

const SAMPLE_DIR = path.resolve(process.cwd(), 'data/sample'); // run from the repo root (npm scripts and jest do)
const SEED_FAMILY_IDS = ['maya', 'leo', 'ava', 'noor', 'cal', 'fern'];

const readJson = (f: string) => JSON.parse(fs.readFileSync(path.join(SAMPLE_DIR, f), 'utf8'));

/** One row of data/sample/tax-parameters.json. `verified: false` means the figure was not confirmed on a current official page. */
export interface TaxParameterJson { year: number; code: string; title: string; amountCents: number | null; note: string; sourceUrl: string; verified: boolean }
/** One row of data/sample/state-programs.json. */
export interface StateProgramJson {
  state: string; year: number; code: string; title: string; amountCents: number | null;
  windowStartDaysFromBirth: number | null; windowEndDaysFromBirth: number | null; condition: string; sourceUrl: string;
  verified: boolean; checkedOn?: string; unverifiedNote?: string;
}

export const TAX_PARAMETERS_JSON: TaxParameterJson[] = readJson('tax-parameters.json');
export const STATE_PROGRAMS_JSON: StateProgramJson[] = readJson('state-programs.json');

const UNVERIFIED = 'UNVERIFIED: ';
export const TAX_PARAMETER_ROWS: (typeof s.taxParameters.$inferInsert)[] = TAX_PARAMETERS_JSON.map((r) => ({
  year: r.year, code: r.code, title: r.title, amountCents: r.amountCents, sourceUrl: r.sourceUrl,
  note: r.verified ? r.note : `${UNVERIFIED}${r.note}`,
}));
export const STATE_PROGRAM_ROWS: (typeof s.statePrograms.$inferInsert)[] = STATE_PROGRAMS_JSON.map((r) => ({
  state: r.state, year: r.year, code: r.code, title: r.title, amountCents: r.amountCents,
  windowStartDaysFromBirth: r.windowStartDaysFromBirth, windowEndDaysFromBirth: r.windowEndDaysFromBirth, sourceUrl: r.sourceUrl,
  condition: r.verified ? r.condition : `${UNVERIFIED}${r.unverifiedNote ?? 'not confirmed on an official page'}. ${r.condition}`,
}));

const taxAmount = (code: string): number | null => {
  const row = TAX_PARAMETERS_JSON.find((r) => r.code === code);
  if (!row) throw new Error(`tax-parameters.json has no ${code}`);
  return row.amountCents;
};

const FEDERAL_RULES: (typeof s.benefitRules.$inferInsert)[] = [
  { code: 'TRUMP_ACCOUNT', title: 'Trump Account: $1,000 federal starter deposit', scope: 'federal', amountCents: 100000,
    windowStartDaysFromBirth: null, windowEndDaysFromBirth: null, condition: 'born 2025-01-01..2028-12-31',
    sourceUrl: 'https://trumpaccounts.gov' },
  { code: 'FEDERAL_CHILD_TAX_CREDIT', title: 'Federal Child Tax Credit', scope: 'federal', amountCents: taxAmount('CHILD_TAX_CREDIT'),
    windowStartDaysFromBirth: null, windowEndDaysFromBirth: null, condition: 'claimed on the yearly tax return',
    sourceUrl: 'https://www.irs.gov/credits-deductions/individuals/child-tax-credit' },
  { code: 'INSURANCE_ADD_BABY', title: 'Add your baby to health insurance', scope: 'federal', amountCents: null,
    windowStartDaysFromBirth: 0, windowEndDaysFromBirth: 30, condition: 'birth is a qualifying life event',
    sourceUrl: 'https://www.healthcare.gov/coverage-outside-open-enrollment/special-enrollment-period/' },
  { code: 'DCFSA_LIFE_EVENT', title: 'Dependent Care FSA: check with your job', scope: 'federal', amountCents: null,
    windowStartDaysFromBirth: null, windowEndDaysFromBirth: null, condition: 'ask your employer whether it offers a Dependent Care FSA (a work account for childcare costs); nothing is checked for you',
    sourceUrl: 'https://www.irs.gov/publications/p503' },
];

/** Every state program becomes a benefit rule whose scope is its 2-letter state, so the planner and the Fact-Checker read one table. */
export const BENEFIT_RULES: (typeof s.benefitRules.$inferInsert)[] = [
  ...FEDERAL_RULES,
  ...STATE_PROGRAM_ROWS.map((r) => ({
    code: r.code, title: r.title, scope: r.state, amountCents: r.amountCents ?? null,
    windowStartDaysFromBirth: r.windowStartDaysFromBirth ?? null, windowEndDaysFromBirth: r.windowEndDaysFromBirth ?? null,
    condition: r.condition ?? '', sourceUrl: r.sourceUrl,
  })),
];

const OFFER_SRC = {
  amazon: 'https://www.amazon.com/baby-reg/homepage',
  target: 'https://www.target.com/c/baby-registry/-/N-5xtbg',
  walmart: 'https://www.walmart.com/cp/baby-registry/1094765',
  buybuy: 'https://www.buybuybaby.com/registry',
  pampers: 'https://www.pampers.com/en-us/club',
  huggies: 'https://www.huggies.com/en-us/rewards',
  enfamil: 'https://www.enfamil.com/enfamil-family-beginnings/',
  similac: 'https://www.similac.com/strongmoms.html',
  honest: 'https://www.honest.com/baby-registry',
  babylist: 'https://www.babylist.com/registry-benefits',
  costco: 'https://www.costco.com/baby-registry.html',
  chewy: 'https://www.chewy.com/',
};
const GENERAL = { triggerKeyword: '', minAgeDays: -280, maxAgeDays: 365 };

export const OFFERS: (typeof s.offers.$inferInsert)[] = [
  // General offers: no purchase needed, open to unborn and newborn families.
  { ...GENERAL, title: 'Free baby registry welcome box', store: 'Amazon', valueCents: 3500, finePrint: 'Requires Prime and a registry with at least one item; limited to one per household.', sourceUrl: OFFER_SRC.amazon },
  { ...GENERAL, title: '15% registry completion discount', store: 'Target', valueCents: null, finePrint: 'One-time coupon valid for 60 days after registry creation; excludes some brands.', sourceUrl: OFFER_SRC.target },
  { ...GENERAL, title: 'Free welcome gift bag', store: 'Walmart', valueCents: 2500, finePrint: 'Registry must be created online; in-store pickup only while supplies last.', sourceUrl: OFFER_SRC.walmart },
  { ...GENERAL, title: 'Pampers Club rewards sign-up bonus', store: 'Pampers', valueCents: 500, finePrint: 'Points added after scanning your first diaper pack code.', sourceUrl: OFFER_SRC.pampers },
  { ...GENERAL, title: 'Babylist registry welcome box', store: 'Babylist', valueCents: 2000, finePrint: 'Box ships after you add 10 items; shipping fee may apply.', sourceUrl: OFFER_SRC.babylist },
  // PLANTED TEST CASE (trap offer). This looks free but auto-enrolls into a paid
  // membership. Fine Print Court is expected to REJECT it. Cuddle & Co is a made-up store.
  { ...GENERAL, triggerKeyword: 'diaper', title: 'Free newborn diaper box', store: 'Cuddle & Co', valueCents: 4000,
    finePrint: 'Free box requires a card on file. After a 30-day trial you are automatically enrolled in a paid membership at $29.99/month until you cancel.',
    sourceUrl: 'https://example.com/cuddle-and-co/free-diaper-box' },
  // Triggered offers: shown when a matching purchase or situation appears.
  { title: 'Bonus diaper rewards on newborn sizes', store: 'Pampers', minAgeDays: 0, maxAgeDays: 120, triggerKeyword: 'diaper', valueCents: 1000, finePrint: 'Newborn and size 1 packs only.', sourceUrl: OFFER_SRC.pampers },
  { title: 'Huggies Rewards points on diapers and wipes', store: 'Huggies', minAgeDays: 0, maxAgeDays: 365, triggerKeyword: 'huggies', valueCents: 800, finePrint: 'Points expire after 12 months.', sourceUrl: OFFER_SRC.huggies },
  { title: 'Free formula sample and coupons', store: 'Enfamil', minAgeDays: -60, maxAgeDays: 180, triggerKeyword: 'formula', valueCents: 3000, finePrint: 'Coupons are for Enfamil brand products only.', sourceUrl: OFFER_SRC.enfamil },
  { title: 'StrongMoms formula savings', store: 'Similac', minAgeDays: -60, maxAgeDays: 180, triggerKeyword: 'similac', valueCents: 2500, finePrint: 'Coupon books mailed within 4 to 6 weeks.', sourceUrl: OFFER_SRC.similac },
  { title: 'Car seat trade-in event discount', store: 'Target', minAgeDays: -90, maxAgeDays: 365, triggerKeyword: 'car seat', valueCents: 3000, finePrint: 'Bring in an old car seat; event dates are limited.', sourceUrl: 'https://www.target.com/c/car-seat-trade-in/-/N-4tfr8' },
  { title: 'Registry completion discount on big-ticket gear', store: 'Buy Buy Baby', minAgeDays: -280, maxAgeDays: 120, triggerKeyword: 'stroller', valueCents: 2000, finePrint: 'Applies to registry items only.', sourceUrl: OFFER_SRC.buybuy },
  { title: 'Honest Company baby bundle discount', store: 'Honest', minAgeDays: 0, maxAgeDays: 240, triggerKeyword: 'wipes', valueCents: 1500, finePrint: 'First bundle only; subscription is optional and can be skipped.', sourceUrl: OFFER_SRC.honest },
  { title: 'Costco baby member coupon book items', store: 'Costco', minAgeDays: 0, maxAgeDays: 365, triggerKeyword: 'costco', valueCents: 1200, finePrint: 'Costco membership required.', sourceUrl: OFFER_SRC.costco },
  { title: 'Autoship first-order discount on baby food', store: 'Chewy', minAgeDays: 150, maxAgeDays: 365, triggerKeyword: 'baby food', valueCents: 1000, finePrint: 'Autoship must remain active for 2 deliveries.', sourceUrl: OFFER_SRC.chewy },
  { title: 'Amazon Subscribe & Save diaper discount', store: 'Amazon', minAgeDays: 0, maxAgeDays: 365, triggerKeyword: 'diaper', valueCents: 900, finePrint: 'Savings apply while the subscription is active; price can change.', sourceUrl: 'https://www.amazon.com/b?node=17938598011' },
];

export const FSA_CATEGORIES: (typeof s.fsaEligibleCategories.$inferInsert)[] = [
  { keyword: 'thermometer', category: 'Baby thermometer', account: 'FSA', sourceUrl: 'https://fsastore.com/baby-thermometers.html' },
  { keyword: 'infant tylenol', category: 'Infant pain reliever', account: 'FSA', sourceUrl: 'https://fsastore.com/pain-relief.html' },
  { keyword: 'saline', category: 'Nasal saline drops', account: 'FSA', sourceUrl: 'https://fsastore.com/cold-flu-allergy.html' },
  { keyword: 'nasal aspirator', category: 'Nasal aspirator', account: 'FSA', sourceUrl: 'https://fsastore.com/cold-flu-allergy.html' },
  { keyword: 'diaper rash', category: 'Diaper rash ointment', account: 'FSA', sourceUrl: 'https://fsastore.com/skin-care.html' },
  { keyword: 'sunscreen', category: 'Sunscreen SPF 15+', account: 'FSA', sourceUrl: 'https://www.irs.gov/publications/p502' },
  { keyword: 'breast pump', category: 'Breast pump and supplies', account: 'FSA', sourceUrl: 'https://www.irs.gov/publications/p502' },
  { keyword: 'nursing pads', category: 'Nursing supplies', account: 'FSA', sourceUrl: 'https://fsastore.com/breast-pumps-nursing.html' },
  { keyword: 'gas drops', category: 'Infant gas relief', account: 'FSA', sourceUrl: 'https://fsastore.com/digestive-health.html' },
  { keyword: 'prenatal vitamin', category: 'Prenatal vitamins (HSA/FSA with note)', account: 'HSA', sourceUrl: 'https://www.irs.gov/publications/p502' },
  { keyword: 'bright horizons', category: 'Daycare tuition (Dependent Care FSA)', account: 'DCFSA', sourceUrl: 'https://www.irs.gov/publications/p503' },
  { keyword: 'daycare', category: 'Daycare tuition (Dependent Care FSA)', account: 'DCFSA', sourceUrl: 'https://www.irs.gov/publications/p503' },
];

export const STORE_POLICIES: (typeof s.storePolicies.$inferInsert)[] = [
  { store: 'Target', adjustmentWindowDays: 14, sourceUrl: 'https://help.target.com/help/subcategoryarticle?childcat=Price+Match+Guarantee&parentcat=Shopping+at+Target' },
  { store: 'Best Buy', adjustmentWindowDays: 15, sourceUrl: 'https://www.bestbuy.com/site/help-topics/price-match-guarantee/pcmcat290300050002.c' },
  { store: 'Costco', adjustmentWindowDays: 30, sourceUrl: 'https://customerservice.costco.com/app/answers/answer_view/a_id/1139' },
];

// Sample price checks that power the price-adjustment clawback (dated 2026-10-20).
export const PRICE_OBSERVATIONS: (typeof s.priceObservations.$inferInsert)[] = [
  { store: 'Target', keyword: "Graco Pack 'n Play", priceCents: 6999, observedAt: '2026-10-20', sourceUrl: 'https://www.target.com/c/playards/-/N-5xtbz' },
  { store: 'Target', keyword: 'Graco 4Ever car seat', priceCents: 24999, observedAt: '2026-10-20', sourceUrl: 'https://www.target.com/c/car-seats/-/N-5xtbi' },
];

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  const split = (line: string) => {
    const out: string[] = []; let cur = ''; let q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const header = split(lines[0]);
  return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [header[i], v])));
}

export async function seed(): Promise<void> {
  const { db } = await import('../server/db');
  const families: Family[] = readJson('families.json');
  const orders = parseCsv(fs.readFileSync(path.join(SAMPLE_DIR, 'amazon-orders.csv'), 'utf8'));

  await db.transaction(async (tx) => {
    // Clear only what seed() refills.
    await tx.delete(s.transactions).where(inArray(s.transactions.familyId, SEED_FAMILY_IDS)); // legacy table: emptied, no longer refilled
    await tx.delete(s.purchaseItems).where(inArray(s.purchaseItems.familyId, SEED_FAMILY_IDS));
    await tx.delete(s.amazonOrders).where(inArray(s.amazonOrders.familyId, SEED_FAMILY_IDS));
    await tx.delete(s.families).where(inArray(s.families.id, SEED_FAMILY_IDS));
    await tx.delete(s.benefitRules);
    await tx.delete(s.offers);
    await tx.delete(s.fsaEligibleCategories);
    await tx.delete(s.storePolicies);
    await tx.delete(s.priceObservations);
    await tx.delete(s.zipStates);
    await tx.delete(s.taxParameters);
    await tx.delete(s.statePrograms);

    await tx.insert(s.families).values(families);
    await tx.insert(s.purchaseItems).values(loadPurchaseItems(SAMPLE_DIR));
    await tx.insert(s.amazonOrders).values(
      orders.map((o) => ({
        id: o.order_id, familyId: o.family_id, orderDate: o.order_date, title: o.title,
        asin: o.asin || null, upc: o.upc || null, priceCents: Math.round(parseFloat(o.price) * 100),
      })),
    );
    await tx.insert(s.benefitRules).values(BENEFIT_RULES);
    await tx.insert(s.offers).values(OFFERS);
    await tx.insert(s.fsaEligibleCategories).values(FSA_CATEGORIES);
    await tx.insert(s.storePolicies).values(STORE_POLICIES);
    await tx.insert(s.priceObservations).values(PRICE_OBSERVATIONS);
    await tx.insert(s.zipStates).values(zipRows());
    await tx.insert(s.taxParameters).values(TAX_PARAMETER_ROWS);
    await tx.insert(s.statePrograms).values(STATE_PROGRAM_ROWS);
  });
}

// Run directly: npx tsx scripts/seed.ts
if (/scripts[\\/]seed\.ts$/.test(process.argv[1] ?? '')) {
  loadEnv();
  seed()
    .then(async () => {
      const { pool } = await import('../server/db');
      await pool.end();
      console.log('Seeded Bundle tables.');
    })
    .catch((e) => { console.error(e); process.exit(1); });
}

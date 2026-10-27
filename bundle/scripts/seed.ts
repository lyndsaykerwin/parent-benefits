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

/**
 * Offer pages, each checked Oct 26, 2026 with a real page load (curl -L final URL + page title; `npm run links:check`).
 * Every fine-print line below is copied (shortened only by dropping whole sentences) from the page next to it, read the
 * same day. Where a store states no dollar value for a box, valueCents is our estimate of the box contents (flagged "est.").
 */
const OFFER_SRC = {
  // "Baby Registry Welcome Box - Amazon Customer Service"
  amazonWelcomeBox: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=GBLXVKVYG5SBG8HF',
  // "Baby Registry Completion Discount" help page
  amazonCompletion: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=GV4FFW94JAGFL4RH',
  // "Amazon.com: Subscribe & Save | Save on Everyday Essentials"
  amazonSubscribeSave: 'https://www.amazon.com/b?node=5856181011',
  // Target Help: "When will I receive my 15% completion coupon?"
  targetCompletion: 'https://www.target.com/help/article/000062273',
  // Target Help: "Baby Registry Welcome Kits"
  targetWelcomeKit: 'https://www.target.com/help/article/000062588',
  // "Free Baby Boxes & Baby Registry | Walmart" (FAQ: welcome box and free house cleaning)
  walmart: 'https://www.walmart.com/cp/baby-registry/1229485',
  // "Pampers Rewards: Earn Pampers Cash on Diapers"
  pampers: 'https://www.pampers.com/en-us/rewards',
  // "Everything You Need to Know about the Babylist Hello Baby Box"
  babylistBox: 'https://www.babylist.com/hello-baby/babylist-hello-baby-box',
  // "Babylist Shop Discount" (15% registry discount)
  babylistDiscount: 'https://www.babylist.com/registry-discount',
  // Enfamil Family Beginnings benefits page ("Get All the Benefits Out of Your Wonder Box")
  enfamil: 'https://www.enfamil.com/wonderbox-gift',
  // "MySimilac Rewards 2026 | Formula Coupons & Baby Freebies"
  similac: 'https://www.similac.com/rewards.html',
};
const GENERAL = { triggerKeyword: '', minAgeDays: -280, maxAgeDays: 365 };

export const OFFERS: (typeof s.offers.$inferInsert)[] = [
  // General offers: no purchase needed, open to unborn and newborn families.
  { ...GENERAL, title: 'Free baby registry welcome box', store: 'Amazon', valueCents: 3500, /* est.: Amazon states no value */
    finePrint: 'The Welcome Box is available to customers with active Amazon Prime accounts, who create a Baby Registry, add 10 unique items from their Baby Registry Checklist and have over $10 of purchases from their registry (by themselves or others). The welcome box is only eligible to ship within the contiguous United States. This offer is a limited-time offer, while supplies last.',
    sourceUrl: OFFER_SRC.amazonWelcomeBox },
  { ...GENERAL, title: '15% registry completion coupon', store: 'Target', valueCents: null,
    finePrint: "As you get close to your baby or wedding registry event date, you'll receive a 15% off storewide Target Circle offer that is redeemable twice. Some restrictions apply. Wedding and baby registries must be active for at least 14 days before your offer is generated.",
    sourceUrl: OFFER_SRC.targetCompletion },
  // Walmart: the $25 welcome box and the $300 home-cleaning tier are two separate rewards (row 1323 below is the cleaning).
  { ...GENERAL, title: 'Free Baby Registry Welcome Box', store: 'Walmart', valueCents: 2500, /* est.: Walmart states no value */
    finePrint: 'Earn your Baby Registry Welcome Box: Create your baby registry (registries created 2/1/2025 & onward are eligible). Registry must be open for 7 days. A minimum of 20 unique items added to your registry. Over $25 purchased from and through your registry at Walmart. Baby Registry Welcome Box offer is valid in the U.S., excluding PO Boxes.',
    sourceUrl: OFFER_SRC.walmart },
  { ...GENERAL, title: 'Pampers Rewards: $10 Pampers Cash for every 10 diaper scans', store: 'Pampers', valueCents: 1000,
    finePrint: 'For every 10 diaper scans you will receive $10 Pampers Cash which you can redeem in our Pampers Rewards catalog. Download the Pampers Rewards mobile app from the Play Store or the App Store, enter your details to join.',
    sourceUrl: OFFER_SRC.pampers },
  // Age window from the Babylist page: "your arrival date must be between four weeks ago and up to nine months away".
  { ...GENERAL, minAgeDays: -270, maxAgeDays: 28, title: 'Babylist Hello Baby Box', store: 'Babylist', valueCents: 2000, /* est.: Babylist states no value */
    finePrint: 'Add three items to your registry from other stores. Complete 40% of your Babylist registry checklist. Make a minimum purchase totaling $30 from the Babylist Shop. Verify your address and pay $8.95 + tax, where applicable, for shipping. There is a one Hello Baby Box limit per household per year.',
    sourceUrl: OFFER_SRC.babylistBox },
  // PLANTED TEST CASE (trap offer). This looks free but auto-enrolls into a paid
  // membership. Fine Print Court is expected to REJECT it. Cuddle & Co is a made-up store; its example.com
  // link is never shown as a live link (blocked cards from example.com carry no link).
  { ...GENERAL, triggerKeyword: 'diaper', title: 'Free newborn diaper box', store: 'Cuddle & Co', valueCents: 4000,
    finePrint: 'Free box requires a card on file. After a 30-day trial you are automatically enrolled in a paid membership at $29.99/month until you cancel.',
    sourceUrl: 'https://example.com/cuddle-and-co/free-diaper-box' },
  // Triggered offers: shown when a matching purchase or situation appears.
  { title: 'Pampers Rewards: up to $10 for inviting friends', store: 'Pampers', minAgeDays: 0, maxAgeDays: 120, triggerKeyword: 'diaper', valueCents: 1000,
    finePrint: "Invite up to 5 loved ones to join Pampers Club. There's $2 in it for them and up to $10 for yourself!", sourceUrl: OFFER_SRC.pampers },
  // (was Huggies Rewards: huggies.com blocks automated page loads, so the page could not be verified; replaced Oct 26)
  // Value from the fine print itself: "Baby Registry Welcome Kit is valued at $100".
  { ...GENERAL, title: 'Free Baby Registry Welcome Kit', store: 'Target', valueCents: 10000,
    finePrint: 'To receive your free Baby Registry Welcome Kit: 1. Join Target Circle. 2. Create a baby registry. 3. Add 10 unique items to your Baby Registry. 4. Purchase over $10 from your registry (either by you or others). Limit one kit per year. Baby Registry Welcome Kit is valued at $100 that is a mix of samples and Target Circle Bonus. Shipping and handling fees apply. Baby Registry Welcome Kits are only available online as a Target Circle Bonus.',
    sourceUrl: OFFER_SRC.targetWelcomeKit },
  { title: 'Enfamil Family Beginnings rewards and formula coupons', store: 'Enfamil', minAgeDays: -60, maxAgeDays: 180, triggerKeyword: 'formula', valueCents: 3000, /* est. */
    finePrint: 'Shop and Earn Rewards: Earn 10 points/dollar on Enfamil purchases. Discount Checks & Digital Rebates: Enjoy discounts on Enfamil products. Checks are similar to formula coupons and can be used at most major retailers.',
    sourceUrl: OFFER_SRC.enfamil },
  { title: 'MySimilac Rewards formula coupons', store: 'Similac', minAgeDays: -60, maxAgeDays: 180, triggerKeyword: 'similac', valueCents: 2500, /* est. */
    finePrint: "Join MySimilac Rewards. It's fast and FREE! Baby formula coupons and samples. Redeem a Coupon = 5 Points. Scan Your Product QR Code = 1 Point. 5 scan limit per calendar month.",
    sourceUrl: OFFER_SRC.similac },
  // (was a Target car-seat trade-in: a seasonal event whose page is gone; replaced Oct 26 with Walmart's $300 tier)
  { ...GENERAL, title: 'Free home cleaning with a Walmart baby registry', store: 'Walmart', valueCents: 9900,
    finePrint: 'Free cleaning for one bedroom, one bathroom, kitchen, and common areas in a single home (worth $99) from our trusted third-party partner. Maintain your registry for at least 7 days. Add 20 or more unique items to your registry. Spend $300 on items from your registry (this can be you or someone you have invited). Available while supplies last. US, 18+ only. Limited 1 per person.',
    sourceUrl: OFFER_SRC.walmart },
  // (was buybuy BABY: the site's registry page is gone; replaced Oct 26)
  // Window from the Amazon page: "begins 60 days prior to the Arrival Date… and expires 90 days after the Arrival Date".
  { title: 'Registry completion discount on big-ticket gear', store: 'Amazon', minAgeDays: -60, maxAgeDays: 90, triggerKeyword: 'stroller', valueCents: null,
    finePrint: 'The discount offer is 15% for Baby Registry owners at the time that they redeem their discount. Your registry must be active for at least 14 days. The Completion Discount begins 60 days prior to the Arrival Date you entered in your Baby Registry and expires 90 days after the Arrival Date. You can apply the 15% discount on orders up to a combined value of $2,000, for a maximum discount of $300.00.',
    sourceUrl: OFFER_SRC.amazonCompletion },
  // (was Honest Company: the old registry page is gone and no current offer page could be verified; replaced Oct 26)
  { title: 'Babylist Shop 15% registry discount', store: 'Babylist', minAgeDays: -280, maxAgeDays: 120, triggerKeyword: 'crib', valueCents: null,
    finePrint: "We'll automatically apply your registry discount starting 60 days before your baby's expected arrival — no code needed (up to $600 off a $4000 order). Your registry needs to be active for at least 30 days to be eligible. Some products don't qualify for the discount.",
    sourceUrl: OFFER_SRC.babylistDiscount },
  // (was a Costco coupon book: no such page; replaced Oct 26)
  { title: 'Enfamil Rewards: 1,000 points when friends buy', store: 'Enfamil', minAgeDays: 0, maxAgeDays: 365, triggerKeyword: 'formula', valueCents: null,
    finePrint: "Share the Love: We'll give you 1000 points when your friends make a purchase.", sourceUrl: OFFER_SRC.enfamil },
  // (was Chewy Autoship: chewy.com blocks automated page loads, so the page could not be verified; replaced Oct 26)
  { title: 'Subscribe & Save on baby food', store: 'Amazon', minAgeDays: 150, maxAgeDays: 365, triggerKeyword: 'baby food', valueCents: null,
    finePrint: "Save time and money with up to 15% off your essentials. Save up to 15% off when receiving 5 or more products in one auto-delivery to one address. Shipping is always free. Skip or cancel any time.",
    sourceUrl: OFFER_SRC.amazonSubscribeSave },
  { title: 'Amazon Subscribe & Save diaper discount', store: 'Amazon', minAgeDays: 0, maxAgeDays: 365, triggerKeyword: 'diaper', valueCents: 900,
    finePrint: 'Save up to 15% off when receiving 5 or more products in one auto-delivery to one address. Shipping is always free. Skip or cancel any time.',
    sourceUrl: OFFER_SRC.amazonSubscribeSave },
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

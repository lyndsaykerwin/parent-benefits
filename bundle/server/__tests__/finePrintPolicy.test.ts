// Oct 26 feedback round, Lane B: the blocking rule Lyndsay approved, and regression tests for the false catches she saw.
// Rule: BLOCK only when the catch costs more than the offer is worth, or the offer turns into a paid subscription
// (auto-renew with a card or a stated price). Everything else with a catch is "approve_with_catch". Unknown fees never block.
// Every quote below is copied from the live page (read Oct 26, 2026); the source URL is next to each.
import { checkFinePrint, finalVerdict, combineVerdict } from '../agents/finePrintRules';

const T = '2026-10-26';

// https://www.babylist.com/hello-baby/babylist-hello-baby-box
const BABYLIST = "You'll also need to complete these steps: Add three items to your registry from other stores. Complete 40% of your Babylist registry checklist Make a minimum purchase totaling $30 from the Babylist Shop. Verify your address and pay $8.95 + tax, where applicable, for shipping. There is a one Hello Baby Box limit per household per year.";
// https://www.amazon.com/gp/help/customer/display.html?nodeId=GBLXVKVYG5SBG8HF
const AMAZON = 'The Welcome Box is available to customers with active Amazon Prime accounts, who create a Baby Registry, add 10 unique items from their Baby Registry Checklist and have over $10 of purchases from their registry (by themselves or others). Note: The $10 threshold doesn\'t include tax or shipping costs. This offer is a limited-time offer, while supplies last.';
// The older Amazon registry page (live-search row 13) carried this standard line.
const AMAZON_GENERIC_SHIPPING = 'Shipping charges may apply to discounted and free promotional items.';
// https://www.target.com/help/article/000062588
const TARGET_KIT = 'To receive your free Baby Registry Welcome Kit: 1. Join Target Circle. 2. Create a baby registry. 3. Add 10 unique items to your Baby Registry. 4. Purchase over $10 from your registry (either by you or others). Limit one kit per year. Baby Registry Welcome Kit is valued at $100 that is a mix of samples and Target Circle Bonus. Shipping and handling fees apply.';
// https://www.enfamil.com/baby-formula-coupons-samples
const ENFAMIL = 'Enfamil Rewards Read articles, participate in polls and more—the more you do, the more you earn. Enfamil Rewards on mobile phoneEnfamil Rewards on mobile phone 5. Enfamil Mobile AppEnfamil Mobile App 6. Access to Our Mobile App Our app offers tools and resources for every stage.';
// https://www.similac.com/formula-coupons-free-samples.html (long page: the main offer is the coupons; the dagger footnote is the photo book)
const SIMILAC = 'Join today and start getting coupons, nutrition support and tips, plus a FREE† Shutterfly photo book. Join Today Download the app Download the app The most convenient way to access your Similac coupons and track your Rewards points. '
  + 'Will I still receive MySimilac Rewards coupons if I don’t download the app? Yes, if you are a MySimilac Rewards member, you are eligible for coupons even if you don\'t download the app. '
  + 'If you have additional questions about the MySimilac Rewards program, visit our Similac.com FAQs for more info. Or give us a call at 1-800-515-7677, Monday through Friday, 8:30 AM to 5 PM ET. '
  + 'Offers may vary and are provided by Abbott and its third-party partners. Additional terms, conditions, and restrictions may apply. Offers may be subject to additional shipping and handling fees. '
  + '† Offer expires February 28, 2026 (11:59 P.M. ET). Valid on a 20-standard page 8x8 hardcover photo book.';

describe('blocking rule: block only when it costs more than it is worth, or turns into a paid subscription', () => {
  it('Babylist: a known $8.95 shipping fee and a $30 shop purchase is a catch, not a block', () => {
    const r = checkFinePrint(BABYLIST, { today: T, listedValueCents: 2000 });
    expect(r.verdict).toBe('approve_with_catch');
    expect(r.hiddenCostCents).toBe(895);
    expect(r.minPurchaseCents).toBe(3000);
    expect(r.catchTypes).toEqual(expect.arrayContaining(['shipping_fee', 'minimum_purchase']));
    expect(r.evidenceQuote).toContain('$8.95');
  });

  it('Amazon: needs Prime and over $10 of registry purchases, while supplies last: a catch, not a block', () => {
    const r = checkFinePrint(AMAZON, { today: T, listedValueCents: 3500 });
    expect(r.verdict).toBe('approve_with_catch');
    expect(r.catchTypes).toEqual(expect.arrayContaining(['required_membership', 'minimum_purchase', 'limited_stock']));
    expect(r.reasons.join(' ')).toMatch(/Prime/);
    expect(r.minPurchaseCents).toBe(1000);
  });

  it('standard "shipping charges may apply" wording is a catch, never a block', () => {
    const r = checkFinePrint(AMAZON_GENERIC_SHIPPING, { today: T });
    expect(r.catchTypes).toContain('fee_unknown');
    expect(r.verdict).toBe('approve_with_catch');
  });

  it('Walmart welcome box: "Over $25 purchased from and through your registry" is a $25 minimum, a catch (no in-store-only line)', () => {
    const w = 'Registry must be open for 7 days. A minimum of 20 unique items added to your registry. Over $25 purchased from and through your registry at Walmart. Baby Registry Welcome Box offer is valid in the U.S., excluding PO Boxes.';
    const r = checkFinePrint(w, { today: T, listedValueCents: 2500 });
    expect(r.minPurchaseCents).toBe(2500);
    expect(r.verdict).toBe('approve_with_catch');
    expect(r.inStoreOnly).toBe(false);
  });

  it('Target welcome kit: "Shipping and handling fees apply" is an unknown fee (catch); value read from "valued at $100"', () => {
    const r = checkFinePrint(TARGET_KIT, { today: T });
    expect(r.verdict).toBe('approve_with_catch');
    expect(r.catchTypes).toEqual(expect.arrayContaining(['fee_unknown', 'minimum_purchase']));
    expect(r.faceValueCents).toBe(10000);
    expect(r.minPurchaseCents).toBe(1000);
  });

  it('a stated fee bigger than the listed value blocks; the same fee on a bigger offer is a catch', () => {
    expect(checkFinePrint('Free wipes. $7.99 shipping.', { today: T, listedValueCents: 500 }).verdict).toBe('reject');
    expect(checkFinePrint('Free wipes. $7.99 shipping.', { today: T, listedValueCents: 2000 }).verdict).toBe('approve_with_catch');
    // Value unknown: we cannot show it costs more than it is worth, so it is a catch.
    expect(checkFinePrint('Free wipes. $7.99 shipping.', { today: T }).verdict).toBe('approve_with_catch');
  });

  it('a trial that renews into a paid plan with a card or a price blocks; a no-card, no-price renewal is a catch', () => {
    expect(checkFinePrint('Free first box. Card required. Renews at $34.99/month unless cancelled online.', { today: T }).verdict).toBe('reject');
    expect(checkFinePrint('Free box. After your trial, renews at $19.99/month.', { today: T }).verdict).toBe('reject');
    const soft = checkFinePrint('Free 30-day trial of the app. Renews automatically unless you turn it off; no card needed.', { today: T });
    expect(soft.autoRenew).toBe(true);
    expect(soft.verdict).toBe('approve_with_catch');
  });

  it('the "card on file, automatically enrolled in a paid membership" trap is blocked by the code rules alone', () => {
    const r = checkFinePrint('Free box requires a card on file. After a 30-day trial you are automatically enrolled in a paid membership at $29.99/month until you cancel.', { today: T });
    expect(r.cardRequired).toBe(true);
    expect(r.autoRenew).toBe(true);
    expect(r.renewalPriceCents).toBe(2999);
    expect(r.verdict).toBe('reject');
  });

  it('a membership with no price is a catch ("needs a membership"), not a block', () => {
    expect(checkFinePrint('Costco membership required.', { today: T }).verdict).toBe('approve_with_catch');
    expect(checkFinePrint('Requires Prime and a registry with at least one item.', { today: T }).verdict).toBe('approve_with_catch');
  });
});

describe('false catches fixed (real quoted text)', () => {
  it('"Enfamil Rewards on mobile phone" is not a phone call', () => {
    const r = checkFinePrint(ENFAMIL, { today: T });
    expect(r.needsPhoneCall).toBe(false);
    expect(r.catchTypes).not.toContain('phone_call');
  });

  it('a customer-service number ("give us a call at 1-800...") is not a step; "Call to request a form" still is', () => {
    expect(checkFinePrint(SIMILAC, { today: T, title: 'Formula coupons and free samples' }).needsPhoneCall).toBe(false);
    expect(checkFinePrint('Free breast pump through your insurance. Call to request a prescription form.', { today: T }).needsPhoneCall).toBe(true);
  });

  it('Similac: a footnote date for a side offer (photo book) does not make the coupon offer expired', () => {
    const r = checkFinePrint(SIMILAC, { today: T, title: 'Formula coupons and free samples' });
    expect(r.expired).toBe(false);
    expect(r.catchTypes).not.toContain('expired');
    expect(r.verdict).not.toBe('reject');
  });

  it('a short fine print whose own end date has passed is still expired', () => {
    expect(checkFinePrint('Free bottle set. Offer valid through 2026-09-30.', { today: T }).expired).toBe(true);
    expect(checkFinePrint('Free bottle. Offer ends Aug 1 2026.', { today: T }).verdict).toBe('reject');
  });

  it('on a long page, a past date counts only when its sentence names the offer', () => {
    const filler = 'Read our parenting articles and tips for every stage. '.repeat(30);
    const named = `${filler} The free formula samples offer expires February 28, 2026.`;
    expect(checkFinePrint(named, { today: T, title: 'Free formula samples' }).expired).toBe(true);
    const other = `${filler} Sweepstakes entries accepted until March 1, 2026.`;
    expect(checkFinePrint(other, { today: T, title: 'Free formula samples' }).expired).toBe(false);
  });

  it('an optional app ("even if you don\'t download the app") and a page menu "Download the app" are not required steps', () => {
    const r = checkFinePrint(SIMILAC, { today: T });
    expect(r.appRequired).toBe(false);
    expect(checkFinePrint('Free formula samples when you create an account, download our app and opt in to marketing texts.', { today: T }).appRequired).toBe(true);
  });

  it('an app, account or phone call is effort (minutes), not a catch', () => {
    const r = checkFinePrint('Free formula samples when you create an account and download our app.', { today: T });
    expect(r.accountRequired).toBe(true);
    expect(r.appRequired).toBe(true);
    expect(r.catchTypes).toEqual([]);
    expect(r.verdict).toBe('approve');
    expect(r.stepsCount).toBe(2);
  });

  it('"Offers may be subject to additional shipping and handling fees" is an unknown fee: a catch, never a block', () => {
    const r = checkFinePrint(SIMILAC, { today: T, title: 'Formula coupons and free samples' });
    expect(r.catchTypes).toContain('fee_unknown');
    expect(r.verdict).toBe('approve_with_catch');
  });
});

describe('combining the code rules and the AI Judge: the threshold decides block vs catch', () => {
  const code = (text: string) => checkFinePrint(text, { today: T });

  it('an AI reject with no learned rule cannot block an offer the code rules call a catch', () => {
    const c = code(AMAZON);
    const out = combineVerdict(c, { verdict: 'reject', citedRuleIds: [], reason: 'needs Prime', quote: 'active Amazon Prime accounts' }, AMAZON);
    expect(out.verdict).toBe('approve_with_catch');
  });

  it('an AI reject that cites a learned rule (parent feedback) still blocks', () => {
    const c = code(AMAZON);
    expect(combineVerdict(c, { verdict: 'reject', citedRuleIds: ['mem-9'], reason: 'rule', quote: '' }, AMAZON).verdict).toBe('reject');
  });

  it('an AI approve cannot rescue an offer the code rules block', () => {
    const c = code('Free first box. Card required. Renews at $34.99/month.');
    expect(combineVerdict(c, { verdict: 'approve', citedRuleIds: [], reason: 'fine', quote: '' }, '').verdict).toBe('reject');
  });

  it('an AI catch counts only when its exact quote shows a catch to the code rules (same page, same grade every run)', () => {
    const text = 'Free sample box. Only for first-time parents enrolled in the program. Not available in AK or HI.';
    const c = checkFinePrint('Free sample box. Only for first-time parents enrolled in the program.', { today: T });
    expect(c.verdict).toBe('approve');
    // A soft AI concern with no catch in its quote: the code grade stands (this flipped Enfamil between runs).
    expect(combineVerdict(c, { verdict: 'approve_with_catch', citedRuleIds: [], reason: 'only first-time parents', quote: 'Only for first-time parents' }, text).verdict).toBe('approve');
    // A quote the code rules read as a catch (a region limit) is added.
    const quoted = combineVerdict(c, { verdict: 'approve_with_catch', citedRuleIds: [], reason: 'not in Alaska or Hawaii', quote: 'Not available in AK or HI.' }, text);
    expect(quoted.verdict).toBe('approve_with_catch');
    expect(quoted.check.catchTypes).toContain('ai_found_catch');
    const madeUp = combineVerdict(c, { verdict: 'approve_with_catch', citedRuleIds: [], reason: 'hidden fee', quote: 'a $20 fee' }, text);
    expect(madeUp.verdict).toBe('approve');
  });

  it('an AI "catch" that is only about joining a free program or using an app is effort, not a catch (Enfamil, live run Oct 26)', () => {
    const text = 'Join Enfamil Family Beginnings and you may be eligible to receive free formula samples.';
    const c = code(text);
    const out = combineVerdict(c, { verdict: 'approve_with_catch', citedRuleIds: [], reason: 'requires enrollment in a rewards program and app usage', quote: 'you may be eligible to receive free formula samples' }, text);
    expect(out.verdict).toBe('approve');
  });

  it('"Spend $300 on items from your registry" (Walmart home cleaning) is a $300 minimum', () => {
    expect(code('Spend $300 on items from your registry (this can be you or someone you have invited).').minPurchaseCents).toBe(30000);
  });

  it('finalVerdict: code reject always wins; an AI reject only blocks with a learned rule', () => {
    expect(finalVerdict('reject', 'approve')).toBe('reject');
    expect(finalVerdict('approve', 'reject')).toBe('approve_with_catch');
    expect(finalVerdict('approve', 'reject', true)).toBe('reject');
    expect(finalVerdict('approve_with_catch', 'approve')).toBe('approve_with_catch');
  });
});

describe('offer_checks rows carry the dollar value and the model (item 5)', () => {
  it('buildOfferCheckRow uses the offer\'s listed value when the fine print states none, and keeps the model name', async () => {
    const { buildOfferCheckRow } = await import('../agents/offerChecks');
    const c = checkFinePrint(BABYLIST, { today: T, listedValueCents: 2000 });
    const row = buildOfferCheckRow({ id: 1317, store: 'Babylist', sourceUrl: 'https://www.babylist.com/hello-baby/babylist-hello-baby-box', valueCents: 2000 }, c, 'approve_with_catch', [], 'agreed', 'nvidia-direct:some/model');
    expect(row).toMatchObject({ faceValueCents: 2000, hiddenCostCents: 895, trueValueCents: 1105, model: 'nvidia-direct:some/model' });
    // A value stated in the fine print wins over the listed one.
    const t = checkFinePrint(TARGET_KIT, { today: T });
    expect(buildOfferCheckRow({ id: 1, store: 'Target', sourceUrl: '', valueCents: 500 }, t, 'approve_with_catch', [], 'agreed').faceValueCents).toBe(10000);
  });

  it('the court saves value and model on an agreed grade', async () => {
    const os = await import('os'); const fs = await import('fs'); const path = await import('path');
    const { judgeOffers } = await import('../agents/finePrintCourt');
    const { TraceLogger } = await import('../agents/trace');
    const { FakeGenerator } = await import('../adapters/llm');
    const { BundleMemory } = await import('../adapters/memory');
    const llm = new FakeGenerator(['pro', 'con', '{"verdict":"approve_with_catch","citedRuleIds":[],"reason":"$8.95 shipping","quote":"pay $8.95"}']);
    (llm as any).models = { reasoning: 'test/judge-model', fast: 'test/fast' };
    const rows: any[] = [];
    const runQuery = async (sql: string) => ({ headers: [], rows: /v_offer_verdicts/.test(sql) ? [] : [{ id: 1317, title: 'Babylist Hello Baby Box', store: 'Babylist', min_age_days: -280, max_age_days: 365, trigger_keyword: '', value_cents: 2000, fine_print: BABYLIST, source_url: 'https://www.babylist.com/hello-baby/babylist-hello-baby-box' }], ms: 1 });
    const ctx: any = {
      runId: 't', family: { id: 'f', birthDate: '2026-10-03', dueDate: null }, z: { runQuery }, llm,
      memory: new BundleMemory(fs.mkdtempSync(path.join(os.tmpdir(), 'mem-'))), trace: new TraceLogger('t', fs.mkdtempSync(path.join(os.tmpdir(), 'tr-'))),
      offerChecks: { insert: async (r: any) => { rows.push(r); return '1'; } }, today: T,
    };
    const out = await judgeOffers(ctx, { ageDays: 20, purchaseKeywords: [], includeGeneral: true });
    expect(out).toHaveLength(1);
    expect(out[0].courtVerdict).toBe('approve_with_catch');
    expect(rows[0]).toMatchObject({ verdict: 'approve_with_catch', faceValueCents: 2000, trueValueCents: 1105, model: 'test/judge-model' });
  });
});

describe('link check grading (item 3)', () => {
  it('flags missing pages, wrong-page redirects and bot walls; skips demo links', async () => {
    const { judgeLink } = await import('../offers/linkCheck');
    expect(judgeLink('https://www.pampers.com/en-us/club', 404, 'https://www.pampers.com/en-us/club', 'Oops').verdict).toBe('FAIL');
    expect(judgeLink('https://www.babylist.com/registry-benefits', 200, 'https://www.babylist.com/find', 'Find a registry').verdict).toBe('FAIL');
    expect(judgeLink('https://www.huggies.com/en-us/rewards', 403, 'https://www.huggies.com/en-us/rewards', 'Just a moment...').verdict).toBe('BOT-WALL');
    expect(judgeLink('https://www.enfamil.com/wonderbox-gift', 200, 'https://www.enfamil.com/wonderbox-gift/', 'Wonder Box').verdict).toBe('OK');
    expect(judgeLink('https://example.com/cuddle-and-co/free-diaper-box', null, '', '').verdict).toBe('SKIPPED');
  });
});

describe('QC fixes (Oct 26): sentences from the Lane B QC report', () => {
  it('H1: trials that turn into paid plans without the word "renew" are blocked', () => {
    const a = checkFinePrint('Free trial for 7 days, then $14.99 per month. Credit card required.', { today: T });
    expect([a.autoRenew, a.renewalPriceCents, a.renewalPeriod, a.verdict]).toEqual([true, 1499, 'month', 'reject']);
    expect(checkFinePrint('Your first box is free, then $24.99 per month.', { today: T }).verdict).toBe('reject');
    expect(checkFinePrint('After the trial you will be charged $9.99 a month unless you cancel.', { today: T }).verdict).toBe('reject');
    expect(checkFinePrint('Free shipping, then $5 off your next order.', { today: T }).autoRenew).toBe(false);
  });

  it('H2: "(a $100 value)", "worth $99" and "$100 value" are read as the value', () => {
    expect(checkFinePrint('Free kit (a $100 value). Pay $120 for shipping.', { today: T }).verdict).toBe('reject');
    expect(checkFinePrint('Free cleaning worth $99.', { today: T }).faceValueCents).toBe(9900);
    expect(checkFinePrint('Free carrier, a $100 value.', { today: T }).faceValueCents).toBe(10000);
  });

  it('M3: "No credit card required" and "Free shipping will apply" are not catches; "Standard shipping rates apply" and "You pay shipping" are', () => {
    const noCard = checkFinePrint('Free sample. No credit card required.', { today: T });
    expect(noCard.cardRequired).toBe(false);
    expect(noCard.catchTypes).toEqual([]);
    expect(checkFinePrint('Free shipping will apply.', { today: T }).catchTypes).toEqual([]);
    expect(checkFinePrint('Standard shipping rates apply.', { today: T }).catchTypes).toContain('fee_unknown');
    expect(checkFinePrint('Free box; you pay shipping.', { today: T }).catchTypes).toContain('fee_unknown');
  });

  it('L4: "Must be a Walmart+ member" and "members only" need a membership (a catch)', () => {
    expect(checkFinePrint('Must be a Walmart+ member.', { today: T }).catchTypes).toContain('required_membership');
    expect(checkFinePrint('Available to members only.', { today: T }).catchTypes).toContain('required_membership');
  });

  it('M1: an AI reject is never silently dropped; with exact paid-plan words it blocks', () => {
    const text = 'Free sample box for new parents.';
    const c = checkFinePrint(text, { today: T });
    const unquoted = combineVerdict(c, { verdict: 'reject', citedRuleIds: [], reason: 'looks like a trap', quote: '' }, text);
    expect(unquoted.verdict).toBe('approve_with_catch');
    expect(unquoted.check.catchTypes).toContain('ai_concern');
    const trapText = 'Free box. Membership continues at $19.99 every month after 30 days.';
    const t = checkFinePrint(trapText, { today: T });
    const quoted = combineVerdict(t, { verdict: 'reject', citedRuleIds: [], reason: 'paid plan', quote: 'Membership continues at $19.99 every month after 30 days.' }, trapText);
    expect(quoted.verdict).toBe('reject');
  });
});

describe('QC re-check (Oct 26): short trial wordings', () => {
  it.each([
    'Try it free, then just $9.99/mo',
    'Try it free, then $9.99/mo.',
    'Try it free, then $9.99 per mo.',
    'Try it free, then $9.99 a month.',
    'Try it free, then $9.99/month.',
    '$0 today, $19 monthly after 30 days. Card required.',
  ])('blocks: %s', (t) => {
    const r = checkFinePrint(t, { today: T });
    expect(r.autoRenew).toBe(true);
    expect(r.verdict).toBe('reject');
  });
  it.each(['No subscription required.', 'Free sample, no purchase necessary.'])('does not block: %s', (t) => {
    expect(checkFinePrint(t, { today: T }).verdict).not.toBe('reject');
  });
});

describe('QC final round (Oct 26): savings are not charges; more trial wordings', () => {
  it.each(['Free trial. Card on file; afterwards only $12/mo.', 'Free trial, card required, afterwards only $12/mo.', 'Free first month, then $7.99 per mth.'])('blocks: %s', (t) => {
    expect(checkFinePrint(t, { today: T }).verdict).toBe('reject');
  });
  it.each(['Save $5 monthly after you join. Free to join.', 'Earn $10 back monthly after your first order.'])('does not block: %s', (t) => {
    const r = checkFinePrint(t, { today: T });
    expect(r.autoRenew).toBe(false);
    expect(r.verdict).not.toBe('reject');
  });
});

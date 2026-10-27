/**
 * Accuracy proof (Oct 26, Lane B item 6): grade real offers with the full Fine Print Court in REAL mode (live AI model)
 * and save each agreed grade to offer_checks with its dollar value and model name.
 *
 * Run (real keys needed): MODEL_PROVIDER=nvidia SAMPLE_MODE=false npx tsx server/offers/accuracyRun.ts <pagesDir> <out.json>
 *   <pagesDir> holds the live page text (one .txt per page, read with Tavily extract the same day) for the page-wide cases.
 * Seed offers are graded from the offers table wording (scripts/seed.ts), which is copied from each live page.
 * No family data is used: the court sees only the offer.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createGenerator } from '../adapters/llm';
import { BundleMemory } from '../adapters/memory';
import { TraceLogger } from '../agents/trace';
import { judgeText } from '../agents/finePrintCourt';
import { buildOfferCheckRow, createOfferCheckWriter } from '../agents/offerChecks';
import type { AgentContext } from '../agents/types';
import { OFFERS } from '../../scripts/seed';
import { LIVE_SEARCH_AGENT } from './auditStore';

interface Case { offerId: string; store: string; title: string; finePrint: string; url: string; valueCents: number | null; agent: string }

const STUB_FAMILY = { id: 'accuracy-run', userId: null, isGuest: true, name: 'Accuracy run', birthDate: null, dueDate: null, zip: '', state: '', employer: '', householdSize: 1, annualIncomeCents: null, dcfsaOffered: false, dataConnected: false };

async function main() {
  const [pagesDir, outFile] = process.argv.slice(2);
  const today = new Date().toISOString().slice(0, 10);
  const SEED_IDS: Record<string, number> = {}; // seed position -> offers.id (1313 + index in this database)
  OFFERS.forEach((_, i) => { SEED_IDS[String(i)] = 1313 + i; });
  const pick = ['Amazon|Free baby registry welcome box', 'Target|15% registry completion coupon', 'Walmart|Free Baby Registry Welcome Box', 'Babylist|Babylist Hello Baby Box',
    'Target|Free Baby Registry Welcome Kit', 'Walmart|Free home cleaning with a Walmart baby registry', 'Pampers|Pampers Rewards: $10 Pampers Cash for every 10 diaper scans',
    'Similac|MySimilac Rewards formula coupons', 'Amazon|Registry completion discount on big-ticket gear', 'Cuddle & Co|Free newborn diaper box'];
  const cases: Case[] = [];
  OFFERS.forEach((o, i) => {
    if (pick.includes(`${o.store}|${o.title}`)) cases.push({ offerId: String(SEED_IDS[String(i)]), store: o.store, title: o.title, finePrint: o.finePrint ?? '', url: o.sourceUrl, valueCents: o.valueCents ?? null, agent: 'fine_print_court' });
  });
  // Whole live pages (what the live search grades), same cut as liveSearch.ts: spaces squeezed, first 6,000 characters.
  const live: [string, string, string, string][] = [
    ['Similac', 'Formula Coupons & Free Samples', 'https://www.similac.com/formula-coupons-free-samples.html', 'https_www_similac_com_formula_coupons_free_samples_html.txt'],
    ['Enfamil', 'Baby Formula Coupons & Samples', 'https://www.enfamil.com/baby-formula-coupons-samples', 'https_www_enfamil_com_baby_formula_coupons_samples.txt'],
    ['Enfamil', 'Claim Your Enfamil Wonder Box Gift for New Parents', 'https://www.enfamil.com/wonderbox-gift', 'https_www_enfamil_com_wonderbox_gift.txt'],
    ['Amazon', 'Baby Registry Welcome Box', 'https://www.amazon.com/gp/help/customer/display.html?nodeId=GBLXVKVYG5SBG8HF', 'https_www_amazon_com_gp_help_customer_display_html_nodeId_GBLXVKVYG5SBG8HF.txt'],
  ];
  for (const [store, title, url, file] of live) {
    const text = fs.readFileSync(path.join(pagesDir, file), 'utf8').replace(/\s+/g, ' ').trim().slice(0, 6000);
    cases.push({ offerId: `live-${crypto.createHash('sha256').update(url).digest('hex').slice(0, 12)}`, store, title, finePrint: text, url, valueCents: null, agent: LIVE_SEARCH_AGENT });
  }

  const only = process.env.ONLY ? process.env.ONLY.split(',') : null; // re-run just these offer ids
  if (only) cases.splice(0, cases.length, ...cases.filter((c) => only.includes(c.offerId)));
  const llm = createGenerator();
  const memory = new BundleMemory(fs.mkdtempSync(path.join(path.dirname(outFile), 'mem-')));
  const { db } = await import('../db');
  const writer = createOfferCheckWriter(db);
  const results: unknown[] = [];
  for (const c of cases) {
    const runId = `accuracy_${crypto.randomBytes(4).toString('hex')}`;
    const ctx: AgentContext = { runId, family: STUB_FAMILY, z: { runQuery: async () => { throw new Error('no lookup'); }, withTrace() { return this; } } as any, llm, memory, trace: new TraceLogger(runId, path.dirname(outFile)), today };
    const j = await judgeText(ctx, { store: c.store, title: c.title, finePrint: c.finePrint, sourceUrl: c.url, valueCents: c.valueCents });
    let rowId: string | null = null;
    if (!j.usedFallback && j.standing === 'agreed') {
      rowId = await writer.insert({ ...buildOfferCheckRow({ id: c.offerId, store: c.store, sourceUrl: c.url, valueCents: c.valueCents }, j.check, j.verdict, j.ruling.citedRuleIds, 'agreed', j.model), agent: c.agent });
    }
    const r = { offerId: c.offerId, store: c.store, title: c.title, verdict: j.verdict, aiSaid: j.ruling.verdict, aiReason: j.ruling.reason, aiQuote: j.ruling.quote ?? '', standing: j.standing, usedFallback: j.usedFallback, catches: j.check.reasons, catchTypes: j.check.catchTypes, evidence: j.check.evidenceQuote.slice(0, 300), model: j.model, rowId };
    results.push(r);
    console.log(JSON.stringify(r));
  }
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  process.exit(0);
}

void main();

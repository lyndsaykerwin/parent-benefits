/**
 * Regenerates the bundled offline fallback data from the seed (run after editing scripts/seed.ts):
 *   npx tsx scripts/gen-fallback.ts
 * Writes data/sample/fallback-rules.json and data/sample/fallback-offers.json.
 * Only no-trigger ("general") offers are kept; rules keep their source URLs.
 */
import fs from 'fs';
import path from 'path';
import { BENEFIT_RULES, OFFERS } from './seed';

const dir = path.resolve('data/sample');
const rules = BENEFIT_RULES.map((r) => ({
  code: r.code, title: r.title, scope: r.scope, amountCents: r.amountCents ?? null,
  windowEndDaysFromBirth: r.windowEndDaysFromBirth ?? null, condition: r.condition ?? '', sourceUrl: r.sourceUrl,
}));
const offers = OFFERS.filter((o) => !o.triggerKeyword).map((o) => ({
  title: o.title, store: o.store, valueCents: o.valueCents ?? null, minAgeDays: o.minAgeDays, maxAgeDays: o.maxAgeDays,
  finePrint: o.finePrint ?? '', sourceUrl: o.sourceUrl,
}));
fs.writeFileSync(path.join(dir, 'fallback-rules.json'), JSON.stringify(rules, null, 2) + '\n');
fs.writeFileSync(path.join(dir, 'fallback-offers.json'), JSON.stringify(offers, null, 2) + '\n');
console.log(`wrote ${rules.length} rules and ${offers.length} offers`);

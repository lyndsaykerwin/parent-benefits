// Live search quality (Oct 25, 2026 real run): only real offers become cards, the search is aimed at offer pages,
// one slow AI answer cannot hold up the rest, and Deals is not left waiting on a fresh search.
import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, jest } from '@jest/globals';
import type { Generator } from '../adapters/llm';
import { BundleMemory } from '../adapters/memory';
import { createMemoryAuditStore } from '../offers/auditStore';
import { createOfferRouter } from '../routes/offerRoutes';
import {
  OFFER_GATE_MARK, PERSONAL_PAGE_HOSTS, SEARCH_QUERIES, createLiveSearchCache, offerScreen, runLiveSearch, sameUrl, type SearchClient,
} from '../offers/liveSearch';

const logsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-logs-'));
const memory = new BundleMemory(fs.mkdtempSync(path.join(os.tmpdir(), 'gate-mem-')));
const TODAY = '2026-10-25';
const APPROVE = '{"verdict":"approve","citedRuleIds":[],"reason":"No subscription and no shipping fee."}';
const OFFER_TEXT = 'Join Huggies Rewards and get a free newborn sample pack. Earn points on every pack of diapers. No purchase needed. Free shipping.';

/** A model that answers the "is this an offer?" question from a table, and approves everything in the court. */
function gateLlm(answers: Record<string, string>, hang: string[] = []): Generator & { gateCalls: number } {
  const g = {
    gateCalls: 0,
    async generate(prompt: string): Promise<string> {
      if (hang.some((t) => prompt.includes(t))) return new Promise<string>(() => undefined); // never answers
      if (prompt.includes(OFFER_GATE_MARK)) {
        g.gateCalls += 1;
        const hit = Object.keys(answers).find((t) => prompt.includes(t));
        return hit ? answers[hit] : 'NOT_OFFER: unknown page';
      }
      return APPROVE;
    },
  };
  return g;
}
const client = (results: { url: string; title: string; content: string; rawContent?: string }[]): SearchClient & { search: jest.Mock } => ({
  search: jest.fn(async (_q: string, _o: Record<string, unknown>) => ({ results })),
}) as never;

describe('code screen: obvious non-offers never reach the AI', () => {
  it('rejects product listings, personal registries, blog posts and forum threads', () => {
    expect(offerScreen('https://www.amazon.com/aden-anais-Muslin-Blanket/dp/B09VYFFGWB', 'aden + anais blanket', 'Free shipping on orders over $35').ok).toBe(false);
    expect(offerScreen('https://www.walmart.com/ip/Fisher-Price-Body-Wash/3631002934', 'Fisher-Price Baby Body Wash', 'Save with free pickup').ok).toBe(false);
    expect(offerScreen('https://www.amazon.com/baby-reg/ashley-smith-2026/12345', "Ashley's Baby Registry", 'free welcome box').ok).toBe(false);
    expect(offerScreen('https://aeroflowbreastpumps.com/blog/8-pregnancy-freebies', '8 pregnancy freebies', 'free stuff').ok).toBe(false);
    expect(offerScreen('https://www.babylist.com/forum/threads/123', 'Anyone got the box?', 'free box').ok).toBe(false);
  });
  it('rejects how-to guides and list articles, even on a trusted site', () => {
    expect(offerScreen('https://www.babylist.com/hello-baby/free-baby-stuff-while-pregnant', 'How to Get Free Baby Stuff While Pregnant', 'free stuff').ok).toBe(false);
    expect(offerScreen('https://www.huggies.com/en-us/baby/newborn/12-freebies', '12 Freebies Every New Parent Should Know', 'free').ok).toBe(false);
    expect(offerScreen('https://www.babylist.com/hello-baby/babylist-hello-baby-box', 'Babylist Hello Baby Box', 'Get a free Hello Baby Box worth $100').ok).toBe(true);
  });
  it('rejects pages that never mention anything free, off, a reward, a gift or a coupon', () => {
    expect(offerScreen('https://www.pampers.com/en-us/about', 'About Pampers', 'Pampers has made diapers since 1961.').ok).toBe(false);
  });
  it('keeps a program page that names its benefit', () => {
    expect(offerScreen('https://www.huggies.com/en-us/rewards', 'Huggies Rewards', OFFER_TEXT).ok).toBe(true);
    expect(offerScreen('https://www.walmart.com/help/article/baby-registry-gift-box-offer/9cd4', 'Baby Registry Gift Box Offer', 'Get a free welcome box').ok).toBe(true);
  });
});

describe('the "is this an offer?" AI check', () => {
  it('only pages the AI calls a real offer become cards', async () => {
    const llm = gateLlm({ 'Huggies Rewards': 'OFFER: free sample pack and points', 'Welcome to your one-stop baby registry': 'NOT_OFFER: a registry sign-up page, nothing to claim' });
    const reply = await runLiveSearch({ llm, memory, today: TODAY, logsDir, client: client([
      { url: 'https://www.huggies.com/en-us/rewards', title: 'Huggies Rewards', content: OFFER_TEXT },
      { url: 'https://www.amazon.com/baby-reg/homepage', title: 'Welcome to your one-stop baby registry', content: 'Create a free baby registry. Free returns for 365 days.' },
    ]) });
    expect(reply.cards.map((c) => c.title)).toEqual(['Huggies Rewards']);
    expect(llm.gateCalls).toBe(2);
  });

  it('gives the AI the full page text (raw content), not just the short snippet', async () => {
    const prompts: string[] = [];
    const llm: Generator = { async generate(p: string) { prompts.push(p); return p.includes(OFFER_GATE_MARK) ? 'OFFER: yes' : APPROVE; } };
    const longText = `${OFFER_TEXT} ${'Terms: one sample pack per household while supplies last. '.repeat(40)}`;
    await runLiveSearch({ llm, memory, today: TODAY, logsDir, client: client([{ url: 'https://www.huggies.com/en-us/rewards', title: 'Huggies Rewards', content: 'short snippet', rawContent: longText }]) });
    const gate = prompts.find((p) => p.includes(OFFER_GATE_MARK)) ?? '';
    expect(gate).toContain('while supplies last');
    expect(gate.length).toBeGreaterThan(1500);
  });
});

describe('a narrower search', () => {
  it('runs the offer-focused searches on the trusted sites only, with full page text and no "past month" limit', async () => {
    const c = client([]);
    await runLiveSearch({ llm: gateLlm({}), memory, today: TODAY, logsDir, client: c });
    expect(c.search).toHaveBeenCalledTimes(SEARCH_QUERIES.length);
    for (const [q, o] of c.search.mock.calls as [string, Record<string, unknown>][]) {
      expect(SEARCH_QUERIES).toContain(q);
      expect(o).toEqual(expect.objectContaining({ includeDomainsMode: 'restrict', excludeDomains: PERSONAL_PAGE_HOSTS, includeRawContent: 'text' }));
      expect(o.timeRange).toBeUndefined();
    }
  });

  it('treats the same page under http/www/tracking-code variants as one result', async () => {
    expect(sameUrl('http://enfamil.com/baby-formula-coupons-samples?amp%3Bli_medium=x')).toBe(sameUrl('https://www.enfamil.com/baby-formula-coupons-samples'));
    const llm = gateLlm({ Enfamil: 'OFFER: free samples' });
    const reply = await runLiveSearch({ llm, memory, today: TODAY, logsDir, client: client([
      { url: 'https://www.enfamil.com/baby-formula-coupons-samples', title: 'Free Baby Formula Samples & Coupons | Enfamil', content: 'Get free formula samples and coupons worth up to $400.' },
      { url: 'http://enfamil.com/baby-formula-coupons-samples?amp%3Bli_medium=efb', title: 'Free Baby Formula Samples & Coupons | Enfamil', content: 'Get free formula samples and coupons worth up to $400.' },
    ]) });
    expect(reply.cards).toHaveLength(1);
  });
});

describe('both search phrases get a turn', () => {
  it('takes results from each search in turn, so the first search cannot fill every slot', async () => {
    const page = (n: number, store: string) => ({ url: `https://www.${store}.com/en-us/rewards/${n}`, title: `${store} rewards ${n}`, content: 'Free rewards for new parents.' });
    const byQuery: Record<string, ReturnType<typeof page>[]> = {
      [SEARCH_QUERIES[0]]: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => page(n, 'huggies')),
      [SEARCH_QUERIES[1]]: [1, 2, 3].map((n) => page(n, 'similac')),
    };
    const c = { search: async (q: string) => ({ results: byQuery[q] ?? [] }) };
    const llm: Generator = { async generate(p: string) { return p.includes(OFFER_GATE_MARK) ? 'OFFER: yes' : APPROVE; } };
    const reply = await runLiveSearch({ llm, memory, today: TODAY, logsDir, client: c });
    expect(reply.cards.filter((x) => /similac/.test(x.title)).length).toBe(3);
  });
});

describe('one slow AI answer does not hold up the rest', () => {
  it('drops a result whose check runs past its time limit and returns the others', async () => {
    const llm = gateLlm({ 'Huggies Rewards': 'OFFER: yes', 'Pampers Club': 'OFFER: yes' }, ['Pampers Club']);
    const t0 = Date.now();
    const reply = await runLiveSearch({ llm, memory, today: TODAY, logsDir, itemTimeoutMs: 300, client: client([
      { url: 'https://www.huggies.com/en-us/rewards', title: 'Huggies Rewards', content: OFFER_TEXT },
      { url: 'https://www.pampers.com/en-us/rewards', title: 'Pampers Club', content: 'Free rewards and gift cards for new parents.' },
    ]) });
    expect(Date.now() - t0).toBeLessThan(3000);
    expect(reply.cards.map((c) => c.title)).toEqual(['Huggies Rewards']);
  });
});

describe('Deals is not left waiting on a fresh search', () => {
  it('after the answer gets old, the old answer comes back at once while a new search runs behind it', async () => {
    let t = 0;
    let n = 0;
    const run = jest.fn(async () => ({ mode: 'live' as const, sitesSearched: 14, searchedOn: TODAY, cards: [], n: ++n }));
    const cache = createLiveSearchCache(run as never, () => t);
    const first = await cache.get(TODAY);
    t += 7 * 60 * 60 * 1000; // past the 6-hour limit
    const second = await cache.get(TODAY);
    expect(second).toBe(first); // no wait
    expect(run).toHaveBeenCalledTimes(2); // but a refresh started
    await new Promise((r) => setImmediate(r));
    expect((await cache.get(TODAY) as unknown as { n: number }).n).toBe(2);
  });

  it('a new day never reuses yesterday\'s finds', async () => {
    const run = jest.fn(async () => ({ mode: 'live' as const, sitesSearched: 14, searchedOn: 'x', cards: [] }));
    const cache = createLiveSearchCache(run, () => 0);
    await cache.get('2026-10-24');
    await cache.get('2026-10-25');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('with prewarm on, the server starts the search before anyone opens Deals', async () => {
    const c = client([]);
    const a = express();
    a.use(createOfferRouter({ llm: gateLlm({}), memory, store: createMemoryAuditStore(), logsDir, today: () => TODAY, env: () => ({ TAVILY_API_KEY: 'k' }), searchClient: c, prewarm: true }));
    await new Promise((r) => setTimeout(r, 20));
    expect(c.search).toHaveBeenCalled();
    const calls = c.search.mock.calls.length;
    expect((await request(a).get('/api/offer-search')).status).toBe(200);
    expect(c.search.mock.calls.length).toBe(calls); // the visit used the warm answer
  });

  it('prewarm never searches in practice mode', async () => {
    const c = client([]);
    createOfferRouter({ llm: gateLlm({}), memory, store: createMemoryAuditStore(), logsDir, today: () => TODAY, env: () => ({ SAMPLE_MODE: 'true', TAVILY_API_KEY: 'k' }), searchClient: c, prewarm: true });
    await new Promise((r) => setTimeout(r, 20));
    expect(c.search).not.toHaveBeenCalled();
  });
});

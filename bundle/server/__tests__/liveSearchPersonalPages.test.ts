import { describe, expect, it, jest } from '@jest/globals';
import { runLiveSearch, storeForUrl, PERSONAL_PAGE_HOSTS } from '../offers/liveSearch';

// Real Tavily search (Oct 25, 2026) returned strangers' personal baby registries (my.babylist.com/<name>) as "offers".
// They are not offers and they show real people's names, so they must never become a card.
describe('live search skips personal registry pages', () => {
  it('does not treat a personal registry page as a trusted store page', () => {
    expect(storeForUrl('https://my.babylist.com/ashley-ponec')).toBeNull();
    expect(storeForUrl('https://babylist.com/hello-baby/free-stuff-for-kids')).toBe('Babylist');
    expect(storeForUrl('https://www.babylist.com/hello-baby/babylist-hello-baby-box')).toBe('Babylist');
  });

  it('asks Tavily to leave personal registry pages out, and drops any that come back anyway', async () => {
    const search = jest.fn(async (_q: string, _o: Record<string, unknown>) => ({ results: [{ title: "Megan & Austin's Baby Registry", url: 'https://my.babylist.com/mxzcrspwg', content: 'View our registry' }] }));
    const llm = { generate: jest.fn() } as never;
    const reply = await runLiveSearch({ llm, memory: {} as never, today: '2026-10-25', client: { search } });
    expect(search.mock.calls[0][1]).toEqual(expect.objectContaining({ excludeDomains: PERSONAL_PAGE_HOSTS }));
    expect(reply.cards).toEqual([]);
  });
});

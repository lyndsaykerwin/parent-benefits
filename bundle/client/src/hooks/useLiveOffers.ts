import { useEffect, useState } from 'react';
import type { FeedCard } from '@shared/bundle';
import { SEARCH_TIMEOUT_MS, searchOffers } from '@/lib/offers';

/**
 * The live offer search, run in the background (R3). It never holds the page up and it never shows an error:
 *   searching: the request is out (saved offers are already on screen);
 *   practice:  practice mode skips the search;
 *   found:     the court-graded new offers (may be none);
 *   quiet:     it failed, ran out of time (10 seconds), or there is no key or no internet. The saved offers just stay.
 */
export type LiveOffers =
  | { phase: 'searching' }
  | { phase: 'practice' }
  | { phase: 'found'; cards: FeedCard[]; sitesSearched: number }
  | { phase: 'quiet' };

export function useLiveOffers(): LiveOffers {
  const [state, setState] = useState<LiveOffers>({ phase: 'searching' });
  useEffect(() => {
    let settled = false;
    const controller = new AbortController();
    const finish = (next: LiveOffers) => { if (settled) return; settled = true; clearTimeout(timer); setState(next); };
    const timer = setTimeout(() => { finish({ phase: 'quiet' }); controller.abort(); }, SEARCH_TIMEOUT_MS);
    void searchOffers(controller.signal).then((r) => {
      finish(r.kind === 'live' ? { phase: 'found', cards: r.cards, sitesSearched: r.sitesSearched } : r.kind === 'practice' ? { phase: 'practice' } : { phase: 'quiet' });
    });
    return () => { settled = true; clearTimeout(timer); controller.abort(); };
  }, []);
  return state;
}

// "Back keeps your place": remembers where you were scrolled on each tab, so coming back (from a card's detail page, from
// another tab, or from a sub-view such as the gear locker) puts you at the same spot. Kept in this browser tab only.
import { useEffect } from 'react';

const key = (runId: string) => `bundle:scroll:${runId}`;
type Spots = Record<string, number>;

function read(runId: string): Spots {
  try {
    const raw = sessionStorage.getItem(key(runId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Spots) : {};
  } catch { return {}; }
}

/** The remembered scroll spot for a tab (undefined when none). */
export const spotFor = (runId: string, tab: string): number | undefined => {
  const y = read(runId)[tab];
  return typeof y === 'number' && Number.isFinite(y) && y >= 0 ? y : undefined;
};

function write(runId: string, tab: string, y: number): void {
  try { sessionStorage.setItem(key(runId), JSON.stringify({ ...read(runId), [tab]: Math.round(y) })); } catch { /* the spot is just not remembered */ }
}

let current: { runId: string; tab: string } | null = null;
/** How many sub-views (gear locker, HR questions, audit a deal) are open. While one is open, the page's scroll is not recorded. */
let frozen = 0;

/** Tell the memory which run and tab are on screen. */
export function setSpotContext(runId: string, tab: string): void { current = { runId, tab }; }
export function clearSpotContext(): void { current = null; }

export const currentScroll = (): number => window.scrollY ?? window.pageYOffset ?? document.documentElement.scrollTop ?? 0;

/** Record the page's scroll position for the tab on screen. */
export function recordSpot(y: number = currentScroll()): void {
  if (!current || frozen > 0 || !Number.isFinite(y)) return;
  write(current.runId, current.tab, y);
}

/** Scroll the page to the tab's remembered spot (to the top when `toTop` and there is none). */
export function restoreSpot(opts: { toTop?: boolean } = {}): void {
  if (!current) return;
  const y = spotFor(current.runId, current.tab);
  if (y === undefined && !opts.toTop) return;
  const go = () => window.scrollTo?.({ top: y ?? 0 });
  go();
  // The page may not have its full height yet on the first pass, so look again on the next frame.
  if (y && typeof requestAnimationFrame === 'function') requestAnimationFrame(go);
}

/** Use inside a sub-view: while it is open the tab's spot is kept as it was, and when it closes the page goes back there. */
export function useFreezeSpot(): void {
  useEffect(() => {
    frozen++;
    return () => { frozen = Math.max(0, frozen - 1); if (frozen === 0) restoreSpot(); };
  }, []);
}

export function forgetSpots(): void {
  try { for (const k of Object.keys(sessionStorage)) if (k.startsWith('bundle:scroll:')) sessionStorage.removeItem(k); } catch { /* nothing to clear */ }
}

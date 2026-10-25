import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/bundle';
import { loadClaims, loadDismissed, saveClaims, saveDismissed } from '@/lib/tabs';

/** How long the "Undo" bar stays up after "Not relevant". */
export const UNDO_SECONDS = 6;

export interface UndoBar { id: string; title: string; cents: number }

/** Tell the server, but never let a slow or missing server get in the parent's way. */
function tellServer(run: () => Promise<unknown>): void {
  try { void run().catch(() => undefined); } catch { /* no network: the browser copy still works */ }
}

/**
 * One place for "I got this", "Not relevant" and "Undo", used by the tabs and by the card detail page so they never disagree.
 * The browser keeps the answer at once (so numbers move instantly); the server copy (claims + feedback tables, and the Coach) follows.
 */
export function useClaims(familyId: string) {
  const [claims, setClaims] = useState<Record<string, boolean>>(() => loadClaims(familyId));
  const [dismissed, setDismissed] = useState<Record<string, boolean>>(() => loadDismissed(familyId));
  const [bar, setBar] = useState<UndoBar | null>(null);
  // The family can arrive after the first render (a card opened in a new tab loads its run first): read this family's answers again.
  useEffect(() => { setClaims(loadClaims(familyId)); setDismissed(loadDismissed(familyId)); }, [familyId]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  useEffect(() => clearTimer, []);

  const put = useCallback((nextClaims: Record<string, boolean>, nextDismissed: Record<string, boolean>) => {
    setClaims(nextClaims); saveClaims(familyId, nextClaims);
    setDismissed(nextDismissed); saveDismissed(familyId, nextDismissed);
  }, [familyId]);

  const without = (m: Record<string, boolean>, id: string) => { const { [id]: _gone, ...rest } = m; return rest; };

  const claim = useCallback((id: string) => {
    put({ ...claims, [id]: true }, without(dismissed, id));
    tellServer(() => api.feedback({ familyId, cardId: id, kind: 'got_it' }));
  }, [claims, dismissed, familyId, put]);

  const dismiss = useCallback((id: string, title: string, cents: number) => {
    put(without(claims, id), { ...dismissed, [id]: true });
    tellServer(() => api.feedback({ familyId, cardId: id, kind: 'not_relevant' }));
    clearTimer();
    setBar({ id, title, cents });
    timer.current = setTimeout(() => setBar(null), UNDO_SECONDS * 1000);
  }, [claims, dismissed, familyId, put]);

  const undo = useCallback((id: string) => {
    put(without(claims, id), without(dismissed, id));
    tellServer(() => api.undoClaim({ familyId, cardId: id }));
    setBar((b) => { if (b?.id === id) clearTimer(); return b?.id === id ? null : b; });
  }, [claims, dismissed, familyId, put]);

  const closeBar = useCallback(() => { clearTimer(); setBar(null); }, []);

  return { claims, dismissed, bar, claim, dismiss, undo, closeBar };
}
export type Claims = ReturnType<typeof useClaims>;

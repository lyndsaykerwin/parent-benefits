// Small browser-side helpers for the Account tab: the plan's optional name, "Start over", "Forget everything", and a hand-off
// that lets another tab open one answer's editor on the Account tab (the Insurance tab's "Change" link).

// ---------- "Save your plan": an optional name, kept on this device ----------

export interface PlanInfo { name: string | null; /** the parent tapped "Not now" */ hidden: boolean }
const planKey = (familyId: string) => `bundle:plan:${familyId}`;

export function loadPlan(familyId: string): PlanInfo {
  try {
    const p = JSON.parse(localStorage.getItem(planKey(familyId)) ?? '{}') as Partial<PlanInfo>;
    return { name: typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 40) : null, hidden: !!p.hidden };
  } catch { return { name: null, hidden: false }; }
}

export function savePlan(familyId: string, plan: PlanInfo): void {
  try { localStorage.setItem(planKey(familyId), JSON.stringify(plan)); } catch { /* storage blocked: lasts until the page closes */ }
}

// ---------- Start over ----------

/** Set by "Start over" so the opening screen shows the questions even though a saved profile exists. */
export const START_OVER_KEY = 'bundle:start-over';
export function markStartOver(): void { try { sessionStorage.setItem(START_OVER_KEY, '1'); } catch { /* ignore */ } }
/** True when "Start over" was just tapped. Reading it does not clear it: React may read twice while a screen opens, so the screen clears it with `clearStartOver` in an effect. */
export function peekStartOver(): boolean {
  try { return sessionStorage.getItem(START_OVER_KEY) === '1'; } catch { return false; }
}
export function clearStartOver(): void { try { sessionStorage.removeItem(START_OVER_KEY); } catch { /* ignore */ } }

// ---------- Forget everything: the browser's side ----------

/** Clears everything this browser saved: localStorage, and this tab's remembered runs, tabs and scroll spots. */
export function clearBrowserData(): void {
  try { localStorage.clear(); } catch { /* ignore */ }
  try {
    for (const k of Object.keys(sessionStorage)) {
      if (/^bundle:(run:|last$|tab:|scroll:|start-over$)/.test(k)) sessionStorage.removeItem(k);
    }
  } catch { /* ignore */ }
}

// ---------- Open one answer's editor on the Account tab ----------

export type EditKey = 'stage' | 'date' | 'zip' | 'work' | 'insurance';
let pendingEdit: EditKey | null = null;
export function askEdit(k: EditKey): void { pendingEdit = k; }
/** Which editor was asked for. Reading it does not clear it (React may read twice); call `clearEdit` in an effect. */
export function peekEdit(): EditKey | null { return pendingEdit; }
export function clearEdit(): void { pendingEdit = null; }

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import AppShell from '@/components/AppShell';
import { ScanProvider, useScan } from '@/components/scan/ScanContext';
import { ScanHeaderButton } from '@/components/scan/ScanButtons';
import ScanSheet from '@/components/scan/ScanSheet';
import { GearLockerView } from '@/components/scan/GearLocker';
import { api, demoDateLabel, familyChipParts, FAMILY_ID_KEY, runFromStatus, savedFamilyId, saveRun, type SavedRun, type TraceLine } from '@/lib/bundle';
import { markStartOver } from '@/lib/account';
import { clearSpotContext, currentScroll, recordSpot, restoreSpot, setSpotContext } from '@/lib/scrollSpot';
import { applyInsuranceAnswer } from '@/lib/insurance';
import { applyDaycareAnswer } from '@/lib/daycare';
import { useClaims } from '@/hooks/useClaims';
import { badgeCount, comingSoonNote, isTabId, moneyNumbers, stageOf, type TabId } from '@/lib/tabs';
import type { FeedCard } from '@shared/bundle';
import { fmtUsdShort } from '@/lib/bundle';
import { useLocation } from 'wouter';
import HomeTab from './HomeTab';
import TaxesTab from './TaxesTab';
import SavingsTab from './SavingsTab';
import InsuranceTab from './InsuranceTab';
import DealsTab from './DealsTab';
import AccountTab, { type SwitchTarget } from './AccountTab';
import TabBar from './TabBar';
import FamilyChipMenu from './FamilyChipMenu';
import type { TabProps } from './shared';

const tabKey = (runId: string) => `bundle:tab:${runId}`;
const loadTab = (runId: string): TabId => { try { const t = sessionStorage.getItem(tabKey(runId)); return isTabId(t) ? t : 'home'; } catch { return 'home'; } };
const saveTab = (runId: string, t: TabId) => { try { sessionStorage.setItem(tabKey(runId), t); } catch { /* ignore */ } };
// Opening Account adds a step to the browser's history (same web address), marked with the tab it was opened from,
// so the phone's or browser's Back returns to that tab instead of leaving the app. The mark survives a reload.
const ACCOUNT_MARK = 'bundleAccountFrom';
const accountMark = (): TabId | null => { try { const t = (window.history.state as Record<string, unknown> | null)?.[ACCOUNT_MARK]; return isTabId(t) && t !== 'account' ? t : null; } catch { return null; } };

interface Props {
  run: SavedRun;
  /** true when the reviewer code is set in this tab. Parents never see owner-only things. */
  owner: boolean;
  /** The finished run's audit lines, for the owner only (empty for a parent). */
  lines?: TraceLine[];
  /**
   * OWNER-ONLY SLOT for W3-PANEL's "How the agents worked together" panel. Feed.tsx passes the panel here;
   * it is shown at the bottom of Home, only when `owner` is true, and never to a parent.
   */
  ownerPanel?: ReactNode;
}

/** Version B: the five-tab app a parent lands on after the Checking screen. Every number comes from `run.result`. */
export default function VersionB(props: Props) {
  return <ScanProvider><VersionBInner {...props} /></ScanProvider>;
}

function VersionBInner({ run: runProp, owner, lines = [], ownerPanel }: Props) {
  const scan = useScan();
  const [, navigate] = useLocation();
  // The run on screen. "Switch family" swaps it for another family's saved run without leaving the app.
  const [run, setRun] = useState<SavedRun>(runProp);
  useEffect(() => { setRun(runProp); }, [runProp]);
  const [tab, setTab] = useState<TabId>(() => loadTab(run.runId));
  const { claims, dismissed, bar, claim, dismiss, undo, closeBar } = useClaims(run.familyId);
  const stage = stageOf(run.family);
  const cards = useMemo(() => applyDaycareAnswer(applyInsuranceAnswer(run.result.cards, run.family), run.family), [run.result.cards, run.family]);
  const today = run.today ?? '';

  const { closeLocker } = scan;
  const change = useCallback((t: TabId) => { closeLocker(); setTab(t); saveTab(run.runId, t); }, [run.runId, closeLocker]);

  // ----- Account and Back (phone/browser Back and the "‹ Back" button both return to the tab Account was opened from) -----
  const accountFrom = useRef<TabId>(accountMark() ?? 'home');
  const openAccount = useCallback(() => {
    if (tab === 'account') return;
    accountFrom.current = tab;
    try { window.history.pushState({ ...((window.history.state as object | null) ?? {}), [ACCOUNT_MARK]: tab }, ''); } catch { /* Back still works from the button */ }
    change('account');
  }, [tab, change]);
  const leaveAccount = useCallback(() => {
    if (accountMark()) window.history.back(); // the popstate listener below changes the tab
    else change(accountFrom.current);
  }, [change]);
  useEffect(() => {
    if (tab !== 'account') return;
    const onPop = () => change(accountFrom.current); // any Back (or Forward) step while on Account leaves it
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [tab, change]);
  // Leaving Account by a bottom tab also takes its history step back off, so a later Back does not land on a dead step.
  const changeTab = useCallback((t: TabId) => {
    if (tab === 'account' && t !== 'account' && accountMark()) { accountFrom.current = t; window.history.back(); }
    change(t);
  }, [tab, change]);

  // Back keeps your place: the scroll spot of each tab is remembered while you scroll, and put back when you come to the tab again
  // (from a card's detail page, from another tab, or from a sub-view such as the gear locker).
  const firstTab = useRef(true);
  useLayoutEffect(() => {
    setSpotContext(run.runId, tab);
    if (firstTab.current) { firstTab.current = false; restoreSpot(); } else restoreSpot({ toTop: true });
  }, [run.runId, tab]);
  useEffect(() => {
    const onScroll = () => recordSpot(currentScroll());
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); clearSpotContext(); };
  }, []);

  // ----- the Account screen's actions (Switch family is also in the header's family chip menu) -----
  // `land` is where the parent ends up: the Account screen when switching from there, Home when switching from the chip.
  const switchTo = useCallback(async (t: SwitchTarget, land: TabId = 'account'): Promise<string | null> => {
    const id = t === 'saved' ? savedFamilyId() : t;
    if (!id) { markStartOver(); navigate('/'); return null; } // no saved profile yet: the five questions
    try {
      let next: SavedRun | null = null;
      try { next = runFromStatus(await api.latestRun(id)); }
      catch (e) { if ((e as { status?: number }).status !== 404) throw e; }
      if (!next) {
        // Nothing saved for this family yet (a fresh server): check them now, on the checking screen.
        const { runId } = await api.startRun({ familyId: id });
        saveTab(runId, land);
        navigate(`/feed/${encodeURIComponent(runId)}`);
        return null;
      }
      saveRun(next);
      saveTab(next.runId, land);
      setRun(next);
      setTab(land);
      navigate(`/feed/${encodeURIComponent(next.runId)}`, { replace: true });
      return null;
    } catch (e) {
      const err = e as Error & { status?: number };
      if (t === 'saved' && err.status === 404) { try { localStorage.removeItem(FAMILY_ID_KEY); } catch { /* ignore */ } }
      return err.message || 'Could not open that family. Please try again.';
    }
  }, [navigate]);
  const switchFromChip = useCallback((t: SwitchTarget) => { closeLocker(); return switchTo(t, 'home'); }, [switchTo, closeLocker]);
  const startOver = useCallback(() => navigate('/'), [navigate]);
  const forgot = useCallback(() => navigate('/'), [navigate]);
  const rerun = useCallback((runId: string) => { saveTab(runId, 'account'); navigate(`/feed/${encodeURIComponent(runId)}`); }, [navigate]);
  // The amount a "Not relevant" tap takes off: only what counts toward the headline (a card with no counted money takes off $0).
  const act = useMemo(() => ({
    claim,
    undo,
    dismiss: (c: FeedCard) => {
      const before = moneyNumbers(run.result, {}, {});
      const after = moneyNumbers(run.result, {}, { [c.id]: true });
      dismiss(c.id, c.title, before.found - after.found);
    },
  }), [claim, undo, dismiss, run.result]);

  const props: TabProps = useMemo(() => ({
    run, stage, cards, claims, dismissed, act, go: changeTab, lines: owner ? lines : [],
    href: (id: string) => `/card/${encodeURIComponent(id)}?run=${encodeURIComponent(run.runId)}`,
    stateNote: comingSoonNote(run),
    owner,
  }), [run, stage, cards, claims, dismissed, act, changeTab, owner, lines]);

  const demoLabel = demoDateLabel(run.demoDate, run.today);
  const Screen = { home: HomeTab, taxes: TaxesTab, savings: SavingsTab, insurance: InsuranceTab, deals: DealsTab, account: null }[tab];

  return (
    <AppShell
      chipSlot={(() => { const label = familyChipParts(run.family, run.today, run.familyId); return label ? <FamilyChipMenu label={label} familyId={run.familyId} onSwitch={switchFromChip} onOpenAccount={openAccount} /> : null; })()}
      action={<ScanHeaderButton />}
      footer={<TabBar current={tab} onChange={changeTab} badge={badgeCount(cards, today, stage, run.family)} />}
    >
      {demoLabel && <p data-testid="demo-date" className="mt-3 text-[13px] font-semibold text-ink-2">{demoLabel}. Sample families are checked as of this date so the demo stays the same.</p>}
      {run.result.banner && (
        <p role="status" className="mt-4 rounded-2xl border border-[#F5C4B0] bg-coral-tint px-4 py-3 text-[15px] font-semibold text-coral-deep">{run.result.banner}</p>
      )}
      {scan.lockerOpen ? (
        <GearLockerView familyId={run.familyId} />
      ) : (
        <div role="region" aria-label={TAB_NAMES[tab]} data-testid={`tab-${tab}`}>
          {Screen ? <Screen {...props} /> : <AccountTab {...props} onSwitch={(t) => switchTo(t)} onStartOver={startOver} onForgot={forgot} onRerun={rerun} onBack={leaveAccount} />}
        </div>
      )}
      <ScanSheet familyId={run.familyId} />
      {tab === 'home' && !scan.lockerOpen && owner && (
        <div data-testid="owner-panel-slot" className="mt-6">{ownerPanel}</div>
      )}
 {bar && (
        <div role="status" data-testid="undo-bar" className="fixed inset-x-0 bottom-[84px] z-30 mx-auto flex w-[calc(100%-32px)] max-w-[448px] items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-cream shadow-lg">
          <p className="text-[14.5px] font-semibold leading-snug">Dismissed.{bar.cents > 0 ? ` ${fmtUsdShort(bar.cents)} taken off Still to claim.` : ''}</p>
          <button type="button" onClick={() => { undo(bar.id); closeBar(); }} className="min-h-[44px] shrink-0 rounded-xl bg-paper px-4 text-[15px] font-bold text-ink">Undo</button>
        </div>
      )}
    </AppShell>
  );
}

const TAB_NAMES: Record<TabId, string> = { home: 'Home', taxes: 'Taxes', savings: 'Savings', insurance: 'Insurance', deals: 'Deals', account: 'Account' };

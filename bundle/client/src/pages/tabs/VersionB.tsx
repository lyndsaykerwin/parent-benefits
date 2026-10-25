import { useCallback, useMemo, useState, type ReactNode } from 'react';
import AppShell from '@/components/AppShell';
import AddPurchaseButton from '@/components/AddPurchaseButton';
import { demoDateLabel, familyChip, type SavedRun, type TraceLine } from '@/lib/bundle';
import { badgeCount, comingSoonNote, isTabId, loadClaims, saveClaims, stageOf, type TabId } from '@/lib/tabs';
import { Link } from 'wouter';
import HomeTab from './HomeTab';
import TaxesTab from './TaxesTab';
import SavingsTab from './SavingsTab';
import InsuranceTab from './InsuranceTab';
import DealsTab from './DealsTab';
import TabBar from './TabBar';
import type { TabProps } from './shared';

const tabKey = (runId: string) => `bundle:tab:${runId}`;
const loadTab = (runId: string): TabId => { try { const t = sessionStorage.getItem(tabKey(runId)); return isTabId(t) ? t : 'home'; } catch { return 'home'; } };
const saveTab = (runId: string, t: TabId) => { try { sessionStorage.setItem(tabKey(runId), t); } catch { /* ignore */ } };

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
export default function VersionB({ run, owner, lines = [], ownerPanel }: Props) {
  const [tab, setTab] = useState<TabId>(() => loadTab(run.runId));
  const [claims, setClaims] = useState<Record<string, boolean>>(() => loadClaims(run.familyId));
  const stage = stageOf(run.family);
  const cards = run.result.cards;
  const today = run.today ?? '';

  const change = useCallback((t: TabId) => { setTab(t); saveTab(run.runId, t); window.scrollTo?.({ top: 0 }); }, [run.runId]);
  const toggleClaim = useCallback((id: string) => {
    setClaims((prev) => { const next = { ...prev, [id]: !prev[id] }; saveClaims(run.familyId, next); return next; });
  }, [run.familyId]);

  const props: TabProps = useMemo(() => ({
    run, stage, cards, claims, toggleClaim, go: change, lines: owner ? lines : [],
    href: (id: string) => `/card/${encodeURIComponent(id)}?run=${encodeURIComponent(run.runId)}`,
    stateNote: comingSoonNote(run),
  }), [run, stage, cards, claims, toggleClaim, change, owner, lines]);

  const demoLabel = demoDateLabel(run.demoDate, run.today);
  const Screen = { home: HomeTab, taxes: TaxesTab, savings: SavingsTab, insurance: InsuranceTab, deals: DealsTab }[tab];

  return (
    <AppShell
      chip={familyChip(run.family, run.today)}
      action={<AddPurchaseButton familyId={run.familyId} />}
      footer={<TabBar current={tab} onChange={change} badge={badgeCount(cards, today, stage, run.family)} />}
    >
      {demoLabel && <p data-testid="demo-date" className="mt-3 text-[13px] font-semibold text-ink-2">{demoLabel}. Sample families are checked as of this date so the demo stays the same.</p>}
      {run.result.banner && (
        <p role="status" className="mt-4 rounded-2xl border border-[#F5C4B0] bg-coral-tint px-4 py-3 text-[15px] font-semibold text-coral-deep">{run.result.banner}</p>
      )}
      <div role="region" aria-label={TAB_NAMES[tab]} data-testid={`tab-${tab}`}>
        <Screen {...props} />
      </div>
      {tab === 'home' && owner && (
        <div data-testid="owner-panel-slot" className="mt-6">{ownerPanel}</div>
      )}
      {tab === 'home' && (
        <Link href="/" className="mt-3 flex min-h-[48px] items-center justify-center text-[15px] font-bold text-ink-2 underline decoration-line decoration-2 underline-offset-4">
          Start over with your own details
        </Link>
      )}
    </AppShell>
  );
}

const TAB_NAMES: Record<TabId, string> = { home: 'Home', taxes: 'Taxes', savings: 'Savings', insurance: 'Insurance', deals: 'Deals' };

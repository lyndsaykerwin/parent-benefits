import { ALL_TABS, type TabId } from '@/lib/tabs';
import { cn } from '@/lib/utils';

const ICONS: Record<TabId, string> = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  taxes: 'M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6',
  savings: 'M12 3v18M16 7.5c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.8 2.7 4 3.2 4 1.5 4 3.2-1.8 3-4 3-4-1.3-4-3',
  insurance: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z',
  deals: 'M20 12l-8 8-9-9V3h8zM7.5 7.5h.01',
  account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4.4 3.6-7 8-7s8 2.6 8 7',
};

/** The bottom bar: six tabs, labels always shown, taps at least 44px. The Insurance tab shows a red count while you are elsewhere. */
export default function TabBar({ current, onChange, badge }: { current: TabId; onChange: (t: TabId) => void; badge: number }) {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="mx-auto flex max-w-[480px]">
        {ALL_TABS.map((t) => {
          const on = current === t.id;
          const showBadge = t.id === 'insurance' && badge > 0 && !on;
          return (
            <li key={t.id} className="flex-1">
              <button
                type="button" onClick={() => onChange(t.id)} aria-current={on ? 'page' : undefined}
                className={cn('relative flex min-h-[60px] w-full flex-col items-center justify-center gap-0.5 px-1 text-[12px] font-bold', on ? 'text-coral' : 'text-ink-2')}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[t.id]} /></svg>
                <span>{t.label}</span>
                {showBadge && (
                  <span aria-label={`${badge} ${badge === 1 ? 'deadline' : 'deadlines'}`} className="absolute right-[22%] top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-kind-recall px-1 text-[11px] font-extrabold text-white">{badge}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

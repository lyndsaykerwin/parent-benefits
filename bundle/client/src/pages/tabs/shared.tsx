import type { ReactNode } from 'react';
import type { FeedCard } from '@shared/bundle';
import FeedCardView from '@/components/FeedCardView';
import { claimableCards, type Stage, type TabId } from '@/lib/tabs';
import type { SavedRun, TraceLine } from '@/lib/bundle';
import { cn } from '@/lib/utils';

/** What every tab gets from the Version B container. */
export interface TabProps {
  run: SavedRun;
  stage: Stage;
  /** Cards on the run (from the real result). */
  cards: FeedCard[];
  claims: Record<string, boolean>;
  toggleClaim: (id: string) => void;
  /** Link to a card's "How we checked" page. */
  href: (id: string) => string;
  go: (tab: TabId) => void;
  /** The "coming soon" sentence for a state we do not cover yet, or null. */
  stateNote: string | null;
  /** The finished run's audit lines (reviewer only; empty for a parent). */
  lines: TraceLine[];
}

export function CategoryHeader({ eyebrow, dot, title, sub }: { eyebrow: string; dot: string; title: string; sub: string }) {
  return (
    <section className="mt-5" data-testid="category-header">
      <p className="eyebrow flex items-center gap-1.5 text-ink-2"><span aria-hidden="true" className="inline-block h-2 w-2 rounded-full" style={{ background: dot }} />{eyebrow}</p>
      <h1 className="mt-1 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em]">{title}</h1>
      <p className="mt-2 text-[16px] leading-relaxed text-ink-2">{sub}</p>
    </section>
  );
}

/** Cards in a stack, each with its "I got this" tick when it is something a parent can claim. */
export function CardStack({ cards, props, deadlineLabels, extras }: { cards: FeedCard[]; props: TabProps; deadlineLabels?: Record<string, string>; extras?: Record<string, ReactNode> }) {
  const ids = new Set(claimableCards(props.cards).map((c) => c.id));
  return (
    <div className="mt-4 space-y-3">
      {cards.map((c) => (
        <FeedCardView
          key={c.id}
          card={c}
          today={props.run.today}
          detailHref={props.href(c.id)}
          // An expecting family has no countdown yet: every benefit deadline counts from the birth.
          deadlineLabel={deadlineLabels?.[c.id] ?? (props.stage === 'expecting' && c.kind === 'benefit' && c.deadline ? 'Starts at birth' : undefined)}
          extra={extras?.[c.id]}
          claim={ids.has(c.id) ? { checked: !!props.claims[c.id], onToggle: () => props.toggleClaim(c.id) } : undefined}
        />
      ))}
    </div>
  );
}

/** The honest "your state is coming soon" card. Federal programs still show; this is never an error. */
export function ComingSoonState({ note }: { note: string | null }) {
  if (!note) return null;
  return (
    <aside role="note" data-testid="state-coming-soon" className="mt-4 rounded-2xl border border-dashed border-line bg-[#FDFBF8] p-4">
      <p className="eyebrow flex items-center gap-1.5 text-ink-2"><span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-ink-3" />Coming soon</p>
      <h3 className="mt-2 text-[17px] font-extrabold leading-snug tracking-[-0.01em]">Your state’s programs</h3>
      <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{note}. For now we are showing the federal programs you may qualify for.</p>
    </aside>
  );
}

export function SectionTitle({ children, tone = 'plain', id }: { children: ReactNode; tone?: 'plain' | 'urgent'; id?: string }) {
  return <h2 id={id} className={cn('eyebrow mt-7', tone === 'urgent' ? 'text-coral-deep' : 'text-ink-2')}>{children}</h2>;
}

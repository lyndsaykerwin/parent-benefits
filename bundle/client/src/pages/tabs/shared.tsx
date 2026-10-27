import { useState, type ReactNode } from 'react';
import type { FeedCard } from '@shared/bundle';
import FeedCardView from '@/components/FeedCardView';
import { cardState, claimableCards, homeTotals, type Stage, type TabId } from '@/lib/tabs';
import { fmtUsdShort, safeSources, type SavedRun, type TraceLine } from '@/lib/bundle';
import { cn } from '@/lib/utils';

/** What every tab gets from the Version B container. */
export interface TabProps {
  run: SavedRun;
  stage: Stage;
  /** Cards on the run (from the real result). */
  cards: FeedCard[];
  /** Cards marked "I got this" and cards marked "Not relevant" (by card id). */
  claims: Record<string, boolean>;
  dismissed: Record<string, boolean>;
  /** "I got this", "Not relevant" and "Undo": the same three actions on every tab and on the detail page. */
  act: { claim: (id: string) => void; dismiss: (card: FeedCard) => void; undo: (id: string) => void };
  /** Link to a card's "How we checked" page. */
  href: (id: string) => string;
  go: (tab: TabId) => void;
  /** The "coming soon" sentence for a state we do not cover yet, or null. */
  stateNote: string | null;
  /** The finished run's audit lines (reviewer only; empty for a parent). */
  lines: TraceLine[];
  /** true when the reviewer code is set (the owner view). Parents never see owner-only things. */
  owner?: boolean;
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

/** "How we checked" is for cards we really checked for this family: deals (the fine print), money back and recalls. Benefits get a plain "Source" link. The owner keeps it on every card. */
export const showsHowWeChecked = (c: FeedCard, owner?: boolean): boolean => !!owner || c.kind === 'discount' || c.kind === 'clawback' || c.kind === 'recall';

/** Cards still to do, each with "I got this" and "Not relevant" when a parent can act on it. Finished and dismissed cards move to the drawers (see ClaimDrawers). */
export function CardStack({ cards, props, deadlineLabels, extras }: { cards: FeedCard[]; props: TabProps; deadlineLabels?: Record<string, string>; extras?: Record<string, ReactNode> }) {
  const ids = new Set(claimableCards(props.cards).map((c) => c.id));
  const open = cards.filter((c) => !ids.has(c.id) || cardState(c.id, props.claims, props.dismissed) === 'open');
  return (
    <div className="mt-4 space-y-3">
      {open.map((c) => (
        <FeedCardView
          key={c.id}
          card={c}
          today={props.run.today}
          detailHref={showsHowWeChecked(c, props.owner) ? props.href(c.id) : undefined}
          sourceHref={!showsHowWeChecked(c, props.owner) && c.kind === 'benefit' ? safeSources(c.sources)[0]?.url : undefined}
          // An expecting family has no countdown yet: every benefit deadline counts from the birth.
          deadlineLabel={deadlineLabels?.[c.id] ?? (props.stage === 'expecting' && c.kind === 'benefit' && c.deadline ? 'Starts at birth' : undefined)}
          extra={extras?.[c.id]}
          actions={ids.has(c.id) ? { onGotIt: () => props.act.claim(c.id), onNotRelevant: () => props.act.dismiss(c) } : undefined}
        />
      ))}
    </div>
  );
}

/** One closed drawer ("Claimed (2)" or "Dismissed (1)"). Opening it shows each card with its own Undo. */
function Drawer({ name, cards, props, note }: { name: 'Claimed' | 'Dismissed'; cards: FeedCard[]; props: TabProps; note: (c: FeedCard, cents: number) => string }) {
  const [open, setOpen] = useState(false);
  const counted = new Map(homeTotals(props.run.result).parts.map((c) => [c.id, c.amountCents ?? 0]));
  const label = `${name} (${cards.length})`;
  const empty = name === 'Claimed' ? 'Cards you tap “I got this” on land here.' : 'Cards you mark “Not relevant” land here.';
  return (
    <section aria-label={label} className="rounded-2xl border border-line bg-[#F4EFE8]" data-testid={`drawer-${name.toLowerCase()}`}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 text-left text-[16px] font-extrabold text-ink">
        <span>{label}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={cn('transition-transform', open && 'rotate-180')}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3">
          {cards.length === 0 && <p className="px-1 text-[14px] text-ink-2">{empty}</p>}
          {cards.map((c) => (
            <article key={c.id} aria-label={c.title} className="flex items-center justify-between gap-3 rounded-xl bg-paper p-3">
              <div className="min-w-0">
                <p className="text-[15px] font-bold leading-snug text-ink">{c.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-ink-2">{note(c, counted.get(c.id) ?? 0)}</p>
              </div>
              <button type="button" onClick={() => props.act.undo(c.id)} className="min-h-[44px] shrink-0 rounded-xl border border-line bg-paper px-4 text-[15px] font-bold text-ink">Undo</button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/** The "Claimed" and "Dismissed" drawers for the cards on one tab. Not shown on a tab with nothing a parent can act on. */
export function ClaimDrawers({ cards, props }: { cards: FeedCard[]; props: TabProps }) {
  const ids = new Set(claimableCards(props.cards).map((c) => c.id));
  const mine = cards.filter((c) => ids.has(c.id));
  if (mine.length === 0) return null;
  const claimed = mine.filter((c) => cardState(c.id, props.claims, props.dismissed) === 'claimed');
  const dismissed = mine.filter((c) => cardState(c.id, props.claims, props.dismissed) === 'dismissed');
  return (
    <div className="mt-4 space-y-2.5" data-testid="claim-drawers">
      <Drawer name="Claimed" cards={claimed} props={props} note={(_c, cents) => (cents > 0 ? `Claimed · ${fmtUsdShort(cents)} added to Claimed so far` : 'Claimed')} />
      <Drawer name="Dismissed" cards={dismissed} props={props} note={(_c, cents) => `Not relevant${cents > 0 ? ` · ${fmtUsdShort(cents)} taken off Still to claim` : ''} · told the Coach`} />
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

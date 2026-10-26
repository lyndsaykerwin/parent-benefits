import { useEffect, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'wouter';

/** Pages visited in this tab (newest last), so a "‹ Back" link can step back in history instead of stacking a new entry. */
const visited: string[] = [];
const samePath = (a: string, b: string) => { try { return decodeURIComponent(a) === decodeURIComponent(b); } catch { return a === b; } };
/** Exported for tests. When the page before this one is the link's target, go back (pressing the browser's Back then behaves as expected). */
export function backClick(e: MouseEvent, href: string): void {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  if (visited.length >= 2 && samePath(visited[visited.length - 2], href)) {
    e.preventDefault();
    visited.pop();
    window.history.back();
  }
}

interface Props {
  chip?: string | null;
  /** Replaces the plain chip with a control (Version B's family chip menu). */
  chipSlot?: ReactNode;
  children: ReactNode;
  back?: { href: string; label: string };
  /** A control at the right end of the header (Version B puts the "+" photo button here, so it is on every tab). */
  action?: ReactNode;
  /** Pinned to the bottom of the screen (the Version B tab bar). The page leaves room so it never covers content. */
  footer?: ReactNode;
}

/** Phone-width page frame: "bundle." wordmark, optional family chip, 16px side padding. */
export default function AppShell({ chip, chipSlot, children, back, action, footer }: Props) {
  useEffect(() => { visited.push(window.location.pathname); if (visited.length > 20) visited.shift(); }, []);
  return (
    <div className="min-h-[100dvh] bg-cream text-ink">
      <div className={`mx-auto w-full max-w-[480px] px-4 pt-5 ${footer ? 'pb-32' : 'pb-16'}`}>
        <header className="relative flex min-h-[44px] items-center justify-between gap-3">
          <Link href="/" className="text-[24px] font-extrabold tracking-[-0.03em] text-ink" aria-label="Bundle home">
            bundle<span className="text-coral">.</span>
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            {chipSlot ?? (chip && (
              <span className="truncate rounded-full border border-line bg-paper px-3 py-1 text-[13px] font-semibold text-ink-2">{chip}</span>
            ))}
            {action}
          </div>
        </header>
        {back && (
          <Link href={back.href} onClick={(e) => backClick(e, back.href)} className="-ml-1 mt-2 inline-flex min-h-[44px] items-center gap-1 px-1 text-[15px] font-bold text-ink-2 hover:text-ink">
            <span aria-hidden="true">‹</span> {back.label}
          </Link>
        )}
        <main>{children}</main>
      </div>
      {footer}
    </div>
  );
}

import type { ReactNode } from 'react';
import { Link } from 'wouter';

/** Phone-width page frame: "bundle." wordmark, optional family chip, 16px side padding. */
export default function AppShell({ chip, children, back }: { chip?: string | null; children: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="min-h-[100dvh] bg-cream text-ink">
      <div className="mx-auto w-full max-w-[480px] px-4 pb-16 pt-5">
        <header className="flex min-h-[44px] items-center justify-between gap-3">
          <Link href="/" className="text-[24px] font-extrabold tracking-[-0.03em] text-ink" aria-label="Bundle home">
            bundle<span className="text-coral">.</span>
          </Link>
          {chip && (
            <span className="truncate rounded-full border border-line bg-paper px-3 py-1 text-[13px] font-semibold text-ink-2">{chip}</span>
          )}
        </header>
        {back && (
          <Link href={back.href} className="-ml-1 mt-2 inline-flex min-h-[44px] items-center gap-1 px-1 text-[15px] font-bold text-ink-2 hover:text-ink">
            <span aria-hidden="true">‹</span> {back.label}
          </Link>
        )}
        <main>{children}</main>
      </div>
    </div>
  );
}

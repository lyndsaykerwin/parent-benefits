import type { FeedCard } from '@shared/bundle';
import type { TraceLine } from '@/lib/bundle';
import { Link } from 'wouter';
import { zetarisForCard, memoryForCard, blockedReason } from '@/lib/howWeChecked';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Data sources checked (via Zetaris)": plain-English source chips for this card. Renders nothing when no query maps to the card. */
export function ZetarisSection({ card, lines }: { card: FeedCard; lines: TraceLine[] }) {
  const v = zetarisForCard(card, lines);
  if (!v) return null;
  return (
    <section className="mt-6" aria-labelledby="zetaris-title" data-testid="zetaris-section">
      <h3 id="zetaris-title" className="eyebrow text-ink-2">Data sources checked (via Zetaris)</h3>
      <div className="mt-2 rounded-2xl border border-line bg-paper p-4">
        <ul className="flex flex-wrap gap-2" aria-label="Sources">
          {v.sources.map((s) => (
            <li key={s} className="rounded-full bg-coral-tint px-3 py-1 text-[13px] font-semibold leading-snug text-coral-deep">{s}</li>
          ))}
        </ul>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-2" data-testid="zetaris-summary">
          {plural(v.queries, 'query', 'queries')} across {plural(v.sources.length, 'source', 'sources')}
          {v.saved ? ' · saved real response' : v.ms !== null ? ` · ${v.ms} ms` : ''}
        </p>
        <details className="mt-2">
          <summary className="min-h-[44px] cursor-pointer py-2 text-[14px] font-bold text-ink">Show query</summary>
          <p className="text-[12.5px] text-ink-2">Values are hidden for privacy.</p>
          {v.sql.map((q, i) => (
            <pre key={i} className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-cream p-3 font-mono text-[11.5px] leading-relaxed text-ink">{q}</pre>
          ))}
        </details>
      </div>
    </section>
  );
}

/** "Memory (Meterless H-MEM)": learned rules recalled for this card's offer. Renders nothing when there are none. */
export function MemorySection({ card, lines }: { card: FeedCard; lines: TraceLine[] }) {
  const rules = memoryForCard(card, lines);
  if (rules.length === 0) return null;
  return (
    <section className="mt-6" aria-labelledby="memory-title" data-testid="memory-section">
      <h3 id="memory-title" className="eyebrow text-ink-2">Memory (Meterless H-MEM)</h3>
      <ul className="mt-2 space-y-2">
        {rules.map((r) => (
          <li key={r.id} className="rounded-2xl border border-line bg-paper p-4">
            <p className="text-[15px] font-bold leading-snug text-ink">{r.text}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[12.5px] font-semibold">
              <span className="rounded-full bg-cream px-2.5 py-1 font-mono text-ink">{r.id}</span>
              <span className="rounded-full bg-cream px-2.5 py-1 text-ink-2">confidence {Math.round(r.confidence * 100)}%</span>
              <span className="rounded-full bg-cream px-2.5 py-1 text-ink-2">learned from {plural(r.reports, 'parent report', 'parent reports')}</span>
              {r.cited && <span className="rounded-full bg-coral-tint px-2.5 py-1 text-coral-deep">cited by the Judge</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Collapsed "We caught these for you": offers the Fine Print Court rejected, with the learned rule it cited. Renders nothing when there are none. */
export function CaughtForYou({ blocked, lines, href }: { blocked: FeedCard[]; lines: TraceLine[]; href: (id: string) => string }) {
  if (blocked.length === 0) return null;
  return (
    <section className="mt-7" aria-label="We caught these for you" data-testid="caught-section">
      <details className="rounded-2xl border border-line bg-paper px-4">
        <summary className="flex min-h-[56px] cursor-pointer items-center justify-between gap-3 text-[16px] font-bold text-ink">
          <span>We caught these for you</span>
          <span className="rounded-full bg-[#FBE3E0] px-2.5 py-0.5 text-[13px] font-bold text-[#9E2A21]">{blocked.length}</span>
        </summary>
        <p className="text-[14px] text-ink-2">Offers we blocked because of their fine print. They are not counted in your totals.</p>
        <ul className="mt-2 space-y-3 pb-4">
          {blocked.map((c) => (
            <li key={c.id} className="rounded-2xl border border-line bg-cream p-3">
              <Link href={href(c.id)} className="block min-h-[44px]">
                <span className="block text-[15px] font-bold leading-snug text-ink">{c.title}</span>
                <span className="mt-1 block text-[14px] leading-relaxed text-ink-2">{blockedReason(c)}</span>
                <span className="mt-1 block text-[13px] font-bold text-coral-deep">See how we checked ›</span>
              </Link>
              <MemorySection card={c} lines={lines} />
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

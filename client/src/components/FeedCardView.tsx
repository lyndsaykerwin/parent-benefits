import { Link } from 'wouter';
import type { FeedCard } from '@shared/bundle';
import { KIND_META, VERDICT_LABEL, amountCaption, cardDeadline, fmtUsd, safeSources } from '@/lib/bundle';
import { cn } from '@/lib/utils';

interface Props {
  card: FeedCard;
  /** ISO date the run used as "today" (so day counts match the server). */
  today?: string;
  /** Pinned cards get the coral outline and a "Pinned" eyebrow. */
  pinned?: boolean;
  /** Where "How we checked" goes. Omit to hide the link (e.g. on the detail page itself). */
  detailHref?: string;
}

function ExternalIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

const verdictStyle: Record<FeedCard['verdict'], string> = {
  verified: 'bg-[#E3F3EA] text-[#17643F]',
  likely: 'bg-[#E3F3EA] text-[#17643F]',
  all_clear: 'bg-[#E3F3EA] text-[#17643F]',
  info: 'bg-[#F1ECE4] text-ink-2',
  blocked: 'bg-[#FBE3E0] text-[#9E2A21]',
};

export default function FeedCardView({ card, today, pinned = false, detailHref }: Props) {
  const meta = KIND_META[card.kind];
  const caption = amountCaption(card);
  const soon = card.kind === 'coming_soon';
  const sources = safeSources(card.sources);
  const due = card.deadline ? cardDeadline(card.kind, card.deadline, today) : null;
  // Coming-soon tiles already say "Coming soon" in the eyebrow, so drop the repeat from the body.
  const body = soon ? card.body.replace(/^coming soon:\s*/i, '') : card.body;
  const eyebrow = pinned ? 'Pinned · Deadline' : card.deadline && card.kind === 'benefit' ? 'Benefit · Deadline' : meta.label;

  return (
    <article
      className={cn('bundle-card p-4', pinned && 'border-coral border-[1.5px]', soon && 'bg-[#FDFBF8] shadow-none')}
      aria-label={card.title}
      data-kind={card.kind}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={cn('eyebrow flex items-center gap-1.5', pinned ? 'text-coral-deep' : meta.text)}>
          <span aria-hidden="true" className={cn('inline-block h-2 w-2 rounded-full', pinned ? 'bg-coral' : meta.dot)} />
          {eyebrow}
        </p>
        {!soon && (
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold', verdictStyle[card.verdict])}>
            {VERDICT_LABEL[card.verdict]}
          </span>
        )}
      </div>

      <h3 className="mt-2 text-[17px] font-extrabold leading-snug tracking-[-0.01em] text-ink">{card.title}</h3>
      <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{body.charAt(0).toUpperCase() + body.slice(1)}</p>

      {(card.amountCents !== null || card.deadline) && (
        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {card.amountCents !== null && (
            <p className="flex items-baseline gap-1.5">
              <span data-testid="card-amount" className={cn('tabular text-[20px] font-extrabold', card.kind === 'clawback' ? 'text-kind-clawback' : 'text-ink')}>
                {fmtUsd(card.amountCents)}
              </span>
              {caption && <span className="text-[13px] font-semibold text-ink-2">{caption}</span>}
            </p>
          )}
          {due && (
            <p className={cn('text-[14px] font-bold', due.urgent ? 'text-coral-deep' : 'text-ink-2')}>{due.text}</p>
          )}
        </div>
      )}

      {sources.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Sources">
          {sources.map((s) => (
            <li key={s.url + s.label}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-line bg-cream px-3 text-[13px] font-semibold text-ink-2 underline-offset-2 hover:underline"
              >
                {s.label}
                <ExternalIcon />
              </a>
            </li>
          ))}
        </ul>
      )}

      {detailHref && !soon && (
        <div className="mt-2 flex justify-end border-t border-dashed border-line pt-1">
          <Link
            href={detailHref}
            className="inline-flex min-h-[44px] items-center gap-1 px-1 text-[14px] font-bold text-ink-2 hover:text-ink"
          >
            How we checked <span aria-hidden="true">›</span>
          </Link>
        </div>
      )}
    </article>
  );
}

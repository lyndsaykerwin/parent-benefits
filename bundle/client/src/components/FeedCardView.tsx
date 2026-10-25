import type { ReactNode } from 'react';
import { Link } from 'wouter';
import type { FeedCard } from '@shared/bundle';
import { KIND_META, VERDICT_LABEL, amountCaption, cardDeadline, fmtUsd, isCheckWithJob, safeSources } from '@/lib/bundle';
import { plainCardBody, valueScoreLines } from '@/lib/tabs';
import { ageLine, factLines } from '@/lib/offers';
import { minutesOf } from '@shared/cardMeta';
import { cn } from '@/lib/utils';

interface Props {
  card: FeedCard;
  /** ISO date the run used as "today" (so day counts match the server). */
  today?: string;
  /** Pinned cards get the coral outline and a "Pinned" eyebrow. */
  pinned?: boolean;
  /** Where "How we checked" goes. Omit to hide the link (e.g. on the detail page itself). */
  detailHref?: string;
  /** Shows "I got this" and "Not relevant" buttons. Leave out for cards a parent cannot act on (safety checks, coming-soon tiles). */
  actions?: { onGotIt: () => void; onNotRelevant: () => void };
  /** Replaces the deadline countdown (e.g. "Starts at birth" for an expecting family). */
  deadlineLabel?: string;
  /** Extra content shown under the card's sentence (e.g. the insurance deadline pill). */
  extra?: ReactNode;
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

export default function FeedCardView({ card, today, pinned = false, detailHref, actions, deadlineLabel, extra }: Props) {
  const meta = KIND_META[card.kind];
  const caption = amountCaption(card);
  const soon = card.kind === 'coming_soon';
  const sources = safeSources(card.sources);
  const due = deadlineLabel ? { text: deadlineLabel, urgent: false } : card.deadline ? cardDeadline(card.kind, card.deadline, today) : null;
  const checkWithJob = isCheckWithJob(card);
  const minutes = card.kind === 'discount' ? undefined : minutesOf(card); // deals already say their effort in the Value and time lines
  // A deal graded by the Fine Print Court says what the court found (verdict, minutes, true value, the baby's age) instead of a sentence.
  const facts = card.kind === 'discount' ? card.offerFacts : undefined;
  const scoreLines = card.valueScore && !facts ? valueScoreLines(card.valueScore) : [];
  // Coming-soon tiles already say "Coming soon" in the eyebrow, so drop the repeat from the body.
  const body = plainCardBody(soon ? card.body.replace(/^coming soon:\s*/i, '') : card.body);
  // A graded deal is labelled with the store that offers it (from its source link's label), like the mockup.
  const store = facts ? card.sources[0]?.label.replace(/\s+offer page$/i, '').trim() : '';
  const eyebrow = pinned ? 'Pinned · Deadline' : card.deadline && card.kind === 'benefit' ? 'Benefit · Deadline' : store || meta.label;

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
            {checkWithJob ? 'Check with your job' : /^benefit-childcare_tax_credit$/.test(card.id) ? 'Ask your tax preparer' : facts && card.verdict === 'likely' ? 'Graded by Bundle' : VERDICT_LABEL[card.verdict]}
          </span>
        )}
      </div>
      {card.isNew && (
        <p className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-coral-tint px-2.5 py-1 text-[12.5px] font-bold text-coral-deep">New · found today</span>
          {card.paidLink && <span data-testid="paid-link-label" className="rounded-full border border-line px-2.5 py-1 text-[12.5px] font-bold text-ink-2">{card.paidLink.label}</span>}
        </p>
      )}
      {!card.isNew && card.paidLink && (
        <p className="mt-2"><span data-testid="paid-link-label" className="rounded-full border border-line px-2.5 py-1 text-[12.5px] font-bold text-ink-2">{card.paidLink.label}</span></p>
      )}

      {minutes !== undefined && actions && (
        <p className="mt-2">
          <span data-testid="card-minutes" title="Our estimate" className="inline-flex rounded-full bg-[#FBEBCB] px-2.5 py-1 text-[12.5px] font-bold text-[#7A5410]">about {minutes} min</span>
        </p>
      )}
      <h3 className="mt-2 text-[17px] font-extrabold leading-snug tracking-[-0.01em] text-ink">{card.title}</h3>
      {!facts && <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{body.charAt(0).toUpperCase() + body.slice(1)}</p>}
      {facts && (
        <div className="mt-2" data-testid="offer-facts">
          <ul className="space-y-1 text-[14px] font-semibold" aria-label="What the Fine Print Court found">
            {factLines(facts).map((l, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span aria-hidden="true">{l.icon}</span>
                <span className={cn('min-w-0', l.tone === 'good' && 'text-[#17643F]', l.tone === 'catch' && 'text-[#7A5410]', l.tone === 'blocked' && 'text-[#9E2A21]', l.tone === 'plain' && 'text-ink')}>
                  {l.text}
                  {l.note && <span className="mt-0.5 block text-[12.5px] font-medium text-ink-2">{l.note}</span>}
                </span>
              </li>
            ))}
          </ul>
          {ageLine(facts) && <p className="mt-2 text-[14px] leading-snug text-ink-2">{ageLine(facts)}</p>}
        </div>
      )}

      {extra}

      {scoreLines.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[13.5px] font-semibold text-ink-2" aria-label="Value and time" data-testid="value-score">
          {scoreLines.map((l) => <li key={l}>{l}</li>)}
        </ul>
      )}

      {((card.amountCents !== null && !facts) || card.deadline) && (
        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {card.amountCents !== null && !facts && (
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
        <div className="mt-2 flex items-center justify-end border-t border-dashed border-line pt-1">
          <Link
            href={detailHref}
            className="inline-flex min-h-[44px] items-center gap-1 px-1 text-[14px] font-bold text-ink-2 hover:text-ink"
          >
            How we checked <span aria-hidden="true">›</span>
          </Link>
        </div>
      )}
      {actions && !soon && (
        <div className={cn('grid grid-cols-2 gap-2.5', detailHref ? 'mt-1' : 'mt-3')}>
          <button type="button" onClick={actions.onGotIt} className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl bg-ink px-3 text-[15px] font-bold text-cream active:scale-[.99]">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
            I got this
          </button>
          <button type="button" onClick={actions.onNotRelevant} className="inline-flex min-h-[48px] items-center justify-center rounded-2xl border border-line bg-paper px-3 text-[15px] font-bold text-ink active:scale-[.99]">
            Not relevant
          </button>
        </div>
      )}
    </article>
  );
}

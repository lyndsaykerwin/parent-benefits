import { useEffect, useState } from 'react';
import { Link, useParams, useSearch } from 'wouter';
import AppShell from '@/components/AppShell';
import FeedCardView from '@/components/FeedCardView';
import { PLAID_TILE, safeSources, agentLabel, api, familyChip, loadRun, saveRun, traceForCard, type SavedRun, type TraceLine } from '@/lib/bundle';
import { ZetarisSection, MemorySection } from '@/components/HowWeCheckedSections';
import { cn } from '@/lib/utils';

const STATUS_TEXT: Record<TraceLine['status'], { label: string; cls: string }> = {
  ok: { label: 'Passed', cls: 'bg-[#E3F3EA] text-[#17643F]' },
  retry: { label: 'Sent back', cls: 'bg-coral-tint text-coral-deep' },
  blocked: { label: 'Blocked', cls: 'bg-[#FBE3E0] text-[#9E2A21]' },
  fallback: { label: 'Backup used', cls: 'bg-[#F1ECE4] text-ink-2' },
  error: { label: 'Error', cls: 'bg-[#FBE3E0] text-[#9E2A21]' },
};

/** Plain-English headline for one step of the audit trail. */
function stepTitle(l: TraceLine): string {
  const who = agentLabel(l.agent_name);
  if (l.agent_name === 'fact_checker') return l.status === 'ok' ? 'Fact-Checker re-checked the source' : 'Fact-Checker sent it back';
  if (l.action === 'explain') return `${who} wrote the explanation`;
  if (l.action === 'argue') return `${who} made its case`;
  if (l.agent_name === 'judge') return 'The Judge ruled';
  return `${who} found it`;
}

const sentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function stepDetail(l: TraceLine): string {
  if (l.status === 'fallback' && /model unavailable|no model answer/i.test(l.output_summary)) {
    return 'The AI was offline, so this step used the rule-based backup check instead.';
  }
  if (l.agent_name === 'fact_checker') return l.status === 'ok' ? 'Amount, dates and source all match the official data.' : l.output_summary;
  if (l.action === 'explain') return l.status === 'fallback' ? 'Written from a fixed template (the AI writer was not used).' : 'Written by the AI, from the checked facts only.';
  return sentence(l.output_summary.replace(/^(approve|reject):\s*/i, (_m, v: string) => `${v === 'approve' ? 'Approved' : 'Rejected'}. `));
}

export default function CardDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const search = new URLSearchParams(useSearch());
  const runParam = search.get('run');
  const [run, setRun] = useState<SavedRun | null>(() => loadRun(runParam));
  const [looking, setLooking] = useState(() => !loadRun(runParam) && !!runParam);
  // Opened from a link in a new tab: fetch the finished run from the server instead of this tab's memory.
  useEffect(() => {
    if (!looking || !runParam) return;
    api.run(runParam)
      .then((st) => {
        if (st.status === 'done' && st.result) {
          const saved: SavedRun = { runId: st.runId, familyId: st.familyId, family: st.family, today: st.today, result: st.result };
          saveRun(saved);
          setRun(saved);
        }
      })
      .catch(() => {})
      .finally(() => setLooking(false));
  }, [looking, runParam]);
  const card = id === PLAID_TILE.id ? PLAID_TILE : run?.result.cards.find((c) => c.id === id) ?? null;
  const [lines, setLines] = useState<TraceLine[] | null>(null);
  const [traceError, setTraceError] = useState(false);
  const [sent, setSent] = useState<'got_it' | 'issue' | null>(null);
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!run) return;
    api.trace(run.runId).then(setLines).catch(() => setTraceError(true));
  }, [run?.runId]);

  const feedHref = run ? `/feed/${encodeURIComponent(run.runId)}` : '/';
  const chip = familyChip(run?.family, run?.today);

  if (looking) {
    return <AppShell back={{ href: feedHref, label: 'Back' }}><p className="mt-6 text-[16px] text-ink-2">Loading this card…</p></AppShell>;
  }

  if (!run || !card) {
    return (
      <AppShell back={{ href: feedHref, label: 'Back' }}>
        <h1 className="mt-4 text-[26px] font-extrabold">We couldn’t find that card.</h1>
        <p className="mt-2 text-[16px] text-ink-2">It may be from an older run. Start a new one to see fresh results.</p>
        <Link href="/" className="mt-6 flex min-h-[56px] items-center justify-center rounded-2xl bg-ink text-[17px] font-bold text-cream">Start again</Link>
      </AppShell>
    );
  }

  // rule_recalled lines are shown in the Memory section below, not as a raw step.
  const steps = lines ? traceForCard(card, lines).filter((l) => l.action !== 'rule_recalled') : [];

  async function send(kind: 'got_it' | 'issue') {
    setBusy(true);
    setError(null);
    try {
      await api.feedback({ familyId: run!.familyId, cardId: card!.id, kind, note: kind === 'issue' ? note.trim() : undefined });
      setSent(kind);
      setReporting(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell chip={chip} back={{ href: feedHref, label: 'Your feed' }}>
      <div className="mt-1">
        <FeedCardView card={card} today={run.today} />
      </div>

      <section className="mt-7" aria-labelledby="how-title">
        <h2 id="how-title" className="text-[22px] font-extrabold tracking-[-0.02em]">How we checked</h2>
        <p className="mt-1 text-[15px] text-ink-2">Every step our agents took for this card, straight from the run’s audit log.</p>

        {lines === null && !traceError && <p className="mt-4 text-[15px] text-ink-2">Loading the audit log…</p>}
        {traceError && <p className="mt-4 text-[15px] text-ink-2">The audit log for this run is no longer available on the server.</p>}
        {lines !== null && steps.length === 0 && (
          <p className="mt-4 rounded-2xl bg-paper px-4 py-3 text-[15px] text-ink-2">
            {card.traceId === 'fallback'
              ? 'A live source did not answer, so this card comes from our saved copy of the official page. It is not yet verified and is not counted in your totals.'
              : card.kind === 'coming_soon'
                ? 'This is a preview of a feature we are still building.'
                : 'No agent steps were recorded for this card.'}
          </p>
        )}

        {steps.length > 0 && (
          <ol className="relative mt-4 space-y-3 border-l-2 border-line pl-5" data-testid="trace-steps">
            {steps.map((l) => {
              const st = STATUS_TEXT[l.status];
              return (
                <li key={l.trace_id} className="relative">
                  <span aria-hidden="true" className={cn('absolute -left-[27px] top-4 h-3 w-3 rounded-full border-2 border-cream', l.status === 'ok' ? 'bg-kind-clawback' : l.status === 'fallback' ? 'bg-ink-3' : 'bg-coral')} />
                  <div className="rounded-2xl border border-line bg-paper p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[15px] font-bold leading-snug text-ink">{stepTitle(l)}</p>
                      <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold', st.cls)}>{st.label}</span>
                    </div>
                    <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{stepDetail(l)}</p>
                    <p className="mt-2 break-words font-mono text-[11.5px] leading-relaxed text-ink-2">
                      {l.agent_name}.{l.action} · {new Date(l.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                      {l.retry_count > 0 ? ` · retry ${l.retry_count}` : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {lines !== null && <ZetarisSection card={card} lines={lines} />}
        {lines !== null && <MemorySection card={card} lines={lines} />}

        {safeSources(card.sources).length > 0 && (
          <>
            <h3 className="eyebrow mt-6 text-ink-2">Sources</h3>
            <ul className="mt-2 space-y-2">
              {safeSources(card.sources).map((s) => (
                <li key={s.url + s.label}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="flex min-h-[52px] items-center justify-between gap-3 rounded-2xl border border-line bg-paper px-4 py-3 text-[15px] font-semibold text-ink hover:border-ink-3">
                    <span className="min-w-0">
                      <span className="block">{s.label}</span>
                      <span className="block truncate text-[13px] font-medium text-ink-2">{s.url.replace(/^https?:\/\//, '')}</span>
                    </span>
                    <span aria-hidden="true" className="text-ink-2">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {card.kind !== 'coming_soon' && (
        <section className="mt-8" aria-label="Your feedback">
          {sent ? (
            <p role="status" className="rounded-2xl bg-[#E3F3EA] px-4 py-4 text-[15px] font-semibold text-[#17643F]">
              {sent === 'got_it'
                ? 'Nice. We’ve marked this one as done for you.'
                : 'Thanks. Reports like yours teach Bundle: when parents report the same problem, it proposes a new rule for a reviewer to approve.'}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" disabled={busy} onClick={() => send('got_it')} className="min-h-[56px] rounded-2xl bg-ink text-[17px] font-bold text-cream disabled:opacity-60">
                  I got this
                </button>
                <button
                  type="button" disabled={busy} aria-expanded={reporting} onClick={() => setReporting((r) => !r)}
                  className={cn('min-h-[56px] rounded-2xl border-2 text-[17px] font-bold disabled:opacity-60', reporting ? 'border-coral bg-coral-tint text-coral-deep' : 'border-ink bg-transparent text-ink')}
                >
                  Report issue
                </button>
              </div>
              {reporting && (
                <form className="mt-3 rounded-2xl border border-line bg-paper p-4" onSubmit={(e) => { e.preventDefault(); void send('issue'); }}>
                  <label htmlFor="issue-note" className="text-[15px] font-bold text-ink">What went wrong?</label>
                  <textarea
                    id="issue-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3}
                    placeholder="For example: it said free, but charged me after 30 days."
                    className="mt-2 block w-full rounded-xl border border-line bg-cream p-3 text-[16px] text-ink outline-none placeholder:text-ink-2 focus:border-coral"
                  />
                  <button type="submit" disabled={busy || !note.trim()} className="mt-3 min-h-[52px] w-full rounded-2xl bg-coral-deep text-[17px] font-bold text-white disabled:opacity-50">
                    {busy ? 'Sending…' : 'Send report'}
                  </button>
                </form>
              )}
              {error && <p role="alert" className="mt-3 text-[15px] font-semibold text-[#9E2A21]">{error}</p>}
            </>
          )}
        </section>
      )}
    </AppShell>
  );
}

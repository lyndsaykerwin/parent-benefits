import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'wouter';
import AppShell from '@/components/AppShell';
import VersionB from '@/pages/tabs/VersionB';
import AgentWorkspace from '@/pages/AgentWorkspace';
import FeedCardView from '@/components/FeedCardView';
import { api, describeLine, familyChip, fmtUsdShort, loadRun, saveRun, type SavedRun, type TraceLine } from '@/lib/bundle';
import { checkLines, type CheckLine } from '@/lib/checking';
import { followRun, emptyStream, pillLines, sanitizeCard, sortCards, stepsFromStream, type StreamState } from '@/lib/stream';
import type { FeedCard } from '@shared/bundle';
import { ownerApi, ownerToken } from '@/lib/howWeChecked';
import { cn } from '@/lib/utils';

const POLL_MS = 1000;

/** The five steps a run goes through, and the trace line that marks each one finished. */
const STEPS: { agent: string; label: string; doneWhen: (lines: TraceLine[]) => boolean; startedWhen: (lines: TraceLine[]) => boolean }[] = [
  { agent: 'clawback', label: 'Clawback Finder: money you can get back', startedWhen: (l) => l.some((x) => x.agent_name === 'clawback'), doneWhen: (l) => l.some((x) => x.action === 'find_clawbacks') },
  { agent: 'recall', label: 'Recall Checker: your items vs. official recalls', startedWhen: (l) => l.some((x) => x.agent_name === 'recall'), doneWhen: (l) => l.some((x) => x.action === 'check_recalls') },
  { agent: 'benefits', label: 'Benefits Planner: programs and deadlines', startedWhen: (l) => l.some((x) => x.agent_name === 'benefits'), doneWhen: (l) => l.some((x) => x.action === 'plan_benefits') },
  { agent: 'court', label: 'Fine Print Court: deals with hidden catches', startedWhen: (l) => l.some((x) => x.agent_name === 'fine_print_court'), doneWhen: (l) => l.some((x) => x.agent_name === 'fact_checker') },
  { agent: 'fact_checker', label: 'Fact-Checker: every card checked against its source', startedWhen: (l) => l.some((x) => x.agent_name === 'fact_checker'), doneWhen: (l) => l.some((x) => x.action === 'assemble') },
];

function Spinner({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('inline-block h-4 w-4 animate-spin rounded-full border-2 border-coral border-t-transparent', className)} />;
}

const STATE_TEXT = { waiting: 'Waiting', working: 'Working', done: 'Done' } as const;

function StepIcon({ state }: { state: 'waiting' | 'working' | 'done' }) {
  return <><span className="sr-only">{STATE_TEXT[state]}: </span><StepGlyph state={state} /></>;
}

function StepGlyph({ state }: { state: 'waiting' | 'working' | 'done' }) {
  if (state === 'done') {
    return (
      <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-kind-clawback text-white">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
      </span>
    );
  }
  if (state === 'working') return <span className="flex h-6 w-6 shrink-0 items-center justify-center"><Spinner /></span>;
  return <span aria-hidden="true" className="h-6 w-6 shrink-0 rounded-full border-2 border-line" />;
}

/** Collapse repeats ("Fact-Checker confirmed a benefit card" ×4) so the live list stays short. */
function collapse(lines: TraceLine[]): { text: string; count: number; status: TraceLine['status']; key: string }[] {
  const out: { text: string; count: number; status: TraceLine['status']; key: string }[] = [];
  for (const l of lines) {
    const text = describeLine(l);
    const last = out[out.length - 1];
    if (last && last.text === text) last.count++;
    else out.push({ text, count: 1, status: l.status, key: l.trace_id });
  }
  return out;
}

/** Short status pills from the live stream, in parent words. */
function StatusPills({ stream }: { stream: StreamState }) {
  const pills = pillLines(stream);
  if (pills.length === 0) return null;
  return (
    <ul className="mt-4 flex flex-wrap gap-2" data-testid="status-pills" aria-live="polite">
      {pills.map((p) => (
        <li key={p.key} className={cn('rounded-full border px-3 py-1 text-[13px] font-semibold', p.state === 'done' ? 'border-line bg-paper text-ink-2' : p.state === 'failed' ? 'border-kind-recall text-kind-recall' : 'border-coral text-ink')}>{p.text}</li>
      ))}
    </ul>
  );
}

/** Cards to show the owner while the check runs: the last saved results, with each fresh card replacing its saved copy. */
export function liveCards(saved: FeedCard[], stream: StreamState): FeedCard[] {
  const fresh = new Set(stream.cards.map((c) => c.id));
  const gone = new Set(stream.removed);
  return sortCards([...saved.filter((c) => !fresh.has(c.id) && !gone.has(c.id)), ...stream.cards]);
}

function LiveCards({ cards, today, fromSaved }: { cards: FeedCard[]; today?: string; fromSaved: boolean }) {
  if (cards.length === 0) return null;
  return (
    <section className="mt-6" data-testid="live-cards">
      {fromSaved && <p data-testid="saved-feed-note" className="text-[14px] text-ink-2">From your last check. We’re updating these now, and new cards will appear as they’re ready.</p>}
      <div className="mt-3 space-y-3">
        {cards.map((c) => <FeedCardView key={c.id} card={c} today={today} />)}
      </div>
    </section>
  );
}

/**
 * What the parent's checklist line shows right now, from the run's real progress (stepsFromStream), never from a timer.
 * The four main checks run at the same time, so a line with no news yet is "working". The last line ("double-checked")
 * is a promise the run has really kept: it only shows done once the run has finished.
 */
export function lineState(line: CheckLine, stream: StreamState, finished: boolean): 'waiting' | 'working' | 'done' {
  if (finished) return 'done';
  const step = stepsFromStream(stream).find((s) => s.key === line.step)?.state ?? 'waiting';
  if (line.final) return step === 'waiting' ? 'waiting' : 'working';
  return step === 'waiting' ? 'working' : step;
}

/** Cards that count toward "We found $X": the same rule as the final receipt (checked money back and benefits only). */
const counts = (c: FeedCard) => (c.kind === 'clawback' || c.kind === 'benefit') && (c.verdict === 'verified' || c.verdict === 'likely');

/** "3 things found so far · about $1,240", from the parent-safe cards that have arrived (taken-back cards drop out). */
export function foundSoFar(stream: StreamState): string | null {
  const n = stream.cards.length;
  if (n === 0) return null;
  const cents = stream.cards.filter(counts).reduce((a, c) => a + (c.amountCents ?? 0), 0);
  return `${n} ${n === 1 ? 'thing' : 'things'} found so far${cents > 0 ? ` · about ${fmtUsdShort(cents)}` : ''}`;
}

/**
 * The parent's "Checking" screen. The lines come from the family's own answers and are all on screen from the start, so
 * nothing jumps; each one ticks off when the helpers doing that check report they are done. A short line counts what has
 * been found so far (the cards themselves stay hidden until the end: no flicker of half-ready cards).
 * The "We found $X" card appears only once the run has really finished, and nothing moves on by itself: the results open
 * when the parent taps "View my results".
 */
function ParentProgress({ lines, ready, finished, stream, totalCents, onReveal }: {
  lines: CheckLine[]; ready: boolean; finished: boolean; stream: StreamState; totalCents: number | null; onReveal: () => void;
}) {
  const revealed = finished && totalCents !== null;
  const found = foundSoFar(stream);
  return (
    <section aria-live="polite">
      <h1 className="mt-6 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em]">
        {revealed ? <>All <span className="text-coral">checked.</span></> : <>We’re checking <span className="text-coral">for you.</span></>}
      </h1>
      {!revealed && (
        <p className="mt-2 text-[16px] text-ink-2">
          We are checking government, recall and store information for your family. This is often quick, and can sometimes take a minute or two.
        </p>
      )}
      <ol className="bundle-card mt-5 space-y-3.5 p-5" data-testid="parent-steps">
        {!ready ? <li className="flex items-center gap-3 text-[15px] text-ink-2"><Spinner /> Getting started…</li> : lines.map((l) => {
          const state = lineState(l, stream, finished);
          return (
            <li key={l.key} className="flex items-start gap-3" data-state={state}>
              <StepIcon state={state} />
              <span className="flex flex-col">
                <span className={cn('text-[15px] font-semibold leading-snug', state === 'waiting' ? 'text-ink-2' : 'text-ink')}>{l.title}</span>
                <span className="text-[13px] leading-snug text-ink-2">{l.caption}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {!revealed && ready && (
        <p className="tabular mt-3 min-h-[20px] text-[14px] font-semibold text-ink-2" data-testid="found-so-far">{found ?? 'Looking…'}</p>
      )}
      {!ready && <StatusPills stream={stream} />}
      {revealed ? (
        <div className="mt-5 rounded-3xl bg-ink p-5 text-cream" data-testid="checking-reveal">
          <p className="sr-only">We found {fmtUsdShort(totalCents)} for your family.</p>
          <div aria-hidden="true">
            <p className="text-[20px] font-extrabold">We found</p>
            <p className="tabular text-[52px] font-extrabold leading-none tracking-[-0.03em]">{fmtUsdShort(totalCents)}</p>
            <p className="mt-1 text-[20px] font-extrabold">for your family.</p>
          </div>
          <button type="button" onClick={onReveal} className="mt-4 flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-coral px-4 text-[17px] font-bold text-white transition active:scale-[.99]">
            View my results <span aria-hidden="true" className="ml-1">→</span>
          </button>
        </div>
      ) : null}
    </section>
  );
}

/** The owner's "Checking" screen: agent steps and live activity from the trace (reviewer code only). */
function Progress({ lines, stream }: { lines: TraceLine[]; stream: StreamState }) {
  const recent = collapse(lines).slice(-6).reverse(); // newest first, so it shows above the fold
  return (
    <section aria-live="polite">
      <h1 className="mt-6 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em]">
        Your agents are <span className="text-coral">on it.</span>
      </h1>
      <p className="mt-2 text-[16px] text-ink-2">
        They are checking government, recall and store data for your family. This is often quick, and can sometimes take a minute or two.
      </p>

      <ol className="bundle-card mt-5 space-y-3 p-5">
        {STEPS.map((s) => {
          const state = s.doneWhen(lines) ? 'done' : s.startedWhen(lines) ? 'working' : 'waiting';
          return (
            <li key={s.agent} className="flex items-center gap-3">
              <StepIcon state={state} />
              <span className={cn('text-[15px] leading-snug', state === 'waiting' ? 'text-ink-2' : 'font-semibold text-ink')}>{s.label}</span>
            </li>
          );
        })}
      </ol>

      <StatusPills stream={stream} />
      <h2 className="eyebrow mt-5 text-ink-2">Live activity</h2>
      <ul className="mt-2 space-y-2" data-testid="progress-lines">
        {recent.length === 0 && (
          <li className="flex items-center gap-2 rounded-2xl bg-paper px-4 py-3 text-[14px] text-ink-2"><Spinner /> Waking up the agents…</li>
        )}
        {recent.map((r) => (
          <li key={r.key} className="flex items-start gap-2 rounded-2xl border border-line bg-paper px-4 py-3 text-[14px] leading-snug text-ink">
            <span aria-hidden="true" className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', r.status === 'ok' ? 'bg-kind-clawback' : r.status === 'blocked' || r.status === 'error' ? 'bg-kind-recall' : 'bg-coral')} />
            <span>{r.text}{r.count > 1 && <span className="font-bold text-ink-2"> ×{r.count}</span>}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Feed() {
  const { runId = '' } = useParams<{ runId: string }>();
  const [run, setRun] = useState<SavedRun | null>(() => loadRun(runId)?.runId === runId ? loadRun(runId) : null);
  const [traceLines, setLines] = useState<TraceLine[]>([]);
  const owner = !!ownerToken();
  const [chipInfo, setChipInfo] = useState<{ family?: SavedRun['family']; today?: string; demoDate?: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<StreamState>(emptyStream);
  const [saved, setSaved] = useState<FeedCard[]>([]);
  /** The finished run, held back until the parent taps "View my results" (the owner view opens it straight away). */
  const [finished, setFinished] = useState<SavedRun | null>(null);
  const askedSaved = useRef(false);

  // Instant feed: one quick look at the run tells us the family, so its saved results show before any stream message arrives.
  useEffect(() => {
    if (run) return;
    let live = true;
    ownerApi().run(runId).then((status) => {
      if (!live || askedSaved.current || !status.familyId) return;
      askedSaved.current = true;
      setChipInfo((c) => c.family ? c : { family: status.family, today: status.today, demoDate: status.demoDate });
      // The last saved results are shown to the owner only. A parent sees just the checklist, then "We found $X" (no flicker of old cards).
      if (!ownerToken()) return;
      api.latestRun(status.familyId).then((s) => {
        if (live && s.status === 'done' && s.result && s.result.runId !== runId) {
          setSaved(s.result.cards.map((c) => sanitizeCard(c)).filter((c): c is FeedCard => !!c && c.verdict !== 'blocked'));
        }
      }).catch(() => { /* no saved run (or the server restarted): the normal checking screen is fine */ });
    }).catch(() => { /* the follower below reports real problems */ });
    return () => { live = false; };
  }, [runId, run]);

  useEffect(() => {
    if (run || finished) return; // already finished (or restored from this tab)
    return followRun(runId, ownerApi(), {
      onStream: setStream,
      onStatus: (status, trace) => {
        if (trace) setLines(trace);
        setChipInfo({ family: status.family, today: status.today, demoDate: status.demoDate });
      },
      onDone: (status) => {
        const saved: SavedRun = { runId, familyId: status.familyId, family: status.family, today: status.today, demoDate: status.demoDate, result: status.result! };
        if (ownerToken()) { saveRun(saved); setRun(saved); } else setFinished(saved);
      },
      onFailed: setError,
      onGiveUp: (kind) => setError(kind === 'expired'
        ? 'This run has expired. Start a new one; it only takes a minute.'
        : 'We lost touch with Bundle. Check your connection and try again.'),
    }, { intervalMs: POLL_MS });
  }, [runId, run, finished]);

  const family = run?.family ?? finished?.family ?? chipInfo.family;
  const today = run?.today ?? chipInfo.today;
  const chip = familyChip(family, today, run?.familyId ?? finished?.familyId);

  // The checking lines: built from the family's answers; each one ticks off from the run's real progress.
  const familyKey = JSON.stringify(family ?? null);
  const lines = useMemo(() => checkLines(family), [familyKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const ready = !!family || !!finished;
  const total = finished ? finished.result.receipt.moneyBackCents + finished.result.receipt.likelyBenefitsCents : null;
  const reveal = () => { if (finished) { saveRun(finished); setRun(finished); } };

  // The finished run's full audit log (owner only); only needed for the "We caught these" detail.
  const [doneLines, setDoneLines] = useState<TraceLine[]>([]);
  useEffect(() => {
    if (owner && run?.result.blocked?.length) ownerApi().trace(run.runId).then((l) => setDoneLines(Array.isArray(l) ? l : [])).catch(() => {});
  }, [run?.runId, owner]);

  if (error) {
    return (
      <AppShell chip={chip}>
        <h1 className="mt-6 text-[28px] font-extrabold leading-tight tracking-[-0.02em]">That didn’t work.</h1>
        <p role="alert" className="mt-2 text-[16px] text-ink-2">{error}</p>
        <Link href="/" className="mt-6 flex min-h-[56px] items-center justify-center rounded-2xl bg-ink text-[17px] font-bold text-cream">Start again</Link>
      </AppShell>
    );
  }

  if (!run) {
    const cards = liveCards(saved, stream);
    return (
      <AppShell chip={chip}>
        {owner
          ? <Progress lines={traceLines} stream={stream} />
          : <ParentProgress lines={lines} ready={ready} finished={!!finished} stream={stream} totalCents={total} onReveal={reveal} />}
        {owner && <LiveCards cards={cards} today={today} fromSaved={saved.length > 0 && stream.cards.length === 0} />}
      </AppShell>
    );
  }

  // The finished run opens as Version B: five tabs, starting on Home. The tabs read everything from the run's own result.
  return (
    <VersionB
      run={run}
      owner={owner}
      lines={doneLines}
      ownerPanel={<AgentWorkspace runId={runId} cards={[...run.result.cards, ...(run.result.blocked ?? [])].map((c) => ({ id: c.id, title: c.title }))} />}
    />
  );
}

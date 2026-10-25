import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'wouter';
import AppShell from '@/components/AppShell';
import VersionB from '@/pages/tabs/VersionB';
import AgentWorkspace from '@/pages/AgentWorkspace';
import FeedCardView from '@/components/FeedCardView';
import { api, describeLine, familyChip, loadRun, saveRun, type SavedRun, type TraceLine } from '@/lib/bundle';
import { followRun, emptyStream, pillLines, stepsFromStream, sanitizeCard, sortCards, type StreamState } from '@/lib/stream';
import type { FeedCard } from '@shared/bundle';
import { ownerApi, ownerToken, type OwnerRunStatus, type ParentStep } from '@/lib/howWeChecked';
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

/** Cards to show while the check runs: the last saved results, with each fresh card replacing its saved copy. */
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

/** The parent's "Checking" screen: only the server's parent-safe step wording, no agent activity. */
function ParentProgress({ steps, elapsed, stream }: { steps: ParentStep[]; elapsed: number; stream: StreamState }) {
  return (
    <section aria-live="polite">
      <h1 className="mt-6 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em]">
        We’re checking <span className="text-coral">for you.</span>
      </h1>
      <p className="mt-2 text-[16px] text-ink-2">
        We are checking government, recall and store information for your family. This is often quick, and can sometimes take a minute or two.
      </p>
      <ol className="bundle-card mt-5 space-y-3 p-5" data-testid="parent-steps">
        {steps.length === 0 && <li className="flex items-center gap-3 text-[15px] text-ink-2"><Spinner /> Getting started…</li>}
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-3">
            <StepIcon state={s.state} />
            <span className={cn('text-[15px] leading-snug', s.state === 'waiting' ? 'text-ink-2' : 'font-semibold text-ink')}>{s.label}</span>
          </li>
        ))}
      </ol>
      {steps.length === 0 && <StatusPills stream={stream} />}
      <p className="tabular mt-4 text-right text-[13px] font-semibold text-ink-2">{elapsed}s</p>
    </section>
  );
}

/** The owner's "Checking" screen: agent steps and live activity from the trace (reviewer code only). */
function Progress({ lines, elapsed, stream }: { lines: TraceLine[]; elapsed: number; stream: StreamState }) {
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
      <div className="mt-5 flex items-center justify-between">
        <h2 className="eyebrow text-ink-2">Live activity</h2>
        <span className="tabular text-[13px] font-semibold text-ink-2">{elapsed}s</span>
      </div>
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
  const [lines, setLines] = useState<TraceLine[]>([]);
  const [steps, setSteps] = useState<ParentStep[]>([]);
  const owner = !!ownerToken();
  const [chipInfo, setChipInfo] = useState<{ family?: SavedRun['family']; today?: string; demoDate?: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(Date.now());
  const [stream, setStream] = useState<StreamState>(emptyStream);
  const [saved, setSaved] = useState<FeedCard[]>([]);
  const askedSaved = useRef(false);

  // Keep the "Ns" counter moving while the stream is quiet.
  const startedAtMs = useRef<number | null>(null);
  useEffect(() => {
    if (run) return;
    const t = setInterval(() => setElapsed(Math.max(0, Math.round((Date.now() - (startedAtMs.current ?? started.current)) / 1000))), 1000);
    return () => clearInterval(t);
  }, [run]);

  // Instant feed: one quick look at the run tells us the family, so its saved results show before any stream message arrives.
  useEffect(() => {
    if (run) return;
    let live = true;
    ownerApi().run(runId).then((status) => {
      const t = Date.parse(status.startedAt || '');
      if (live && Number.isFinite(t)) startedAtMs.current = t;
      if (!live || askedSaved.current || !status.familyId) return;
      askedSaved.current = true;
      setChipInfo((c) => c.family ? c : { family: status.family, today: status.today, demoDate: status.demoDate });
      api.latestRun(status.familyId).then((s) => {
        if (live && s.status === 'done' && s.result && s.result.runId !== runId) {
          setSaved(s.result.cards.map((c) => sanitizeCard(c)).filter((c): c is FeedCard => !!c && c.verdict !== 'blocked'));
        }
      }).catch(() => { /* no saved run (or the server restarted): the normal checking screen is fine */ });
    }).catch(() => { /* the follower below reports real problems */ });
    return () => { live = false; };
  }, [runId, run]);

  useEffect(() => {
    if (run) return; // already finished (or restored from this tab)
    return followRun(runId, ownerApi(), {
      onStream: setStream,
      onStatus: (status, trace) => {
        if (trace) setLines(trace);
        setSteps((status as OwnerRunStatus).progress ?? []);
        setChipInfo({ family: status.family, today: status.today, demoDate: status.demoDate });
        const t = Date.parse(status.startedAt || '');
        if (Number.isFinite(t)) startedAtMs.current = t;
        setElapsed(Math.round((Date.now() - (startedAtMs.current ?? started.current)) / 1000));
      },
      onDone: (status) => {
        const saved: SavedRun = { runId, familyId: status.familyId, family: status.family, today: status.today, demoDate: status.demoDate, result: status.result! };
        saveRun(saved);
        setRun(saved);
      },
      onFailed: setError,
      onGiveUp: (kind) => setError(kind === 'expired'
        ? 'This run has expired. Start a new one; it only takes a minute.'
        : 'We lost touch with Bundle. Check your connection and try again.'),
    }, { intervalMs: POLL_MS });
  }, [runId, run]);

  const family = run?.family ?? chipInfo.family;
  const today = run?.today ?? chipInfo.today;
  const chip = familyChip(family, today);

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
        {owner ? <Progress lines={lines} elapsed={elapsed} stream={stream} /> : <ParentProgress steps={stream.order.length ? stepsFromStream(stream) : steps} elapsed={elapsed} stream={stream} />}
        <LiveCards cards={cards} today={today} fromSaved={saved.length > 0 && stream.cards.length === 0} />
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

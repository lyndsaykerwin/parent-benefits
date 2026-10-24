import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'wouter';
import AppShell from '@/components/AppShell';
import ReceiptCard from '@/components/ReceiptCard';
import FeedCardView from '@/components/FeedCardView';
import { CaughtForYou } from '@/components/HowWeCheckedSections';
import { KIND_META, UNCHECKED_DEALS_SECTION, api, demoDateLabel, describeLine, familyChip, groupCards, loadRun, saveRun, type SavedRun, type TraceLine } from '@/lib/bundle';
import { pollRun } from '@/lib/poll';
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

/** The parent's "Checking" screen: only the server's parent-safe step wording, no agent activity. */
function ParentProgress({ steps, elapsed }: { steps: ParentStep[]; elapsed: number }) {
  return (
    <section aria-live="polite">
      <h1 className="mt-6 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em]">
        We’re checking <span className="text-coral">for you.</span>
      </h1>
      <p className="mt-2 text-[16px] text-ink-2">
        We are checking live government, recall and store information for your family. This can take a minute or two.
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
      <p className="tabular mt-4 text-right text-[13px] font-semibold text-ink-2">{elapsed}s</p>
    </section>
  );
}

/** The owner's "Checking" screen: agent steps and live activity from the trace (reviewer code only). */
function Progress({ lines, elapsed }: { lines: TraceLine[]; elapsed: number }) {
  const recent = collapse(lines).slice(-6).reverse(); // newest first, so it shows above the fold
  return (
    <section aria-live="polite">
      <h1 className="mt-6 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em]">
        Your agents are <span className="text-coral">on it.</span>
      </h1>
      <p className="mt-2 text-[16px] text-ink-2">
        They are checking live government, recall and store data for your family. This can take a minute or two.
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

  useEffect(() => {
    if (run) return; // already finished (or restored from this tab)
    return pollRun(runId, ownerApi(), {
      onStatus: (status, trace) => {
        if (trace) setLines(trace);
        setSteps((status as OwnerRunStatus).progress ?? []);
        setChipInfo({ family: status.family, today: status.today, demoDate: status.demoDate });
        setElapsed(Math.round((Date.now() - Date.parse(status.startedAt || new Date(started.current).toISOString())) / 1000));
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
    }, POLL_MS);
  }, [runId, run]);

  const family = run?.family ?? chipInfo.family;
  const today = run?.today ?? chipInfo.today;
  const chip = familyChip(family, today);
  const demoLabel = demoDateLabel(run?.demoDate ?? chipInfo.demoDate, today);

  // The finished run's full audit log (owner only); only needed for the "We caught these" detail.
  const [doneLines, setDoneLines] = useState<TraceLine[]>([]);
  useEffect(() => {
    if (owner && run?.result.blocked?.length) ownerApi().trace(run.runId).then(setDoneLines).catch(() => {});
  }, [run?.runId, owner]);

  const grouped = useMemo(() => (run ? groupCards(run.result.cards) : null), [run]);

  if (error) {
    return (
      <AppShell chip={chip}>
        <h1 className="mt-6 text-[28px] font-extrabold leading-tight tracking-[-0.02em]">That didn’t work.</h1>
        <p role="alert" className="mt-2 text-[16px] text-ink-2">{error}</p>
        <Link href="/" className="mt-6 flex min-h-[56px] items-center justify-center rounded-2xl bg-ink text-[17px] font-bold text-cream">Start again</Link>
      </AppShell>
    );
  }

  if (!run || !grouped) {
    return <AppShell chip={chip}>{owner ? <Progress lines={lines} elapsed={elapsed} /> : <ParentProgress steps={steps} elapsed={elapsed} />}</AppShell>;
  }

  const { result } = run;
  const recallCount = result.cards.filter((c) => c.kind === 'recall' && c.verdict === 'verified').length;
  const href = (id: string) => `/card/${encodeURIComponent(id)}?run=${encodeURIComponent(runId)}`;

  return (
    <AppShell chip={chip}>
      {demoLabel && <p data-testid="demo-date" className="mt-3 text-[13px] font-semibold text-ink-2">{demoLabel}. Sample families are checked as of this date so the demo stays the same.</p>}
      <ReceiptCard receipt={result.receipt} recallCount={recallCount} today={today} />

      {result.banner && (
        <p role="status" className="mt-4 rounded-2xl border border-[#F5C4B0] bg-coral-tint px-4 py-3 text-[15px] font-semibold text-coral-deep">
          {result.banner}
        </p>
      )}

      {grouped.pinned && (
        <section className="mt-6" aria-label="Pinned">
          <FeedCardView card={grouped.pinned} pinned today={today} detailHref={href(grouped.pinned.id)} />
        </section>
      )}

      {grouped.groups.map((g) => (
        <section key={g.unchecked ? `${g.kind}-unchecked` : g.kind} className="mt-7" aria-labelledby={`sec-${g.kind}${g.unchecked ? '-unchecked' : ''}`}>
          <h2 id={`sec-${g.kind}${g.unchecked ? '-unchecked' : ''}`} className="eyebrow text-ink-2">{g.unchecked ? UNCHECKED_DEALS_SECTION : KIND_META[g.kind].section}</h2>
          <div className={cn('mt-2', g.kind === 'coming_soon' ? 'grid gap-2' : 'space-y-3')}>
            {g.cards.map((c) => (
              <FeedCardView key={c.id} card={c} today={today} detailHref={href(c.id)} />
            ))}
          </div>
        </section>
      ))}

      <CaughtForYou blocked={result.blocked ?? []} lines={doneLines} href={href} />

      <Link
        href="/smarter"
        className="mt-8 flex min-h-[64px] items-center justify-between gap-3 rounded-3xl bg-ink px-5 py-4 text-cream"
      >
        <span>
          <span className="block text-[17px] font-bold">Bundle got smarter</span>
          <span className="block text-[14px] text-[#D9CFC4]">See what parents taught it, and how it scores</span>
        </span>
        <span aria-hidden="true" className="text-[22px]">›</span>
      </Link>

      <Link href="/" className="mt-3 flex min-h-[48px] items-center justify-center text-[15px] font-bold text-ink-2 underline decoration-line decoration-2 underline-offset-4">
        Start over with your own details
      </Link>
    </AppShell>
  );
}

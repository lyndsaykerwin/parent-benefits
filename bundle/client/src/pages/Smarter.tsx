import { useCallback, useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { api, loadRun, reviewerToken, type Proposal, type Scoreboard } from '@/lib/bundle';
import { ownerApi } from '@/lib/howWeChecked';
import { cn } from '@/lib/utils';

function Confidence({ value, dark = false }: { value: number; dark?: boolean }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="mt-3 flex items-center gap-3">
      <div className={cn('h-2 flex-1 overflow-hidden rounded-full', dark ? 'bg-[#3A322C]' : 'bg-[#F1ECE4]')} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Confidence">
        <div className="h-full rounded-full bg-coral" style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('tabular shrink-0 whitespace-nowrap text-right text-[13px] font-bold', dark ? 'text-[#D9CFC4]' : 'text-ink-2')}>{pct}% confident</span>
    </div>
  );
}

const ruleId = (p: Proposal) => `CL-${String(p.id).padStart(2, '0')}`;
const reports = (p: Proposal) => `${p.sourceFeedbackIds.length} parent ${p.sourceFeedbackIds.length === 1 ? 'report' : 'reports'}`;

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      <p className={cn('tabular text-[28px] font-extrabold leading-none tracking-[-0.03em]', accent ? 'text-coral-deep' : 'text-ink')}>{value}</p>
      <p className="mt-1.5 text-[13px] font-semibold leading-snug text-ink-2">{label}</p>
    </div>
  );
}

export default function Smarter() {
  const [data, setData] = useState<{ proposals: Proposal[]; approved: Proposal[]; approvedCount?: number } | null>(null);
  const [board, setBoard] = useState<Scoreboard | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [token, setToken] = useState(reviewerToken.get());
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState<{ id: number; text: string; ok: boolean } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const last = loadRun();

  // Rule text, proposals and the scoreboard are owner-only: the server sends rule text only with the reviewer code.
  const refresh = useCallback(() => {
    const owner = ownerApi(token);
    owner.caseLaw().then(setData).catch((e) => setLoadError((e as Error).message));
    if (token) owner.scoreboard().then((r) => setBoard(r.scoreboard)).catch(() => setBoard(null));
  }, [token]);
  useEffect(refresh, [refresh]);

  async function approve(p: Proposal) {
    setBusyId(p.id);
    setMsg(null);
    try {
      await api.approve(p.id, token);
      setMsg({ id: p.id, text: `Approved. The Judge will cite ${ruleId(p)} from now on.`, ok: true });
      refresh();
    } catch (e) {
      setMsg({ id: p.id, text: (e as Error).message, ok: false });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell back={{ href: last ? `/feed/${encodeURIComponent(last.runId)}` : '/', label: last ? 'Your feed' : 'Home' }}>
      <h1 className="mt-2 text-[32px] font-extrabold leading-[1.08] tracking-[-0.03em]">
        Bundle got <span className="text-coral">smarter.</span>
      </h1>
      <p className="mt-2 text-[16px] text-ink-2">
        When parents report the same problem, Bundle’s Coach writes a rule. A reviewer approves it, and every future run follows it.
      </p>

      <ol className="mt-5 grid grid-cols-3 gap-2 text-center" aria-label="How Bundle learns">
        {['Parents tap “Report issue”', 'Coach proposes a rule', 'Judge cites it next run'].map((t, i) => (
          <li key={t} className="rounded-2xl border border-line bg-paper px-2 py-3">
            <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-coral-tint text-[13px] font-extrabold text-coral-deep">{i + 1}</span>
            <span className="mt-1.5 block text-[13px] font-semibold leading-snug text-ink">{t}</span>
          </li>
        ))}
      </ol>

      {loadError && <p role="alert" className="mt-5 rounded-2xl bg-[#FBE3E0] px-4 py-3 text-[15px] font-semibold text-[#9E2A21]">{loadError}</p>}

      {!token && data && (
        <p className="mt-8 rounded-2xl bg-paper px-4 py-3 text-[15px] text-ink-2" data-testid="parent-rules">
          {(data.approvedCount ?? 0) === 0
            ? 'Nothing new learned yet. Your reports help Bundle get better for every family.'
            : `Parents have taught Bundle ${data.approvedCount} ${data.approvedCount === 1 ? 'lesson' : 'lessons'} so far. Thank you for your reports.`}
        </p>
      )}

      {token && <>
      <section className="mt-8" aria-labelledby="approved-title">
        <h2 id="approved-title" className="eyebrow text-ink-2">Rules Bundle follows now</h2>
        {data && data.approved.length === 0 && (
          <p className="mt-2 rounded-2xl bg-paper px-4 py-3 text-[15px] text-ink-2">No approved rules yet. They appear here after a reviewer approves one.</p>
        )}
        <div className="mt-2 space-y-3">
          {data?.approved.map((p) => (
            <article key={p.id} className="rounded-3xl bg-ink p-5 text-cream">
              <p className="inline-block rounded-full bg-[#3A322C] px-3 py-1 text-[13px] font-bold text-[#F4A083]">Case law {ruleId(p)}</p>
              <p className="mt-3 font-mono text-[14px] leading-relaxed">{p.text}</p>
              <p className="mt-2 text-[13px] text-[#D9CFC4]">From {reports(p)} · approved by a reviewer</p>
              <Confidence value={p.confidence} dark />
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="proposed-title">
        <h2 id="proposed-title" className="eyebrow text-ink-2">Waiting for review</h2>
        {data && data.proposals.length === 0 && (
          <p className="mt-2 rounded-2xl bg-paper px-4 py-3 text-[15px] text-ink-2">Nothing to review. New rules appear when two or more parents report a similar problem.</p>
        )}
        <div className="mt-2 space-y-3">
          {data?.proposals.map((p) => (
            <article key={p.id} className="bundle-card p-5">
              <p className="inline-block rounded-full bg-[#F1ECE4] px-3 py-1 text-[13px] font-bold text-ink-2">Proposed {ruleId(p)}</p>
              <p className="mt-3 text-[16px] font-semibold leading-snug text-ink">{p.text}</p>
              <p className="mt-1 text-[13px] text-ink-2">From {reports(p)}</p>
              <Confidence value={p.confidence} />
              <button
                type="button" disabled={!token || busyId === p.id} onClick={() => approve(p)}
                className="mt-4 min-h-[52px] w-full rounded-2xl bg-ink text-[16px] font-bold text-cream disabled:opacity-40"
              >
                {busyId === p.id ? 'Approving…' : token ? 'Approve rule' : 'Approve (Reviewer mode only)'}
              </button>
              {!token && <p className="mt-2 text-center text-[13px] text-ink-2">Turn on Reviewer mode at the bottom of this page to approve.</p>}
              {msg?.id === p.id && (
                <p role="status" className={cn('mt-2 text-[14px] font-semibold', msg.ok ? 'text-[#17643F]' : 'text-[#9E2A21]')}>{msg.text}</p>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="score-title">
        <h2 id="score-title" className="eyebrow text-ink-2">Scoreboard</h2>
        {board === undefined && <p className="mt-2 text-[15px] text-ink-2">Loading…</p>}
        {board === null && (
          <p className="mt-2 rounded-2xl bg-paper px-4 py-3 text-[15px] text-ink-2">The scoreboard appears after the first evaluation run.</p>
        )}
        {board && (
          <>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Stat value={`${board.trapsCaught}/${board.trapsTotal}`} label="traps caught" accent />
              <Stat value={String(board.falseAlarms)} label="false alarms" />
              <Stat value={`${Math.round(board.sourcedPct)}%`} label="cards with a source" />
              <Stat value={String(board.runs)} label={board.stable ? 'runs, same answers each time' : 'runs (answers varied)'} />
            </div>
            {board.learning && (
              <div className="mt-3 rounded-2xl border border-line bg-paper p-4 text-[15px] leading-relaxed text-ink">
                <p><span className="font-bold">Run 1:</span> {board.learning.run1Approved ? 'the court approved the “free” trap offer.' : 'the court already rejected the trap offer.'}</p>
                <p><span className="font-bold">Run 2:</span> {board.learning.run2Blocked ? `blocked it${board.learning.citedRuleId ? `, citing ${board.learning.citedRuleId}` : ''}.` : 'not blocked yet.'}</p>
                {board.llm && <p className="mt-1 text-[13px] text-ink-2">Model: {board.llm}</p>}
              </div>
            )}
          </>
        )}
      </section>

      </>}

      <details className="mt-10 rounded-2xl border border-line bg-paper p-4" open={!!token}>
        <summary className="min-h-[28px] cursor-pointer text-[15px] font-bold text-ink">Reviewer mode</summary>
        <p className="mt-2 text-[14px] text-ink-2">For the demo reviewer only. The code stays in this browser tab and is cleared when you close it.</p>
        {token ? (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[15px] font-semibold text-[#17643F]">Reviewer mode is on</p>
            <button type="button" onClick={() => { reviewerToken.set(''); setToken(''); }} className="min-h-[44px] rounded-xl border border-line px-4 text-[15px] font-bold text-ink">Turn off</button>
          </div>
        ) : (
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); reviewerToken.set(draft.trim()); setToken(draft.trim()); setDraft(''); }}>
            <label htmlFor="reviewer-token" className="sr-only">Reviewer code</label>
            <input
              id="reviewer-token" type="password" autoComplete="off" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Reviewer code"
              className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-line bg-cream px-3 text-[16px] outline-none focus:border-coral"
            />
            <button type="submit" disabled={!draft.trim()} className="min-h-[48px] rounded-xl bg-ink px-4 text-[15px] font-bold text-cream disabled:opacity-40">Turn on</button>
          </form>
        )}
      </details>
    </AppShell>
  );
}

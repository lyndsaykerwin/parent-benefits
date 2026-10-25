import { useEffect, useState } from 'react';
import { reviewerToken } from '@/lib/bundle';
import { cn } from '@/lib/utils';
import type { AgentLogLine } from '@shared/agentLog';

/**
 * "How the agents worked together": the owner-only panel (plan sections 1c and 4, tracker M11).
 * It reads one run's agent log (Lyndsay's 10-field lines) and the agents' workspace notes from
 * GET /api/runs/:runId/agent-log, which only answers to the reviewer code, and groups them per card
 * and per loop. A parent (no reviewer code) gets nothing: no request is made and nothing is drawn.
 *
 * Mount point (owned by W3-VERSIONB): inside the owner view, under the cards, as
 * <AgentWorkspace runId={runId} cards={cards} />.
 */

export interface AgentLogNote { from_agent: string; to_agent: string; type: string; about: string; round: number; body: string }
export interface AgentLogLesson { action: 'add_lesson' | 'recall_lessons'; input: string; output: string }
/** What the agent-log route returns. */
export interface AgentLogData {
  runId: string;
  traceId: string;
  lines: AgentLogLine[];
  skipped: number;
  notes: AgentLogNote[];
  lessons: AgentLogLesson[];
  backend: 'hmem-local' | 'fallback-memory' | null;
}
export interface CardRef { id: string; title: string }

export type LoopKind = 'send_back' | 'rebuttal' | 'photo_retry' | 'recall_check' | 'saved_verdict';
export const LOOP_LABEL: Record<LoopKind, string> = {
  send_back: 'Send-backs',
  rebuttal: 'Rebuttal rounds',
  photo_retry: 'Photo retries',
  recall_check: 'Recall checks',
  saved_verdict: 'Saved verdicts reused',
};
const LOOP_KINDS = Object.keys(LOOP_LABEL) as LoopKind[];
const LOOP_BADGE: Record<LoopKind, string> = {
  send_back: 'Sent back', rebuttal: 'Rebuttal round', photo_retry: 'Photo retry', recall_check: 'Recall check', saved_verdict: 'Saved verdict reused',
};
const ACTION_LABEL: Record<AgentLogLine['action'], string> = {
  query_zetaris: 'looked up data', vision_extract: 'read a photo', evaluate_offer: 'checked an offer', court_debate: 'court debate',
  fact_check: 'fact-check', retry_request: 'asked for a redo', recall_hmem: 'used memory', approve_card: 'approved', reject_card: 'rejected',
};

/** Which loops one log line is part of. Today's lines carry these clues; the loop builders reuse the same words. */
export function loopsOf(l: AgentLogLine): LoopKind[] {
  const text = `${l.input_summary} ${l.output_summary}`;
  const out: LoopKind[] = [];
  // One photo retry writes two lines (the retry request, then the second read): count the request only.
  if (l.action === 'retry_request' && l.agent_name === 'PhotoReader') out.push('photo_retry');
  else if (l.action === 'retry_request' && l.status === 'needs_revision') out.push('send_back');
  if (l.action === 'court_debate' && (l.retry_count >= 1 || /rebuttal/i.test(text))) out.push('rebuttal');
  // Only a check that went against the recall record (or needed a redo) is a recall verification;
  // an ordinary "verified" on a recall card is not a loop.
  if (l.action === 'fact_check' && /\brecall\b/i.test(l.input_summary) && (l.retry_count >= 1 || /recall record|recall verification|evidence/i.test(text))) out.push('recall_check');
  if (/saved (verdict|grade)|past grade/i.test(text)) out.push('saved_verdict');
  return out;
}

export interface Group {
  key: string;
  label: string;
  lines: AgentLogLine[];
  notes: AgentLogNote[];
  loops: Record<LoopKind, number>;
}
export interface Grouped { groups: Group[]; counts: Record<LoopKind, number> }

const emptyLoops = (): Record<LoopKind, number> => ({ send_back: 0, rebuttal: 0, photo_retry: 0, recall_check: 0, saved_verdict: 0 });
export const RUN_KEY = '__run';

/** The card (or offer, purchase or rule) a line is about, from the words the agents write in input_summary. */
function subjectIn(text: string, cards: CardRef[]): { key: string; label: string } | null {
  const byId = (id: string) => cards.find((c) => c.id === id);
  const named = (key: string, plain: string, ...ids: string[]) => {
    const c = ids.map(byId).find(Boolean) ?? cards.find((x) => ids.includes(x.id));
    return c ? { key: c.id, label: c.title } : { key, label: plain };
  };
  let m = /\bcard ([\w-]+)/.exec(text);
  if (m) return byId(m[1]) ? { key: m[1], label: byId(m[1])!.title } : { key: m[1], label: m[1] };
  // The orchestrator writes send-backs as "<cardId> to <agent>", with no word "card": match a known card id.
  const known = cards.filter((c) => text.startsWith(`${c.id} `) || text.includes(` ${c.id} `)).sort((a, b) => b.id.length - a.id.length)[0];
  if (known) return { key: known.id, label: known.title };
  m = /\boffer[ -]?(\d+)\b/i.exec(text);
  if (m) return named(`offer ${m[1]}`, `Offer ${m[1]}`, `discount-${m[1]}`, `blocked-${m[1]}`);
  m = /\bitem (\d+)\b/i.exec(text);
  if (m) {
    const c = cards.find((x) => x.id.startsWith('clawback-') && x.id.endsWith(`-${m![1]}`));
    return c ? { key: c.id, label: c.title } : { key: `item ${m[1]}`, label: `Purchase ${m[1]}` };
  }
  m = /\brule ([A-Z][A-Z0-9_]+)\b/.exec(text);
  if (m) return named(`rule ${m[1]}`, `Rule ${m[1]}`, `benefit-${m[1].toLowerCase()}`);
  return null;
}

/** Group a run's log lines and workspace notes per card, count each loop, and put run-wide lines last. */
export function groupAgentLog(data: Pick<AgentLogData, 'lines' | 'notes'>, cards: CardRef[] = []): Grouped {
  const map = new Map<string, Group>();
  const get = (key: string, label: string): Group => {
    let g = map.get(key);
    if (!g) { g = { key, label, lines: [], notes: [], loops: emptyLoops() }; map.set(key, g); }
    return g;
  };
  const counts = emptyLoops();
  for (const l of data.lines) {
    const s = subjectIn(l.input_summary, cards);
    const g = s ? get(s.key, s.label) : get(RUN_KEY, 'Whole run (not about one card)');
    g.lines.push(l);
    for (const k of loopsOf(l)) { g.loops[k]++; counts[k]++; }
  }
  for (const n of [...data.notes].sort((a, b) => a.round - b.round)) {
    const s = subjectIn(`card ${n.about}`, cards) ?? { key: n.about, label: n.about };
    const asOffer = /^offer[ -]?\d+$/i.test(n.about) ? subjectIn(n.about, cards) : null;
    const target = asOffer ?? s;
    get(target.key, target.label).notes.push(n);
  }
  const rank = (g: Group) => (g.key === RUN_KEY ? 2 : LOOP_KINDS.some((k) => g.loops[k]) || g.notes.length ? 0 : 1);
  const groups = [...map.values()].map((g, i) => ({ g, i })).sort((a, b) => rank(a.g) - rank(b.g) || a.i - b.i).map((x) => x.g);
  return { groups, counts };
}

type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; data: AgentLogData } | { kind: 'none' } | { kind: 'error' };

export default function AgentWorkspace({ runId, cards = [], token }: { runId: string; cards?: CardRef[]; token?: string }) {
  const code = token ?? reviewerToken.get();
  const [state, setState] = useState<State>({ kind: code ? 'loading' : 'idle' });

  useEffect(() => {
    if (!code) { setState({ kind: 'idle' }); return; }
    let live = true;
    setState({ kind: 'loading' });
    fetch(`/api/runs/${encodeURIComponent(runId)}/agent-log`, { headers: { 'x-reviewer-token': code } })
      .then(async (res) => {
        if (!live) return;
        if (res.status === 403) return setState({ kind: 'idle' }); // wrong code: show nothing, like a parent
        if (res.status === 404) return setState({ kind: 'none' });
        if (!res.ok) return setState({ kind: 'error' });
        setState({ kind: 'ready', data: (await res.json()) as AgentLogData });
      })
      .catch(() => { if (live) setState({ kind: 'error' }); });
    return () => { live = false; };
  }, [runId, code]);

  if (state.kind === 'idle') return null; // parents never see this panel
  return (
    <section className="mt-8" aria-labelledby="agent-workspace-title" data-testid="agent-workspace">
      <h2 id="agent-workspace-title" className="eyebrow text-ink-2">How the agents worked together</h2>
      {state.kind === 'loading' && <p className="mt-2 text-[15px] text-ink-2">Loading the agents’ log…</p>}
      {state.kind === 'none' && <p className="mt-2 rounded-2xl bg-paper px-4 py-3 text-[15px] text-ink-2">No agent log for this run yet.</p>}
      {state.kind === 'error' && <p className="mt-2 rounded-2xl bg-paper px-4 py-3 text-[15px] text-ink-2">Could not load the agent log.</p>}
      {state.kind === 'ready' && <Ready data={state.data} cards={cards} />}
    </section>
  );
}

function Ready({ data, cards }: { data: AgentLogData; cards: CardRef[] }) {
  const { groups, counts } = groupAgentLog(data, cards);
  const anyLoop = LOOP_KINDS.some((k) => counts[k] > 0);
  return (
    <>
      <p className="mt-2 text-[15px] text-ink-2">
        Every step the agents took for this run, grouped by the card it was about. A loop is when agents checked each other’s work.
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5" data-testid="loop-counts" aria-label="Loops in this run">
        {LOOP_KINDS.map((k) => (
          <li key={k} className="rounded-2xl border border-line bg-paper px-3 py-2 text-center">
            <span className="tabular block text-[22px] font-extrabold leading-none text-ink">{counts[k]}</span>
            <span className="mt-1 block text-[12px] font-semibold leading-snug text-ink-2">{LOOP_LABEL[k]}</span>
          </li>
        ))}
      </ul>
      {!anyLoop && <p className="mt-2 text-[14px] text-ink-2">No loops this run: nothing was sent back, argued again or retried.</p>}
      {data.backend && (
        <p className="mt-2 text-[13px] text-ink-2" data-testid="workspace-backend">
          {data.backend === 'hmem-local'
            ? 'Notes between agents were stored in Meterless H-MEM, the shared workspace.'
            : 'Notes between agents were kept in a backup list because Meterless H-MEM could not be reached.'}
        </p>
      )}
      {data.skipped > 0 && <p className="mt-2 text-[13px] text-ink-2">{data.skipped} damaged log line(s) were left out.</p>}
      <div className="mt-3 space-y-3">
        {groups.map((g) => {
          const loopy = LOOP_KINDS.filter((k) => g.loops[k] > 0);
          return (
            <details key={g.key} open={loopy.length > 0 || g.notes.length > 0} className="rounded-2xl border border-line bg-paper px-4 py-3">
              <summary className="cursor-pointer text-[15px] font-bold text-ink">
                {g.label}
                <span className="ml-2 text-[13px] font-semibold text-ink-2">{g.lines.length} {g.lines.length === 1 ? 'step' : 'steps'}</span>
                {loopy.map((k) => (
                  <span key={k} className="ml-2 inline-block rounded-full bg-coral-tint px-2 py-0.5 text-[12px] font-bold text-coral-deep">{LOOP_BADGE[k]}{g.loops[k] > 1 ? ` x${g.loops[k]}` : ''}</span>
                ))}
              </summary>
              {g.notes.length > 0 && (
                <ol className="mt-2 space-y-1.5" aria-label="Notes the agents left each other">
                  {g.notes.map((n, i) => (
                    <li key={i} className="rounded-xl bg-coral-tint px-3 py-2 text-[14px] text-ink">
                      <span className="block text-[12px] font-bold text-ink-2">Round {n.round} · {n.from_agent} to {n.to_agent} ({n.type})</span>
                      <span className="block">{n.body}</span>
                    </li>
                  ))}
                </ol>
              )}
              <ol className="mt-2 space-y-1.5">
                {g.lines.map((l, i) => (
                  <li key={i} className={cn('text-[14px] leading-snug text-ink', loopsOf(l).length > 0 && 'font-semibold')}>
                    <span className="text-ink-2">{l.agent_name} to {l.target_agent} · {ACTION_LABEL[l.action]} · {l.status.replace('_', ' ')}{l.retry_count > 0 ? ` · try ${l.retry_count + 1}` : ''}</span>
                    <span className="block break-words">{l.output_summary}</span>
                  </li>
                ))}
              </ol>
            </details>
          );
        })}
      </div>
      {data.lessons.length > 0 && (
        <div className="mt-3 rounded-2xl border border-line bg-paper px-4 py-3">
          <p className="text-[15px] font-bold text-ink">Lessons from earlier runs</p>
          <ul className="mt-1 space-y-1 text-[14px] text-ink">
            {data.lessons.map((l, i) => <li key={i} className="break-words">{l.output}</li>)}
          </ul>
        </div>
      )}
    </>
  );
}

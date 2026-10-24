import fs from 'fs';
import path from 'path';
// H-MEM (Meterless, Apache-2.0) is vendored in vendor/hmem; see vendor/hmem/NOTICE.
import { HMEM, tokenize } from '../../vendor/hmem/src/index';
import type { TraceLogger, AgentLogHint } from '../agents/trace';

const STOP = new Set(['the', 'and', 'for', 'not', 'are', 'was', 'with', 'this', 'that']);

/** Tags that mark a record as a workspace note or a grading lesson, so the case-law recall never returns them. */
const WORKSPACE_TAG = 'workspace';
const LESSON_TAG = 'lesson';
const OFFER_CHECK_REF = 'offer_checks:';

export interface StoredNote { id: string; content: string; tags: string[]; timestamp: number }
export interface StoredLesson { id: string; text: string; offerCheckId: string | null; confidence: number; score: number }

export class BundleMemory {
  private hmem: HMEM;

  constructor(private persistDir: string, private trace?: TraceLogger) {
    this.hmem = new HMEM({ persistDir, actor: 'bundle' });
  }

  private traceCaller?: string;

  /** A view of the same memory that writes every call to the given run trace, under the calling agent's name. */
  withTrace(trace: TraceLogger, agentName?: string): BundleMemory {
    const view = Object.create(this) as BundleMemory;
    (view as any).trace = trace;
    if (agentName) (view as any).traceCaller = agentName;
    return view;
  }

  private log(action: string, input: string, output: string, confidence: number | null = null, agentLog?: AgentLogHint): void {
    this.trace?.log({
      agent_name: 'memory', action, input_summary: input.slice(0, 200), output_summary: output.slice(0, 200),
      target_agent: null, confidence, retry_count: 0, status: 'ok', caller: this.traceCaller, agentLog,
    });
  }

  addRule(text: string, source: string, confidence: number, refs: string[]): string {
    const rec = this.hmem.add({
      content: text,
      source,
      confidence,
      type: 'preference',
      layer: 'long_term',
      provenance: { origin: 'user_correction', learnedAt: Date.now(), label: source, refs },
    });
    this.log('add_rule', text, `stored ${rec.id} from ${source}`, rec.confidence);
    return rec.id;
  }

  recallRules(query: string, topN = 5): { id: string; text: string; confidence: number; score: number; reports: number }[] {
    // H-MEM's default cut-off (0.35) is tuned for a real embedder; its built-in
    // hash embedder scores short rules lower, so use 0.15 and then require at least
    // one shared word so unrelated queries return nothing.
    const res = this.hmem.query(query, { topN: topN + 20, threshold: 0.15 });
    const words = new Set(tokenize(query).filter((w) => w.length > 2 && !STOP.has(w)));
    const out = res.memories
      .filter((m) => !m.memory.tags.includes(WORKSPACE_TAG) && !m.memory.tags.includes(LESSON_TAG))
      .filter((m) => tokenize(m.memory.content).some((w) => words.has(w)))
      .slice(0, topN)
      .map((m) => ({
      id: m.memory.id, text: m.memory.content, confidence: m.memory.confidence, score: m.relevance,
      reports: m.memory.provenance?.refs?.length ?? 0,
    }));
    this.log('recall_rules', query, `${out.length} rule(s)`, out[0]?.confidence ?? null);
    return out;
  }

  // ---------- Shared workspace storage (used by agents/workspace.ts; it does the tracing) ----------

  /** Save one short-term workspace note, scoped to a run. No AI call, no network. Returns the note's id. */
  addNote(runId: string, content: string, tags: string[], confidence: number): string {
    const rec = this.hmem.add({
      content,
      source: `workspace:${runId}`,
      confidence,
      type: 'factual',
      layer: 'short_term',
      tags: [WORKSPACE_TAG, ...tags],
      chatId: runId,
      provenance: { origin: 'manual', learnedAt: Date.now(), label: `workspace:${runId}`, refs: [] },
    });
    return rec.id;
  }

  /** Every workspace note of one run, in the order they were posted. Plain filter, not a search. */
  notesForRun(runId: string): StoredNote[] {
    const seq = (id: string) => Number(id.replace(/\D+/g, '')) || 0;
    return this.hmem.store.all()
      .filter((m) => m.chatId === runId && m.tags.includes(WORKSPACE_TAG))
      .sort((a, b) => a.timestamp - b.timestamp || seq(a.id) - seq(b.id))
      .map((m) => ({ id: m.id, content: m.content, tags: [...m.tags], timestamp: m.timestamp }));
  }

  /** Save a long-term grading lesson that points at the offer_checks row it came from. */
  addLesson(text: string, offerCheckId: string, confidence: number): string {
    const rec = this.hmem.add({
      content: text,
      source: `${OFFER_CHECK_REF}${offerCheckId}`,
      confidence,
      type: 'factual',
      layer: 'long_term',
      tags: [LESSON_TAG],
      provenance: { origin: 'manual', learnedAt: Date.now(), label: 'grading lesson', refs: [`${OFFER_CHECK_REF}${offerCheckId}`] },
    });
    return rec.id;
  }

  /** Grading lessons related to a query (same matching rule as case law: at least one shared word). */
  recallLessons(query: string, topN = 5): StoredLesson[] {
    const res = this.hmem.query(query, { topN: topN + 20, threshold: 0.15 });
    const words = new Set(tokenize(query).filter((w) => w.length > 2 && !STOP.has(w)));
    return res.memories
      .filter((m) => m.memory.tags.includes(LESSON_TAG))
      .filter((m) => tokenize(m.memory.content).some((w) => words.has(w)))
      .slice(0, topN)
      .map((m) => {
        const ref = m.memory.provenance?.refs?.find((r) => r.startsWith(OFFER_CHECK_REF));
        return {
          id: m.memory.id, text: m.memory.content, confidence: m.memory.confidence, score: m.relevance,
          offerCheckId: ref ? ref.slice(OFFER_CHECK_REF.length) : null,
        };
      });
  }

  feedback(memoryId: string, kind: 'helpful' | 'not_helpful' | 'wrong'): void {
    this.hmem.feedback(memoryId, kind);
    this.log('feedback', `${memoryId} ${kind}`, 'confidence updated');
  }

  /** Write the append-only trust ledger (one JSON object per line) to a file. */
  exportLedger(toFile: string): void {
    fs.mkdirSync(path.dirname(toFile), { recursive: true });
    const rows = this.hmem.ledger.all().map((e) => JSON.stringify(e));
    fs.writeFileSync(toFile, rows.length ? rows.join('\n') + '\n' : '', 'utf8');
  }
}

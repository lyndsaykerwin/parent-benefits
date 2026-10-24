import { tokenize } from '../../vendor/hmem/src/index';
import { FEEDBACK_DELTAS, type FeedbackKind } from '../../vendor/hmem/src/types';
import type { StoredLesson, StoredNote } from '../adapters/memory';
import { AGENT_NAMES, type AgentName } from '@shared/agentLog';
import { redact, type TraceLogger } from './trace';

/**
 * The agents' shared workspace (plan section 1b, item 37). Agents post short notes for each other and read
 * the notes about the item they are working on. Storage is Meterless H-MEM (the open-source engine copied
 * into bundle/vendor/hmem, running inside our own server): no AI call, no network.
 *
 * Which store ran is always said out loud: `backend` is 'hmem-local' (the real engine) or, if the engine
 * fails, 'fallback-memory' (a plain in-process list). Every note, read, lesson and fallback is also written
 * to the run trace.
 */

export const WORKSPACE_NOTE_TYPES = ['claim', 'question', 'answer', 'correction', 'verdict'] as const;
export type WorkspaceNoteType = (typeof WORKSPACE_NOTE_TYPES)[number];

/** The approved message shape (plan section 10, item 37). */
export interface WorkspaceNote {
  run_id: string;
  from_agent: string;
  to_agent: string;
  type: WorkspaceNoteType;
  /** The card or offer this note is about. */
  about: string;
  body: string;
  evidence_sql: string;
  /** Which round of a send-back / rebuttal loop (0, 1 or 2). */
  round: number;
}

export type NoteInput = Omit<WorkspaceNote, 'run_id'>;
export interface NoteFilter { about?: string; from_agent?: string; to_agent?: string; type?: WorkspaceNoteType }

export interface LessonInput { text: string; offerCheckId: string; confidence: number }
export type Lesson = StoredLesson;

export type WorkspaceBackend = 'hmem-local' | 'fallback-memory';

/** What the workspace needs from its store. BundleMemory implements it; tests pass a broken one to prove the fallback. */
export interface NoteStore {
  addNote(runId: string, content: string, tags: string[], confidence: number): string;
  notesForRun(runId: string): StoredNote[];
  addLesson(text: string, offerCheckId: string, confidence: number): string;
  recallLessons(query: string, topN?: number): StoredLesson[];
  feedback(memoryId: string, kind: FeedbackKind): void;
}

const BODY_MAX = 500;
const SQL_MAX = 500;
const STOP = new Set(['the', 'and', 'for', 'not', 'are', 'was', 'with', 'this', 'that']);

export class Workspace {
  backend: WorkspaceBackend = 'hmem-local';
  /** Everything this process posted, kept so reads still work if the engine fails part-way through a run. */
  private mirror: WorkspaceNote[] = [];
  private mirrorLessons: (Lesson & { tokens: string[] })[] = [];
  private seq = 0;

  constructor(readonly runId: string, private store: NoteStore, private trace: TraceLogger) {
    let detail = 'notes stored in Meterless H-MEM (local engine, no AI call, no network)';
    let status: 'ok' | 'fallback' = 'ok';
    try {
      this.store.notesForRun(runId); // a cheap probe: can the engine be read right now?
    } catch (e) {
      this.backend = 'fallback-memory';
      status = 'fallback';
      detail = `H-MEM unavailable (${(e as Error)?.message ?? e}); notes kept in an in-process list`;
    }
    this.log('workspace_open', `run ${runId}`, `backend ${this.backend}: ${detail}`, status, null, 'Orchestrator', 'Meterless H-MEM');
  }

  /** Post one note. Throws on a malformed note. Returns the stored note. */
  post(input: NoteInput): WorkspaceNote {
    const note = this.validate(input);
    const content = JSON.stringify(note);
    const tags = [`run:${this.runId}`, `about:${note.about}`, `type:${note.type}`, `from:${note.from_agent}`, `to:${note.to_agent}`];
    this.mirror.push(note);
    let status: 'ok' | 'fallback' = 'ok';
    let output = `posted ${note.type} to ${note.to_agent}: ${note.body}`;
    if (this.backend === 'hmem-local') {
      try {
        this.store.addNote(this.runId, content, tags, 1);
      } catch (e) {
        this.switchToFallback(e);
      }
    }
    if (this.backend === 'fallback-memory') {
      status = 'fallback';
      output = `[fallback-memory] ${output}`;
    }
    this.log('post_note', `${note.type} ${note.from_agent} -> ${note.to_agent} about ${note.about} (round ${note.round})`,
      output, status, null, note.from_agent, note.to_agent);
    return note;
  }

  /** Read this run's notes, oldest first, optionally narrowed by item, sender, recipient or type. */
  read(filter: NoteFilter = {}, reader = 'Orchestrator'): WorkspaceNote[] {
    let all: WorkspaceNote[] | null = null;
    if (this.backend === 'hmem-local') {
      try {
        all = this.store.notesForRun(this.runId).map((n) => JSON.parse(n.content) as WorkspaceNote);
      } catch (e) {
        this.switchToFallback(e);
      }
    }
    const fell = this.backend === 'fallback-memory';
    if (!all) all = [...this.mirror];
    const out = all.filter((n) =>
      (filter.about === undefined || n.about === filter.about)
      && (filter.from_agent === undefined || n.from_agent === filter.from_agent)
      && (filter.to_agent === undefined || n.to_agent === filter.to_agent)
      && (filter.type === undefined || n.type === filter.type));
    const asked = Object.entries(filter).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${v}`).join(' ') || 'all';
    this.log('read_notes', `read notes (${asked})`, `${fell ? '[fallback-memory] ' : ''}${out.length} note(s) found`,
      fell ? 'fallback' : 'ok', null, reader, 'Meterless H-MEM');
    return out;
  }

  /** Save a grading lesson that points at the offer_checks row it came from. Returns the lesson id. */
  addLesson(input: LessonInput): string {
    const text = redact(String(input.text ?? '')).trim().slice(0, BODY_MAX);
    if (!text) throw new Error('lesson text must not be empty');
    if (!String(input.offerCheckId ?? '').trim()) throw new Error('lesson needs the offerCheckId it came from');
    const confidence = Math.min(1, Math.max(0, Number(input.confidence)));
    if (!Number.isFinite(confidence)) throw new Error('lesson confidence must be a number from 0 to 1');
    let id: string | null = null;
    if (this.backend === 'hmem-local') {
      try { id = this.store.addLesson(text, input.offerCheckId, confidence); } catch (e) { this.switchToFallback(e); }
    }
    const fell = this.backend === 'fallback-memory';
    if (!id) id = `local-${++this.seq}`;
    this.mirrorLessons.push({ id, text, offerCheckId: input.offerCheckId, confidence, score: 1, tokens: tokenize(text) });
    this.log('add_lesson', `lesson from offer_checks:${input.offerCheckId}`, `${fell ? '[fallback-memory] ' : ''}stored ${id}: ${text}`,
      fell ? 'fallback' : 'ok', confidence, 'Orchestrator', 'Meterless H-MEM');
    return id;
  }

  /** Lessons related to a query, best first. */
  recallLessons(query: string, topN = 5): Lesson[] {
    let out: Lesson[] | null = null;
    if (this.backend === 'hmem-local') {
      try { out = this.store.recallLessons(query, topN); } catch (e) { this.switchToFallback(e); }
    }
    const fell = this.backend === 'fallback-memory';
    if (!out) {
      const words = new Set(tokenize(query).filter((w) => w.length > 2 && !STOP.has(w)));
      out = this.mirrorLessons
        .filter((l) => l.tokens.some((w) => words.has(w)))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, topN)
        .map(({ tokens: _t, ...l }) => ({ ...l }));
    }
    this.log('recall_lessons', query, `${fell ? '[fallback-memory] ' : ''}${out.length} lesson(s)`,
      fell ? 'fallback' : 'ok', out[0]?.confidence ?? null, 'Orchestrator', 'Meterless H-MEM');
    return out;
  }

  /** A checker says a recalled lesson was right (helpful / not_helpful) or wrong; its trust number moves. */
  feedbackLesson(lessonId: string, kind: FeedbackKind): void {
    if (!(kind in FEEDBACK_DELTAS)) throw new Error(`feedback kind must be one of ${Object.keys(FEEDBACK_DELTAS).join(', ')}`);
    let done = false;
    if (this.backend === 'hmem-local' && !lessonId.startsWith('local-')) {
      try { this.store.feedback(lessonId, kind); done = true; } catch (e) { this.switchToFallback(e); }
    }
    const mirrored = this.mirrorLessons.find((l) => l.id === lessonId);
    // Keep the in-process copy in step so it is right if the engine fails later.
    if (mirrored) mirrored.confidence = Math.min(1, Math.max(0, mirrored.confidence + FEEDBACK_DELTAS[kind]));
    const fell = !done;
    this.log('lesson_feedback', `${lessonId} ${kind}`, `${fell ? '[fallback-memory] ' : ''}trust number updated`,
      fell ? 'fallback' : 'ok', mirrored?.confidence ?? null, 'FactChecker', 'Meterless H-MEM');
  }

  // ---------- internals ----------

  private validate(input: NoteInput): WorkspaceNote {
    if (!(WORKSPACE_NOTE_TYPES as readonly string[]).includes(input?.type as string)) {
      throw new Error(`note type must be one of ${WORKSPACE_NOTE_TYPES.join(', ')}`);
    }
    for (const k of ['from_agent', 'to_agent', 'about'] as const) {
      if (typeof input[k] !== 'string' || !input[k].trim()) throw new Error(`note ${k} must not be empty`);
    }
    if (typeof input.body !== 'string' || !input.body.trim()) throw new Error('note body must not be empty');
    if (!Number.isInteger(input.round) || input.round < 0 || input.round > 2) throw new Error('note round must be 0, 1 or 2');
    return {
      run_id: this.runId,
      from_agent: redact(input.from_agent).trim(),
      to_agent: redact(input.to_agent).trim(),
      type: input.type,
      about: redact(input.about).trim(),
      body: redact(input.body).trim().slice(0, BODY_MAX),
      evidence_sql: redact(String(input.evidence_sql ?? '')).trim().slice(0, SQL_MAX),
      round: input.round,
    };
  }

  private switchToFallback(e: unknown): void {
    if (this.backend === 'fallback-memory') return;
    this.backend = 'fallback-memory';
    this.log('workspace_fallback', 'H-MEM call failed', `backend now fallback-memory (${(e as Error)?.message ?? e})`,
      'fallback', null, 'Orchestrator', 'Meterless H-MEM');
  }

  /** One detailed trace line (agent 'memory'), shown in her log under the acting agent when it is one of her names. */
  private log(
    action: string, input: string, output: string, status: 'ok' | 'fallback',
    confidence: number | null, actor: string, target: string,
  ): void {
    this.trace.log({
      agent_name: 'memory', action, input_summary: input, output_summary: output,
      target_agent: target, confidence, retry_count: 0, status,
      agentLog: {
        agent: (AGENT_NAMES as readonly string[]).includes(actor) ? (actor as AgentName) : undefined,
        action: 'recall_hmem', target,
      },
    });
  }
}

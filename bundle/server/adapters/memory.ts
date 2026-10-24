import fs from 'fs';
import path from 'path';
// H-MEM (Meterless, Apache-2.0) is vendored in vendor/hmem; see vendor/hmem/NOTICE.
import { HMEM, tokenize } from '../../vendor/hmem/src/index';
import type { TraceLogger } from '../agents/trace';

const STOP = new Set(['the', 'and', 'for', 'not', 'are', 'was', 'with', 'this', 'that']);

export class BundleMemory {
  private hmem: HMEM;

  constructor(private persistDir: string, private trace?: TraceLogger) {
    this.hmem = new HMEM({ persistDir, actor: 'bundle' });
  }

  /** A view of the same memory that writes every call to the given run trace. */
  withTrace(trace: TraceLogger): BundleMemory {
    const view = Object.create(this) as BundleMemory;
    (view as any).trace = trace;
    return view;
  }

  private log(action: string, input: string, output: string, confidence: number | null = null): void {
    this.trace?.log({
      agent_name: 'memory', action, input_summary: input.slice(0, 200), output_summary: output.slice(0, 200),
      target_agent: null, confidence, retry_count: 0, status: 'ok',
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
    const res = this.hmem.query(query, { topN, threshold: 0.15 });
    const words = new Set(tokenize(query).filter((w) => w.length > 2 && !STOP.has(w)));
    const out = res.memories
      .filter((m) => tokenize(m.memory.content).some((w) => words.has(w)))
      .map((m) => ({
      id: m.memory.id, text: m.memory.content, confidence: m.memory.confidence, score: m.relevance,
      reports: m.memory.provenance?.refs?.length ?? 0,
    }));
    this.log('recall_rules', query, `${out.length} rule(s)`, out[0]?.confidence ?? null);
    return out;
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

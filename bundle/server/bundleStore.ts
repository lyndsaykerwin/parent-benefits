import path from 'path';
import { fetchRecentIssues, type FeedbackRow, type RuleProposal } from './agents/coach';
import { ZetarisClient } from './adapters/zetaris';
import type { BundleResult } from '../shared/bundle';

export interface ProposalRow {
  id: number;
  text: string;
  confidence: number;
  sourceFeedbackIds: string[];
  status: 'proposed' | 'approved' | 'rejected';
  memoryId: string | null;
}

/** One finished run, as saved in the `run_results` table. `result` is the full owner copy; parents get the trimmed view at read time. */
export interface SavedRunRow {
  runId: string;
  familyId: string;
  traceId: string | null;
  sampleMode: boolean;
  result: BundleResult;
  /** Display-only header fields (never income). */
  family: { name: string; birthDate: string | null; dueDate: string | null };
  today: string;
  demoDate: boolean;
  startedAt: string;
}

/** Everything the API reads or writes in Neon, behind one small interface so tests can use memory. */
export interface BundleStore {
  zipState(zip3: string): Promise<string | null>;
  addFeedback(row: Omit<FeedbackRow, 'id' | 'createdAt'>): Promise<FeedbackRow>;
  /** Newest `limit` 'issue' reports only (never the whole table). */
  listRecentIssues(limit: number): Promise<FeedbackRow[]>;
  saveProposals(p: RuleProposal[]): Promise<ProposalRow[]>;
  listProposals(): Promise<ProposalRow[]>;
  getProposal(id: number): Promise<ProposalRow | null>;
  markApproved(id: number, memoryId: string): Promise<void>;
  /** Save (or replace) a finished run so it is still served after a restart. */
  saveRunResult(row: SavedRunRow): Promise<void>;
  getRunResult(runId: string): Promise<SavedRunRow | null>;
  /** Newest saved run for a family, for the instant feed. */
  latestRunResult(familyId: string): Promise<SavedRunRow | null>;
}

/** Anything that can answer one Zetaris question (the real client or a test fake). */
export type IssueReader = Pick<ZetarisClient, 'runQuery'>;

/** The real Zetaris client from the environment (live mode). Throws a plain message when the settings are missing. */
function zetarisFromEnv(): IssueReader {
  const missing = ['ZETARIS_BASE_URL', 'ZETARIS_ORG_ID', 'ZETARIS_API_KEY'].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing settings: ${missing.join(', ')}`);
  return new ZetarisClient({
    baseUrl: process.env.ZETARIS_BASE_URL!, orgId: process.env.ZETARIS_ORG_ID!, apiKey: process.env.ZETARIS_API_KEY!,
    timeoutMs: (Number(process.env.SOURCE_TIMEOUT_SECONDS) || 20) * 1000 * 4, sampleMode: false,
    cacheDir: path.resolve('data/sample/zetaris-cache'), traceCaller: 'coach',
  });
}

const copyRow = (r: SavedRunRow): SavedRunRow => JSON.parse(JSON.stringify(r));

const norm = (t: string) => t.trim().toLowerCase();

export class MemoryStore implements BundleStore {
  private fb: FeedbackRow[] = [];
  private props: ProposalRow[] = [];
  private runs = new Map<string, SavedRunRow>();
  /** `issueReader`: when given, the Coach's reports come through it (Zetaris); without one (sample mode) this list is the whole database. */
  constructor(private zips: Record<string, string> = {}, private issueReader?: IssueReader) {}
  async zipState(zip3: string) { return this.zips[zip3] ?? null; }
  async addFeedback(row: Omit<FeedbackRow, 'id' | 'createdAt'>) {
    const r = { ...row, id: this.fb.length + 1, createdAt: new Date() };
    this.fb.push(r);
    return r;
  }
  async listRecentIssues(limit: number) {
    if (this.issueReader) return fetchRecentIssues(this.issueReader, limit);
    return this.fb.filter((r) => r.kind === 'issue').slice(-limit);
  }
  async saveProposals(p: RuleProposal[]) {
    const added: ProposalRow[] = [];
    for (const x of p) {
      if (this.props.some((e) => norm(e.text) === norm(x.text))) continue;
      const row: ProposalRow = { id: this.props.length + 1, ...x, status: 'proposed', memoryId: null };
      this.props.push(row);
      added.push(row);
    }
    return added;
  }
  async listProposals() { return [...this.props]; }
  async getProposal(id: number) { return this.props.find((p) => p.id === id) ?? null; }
  async markApproved(id: number, memoryId: string) {
    const p = this.props.find((e) => e.id === id);
    if (p) { p.status = 'approved'; p.memoryId = memoryId; }
  }
  async saveRunResult(row: SavedRunRow) {
    this.runs.delete(row.runId); // re-saving moves it to "newest"
    this.runs.set(row.runId, copyRow(row));
  }
  async getRunResult(runId: string) {
    const r = this.runs.get(runId);
    return r ? copyRow(r) : null;
  }
  async latestRunResult(familyId: string) {
    const mine = [...this.runs.values()].filter((r) => r.familyId === familyId);
    return mine.length ? copyRow(mine[mine.length - 1]) : null;
  }
}

/** Neon through Drizzle. Imported lazily because server/db.ts throws without DATABASE_URL. */
export class DrizzleStore implements BundleStore {
  /** `issueReader` defaults to the real Zetaris client (built on first use from the environment); tests pass a fake. */
  constructor(private issueReader?: IssueReader) {}
  private async d() {
    const { db } = await import('./db');
    const s = await import('../shared/schema');
    const o = await import('drizzle-orm');
    return { db, s, o };
  }
  private toRow(r: any): ProposalRow {
    return { id: r.id, text: r.text, confidence: r.confidence, sourceFeedbackIds: (r.sourceFeedbackIds ?? []).map(String), status: r.status, memoryId: r.memoryId ?? null };
  }
  async zipState(zip3: string) {
    const { db, s, o } = await this.d();
    const rows = await db.select().from(s.zipStates).where(o.eq(s.zipStates.zip3, zip3)).limit(1);
    return rows[0]?.state ?? null;
  }
  async addFeedback(row: Omit<FeedbackRow, 'id' | 'createdAt'>) {
    const { db, s } = await this.d();
    const [r] = await db.insert(s.feedback).values(row).returning();
    return r as FeedbackRow;
  }
  /** Read through Zetaris (view v_coach_feedback), not straight from Neon. Writes (addFeedback) still go to Neon. */
  async listRecentIssues(limit: number) {
    this.issueReader ??= zetarisFromEnv();
    return fetchRecentIssues(this.issueReader, limit);
  }
  async saveProposals(p: RuleProposal[]) {
    const { db, s } = await this.d();
    const existing = new Set((await db.select().from(s.caseLawProposals)).map((e: any) => norm(e.text)));
    const added: ProposalRow[] = [];
    for (const x of p) {
      if (existing.has(norm(x.text))) continue;
      const [r] = await db.insert(s.caseLawProposals).values({ text: x.text, confidence: x.confidence, sourceFeedbackIds: x.sourceFeedbackIds.map(Number) }).returning();
      added.push(this.toRow(r));
    }
    return added;
  }
  async listProposals() {
    const { db, s } = await this.d();
    return (await db.select().from(s.caseLawProposals)).map((r: any) => this.toRow(r));
  }
  async getProposal(id: number) {
    const { db, s, o } = await this.d();
    const rows = await db.select().from(s.caseLawProposals).where(o.eq(s.caseLawProposals.id, id)).limit(1);
    return rows[0] ? this.toRow(rows[0]) : null;
  }
  async markApproved(id: number, memoryId: string) {
    const { db, s, o } = await this.d();
    await db.update(s.caseLawProposals).set({ status: 'approved', memoryId }).where(o.eq(s.caseLawProposals.id, id));
  }
  /** The `run_results.result` column holds the full result plus the display fields, so one row restores a whole run. */
  private toRun(r: any): SavedRunRow {
    const env = r.result ?? {};
    return {
      runId: r.runId, familyId: r.familyId, traceId: r.traceId ?? null, sampleMode: !!r.sampleMode,
      result: env.result, family: env.family ?? { name: r.familyId, birthDate: null, dueDate: null },
      today: env.today ?? '', demoDate: !!env.demoDate, startedAt: env.startedAt ?? new Date(r.createdAt).toISOString(),
    };
  }
  async saveRunResult(row: SavedRunRow) {
    const { db, s } = await this.d();
    const result = { result: row.result, family: row.family, today: row.today, demoDate: row.demoDate, startedAt: row.startedAt };
    await db.insert(s.runResults)
      .values({ runId: row.runId, familyId: row.familyId, traceId: row.traceId, sampleMode: row.sampleMode, result, createdAt: new Date() }) // set here so every row uses the app's clock, not the database's
      .onConflictDoUpdate({ target: s.runResults.runId, set: { familyId: row.familyId, traceId: row.traceId, sampleMode: row.sampleMode, result, createdAt: new Date() } });
  }
  async getRunResult(runId: string) {
    const { db, s, o } = await this.d();
    const rows = await db.select().from(s.runResults).where(o.eq(s.runResults.runId, runId)).limit(1);
    return rows[0] ? this.toRun(rows[0]) : null;
  }
  async latestRunResult(familyId: string) {
    const { db, s, o } = await this.d();
    const rows = await db.select().from(s.runResults).where(o.eq(s.runResults.familyId, familyId)).orderBy(o.desc(s.runResults.createdAt)).limit(1);
    return rows[0] ? this.toRun(rows[0]) : null;
  }
}

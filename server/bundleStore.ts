import type { FeedbackRow, RuleProposal } from './agents/coach';

export interface ProposalRow {
  id: number;
  text: string;
  confidence: number;
  sourceFeedbackIds: string[];
  status: 'proposed' | 'approved' | 'rejected';
  memoryId: string | null;
}

/** Everything the API reads or writes in Neon, behind one small interface so tests can use memory. */
export interface BundleStore {
  zipState(zip3: string): Promise<string | null>;
  addFeedback(row: Omit<FeedbackRow, 'id' | 'createdAt'>): Promise<FeedbackRow>;
  listFeedback(): Promise<FeedbackRow[]>;
  saveProposals(p: RuleProposal[]): Promise<ProposalRow[]>;
  listProposals(): Promise<ProposalRow[]>;
  getProposal(id: number): Promise<ProposalRow | null>;
  markApproved(id: number, memoryId: string): Promise<void>;
}

const norm = (t: string) => t.trim().toLowerCase();

export class MemoryStore implements BundleStore {
  private fb: FeedbackRow[] = [];
  private props: ProposalRow[] = [];
  constructor(private zips: Record<string, string> = {}) {}
  async zipState(zip3: string) { return this.zips[zip3] ?? null; }
  async addFeedback(row: Omit<FeedbackRow, 'id' | 'createdAt'>) {
    const r = { ...row, id: this.fb.length + 1, createdAt: new Date() };
    this.fb.push(r);
    return r;
  }
  async listFeedback() { return [...this.fb]; }
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
}

/** Neon through Drizzle. Imported lazily because server/db.ts throws without DATABASE_URL. */
export class DrizzleStore implements BundleStore {
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
  async listFeedback() {
    const { db, s } = await this.d();
    return (await db.select().from(s.feedback)) as FeedbackRow[];
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
}

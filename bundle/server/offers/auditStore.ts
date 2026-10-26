/**
 * Where a parent's audited offers are kept (plans/v2-build-plan.md, R2), and the offers live search found (R3).
 *
 * With a database (live mode) they are rows in offer_checks with source 'user_audit', so the Zetaris views, /api/offer-audit and the next
 * parent's instant verdict all see them. Without one (practice mode, or no DATABASE_URL) a memory copy keeps the screen working;
 * it lasts until the server restarts. No family data goes in either way: the table has no family column.
 *
 * Live-search finds go to the same table so they join the shared list (/api/offer-audit, the Zetaris views). They keep the column's
 * default source 'court' (graded by our own court, not a parent) and are told apart from the court's scans by agent 'live_search'.
 * The same offer (same page) with the same fine print is saved once; a page whose fine print changed gets a new grade.
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import * as schema from '../../shared/schema';
import type { FinePrintVerdict } from '../../shared/bundle';
import type { InsertOfferCheck } from '../agents/types';

export interface SavedAudit {
  offerId: string;
  store: string;
  verdict: FinePrintVerdict;
  catchSummary: string;
  finePrintHash: string;
  trueValueCents: number | null;
  injectionDetected: boolean;
}

/** How many different offers parents have put on the shared list, in total and per store. */
export interface ParentStats { total: number; byStore: Record<string, number> }

export interface AuditStore {
  /** The newest parent-audited, agreed grade for this offer id, or null. */
  find(offerId: string): Promise<SavedAudit | null>;
  /** Saves one agreed grade. The row must be source 'user_audit' and status 'agreed'. */
  save(row: InsertOfferCheck): Promise<void>;
  parentStats(): Promise<ParentStats>;
  /**
   * Saves one agreed grade of an offer live search found (source 'court', agent 'live_search'). Answers false, and saves nothing,
   * when the same offer with the same fine print is already saved.
   */
  saveLiveFind(row: InsertOfferCheck): Promise<boolean>;
}

/** Marks an offer_checks row as found by live search (the "agent" column; the source stays 'court'). */
export const LIVE_SEARCH_AGENT = 'live_search';

function assertSavable(row: InsertOfferCheck): void {
  if (row.source !== 'user_audit') throw new Error("audit rows must have source 'user_audit'");
  if (row.status !== 'agreed') throw new Error(`only agreed grades are saved (got status "${String(row.status)}")`);
  if (row.injectionDetected) throw new Error('a grade with hidden instructions is never saved');
}

function assertLiveFind(row: InsertOfferCheck): void {
  if ((row.source ?? 'court') !== 'court') throw new Error("live-search rows must have source 'court'");
  if (row.agent !== LIVE_SEARCH_AGENT) throw new Error(`live-search rows must have agent '${LIVE_SEARCH_AGENT}'`);
  if (row.status !== 'agreed') throw new Error(`only agreed grades are saved (got status "${String(row.status)}")`);
  if (row.injectionDetected) throw new Error('a grade with hidden instructions is never saved');
}

const toSaved = (r: Pick<InsertOfferCheck, 'offerId' | 'store' | 'verdict' | 'catchSummary' | 'finePrintHash' | 'trueValueCents' | 'injectionDetected'>): SavedAudit => ({
  offerId: r.offerId, store: r.store, verdict: r.verdict as FinePrintVerdict, catchSummary: r.catchSummary ?? '',
  finePrintHash: r.finePrintHash, trueValueCents: r.trueValueCents ?? null, injectionDetected: !!r.injectionDetected,
});

export function createMemoryAuditStore(): AuditStore {
  const rows = new Map<string, InsertOfferCheck>(); // newest per offer id
  const liveFinds = new Set<string>(); // offer id + fine-print fingerprint of every saved live find
  return {
    async find(offerId) { const r = rows.get(offerId); return r ? toSaved(r) : null; },
    async save(row) { assertSavable(row); rows.set(row.offerId, row); },
    async parentStats() {
      const byStore: Record<string, number> = {};
      for (const r of rows.values()) byStore[r.store] = (byStore[r.store] ?? 0) + 1;
      return { total: rows.size, byStore };
    },
    async saveLiveFind(row) {
      assertLiveFind(row);
      const key = `${row.offerId}|${row.finePrintHash}`;
      if (liveFinds.has(key)) return false;
      liveFinds.add(key);
      return true;
    },
  };
}

type Db = typeof import('../db')['db'];

/** The database copy. The connection opens on first use (server/db.ts needs DATABASE_URL), so building this never throws. */
export function createDbAuditStore(getDb: () => Promise<Db> = async () => (await import('../db')).db): AuditStore {
  const t = schema.offerChecks;
  return {
    async find(offerId) {
      const db = await getDb();
      const [r] = await db.select().from(t)
        .where(and(eq(t.offerId, offerId), eq(t.source, 'user_audit'), eq(t.status, 'agreed')))
        .orderBy(desc(t.checkedAt), desc(t.id)).limit(1);
      return r ? toSaved(r) : null;
    },
    async save(row) {
      assertSavable(row);
      const db = await getDb();
      await db.insert(t).values(row);
    },
    async parentStats() {
      const db = await getDb();
      const rows = await db.select({ store: t.store, n: sql<number>`count(distinct ${t.offerId})` }).from(t)
        .where(and(eq(t.source, 'user_audit'), eq(t.status, 'agreed'))).groupBy(t.store);
      const byStore: Record<string, number> = {};
      let total = 0;
      for (const r of rows) { byStore[r.store] = Number(r.n); total += Number(r.n); }
      return { total, byStore };
    },
    async saveLiveFind(row) {
      assertLiveFind(row);
      const db = await getDb();
      const [already] = await db.select({ id: t.id }).from(t)
        .where(and(eq(t.offerId, row.offerId), eq(t.finePrintHash, row.finePrintHash), eq(t.agent, LIVE_SEARCH_AGENT))).limit(1);
      if (already) return false;
      await db.insert(t).values(row);
      return true;
    },
  };
}

let shared: AuditStore | undefined;
/** One store for the whole server: the database when one is set (and not practice mode), otherwise memory. */
export function defaultAuditStore(): AuditStore {
  return (shared ??= process.env.DATABASE_URL && process.env.SAMPLE_MODE !== 'true' ? createDbAuditStore() : createMemoryAuditStore());
}

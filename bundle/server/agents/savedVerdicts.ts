/**
 * The fixed Zetaris questions behind the saved-verdict step (sign-off item 38) and the rerouted reads (item 14).
 *
 * Saved verdicts: one question per run reads what the agents already concluded about the offers in play, through
 * the view v_offer_verdicts (latest grade per offer, no family data). It powers the instant saved feed and the
 * "skip the AI" step (an unchanged wording fingerprint, or a universal-rule rejection).
 *
 * Every question lives here as one exported function so the exact text is identical everywhere. That matters in
 * SAMPLE_MODE: a saved answer is replayed only for the exact SQL text it was recorded with (`npm run zetaris:record`).
 * With no recorded answer, sample mode says "no saved verdicts" and the agents grade every offer fresh. A saved
 * answer is never written by hand.
 */
import { col, quoteId, quoteInt } from './sql';
import type { ZetarisClient } from '../adapters/zetaris';

type Row = Record<string, string | number | null>;
type Asker = Pick<ZetarisClient, 'runQuery'>;

/** The columns v_offer_verdicts returns, in the order they are asked for. */
export const SAVED_VERDICT_COLUMNS = [
  'offer_id', 'store', 'verdict', 'status', 'rule_citations',
  'true_value_cents', 'effort_minutes_estimate', 'steps_count', 'payout_wait_days_max', 'claim_window_days',
  'fine_print_hash', 'universal_rule', 'checked_at',
] as const;

/** The saved-verdict question for the offers in play: same offers (any order, repeats) give the same text. */
export function savedVerdictsSql(offerIds: (string | number)[]): string {
  const ids = [...new Set(offerIds.map((i) => String(i)))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  if (!ids.length) throw new Error('savedVerdictsSql needs at least one offer id');
  return `SELECT ${SAVED_VERDICT_COLUMNS.join(', ')} FROM bundle_pg.v_offer_verdicts WHERE offer_id IN (${ids.map((i) => quoteId(i)).join(', ')}) ORDER BY offer_id`;
}

/** The family profile for one family (live mode), through the Zetaris view instead of straight from Neon. */
export function familyProfileSql(familyId: string): string {
  return 'SELECT id, is_guest, name, birth_date, due_date, zip, state, employer, household_size, annual_income_cents, dcfsa_offered, data_connected ' +
    `FROM bundle_pg.v_family_profile WHERE id = ${quoteId(familyId)}`;
}

/** The Coach's newest "issue" reports (never the whole table). */
export function coachIssuesSql(limit: number): string {
  const n = Number(quoteInt(limit));
  if (n < 1) throw new Error('limit must be at least 1');
  return `SELECT id, family_id, card_id, kind, note, created_at FROM bundle_pg.v_coach_feedback ORDER BY id DESC LIMIT ${n}`;
}

/** Per-brand totals for the data product; one brand, or all of them when no store is given. */
export function offerAuditSql(store?: string): string {
  const base = 'SELECT store, offers_checked, offers_caught, catch_rate, avg_face_value_cents, avg_true_value_cents, avg_effort_minutes FROM bundle_pg.v_offer_audit';
  if (store === undefined) return `${base} ORDER BY store`;
  // Store names may hold apostrophes ("Joe's"); letters, digits, spaces and . , & ' - are allowed, doubled quotes keep SQL safe.
  if (!/^[A-Za-z0-9 .,&'’-]{1,80}$/.test(store)) throw new Error('invalid store name');
  return `${base} WHERE store = '${store.replace(/['’]/g, "''")}'`;
}

export interface SavedVerdict {
  offerId: string;
  store: string;
  verdict: string;
  status: string;
  ruleCitations: string[];
  trueValueCents: number | null;
  effortMinutesEstimate: number | null;
  stepsCount: number | null;
  payoutWaitDaysMax: number | null;
  claimWindowDays: number | null;
  finePrintHash: string;
  /** True when the cited rule does not depend on the family (so the rejection holds for everyone). */
  universalRule: boolean;
  checkedAt: string | null;
}

export interface SavedVerdictResult {
  /** found: at least one saved verdict. none: asked, nothing saved. unavailable: could not ask (sample mode without a recording, or Zetaris down). */
  status: 'found' | 'none' | 'unavailable';
  verdicts: SavedVerdict[];
  reason?: string;
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const numOrNull = (v: unknown): number | null => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const truthy = (v: unknown): boolean => v === true || v === 1 || /^(1|true|t|yes)$/i.test(str(v));

function citations(v: unknown): string[] {
  try {
    const parsed = JSON.parse(str(v));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch { return []; }
}

function toVerdict(r: Row): SavedVerdict {
  return {
    offerId: str(col(r, 'offer_id')), store: str(col(r, 'store')), verdict: str(col(r, 'verdict')), status: str(col(r, 'status')),
    ruleCitations: citations(col(r, 'rule_citations')),
    trueValueCents: numOrNull(col(r, 'true_value_cents')), effortMinutesEstimate: numOrNull(col(r, 'effort_minutes_estimate')),
    stepsCount: numOrNull(col(r, 'steps_count')), payoutWaitDaysMax: numOrNull(col(r, 'payout_wait_days_max')),
    claimWindowDays: numOrNull(col(r, 'claim_window_days')),
    finePrintHash: str(col(r, 'fine_print_hash')), universalRule: truthy(col(r, 'universal_rule')),
    checkedAt: col(r, 'checked_at') === undefined || col(r, 'checked_at') === null ? null : str(col(r, 'checked_at')),
  };
}

/**
 * Ask Zetaris what is already saved for these offers. Never throws for "no answer": if Zetaris cannot answer
 * (sample mode with no recording yet, outage, view not registered) the result says so and the agents grade fresh.
 */
export async function fetchSavedVerdicts(z: Asker, offerIds: (string | number)[]): Promise<SavedVerdictResult> {
  if (!offerIds.length) return { status: 'none', verdicts: [] };
  try {
    const res = await z.runQuery(savedVerdictsSql(offerIds));
    const verdicts = res.rows.map(toVerdict);
    return { status: verdicts.length ? 'found' : 'none', verdicts };
  } catch (e: any) {
    return { status: 'unavailable', verdicts: [], reason: String(e?.message ?? e).slice(0, 200) };
  }
}

/**
 * Can the AI debate be skipped for this offer? 'same_fingerprint': the wording is unchanged, so reuse the saved grade.
 * 'universal_rule': a rule that holds for every family already rejected it. Otherwise null (grade fresh).
 */
export function canSkipAi(saved: SavedVerdict | undefined, currentFingerprint: string): 'same_fingerprint' | 'universal_rule' | null {
  if (!saved) return null;
  if (saved.finePrintHash && saved.finePrintHash === currentFingerprint) return 'same_fingerprint';
  if (saved.universalRule && saved.verdict === 'reject') return 'universal_rule';
  return null;
}

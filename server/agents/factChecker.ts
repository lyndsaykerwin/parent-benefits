import type { AgentContext, Candidate } from './types';
import { InvalidId, quoteId as q, quoteDate, addDays, col } from './sql';

export interface VerifyResult {
  ok: boolean;
  reason: string | null;
  corrected: Partial<Candidate> | null;
}

/**
 * Claim shapes a producing agent must attach to `Candidate.claim` (keyed by `type`):
 *   rule     { type:'rule', ref: <benefit_rules.code> }            -> amount + deadline
 *   offer    { type:'offer', offerId: <offers.id> }                -> amount + deadline
 *   recall   { type:'recall', recallId: <CPSC RecallID> }          (or recallSource:'fda', recallNumber)
 *   clawback { type:'clawback', txId: <transactions.id>, txAmountCents }
 *   fsa_reimbursement { type, txId, txAmountCents }                -> card amount must equal the transaction
 *   price_adjustment  { type, txId, txAmountCents }                -> amount = paid minus the lowest in-window price; deadline = purchase + store window
 *   dcfsa_childcare   { type, txId, txAmountCents, planYear }      -> amount = min(sum of that year's daycare payments, cap)
 * Anything else cannot be verified, so it fails closed.
 */

const CENT_TOLERANCE = 1;
/** Federal Dependent Care FSA yearly limit for a household (2026), in cents. */
export const DCFSA_CAP_CENTS = 750000;

function intId(v: string | number | undefined): number | null {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function finish(c: Candidate, ctx: AgentContext, res: VerifyResult, status: 'ok' | 'blocked' | 'error'): VerifyResult {
  ctx.trace.log({
    agent_name: 'fact_checker',
    action: 'verify',
    input_summary: `${c.kind} card ${c.id} from ${c.agent}: claim ${JSON.stringify(c.claim)}`.slice(0, 300),
    output_summary: res.ok ? 'verified' : (res.reason ?? 'failed'),
    target_agent: res.ok ? null : c.agent,
    confidence: res.ok ? 1 : 0,
    retry_count: c.retryCount,
    status,
  });
  return res;
}

const fail = (reason: string, corrected: Partial<Candidate> | null = null): VerifyResult => ({ ok: false, reason, corrected });

/** Compare amount and deadline against the freshly read truth. */
function compare(c: Candidate, truthAmount: number | null | undefined, truthDeadline: string | null): VerifyResult {
  const reasons: string[] = [];
  const corrected: Partial<Candidate> = {};
  if (c.amountCents !== null && truthAmount !== undefined && truthAmount !== null) {
    if (Math.abs(c.amountCents - truthAmount) > CENT_TOLERANCE) {
      reasons.push(`amount mismatch: card says ${c.amountCents}, source says ${truthAmount}`);
      corrected.amountCents = truthAmount;
    }
  }
  if (c.deadline !== null && truthDeadline !== null && c.deadline !== truthDeadline) {
    reasons.push(`deadline mismatch: card says ${c.deadline}, source says ${truthDeadline}`);
    corrected.deadline = truthDeadline;
  }
  return reasons.length ? fail(reasons.join('; '), corrected) : { ok: true, reason: null, corrected: null };
}

function anchor(ctx: AgentContext): string | null {
  return ctx.family.birthDate ?? ctx.family.dueDate ?? null;
}

async function check(c: Candidate, ctx: AgentContext): Promise<VerifyResult> {
  const claim = c.claim ?? {};
  const type = String(claim.type ?? '');

  if (type === 'rule') {
    const sql = `SELECT amount_cents, window_end_days_from_birth FROM bundle_pg.benefit_rules WHERE code = ${q(claim.ref)}`;
    const { rows } = await ctx.z.runQuery(sql);
    if (!rows.length) return fail(`source not found: rule ${claim.ref}`);
    const end = col(rows[0], 'window_end_days_from_birth');
    const a = anchor(ctx);
    const deadline = typeof end === 'number' && a ? addDays(a, end) : null;
    return compare(c, col(rows[0], 'amount_cents') as number | null, deadline);
  }

  if (type === 'offer') {
    const id = intId(claim.offerId);
    if (id === null) return fail('cannot verify: offerId is not a number');
    const sql = `SELECT value_cents, max_age_days FROM bundle_pg.v_judge_offers WHERE id = ${id}`;
    const { rows } = await ctx.z.runQuery(sql);
    if (!rows.length) return fail(`source not found: offer ${id}`);
    const max = col(rows[0], 'max_age_days');
    const a = anchor(ctx);
    const deadline = typeof max === 'number' && a ? addDays(a, max) : null;
    return compare(c, col(rows[0], 'value_cents') as number | null, deadline);
  }

  if (type === 'recall') {
    let sql: string;
    if (claim.recallSource === 'fda') {
      // LATERAL VIEW must sit in a subquery (Zetaris quirk).
      sql = `SELECT recall_number FROM (SELECT x.recall_number AS recall_number FROM bundle_live.fda_food_recalls LATERAL VIEW explode(results) t AS x) f WHERE recall_number = ${q(claim.recallNumber)}`;
    } else {
      const id = intId(claim.recallId);
      if (id === null) return fail('cannot verify: recallId is not a number');
      sql = `SELECT RecallID FROM bundle_live.cpsc_recalls WHERE RecallID = ${id}`;
    }
    const { rows } = await ctx.z.runQuery(sql);
    return rows.length ? { ok: true, reason: null, corrected: null } : fail(`source not found: recall ${claim.recallId ?? claim.recallNumber}`);
  }

  if (type === 'clawback') {
    const sql = `SELECT amount_cents, family_id FROM bundle_pg.v_clawback_tx WHERE id = ${q(claim.txId)} AND family_id = ${q(ctx.family.id)}`;
    const { rows } = await ctx.z.runQuery(sql);
    if (!rows.length) return fail(`source not found: transaction ${claim.txId} for this family`);
    const truth = col(rows[0], 'amount_cents') as number;
    const claimed = Number(claim.txAmountCents);
    if (!Number.isFinite(claimed) || Math.abs(claimed - truth) > CENT_TOLERANCE) {
      // The claimed refund is built on the transaction amount, so it cannot be trusted either.
      return fail(`amount mismatch: card used ${claim.txAmountCents}, transaction is ${truth}`);
    }
    return { ok: true, reason: null, corrected: null };
  }

  if (type === 'fsa_reimbursement') {
    const sql = `SELECT amount_cents, family_id FROM bundle_pg.v_clawback_tx WHERE id = ${q(claim.txId)} AND family_id = ${q(ctx.family.id)}`;
    const { rows } = await ctx.z.runQuery(sql);
    if (!rows.length) return fail(`source not found: transaction ${claim.txId} for this family`);
    const truth = col(rows[0], 'amount_cents') as number;
    const claimed = Number(claim.txAmountCents);
    if (!Number.isFinite(claimed) || Math.abs(claimed - truth) > CENT_TOLERANCE) {
      return fail(`amount mismatch: card used ${claim.txAmountCents}, transaction is ${truth}`);
    }
    return compare(c, truth, null);
  }

  if (type === 'price_adjustment') {
    // Independent path: pull every possible price row and apply the window rule here, in code.
    const sql =
      'SELECT t.amount_cents AS amount_cents, t.date AS tx_date, sp.adjustment_window_days AS window_days, ' +
      'po.price_cents AS price_cents, po.observed_at AS observed_at ' +
      'FROM bundle_pg.v_clawback_tx t ' +
      'JOIN bundle_pg.store_policies sp ON lower(sp.store) = lower(t.merchant) ' +
      'JOIN bundle_pg.price_observations po ON lower(po.store) = lower(sp.store) ' +
      "AND lower(t.category) LIKE concat('%', lower(po.keyword), '%') " +
      `WHERE t.id = ${q(claim.txId)} AND t.family_id = ${q(ctx.family.id)}`;
    const { rows } = await ctx.z.runQuery(sql);
    if (!rows.length) return fail(`source not found: price check for transaction ${claim.txId}`);
    const paid = col(rows[0], 'amount_cents') as number;
    const claimed = Number(claim.txAmountCents);
    if (!Number.isFinite(claimed) || Math.abs(claimed - paid) > CENT_TOLERANCE) {
      return fail(`amount mismatch: card used ${claim.txAmountCents}, transaction is ${paid}`);
    }
    let best: number | null = null;
    let deadline: string | null = null;
    for (const r of rows) {
      const date = String(col(r, 'tx_date')).slice(0, 10);
      const win = Number(col(r, 'window_days'));
      const seen = String(col(r, 'observed_at')).slice(0, 10);
      const price = Number(col(r, 'price_cents'));
      const end = addDays(date, win);
      if (seen >= date && seen <= end && price < paid && (best === null || price < best)) { best = price; deadline = end; }
    }
    if (best === null || deadline === null) return fail('source not found: no lower price inside the store window');
    return compare(c, paid - best, deadline);
  }

  if (type === 'dcfsa_childcare') {
    if (!ctx.family.dcfsaOffered) return fail('source not found: employer does not offer a Dependent Care FSA');
    const year = intId(claim.planYear);
    if (year === null || year < 2000 || year > 2100) return fail('cannot verify: planYear is not a year');
    const sql =
      'SELECT COALESCE(SUM(p.amount_cents), 0) AS total_cents, COUNT(*) AS n FROM ' +
      '(SELECT DISTINCT t.merchant AS merchant, t.date AS date, t.amount_cents AS amount_cents ' +
      "FROM bundle_pg.v_clawback_tx t JOIN bundle_pg.fsa_eligible_categories c ON c.account = 'DCFSA' " +
      "AND (lower(t.category) LIKE concat('%', lower(c.keyword), '%') OR lower(t.merchant) LIKE concat('%', lower(c.keyword), '%')) " +
      `WHERE t.family_id = ${q(ctx.family.id)} AND t.amount_cents > 0 ` +
      `AND t.date >= ${quoteDate(`${year}-01-01`)} AND t.date <= ${quoteDate(`${year}-12-31`)}) p`;
    const { rows } = await ctx.z.runQuery(sql);
    const total = rows.length ? Number(col(rows[0], 'total_cents')) : 0;
    if (!Number.isFinite(total) || total <= 0) return fail('source not found: no daycare payments this plan year');
    return compare(c, Math.min(total, DCFSA_CAP_CENTS), null);
  }

  return fail(`cannot verify: unknown claim type "${type}"`);
}

/** Re-read the source row through a different query path than the producing agent used. */
export async function verify(c: Candidate, ctx: AgentContext): Promise<VerifyResult> {
  if (!c.sources || c.sources.length === 0) {
    return finish(c, ctx, fail('no source'), 'blocked');
  }
  try {
    const res = await check(c, ctx);
    return finish(c, ctx, res, res.ok ? 'ok' : 'blocked');
  } catch (e) {
    if (e instanceof InvalidId) return finish(c, ctx, fail('invalid id'), 'blocked');
    // Fail closed: an unchecked fact is never shown.
    return finish(c, ctx, fail(`could not verify: ${(e as Error).message}`), 'error');
  }
}

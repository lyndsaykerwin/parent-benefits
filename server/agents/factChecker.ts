import type { AgentContext, Candidate } from './types';

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
 * Anything else cannot be verified, so it fails closed.
 */

const CENT_TOLERANCE = 1;
const DAY_MS = 86_400_000;

/** Quote a text value for SQL (doubles single quotes). */
function q(v: string | number): string {
  return `'${String(v).replace(/'/g, "''")}'`;
}

function intId(v: string | number | undefined): number | null {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Date(d.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Read a column ignoring case (Zetaris may return headers in a different case). */
function col(row: Record<string, string | number | null>, name: string): string | number | null | undefined {
  const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? undefined : row[k];
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
    // Fail closed: an unchecked fact is never shown.
    return finish(c, ctx, fail(`could not verify: ${(e as Error).message}`), 'error');
  }
}

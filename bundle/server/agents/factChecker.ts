import type { AgentContext, Candidate } from './types';
import { InvalidId, quoteId as q, quoteInt, addDays, col, fmtUsd } from './sql';

export interface VerifyResult {
  ok: boolean;
  reason: string | null;
  corrected: Partial<Candidate> | null;
  /** true when the check could not run (source down or errored): the card is unchecked, not wrong. */
  unavailable?: boolean;
  /** true only when the producing agent can fix the card by being told what is wrong (an amount or date). false = drop the card, never send it back. */
  sendBack?: boolean;
  /** Which lines are wrong, in plain words (set together with sendBack: true). */
  fixes?: Fix[];
  /** The line-specific wording sent back to the producing agent: names each wrong field, never "try again". */
  instruction?: string;
}

export interface Fix { field: string; said: string; source: string }

/**
 * Claim shapes a producing agent must attach to `Candidate.claim` (keyed by `type`):
 *   rule     { type:'rule', ref: <benefit_rules.code> }            -> amount + deadline
 *   offer    { type:'offer', offerId: <offers.id> }                -> amount + deadline
 *   recall   { type:'recall', recallId: <CPSC RecallID> }          (or recallSource:'fda', recallNumber)
 *   clawback { type:'clawback', itemId: <purchase_items.id>, itemAmountCents }
 *   fsa_reimbursement { type, itemId, itemAmountCents }            -> card amount must equal the purchase item's price
 *   price_adjustment  { type, itemId, itemAmountCents }            -> amount = paid minus the lowest in-window price; deadline = purchase + store window
 * Money-back claims are checked against `purchase_items` (through the v_purchase_items view) only; the daycare claim was dropped (sign-off item 10).
 * Anything else cannot be verified, so it fails closed.
 */

const CENT_TOLERANCE = 1;

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
const drop = (reason: string): VerifyResult => ({ ok: false, reason, corrected: null, sendBack: false });

const money = (cents: number): string => fmtUsd(cents);

/** Wording for the producing agent: each wrong field on its own line, with what the card said and what the source says. */
export function correctionInstruction(fixes: Fix[]): string {
  return ['Fix only these lines and leave everything else unchanged:']
    .concat(fixes.map((f) => `- ${f.field}: the card says ${f.said} but the source says ${f.source}.`))
    .join('\n');
}

function withFixes(res: VerifyResult, fixes: Fix[]): VerifyResult {
  return fixes.length ? { ...res, sendBack: true, fixes, instruction: correctionInstruction(fixes) } : res;
}

/** Compare amount and deadline against the freshly read truth. */
function compare(c: Candidate, truthAmount: number | null | undefined, truthDeadline: string | null): VerifyResult {
  const reasons: string[] = [];
  const fixes: Fix[] = [];
  const corrected: Partial<Candidate> = {};
  if (c.amountCents !== null && truthAmount !== undefined && truthAmount !== null) {
    if (Math.abs(c.amountCents - truthAmount) > CENT_TOLERANCE) {
      reasons.push(`amount mismatch: card says ${c.amountCents}, source says ${truthAmount}`);
      corrected.amountCents = truthAmount;
      fixes.push({ field: 'amount', said: money(c.amountCents), source: money(truthAmount) });
    }
  }
  if (c.deadline !== null && truthDeadline !== null && c.deadline !== truthDeadline) {
    reasons.push(`deadline mismatch: card says ${c.deadline}, source says ${truthDeadline}`);
    corrected.deadline = truthDeadline;
    fixes.push({ field: 'deadline', said: c.deadline, source: truthDeadline });
  }
  return reasons.length ? withFixes(fail(reasons.join('; '), corrected), fixes) : { ok: true, reason: null, corrected: null };
}

function anchor(ctx: AgentContext): string | null {
  return ctx.family.birthDate ?? ctx.family.dueDate ?? null;
}

async function check(c: Candidate, ctx: AgentContext): Promise<VerifyResult> {
  const claim = c.claim ?? {};
  const type = String(claim.type ?? '');

  if (type === 'rule') {
    const sql = `SELECT amount_cents, window_end_days_from_birth, scope FROM bundle_pg.benefit_rules WHERE code = ${q(claim.ref)}`;
    const { rows } = await ctx.z.runQuery(sql);
    if (!rows.length) return fail(`source not found: rule ${claim.ref}`);
    // Wrong-state block: a rule is for everyone ("federal") or for one place only. Anything else never reaches this family.
    const scope = String(col(rows[0], 'scope') ?? '').trim();
    if (!scope) return drop('wrong state: the source does not say which place this program is for');
    if (scope.toLowerCase() !== 'federal' && scope.toUpperCase() !== String(ctx.family.state ?? '').trim().toUpperCase()) {
      return drop(`wrong state: this program is only for ${scope} families, not this family's state`);
    }
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
    // max_age_days is the oldest baby age the offer fits, not an end date, and offers have no end date: nothing to check a deadline against.
    return compare(c, col(rows[0], 'value_cents') as number | null, null);
  }

  if (type === 'recall') {
    // Loop 8: the alert must carry evidence, and the evidence must hold up against the recall's own text.
    const bad = checkRecallEvidence(claim);
    if (bad) return drop(bad);
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

  if (type === 'clawback' || type === 'fsa_reimbursement') {
    const sql = `SELECT price_cents AS amount_cents, family_id FROM bundle_pg.v_purchase_items WHERE id = ${quoteInt(claim.itemId)} AND family_id = ${q(ctx.family.id)}`;
    const { rows } = await ctx.z.runQuery(sql);
    if (!rows.length) return fail(`source not found: purchase item ${claim.itemId} for this family`);
    const truth = col(rows[0], 'amount_cents') as number | null;
    const claimed = Number(claim.itemAmountCents);
    if (truth === null || truth === undefined || !Number.isFinite(claimed) || Math.abs(claimed - truth) > CENT_TOLERANCE) {
      // The claimed refund is built on the item's price, so it cannot be trusted either.
      const res = fail(`amount mismatch: card used ${claim.itemAmountCents}, purchase item is ${truth ?? 'unpriced'}`);
      return typeof truth === 'number' && Number.isFinite(claimed)
        ? withFixes(res, [{ field: 'item price', said: money(claimed), source: money(truth) }]) : res;
    }
    return type === 'clawback' ? { ok: true, reason: null, corrected: null } : compare(c, truth, null);
  }

  if (type === 'price_adjustment') {
    // Independent path: pull every possible price row and apply the window rule here, in code.
    const sql =
      'SELECT p.price_cents AS amount_cents, p.purchased_on AS tx_date, sp.adjustment_window_days AS window_days, ' +
      'po.price_cents AS price_cents, po.observed_at AS observed_at ' +
      'FROM bundle_pg.v_purchase_items p ' +
      'JOIN bundle_pg.store_policies sp ON lower(sp.store) = lower(COALESCE(p.store, p.seller)) ' +
      'JOIN bundle_pg.price_observations po ON lower(po.store) = lower(sp.store) ' +
      "AND lower(p.product_name) LIKE concat('%', lower(po.keyword), '%') " +
      `WHERE p.id = ${quoteInt(claim.itemId)} AND p.family_id = ${q(ctx.family.id)}`;
    const { rows } = await ctx.z.runQuery(sql);
    if (!rows.length) return fail(`source not found: price check for purchase item ${claim.itemId}`);
    const paid = col(rows[0], 'amount_cents') as number;
    const claimed = Number(claim.itemAmountCents);
    if (!Number.isFinite(claimed) || Math.abs(claimed - paid) > CENT_TOLERANCE) {
      return fail(`amount mismatch: card used ${claim.itemAmountCents}, purchase item is ${paid}`);
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

  return fail(`cannot verify: unknown claim type "${type}"`);
}

/** Re-read the source row through a different query path than the producing agent used. */
export async function verify(c: Candidate, ctx: AgentContext): Promise<VerifyResult> {
  if (!c.sources || !c.sources.some((s) => /^https?:\/\/\S+/i.test(String(s?.url ?? '')))) {
    return finish(c, ctx, fail('no source'), 'blocked');
  }
  try {
    const res = await check(c, ctx);
    return finish(c, ctx, res, res.ok ? 'ok' : 'blocked');
  } catch (e) {
    if (e instanceof InvalidId) return finish(c, ctx, fail('invalid id'), 'blocked');
    // Fail closed: an unchecked fact is never shown.
    return finish(c, ctx, { ...fail(`could not verify: ${(e as Error).message}`), unavailable: true }, 'error');
  }
}

// ---------- Recall verification (loop 8) ----------

const norm = (t: unknown): string => String(t ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const EVIDENCE_TYPES = ['upc', 'lot', 'model', 'name', 'confirmed'] as const;

/** A code counts only as a whole word in the recall text ("ABC123" is not found inside "ABC1234"). */
function hasWholeCode(text: string, code: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(text);
}

/**
 * Does the evidence on a recall alert hold up against the recall record? Uses the recall text the producing agent
 * read in this run (`claim.recalledProduct`), so it needs no new query. Returns a reason when it does not, else null.
 *
 * The recall alert's claim must carry (field names agreed with W3-SAFETY, which produces them):
 *   evidence       the plain-English evidence line shown on the card
 *   evidenceType   'upc' | 'lot' | 'model' (an exact code), 'name' (whole recalled name inside what was bought),
 *                  or 'confirmed' (a looser match the AI confirmed; still needs both texts)
 *   evidenceCode   the code itself (for upc / lot / model)
 *   recalledProduct the product text from the recall record
 *   itemText       what the family bought
 */
export function checkRecallEvidence(claim: Record<string, string | number>): string | null {
  const evidence = String(claim.evidence ?? '').trim();
  if (!evidence) return 'no evidence: a recall alert needs an evidence line, so no alert';
  const type = String(claim.evidenceType ?? '');
  const recalled = norm(claim.recalledProduct);
  const mismatch = `evidence does not match the recall record: "${evidence.slice(0, 80)}"`;
  if (!(EVIDENCE_TYPES as readonly string[]).includes(type) || !recalled) return mismatch;
  if (type === 'upc') {
    const upc = String(claim.evidenceCode ?? '').replace(/\D+/g, '');
    const noZeros = (x: string) => x.replace(/^0+/, '');
    const found = upc.length >= 8 && recalled.replace(/\D+/g, ' ').split(' ').some((n) => n.length >= 8 && noZeros(n) === noZeros(upc));
    return found ? null : mismatch;
  }
  if (type === 'lot' || type === 'model') {
    const code = norm(claim.evidenceCode);
    const min = type === 'lot' ? 4 : 3;
    return code.length >= min && hasWholeCode(recalled, code) ? null : mismatch;
  }
  const item = norm(claim.itemText);
  if (!item) return mismatch;
  if (type === 'name') return recalled.length >= 4 && item.includes(recalled) ? null : mismatch;
  return null; // 'confirmed': both texts are present, and the AI's yes is shown as "likely", never "verified"
}

// ---------- Targeted corrections: the send-back loop (loop 3) ----------

/** The most send-backs one card gets. Recall verification and the other checks all live inside this cap. */
export const MAX_CORRECTION_ROUNDS = 2;

export interface CorrectionOutcome {
  /** approved = show it; rejected = drop it; unchecked = the source was down, so it is never shown as checked. */
  decision: 'approved' | 'rejected' | 'unchecked';
  card: Candidate;
  rounds: number;
  result: VerifyResult;
}

/** Re-derives a card after being told what is wrong; null = the producing agent gave up. */
export type Reviser = (card: Candidate, instruction: string) => Promise<Candidate | null>;

const DISPLAY: Record<string, string> = {
  benefits: 'BenefitsPlanner', clawback: 'ClawbackHunter', recall: 'RecallChecker', judge: 'FinePrintCourt',
  fine_print_court: 'FinePrintCourt', deal_hunter: 'FinePrintCourt', coach: 'CoachAI',
};

function logDecision(ctx: AgentContext, c: Candidate, action: 'approve_card' | 'reject_card' | 'correction', output: string, rounds: number): void {
  const retry = action === 'correction';
  ctx.trace.log({
    agent_name: 'fact_checker', action,
    input_summary: `${c.kind} card ${c.id} from ${c.agent}`.slice(0, 300),
    output_summary: output,
    target_agent: action === 'approve_card' ? 'ParentFeed' : retry ? (DISPLAY[c.agent] ?? c.agent) : null,
    confidence: action === 'approve_card' ? 1 : 0,
    retry_count: rounds,
    status: action === 'approve_card' ? 'ok' : retry ? 'retry' : 'blocked',
  });
}

function sendLessonSignal(ctx: AgentContext, lessonIds: string[], kind: 'helpful' | 'wrong'): void {
  for (const id of lessonIds) {
    try { ctx.workspace?.feedbackLesson(id, kind); } catch { /* a missing lesson never blocks a card */ }
  }
}

/**
 * Check one card, and send it back with line-specific wording (at most MAX_CORRECTION_ROUNDS times) while the producing
 * agent can still fix it. Wrong-state, no-source, no-evidence and unchecked cards are never sent back.
 * Logs the final yes as approve_card / approved (target ParentFeed). `opts.lessonIds` are the saved lessons the card
 * relied on: confirmed first time = helpful, needed a correction = wrong, unchecked = no signal.
 */
export async function checkWithCorrections(
  card: Candidate, ctx: AgentContext, revise: Reviser, opts: { lessonIds?: string[] } = {},
): Promise<CorrectionOutcome> {
  let current = card;
  let rounds = 0;
  let corrected = false;
  const lessons = opts.lessonIds ?? [];
  for (;;) {
    const result = await verify(current, ctx);
    if (result.ok) {
      logDecision(ctx, current, 'approve_card', rounds ? `verified after ${rounds} correction round(s)` : 'verified', rounds);
      if (lessons.length) sendLessonSignal(ctx, lessons, corrected ? 'wrong' : 'helpful');
      return { decision: 'approved', card: current, rounds, result };
    }
    if (result.unavailable) return { decision: 'unchecked', card: current, rounds, result };
    if (result.sendBack !== true || rounds >= MAX_CORRECTION_ROUNDS) {
      logDecision(ctx, current, 'reject_card', `${result.reason ?? 'failed'}${rounds ? ` (after ${rounds} correction round(s))` : ''}`, rounds);
      if (lessons.length && (corrected || result.fixes?.length)) sendLessonSignal(ctx, lessons, 'wrong');
      return { decision: 'rejected', card: current, rounds, result };
    }
    rounds += 1;
    corrected = true;
    const instruction = result.instruction ?? result.reason ?? 'fix the card';
    logDecision(ctx, current, 'correction', `round ${rounds}: ${instruction.replace(/\n/g, ' ')}`, rounds);
    try {
      ctx.workspace?.post({
        from_agent: 'FactChecker', to_agent: DISPLAY[current.agent] ?? current.agent, type: 'correction',
        about: current.id, body: instruction, evidence_sql: current.evidenceSql ?? '', round: rounds,
      });
    } catch { /* a note that cannot be saved never stops the check */ }
    const next = await revise(current, instruction);
    if (!next) {
      logDecision(ctx, current, 'reject_card', `producing agent gave up after correction round ${rounds}`, rounds);
      if (lessons.length) sendLessonSignal(ctx, lessons, 'wrong');
      return { decision: 'rejected', card: current, rounds, result };
    }
    current = next;
  }
}

import { askJson } from '../adapters/llm';
import { col, quoteInt, InvalidId, today, fmtUsd, eligibilityText } from './sql';
import type { FeedCard } from '../../shared/bundle';
import type { AgentContext, Candidate, CourtRuling } from './types';
import { offlineProblem } from './offerScreen';
import { checkFinePrint, finalVerdict, fingerprint } from './finePrintRules';
import type { SavedVerdict } from './savedVerdicts';
import { newsroomFor, quoted, MAX_REBUTTALS, type Newsroom, type OfferRef } from './newsroom';
import type { FinePrintCheck } from './types';
import { valueScore, worthSettings } from './valueScore';

const AGENT = 'fine_print_court';
const MAX_OFFERS = 5;

type Row = Record<string, string | number | null>;
const s = (r: Row, k: string) => String(col(r, k) ?? '');

interface Offer {
  id: number; title: string; store: string; trigger: string; valueCents: number | null;
  finePrint: string; sourceUrl: string; minAgeDays: number; maxAgeDays: number;
}
type Rule = { id: string; text: string; confidence: number };

function toOffer(r: Row): Offer {
  const v = col(r, 'value_cents');
  return {
    id: Number(col(r, 'id')), title: s(r, 'title'), store: s(r, 'store'), trigger: s(r, 'trigger_keyword').trim().toLowerCase(),
    valueCents: v === null || v === undefined ? null : Number(v), finePrint: s(r, 'fine_print'),
    sourceUrl: s(r, 'source_url'), minAgeDays: Number(col(r, 'min_age_days')), maxAgeDays: Number(col(r, 'max_age_days')),
  };
}

function log(ctx: AgentContext, agent: string, action: string, input: string, output: string,
  status: 'ok' | 'retry' | 'blocked' | 'error' | 'fallback' = 'ok', retry = 0): string {
  return ctx.trace.log({ agent_name: agent, action, input_summary: input.slice(0, 200), output_summary: output.slice(0, 200),
    target_agent: null, confidence: null, retry_count: retry, status });
}

/** Whole days from the baby's birth to today; negative while the baby is still due. */
export function babyAgeDays(ctx: AgentContext): number {
  const anchor = ctx.family.birthDate ?? ctx.family.dueDate;
  if (!anchor) return 0;
  return Math.round((Date.parse(`${ctx.today ?? today()}T00:00:00Z`) - Date.parse(`${anchor}T00:00:00Z`)) / 86_400_000);
}

// ---- deterministic screen (used only when the model is unavailable) ----
const GENERIC = new Set(['free', 'that', 'into', 'are', 'not', 'the', 'and', 'for', 'with', 'this', 'your', 'you', 'have', 'will', 'from', 'than', 'more', 'only', 'after', 'until', 'when']);
const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, '');
function keywords(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !GENERIC.has(w)).map(stem).filter((w) => w.length >= 3));
}
/** Does the fine print share at least two keywords (or all of them, if the rule has fewer) with a case-law rule? */
function ruleMatches(finePrint: string, rule: Rule): boolean {
  const rk = keywords(rule.text);
  const fk = keywords(finePrint);
  const shared = [...rk].filter((w) => fk.has(w)).length;
  return shared >= Math.min(2, rk.size) && shared > 0;
}
/** What an offline approval says. It never claims the AI court looked at the offer. */
export const OFFLINE_APPROVE_TEXT = "No flagged terms found. We couldn't fully check this offer's fine print.";

function screen(offer: Offer, rules: Rule[]): CourtRuling {
  const hit = rules.find((r) => ruleMatches(offer.finePrint, r));
  if (hit) return { verdict: 'reject', citedRuleIds: [hit.id], reason: `Court was offline; case law applies: ${hit.text}` };
  const problem = offlineProblem(offer.finePrint);
  if (problem) return { verdict: 'reject', citedRuleIds: [], reason: `Court was offline; ${problem}` };
  return { verdict: 'approve', citedRuleIds: [], reason: OFFLINE_APPROVE_TEXT };
}

function caseLawText(rules: Rule[]): string {
  return rules.length
    ? rules.map((r) => `- [${r.id}] (confidence ${r.confidence.toFixed(2)}) ${r.text}`).join('\n')
    : '(no case law on file for this fine print)';
}

async function argue(
  ctx: AgentContext, who: 'deal_hunter' | 'fine_print_lawyer', offer: Offer, extra: string, rebuttal = '',
): Promise<{ text: string; ok: boolean }> {
  const task = who === 'deal_hunter'
    ? 'You are the Deal Hunter. In 2 to 3 plain-English sentences, argue why this offer is a good deal for a new parent.'
    : 'You are the Fine Print Lawyer. In 2 to 3 plain-English sentences, argue what is wrong or costly in the fine print (hidden fees, trials that turn into paid plans, lock-ins). If nothing is wrong, say so.';
  const reply = rebuttal
    ? `\n\nREBUTTAL ROUND (your last chance to speak): ${rebuttal}\nIn 2 plain-English sentences, answer it. Stand by your side if you can back it up with the fine print; concede if you cannot.`
    : '';
  const prompt = `${task}\n\nOffer: ${quoted(offer.title)} at ${quoted(offer.store)}\nFine print: ${offer.finePrint || '(none)'}${extra}${reply}`;
  const action = rebuttal ? 'rebut' : 'argue';
  try {
    const text = (await ctx.llm.generate(prompt, undefined, 'fast')).trim().slice(0, 600);
    log(ctx, who, action, `offer ${offer.id}`, text, 'ok', rebuttal ? 1 : 0);
    return { text, ok: true };
  } catch {
    log(ctx, who, action, `offer ${offer.id}`, 'model unavailable', 'fallback', rebuttal ? 1 : 0);
    return { text: '(no argument: model unavailable)', ok: false };
  }
}

type Standing = 'agreed' | 'disputed' | 'fallback';
interface Judged {
  ruling: CourtRuling;
  usedFallback: boolean;
  check: FinePrintCheck;
  /** The court's final answer: the stricter of the code screen and the Judge. 'approve_with_catch' = approve, but count only the true value. */
  verdict: 'approve' | 'approve_with_catch' | 'reject';
  standing: Standing;
  rounds: number;
}

/**
 * Do the code screen and the Judge disagree? A catch (approve_with_catch) fits either answer. A code reject that the
 * Judge approves is a dispute. A code approve that the Judge rejects is a dispute unless the Judge cites recalled case
 * law (the code screen cannot see case law, so that is new information, not a disagreement).
 */
export function disagrees(code: FinePrintCheck['verdict'], ruling: CourtRuling): boolean {
  if (code === 'approve_with_catch') return false;
  if (code === 'reject') return ruling.verdict === 'approve';
  return ruling.verdict === 'reject' && ruling.citedRuleIds.length === 0;
}

async function judgeOne(ctx: AgentContext, offer: Offer, note: string, nr: Newsroom): Promise<Judged> {
  const recalled = ctx.memory.recallRules(offer.finePrint);
  const rules: Rule[] = recalled.map((r) => ({ id: r.id, text: r.text, confidence: r.confidence }));
  // One line per rule so the app can show which learned rule applied to which offer (id|confidence|parent reports|text).
  for (const r of recalled) log(ctx, 'memory', 'rule_recalled', `offer ${offer.id}`, `${r.id}|${r.confidence.toFixed(2)}|${r.reports}|${r.text}`);
  const check = checkFinePrint(offer.finePrint, { today: ctx.today ?? today() });
  const past = nr.context(toRef(offer));
  const extra = note ? `\nSend-back reason: ${note}` : '';
  const hunter = await argue(ctx, 'deal_hunter', offer, extra);
  const lawyer = await argue(ctx, 'fine_print_lawyer', offer, extra);
  const basePrompt = (h: string, l: string, tail: string) =>
    'You are the Judge in a Fine Print Court for a new-parent offer. Decide whether to approve or reject it. ' +
    'Reject offers that are not really free or cost the parent more than they save (hidden fees, trials that auto-renew into paid plans). ' +
    'Binding case law (cite the ids you rely on):\n' + caseLawText(rules) + past.promptText +
    `\n\nOffer: ${quoted(offer.title)} at ${quoted(offer.store)}\nFine print: ${offer.finePrint || '(none)'}${extra}` +
    `\n\nDeal Hunter argues: ${h}\nFine Print Lawyer argues: ${l}${tail}` +
    '\n\nReply as JSON: {"verdict":"approve"|"reject","citedRuleIds":["..."],"reason":"one plain sentence"}';
  const known = new Set(rules.map((r) => r.id));
  const fallback: CourtRuling = screen(offer, rules);
  const valid = (x: unknown): x is CourtRuling => {
    const v = x as any;
    return (v?.verdict === 'approve' || v?.verdict === 'reject') && Array.isArray(v?.citedRuleIds) &&
      v.citedRuleIds.every((i: unknown) => typeof i === 'string') && typeof v?.reason === 'string';
  };
  const clean = (value: CourtRuling): CourtRuling =>
    ({ verdict: value.verdict, citedRuleIds: value.citedRuleIds.filter((i) => known.has(i)), reason: value.reason.trim().slice(0, 300) });
  const logRule = (ruling: CourtRuling, fell: boolean, action: string, retry = 0) =>
    log(ctx, 'judge', fell ? 'rule_by_screen' : action, `offer ${offer.id}`,
      `${ruling.verdict}: ${ruling.reason}${ruling.citedRuleIds.length ? ` [cited ${ruling.citedRuleIds.join(', ')}]` : ''}`,
      ruling.verdict === 'reject' ? 'blocked' : fell ? 'fallback' : 'ok', retry);

  const first = await askJson<CourtRuling>(ctx.llm, basePrompt(hunter.text, lawyer.text, ''), valid, fallback);
  let ruling: CourtRuling = first.usedFallback ? first.value : clean(first.value);
  const usedFallback = first.usedFallback;
  logRule(ruling, usedFallback, 'rule');
  post(ctx, 'deal_hunter', 'judge', 'claim', offer, hunter.text, 0);
  post(ctx, 'fine_print_lawyer', 'judge', 'claim', offer, lawyer.text, 0);

  let rounds = 0;
  // Rebuttal: the code screen and the Judge disagree. One round only, both sides asked side by side, then the Judge rules again.
  if (!usedFallback && disagrees(check.verdict, ruling) && nr.canRebut(offer.id)) {
    nr.useRebuttal(offer.id);
    rounds = 1;
    const finding = check.verdict === 'reject'
      ? `the code screen found a problem (${check.reasons.join('; ') || 'a rule was broken'}) but the Judge approved`
      : `the code screen found nothing wrong, but the Judge rejected it ("${ruling.reason}")`;
    log(ctx, AGENT, 'court_debate', `offer ${offer.id} rebuttal round 1 of ${MAX_REBUTTALS}`,
      `code screen says ${check.verdict}; Judge said ${ruling.verdict}. Both sides answer once, then the Judge rules again`, 'retry', 1);
    post(ctx, 'judge', 'deal_hunter', 'question', offer, finding, 1);
    const rebuttal = `The Judge ruled "${ruling.verdict}", but ${finding}.`;
    const [h2, l2] = await Promise.all([
      argue(ctx, 'deal_hunter', offer, extra, rebuttal),
      argue(ctx, 'fine_print_lawyer', offer, extra, rebuttal),
    ]);
    post(ctx, 'deal_hunter', 'judge', 'answer', offer, h2.text, 1);
    post(ctx, 'fine_print_lawyer', 'judge', 'answer', offer, l2.text, 1);
    const second = await askJson<CourtRuling>(
      ctx.llm,
      basePrompt(h2.text, l2.text, `\n\nThis is the rebuttal round and your final ruling. Your first ruling was "${ruling.verdict}": ${ruling.reason}\nThe code screen says: ${check.verdict}${check.reasons.length ? ` (${check.reasons.join('; ')})` : ''}.`),
      valid, ruling,
    );
    if (!second.usedFallback) ruling = clean(second.value);
    logRule(ruling, false, 'rule_after_rebuttal', 1);
  }

  // The stricter answer wins: a code reject always stands; an uncited Judge reject also stands (blocking is the safe side).
  const stillDisputed = !usedFallback && disagrees(check.verdict, ruling);
  const verdict: Judged['verdict'] = usedFallback
    ? (ruling.verdict === 'reject' ? 'reject' : 'approve')
    : finalVerdict(check.verdict, ruling.verdict);
  if (verdict === 'reject' && ruling.verdict === 'approve') {
    ruling = { verdict: 'reject', citedRuleIds: ruling.citedRuleIds, reason: `The code check found a problem: ${check.reasons.join('; ') || 'a fine-print rule was broken'}` };
  }
  const standing: Standing = usedFallback ? 'fallback' : stillDisputed ? 'disputed' : 'agreed';
  log(ctx, AGENT, 'court_debate', `offer ${offer.id} outcome`, `${verdict}, ${standing}${rounds ? ` after ${rounds} rebuttal round` : ', no rebuttal needed'}`,
    verdict === 'reject' ? 'blocked' : 'ok', rounds);
  post(ctx, 'judge', 'fact_checker', 'verdict', offer, `${verdict} (${standing}): ${ruling.reason}`, rounds);
  return { ruling, usedFallback, check, verdict, standing, rounds };
}

/** Leave a note in the shared workspace when there is one. A workspace problem never stops the court. */
function post(ctx: AgentContext, from: string, to: string, type: 'claim' | 'question' | 'answer' | 'verdict', offer: Offer, body: string, round: number): void {
  if (!ctx.workspace) return;
  try { ctx.workspace.post({ from_agent: from, to_agent: to, type, about: `offer ${offer.id}`, body: body || '(empty)', evidence_sql: '', round }); } catch { /* notes are a courtesy */ }
}

function toCandidate(ctx: AgentContext, offer: Offer, j: Judged, retry: number, sql: string): Candidate {
  const traceId = ctx.trace.lines().filter((l) => l.agent_name === 'judge' && l.input_summary === `offer ${offer.id}`).pop()?.trace_id ?? '';
  const withCatch = j.verdict === 'approve_with_catch' && !j.usedFallback;
  // An approval with a catch counts only the true value (face value minus what the fine print makes you pay); never the headline number.
  const amountCents = withCatch
    ? (j.check.trueValueCents ?? (offer.valueCents !== null ? Math.max(0, offer.valueCents - j.check.hiddenCostCents) : null))
    : offer.valueCents;
  const worth = amountCents !== null ? ` worth about ${fmtUsd(amountCents)}` : '';
  const body = j.usedFallback
    ? `${offer.store} has an offer${worth}. ${j.ruling.reason} ${eligibilityText(offer.maxAgeDays)}`
    : withCatch
      ? `${offer.store} has an offer${worth} after the catch. Approved with a catch: ${j.check.reasons.join('; ')}. Only the true value is counted. ${eligibilityText(offer.maxAgeDays)}`
      : `${offer.store} has an offer${worth}. Our fine-print check found nothing that makes it costly. Likely a good deal. ${eligibilityText(offer.maxAgeDays)}`;
  return {
    id: `discount-${offer.id}`, kind: 'discount', title: offer.title, body,
    // The offers data has no end date (max_age_days is the oldest baby age it fits), so there is no deadline to show.
    amountCents, deadline: null,
    verdict: 'likely', sources: [{ label: `${offer.store} offer page`, url: offer.sourceUrl }], traceId,
    valueScore: valueScore(j.check, worthSettings()),
    agent: AGENT, claim: { type: 'offer', offerId: offer.id }, evidenceSql: sql, retryCount: retry,
    ...(withCatch ? { courtVerdict: 'approve_with_catch' as const } : {}),
  };
}

/** A rejected offer as a card for the "We caught these for you" list. No amount, so it can never be added into a total. */
function toBlockedCard(ctx: AgentContext, offer: Offer, ruling: CourtRuling): FeedCard {
  const traceId = ctx.trace.lines().filter((l) => l.agent_name === 'judge' && l.input_summary === `offer ${offer.id}`).pop()?.trace_id ?? '';
  return {
    id: `blocked-${offer.id}`, kind: 'discount', title: offer.title, body: ruling.reason,
    amountCents: null, deadline: null, verdict: 'blocked',
    sources: offer.sourceUrl ? [{ label: `${offer.store} offer page`, url: offer.sourceUrl }] : [], traceId,
  };
}

/** Is `needle` a whole word or phrase in `hay` (a plural -s/-es is fine: "diaper" matches "diapers", "dia" does not match "diaper")? */
function wholeWord(needle: string, hay: string): boolean {
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${esc}(?:e?s)?($|[^a-z0-9])`, 'i').test(hay);
}

const OFFER_COLS = 'id, title, store, min_age_days, max_age_days, trigger_keyword, value_cents, fine_print, source_url';

/**
 * Offers go to court: Deal Hunter argues for, Fine Print Lawyer against, Judge rules with recalled case law.
 * Reads bundle_pg.v_judge_offers (offer columns only, no family data); the baby's age picks the offers in code.
 */
export async function judgeOffers(
  ctx: AgentContext,
  input: { ageDays: number; purchaseKeywords: string[]; includeGeneral: boolean },
): Promise<Candidate[]> {
  quoteInt(input.ageDays); // throws on a non-number
  // One query for every offer (it holds no family data, so it is the same for everyone and can be saved for replay); the age window is applied here.
  const sql = `SELECT ${OFFER_COLS} FROM bundle_pg.v_judge_offers ORDER BY id`;
  const { rows } = await ctx.z.runQuery(sql);
  const kws = input.purchaseKeywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
  const offers = rows.map(toOffer).filter((o) => o.minAgeDays <= input.ageDays && o.maxAgeDays >= input.ageDays);
  const triggered = offers.filter((o) => o.trigger && kws.some((k) => wholeWord(o.trigger, k) || (k.length >= 3 && wholeWord(k, o.trigger))));
  const general = input.includeGeneral ? offers.filter((o) => !o.trigger) : [];
  const picked = [...triggered, ...general].slice(0, MAX_OFFERS);
  log(ctx, AGENT, 'select_offers', `age ${input.ageDays}d, ${kws.length} keyword(s)`, `${picked.length} offer(s) go to court (cap ${MAX_OFFERS})`);

  // Newsroom loop: what is already saved (one Zetaris question) and what earlier checks taught the memory.
  const nr = newsroomFor(ctx, (agent, action, input, output, status) => log(ctx, agent, action, input, output, status));
  await nr.load(picked.map(toRef));

  const out: Candidate[] = [];
  for (const offer of picked) {
    const reuse = nr.reusable(toRef(offer), fingerprint(offer.finePrint));
    if (reuse) {
      // Skip the AI: reuse the grade both sides already agreed on.
      const { saved } = reuse;
      const why = reuse.reason === 'same_fingerprint'
        ? 'same wording as when it was graded, so the saved grade is reused (no AI)'
        : 'a rule that holds for every family already rejected this offer, so the saved grade is reused (no AI)';
      log(ctx, 'judge', 'reuse_saved_grade', `offer ${offer.id}`, `${saved.verdict}: ${why}`, saved.verdict === 'reject' ? 'blocked' : 'ok');
      if (saved.verdict === 'reject') addBlocked(ctx, toBlockedCard(ctx, offer, { verdict: 'reject', citedRuleIds: saved.ruleCitations, reason: 'An earlier check of this offer found a catch in the fine print.' }));
      else out.push(savedCandidate(ctx, offer, saved, sql));
      continue;
    }
    const j = await judgeOne(ctx, offer, '', nr);
    if (j.standing === 'agreed') await nr.writeBack(toRef(offer), j.check, j.verdict, j.ruling.citedRuleIds);
    else if (j.standing === 'disputed') log(ctx, AGENT, 'offer_check_skipped', `offer ${offer.id}`, 'grade not saved: the two sides did not agree');
    if (j.verdict !== 'reject') out.push(toCandidate(ctx, offer, j, 0, sql));
    else addBlocked(ctx, toBlockedCard(ctx, offer, j.ruling));
  }
  return out;
}

const toRef = (o: Offer): OfferRef => ({ id: o.id, store: o.store, title: o.title, finePrint: o.finePrint, sourceUrl: o.sourceUrl });

/** A retried run must not list the same offer twice: replace any earlier entry for it. */
function addBlocked(ctx: AgentContext, card: FeedCard): void {
  if (!ctx.blocked) return;
  const at = ctx.blocked.findIndex((b) => b.id === card.id);
  if (at >= 0) ctx.blocked[at] = card; else ctx.blocked.push(card);
}

/**
 * The Value Score for a reused saved grade. Only the saved numbers are used (true value, effort, steps, wait);
 * what the saved row does not hold (catch types, exact min effort) is left empty, never guessed.
 */
function savedValueScore(saved: SavedVerdict, amountCents: number | null): FeedCard['valueScore'] {
  const steps = saved.stepsCount ?? 0;
  const minutes = saved.effortMinutesEstimate ?? 0;
  const check = {
    verdict: saved.verdict === 'reject' ? 'reject' : saved.verdict === 'approve_with_catch' ? 'approve_with_catch' : 'approve',
    reasons: [], trueValueCents: saved.trueValueCents ?? amountCents,
    effortMinutesEstimate: { min: minutes, max: minutes },
    effortLevel: steps >= 3 ? 'high' : steps >= 1 ? 'medium' : 'low',
    stepsCount: steps, payoutWaitDaysMin: saved.payoutWaitDaysMax, payoutWaitDaysMax: saved.payoutWaitDaysMax, catchTypes: [],
  } as unknown as FinePrintCheck;
  return valueScore(check, worthSettings());
}

/** An approved offer rebuilt from a saved grade. Counts the saved true value when there is one. */
function savedCandidate(ctx: AgentContext, offer: Offer, saved: SavedVerdict, sql: string): Candidate {
  const traceId = ctx.trace.lines().filter((l) => l.agent_name === 'judge' && l.input_summary === `offer ${offer.id}`).pop()?.trace_id ?? '';
  const withCatch = saved.verdict === 'approve_with_catch';
  const amountCents = withCatch ? (saved.trueValueCents ?? null) : (offer.valueCents ?? saved.trueValueCents);
  const worth = amountCents !== null ? ` worth about ${fmtUsd(amountCents)}` : '';
  return {
    id: `discount-${offer.id}`, kind: 'discount', title: offer.title,
    body: withCatch
      ? `${offer.store} has an offer${worth} after the catch. An earlier check of this same wording approved it with a catch. Only the true value is counted. ${eligibilityText(offer.maxAgeDays)}`
      : `${offer.store} has an offer${worth}. An earlier check of this same wording found nothing that makes it costly. Likely a good deal. ${eligibilityText(offer.maxAgeDays)}`,
    amountCents, deadline: null, // no end date in the offers data
    verdict: 'likely', sources: [{ label: `${offer.store} offer page`, url: offer.sourceUrl }], traceId,
    valueScore: savedValueScore(saved, amountCents),
    agent: AGENT, claim: { type: 'offer', offerId: offer.id }, evidenceSql: sql, retryCount: 0,
    ...(withCatch ? { courtVerdict: 'approve_with_catch' as const } : {}),
  };
}

/** Re-judge one offer after the Fact-Checker sent it back, with the reason added. null = give up. */
export async function revise(c: Candidate, reason: string, ctx: AgentContext): Promise<Candidate | null> {
  try {
    const id = quoteInt(c.claim.offerId);
    const sql = `SELECT ${OFFER_COLS} FROM bundle_pg.v_judge_offers WHERE id = ${id}`;
    const { rows } = await ctx.z.runQuery(sql);
    log(ctx, AGENT, 'revise', `offer ${id}: ${reason}`, 're-judging with the reason', 'retry', c.retryCount + 1);
    if (!rows.length) return null;
    const offer = toOffer(rows[0]);
    const nr = newsroomFor(ctx, (agent, action, input, output, status) => log(ctx, agent, action, input, output, status));
    const j = await judgeOne(ctx, offer, reason, nr);
    if (j.standing === 'agreed') await nr.writeBack(toRef(offer), j.check, j.verdict, j.ruling.citedRuleIds);
    return j.verdict !== 'reject' ? toCandidate(ctx, offer, j, c.retryCount + 1, sql) : null;
  } catch (e) {
    if (e instanceof InvalidId) return null;
    throw e;
  }
}

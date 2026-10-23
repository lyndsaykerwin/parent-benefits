import { askJson } from '../adapters/llm';
import { col, quoteInt, InvalidId, addDays, today, fmtUsd } from './sql';
import type { FeedCard } from '../../shared/bundle';
import type { AgentContext, Candidate, CourtRuling } from './types';
import { offlineProblem } from './offerScreen';

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
export const OFFLINE_APPROVE_TEXT = 'Offline screen: no flagged terms found. Not reviewed by the AI court.';

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

async function argue(ctx: AgentContext, who: 'deal_hunter' | 'fine_print_lawyer', offer: Offer, extra: string): Promise<{ text: string; ok: boolean }> {
  const task = who === 'deal_hunter'
    ? 'You are the Deal Hunter. In 2 to 3 plain-English sentences, argue why this offer is a good deal for a new parent.'
    : 'You are the Fine Print Lawyer. In 2 to 3 plain-English sentences, argue what is wrong or costly in the fine print (hidden fees, trials that turn into paid plans, lock-ins). If nothing is wrong, say so.';
  const prompt = `${task}\n\nOffer: ${offer.title} at ${offer.store}\nFine print: ${offer.finePrint || '(none)'}${extra}`;
  try {
    const text = (await ctx.llm.generate(prompt, undefined, 'fast')).trim().slice(0, 600);
    log(ctx, who, 'argue', `offer ${offer.id}`, text, 'ok');
    return { text, ok: true };
  } catch {
    log(ctx, who, 'argue', `offer ${offer.id}`, 'model unavailable', 'fallback');
    return { text: '(no argument: model unavailable)', ok: false };
  }
}

async function judgeOne(ctx: AgentContext, offer: Offer, note: string): Promise<{ ruling: CourtRuling; usedFallback: boolean }> {
  const recalled = ctx.memory.recallRules(offer.finePrint);
  const rules: Rule[] = recalled.map((r) => ({ id: r.id, text: r.text, confidence: r.confidence }));
  // One line per rule so the app can show which learned rule applied to which offer (id|confidence|parent reports|text).
  for (const r of recalled) log(ctx, 'memory', 'rule_recalled', `offer ${offer.id}`, `${r.id}|${r.confidence.toFixed(2)}|${r.reports}|${r.text}`);
  const extra = note ? `\nSend-back reason: ${note}` : '';
  const hunter = await argue(ctx, 'deal_hunter', offer, extra);
  const lawyer = await argue(ctx, 'fine_print_lawyer', offer, extra);
  const prompt =
    'You are the Judge in a Fine Print Court for a new-parent offer. Decide whether to approve or reject it. ' +
    'Reject offers that are not really free or cost the parent more than they save (hidden fees, trials that auto-renew into paid plans). ' +
    'Binding case law (cite the ids you rely on):\n' + caseLawText(rules) +
    `\n\nOffer: ${offer.title} at ${offer.store}\nFine print: ${offer.finePrint || '(none)'}${extra}` +
    `\n\nDeal Hunter argues: ${hunter.text}\nFine Print Lawyer argues: ${lawyer.text}` +
    '\n\nReply as JSON: {"verdict":"approve"|"reject","citedRuleIds":["..."],"reason":"one plain sentence"}';
  const known = new Set(rules.map((r) => r.id));
  const fallback: CourtRuling = screen(offer, rules);
  const { value, usedFallback } = await askJson<CourtRuling>(
    ctx.llm, prompt,
    (x): x is CourtRuling => {
      const v = x as any;
      return (v?.verdict === 'approve' || v?.verdict === 'reject') && Array.isArray(v?.citedRuleIds) &&
        v.citedRuleIds.every((i: unknown) => typeof i === 'string') && typeof v?.reason === 'string';
    },
    fallback,
  );
  const ruling: CourtRuling = usedFallback
    ? value
    : { verdict: value.verdict, citedRuleIds: value.citedRuleIds.filter((i) => known.has(i)), reason: value.reason.trim().slice(0, 300) };
  const status = ruling.verdict === 'reject' ? 'blocked' : usedFallback ? 'fallback' : 'ok';
  log(ctx, 'judge', usedFallback ? 'rule_by_screen' : 'rule', `offer ${offer.id}`,
    `${ruling.verdict}: ${ruling.reason}${ruling.citedRuleIds.length ? ` [cited ${ruling.citedRuleIds.join(', ')}]` : ''}`, status);
  return { ruling, usedFallback };
}

function toCandidate(ctx: AgentContext, offer: Offer, ruling: CourtRuling, retry: number, sql: string, usedFallback: boolean): Candidate {
  const anchor = ctx.family.birthDate ?? ctx.family.dueDate;
  const worth = offer.valueCents !== null ? ` worth about ${fmtUsd(offer.valueCents)}` : '';
  const traceId = ctx.trace.lines().filter((l) => l.agent_name === 'judge' && l.input_summary === `offer ${offer.id}`).pop()?.trace_id ?? '';
  return {
    id: `discount-${offer.id}`, kind: 'discount', title: offer.title,
    body: usedFallback
      ? `${offer.store} has an offer${worth}. ${ruling.reason}`
      : `${offer.store} has an offer${worth}. Our fine-print check found nothing that makes it costly. Likely a good deal.`,
    amountCents: offer.valueCents, deadline: anchor ? addDays(anchor, offer.maxAgeDays) : null,
    verdict: 'likely', sources: [{ label: `${offer.store} offer page`, url: offer.sourceUrl }], traceId,
    agent: AGENT, claim: { type: 'offer', offerId: offer.id }, evidenceSql: sql, retryCount: retry,
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

  const out: Candidate[] = [];
  for (const offer of picked) {
    const { ruling, usedFallback } = await judgeOne(ctx, offer, '');
    if (ruling.verdict === 'approve') out.push(toCandidate(ctx, offer, ruling, 0, sql, usedFallback));
    else ctx.blocked?.push(toBlockedCard(ctx, offer, ruling));
  }
  return out;
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
    const { ruling, usedFallback } = await judgeOne(ctx, offer, reason);
    return ruling.verdict === 'approve' ? toCandidate(ctx, offer, ruling, c.retryCount + 1, sql, usedFallback) : null;
  } catch (e) {
    if (e instanceof InvalidId) return null;
    throw e;
  }
}

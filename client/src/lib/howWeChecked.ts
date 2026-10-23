import type { FeedCard } from '@shared/bundle';
import type { TraceLine } from './bundle';

/** Plain-English names for the tables Zetaris reads. Order = display order. */
const SOURCE_NAMES: { re: RegExp; name: string }[] = [
  { re: /\bv_planner_family\b/i, name: 'Your family profile (private, Neon)' },
  { re: /\bv_recall_orders\b|\bv_clawback_tx\b/i, name: 'Your purchases (private, Neon)' },
  { re: /\bcpsc_recalls\b/i, name: 'CPSC recall list (live government feed)' },
  { re: /\bfda_food_recalls\b/i, name: 'openFDA food recalls' },
  { re: /\bbenefit_rules\b/i, name: 'Program rules' },
  { re: /\bv_judge_offers\b/i, name: 'Offers' },
  { re: /\bfsa_eligible_categories\b/i, name: 'FSA eligibility list' },
  { re: /\bstore_policies\b/i, name: 'Store price-adjustment policies' },
  { re: /\bprice_observations\b/i, name: 'Observed prices' },
  { re: /\bpoverty_guidelines\b/i, name: 'Federal poverty guidelines' },
];

/** Which plain-English sources a SQL statement reads. Unknown tables are left out (never guessed). */
export function sourceNames(sql: string): string[] {
  return SOURCE_NAMES.filter((s) => s.re.test(sql)).map((s) => s.name);
}

/** SQL safe to show: string literals become '?', and any income column is hidden. */
export function redactSql(sql: string): string {
  return sql
    .replace(/'(?:[^']|'')*'?/g, "'?'")
    .replace(/\b\w*income\w*\b/gi, '[hidden]');
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Patterns that tie a Zetaris query to ONE card, from the card's own id. Empty when we cannot tell. */
function cardKeyPatterns(card: FeedCard): RegExp[] {
  const id = card.id;
  let m: RegExpMatchArray | null;
  if ((m = id.match(/^recall-cpsc-(\d+)$/))) return [new RegExp(`cpsc_recalls\\b[^;]*\\bRecallID\\s*=\\s*${m[1]}\\b`, 'i')];
  if ((m = id.match(/^(?:discount|blocked)-(\d+)$/))) return [new RegExp(`v_judge_offers\\s+WHERE\\s+id\\s*=\\s*${m[1]}\\b`, 'i')];
  if ((m = id.match(/^benefit-(.+)$/))) return [new RegExp(`benefit_rules\\s+WHERE\\s+code\\s*=\\s*'${esc(m[1])}'`, 'i')];
  if ((m = id.match(/^clawback-(?:fsa|price)-(.+)$/))) return [new RegExp(`v_clawback_tx\\s+WHERE\\s+id\\s*=\\s*'${esc(m[1])}'`, 'i')];
  return [];
}

/** Run-wide queries a whole kind of card is built from (looked up by table, never by position). */
function kindOriginPatterns(card: FeedCard): RegExp[] {
  switch (card.kind) {
    case 'recall': return [/\bv_recall_orders\b/i];
    case 'discount': return [/\bv_judge_offers\s+ORDER\s+BY\b/i];
    case 'benefit': return [/\bbenefit_rules\s+ORDER\s+BY\b/i];
    default: return [];
  }
}

export interface ZetarisView {
  sources: string[];
  queries: number;
  ms: number | null;
  saved: boolean;
  sql: string[];
}

/** What Zetaris did for this card. Null when no query can be tied to it (we show nothing then). */
export function zetarisForCard(card: FeedCard, lines: TraceLine[]): ZetarisView | null {
  const keys = cardKeyPatterns(card);
  const origin = kindOriginPatterns(card);
  if (keys.length + origin.length === 0) return null;
  const hits = lines.filter((l) => l.agent_name === 'zetaris' && l.status !== 'error'
    && /^query/.test(l.action) && [...keys, ...origin].some((re) => re.test(l.input_summary)));
  if (hits.length === 0) return null;
  const sources = [...new Set(hits.flatMap((l) => sourceNames(l.input_summary)))];
  if (sources.length === 0) return null;
  const saved = hits.every((l) => l.action === 'query_cached');
  const live = hits.map((l) => /in (\d+) ms/.exec(l.output_summary)?.[1]).filter((x): x is string => !!x).map(Number);
  const ms = saved || live.length === 0 ? null : live.reduce((a, b) => a + b, 0);
  const sql = [...new Set(hits.map((l) => redactSql(l.input_summary) + (l.input_summary.length >= 200 ? ' …' : '')))];
  return { sources, queries: hits.length, ms, saved, sql };
}

export interface MemoryRuleView { id: string; text: string; confidence: number; reports: number; cited: boolean }

/** Learned rules recalled for a discount card's offer (from the memory lines the court logs). */
export function memoryForCard(card: FeedCard, lines: TraceLine[]): MemoryRuleView[] {
  const m = card.id.match(/^(?:discount|blocked)-(\d+)$/);
  if (!m) return [];
  const cited = new Set<string>();
  for (const l of lines) {
    if (l.agent_name === 'judge' && l.input_summary === `offer ${m[1]}`) {
      for (const c of l.output_summary.matchAll(/\[cited ([^\]]+)\]/g)) c[1].split(',').forEach((x) => cited.add(x.trim()));
    }
  }
  const out = new Map<string, MemoryRuleView>();
  for (const l of lines) {
    if (l.agent_name !== 'memory' || l.action !== 'rule_recalled' || l.input_summary !== `offer ${m[1]}`) continue;
    const parts = l.output_summary.split('|');
    if (parts.length < 4) continue;
    const confidence = Number(parts[1]);
    const reports = Number(parts[2]);
    if (!parts[0] || !Number.isFinite(confidence) || !Number.isFinite(reports)) continue;
    out.set(parts[0], { id: parts[0], text: parts.slice(3).join('|'), confidence, reports, cited: cited.has(parts[0]) });
  }
  return [...out.values()];
}

/** One plain line saying why the court blocked an offer. */
export function blockedReason(card: FeedCard): string {
  const one = card.body.replace(/^Court was offline;\s*/i, '').replace(/^case law applies:\s*/i, 'A rule parents taught us applies: ');
  const first = one.split(/(?<=[.!?])\s/)[0] ?? one;
  const text = first.charAt(0).toUpperCase() + first.slice(1);
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

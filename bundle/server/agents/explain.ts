import { askJson } from '../adapters/llm';
import type { AgentContext } from './types';

const MONEY = /\$\s?(\d[\d,]*(?:\.\d+)?)/g;

/** Every dollar figure mentioned in the text, as a number. */
function amountsIn(text: string): number[] {
  return [...text.matchAll(MONEY)].map((m) => Number(m[1].replace(/,/g, '')));
}

/**
 * The model writes only the card's explanation. Numbers come from code: if the
 * model's text mentions a dollar figure we did not give it, we throw the text away
 * and use the deterministic fallback.
 */
export async function explain(
  ctx: AgentContext,
  agent: string,
  facts: string,
  allowedCents: number[],
  fallback: string,
): Promise<string> {
  const allowed = new Set(allowedCents.map((c) => Math.round(c) / 100));
  const prompt =
    'Write a short, friendly explanation (1 to 2 sentences, plain English, no jargon) for a new parent about this finding. ' +
    'Say "likely eligible", never "eligible". Do not give advice. Use ONLY the dollar amounts listed in the facts. ' +
    'Reply as JSON: {"body": "..."}.\n\nFacts:\n' + facts;
  const { value, usedFallback } = await askJson<{ body: string }>(
    ctx.llm,
    prompt,
    (x): x is { body: string } => {
      const b = (x as any)?.body;
      return typeof b === 'string' && b.trim().length > 0 && b.length <= 500 && amountsIn(b).every((n) => allowed.has(n));
    },
    { body: fallback },
  );
  if (usedFallback) {
    ctx.trace.log({
      agent_name: agent, action: 'explain', input_summary: facts.slice(0, 120),
      output_summary: 'used deterministic text', target_agent: null, confidence: null, retry_count: 0, status: 'fallback',
    });
  }
  return value.body.trim();
}

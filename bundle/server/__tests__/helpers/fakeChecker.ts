import type { Candidate } from '../../agents/types';

/**
 * Tests that automock '../agents/factChecker' use this to stand in for the real checkWithCorrections (which has its own tests in
 * factChecker.test.ts): ask the mocked verify, send the card back while it is wrong, stop after maxRounds (default 2).
 */
export function useFakeCheckWithCorrections(fc: { verify: unknown; checkWithCorrections: unknown }): void {
  (fc.checkWithCorrections as jest.Mock).mockImplementation(async (card: Candidate, ctx: any, revise: any, opts: { maxRounds?: number } = {}) => {
    let current = card;
    let rounds = 0;
    for (;;) {
      const result = await (fc.verify as jest.Mock)(current, ctx);
      if (result.ok) {
        ctx.trace.log({ agent_name: 'fact_checker', action: 'approve_card', input_summary: current.id, output_summary: 'verified', target_agent: 'ParentFeed', confidence: 1, retry_count: rounds, status: 'ok' });
        return { decision: 'approved', card: current, rounds, result };
      }
      if (result.unavailable) return { decision: 'unchecked', card: current, rounds, result };
      if (rounds >= (opts.maxRounds ?? 2)) {
        ctx.trace.log({ agent_name: 'fact_checker', action: 'reject_card', input_summary: current.id, output_summary: result.reason, target_agent: null, confidence: 0, retry_count: rounds, status: 'blocked' });
        return { decision: 'rejected', card: current, rounds, result };
      }
      rounds += 1;
      const next = await revise(current, `${result.reason}${result.corrected ? ` (corrected values: ${JSON.stringify(result.corrected)})` : ''}`);
      if (!next) {
        ctx.trace.log({ agent_name: 'fact_checker', action: 'reject_card', input_summary: current.id, output_summary: 'gave up', target_agent: null, confidence: 0, retry_count: rounds, status: 'blocked' });
        return { decision: 'rejected', card: current, rounds, result };
      }
      current = next;
    }
  });
}

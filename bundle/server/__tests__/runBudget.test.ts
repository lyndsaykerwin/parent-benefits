import os from 'os';
import fs from 'fs';
import path from 'path';

jest.mock('../agents/clawback');
jest.mock('../agents/recall');
jest.mock('../agents/finePrintCourt');
jest.mock('../agents/benefits', () => ({ ...jest.requireActual('../agents/benefits'), planBenefits: jest.fn(), revise: jest.fn() }));
jest.mock('../agents/factChecker');

import * as clawback from '../agents/clawback';
import * as recall from '../agents/recall';
import * as court from '../agents/finePrintCourt';
import * as benefits from '../agents/benefits';
import * as fc from '../agents/factChecker';
import { runBundle, BANNER } from '../agents/orchestrator';
import { RunEventHub } from '../agents/runEvents';
import { FakeGenerator } from '../adapters/llm';
import { useFakeCheckWithCorrections } from './helpers/fakeChecker';
import type { Candidate } from '../agents/types';
import type { Family } from '../../shared/bundle';

const maya: Family = {
  id: 'maya', userId: null, isGuest: true, name: 'Maya', birthDate: '2026-10-03', dueDate: null,
  zip: '02139', state: 'MA', employer: 'N', householdSize: 3, annualIncomeCents: 14500000, dcfsaOffered: true, dataConnected: true,
};
const cand = (id: string, kind: Candidate['kind'], agent: string): Candidate => ({
  id, kind, title: id, body: 'b', amountCents: 100, deadline: null, verdict: 'likely', sources: [{ label: 's', url: 'https://x' }],
  traceId: 't', agent, claim: { type: 'rule', ref: id }, evidenceSql: 'SELECT 1', retryCount: 0,
});

function setup(clock: { t: number }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-'));
  (clawback.findClawbacks as jest.Mock).mockResolvedValue([]);
  (recall.checkRecalls as jest.Mock).mockResolvedValue({ candidates: [], itemsChecked: 3 });
  (benefits.planBenefits as jest.Mock).mockResolvedValue([cand('benefit-a', 'benefit', 'benefits'), cand('benefit-b', 'benefit', 'benefits')]);
  (court.judgeOffers as jest.Mock).mockResolvedValue([cand('discount-1', 'discount', 'fine_print_court'), cand('discount-2', 'discount', 'fine_print_court')]);
  (court.lessonIdsFor as jest.Mock).mockReturnValue([]);
  (fc.verify as jest.Mock).mockResolvedValue({ ok: true, reason: null, corrected: null });
  useFakeCheckWithCorrections(fc);
  const z = { runQuery: jest.fn(async () => ({ headers: [], rows: [], ms: 1 })) } as any;
  const memory = { exportLedger: jest.fn((f: string) => fs.writeFileSync(f, '')), recallRules: jest.fn(() => []) } as any;
  return { dir, deps: { z, llm: new FakeGenerator([]), memory, loadFamily: async () => maya, logsDir: dir, today: '2026-10-23', budgetMs: 1000, now: () => clock.t } };
}

describe('run budget (no real waiting: fake clock)', () => {
  it('within budget: every card is checked, no deadline line', async () => {
    const clock = { t: 0 };
    const { deps, dir } = setup(clock);
    const r = await runBundle('maya', deps);
    expect(r.banner).toBeNull();
    expect(fc.checkWithCorrections).toHaveBeenCalledTimes(4);
    expect(fs.readFileSync(path.join(dir, fs.readdirSync(dir).find((f) => f.startsWith('run-'))!), 'utf8')).not.toContain('run deadline');
  });

  it('over budget before checking starts: no new checks, stand-ins fill the feed, banner, event stream finishes, plainly logged', async () => {
    const clock = { t: 0 };
    const { deps, dir } = setup(clock);
    (benefits.planBenefits as jest.Mock).mockImplementation(async () => { clock.t = 5000; return [cand('benefit-a', 'benefit', 'benefits')]; });
    const events = new RunEventHub();
    const r = await runBundle('maya', { ...deps, runId: 'maya-budget', events });
    expect(fc.checkWithCorrections).not.toHaveBeenCalled();
    expect(r.banner).toBe(BANNER);
    expect(r.cards.filter((c) => c.kind === 'benefit').length).toBeGreaterThanOrEqual(2);
    for (const c of r.cards.filter((c) => c.kind === 'benefit' || c.kind === 'discount')) expect(c.verdict).toBe('info'); // nothing unchecked is shown as checked
    expect(events.isFinished('maya-budget')).toBe(true);
    expect((events.history('maya-budget') as any[]).filter((e) => e.type === 'card_removed').map((e) => e.cardId).sort()).toEqual(['benefit-a', 'discount-1', 'discount-2']);
    const text = fs.readFileSync(path.join(dir, fs.readdirSync(dir).find((f) => f.startsWith('run-'))!), 'utf8');
    expect(text.match(/fallback: run deadline/g)!.length).toBeGreaterThanOrEqual(1);
    expect(text.split('\n').filter((l) => l.includes('"run_deadline"'))).toHaveLength(1); // said once
  });

  it('budget runs out mid-way: cards already checked stay, the rest are skipped, and no card is sent back for another correction', async () => {
    const clock = { t: 0 };
    const { deps } = setup(clock);
    (fc.verify as jest.Mock).mockImplementation(async (c: Candidate) => {
      if (c.id === 'benefit-a') { clock.t = 5000; return { ok: true, reason: null, corrected: null }; } // the clock jumps while checking the first card
      return { ok: false, reason: 'wrong', corrected: null };
    });
    const r = await runBundle('maya', deps);
    const real = r.cards.filter((c) => c.verdict === 'likely' || c.verdict === 'verified').map((c) => c.id);
    expect(real).toEqual(['benefit-a']);
    expect(benefits.revise).not.toHaveBeenCalled();
    expect(r.banner).toBe(BANNER);
  });
});

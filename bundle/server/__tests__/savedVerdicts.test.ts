/**
 * W2-ZREG: the saved-verdict query (item 38) and the `zetaris:record` command.
 * Uses a fake Zetaris and fake fetch; no network, no live keys. Saved answers in these tests are made by the
 * recording code path itself (never hand-written into data/sample/zetaris-cache/).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZetarisClient, ZetarisUnavailable } from '../adapters/zetaris';
import {
  savedVerdictsSql, familyProfileSql, coachIssuesSql, offerAuditSql, offerAuditBySourceSql, fetchSavedVerdicts, canSkipAi, SAVED_VERDICT_COLUMNS,
} from '../agents/savedVerdicts';
import { VIEWS } from '../../scripts/zetaris/register';
import { buildQuestions, recordAll } from '../../scripts/zetaris/record';

const ROW = {
  offer_id: '7', store: 'Made-up Store', verdict: 'approve_with_catch', status: 'agreed', rule_citations: '["FP-02"]',
  true_value_cents: 4000, effort_minutes_estimate: 15, steps_count: 3, payout_wait_days_max: 56, claim_window_days: 30,
  fine_print_hash: 'abc', universal_rule: 0, checked_at: '2026-10-24 10:00:00',
};

describe('savedVerdictsSql', () => {
  it('is one fixed question over the no-family view, for exactly the offers in play', () => {
    const sql = savedVerdictsSql([7, '9']);
    expect(sql).toBe(`SELECT ${SAVED_VERDICT_COLUMNS.join(', ')} FROM bundle_pg.v_offer_verdicts WHERE offer_id IN ('7', '9') ORDER BY offer_id`);
    expect(sql).not.toMatch(/family|;/i);
    // Same offers in a different order or with repeats: the same text (so one saved answer replays).
    expect(savedVerdictsSql(['9', 7, 7])).toBe(sql);
  });

  it('asks for every field the plan lists, and the view provides them all', () => {
    for (const c of ['offer_id', 'verdict', 'status', 'rule_citations', 'true_value_cents', 'effort_minutes_estimate', 'steps_count', 'payout_wait_days_max', 'claim_window_days', 'fine_print_hash', 'universal_rule']) {
      expect(SAVED_VERDICT_COLUMNS).toContain(c);
    }
    for (const c of SAVED_VERDICT_COLUMNS) expect(VIEWS.v_offer_verdicts).toMatch(new RegExp(`\\b${c}\\b`));
  });

  it('refuses unsafe ids and an empty list', () => {
    expect(() => savedVerdictsSql(["1'); DROP TABLE x; --"])).toThrow();
    expect(() => savedVerdictsSql([])).toThrow();
  });
});

describe('the other fixed questions', () => {
  it('family profile, coach issues and the audit read only registered views', () => {
    expect(familyProfileSql('maya')).toMatch(/FROM bundle_pg\.v_family_profile WHERE id = 'maya'$/);
    expect(coachIssuesSql(50)).toMatch(/FROM bundle_pg\.v_coach_feedback .*ORDER BY id DESC LIMIT 50$/);
    expect(offerAuditSql()).toMatch(/FROM bundle_pg\.v_offer_audit/);
    expect(offerAuditSql('Made-up Store')).toMatch(/WHERE store = 'Made-up Store'/);
    for (const sql of [familyProfileSql('maya'), coachIssuesSql(5), offerAuditSql()]) expect(sql).not.toMatch(/;/);
    expect(() => familyProfileSql("x' OR '1'='1")).toThrow();
    expect(() => coachIssuesSql(-1)).toThrow();
  });

  it('the store name for the audit is quoted safely (apostrophes doubled, no semicolons)', () => {
    expect(offerAuditSql("Joe's Store")).toMatch(/WHERE store = 'Joe''s Store'/);
    expect(() => offerAuditSql('x; DROP')).toThrow();
  });
});

describe('fetchSavedVerdicts', () => {
  it('maps rows to typed verdicts', async () => {
    const z = { runQuery: jest.fn().mockResolvedValue({ headers: Object.keys(ROW), rows: [ROW], ms: 3 }) };
    const r = await fetchSavedVerdicts(z as any, ['7']);
    expect(r.status).toBe('found');
    expect(r.verdicts).toEqual([{
      offerId: '7', store: 'Made-up Store', verdict: 'approve_with_catch', status: 'agreed', ruleCitations: ['FP-02'],
      trueValueCents: 4000, effortMinutesEstimate: 15, stepsCount: 3, payoutWaitDaysMax: 56, claimWindowDays: 30,
      finePrintHash: 'abc', universalRule: false, checkedAt: '2026-10-24 10:00:00',
    }]);
    expect(z.runQuery).toHaveBeenCalledWith(savedVerdictsSql(['7']));
  });

  it('reads the flag whichever way Zetaris spells it, and tolerates header case and bad citations', async () => {
    const z = { runQuery: jest.fn().mockResolvedValue({ headers: [], rows: [{ OFFER_ID: '8', UNIVERSAL_RULE: 'true', RULE_CITATIONS: 'not json', VERDICT: 'reject' }], ms: 1 }) };
    const r = await fetchSavedVerdicts(z as any, ['8']);
    expect(r.verdicts[0]).toMatchObject({ offerId: '8', universalRule: true, ruleCitations: [], verdict: 'reject' });
  });

  it('says "no saved verdicts" when Zetaris has none', async () => {
    const z = { runQuery: jest.fn().mockResolvedValue({ headers: [], rows: [], ms: 1 }) };
    expect(await fetchSavedVerdicts(z as any, ['7'])).toMatchObject({ status: 'none', verdicts: [] });
  });

  it('with no offers in play it does not even ask', async () => {
    const z = { runQuery: jest.fn() };
    expect(await fetchSavedVerdicts(z as any, [])).toMatchObject({ status: 'none', verdicts: [] });
    expect(z.runQuery).not.toHaveBeenCalled();
  });

  it('falls back to "no saved verdicts" (agents grade fresh) when Zetaris is unavailable, saying why', async () => {
    const z = { runQuery: jest.fn().mockRejectedValue(new ZetarisUnavailable('down')) };
    const r = await fetchSavedVerdicts(z as any, ['7']);
    expect(r).toMatchObject({ status: 'unavailable', verdicts: [] });
    expect(r.reason).toMatch(/down/);
  });

  it('sample mode with no recording returns none honestly, and never writes a saved answer', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saved-verdicts-'));
    try {
      const z = new ZetarisClient({ baseUrl: 'https://z.example', orgId: '1', apiKey: 'k', timeoutMs: 50, sampleMode: true, cacheDir: dir });
      const r = await fetchSavedVerdicts(z, ['7']);
      expect(r.verdicts).toEqual([]);
      expect(['none', 'unavailable']).toContain(r.status);
      expect(fs.readdirSync(dir)).toEqual([]);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('replays a saved answer in sample mode once a live recording run has made one', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saved-verdicts-'));
    try {
      const fetchFn = jest.fn().mockResolvedValue(new Response(JSON.stringify({ headers: Object.keys(ROW), data: [Object.values(ROW)] }), { status: 200 }));
      const live = new ZetarisClient({ baseUrl: 'https://z.example', orgId: '1', apiKey: 'k', timeoutMs: 500, sampleMode: false, cacheDir: dir, record: true, fetchFn });
      await fetchSavedVerdicts(live, ['7']);
      const sample = new ZetarisClient({ baseUrl: 'https://z.example', orgId: '1', apiKey: 'k', timeoutMs: 50, sampleMode: true, cacheDir: dir });
      const r = await fetchSavedVerdicts(sample, ['7']);
      expect(r.status).toBe('found');
      expect(r.verdicts[0].trueValueCents).toBe(4000);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('canSkipAi', () => {
  const base = { offerId: '7', store: 's', verdict: 'reject', status: 'agreed', ruleCitations: ['FP-07'], trueValueCents: null, effortMinutesEstimate: null, stepsCount: null, payoutWaitDaysMax: null, claimWindowDays: null, finePrintHash: 'abc', universalRule: false, checkedAt: null };
  it('reuses a grade when the wording fingerprint is unchanged', () => {
    expect(canSkipAi(base, 'abc')).toBe('same_fingerprint');
  });
  it('reuses a universal-rule rejection even when the wording changed', () => {
    expect(canSkipAi({ ...base, universalRule: true }, 'zzz')).toBe('universal_rule');
  });
  it('only reuses agreed grades (disputed or pending are graded fresh)', () => {
    expect(canSkipAi({ ...base, status: 'disputed' }, 'abc')).toBeNull();
    expect(canSkipAi({ ...base, status: 'pending', universalRule: true }, 'zzz')).toBeNull();
    expect(canSkipAi({ ...base, status: '' }, 'abc')).toBeNull();
  });
  it('v_offer_verdicts exposes status so callers can filter', () => {
    expect(SAVED_VERDICT_COLUMNS).toContain('status');
    expect(VIEWS.v_offer_verdicts).toMatch(/\bstatus\b/);
  });
  it('grades fresh when the wording changed and no universal rule applies, or the saved verdict is not a rejection for the universal case', () => {
    expect(canSkipAi(base, 'zzz')).toBeNull();
    expect(canSkipAi({ ...base, universalRule: true, verdict: 'approve' }, 'zzz')).toBeNull();
    expect(canSkipAi(undefined, 'abc')).toBeNull();
  });
});

describe('zetaris:record', () => {
  it('builds the fixed questions: saved verdicts, audit, report card by source, every sample family profile, coach issues', () => {
    const qs = buildQuestions({ offerIds: ['2', '1'], familyIds: ['maya', 'ava'], issueLimit: 50 });
    // The first six are the original fixed questions; the all-states questions follow (allStatesReplay.test.ts covers those).
    expect(qs.map((q) => q.sql).slice(0, 6)).toEqual([
      savedVerdictsSql(['2', '1']), offerAuditSql(), offerAuditBySourceSql(), familyProfileSql('maya'), familyProfileSql('ava'), coachIssuesSql(50),
    ]);
  });

  it('runs every question live and reports each result; one failure does not stop the rest', async () => {
    const asked: string[] = [];
    const z = {
      runQuery: async (sql: string) => {
        asked.push(sql);
        if (sql.includes('v_offer_audit')) throw new Error('view not registered');
        return { headers: [], rows: [{ a: 1 }], ms: 4 };
      },
    };
    const lines: string[] = [];
    const qs = buildQuestions({ offerIds: ['1'], familyIds: ['maya'], issueLimit: 10 });
    const failed = await recordAll(z, qs, (l) => lines.push(l));
    expect(failed).toBe(1);
    expect(asked).toHaveLength(qs.length);
    expect(lines.join('\n')).toMatch(/FAILED.*view not registered/);
  });

  it('writes each live answer to the replay folder through the client (nothing is written by hand)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'record-'));
    try {
      const fetchFn = jest.fn().mockImplementation(async () => new Response(JSON.stringify({ headers: ['x'], data: [['1']] }), { status: 200 }));
      const z = new ZetarisClient({ baseUrl: 'https://z.example', orgId: '1', apiKey: 'k', timeoutMs: 500, sampleMode: false, cacheDir: dir, record: true, fetchFn });
      const qs = buildQuestions({ offerIds: ['1'], familyIds: ['maya'], issueLimit: 10 });
      expect(await recordAll(z, qs, () => undefined)).toBe(0);
      expect(fs.readdirSync(dir)).toHaveLength(qs.length);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

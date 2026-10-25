import path from 'path';
import { proposeRules, MAX_ISSUES, ZETARIS_ISSUE_READ } from '../agents/coach';
import { FakeGenerator } from '../adapters/llm';

const issue = (id: number, note: string) => ({ id, familyId: 'maya', cardId: 'discount-1', kind: 'issue' as const, note, createdAt: null });

describe('Coach.proposeRules', () => {
  it('3 shipping issue notes -> 1 proposal at confidence 0.8', async () => {
    const rows = [issue(1, 'shipping fee was $9'), issue(2, 'surprise shipping charge'), issue(3, 'shipping cost not mentioned')];
    const llm = new FakeGenerator([JSON.stringify({ clusters: [{ rule: 'Reject offers that add a shipping or handling fee at checkout.', feedbackIds: [1, 2, 3] }] })]);
    const out = await proposeRules(rows, llm);
    expect(out).toHaveLength(1);
    expect(out[0].confidence).toBe(0.8);
    expect(out[0].sourceFeedbackIds).toEqual(['1', '2', '3']);
    expect(out[0].text).toMatch(/shipping/i);
  });

  it('caps confidence at 0.9', async () => {
    const rows = [1, 2, 3, 4, 5, 6].map((i) => issue(i, 'shipping fee'));
    const llm = new FakeGenerator([JSON.stringify({ clusters: [{ rule: 'No shipping fees.', feedbackIds: [1, 2, 3, 4, 5, 6] }] })]);
    expect((await proposeRules(rows, llm))[0].confidence).toBe(0.9);
  });

  it('does not call the model with fewer than 2 issue reports (got_it ignored)', async () => {
    const llm = new FakeGenerator(['{}']);
    const rows = [issue(1, 'shipping'), { ...issue(2, 'great'), kind: 'got_it' as const }];
    expect(await proposeRules(rows, llm)).toEqual([]);
    expect(llm.calls).toBe(0);
  });

  it('drops a cluster with fewer than 2 valid reports and ignores made-up ids', async () => {
    const rows = [issue(1, 'a'), issue(2, 'b')];
    const llm = new FakeGenerator([JSON.stringify({ clusters: [{ rule: 'x', feedbackIds: [1, 99] }] })]);
    expect(await proposeRules(rows, llm)).toEqual([]);
  });

  it('returns nothing when the model is unavailable or answers badly', async () => {
    const rows = [issue(1, 'a'), issue(2, 'b')];
    expect(await proposeRules(rows, new FakeGenerator(['not json']))).toEqual([]);
  });

  it('sends only the newest 40 issue reports to the model', async () => {
    const rows = Array.from({ length: 60 }, (_, i) => issue(i + 1, `shipping note ${i + 1}`));
    const llm = new FakeGenerator([JSON.stringify({ clusters: [] })]);
    await proposeRules(rows, llm);
    const p = llm.prompts[0];
    expect(p).toContain('60: shipping note 60');
    expect(p).toContain('21: shipping note 21');
    expect(p).not.toContain('20: shipping note 20');
    expect(p.split('\n').filter((l) => /^\d+: shipping note/.test(l))).toHaveLength(40);
  });
});

describe('Coach offline fallback (no model)', () => {
  const down = new FakeGenerator([]); // throws ModelUnavailable on every call
  it('proposes a rule when 2+ reports share the auto-renew membership theme', async () => {
    const rows = [issue(1, 'I was charged $29.99 for a membership'), issue(2, 'it auto-renewed after the trial'), issue(3, 'package was late')];
    const out = await proposeRules(rows, down);
    expect(out).toHaveLength(1);
    expect(out[0].text).toMatch(/membership/i);
    expect(out[0].sourceFeedbackIds).toEqual(['1', '2']);
    expect(out[0].confidence).toBe(0.7);
  });
  it('proposes nothing when only one report matches a theme', async () => {
    expect(await proposeRules([issue(1, 'membership trap'), issue(2, 'box was dented')], down)).toEqual([]);
  });
});

// ---- W3-COACH: the Coach reads parent reports through Zetaris (view v_coach_feedback), never Neon directly ----
import { fetchRecentIssues } from '../agents/coach';
import { coachIssuesSql } from '../agents/savedVerdicts';
import { MemoryStore, DrizzleStore } from '../bundleStore';
import { ZetarisClient, ZetarisUnavailable } from '../adapters/zetaris';

type ZRow = Record<string, string | number | null>;
const fakeZetaris = (rows: ZRow[]) => {
  const asked: string[] = [];
  return { asked, runQuery: async (sql: string) => { asked.push(sql); return { headers: [], rows, ms: 1 }; } };
};
const zrow = (id: number, note: string, kind = 'issue'): ZRow =>
  ({ id, family_id: 'maya', card_id: 'discount-1', kind, note, created_at: '2026-10-24 10:00:00' });

describe('Coach reads reports through Zetaris', () => {
  it('asks the exact recorded coachIssuesSql question and maps the rows', async () => {
    const z = fakeZetaris([zrow(3, 'shipping cost'), zrow(2, 'surprise shipping')]);
    const out = await fetchRecentIssues(z, 40);
    expect(z.asked).toEqual([coachIssuesSql(ZETARIS_ISSUE_READ)]);
    expect(out.map((r) => r.id)).toEqual([3, 2]);
    expect(out[0]).toMatchObject({ familyId: 'maya', cardId: 'discount-1', kind: 'issue', note: 'shipping cost' });
    expect(out[0].createdAt).toBeInstanceOf(Date);
  });

  it('asks the same recorded question whatever the limit, then trims to the limit (newest first)', async () => {
    const z = fakeZetaris([zrow(3, 'c'), zrow(2, 'b'), zrow(1, 'a')]);
    expect((await fetchRecentIssues(z, 2)).map((r) => r.id)).toEqual([3, 2]);
    expect(z.asked).toEqual([coachIssuesSql(50)]);
  });

  it('keeps only issue reports and tolerates empty or missing notes', async () => {
    const out = await fetchRecentIssues(fakeZetaris([zrow(1, 'a'), zrow(2, 'b', 'got_it'), { ...zrow(3, ''), note: null }]), 5);
    expect(out.map((r) => r.id)).toEqual([1, 3]);
    expect(out[1].note).toBe('');
  });

  it('lets "Zetaris cannot answer" through (no quiet fallback to Neon)', async () => {
    const down = { runQuery: async () => { throw new ZetarisUnavailable('no saved response'); } };
    await expect(fetchRecentIssues(down, 40)).rejects.toThrow(/no saved response/);
  });

  it('feeds proposeRules end to end (fake Zetaris rows -> a proposal)', async () => {
    const rows = await fetchRecentIssues(fakeZetaris([zrow(2, 'shipping fee was $9'), zrow(1, 'surprise shipping charge')]), 40);
    const out = await proposeRules(rows, new FakeGenerator([]));
    expect(out).toHaveLength(1);
    expect(out[0].sourceFeedbackIds.sort()).toEqual(['1', '2']);
  });
});

describe('MemoryStore.listRecentIssues with a Zetaris reader', () => {
  it('reads issues through the reader, not its own list', async () => {
    const z = fakeZetaris([zrow(9, 'from zetaris')]);
    const store = new MemoryStore({}, z);
    await store.addFeedback({ familyId: 'maya', cardId: 'c', kind: 'issue', note: 'local only' });
    const got = await store.listRecentIssues(40);
    expect(got.map((r) => r.note)).toEqual(['from zetaris']);
    expect(z.asked).toEqual([coachIssuesSql(ZETARIS_ISSUE_READ)]);
  });
  it('DrizzleStore reads issues through Zetaris and never opens the database for them', async () => {
    const saved = process.env.DATABASE_URL; delete process.env.DATABASE_URL; // the database module throws without it, so any Neon read would fail here
    try {
      const z = fakeZetaris([zrow(4, 'x')]);
      expect((await new DrizzleStore(z).listRecentIssues(40)).map((r) => r.id)).toEqual([4]);
    } finally { if (saved !== undefined) process.env.DATABASE_URL = saved; }
  });
  it('without a reader (sample mode) still serves the in-memory list', async () => {
    const store = new MemoryStore();
    await store.addFeedback({ familyId: 'maya', cardId: 'c', kind: 'issue', note: 'a' });
    expect((await store.listRecentIssues(40)).map((r) => r.note)).toEqual(['a']);
  });
});

describe('Coach read in sample mode with the real Zetaris client', () => {
  const mk = (cacheDir: string) => new ZetarisClient({ baseUrl: 'http://sample-mode.invalid', orgId: 's', apiKey: 's', timeoutMs: 1000, sampleMode: true, cacheDir });
  it('replays the recorded answer for the exact question (recorded live, never hand-written)', async () => {
    const out = await fetchRecentIssues(mk(path.resolve('data/sample/zetaris-cache')), MAX_ISSUES);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((r) => r.kind === 'issue' && Number.isFinite(r.id))).toBe(true);
  });
  it('with no saved answer it says Zetaris is unavailable (honest fallback, no Neon read)', async () => {
    await expect(fetchRecentIssues(mk(path.resolve('data/sample/does-not-exist')), MAX_ISSUES)).rejects.toThrow(ZetarisUnavailable);
  });
});

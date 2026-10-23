import { proposeRules } from '../agents/coach';
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
});

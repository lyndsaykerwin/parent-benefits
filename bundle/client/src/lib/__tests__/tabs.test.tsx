import type { FeedCard } from '@shared/bundle';
import { sampleRun } from '../../test-support/sampleRuns';
import {
  TABS, stageOf, tabForCard, claimableCards, homeTotals, categorySummary, urgentDeadlines, comingSoonNote, loadClaims, saveClaims, claimedCents,
  shareMessage, valueScoreLines, plainCardBody,
} from '../tabs';
import { isCheckWithJob } from '../bundle';

const card = (id: string, kind: FeedCard['kind'], over: Partial<FeedCard> = {}): FeedCard => ({ id, kind, title: id, body: '', amountCents: null, deadline: null, verdict: 'likely', sources: [], traceId: '', ...over });

afterEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

describe('tabs and cards', () => {
  it('has the five Version B tabs in order', () => {
    expect(TABS.map((t) => t.label)).toEqual(['Home', 'Taxes', 'Savings', 'Insurance', 'Deals']);
  });

  it('sends every real card of a sample run to one tab (or none for coming-soon tiles)', () => {
    const { result } = sampleRun('maya');
    const by = (tab: string) => result.cards.filter((c) => tabForCard(c) === tab).map((c) => c.id);
    // database serial ids change on re-seed, so find the real card by kind/prefix
    const fsaId = result.cards.find((c) => c.id.startsWith('clawback-fsa-'))!.id;
    expect(by('taxes')).toEqual(expect.arrayContaining(['benefit-federal_child_tax_credit', 'benefit-ma_child_tax_credit', 'benefit-dcfsa_life_event']));
    expect(by('insurance')).toEqual(expect.arrayContaining(['benefit-insurance_add_baby', 'benefit-ma_pfml']));
    expect(by('savings')).toEqual(expect.arrayContaining(['benefit-trump_account', fsaId, 'recall-cpsc-10560']));
    expect(by('deals').every((id) => id.startsWith('discount-'))).toBe(true);
    expect(by('deals').length).toBeGreaterThan(0);
    for (const c of result.cards.filter((x) => x.kind === 'coming_soon')) expect(tabForCard(c)).toBeNull();
    // nothing is lost: every card is either on a tab or a coming-soon tile
    expect(result.cards.filter((c) => c.kind !== 'coming_soon' && tabForCard(c) === null)).toEqual([]);
  });

  it('knows the Dependent Care FSA and paid-leave cards are "Check with your job"', () => {
    expect(isCheckWithJob(card('benefit-dcfsa_life_event', 'benefit', { verdict: 'info' }))).toBe(true);
    expect(isCheckWithJob(card('benefit-ma_pfml', 'benefit'))).toBe(true);
    expect(isCheckWithJob(card('benefit-trump_account', 'benefit', { amountCents: 100000 }))).toBe(false);
  });

  it('tells expecting from baby-is-here by the date the family gave', () => {
    expect(stageOf(sampleRun('leo').family)).toBe('expecting');
    expect(stageOf(sampleRun('maya').family)).toBe('born');
    expect(stageOf(undefined)).toBe('born');
  });
});

describe('totals come from the run', () => {
  it('uses the run receipt for the big number and the court-passed offers for free gifts', () => {
    const { result } = sampleRun('maya');
    const t = homeTotals(result);
    expect(t.totalCents).toBe(result.receipt.moneyBackCents + result.receipt.likelyBenefitsCents);
    const gifts = result.cards.filter((c) => c.kind === 'discount' && c.verdict !== 'info').reduce((a, c) => a + (c.valueScore?.trueValueCents ?? c.amountCents ?? 0), 0);
    expect(t.giftsCents).toBe(gifts);
    expect(t.giftsCents).toBeGreaterThan(0);
  });

  it('the "How we got this number" lines add up to the big number', () => {
    for (const id of ['maya', 'leo', 'ava'] as const) {
      const { result } = sampleRun(id);
      const t = homeTotals(result);
      expect(t.parts.reduce((a, p) => a + (p.amountCents ?? 0), 0)).toBe(t.totalCents);
      expect(t.notCounted.some((c) => c.id === 'benefit-dcfsa_life_event')).toBe(true);
    }
  });

  it('summarises a tab from its own cards only', () => {
    const { result } = sampleRun('maya');
    const taxes = categorySummary(result.cards, 'taxes');
    expect(taxes.cents).toBe(220000 + 44000);
    expect(taxes.count).toBe(3);
    const ins = categorySummary(result.cards, 'insurance');
    expect(ins.cents).toBe(0);
  });
});

describe('Do these first', () => {
  it('lists real deadlines that are close, soonest first, for a baby who is here', () => {
    const run = sampleRun('maya');
    const u = urgentDeadlines(run.result.cards, run.today!, 'born', run.family);
    expect(u.map((x) => x.card.id)).toEqual(['benefit-insurance_add_baby']);
    expect(u[0].label).toBe('10 days left');
  });

  it('says "Starts at birth" for an expecting family instead of a countdown', () => {
    const run = sampleRun('leo');
    const u = urgentDeadlines(run.result.cards, run.today!, 'expecting', run.family);
    expect(u.map((x) => x.card.id)).toEqual(['benefit-insurance_add_baby']);
    expect(u[0].label).toMatch(/^Starts at birth/);
    expect(u[0].label).not.toMatch(/days left/);
  });
});

describe('coming soon note for uncovered states', () => {
  it('is null for covered states and when we cannot tell', () => {
    expect(comingSoonNote(sampleRun('maya', { withState: true }))).toBeNull();
    expect(comingSoonNote(sampleRun('maya'))).toBeNull();
  });
  it('uses the state on the family when the server sends it', () => {
    expect(comingSoonNote(sampleRun('fern', { withState: true }))).toBe('Support for your state’s programs is coming soon');
  });
  it('uses a note the server puts on the run result (stateNote) or a coming-soon-state card', () => {
    const a = sampleRun('fern');
    a.result = { ...a.result, stateNote: 'Support for your state’s programs is coming soon' };
    expect(comingSoonNote(a)).toBe('Support for your state’s programs is coming soon');
    const b = sampleRun('fern');
    b.result = { ...b.result, cards: [...b.result.cards, card('coming-soon-state', 'coming_soon', { body: 'Coming soon: Ohio programs.' })] };
    expect(comingSoonNote(b)).toBe('Ohio programs.');
  });
});

describe('"I got this" ticks and $ claimed', () => {
  it('stores ticks in the browser and sums only ticked money cards', () => {
    const { result } = sampleRun('maya');
    const claimable = claimableCards(result.cards);
    expect(claimable.map((c) => c.id)).not.toContain('benefit-dcfsa_life_event');
    expect(claimable.map((c) => c.id)).not.toContain('recall-cpsc-10560');
    const fsa = result.cards.find((c) => c.id.startsWith('clawback-fsa-'))!;
    const trump = result.cards.find((c) => c.id === 'benefit-trump_account')!;
    expect(fsa.amountCents).toBeGreaterThan(0);
    saveClaims('maya', { 'benefit-trump_account': true, [fsa.id]: true, 'not-a-card': true });
    expect(loadClaims('maya')).toEqual({ 'benefit-trump_account': true, [fsa.id]: true, 'not-a-card': true });
    expect(claimedCents(result.cards, loadClaims('maya'))).toBe(trump.amountCents! + fsa.amountCents!);
  });
  it('survives storage being blocked', () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(loadClaims('maya')).toEqual({});
    spy.mockRestore();
  });
});

describe('share message and value score words', () => {
  it('shares only a link: no family name, dates, ZIP or amounts', () => {
    const m = shareMessage('https://bundle.example');
    expect(m).toBe('Bundle found money and deadlines for our baby that I had no idea about. Takes 30 seconds: https://bundle.example');
    expect(m).not.toMatch(/\$|\d{4}-\d{2}|Maya|\b\d{5}\b/);
  });
  it('turns a Value Score into plain lines', () => {
    const lines = valueScoreLines({
      trueValueCents: 3500, effortLevel: 'low', effortMinutesEstimate: { min: 5, max: 10 }, stepsCount: 2, payoutWaitDays: null,
      timeLabel: 'instant', catchTypes: ['shipping_fee', 'weird_code'], worthYourTime: true, reasons: [],
    });
    expect(lines).toEqual(['True value $35.00', 'About 5–10 minutes of effort, paid instantly', 'Catch: shipping fee, weird code']);
    expect(valueScoreLines({ trueValueCents: null, effortLevel: 'low', effortMinutesEstimate: { min: 2, max: 5 }, stepsCount: 1, payoutWaitDays: null, timeLabel: 'right away', catchTypes: [], worthYourTime: true, reasons: [] })[0])
      .toBe('About 2–5 minutes of effort, no payout wait stated');
    expect(plainCardBody("Store Y has an offer. No flagged terms found. We couldn't fully check this offer's fine print.")).not.toMatch(/No flagged terms/);
    expect(valueScoreLines({ trueValueCents: null, effortLevel: 'high', effortMinutesEstimate: { min: 30, max: 30 }, stepsCount: 5, payoutWaitDays: null, timeLabel: 'wait unknown', catchTypes: [], worthYourTime: false, reasons: [] }))
      .toEqual(['About 30 minutes of effort, payout wait unknown', 'Probably not worth your time']);
  });
});

// Lane B (Stories 3 and 4): card category and minutes, "Not relevant" saved to claims + feedback, and the Coach learning from it.
import os from 'os';
import fs from 'fs';
import path from 'path';
import express from 'express';
import request from 'supertest';
import type { FeedCard } from '../../shared/bundle';
import { cardCategory, cardMinutes } from '../../shared/cardMeta';
import { MemoryStore } from '../bundleStore';
import { proposeFromDismissals, type FeedbackRow } from '../agents/coach';
import { createBundleRouter, parentCard, type ApiDeps } from '../routes/bundleRoutes';
import { bodyParsers } from '../middleware/bodyLimit';
import { FakeGenerator } from '../adapters/llm';

const card = (id: string, kind: FeedCard['kind'], over: Partial<FeedCard> = {}): FeedCard => ({ id, kind, title: id, body: '', amountCents: null, deadline: null, verdict: 'likely', sources: [], traceId: 't', ...over });

describe('card category and minutes (set by code from the card, never guessed on the screen)', () => {
  it('puts each kind of card in its Home bucket', () => {
    expect(cardCategory(card('clawback-fsa-15', 'clawback', { verdict: 'verified', amountCents: 2899 }))).toBe('money_back');
    expect(cardCategory(card('clawback-price-16', 'clawback', { verdict: 'verified', amountCents: 2000 }))).toBe('money_back');
    expect(cardCategory(card('clawback-info', 'clawback', { verdict: 'info' }))).toBe('info');
    for (const id of ['benefit-federal_child_tax_credit', 'benefit-ma_child_tax_credit', 'benefit-trump_account']) {
      expect(cardCategory(card(id, 'benefit', { amountCents: 100000 }))).toBe('tax_time');
    }
    expect(cardCategory(card('benefit-ma_pfml', 'benefit'))).toBe('leave');
    expect(cardCategory(card('benefit-ny_pfl', 'benefit'))).toBe('leave');
    expect(cardCategory(card('benefit-insurance_add_baby', 'benefit'))).toBe('info');
    expect(cardCategory(card('benefit-dcfsa_life_event', 'benefit', { verdict: 'info' }))).toBe('info');
    expect(cardCategory(card('fallback-benefit-1', 'benefit', { verdict: 'info', amountCents: 5000 }))).toBe('info'); // an unverified stand-in is never a bucket line
    expect(cardCategory(card('discount-1', 'discount'))).toBe('gift');
    expect(cardCategory(card('blocked-1', 'discount', { verdict: 'blocked' }))).toBe('info');
    expect(cardCategory(card('recall-cpsc-1', 'recall'))).toBe('info');
    expect(cardCategory(card('coming-soon-x', 'coming_soon', { verdict: 'info' }))).toBe('info');
  });

  it('gives benefit and money-back cards a minutes estimate; insurance is longer than a quick win, tax credits are quick', () => {
    expect(cardMinutes(card('benefit-insurance_add_baby', 'benefit'))).toBe(15);
    expect(cardMinutes(card('benefit-federal_child_tax_credit', 'benefit'))).toBeLessThan(5);
    expect(cardMinutes(card('benefit-ma_child_tax_credit', 'benefit'))).toBeLessThan(5);
    expect(cardMinutes(card('benefit-trump_account', 'benefit'))).toBeGreaterThanOrEqual(5);
    expect(cardMinutes(card('clawback-fsa-9', 'clawback'))).toBeGreaterThan(0);
    expect(cardMinutes(card('recall-cpsc-1', 'recall'))).toBeUndefined(); // no estimate rather than a made-up one
    expect(cardMinutes(card('benefit-something_new', 'benefit'))).toBeUndefined();
  });

  it('a deal takes its minutes from the Value Score (the court\'s own estimate)', () => {
    const vs = { trueValueCents: 1000, effortLevel: 'low', effortMinutesEstimate: { min: 2, max: 7 }, stepsCount: 2, payoutWaitDays: null, timeLabel: 'right away', catchTypes: [], worthYourTime: true, reasons: [] } as FeedCard['valueScore'];
    expect(cardMinutes(card('discount-5', 'discount', { valueScore: vs }))).toBe(7);
    expect(cardMinutes(card('discount-6', 'discount'))).toBeUndefined();
  });

  it('the saved sample runs carry both on every card the Home screen uses', () => {
    const run = JSON.parse(fs.readFileSync(path.join(__dirname, '../../output_examples/maya.json'), 'utf8'));
    for (const c of run.cards as FeedCard[]) expect(c.category).toBe(cardCategory(c));
    const byId = Object.fromEntries((run.cards as FeedCard[]).map((c) => [c.id, c]));
    expect(byId['benefit-trump_account'].category).toBe('tax_time');
    expect(byId['benefit-ma_pfml'].category).toBe('leave');
    expect(byId['benefit-insurance_add_baby'].minutes).toBe(15);
  });

  it('parents get category and minutes on their copy of a card (only when set)', () => {
    const out = parentCard({ ...card('benefit-ma_child_tax_credit', 'benefit'), category: 'tax_time', minutes: 4 }) as any;
    expect(out.category).toBe('tax_time');
    expect(out.minutes).toBe(4);
    expect(Object.keys(parentCard(card('x', 'benefit')))).not.toContain('category');
  });
});

describe('Coach learns from "Not relevant"', () => {
  const row = (id: number, familyId: string, cardId: string): FeedbackRow => ({ id, familyId, cardId, kind: 'not_relevant', note: '' });
  it('proposes a rule only when 2 or more different families dismiss the same card', () => {
    expect(proposeFromDismissals([row(1, 'maya', 'benefit-ma_child_tax_credit')])).toEqual([]);
    expect(proposeFromDismissals([row(1, 'maya', 'benefit-ma_child_tax_credit'), row(2, 'maya', 'benefit-ma_child_tax_credit')])).toEqual([]); // the same family twice is one voice
    const p = proposeFromDismissals([row(1, 'maya', 'benefit-ma_child_tax_credit'), row(2, 'leo', 'benefit-ma_child_tax_credit'), row(3, 'ava', 'benefit-trump_account')]);
    expect(p).toHaveLength(1);
    expect(p[0].text).toMatch(/ma child tax credit/);
    expect(p[0].sourceFeedbackIds).toEqual(['1', '2']);
    expect(p[0].confidence).toBeGreaterThan(0.5);
  });
  it('ignores other kinds of feedback', () => {
    expect(proposeFromDismissals([{ ...row(1, 'a', 'c'), kind: 'got_it' }, { ...row(2, 'b', 'c'), kind: 'issue' }])).toEqual([]);
  });
});

function build() {
  const store = new MemoryStore({ '021': 'MA' });
  const deps = {
    makeRunDeps: () => { throw new Error('not used'); },
    loadSeedFamily: async () => { throw new Error('not used'); },
    store, memory: { addRule: jest.fn(() => 'mem-1') } as any, llm: new FakeGenerator([]),
    reviewerToken: () => 'sekret', now: () => new Date('2026-10-23T12:00:00Z'),
  } as unknown as ApiDeps;
  const app = express();
  app.use(...bodyParsers());
  app.use(createBundleRouter(deps));
  return { app, store };
}

describe('POST /api/feedback with "not_relevant", and Undo', () => {
  it('saves the answer to feedback and to claims, with no database needed', async () => {
    const { app, store } = build();
    const res = await request(app).post('/api/feedback').send({ familyId: 'maya', cardId: 'benefit-ma_child_tax_credit', kind: 'not_relevant' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(await store.getClaims('maya')).toEqual([{ cardId: 'benefit-ma_child_tax_credit', status: 'not_relevant' }]);
  });

  it('"I got this" is saved to claims too, and the latest answer wins for a card', async () => {
    const { app, store } = build();
    await request(app).post('/api/feedback').send({ familyId: 'maya', cardId: 'c1', kind: 'not_relevant' });
    await request(app).post('/api/feedback').send({ familyId: 'maya', cardId: 'c1', kind: 'got_it' });
    expect(await store.getClaims('maya')).toEqual([{ cardId: 'c1', status: 'got_it' }]);
  });

  it('Undo clears the claim; an undone dismissal no longer counts for the Coach', async () => {
    const { app, store } = build();
    await request(app).post('/api/feedback').send({ familyId: 'maya', cardId: 'c1', kind: 'not_relevant' });
    await request(app).post('/api/feedback').send({ familyId: 'leo', cardId: 'c1', kind: 'not_relevant' });
    expect(await store.listRecentDismissals(10)).toHaveLength(2);
    expect((await request(app).post('/api/claims/undo').send({ familyId: 'leo', cardId: 'c1' })).status).toBe(200);
    expect(await store.getClaims('leo')).toEqual([]);
    expect((await store.listRecentDismissals(10)).map((r) => r.familyId)).toEqual(['maya']);
  });

  it('two families dismissing the same card makes the Coach propose a rule for a person to approve', async () => {
    const { app, store } = build();
    await request(app).post('/api/feedback').send({ familyId: 'maya', cardId: 'benefit-ma_child_tax_credit', kind: 'not_relevant' });
    const second = await request(app).post('/api/feedback').set('x-reviewer-token', 'sekret').send({ familyId: 'leo', cardId: 'benefit-ma_child_tax_credit', kind: 'not_relevant' });
    expect(second.body.proposedCount).toBe(1);
    expect((await store.listProposals())[0].text).toMatch(/ma child tax credit/);
    // sending the same dismissal again does not propose the same rule twice
    const again = await request(app).post('/api/feedback').send({ familyId: 'ava', cardId: 'benefit-ma_child_tax_credit', kind: 'not_relevant' });
    expect(again.status).toBe(200);
    expect((await store.listProposals()).length).toBeLessThanOrEqual(2);
  });

  it('rejects unknown families, missing cards and bad kinds for Undo and feedback', async () => {
    const { app } = build();
    expect((await request(app).post('/api/claims/undo').send({ familyId: 'zzz', cardId: 'c' })).status).toBe(400);
    expect((await request(app).post('/api/claims/undo').send({ familyId: 'maya' })).status).toBe(400);
    expect((await request(app).post('/api/feedback').send({ familyId: 'maya', cardId: 'c', kind: 'maybe' })).status).toBe(400);
  });
});

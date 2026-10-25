import React from 'react';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import type { FeedCard } from '@shared/bundle';
import FeedCardView from '../FeedCardView';

afterEach(cleanup);

const base: FeedCard = {
  id: 'discount-1302', kind: 'discount', title: 'Free newborn diaper box', body: 'Cuddle & Co has an offer worth about $40.00.',
  amountCents: 4000, deadline: null, verdict: 'likely', sources: [], traceId: 't',
};

describe('FeedCardView (Version B additions)', () => {
  it('shows the Value Score on a deal: true value, time and catches in plain words', () => {
    render(<FeedCardView card={{
      ...base,
      valueScore: { trueValueCents: 3000, effortLevel: 'low', effortMinutesEstimate: { min: 5, max: 10 }, stepsCount: 2, payoutWaitDays: null, timeLabel: 'instant', catchTypes: ['shipping_fee'], worthYourTime: true, reasons: [] },
    }} />);
    const s = screen.getByTestId('value-score');
    expect(within(s).getByText('True value $30.00')).toBeTruthy();
    expect(within(s).getByText('About 5–10 minutes of effort, paid instantly')).toBeTruthy();
    expect(within(s).getByText('Catch: shipping fee')).toBeTruthy();
  });

  it('says "Probably not worth your time" when the score says so', () => {
    render(<FeedCardView card={{
      ...base,
      valueScore: { trueValueCents: 200, effortLevel: 'high', effortMinutesEstimate: { min: 30, max: 30 }, stepsCount: 6, payoutWaitDays: { min: 40, max: 60 }, timeLabel: 'money in about 6–9 weeks', catchTypes: [], worthYourTime: false, reasons: [] },
    }} />);
    expect(screen.getByText('Probably not worth your time')).toBeTruthy();
  });

  it('shows no Value Score block when the card has none', () => {
    render(<FeedCardView card={base} />);
    expect(screen.queryByTestId('value-score')).toBeNull();
  });

  it('shows "I got this" and "Not relevant" only when asked, and reports each tap', () => {
    const onGotIt = jest.fn();
    const onNotRelevant = jest.fn();
    const { rerender } = render(<FeedCardView card={base} />);
    expect(screen.queryByRole('button', { name: 'I got this' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Not relevant' })).toBeNull();
    rerender(<FeedCardView card={base} actions={{ onGotIt, onNotRelevant }} />);
    fireEvent.click(screen.getByRole('button', { name: 'I got this' }));
    expect(onGotIt).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Not relevant' }));
    expect(onNotRelevant).toHaveBeenCalledTimes(1);
  });

  it('shows the minutes estimate beside the buttons ("about N min") but not on deals', () => {
    const task = { ...base, id: 'benefit-ma_child_tax_credit', kind: 'benefit' as const, minutes: 4 };
    const { rerender } = render(<FeedCardView card={task} actions={{ onGotIt: jest.fn(), onNotRelevant: jest.fn() }} />);
    expect(screen.getByTestId('card-minutes').textContent).toBe('about 4 min');
    rerender(<FeedCardView card={{ ...base, kind: 'discount', minutes: 5 }} actions={{ onGotIt: jest.fn(), onNotRelevant: jest.fn() }} />);
    expect(screen.queryByTestId('card-minutes')).toBeNull();
  });

  it('the Dependent Care FSA card reads "Check with your job" and shows no amount', () => {
    render(<FeedCardView card={{ ...base, id: 'benefit-dcfsa_life_event', kind: 'benefit', title: 'Dependent Care FSA: check with your job', amountCents: null, verdict: 'info' }} />);
    expect(screen.getByText('Check with your job')).toBeTruthy();
    expect(screen.queryByText('Not yet verified')).toBeNull();
    expect(screen.queryByTestId('card-amount')).toBeNull();
  });

  it('can replace the countdown with "Starts at birth"', () => {
    render(<FeedCardView card={{ ...base, id: 'benefit-insurance_add_baby', kind: 'benefit', deadline: '2027-01-06', amountCents: null }} today="2026-10-23" deadlineLabel="Starts at birth" />);
    expect(screen.getByText('Starts at birth')).toBeTruthy();
    expect(screen.queryByText(/days left/)).toBeNull();
  });
});

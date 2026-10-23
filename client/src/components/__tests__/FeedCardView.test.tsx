import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import type { FeedCard } from '@shared/bundle';
import FeedCardView from '../FeedCardView';

const card = (over: Partial<FeedCard> = {}): FeedCard => ({
  id: 'clawback-fsa-test-tx-01',
  kind: 'clawback',
  title: 'Claim $28.99 from your FSA',
  body: 'The thermometer you bought is likely FSA-eligible.',
  amountCents: 2899,
  deadline: null,
  verdict: 'likely',
  sources: [
    { label: 'IRS Publication 502', url: 'https://www.irs.gov/publications/p502' },
    { label: 'Store receipt', url: 'https://example.com/receipt' },
  ],
  traceId: 't-1',
  ...over,
});

afterEach(cleanup);

describe('FeedCardView', () => {
  it('shows the amount as US dollars', () => {
    render(<FeedCardView card={card()} />);
    expect(screen.getByTestId('card-amount').textContent).toBe('$28.99');
  });

  it("shows 'Likely eligible' for a likely verdict", () => {
    render(<FeedCardView card={card({ verdict: 'likely' })} />);
    expect(screen.getByText('Likely eligible')).toBeTruthy();
  });

  it('renders every source as a link that opens the source page', () => {
    render(<FeedCardView card={card()} />);
    const irs = screen.getByRole('link', { name: /IRS Publication 502/ });
    expect(irs.getAttribute('href')).toBe('https://www.irs.gov/publications/p502');
    expect(irs.getAttribute('target')).toBe('_blank');
    expect(irs.getAttribute('rel')).toContain('noopener');
    expect(screen.getByRole('link', { name: /Store receipt/ }).getAttribute('href')).toBe('https://example.com/receipt');
  });

  it("labels unverified 'info' fillers as 'Not yet verified'", () => {
    render(<FeedCardView card={card({ verdict: 'info', kind: 'benefit', amountCents: null })} />);
    expect(screen.getByText('Not yet verified')).toBeTruthy();
  });

  it('calls the Dependent Care FSA amount eligible spend, not money back', () => {
    render(<FeedCardView card={card({ id: 'clawback-dcfsa-test-2026', amountCents: 555000 })} />);
    expect(screen.getByTestId('card-amount').textContent).toBe('$5,550.00');
    expect(screen.getByText('eligible spend')).toBeTruthy();
    expect(screen.queryByText('money back')).toBeNull();
  });
});

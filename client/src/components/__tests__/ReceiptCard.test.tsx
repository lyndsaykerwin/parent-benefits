import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import type { BundleReceipt } from '@shared/bundle';
import ReceiptCard, { NOT_CHECKED_TEXT } from '../ReceiptCard';

const receipt = (over: Partial<BundleReceipt> = {}): BundleReceipt => ({
  moneyBackCents: 0, likelyBenefitsCents: 0, deadlineCount: 0, nextDeadline: null, itemsChecked: 0, ...over,
});

afterEach(cleanup);

describe('ReceiptCard safety line (I5)', () => {
  it('never says "all clear" when nothing was checked', () => {
    const { container } = render(<ReceiptCard receipt={receipt({ itemsChecked: 0 })} recallCount={0} />);
    expect(screen.getByTestId('receipt-safety').textContent).toBe(NOT_CHECKED_TEXT);
    expect(NOT_CHECKED_TEXT).toBe('Connect your data to safety-check items');
    expect(container.textContent).not.toMatch(/all clear/i);
    expect(container.textContent).not.toMatch(/0 items safety-checked/);
  });

  it('says "all clear" only when items were checked and no recall was found', () => {
    render(<ReceiptCard receipt={receipt({ itemsChecked: 9 })} recallCount={0} />);
    expect(screen.getByTestId('receipt-safety').textContent).toBe('all clear');
    expect(screen.getByText('9 items safety-checked')).toBeTruthy();
  });

  it('shows the recall count when a recall was found', () => {
    render(<ReceiptCard receipt={receipt({ itemsChecked: 9 })} recallCount={1} />);
    expect(screen.getByTestId('receipt-safety').textContent).toBe('1 recall');
  });
});

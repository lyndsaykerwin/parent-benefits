import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import type { FeedCard } from '@shared/bundle';
import type { TraceLine } from '@/lib/bundle';
import { ZetarisSection, MemorySection, CaughtForYou } from '../HowWeCheckedSections';

afterEach(cleanup);
let n = 0;
const line = (agent_name: string, action: string, input_summary: string, output_summary: string, status: TraceLine['status'] = 'ok'): TraceLine => ({
  timestamp: '2026-10-23T00:00:00Z', trace_id: `t${n++}`, agent_name, action, input_summary, output_summary, target_agent: null, confidence: null, retry_count: 0, status,
});
const card = (id: string, kind: FeedCard['kind']): FeedCard => ({ id, kind, title: id, body: '', amountCents: null, deadline: null, verdict: 'verified', sources: [], traceId: '' });

const trace = [
  line('zetaris', 'query_cached', "SELECT DISTINCT item_text FROM bundle_pg.v_purchase_items WHERE family_id = 'maya'", '7 rows (sample cache)'),
  line('zetaris', 'query_cached', 'SELECT RecallID FROM bundle_live.cpsc_recalls WHERE RecallID = 10560', '1 rows (sample cache)'),
  line('zetaris', 'query_cached', 'SELECT id, title FROM bundle_pg.v_judge_offers ORDER BY id', '16 rows (sample cache)'),
  line('memory', 'rule_recalled', 'offer 1190', 'mem-1|0.80|2|Reject offers whose free trial turns into a paid membership.'),
  line('judge', 'rule_by_screen', 'offer 1190', 'reject: x [cited mem-1]', 'blocked'),
];

describe('ZetarisSection', () => {
  it('shows plain-English source chips, the query count and "saved real response"', () => {
    render(<ZetarisSection card={card('recall-cpsc-10560', 'recall')} lines={trace} />);
    expect(screen.getByText('Data sources checked (via Zetaris)')).toBeTruthy();
    expect(screen.getByText('Your purchases (private, Neon)')).toBeTruthy();
    expect(screen.getByText('CPSC recall list (live government feed)')).toBeTruthy();
    expect(screen.getByTestId('zetaris-summary').textContent).toBe('2 queries across 2 sources · saved real response');
  });
  it('hides family values inside "Show query"', () => {
    const { container } = render(<ZetarisSection card={card('recall-cpsc-10560', 'recall')} lines={trace} />);
    expect(container.querySelector('details')).toBeTruthy();
    expect(container.textContent).not.toContain('maya');
    expect(container.textContent).toContain("family_id = '?'");
  });
  it('renders nothing when no query maps to the card', () => {
    const { container } = render(<ZetarisSection card={card('discount-9999', 'discount')} lines={[trace[1]]} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('MemorySection', () => {
  it('shows rule text, id, confidence and parent reports', () => {
    render(<MemorySection card={card('discount-1190', 'discount')} lines={trace} />);
    expect(screen.getByText('Memory (Meterless H-MEM)')).toBeTruthy();
    expect(screen.getByText(/Reject offers whose free trial/)).toBeTruthy();
    expect(screen.getByText('mem-1')).toBeTruthy();
    expect(screen.getByText('confidence 80%')).toBeTruthy();
    expect(screen.getByText('learned from 2 parent reports')).toBeTruthy();
    expect(screen.getByText('cited by the Judge')).toBeTruthy();
  });
  it('renders nothing without a rule for this card', () => {
    const { container } = render(<MemorySection card={card('discount-1191', 'discount')} lines={trace} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('CaughtForYou', () => {
  const blocked: FeedCard = { ...card('blocked-1190', 'discount'), title: 'Free newborn diaper box', verdict: 'blocked', body: 'Court was offline; case law applies: Reject trials that auto-renew.' };
  it('lists blocked offers collapsed, with a link and the cited rule', () => {
    const { container } = render(<CaughtForYou blocked={[blocked]} lines={trace} href={(id) => `/card/${id}`} />);
    expect(container.querySelector('details')!.hasAttribute('open')).toBe(false);
    expect(screen.getByText('We caught these for you')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Free newborn diaper box/ }).getAttribute('href')).toBe('/card/blocked-1190');
    expect(screen.getByText('mem-1')).toBeTruthy();
    expect(screen.getByText('Memory (Meterless H-MEM)')).toBeTruthy();
  });
  it('renders nothing when nothing was blocked', () => {
    const { container } = render(<CaughtForYou blocked={[]} lines={trace} href={(id) => id} />);
    expect(container.innerHTML).toBe('');
  });
});

import React from 'react';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { render, screen, cleanup, waitFor, within, act } from '@testing-library/react';
import AgentWorkspace, { groupAgentLog, loopsOf, type AgentLogData } from '../AgentWorkspace';
import { TraceLogger } from '../../../../server/agents/trace';

afterEach(() => { cleanup(); sessionStorage.clear(); });

/**
 * Lines come from the real trace writer (TraceLogger), the same code every run uses, and are read back
 * from the file it wrote. Nothing here is a hand-written log file.
 */
function realLog(): AgentLogData {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-'));
  jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const t = new TraceLogger('maya-r1', dir);
  const ev = (agent_name: string, action: string, input_summary: string, output_summary: string, status: 'ok' | 'retry' | 'blocked' | 'fallback' | 'error' = 'ok', retry_count = 0) =>
    t.log({ agent_name, action, input_summary, output_summary, target_agent: null, confidence: null, retry_count, status });
  ev('benefits', 'evaluate', 'rule MA_PFML', '$0.00');
  // Fact-Checker sends a card back once (a send-back), then passes it
  ev('fact_checker', 'send_back', 'clawback-price-5 to clawback', 'wrong amount (corrected values: {})', 'retry', 1);
  ev('fact_checker', 'fact_check', 'card clawback-price-5 from clawback: claim {"type":"price_adjustment"}', 'verified');
  // Court: one rebuttal round on offer 1302
  ev('deal_hunter', 'argue', 'offer 1302', 'looks fine');
  ev('fine_print_lawyer', 'rebuttal', 'offer 1302 round 1', 'answered the lawyer', 'ok', 1);
  ev('judge', 'rule', 'offer 1302', 'approve');
  // a recall alert verified against the recall record
  ev('fact_checker', 'fact_check', 'recall card recall-cpsc-10560 from recall: claim {"type":"recall","recallId":10560}', 'verified against the recall record');
  // an ordinary recall card check that is not a verification loop
  ev('fact_checker', 'fact_check', 'recall card recall-fda-7 from recall: claim {"type":"recall"}', 'verified');
  // a photo retry
  ev('photo_reader', 'photo_retry', 'receipt photo 1', 'second read', 'retry', 1);
  ev('photo_reader', 'vision_extract', 'receipt photo 1 round 2', 'read 3 items', 'ok', 1);
  // a saved verdict reused
  ev('fine_print_court', 'court_debate', 'offer 1303', 'reused saved verdict from offer_checks:12, no AI call');
  // something that belongs to the whole run
  ev('zetaris', 'query', 'SELECT 1', '1 rows (sample cache)');
  const file = path.join(dir, fs.readdirSync(dir).find((f) => f.startsWith('run_bundle_'))!);
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return {
    runId: 'maya-r1', traceId: t.agentTraceId, lines, skipped: 0, backend: 'hmem-local', lessons: [],
    notes: [
      { from_agent: 'ClawbackHunter', to_agent: 'RecallChecker', type: 'question', about: 'clawback-price-5', round: 0, body: 'Is the playard on a recall list?' },
      { from_agent: 'RecallChecker', to_agent: 'ClawbackHunter', type: 'answer', about: 'clawback-price-5', round: 1, body: 'No recall found.' },
    ],
  };
}

const cards = [
  { id: 'clawback-price-5', title: 'Price drop on your Graco playard' },
  { id: 'discount-1302', title: 'Newborn diaper offer' },
  { id: 'recall-cpsc-10560', title: 'Recall alert: KEAWIS Crib Mattress' },
];

describe('loopsOf: which loop a log line belongs to', () => {
  const data = realLog();
  const find = (re: RegExp) => data.lines.find((l) => re.test(l.input_summary))!;
  it('recognises send-backs, the rebuttal round, photo retries, recall verifications and saved verdicts', () => {
    expect(loopsOf(data.lines.find((l) => /wrong amount/.test(l.output_summary))!)).toEqual(['send_back']);
    expect(loopsOf(find(/round 1/))).toEqual(['rebuttal']);
    expect(loopsOf(find(/receipt photo/))).toEqual(['photo_retry']);
    expect(loopsOf(data.lines.find((l) => /recall record/.test(l.output_summary))!)).toEqual(['recall_check']);
    expect(loopsOf(find(/recall-fda-7/))).toEqual([]);
    expect(loopsOf(data.lines.find((l) => /reused saved verdict/.test(l.output_summary))!)).toEqual(['saved_verdict']);
  });
  it('plain lines are in no loop', () => {
    expect(loopsOf(find(/^rule MA_PFML/))).toEqual([]);
    expect(loopsOf(data.lines.find((l) => l.input_summary === 'card clawback-price-5 from clawback: claim {"type":"price_adjustment"}')!)).toEqual([]);
  });
});

describe('groupAgentLog: per card and per loop', () => {
  const data = realLog();
  const g = groupAgentLog(data, cards);
  const byKey = (k: string) => g.groups.find((x) => x.key === k)!;

  it('counts every loop', () => {
    expect(g.counts).toEqual({ send_back: 1, rebuttal: 1, photo_retry: 1, recall_check: 1, saved_verdict: 1 });
  });
  it('puts a card\'s lines together under the card\'s title, offers matched to their cards', () => {
    expect(byKey('clawback-price-5').label).toBe('Price drop on your Graco playard');
    expect(byKey('clawback-price-5').lines).toHaveLength(2); // the send-back is found by its bare card id
    expect(byKey('discount-1302').label).toBe('Newborn diaper offer');
    expect(byKey('discount-1302').lines).toHaveLength(3); // hunter, lawyer rebuttal, judge
    expect(byKey('recall-cpsc-10560').lines).toHaveLength(1);
  });
  it('hangs workspace notes on their card, in round order', () => {
    expect(byKey('clawback-price-5').notes.map((n) => n.round)).toEqual([0, 1]);
  });
  it('keeps run-wide lines in one "Whole run" group at the end', () => {
    const last = g.groups[g.groups.length - 1];
    expect(last.key).toBe('__run');
    expect(last.lines.some((l) => l.input_summary === 'SELECT 1')).toBe(true);
  });
  it('without card titles it still groups, using plain labels', () => {
    const plain = groupAgentLog(data, []);
    expect(plain.groups.find((x) => x.key === 'offer 1302')!.label).toBe('Offer 1302');
    expect(plain.groups.find((x) => x.key === 'clawback-price-5')).toBeTruthy();
  });
  it('a note about a card with no log lines still gets a group', () => {
    const extra = groupAgentLog({ ...data, lines: [], notes: [data.notes[0]] }, cards);
    expect(extra.groups.map((x) => x.key)).toEqual(['clawback-price-5']);
  });
});

function mount(opts: { token?: string; data?: AgentLogData; status?: number } = {}) {
  const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) => ({
    ok: (opts.status ?? 200) < 400, status: opts.status ?? 200, json: async () => opts.data ?? {},
  }));
  (global as any).fetch = fetchMock;
  if (opts.token) sessionStorage.setItem('bundle:reviewerToken', opts.token);
  render(<AgentWorkspace runId="maya-r1" cards={cards} />);
  return fetchMock;
}

describe('<AgentWorkspace /> panel', () => {
  it('a parent (no reviewer code) sees nothing and the log is never even asked for', async () => {
    const f = mount();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText(/How the agents worked together/i)).toBeNull();
    expect(screen.queryByTestId('agent-workspace')).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it('the owner asks with the reviewer code and sees each loop\'s rounds and the notes', async () => {
    const data = realLog();
    const f = mount({ token: 'sekret', data });
    await waitFor(() => expect(screen.getByTestId('loop-counts')).toBeTruthy());
    expect(screen.getByText('How the agents worked together')).toBeTruthy();
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toBe('/api/runs/maya-r1/agent-log');
    expect((init?.headers as Record<string, string>)['x-reviewer-token']).toBe('sekret');
    const chips = screen.getByTestId('loop-counts');
    for (const label of ['Send-backs', 'Rebuttal rounds', 'Photo retries', 'Recall checks', 'Saved verdicts reused']) {
      expect(within(chips).getByText(label).parentElement!.textContent).toMatch(/1/);
    }
    expect(screen.getByText('Price drop on your Graco playard')).toBeTruthy();
    expect(screen.getByText('Newborn diaper offer')).toBeTruthy();
    expect(screen.getByText('Is the playard on a recall list?')).toBeTruthy();
    expect(screen.getByText('No recall found.')).toBeTruthy();
    expect(screen.getAllByText(/ClawbackHunter/).length).toBeGreaterThan(0);
  });

  it('tells the owner which store held the notes, and copes when that line is missing', async () => {
    const data = realLog();
    mount({ token: 'sekret', data: { ...data, backend: 'fallback-memory' } });
    await waitFor(() => expect(screen.getByTestId('workspace-backend').textContent).toMatch(/backup/i));
    cleanup();
    mount({ token: 'sekret', data: { ...data, backend: null } });
    await waitFor(() => expect(screen.getByTestId('loop-counts')).toBeTruthy());
    expect(screen.queryByTestId('workspace-backend')).toBeNull();
  });

  it('a run with no loops says so plainly instead of showing an empty box', async () => {
    const data = realLog();
    mount({ token: 'sekret', data: { ...data, lines: data.lines.filter((l) => loopsOf(l).length === 0), notes: [] } });
    await waitFor(() => expect(screen.getByText(/No loops this run/i)).toBeTruthy());
  });

  it('no log for the run (404) shows a short message; a refused code (403) shows nothing', async () => {
    mount({ token: 'sekret', status: 404, data: {} as any });
    await waitFor(() => expect(screen.getByText(/No agent log for this run/i)).toBeTruthy());
    cleanup();
    mount({ token: 'wrong', status: 403, data: {} as any });
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.queryByText(/How the agents worked together/i)).toBeNull();
  });
});

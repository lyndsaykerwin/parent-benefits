import { pollRun, MAX_POLL_FAILURES, type PollApi } from '../poll';
import type { RunStatus } from '../bundle';

const running: RunStatus = { runId: 'r1', familyId: 'maya', status: 'running', startedAt: '2026-10-23T00:00:00Z', result: null, error: null };
const done: RunStatus = { ...running, status: 'done', result: { familyId: 'maya', runId: 'r1', receipt: { moneyBackCents: 0, likelyBenefitsCents: 0, deadlineCount: 0, nextDeadline: null, itemsChecked: 0 }, cards: [], banner: null } };
const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

/** Let the pending promise chain settle, then advance the 1s timer. */
async function step(ms = 1000) {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  jest.advanceTimersByTime(ms);
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function setup(responses: (RunStatus | Error)[]) {
  let i = 0;
  const api: PollApi = {
    run: jest.fn(async () => { const r = responses[Math.min(i++, responses.length - 1)]; if (r instanceof Error) throw r; return r; }),
    trace: jest.fn(async () => []),
  };
  const h = { onStatus: jest.fn(), onDone: jest.fn(), onFailed: jest.fn(), onGiveUp: jest.fn() };
  return { api, h };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('pollRun', () => {
  it('4 failed polls in a row then success keeps polling and finishes', async () => {
    const fail = httpError(502);
    const { api, h } = setup([fail, fail, fail, fail, running, done]);
    const stop = pollRun('r1', api, h);
    for (let n = 0; n < 7; n++) await step();
    expect(h.onGiveUp).not.toHaveBeenCalled();
    expect(h.onStatus).toHaveBeenCalled();
    expect(h.onDone).toHaveBeenCalledTimes(1);
    expect(api.run).toHaveBeenCalledTimes(6);
    stop();
  });

  it(`${MAX_POLL_FAILURES} failed polls in a row gives up with 'lost'`, async () => {
    const { api, h } = setup([new TypeError('Failed to fetch')]);
    pollRun('r1', api, h);
    for (let n = 0; n < 8; n++) await step();
    expect(h.onGiveUp).toHaveBeenCalledTimes(1);
    expect(h.onGiveUp).toHaveBeenCalledWith('lost');
    expect(api.run).toHaveBeenCalledTimes(MAX_POLL_FAILURES);
  });

  it('a success resets the failure count', async () => {
    const f = httpError(500);
    const { api, h } = setup([f, f, f, f, running, f, f, f, f, done]);
    pollRun('r1', api, h);
    for (let n = 0; n < 12; n++) await step();
    expect(h.onGiveUp).not.toHaveBeenCalled();
    expect(h.onDone).toHaveBeenCalledTimes(1);
  });

  it('a 404 stops immediately with expired', async () => {
    const { api, h } = setup([httpError(404), running]);
    pollRun('r1', api, h);
    for (let n = 0; n < 4; n++) await step();
    expect(h.onGiveUp).toHaveBeenCalledWith('expired');
    expect(api.run).toHaveBeenCalledTimes(1);
  });
});

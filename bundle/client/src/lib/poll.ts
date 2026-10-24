import type { RunStatus, TraceLine } from './bundle';

/** Consecutive failed polls allowed before the page says it lost touch (about 5 seconds at 1 poll per second). */
export const MAX_POLL_FAILURES = 5;

export interface PollApi {
  run: (runId: string) => Promise<RunStatus>;
  trace: (runId: string) => Promise<TraceLine[]>;
}

export interface PollHandlers {
  onStatus: (status: RunStatus, trace: TraceLine[] | null) => void;
  onDone: (status: RunStatus) => void;
  onFailed: (message: string) => void;
  /** kind 'expired' = the server no longer knows the run (404); 'lost' = MAX_POLL_FAILURES failures in a row. */
  onGiveUp: (kind: 'expired' | 'lost') => void;
}

/**
 * Poll a run every `intervalMs` until it is done or failed.
 * A 404 stops at once (the run is gone); other errors (network blips, 5xx, rate limits)
 * are retried, and only MAX_POLL_FAILURES failures in a row end the polling.
 * Returns a stop function.
 */
export function pollRun(runId: string, api: PollApi, h: PollHandlers, intervalMs = 1000): () => void {
  let stopped = false;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = async () => {
    try {
      const [status, trace] = await Promise.all([api.run(runId), api.trace(runId).catch(() => null)]);
      if (stopped) return;
      failures = 0;
      h.onStatus(status, trace);
      if (status.status === 'done' && status.result) return h.onDone(status);
      if (status.status === 'failed') return h.onFailed(status.error || 'The run did not finish. Please try again.');
    } catch (e) {
      if (stopped) return;
      if ((e as { status?: number }).status === 404) return h.onGiveUp('expired');
      failures++;
      if (failures >= MAX_POLL_FAILURES) return h.onGiveUp('lost');
    }
    if (!stopped) timer = setTimeout(tick, intervalMs);
  };

  void tick();
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}

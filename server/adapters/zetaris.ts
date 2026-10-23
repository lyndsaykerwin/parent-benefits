import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { TraceLogger, TraceLine } from '../agents/trace';

export interface QueryResult {
  headers: string[];
  rows: Record<string, string | number | null>[];
  ms: number;
}

export class ZetarisUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZetarisUnavailable';
  }
}

export interface ZetarisOptions {
  baseUrl: string;
  orgId: string;
  apiKey: string;
  timeoutMs: number;
  sampleMode: boolean;
  cacheDir: string;
  fetchFn?: typeof fetch;
  trace?: TraceLogger;
}

const NUMERIC = /^-?\d+(\.\d+)?$/;

function coerce(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  const s = String(v);
  if (s === '' || s === 'null') return null;
  // Keep long digit strings (ids with leading zeros, huge numbers) as text.
  if (NUMERIC.test(s) && !(s.length > 1 && s.startsWith('0') && !s.startsWith('0.')) && s.length < 16) {
    return Number(s);
  }
  return s;
}

export class ZetarisClient {
  private fetchFn: typeof fetch;

  constructor(private opts: ZetarisOptions) {
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  /** A copy of this client that writes every query to the given run trace. */
  withTrace(trace: TraceLogger): ZetarisClient {
    return new ZetarisClient({ ...this.opts, trace, fetchFn: this.fetchFn });
  }

  private cachePath(sql: string): string {
    const key = crypto.createHash('sha256').update(sql).digest('hex');
    return path.join(this.opts.cacheDir, `${key}.json`);
  }

  private readCache(sql: string): QueryResult | null {
    try {
      return JSON.parse(fs.readFileSync(this.cachePath(sql), 'utf8')) as QueryResult;
    } catch {
      return null;
    }
  }

  private writeCache(sql: string, res: QueryResult): void {
    try {
      fs.mkdirSync(this.opts.cacheDir, { recursive: true });
      fs.writeFileSync(this.cachePath(sql), JSON.stringify(res));
    } catch {
      /* cache is best-effort */
    }
  }

  private trace(action: string, sql: string, summary: string, status: TraceLine['status'] | 'degraded'): void {
    this.opts.trace?.log({
      agent_name: 'zetaris', action, input_summary: sql.slice(0, 200),
      output_summary: summary, target_agent: null, confidence: null, retry_count: 0,
      status: status === 'degraded' ? 'fallback' : status,
    });
  }

  async runQuery(sql: string): Promise<QueryResult> {
    const text = sql.trim();
    if (text.endsWith(';')) {
      throw new Error('one statement, no trailing semicolon');
    }

    if (this.opts.sampleMode) {
      const cached = this.readCache(text);
      if (cached) {
        this.trace('query_cached', text, `${cached.rows.length} rows (sample cache)`, 'ok');
        return cached;
      }
      // No cache in sample mode: fall through to a live attempt.
    }

    const started = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.opts.timeoutMs);
    try {
      const resp = await this.fetchFn(`${this.opts.baseUrl.replace(/\/$/, '')}/api/proxy/sql-editor/sqls/run-query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.opts.apiKey}`,
          'X-Org-ID': this.opts.orgId,
          'X-Request-ID': crypto.randomUUID(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql: text, limit: 1000 }),
        signal: ctrl.signal,
      });
      if (resp.status >= 500) throw new ZetarisUnavailable(`Zetaris returned HTTP ${resp.status}`);
      if (!resp.ok) {
        const detail = (await resp.text()).slice(0, 300);
        // A rejected query is our bug, not an outage: do not hide it behind the cache.
        const err = new Error(`Zetaris rejected the query (HTTP ${resp.status}): ${detail}`);
        (err as any).clientError = true;
        throw err;
      }
      const body = (await resp.json()) as { headers?: string[]; data?: unknown[][] };
      const headers = body.headers ?? [];
      const rows = (body.data ?? []).map((r) => {
        const o: Record<string, string | number | null> = {};
        headers.forEach((h, i) => { o[h] = coerce(r[i]); });
        return o;
      });
      const res: QueryResult = { headers, rows, ms: Date.now() - started };
      this.writeCache(text, res);
      this.trace('query', text, `${rows.length} rows in ${res.ms} ms`, 'ok');
      return res;
    } catch (e: any) {
      if (e?.clientError) {
        this.trace('query', text, String(e.message).slice(0, 200), 'error');
        throw e;
      }
      const cached = this.readCache(text);
      if (cached) {
        this.trace('query_fallback_cache', text, `${cached.rows.length} rows (cache after failure)`, 'degraded');
        return cached;
      }
      this.trace('query', text, 'unavailable', 'error');
      if (e instanceof ZetarisUnavailable) throw e;
      throw new ZetarisUnavailable(`Zetaris unreachable or timed out: ${e?.message ?? e}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { ZetarisClient, ZetarisUnavailable } from '../adapters/zetaris';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('ZetarisClient', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zetaris-cache-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const make = (fetchFn: any, extra: Record<string, unknown> = {}) =>
    new ZetarisClient({
      baseUrl: 'https://z.example', orgId: '7', apiKey: 'k', timeoutMs: 50,
      sampleMode: false, cacheDir: dir, fetchFn, ...extra,
    });

  it('maps headers+data to rows and coerces numbers and nulls', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      jsonResponse({ headers: ['a', 'b', 'c', 'd'], data: [['1', 'x', '', 'null']] }));
    const res = await make(fetchFn).runQuery('SELECT 1');
    expect(res.rows[0].a).toBe(1);
    expect(res.rows[0].b).toBe('x');
    expect(res.rows[0].c).toBeNull();
    expect(res.rows[0].d).toBeNull();
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://z.example/api/proxy/sql-editor/sqls/run-query');
    expect(init.headers.Authorization).toBe('Bearer k');
    expect(init.headers['X-Org-ID']).toBe('7');
    expect(JSON.parse(init.body)).toEqual({ sql: 'SELECT 1', limit: 1000 });
  });

  it('throws ZetarisUnavailable on timeout with no cache', async () => {
    const fetchFn = jest.fn((_u: string, init: any) => new Promise((_res, rej) => {
      init.signal.addEventListener('abort', () => rej(new Error('aborted')));
    }));
    await expect(make(fetchFn).runQuery('SELECT 2')).rejects.toBeInstanceOf(ZetarisUnavailable);
  });

  it('returns cached rows on timeout when a cache file exists', async () => {
    const sql = 'SELECT 3';
    const key = crypto.createHash('sha256').update(sql).digest('hex');
    fs.writeFileSync(path.join(dir, `${key}.json`),
      JSON.stringify({ headers: ['n'], rows: [{ n: 3 }], ms: 5 }));
    const fetchFn = jest.fn((_u: string, init: any) => new Promise((_res, rej) => {
      init.signal.addEventListener('abort', () => rej(new Error('aborted')));
    }));
    const res = await make(fetchFn).runQuery(sql);
    expect(res.rows).toEqual([{ n: 3 }]);
  });

  it('rejects SQL ending in a semicolon', async () => {
    const fetchFn = jest.fn();
    await expect(make(fetchFn).runQuery('SELECT 1;')).rejects.toThrow('one statement, no trailing semicolon');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('writes the cache on live success and serves it in sampleMode without calling out', async () => {
    const live = jest.fn().mockResolvedValue(jsonResponse({ headers: ['n'], data: [['4']] }));
    await make(live).runQuery('SELECT 4');
    const offline = jest.fn();
    const res = await make(offline, { sampleMode: true }).runQuery('SELECT 4');
    expect(res.rows).toEqual([{ n: 4 }]);
    expect(offline).not.toHaveBeenCalled();
  });

  it('sample mode: a cache miss is "unavailable", never calls live Zetaris and never writes the cache', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse({ headers: ['n'], data: [['9']] }));
    await expect(make(fetchFn, { sampleMode: true }).runQuery('SELECT 9')).rejects.toBeInstanceOf(ZetarisUnavailable);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('throws ZetarisUnavailable on 5xx with no cache', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse({}, 503));
    await expect(make(fetchFn).runQuery('SELECT 5')).rejects.toBeInstanceOf(ZetarisUnavailable);
  });
});

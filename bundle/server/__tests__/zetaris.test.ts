import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { ZetarisClient, ZetarisUnavailable } from '../adapters/zetaris';
import { TraceLogger } from '../agents/trace';
import { checkAgentLogLine } from '@shared/agentLog';

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

  it('record mode: writes the cache on live success and serves it in sampleMode without calling out', async () => {
    const live = jest.fn().mockResolvedValue(jsonResponse({ headers: ['n'], data: [['4']] }));
    await make(live, { record: true }).runQuery('SELECT 4');
    const offline = jest.fn();
    const res = await make(offline, { sampleMode: true }).runQuery('SELECT 4');
    expect(res.rows).toEqual([{ n: 4 }]);
    expect(offline).not.toHaveBeenCalled();
  });

  it('live mode without record never writes the saved answers (only the record scripts may)', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse({ headers: ['n'], data: [['6']] }));
    const res = await make(fetchFn).runQuery('SELECT 6');
    expect(res.rows).toEqual([{ n: 6 }]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('live mode without record leaves an existing saved answer untouched', async () => {
    const sql = 'SELECT 7';
    const file = path.join(dir, `${crypto.createHash('sha256').update(sql).digest('hex')}.json`);
    const saved = JSON.stringify({ headers: ['n'], rows: [{ n: 1 }], ms: 5 });
    fs.writeFileSync(file, saved);
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse({ headers: ['n'], data: [['7']] }));
    expect((await make(fetchFn).runQuery(sql)).rows).toEqual([{ n: 7 }]);
    expect(fs.readFileSync(file, 'utf8')).toBe(saved);
  });

  it('withTrace copies keep the record setting', async () => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const t = new TraceLogger('z2', path.join(dir, 'logs'));
    const fetchFn = jest.fn().mockImplementation(async () => jsonResponse({ headers: ['n'], data: [['8']] }));
    await make(fetchFn).withTrace(t, 'recall').runQuery('SELECT 8');
    expect(fs.readdirSync(dir).filter((f) => f.endsWith('.json'))).toEqual([]);
    await make(fetchFn, { record: true }).withTrace(t, 'recall').runQuery('SELECT 8');
    expect(fs.readdirSync(dir).filter((f) => f.endsWith('.json'))).toHaveLength(1);
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

  it('writes query_zetaris lines in Lyndsay\'s log under the calling agent', async () => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const logs = path.join(dir, 'logs');
    const t = new TraceLogger('z1', logs);
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse({ headers: ['a'], data: [['1']] }));
    await make(fetchFn).withTrace(t, 'recall').runQuery('SELECT 1');
    const failing = jest.fn().mockRejectedValue(new Error('down'));
    await expect(make(failing).withTrace(t).runQuery('SELECT 2')).rejects.toBeTruthy();
    const her = fs.readFileSync(path.join(logs, 'run_bundle_z1.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(her[0]).toMatchObject({ agent_name: 'RecallChecker', action: 'query_zetaris', status: 'success', input_summary: 'SELECT 1' });
    expect(her[her.length - 1]).toMatchObject({ agent_name: 'Orchestrator', action: 'query_zetaris', status: 'rejected' });
    for (const l of her) expect(checkAgentLogLine(l)).toEqual([]);
    expect(t.lines().every((l) => l.agent_name === 'zetaris')).toBe(true);
  });
});

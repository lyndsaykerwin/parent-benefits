import express from 'express';
import request from 'supertest';
import { testerGate, gateHintCookie, cookieValueFor, TESTER_COOKIE } from '../middleware/testerCode';

function app(code: string | undefined, opts: { maxFailures?: number; now?: () => number } = {}) {
  const a = express();
  a.use(express.json());
  a.use(testerGate({ code: () => code, ...opts }));
  a.get('/api/health', (_q, r) => r.json({ status: 'ok' }));
  a.get('/api/secret', (_q, r) => r.json({ hello: 'family' }));
  a.get('/', (_q, r) => r.send('page'));
  return a;
}

const goodCookie = (code: string) => `${TESTER_COOKIE}=${cookieValueFor(code)}`;

describe('tester entry code', () => {
  it('with no code set (laptop), nothing is gated and the client is told no gate is needed', async () => {
    const a = app(undefined);
    expect((await request(a).get('/api/secret')).status).toBe(200);
    const s = await request(a).get('/api/tester-access');
    expect(s.body).toEqual({ required: false, ok: true });
  });

  it('blocks /api without the code but keeps health and the page itself open', async () => {
    const a = app('blue-otter');
    const r = await request(a).get('/api/secret');
    expect(r.status).toBe(401);
    expect(r.body.code).toBe('tester_code_required');
    expect((await request(a).get('/api/health')).status).toBe(200);
    expect((await request(a).get('/')).status).toBe(200);
    expect((await request(a).get('/api/tester-access')).body).toEqual({ required: true, ok: false });
  });

  it('typing the right code sets a cookie that then unlocks every /api route', async () => {
    const a = app('blue-otter');
    const r = await request(a).post('/api/tester-access').send({ code: '  blue-otter ' });
    expect(r.status).toBe(200);
    const setCookie = String(r.headers['set-cookie']);
    expect(setCookie).toContain(`${TESTER_COOKIE}=`);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).not.toContain('blue-otter'); // the code itself is never put in the cookie
    expect((await request(a).get('/api/secret').set('Cookie', goodCookie('blue-otter'))).status).toBe(200);
    expect((await request(a).get('/api/tester-access').set('Cookie', goodCookie('blue-otter'))).body).toEqual({ required: true, ok: true });
  });

  it('a cookie made for an old code stops working when the code changes', async () => {
    expect((await request(app('new-code')).get('/api/secret').set('Cookie', goodCookie('old-code'))).status).toBe(401);
  });

  it('the x-tester-code header also works (for scripts)', async () => {
    const a = app('blue-otter');
    expect((await request(a).get('/api/secret').set('x-tester-code', 'blue-otter')).status).toBe(200);
    const wrong = await request(a).get('/api/secret').set('x-tester-code', 'nope');
    expect(wrong.status).toBe(401);
    expect(wrong.body.code).toBe('tester_code_wrong'); // a wrong code is "wrong", not "code needed"
  });

  it.each(['/API/secret', '/Api/secret', '/api/secret/', '//api/secret', '/API/SECRET'])(
    'capital letters, extra or trailing slashes cannot skip the gate (%s)', async (p) => {
      const a = express();
      a.use(testerGate({ code: () => 'blue-otter' }));
      a.get('/api/secret', (_q, r) => r.json({ hello: 'family' })); // Express itself matches these case-insensitively
      const r = await request(a).get(p);
      expect(r.status).toBe(401);
      expect(r.body.code).toBe('tester_code_required');
    });

  it('the gate address and health work in any capitals too', async () => {
    const a = app('blue-otter');
    expect((await request(a).get('/API/Tester-Access')).body).toEqual({ required: true, ok: false });
    expect((await request(a).get('/API/HEALTH')).status).not.toBe(401);
  });

  it('a wrong code gets a friendly 401', async () => {
    const r = await request(app('blue-otter')).post('/api/tester-access').send({ code: 'guess' });
    expect(r.status).toBe(401);
    expect(r.body.code).toBe('tester_code_wrong');
    expect(r.headers['set-cookie']).toBeUndefined();
  });

  it('locks an address out after too many wrong guesses, even for the right code, then lets it in after the wait', async () => {
    let t = 1_000;
    const a = app('blue-otter', { maxFailures: 3, now: () => t });
    for (let i = 0; i < 3; i++) expect((await request(a).post('/api/tester-access').send({ code: `g${i}` })).status).toBe(401);
    const locked = await request(a).post('/api/tester-access').send({ code: 'blue-otter' });
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe('tester_code_locked');
    expect((await request(a).get('/api/secret').set('x-tester-code', 'blue-otter')).status).toBe(429);
    t += 16 * 60 * 1000;
    expect((await request(a).post('/api/tester-access').send({ code: 'blue-otter' })).status).toBe(200);
  });

  it('wrong header guesses count toward the same cap', async () => {
    const a = app('blue-otter', { maxFailures: 2 });
    await request(a).get('/api/secret').set('x-tester-code', 'a');
    await request(a).get('/api/secret').set('x-tester-code', 'b');
    expect((await request(a).post('/api/tester-access').send({ code: 'blue-otter' })).status).toBe(429);
  });

  it('a request with no code at all is not counted as a guess', async () => {
    const a = app('blue-otter', { maxFailures: 1 });
    for (let i = 0; i < 5; i++) await request(a).get('/api/secret');
    expect((await request(a).post('/api/tester-access').send({ code: 'blue-otter' })).status).toBe(200);
  });

  it('page loads carry a readable "gate is on" note only when a code is set, never on /api', async () => {
    const mk = (code?: string) => { const a = express(); a.use(gateHintCookie(() => code)); a.get('*', (_q, r) => r.send('x')); return a; };
    const page = (a: express.Express, p: string) => request(a).get(p).set('Accept', 'text/html,application/xhtml+xml,*/*;q=0.8');
    expect(String((await page(mk('c'), '/')).headers['set-cookie'])).toContain('bundle_gate=on');
    expect(String((await page(mk('c'), '/feed/abc')).headers['set-cookie'])).toContain('bundle_gate=on');
    expect((await page(mk('c'), '/api/x')).headers['set-cookie']).toBeUndefined();
    expect((await page(mk('c'), '/API/x')).headers['set-cookie']).toBeUndefined();
    expect((await page(mk(undefined), '/')).headers['set-cookie']).toBeUndefined();
    // files (scripts, styles, pictures) and non-page requests don't get it
    expect((await request(mk('c')).get('/assets/index-abc.js').set('Accept', '*/*')).headers['set-cookie']).toBeUndefined();
    expect((await page(mk('c'), '/assets/index-abc.css')).headers['set-cookie']).toBeUndefined();
    expect((await request(mk('c')).get('/')).headers['set-cookie']).toBeUndefined();
  });
});

import express from 'express';
import request from 'supertest';
import { securityHeaders } from '../security';

// Regression: Safari rewrote http://localhost script addresses to https (CSP "upgrade-insecure-requests"), so the dev
// page was blank. Plain-http responses must not carry it; https responses still should.
function app(isProd: boolean) {
  const a = express();
  a.set('trust proxy', 1);
  a.use(securityHeaders(isProd));
  a.get('/', (_q, r) => r.send('ok'));
  return a;
}

describe('security headers', () => {
  it.each([false, true])('plain http (prod=%s): no upgrade-insecure-requests, no HSTS, CSP otherwise intact', async (isProd) => {
    const r = await request(app(isProd)).get('/');
    expect(r.headers['content-security-policy']).toContain("default-src 'self'");
    expect(r.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
    expect(r.headers['strict-transport-security']).toBeUndefined();
  });

  it('https: keeps upgrade-insecure-requests and HSTS', async () => {
    const r = await request(app(true)).get('/').set('X-Forwarded-Proto', 'https');
    expect(r.headers['content-security-policy']).toContain('upgrade-insecure-requests');
    expect(r.headers['strict-transport-security']).toBeDefined();
  });
});

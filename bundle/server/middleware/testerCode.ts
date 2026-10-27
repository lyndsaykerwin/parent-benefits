import { createHash, timingSafeEqual } from 'crypto';
import type { Request, RequestHandler } from 'express';

/**
 * Tester entry code ("tester access code").
 *
 * When the setting TESTER_ACCESS_CODE is filled in (on the web host), every /api address except /api/health and the
 * gate's own address needs the code. A phone proves it knows the code in one of two ways:
 *   - a cookie the server hands out after the code is typed once on the gate screen (normal use), or
 *   - an `x-tester-code` header holding the code itself (handy for scripts and curl checks).
 * When the setting is empty (Lyndsay's Mac, tests), there is no gate at all.
 *
 * Wrong guesses are capped per visitor address so nobody can try codes one after another.
 */

export const TESTER_COOKIE = 'bundle_tester';
export const TESTER_HEADER = 'x-tester-code';
export const TESTER_ACCESS_PATH = '/api/tester-access';
/** A readable (not secret) cookie that only says "this site has a gate", so the screens know to wait for the check. */
export const GATE_HINT_COOKIE = 'bundle_gate';
const OPEN_PATHS = new Set(['/api/health', TESTER_ACCESS_PATH]);
const COOKIE_DAYS = 30;

export interface TesterGateOptions {
  /** The code. Defaults to process.env.TESTER_ACCESS_CODE, read on every request so a restart is not needed in tests. */
  code?: () => string | undefined;
  /** Wrong guesses allowed per address per window. [10] */
  maxFailures?: number;
  /** Window length in milliseconds. [15 minutes] */
  windowMs?: number;
  /** Clock, for tests. */
  now?: () => number;
}

/** The cookie holds a fingerprint of the code, not the code itself. Changing the code makes old cookies stop working. */
export function cookieValueFor(code: string): string {
  return createHash('sha256').update(`bundle-tester:${code}`).digest('hex');
}

function sameText(a: string, b: string): boolean {
  const x = createHash('sha256').update(a).digest();
  const y = createHash('sha256').update(b).digest();
  return timingSafeEqual(x, y);
}

/**
 * Express matches routes without caring about capital letters or a trailing slash, so the gate must not care either:
 * "/API/run", "/Api/run/" and "//api/run" all count as "/api/run".
 */
export function normalPath(p: string): string {
  const n = p.toLowerCase().replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  return n || '/';
}

const isApiPath = (p: string) => p === '/api' || p.startsWith('/api/');

function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return undefined; }
    }
  }
  return undefined;
}

export function testerGate(opts: TesterGateOptions = {}): RequestHandler {
  const getCode = opts.code ?? (() => process.env.TESTER_ACCESS_CODE);
  const maxFailures = opts.maxFailures ?? 10;
  const windowMs = opts.windowMs ?? 15 * 60 * 1000;
  const now = opts.now ?? Date.now;
  const failures = new Map<string, { count: number; resetAt: number }>();

  const who = (req: Request) => req.ip || req.socket.remoteAddress || 'unknown';
  const blocked = (req: Request) => {
    const f = failures.get(who(req));
    if (!f) return false;
    if (now() >= f.resetAt) { failures.delete(who(req)); return false; }
    return f.count >= maxFailures;
  };
  const recordFailure = (req: Request) => {
    const key = who(req);
    const f = failures.get(key);
    if (!f || now() >= f.resetAt) failures.set(key, { count: 1, resetAt: now() + windowMs });
    else f.count += 1;
    if (failures.size > 10_000) { // keep memory small: drop expired entries
      for (const [k, v] of failures) if (now() >= v.resetAt) failures.delete(k);
    }
  };
  const wrongCode = { error: 'That code didn’t work. Check the message you were sent and try again.', code: 'tester_code_wrong' };
  const tooMany = { error: 'Too many wrong codes. Please wait 15 minutes and try again.', code: 'tester_code_locked' };

  return (req, res, next) => {
    const code = (getCode() || '').trim();
    const path = normalPath(req.path);
    const hasCookie = (c: string) => {
      const v = readCookie(req, TESTER_COOKIE);
      return typeof v === 'string' && sameText(v, cookieValueFor(c));
    };

    // The gate's own address: "is a code needed, and do I already have it?" and "here is the code".
    if (path === TESTER_ACCESS_PATH) {
      if (req.method === 'GET') {
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ required: Boolean(code), ok: !code || hasCookie(code) });
      }
      if (req.method === 'POST') {
        if (!code) return res.json({ ok: true, required: false });
        if (blocked(req)) return res.status(429).json(tooMany);
        const typed = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
        if (!typed || !sameText(typed, code)) {
          recordFailure(req);
          return res.status(401).json(wrongCode);
        }
        res.cookie(TESTER_COOKIE, cookieValueFor(code), {
          httpOnly: true,
          sameSite: 'lax',
          secure: req.secure,
          maxAge: COOKIE_DAYS * 24 * 60 * 60 * 1000,
          path: '/',
        });
        return res.json({ ok: true, required: true });
      }
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!code || !isApiPath(path) || OPEN_PATHS.has(path)) return next();
    if (hasCookie(code)) return next();

    const header = req.get(TESTER_HEADER);
    if (header !== undefined) {
      if (blocked(req)) return res.status(429).json(tooMany);
      if (sameText(header.trim(), code)) return next();
      recordFailure(req);
      return res.status(401).json(wrongCode);
    }
    return res.status(401).json({ error: 'This test app needs the tester code you were sent.', code: 'tester_code_required' });
  };
}

/**
 * On page loads only (a browser asking for a web page, not /api and not files such as scripts or pictures), when a code
 * is set, leave a small readable "gate is on" note in a cookie. The screens read it straight away, so they show a blank
 * screen for a moment instead of flashing the app before the gate appears.
 */
export function gateHintCookie(code: () => string | undefined = () => process.env.TESTER_ACCESS_CODE): RequestHandler {
  return (req, res, next) => {
    const path = normalPath(req.path);
    const isPage = req.method === 'GET' && !isApiPath(path) && !/\.[a-z0-9]+$/.test(path)
      && String(req.headers.accept || '').includes('text/html');
    if ((code() || '').trim() && isPage) {
      res.cookie(GATE_HINT_COOKIE, 'on', { sameSite: 'lax', secure: req.secure, path: '/' });
    }
    next();
  };
}

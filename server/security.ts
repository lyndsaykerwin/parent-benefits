import helmet from 'helmet';
import type { RequestHandler } from 'express';

// Browser safety headers. Two flavours, picked per request:
//  - over https: the full set, including "upgrade insecure requests" and HSTS (both only make sense on https).
//  - over plain http (laptop, http://localhost): the same, WITHOUT those two. Safari obeys "upgrade insecure requests"
//    even for localhost and rewrites every script address to https://localhost, which has no certificate, so the page
//    loads blank. Chrome happens to exempt localhost, which is how this went unnoticed.
export function securityHeaders(isProd: boolean): RequestHandler {
  const build = (https: boolean) =>
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: isProd
            ? ["'self'", 'https://fonts.googleapis.com']
            : ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          scriptSrc: isProd ? ["'self'"] : ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          ...(https ? {} : { upgradeInsecureRequests: null }),
        },
      },
      strictTransportSecurity: https ? undefined : false,
      crossOriginOpenerPolicy: { policy: 'unsafe-none' },
      crossOriginEmbedderPolicy: false,
    });
  const secure = build(true);
  const plain = build(false);
  return (req, res, next) => (req.secure ? secure : plain)(req, res, next);
}

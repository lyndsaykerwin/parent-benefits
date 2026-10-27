import { loadEnv, trustProxyHops } from './env';
loadEnv(); // must run before anything reads process.env

import express, { type Request, Response, NextFunction } from "express";
import { randomUUID } from 'crypto';
import rateLimit from 'express-rate-limit';
import { securityHeaders } from './security';
import cors from 'cors';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { bodyParsers } from './middleware/bodyLimit';
import { sanitizeInputs } from './middleware/sanitize';
import { testerGate, gateHintCookie, TESTER_HEADER } from './middleware/testerCode';

const app = express();
const PORT = parseInt(process.env.PORT || '5050', 10);
const isProd = process.env.NODE_ENV === 'production';

// Hosts put a proxy in front of the app (Render, Fly, Replit...). Trust it in production so rate limits see each visitor's
// real address instead of the proxy's. Set TRUST_PROXY=0 to turn that off (e.g. production build run directly on a laptop).
const proxy = trustProxyHops();
if (proxy) app.set('trust proxy', proxy);

(async () => {
  app.use(securityHeaders(isProd));

  // Request ID on every response
  app.use((_req, res, next) => {
    res.setHeader('X-Request-Id', randomUUID());
    next();
  });

  app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again later.' },
  }));

  // Which other web addresses may call this server from a browser. The phone normally loads the screens and the server from
  // the same address, so this rarely matters; it lists the hosted address (PUBLIC_URL / FRONTEND_URL, or the address Render
  // fills in by itself, RENDER_EXTERNAL_URL) and always keeps the laptop addresses.
  const localOrigins = ['http://localhost:5173', `http://localhost:${PORT}`, 'http://127.0.0.1:5173', `http://127.0.0.1:${PORT}`];
  const hostedOrigins = [process.env.PUBLIC_URL, process.env.FRONTEND_URL, process.env.RENDER_EXTERNAL_URL]
    .filter((u): u is string => Boolean(u))
    .map((u) => u.trim().replace(/\/+$/, ''));
  app.use(cors({
    origin: [...hostedOrigins, ...localOrigins],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-reviewer-token', TESTER_HEADER],
    maxAge: 86400,
  }));

  app.use(...bodyParsers());
  app.use('/api', sanitizeInputs);
  // Tester entry code: only switched on when TESTER_ACCESS_CODE is set (the web host). Off on the laptop.
  app.use(testerGate());
  app.use(gateHintCookie());
  if (process.env.TESTER_ACCESS_CODE) log('tester entry code is ON: /api needs the code');

  if (!isProd) {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        if (req.path.startsWith('/api')) {
          log(`${req.method} ${req.path} ${res.statusCode} in ${Date.now() - start}ms`);
        }
      });
      next();
    });
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err);
    const status = err.status || err.statusCode || 500;
    const message = isProd && status >= 500 ? 'Internal Server Error' : err.message || 'Internal Server Error';
    res.status(status).json({ error: message });
  });

  // Vite's catch-all must come after every API route
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  server.listen(PORT, "0.0.0.0", () => {
    log(`serving on port ${PORT}`);
  });
})();

import { loadEnv, trustProxyHops } from './env';
loadEnv(); // must run before anything reads process.env

import express, { type Request, Response, NextFunction } from "express";
import { randomUUID } from 'crypto';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { bodyParsers } from './middleware/bodyLimit';
import { sanitizeInputs } from './middleware/sanitize';

const app = express();
const PORT = parseInt(process.env.PORT || '5050', 10);
const isProd = process.env.NODE_ENV === 'production';

// Hosts put a proxy in front of the app (Render, Fly, Replit...). Trust it in production so rate limits see each visitor's
// real address instead of the proxy's. Set TRUST_PROXY=0 to turn that off (e.g. production build run directly on a laptop).
const proxy = trustProxyHops();
if (proxy) app.set('trust proxy', proxy);

(async () => {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: isProd
          ? ["'self'", "https://fonts.googleapis.com"]
          : ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: isProd ? ["'self'"] : ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
      }
    },
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
    crossOriginEmbedderPolicy: false,
  }));

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

  app.use(cors({
    origin: isProd
      ? [process.env.FRONTEND_URL].filter((u): u is string => Boolean(u))
      : ['http://localhost:5173', `http://localhost:${PORT}`, 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-reviewer-token'],
    maxAge: 86400,
  }));

  app.use(...bodyParsers());
  app.use('/api', sanitizeInputs);

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

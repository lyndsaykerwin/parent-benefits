import type { Express } from "express";
import { createServer } from "http";

export async function registerRoutes(app: Express) {
  const server = createServer(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  return server;
}

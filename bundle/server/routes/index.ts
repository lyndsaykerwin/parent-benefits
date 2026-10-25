import type { Express } from "express";
import { createServer } from "http";
import { createBundleRouter, type ApiDeps } from "./bundleRoutes";
import { createPhotoRouter } from "./photoRoutes";
import { createOfferAuditRouter } from "./offerAuditRoutes";
import { createAgentLogRouter } from "./agentLogRoutes";
import { createDefaultApiDeps } from "../bundleDeps";

export async function registerRoutes(app: Express, apiDeps: ApiDeps = createDefaultApiDeps()) {
  const server = createServer(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use(createBundleRouter(apiDeps));
  app.use(createPhotoRouter());
  app.use(createAgentLogRouter({ reviewerToken: apiDeps.reviewerToken }));
  app.use(createOfferAuditRouter());

  return server;
}

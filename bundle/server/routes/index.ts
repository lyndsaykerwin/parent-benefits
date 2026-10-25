import type { Express } from "express";
import { createServer } from "http";
import { createBundleRouter, type ApiDeps } from "./bundleRoutes";
import { createPhotoRouter, createDefaultPhotoDeps } from "./photoRoutes";
import { createOfferAuditRouter } from "./offerAuditRoutes";
import { createOfferRouter } from "./offerRoutes";
import { createAgentLogRouter } from "./agentLogRoutes";
import { createStreamRouter } from "./streamRoutes";
import { createDefaultApiDeps } from "../bundleDeps";
import { BundleMemory } from "../adapters/memory";
import path from "path";

export async function registerRoutes(app: Express, apiDeps: ApiDeps = createDefaultApiDeps()) {
  const server = createServer(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use(createBundleRouter(apiDeps));
  app.use(createStreamRouter({ reviewerToken: apiDeps.reviewerToken }));
  // The offer routes need the full memory (they read case law). The app's own deps carry one; a test's stand-in gets the default folder.
  const memory = apiDeps.memory instanceof BundleMemory ? apiDeps.memory : new BundleMemory(path.resolve('data/hmem'));
  app.use(createPhotoRouter({
    ...createDefaultPhotoDeps(),
    rememberGear: (familyId, text) => memory.addFamilyFact(familyId, 'gear', text),
    forgetGear: (familyId) => { memory.forgetFamily(familyId, 'gear'); },
  }));
  app.use(createAgentLogRouter({ reviewerToken: apiDeps.reviewerToken }));
  app.use(createOfferAuditRouter());
  app.use(createOfferRouter({ llm: apiDeps.llm, memory }));

  return server;
}

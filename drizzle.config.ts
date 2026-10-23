import { loadEnv } from "./server/env";
import { defineConfig } from "drizzle-kit";

loadEnv();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set (see .env.example)");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // Only touch tables Bundle owns. The shared Neon database also holds
  // other tables (e.g. spike0_amazon_orders) that must never be dropped.
  tablesFilter: ["users"],
});

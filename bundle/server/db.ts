import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import ws from "ws";
import * as schema from "@shared/schema";

/**
 * True when the database address points at this machine (localhost, 127.x, ::1).
 * Case-insensitive: some URL schemes (postgres:) keep the hostname's original case.
 * Neon's own library talks to Neon over a websocket that a plain local Postgres
 * doesn't understand, so local addresses use the standard `pg` library instead.
 */
export function isLocalDatabaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return host === 'localhost' || host === '::1' || /^127\./.test(host);
  } catch {
    return false;
  }
}

/**
 * True only for Neon's own addresses (*.neon.tech, *.neondatabase…). Only Neon speaks the websocket the Neon library uses;
 * any other Postgres (local, Render dpg-*, etc.) would hang on that handshake, so it gets the standard `pg` library.
 */
export function isNeonDatabaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.endsWith('.neon.tech') || host.includes('neondatabase');
  } catch {
    return false;
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const url = process.env.DATABASE_URL;

/** Which driver this process is using: "neon" (Neon serverless) for Neon addresses, "pg" for every other Postgres. */
export const driver: 'pg' | 'neon' = isNeonDatabaseUrl(url) ? 'neon' : 'pg';

function connect() {
  if (driver === 'pg') {
    const pool = new pg.Pool({ connectionString: url });
    return { pool, db: drizzlePg({ client: pool, schema }) };
  }
  neonConfig.webSocketConstructor = ws;
  const pool = new NeonPool({ connectionString: url });
  return { pool, db: drizzleNeon({ client: pool, schema }) };
}

const conn = connect();

/** Both pools offer the same query()/end() calls callers use. */
export const pool = conn.pool as NeonPool;
/** Typed as the Neon flavour so existing callers compile unchanged; the query API is the same. */
export const db = conn.db as ReturnType<typeof drizzleNeon<typeof schema>>;

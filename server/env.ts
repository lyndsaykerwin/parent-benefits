import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

/** Default places to look for settings, in priority order (first one wins). */
export function defaultEnvFiles(cwd: string = process.cwd()): string[] {
  return [
    // The author's private settings file, kept outside the repo. A fresh clone does not have it and does not need it
    // (SAMPLE_MODE runs from .env alone); the other files are skipped when missing.
    path.resolve(cwd, '../.secrets/bundle.env.local'),
    path.resolve(cwd, '.env.local'),
    path.resolve(cwd, '.env'),
  ];
}

/**
 * Load settings from env files into process.env.
 * Missing files are skipped. A variable that is already set is never
 * overwritten, so real environment variables and earlier files always win.
 */
export function loadEnv(files: string[] = defaultEnvFiles()): void {
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    dotenv.config({ path: file, override: false });
  }
}

/**
 * How many proxy hops to trust for the visitor's address: 1 in production (hosts sit behind one proxy),
 * 0 otherwise. TRUST_PROXY=1 forces it on and TRUST_PROXY=0 forces it off, in any mode.
 */
export function trustProxyHops(env: Record<string, string | undefined> = process.env): number {
  if (env.TRUST_PROXY === '0') return 0;
  if (env.TRUST_PROXY === '1') return 1;
  return env.NODE_ENV === 'production' ? 1 : 0;
}

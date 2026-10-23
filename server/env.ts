import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

/** Default places to look for settings, in priority order (first one wins). */
export function defaultEnvFiles(cwd: string = process.cwd()): string[] {
  return [
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

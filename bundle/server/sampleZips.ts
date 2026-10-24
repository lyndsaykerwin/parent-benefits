import fs from 'fs';
import path from 'path';

/** Every assigned 3-digit ZIP prefix to its state, from data/sample/zip3-states.json (source links are inside that file). */
let cached: Record<string, string> | null = null;
function prefixes(): Record<string, string> {
  if (!cached) {
    const file = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'data/sample/zip3-states.json'), 'utf8'));
    cached = file.prefixes as Record<string, string>;
  }
  return cached;
}

/** ZIP prefix (first 3 digits) to state. Seeded into Neon by scripts/seed.ts and used directly in SAMPLE_MODE. */
export function zipRows(): { zip3: string; state: string }[] {
  const rows = Object.entries(prefixes()).map(([zip3, state]) => ({ zip3, state }));
  rows.push({ zip3: '000', state: 'US' }); // default: unknown prefix
  return rows;
}

export const zipStateMap = (): Record<string, string> => Object.fromEntries(zipRows().map((r) => [r.zip3, r.state]));

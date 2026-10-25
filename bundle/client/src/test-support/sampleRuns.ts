// Test helper: loads a real sample-mode run (output_examples/<family>.json, written by a real run of the server) so the
// screen tests use the real cards and totals, never hand-typed numbers.
import fs from 'fs';
import path from 'path';
import type { BundleResult } from '@shared/bundle';
import type { SavedRun } from '@/lib/bundle';

const FAMILIES: Record<string, { name: string; birthDate: string | null; dueDate: string | null; state: string }> = {
  maya: { name: 'Maya (sample family)', birthDate: '2026-10-03', dueDate: null, state: 'MA' },
  leo: { name: 'Leo (sample family)', birthDate: null, dueDate: '2026-12-07', state: 'MA' },
  ava: { name: 'Ava (sample family)', birthDate: '2026-08-24', dueDate: null, state: 'OH' },
  fern: { name: 'Fern (sample family)', birthDate: '2026-10-10', dueDate: null, state: 'FL' },
};

export function sampleRun(id: keyof typeof FAMILIES, over: { withState?: boolean } = {}): SavedRun {
  const file = path.join(__dirname, '../../../output_examples', `${id}.json`);
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as BundleResult;
  const f = FAMILIES[id];
  return {
    runId: `run-${id}`, familyId: id, today: '2026-10-23', demoDate: true, result: raw,
    family: { name: f.name, birthDate: f.birthDate, dueDate: f.dueDate, ...(over.withState ? { state: f.state } : {}) },
  };
}

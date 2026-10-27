/**
 * Records real vision-model answers for the sample photos so SAMPLE_MODE can replay them offline.
 *   npm run record-vision                 record every photo in data/sample/photos that has no saved answer yet
 *   npm run record-vision -- --force      record them all again
 *   npm run record-vision -- --kind receipt file.png   treat the named photo(s) as receipts (default: item;
 *                                         a file whose name starts with "receipt" is a receipt automatically)
 *
 * Needs MODEL_API_KEY (NVIDIA) on this machine. Answers are saved by the photo's fingerprint in
 * data/sample/vision-cache; this script is the only thing that writes there, and never by hand.
 * Sample photos must be made-up or public-notice images, never real family photos.
 */
import fs from 'fs';
import path from 'path';
import { loadEnv } from '../server/env';
import { createGenerator } from '../server/adapters/llm';
import { TraceLogger } from '../server/agents/trace';
import {
  createMemoryPhotoStore, defaultVisionCacheDir, hashImage, recordVisionAnswers, type PhotoKind,
} from '../server/ingest/photo';

const PHOTO_DIR = path.resolve(process.cwd(), 'data/sample/photos');

async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const ki = args.indexOf('--kind');
  const forcedKind = ki >= 0 ? (args[ki + 1] as PhotoKind) : undefined;
  const named = args.filter((a, i) => !a.startsWith('--') && (ki < 0 || i !== ki + 1));
  const files = (named.length ? named : fs.readdirSync(PHOTO_DIR)).filter((f) => /\.(png|jpe?g)$/i.test(f));
  if (!process.env.MODEL_API_KEY) { console.error('Set MODEL_API_KEY (NVIDIA) first. Nothing was recorded.'); process.exit(2); }
  if (!files.length) { console.error(`No sample photos found in ${PHOTO_DIR}.`); process.exit(1); }

  const gen = createGenerator();
  const cacheDir = defaultVisionCacheDir();
  let failed = 0;
  for (const f of files) {
    const bytes = fs.readFileSync(path.isAbsolute(f) ? f : path.join(PHOTO_DIR, f));
    const hash = hashImage(bytes);
    if (!force && fs.existsSync(path.join(cacheDir, `${hash}.json`))) { console.log(`${f}: already recorded (skipped)`); continue; }
    const kind: PhotoKind = forcedKind ?? (/^receipt/i.test(path.basename(f)) ? 'receipt' : 'item');
    const mimeType = /\.png$/i.test(f) ? 'image/png' : 'image/jpeg';
    const out = await recordVisionAnswers(
      { familyId: 'sample', kind, mimeType, bytes },
      { gen, store: createMemoryPhotoStore(), sampleMode: false, cacheDir, trace: new TraceLogger(`record_vision_${hash.slice(0, 8)}`), env: process.env },
    );
    console.log(`${f} (${kind}): ${out.status}${out.status === 'ok' ? ` in ${out.rounds} round(s)` : ''}`);
    if (out.status === 'unavailable' || out.status === 'invalid') failed++;
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error((e as Error).message); process.exit(1); });

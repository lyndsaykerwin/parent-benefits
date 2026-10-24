import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { NvidiaGenerator, ModelUnavailable, type Generator, type SeeRequest } from '../adapters/llm';
import { TraceLogger } from '../agents/trace';
import {
  checkReading, cleanUpc, upcCheckDigitOk, visionKindFor, readPhoto, forgetItems, hashImage,
  recordVisionAnswers, createMemoryPhotoStore, NEEDS_LIVE_MODEL_MESSAGE, CLEARER_PHOTO_MESSAGE,
  type PhotoDeps,
} from '../ingest/photo';
import { createPhotoRouter } from '../routes/photoRoutes';
import { startFakeOpenAiServer } from './helpers/fakeOpenAiServer';

// Made-up bytes standing in for a photo (never a real picture). The first 8 bytes are the PNG signature.
const fakePhoto = (tag: string) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(`synthetic-${tag}`)]);

const GOOD_ITEM = JSON.stringify({
  rejected: null,
  readText: 'Model No: RV001 is printed on a label under the walker seat. UPC 669028116546',
  store: null, purchasedOn: null,
  items: [{ productName: 'Baby walker', brand: 'Kmaier', modelNumber: 'RV001', lotCode: null, upc: '669028116546', sizeText: null, priceCents: null, quantity: 1 }],
});
const BAD_ITEM = JSON.stringify({
  rejected: null,
  readText: 'Model No: RV001 under the seat',
  store: null, purchasedOn: null,
  items: [{ productName: 'Baby walker', brand: 'Kmaier', modelNumber: 'ZZ999', lotCode: null, upc: '669028116547', sizeText: null, priceCents: null, quantity: 1 }],
});
const GOOD_RECEIPT = JSON.stringify({
  rejected: null,
  readText: 'MADE-UP BABY MART 2026-10-02 Size 1 diapers 24.50 Wipes 5.00 card ending 0000',
  store: 'Made-up Baby Mart', purchasedOn: '2026-10-02',
  items: [
    { productName: 'Size 1 diapers', brand: null, modelNumber: null, lotCode: null, upc: null, sizeText: null, priceCents: 2450, quantity: 1 },
    { productName: 'Wipes', brand: null, modelNumber: null, lotCode: null, upc: null, sizeText: null, priceCents: 500, quantity: 2 },
  ],
});

/** A scripted stand-in for the vision model. The last step repeats. */
function fakeVision(steps: (string | Error)[]) {
  const seen: SeeRequest[] = [];
  const gen: Generator = {
    async generate() { throw new Error('not used'); },
    async see(req: SeeRequest) {
      seen.push(req);
      const step = steps[Math.min(seen.length - 1, steps.length - 1)];
      if (step instanceof Error) throw step;
      return step;
    },
  };
  return { gen, seen };
}

let tmp: string;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-test-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

const deps = (gen: Generator, over: Partial<PhotoDeps> = {}): PhotoDeps => ({
  gen, store: createMemoryPhotoStore(), sampleMode: false, cacheDir: path.join(tmp, 'cache'),
  trace: new TraceLogger('photo-test', path.join(tmp, 'logs')), env: {}, ...over,
});

describe('UPC helpers', () => {
  it('accepts real check digits and refuses wrong ones', () => {
    expect(upcCheckDigitOk('669028116546')).toBe(true);
    expect(upcCheckDigitOk('070074537306')).toBe(true);
    expect(upcCheckDigitOk('669028116547')).toBe(false);
    expect(upcCheckDigitOk('12345')).toBe(false);
  });
  it('cleans spaces and turns a leading-zero 13-digit code into 12 digits', () => {
    expect(cleanUpc('0 70074 53730 6')).toBe('070074537306');
    expect(cleanUpc('0070074537306')).toBe('070074537306');
    expect(cleanUpc('abc')).toBeNull();
  });
});

describe('checkReading (the field checks)', () => {
  it('passes a clean item reading and keeps only known product fields', () => {
    const r = checkReading(JSON.parse(GOOD_ITEM), 'item');
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ productName: 'Baby walker', modelNumber: 'RV001', upc: '669028116546' });
    expect(r.items[0].confidence).toBeGreaterThan(0.8);
  });
  it('lists what was wrong: bad check digit and a code not found in the read text', () => {
    const r = checkReading(JSON.parse(BAD_ITEM), 'item');
    expect(r.kind).toBe('problems');
    if (r.kind !== 'problems') return;
    expect(r.problems.join(' ')).toMatch(/check digit/i);
    expect(r.problems.join(' ')).toMatch(/ZZ999/);
  });
  it('flags missing required fields', () => {
    const r = checkReading({ rejected: null, readText: '', items: [{ productName: '' }] }, 'item');
    expect(r.kind).toBe('problems');
    const r2 = checkReading({ rejected: null, readText: 'x', items: [] }, 'item');
    expect(r2.kind).toBe('problems');
  });
  it('passes a receipt with several lines and flags a line with no price', () => {
    const ok = checkReading(JSON.parse(GOOD_RECEIPT), 'receipt');
    expect(ok.kind === 'ok' && ok.items.map((i) => i.store)).toEqual(['Made-up Baby Mart', 'Made-up Baby Mart']);
    const bad = checkReading({ ...JSON.parse(GOOD_RECEIPT), store: null }, 'receipt');
    expect(bad.kind).toBe('problems');
  });
  it('rejects a photo the model says shows a person, address or non-product', () => {
    const r = checkReading({ rejected: 'not a product photo', readText: '', items: [] }, 'item');
    expect(r.kind).toBe('rejected');
  });
  it('refuses a malformed date', () => {
    const r = checkReading({ ...JSON.parse(GOOD_RECEIPT), purchasedOn: '10/02/26' }, 'receipt');
    expect(r.kind).toBe('problems');
  });
});

describe('which vision model a receipt uses', () => {
  it('uses the main vision model unless MODEL_VISION_RECEIPT is set on purpose (the old default is retired)', () => {
    expect(visionKindFor('receipt', {})).toBe('item');
    expect(visionKindFor('receipt', { MODEL_VISION_RECEIPT: '' })).toBe('item');
    expect(visionKindFor('receipt', { MODEL_VISION_RECEIPT: 'nvidia/some-model' })).toBe('receipt');
    expect(visionKindFor('item', { MODEL_VISION_RECEIPT: 'nvidia/some-model' })).toBe('item');
  });
  it('sends a receipt to the main vision model through a fake vision server', async () => {
    const server = await startFakeOpenAiServer({ script: [{ kind: 'reply', content: GOOD_RECEIPT }] });
    try {
      const gen = new NvidiaGenerator('k', server.baseUrl, { reasoning: 'r', fast: 'f' }, undefined, 5000, {
        vision: { item: 'works/omni', receipt: 'retired/nano-vl' },
      });
      const d = deps(gen);
      const out = await readPhoto({ familyId: 'maya', kind: 'receipt', mimeType: 'image/png', bytes: fakePhoto('receipt') }, d);
      expect(out.status).toBe('ok');
      expect(server.requests.filter((r) => r.url.includes('chat'))[0].body.model).toBe('works/omni');
    } finally { await server.close(); }
  });
});

describe('readPhoto: the retry loop', () => {
  const input = (kind: 'item' | 'receipt' = 'item', tag = 'a') => ({ familyId: 'maya', kind, mimeType: 'image/png', bytes: fakePhoto(tag) });

  it('good first reading: one call, rows written, no retry', async () => {
    const { gen, seen } = fakeVision([GOOD_ITEM]);
    const d = deps(gen);
    const out = await readPhoto(input(), d);
    expect(out.status).toBe('ok');
    expect(seen).toHaveLength(1);
    expect(out.status === 'ok' && out.rounds).toBe(1);
    const rows = await (d.store as ReturnType<typeof createMemoryPhotoStore>).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ familyId: 'maya', source: 'photo_item', modelNumber: 'RV001', upc: '669028116546', lineIndex: 0 });
    expect(rows[0].inputHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('bad then good: exactly one retry, told what was wrong, rows from the second reading', async () => {
    const { gen, seen } = fakeVision([BAD_ITEM, GOOD_ITEM]);
    const d = deps(gen);
    const out = await readPhoto(input(), d);
    expect(out.status).toBe('ok');
    expect(out.status === 'ok' && out.rounds).toBe(2);
    expect(seen).toHaveLength(2);
    expect(seen[1].prompt).toMatch(/check digit/i);
    expect(seen[1].prompt).toMatch(/ZZ999/);
    const rows = await (d.store as ReturnType<typeof createMemoryPhotoStore>).all();
    expect(rows[0].modelNumber).toBe('RV001');
  });

  it('bad twice: stops after the one retry, asks for a clearer photo, stores nothing', async () => {
    const { gen, seen } = fakeVision([BAD_ITEM, BAD_ITEM, GOOD_ITEM]);
    const d = deps(gen);
    const out = await readPhoto(input(), d);
    expect(out.status).toBe('needs_clearer_photo');
    expect(out.status === 'needs_clearer_photo' && out.message).toBe(CLEARER_PHOTO_MESSAGE);
    expect(seen).toHaveLength(2); // never a third call
    expect(await (d.store as ReturnType<typeof createMemoryPhotoStore>).all()).toHaveLength(0);
  });

  it('text that is not JSON counts as a bad reading and gets the one retry', async () => {
    const { gen, seen } = fakeVision(['I cannot tell, sorry', GOOD_ITEM]);
    const out = await readPhoto(input(), deps(gen));
    expect(out.status).toBe('ok');
    expect(seen).toHaveLength(2);
    expect(seen[1].prompt).toMatch(/JSON/);
  });

  it('a rejected photo is not retried and nothing is stored', async () => {
    const { gen, seen } = fakeVision([JSON.stringify({ rejected: 'not a product photo', readText: '', items: [] })]);
    const d = deps(gen);
    const out = await readPhoto(input(), d);
    expect(out.status).toBe('rejected');
    expect(seen).toHaveLength(1);
    expect(await (d.store as ReturnType<typeof createMemoryPhotoStore>).all()).toHaveLength(0);
  });

  it('the same photo twice does not count twice', async () => {
    const { gen } = fakeVision([GOOD_ITEM]);
    const d = deps(gen);
    await readPhoto(input(), d);
    await readPhoto(input(), d);
    expect(await (d.store as ReturnType<typeof createMemoryPhotoStore>).all()).toHaveLength(1);
  });

  it('receipt rows are source photo_receipt with one row per line', async () => {
    const { gen, seen } = fakeVision([GOOD_RECEIPT]);
    const d = deps(gen);
    const out = await readPhoto(input('receipt'), d);
    expect(out.status).toBe('ok');
    const rows = await (d.store as ReturnType<typeof createMemoryPhotoStore>).all();
    expect(rows.map((r) => [r.source, r.lineIndex, r.priceCents, r.quantity])).toEqual([
      ['photo_receipt', 0, 2450, 1], ['photo_receipt', 1, 500, 2],
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/card ending/i); // payment details are never copied
    expect(seen[0].prompt).toMatch(/receipt/i);
  });

  it('says plainly that the live model is needed when no model answers', async () => {
    const { gen } = fakeVision([new ModelUnavailable('no key', 'config')]);
    const out = await readPhoto(input(), deps(gen));
    expect(out).toMatchObject({ status: 'unavailable', message: NEEDS_LIVE_MODEL_MESSAGE });
  });

  it('rejects files that are not pictures or are too big, before calling the model', async () => {
    const { gen, seen } = fakeVision([GOOD_ITEM]);
    const a = await readPhoto({ ...input(), mimeType: 'application/pdf' }, deps(gen));
    expect(a.status).toBe('invalid');
    const b = await readPhoto({ ...input(), bytes: Buffer.alloc(6 * 1024 * 1024, 1) }, deps(gen));
    expect(b.status).toBe('invalid');
    const c = await readPhoto({ ...input(), bytes: Buffer.from('not a png at all') }, deps(gen));
    expect(c.status).toBe('invalid');
    expect(seen).toHaveLength(0);
  });
});

describe('the trace shows the retry rounds', () => {
  const traceLines = (dir: string) => {
    const f = fs.readdirSync(dir).filter((n) => n.startsWith('run-'));
    return f.flatMap((n) => fs.readFileSync(path.join(dir, n), 'utf8').trim().split('\n').map((l) => JSON.parse(l)));
  };
  it('bad then good shows vision_extract, retry_request (retry 1), vision_extract', async () => {
    const { gen } = fakeVision([BAD_ITEM, GOOD_ITEM]);
    await readPhoto({ familyId: 'maya', kind: 'item', mimeType: 'image/png', bytes: fakePhoto('t1') }, deps(gen));
    const lines = traceLines(path.join(tmp, 'logs'));
    expect(lines.map((l) => l.action)).toEqual(['vision_extract', 'retry_request', 'vision_extract']);
    expect(lines.map((l) => l.agent_name)).toEqual(['photo_reader', 'photo_reader', 'photo_reader']);
    expect(Math.max(...lines.map((l) => l.retry_count))).toBe(1);
  });
  it('bad twice ends with a blocked retry_request and never goes past retry 1', async () => {
    const { gen } = fakeVision([BAD_ITEM]);
    await readPhoto({ familyId: 'maya', kind: 'item', mimeType: 'image/png', bytes: fakePhoto('t2') }, deps(gen));
    const lines = traceLines(path.join(tmp, 'logs'));
    expect(lines[lines.length - 1]).toMatchObject({ action: 'retry_request', status: 'blocked' });
    expect(Math.max(...lines.map((l) => l.retry_count))).toBe(1);
  });
});

describe('privacy: the photo is not kept anywhere', () => {
  it('writes no picture bytes to disk, trace, or rows, and wipes the upload buffer', async () => {
    const bytes = fakePhoto('private-bytes');
    const b64 = bytes.toString('base64');
    const { gen } = fakeVision([BAD_ITEM, BAD_ITEM]);
    const d = deps(gen);
    await readPhoto({ familyId: 'maya', kind: 'item', mimeType: 'image/png', bytes }, d);
    const everything: string[] = [];
    const walk = (dir: string) => fs.existsSync(dir) && fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      const p = path.join(dir, e.name);
      e.isDirectory() ? walk(p) : everything.push(fs.readFileSync(p, 'latin1'));
    });
    walk(tmp);
    expect(everything.join('\n')).not.toContain(b64);
    expect(everything.join('\n')).not.toContain('synthetic-private-bytes');
    expect(bytes.every((x) => x === 0)).toBe(true);
  });

  it('"Forget my items" deletes the family rows and only that family', async () => {
    const { gen } = fakeVision([GOOD_ITEM]);
    const d = deps(gen);
    await readPhoto({ familyId: 'maya', kind: 'item', mimeType: 'image/png', bytes: fakePhoto('f1') }, d);
    await readPhoto({ familyId: 'leo', kind: 'item', mimeType: 'image/png', bytes: fakePhoto('f2') }, d);
    expect(await forgetItems('maya', d.store)).toBe(1);
    const left = await (d.store as ReturnType<typeof createMemoryPhotoStore>).all();
    expect(left.map((r) => r.familyId)).toEqual(['leo']);
  });
});

describe('sample mode: saved vision answers', () => {
  const photo = () => ({ familyId: 'maya', kind: 'item' as const, mimeType: 'image/png', bytes: fakePhoto('cached') });

  it('with no saved answer, says plainly that photo reading needs the live model and never calls a model', async () => {
    const { gen, seen } = fakeVision([GOOD_ITEM]);
    const out = await readPhoto(photo(), deps(gen, { sampleMode: true }));
    expect(out).toMatchObject({ status: 'unavailable', message: NEEDS_LIVE_MODEL_MESSAGE });
    expect(seen).toHaveLength(0);
  });

  it('replays answers saved by the recorder, including the retry, with no model call', async () => {
    const recorder = fakeVision([BAD_ITEM, GOOD_ITEM]);
    const cacheDir = path.join(tmp, 'cache');
    const rec = await recordVisionAnswers(photo(), deps(recorder.gen, { cacheDir }));
    expect(rec.status).toBe('ok');
    const files = fs.readdirSync(cacheDir);
    expect(files).toEqual([`${hashImage(fakePhoto('cached'))}.json`]);

    const live = fakeVision([new Error('must not be called')]);
    const d = deps(live.gen, { sampleMode: true, cacheDir });
    const out = await readPhoto({ ...photo(), bytes: fakePhoto('cached') }, d);
    expect(out.status).toBe('ok');
    expect(out.status === 'ok' && out.rounds).toBe(2);
    expect(live.seen).toHaveLength(0);
    const rows = await (d.store as ReturnType<typeof createMemoryPhotoStore>).all();
    expect(rows[0]).toMatchObject({ extractor: 'sample-cache', modelNumber: 'RV001' });
  });

  it('only the recorder writes the cache: a normal live read never does', async () => {
    const { gen } = fakeVision([GOOD_ITEM]);
    await readPhoto(photo(), deps(gen));
    expect(fs.existsSync(path.join(tmp, 'cache'))).toBe(false);
  });
});

describe('photo routes', () => {
  async function withApp(d: PhotoDeps, fn: (url: string) => Promise<void>) {
    const app = express();
    app.use(createPhotoRouter({ makeDeps: () => d }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    try { await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); } finally { server.close(); }
  }
  const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const body = (tag: string, over: object = {}) => ({ familyId: 'maya', kind: 'item', mimeType: 'image/png', imageBase64: fakePhoto(tag).toString('base64'), ...over });

  it('reads a photo and returns parent-safe fields only', async () => {
    const { gen } = fakeVision([GOOD_ITEM]);
    await withApp(deps(gen), async (url) => {
      const res = await post(`${url}/api/photo/read`, body('r1'));
      expect(res.status).toBe(200);
      const j = await res.json();
      expect(j.status).toBe('ok');
      expect(j.items[0]).toMatchObject({ productName: 'Baby walker', modelNumber: 'RV001' });
      expect(JSON.stringify(j)).not.toMatch(/inputHash|extractor|readText/);
    });
  });

  it('asks for a clearer photo after the retry fails', async () => {
    const { gen, seen } = fakeVision([BAD_ITEM]);
    await withApp(deps(gen), async (url) => {
      const j = await (await post(`${url}/api/photo/read`, body('r2'))).json();
      expect(j).toMatchObject({ status: 'needs_clearer_photo', message: CLEARER_PHOTO_MESSAGE });
      expect(seen).toHaveLength(2);
    });
  });

  it('refuses a bad request with 400 and a too-large upload with 413', async () => {
    const { gen } = fakeVision([GOOD_ITEM]);
    await withApp(deps(gen), async (url) => {
      expect((await post(`${url}/api/photo/read`, body('x', { familyId: '' }))).status).toBe(400);
      expect((await post(`${url}/api/photo/read`, body('x', { kind: 'selfie' }))).status).toBe(400);
      expect((await post(`${url}/api/photo/read`, body('x', { imageBase64: '' }))).status).toBe(400);
      const huge = Buffer.concat([fakePhoto('big'), Buffer.alloc(8 * 1024 * 1024)]).toString('base64');
      expect((await post(`${url}/api/photo/read`, body('x', { imageBase64: huge }))).status).toBe(413);
    });
  });

  it('forgets a family\'s items', async () => {
    const { gen } = fakeVision([GOOD_ITEM]);
    const d = deps(gen);
    await withApp(d, async (url) => {
      await post(`${url}/api/photo/read`, body('r3'));
      const j = await (await post(`${url}/api/photo/forget`, { familyId: 'maya' })).json();
      expect(j).toEqual({ deleted: 1 });
    });
  });
});

describe('hashImage', () => {
  it('is the sha256 of the bytes', () => {
    const b = fakePhoto('h');
    expect(hashImage(b)).toBe(crypto.createHash('sha256').update(b).digest('hex'));
  });
});

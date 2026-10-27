// Background photo reading (Lane C, Oct 26): upload answers at once, the read happens in the background, the result
// lands on the photo record, and a busy AI service is waited out instead of failing the photo.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { ModelUnavailable, type Generator, type SeeRequest } from '../adapters/llm';
import { TraceLogger } from '../agents/trace';
import { createMemoryPhotoStore, CLEARER_PHOTO_MESSAGE, READ_TROUBLE_MESSAGE, type PhotoDeps } from '../ingest/photo';
import { createPhotoJobs, READING_MESSAGE, STILL_BUSY_MESSAGE, INTERRUPTED_MESSAGE, STALE_READING_MS } from '../ingest/photoJobs';
import { createPhotoRouter } from '../routes/photoRoutes';

const fakePhoto = (tag: string) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(`synthetic-${tag}`)]);
const GOOD = JSON.stringify({
  rejected: null, unreadable: null, readText: 'MADE-UP SAMPLE BRAND Infant Car Seat Model No. SAMPLE-CS100 Date of Manufacture 2026/02/09 Lot CS0209B',
  items: [{ productName: 'Sample infant car seat', brand: 'Sample Brand', modelNumber: 'SAMPLE-CS100', lotCode: 'CS0209B', manufacturedOn: '2026/02/09', upc: null }],
});

/** A scripted vision model; each step can be held open until the test releases it. */
function fakeVision(steps: (string | Error)[]) {
  const seen: SeeRequest[] = [];
  const gen: Generator = {
    async generate() { throw new Error('not used'); },
    async see(req) { seen.push(req); const s = steps[Math.min(seen.length - 1, steps.length - 1)]; if (s instanceof Error) throw s; return s; },
  };
  return { gen, seen };
}

let tmp: string;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-jobs-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function setup(steps: (string | Error)[], over: Record<string, unknown> = {}) {
  const store = createMemoryPhotoStore();
  const v = fakeVision(steps);
  const d: PhotoDeps = { gen: v.gen, store, sampleMode: false, cacheDir: path.join(tmp, 'cache'), trace: new TraceLogger('jobs-test', path.join(tmp, 'logs')), env: {} };
  const timers: { fn: () => void; ms: number }[] = [];
  const jobs = createPhotoJobs({
    makeDeps: () => d,
    describe: async (out) => ({ status: 'ok', items: out.items.map((i) => ({ productName: i.productName, manufacturedOn: i.manufacturedOn })) }),
    setTimer: (fn, ms) => { timers.push({ fn, ms }); },
    ...over,
  });
  return { store, jobs, seen: v.seen, timers, d };
}
const input = (tag = 'a', kind: 'item' | 'receipt' = 'item') => ({ familyId: 'test-lane-c-fam', kind, mimeType: 'image/png', bytes: fakePhoto(tag) });

describe('background photo reading', () => {
  it('saves the photo record at once as "reading", then marks it done with the result', async () => {
    const { store, jobs } = setup([GOOD]);
    const started = await jobs.start(input());
    expect(started.ok).toBe(true);
    const photoId = (started as { photoId: number }).photoId;
    expect((await store.getPhoto(photoId))?.status).toMatch(/reading|done/);
    await jobs.idle();
    const v = await jobs.status('test-lane-c-fam', photoId);
    expect(v).toMatchObject({ status: 'done', message: null, kind: 'item' });
    expect(JSON.stringify(v?.result)).toMatch(/2026-02-09/);
    expect((await store.all())[0]).toMatchObject({ photoId, manufacturedOn: '2026-02-09', lotCode: 'CS0209B' });
    expect(await jobs.pending('test-lane-c-fam')).toEqual([]);
  });

  it('another family cannot see the photo', async () => {
    const { jobs } = setup([GOOD]);
    const s = await jobs.start(input()) as { photoId: number };
    await jobs.idle();
    expect(await jobs.status('someone-else', s.photoId)).toBeNull();
  });

  it('still busy after a whole read: stays "reading", says it will keep trying, and reads again later', async () => {
    const busy = new ModelUnavailable('503 ResourceExhausted', 'busy');
    const { jobs, seen, timers } = setup([busy, GOOD]);
    const s = await jobs.start(input()) as { photoId: number };
    await new Promise((r) => setTimeout(r, 20));
    expect(await jobs.status('test-lane-c-fam', s.photoId)).toMatchObject({ status: 'reading', message: STILL_BUSY_MESSAGE });
    expect(timers.map((t) => t.ms)).toContain(30_000);
    timers.find((t) => t.ms === 30_000)!.fn();
    await jobs.idle();
    expect(await jobs.status('test-lane-c-fam', s.photoId)).toMatchObject({ status: 'done' });
    expect(seen).toHaveLength(2);
  });

  it('gives up only after the extra busy waits, with a "try again" that re-reads the same photo', async () => {
    const busy = new ModelUnavailable('503 ResourceExhausted', 'busy');
    const { jobs, timers, seen } = setup([busy], { requeueMs: [10] });
    const s = await jobs.start(input()) as { photoId: number };
    await new Promise((r) => setTimeout(r, 20));
    timers.find((t) => t.ms === 10)!.fn();
    await jobs.idle();
    const v = await jobs.status('test-lane-c-fam', s.photoId);
    expect(v).toMatchObject({ status: 'failed', canRetry: true });
    expect(seen).toHaveLength(2);
    expect(await jobs.retry('test-lane-c-fam', s.photoId)).toBe('requeued');
    await new Promise((r) => setTimeout(r, 20));
    expect(seen).toHaveLength(3); // read again from the bytes still held: no new photo needed
    expect(await jobs.status('test-lane-c-fam', s.photoId)).toMatchObject({ status: 'reading' });
  });

  it('a garbled model is "we had trouble" (retryable), an unreadable photo asks for a clearer one', async () => {
    const a = setup(['not json at all']);
    const s1 = await a.jobs.start(input('g')) as { photoId: number };
    await a.jobs.idle();
    expect(await a.jobs.status('test-lane-c-fam', s1.photoId)).toMatchObject({ status: 'failed', message: READ_TROUBLE_MESSAGE, canRetry: true });
    const b = setup([JSON.stringify({ unreadable: 'too dark', items: [] })]);
    const s2 = await b.jobs.start(input('u')) as { photoId: number };
    await b.jobs.idle();
    expect(await b.jobs.status('test-lane-c-fam', s2.photoId)).toMatchObject({ status: 'needs_clearer_photo', message: CLEARER_PHOTO_MESSAGE, canRetry: false });
    expect((await b.jobs.pending('test-lane-c-fam')).map((p) => p.status)).toEqual(['needs_clearer_photo']);
    expect(await b.jobs.dismiss('test-lane-c-fam', s2.photoId)).toBe(true);
    expect(await b.jobs.pending('test-lane-c-fam')).toEqual([]);
  });

  it('a "reading" photo with no job for a long time (server restarted) shows as interrupted', async () => {
    let t = Date.now();
    const { jobs, store } = setup([GOOD], { now: () => t });
    const id = await store.savePhoto({ familyId: 'test-lane-c-fam', kind: 'gear', thumbnail: null, receiptImage: null, status: 'reading' });
    t += STALE_READING_MS + 1000;
    expect(await jobs.status('test-lane-c-fam', id)).toMatchObject({ status: 'failed', message: INTERRUPTED_MESSAGE, canRetry: false });
  });

  it('the same photo twice: the second shows the result once and leaves no extra record', async () => {
    const { jobs, store } = setup([GOOD]);
    await jobs.start(input('same'));
    await jobs.idle();
    const s = await jobs.start(input('same')) as { photoId: number };
    await jobs.idle();
    expect(await jobs.status('test-lane-c-fam', s.photoId)).toMatchObject({ status: 'done' });
    expect(await store.listPhotos('test-lane-c-fam')).toHaveLength(1);
  });

  it('wipes the photo bytes once read', async () => {
    const { jobs } = setup([GOOD]);
    const i = input('wipe');
    await jobs.start(i);
    await jobs.idle();
    expect(i.bytes.every((b) => b === 0)).toBe(true);
  });
});

describe('background photo routes', () => {
  it('POST /api/photo/start answers 202 "we\'re reading" at once; status and the locker list follow it', async () => {
    const store = createMemoryPhotoStore();
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const gen: Generator = { async generate() { return ''; }, async see() { await gate; return GOOD; } };
    const d: PhotoDeps = { gen, store, sampleMode: false, cacheDir: path.join(tmp, 'c'), trace: new TraceLogger('r', path.join(tmp, 'l')), env: {} };
    const app = express();
    app.use(createPhotoRouter({ makeDeps: () => d, now: () => new Date('2026-10-26T12:00:00Z') }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const res = await fetch(`${url}/api/photo/start`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ familyId: 'test-lane-c-fam', kind: 'item', mimeType: 'image/png', imageBase64: fakePhoto('route').toString('base64') }) });
      expect(res.status).toBe(202);
      const j = await res.json();
      expect(j).toMatchObject({ status: 'reading', message: READING_MESSAGE });
      const pend = await (await fetch(`${url}/api/families/test-lane-c-fam/photos`)).json();
      expect(pend.photos).toEqual([expect.objectContaining({ photoId: j.photoId, status: 'reading' })]);
      release();
      let st: { status: string; result?: { items: { manufacturedOn: string; recall: unknown }[] } } = { status: 'reading' };
      for (let i = 0; i < 50 && st.status === 'reading'; i++) {
        await new Promise((r) => setTimeout(r, 20));
        st = await (await fetch(`${url}/api/photo/status/${j.photoId}?familyId=test-lane-c-fam`)).json();
      }
      expect(st.status).toBe('done');
      expect(st.result?.items[0]).toMatchObject({ manufacturedOn: '2026-02-09' });
      expect(st.result?.items[0].recall).toBeTruthy();
      expect(JSON.stringify(st)).not.toMatch(/readText|inputHash|extractor/);
      const locker = await (await fetch(`${url}/api/families/test-lane-c-fam/gear`)).json();
      expect(locker.items[0]).toMatchObject({ modelNumber: 'SAMPLE-CS100', manufacturedOn: '2026-02-09' });
      expect((await fetch(`${url}/api/photo/status/${j.photoId}?familyId=other`)).status).toBe(404);
      expect((await fetch(`${url}/api/photo/examples/stroller`)).status).toBe(200);
      expect((await fetch(`${url}/api/photo/examples/..%2F..%2Fpackage.json`)).status).toBe(404);
    } finally { server.close(); }
  });
});

// Lane E extras on the gear routes: a sample family is checked as of the demo date (Oct 23, 2026), gear is written into Bundle's
// memory for the family, and "Forget my items" takes those entries back out.
import express from 'express';
import type { AddressInfo } from 'node:net';
import { TraceLogger } from '../agents/trace';
import type { Generator } from '../adapters/llm';
import { createMemoryPhotoStore, type PhotoDeps } from '../ingest/photo';
import { createPhotoRouter } from '../routes/photoRoutes';
import { bodyParsers } from '../middleware/bodyLimit';

const SEAT = JSON.stringify({
  rejected: null, readText: 'Model SAMPLE-1042 Graco infant car seat', store: null, purchasedOn: null,
  items: [{ productName: 'Graco infant car seat (sample)', brand: 'Graco', modelNumber: 'SAMPLE-1042', lotCode: null, upc: null, sizeText: null, priceCents: null, quantity: 1 }],
});
const vision: Generator = { async generate() { throw new Error('no'); }, async see() { return SEAT; } };
const mkDeps = (): PhotoDeps => ({ gen: vision, store: createMemoryPhotoStore(), sampleMode: false, cacheDir: '/nonexistent', trace: new TraceLogger('lane-e-gear', '/tmp/lane-e-gear-logs'), env: {} });
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from([0xff, 0xda, 0x00, 0x02]), Buffer.alloc(16, 7), Buffer.from([0xff, 0xd9])]);

async function withApp(extra: object, fn: (url: string) => Promise<void>) {
  const deps = mkDeps();
  const app = express();
  app.use(...bodyParsers());
  app.use(createPhotoRouter({ makeDeps: () => deps, ...extra }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  try { await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); } finally { server.close(); }
}
const send = (url: string, familyId: string) => fetch(`${url}/api/photo/read`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ familyId, kind: 'item', mimeType: 'image/jpeg', imageBase64: JPEG.toString('base64') }) });

describe('sample families use the demo date', () => {
  it('the photo result and the locker both say "as of" Oct 23, 2026 for Maya, and the real date for a typed-in family', async () => {
    await withApp({}, async (url) => {
      const maya = await (await send(url, 'maya')).json();
      expect(maya.items[0].recall.checkedOn).toBe('2026-10-23');
      expect((await (await fetch(`${url}/api/families/maya/gear`)).json()).items[0].recall.checkedOn).toBe('2026-10-23');
      const guest = await (await send(url, 'guest-ab12cd34')).json();
      expect(guest.items[0].recall.checkedOn).toBe(new Date().toISOString().slice(0, 10));
    });
  });
});

describe('gear and memory', () => {
  it('a scanned item is written into memory for the family, and Forget my items removes it again', async () => {
    const written: string[] = [];
    const forgotten: string[] = [];
    await withApp({ rememberGear: (id: string, text: string) => written.push(`${id}|${text}`), forgetGear: (id: string) => forgotten.push(id) }, async (url) => {
      await send(url, 'guest-ab12cd34');
      expect(written).toEqual(['guest-ab12cd34|Has: Graco infant car seat (sample)']);
      const res = await fetch(`${url}/api/photo/forget`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ familyId: 'guest-ab12cd34' }) });
      expect(res.status).toBe(200);
      expect(forgotten).toEqual(['guest-ab12cd34']);
    });
  });
});

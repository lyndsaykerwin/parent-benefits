import { fitWithin, checkPickedFile, preparePhoto, sendPhoto, MAX_SIDE, MAX_PICK_BYTES, type PhotoCodec } from '../photoPrep';

const file = (type: string, size = 1000) => ({ type, size, name: 'x' }) as unknown as File;

describe('fitWithin', () => {
  it('shrinks the long side to the limit and keeps the shape', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });
  it('never makes a small picture bigger', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
  it('never returns a zero side', () => {
    expect(fitWithin(5000, 1, 1600)).toEqual({ width: 1600, height: 1 });
  });
});

describe('checkPickedFile', () => {
  it('accepts jpeg, png and phone formats; refuses other files and huge ones', () => {
    expect(checkPickedFile(file('image/jpeg'))).toBeNull();
    expect(checkPickedFile(file('image/png'))).toBeNull();
    expect(checkPickedFile(file('image/heic'))).toBeNull();
    expect(checkPickedFile(file('application/pdf'))).toMatch(/photo/i);
    expect(checkPickedFile(file('image/jpeg', MAX_PICK_BYTES + 1))).toMatch(/big/i);
  });
});

describe('preparePhoto', () => {
  it('redraws onto a fresh picture (which drops location data) at the smaller size and returns JPEG base64', async () => {
    const drawn: { w: number; h: number }[] = [];
    const codec: PhotoCodec = {
      decode: async () => ({ width: 4000, height: 3000 }),
      redrawAsJpeg: async (_src, w, h) => { drawn.push({ w, h }); return 'QUJD'; },
    };
    const out = await preparePhoto(file('image/jpeg'), codec);
    expect(drawn).toEqual([{ w: MAX_SIDE, h: 1200 }]);
    expect(out).toEqual({ mimeType: 'image/jpeg', imageBase64: 'QUJD' });
  });
  it('says so when the picture cannot be opened', async () => {
    const codec: PhotoCodec = { decode: async () => { throw new Error('bad'); }, redrawAsJpeg: async () => '' };
    await expect(preparePhoto(file('image/jpeg'), codec)).rejects.toThrow(/open that photo/i);
  });
});

describe('sendPhoto', () => {
  it('posts only family, kind and the cleaned picture', async () => {
    const fetchFn = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ status: 'ok', items: [] }) })) as unknown as typeof fetch;
    const out = await sendPhoto({ familyId: 'maya', kind: 'item', mimeType: 'image/jpeg', imageBase64: 'QUJD' }, fetchFn);
    expect(out).toEqual({ status: 'ok', items: [] });
    const [url, init] = (fetchFn as unknown as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/photo/read');
    expect(JSON.parse(init.body as string)).toEqual({ familyId: 'maya', kind: 'item', mimeType: 'image/jpeg', imageBase64: 'QUJD' });
  });
  it('turns a server error into a plain message', async () => {
    const fetchFn = jest.fn(async () => ({ ok: false, status: 413, json: async () => ({ error: 'too big' }) })) as unknown as typeof fetch;
    await expect(sendPhoto({ familyId: 'maya', kind: 'item', mimeType: 'image/jpeg', imageBase64: 'x' }, fetchFn)).rejects.toThrow('too big');
  });
});

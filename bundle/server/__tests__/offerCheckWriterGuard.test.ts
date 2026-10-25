import { makeOfferCheckWriter } from '../bundleDeps';

describe('court-grade writer is never made in SAMPLE_MODE', () => {
  const saved = { SAMPLE_MODE: process.env.SAMPLE_MODE, LIVE_MODEL: process.env.LIVE_MODEL };
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  });

  it('SAMPLE_MODE=true: no writer, even with the live-model option on', () => {
    process.env.SAMPLE_MODE = 'true';
    process.env.LIVE_MODEL = 'true';
    expect(makeOfferCheckWriter()).toBeUndefined();
    process.env.LIVE_MODEL = 'false';
    expect(makeOfferCheckWriter()).toBeUndefined();
  });

  it('outside SAMPLE_MODE a writer exists (it opens the database only when it saves)', () => {
    process.env.SAMPLE_MODE = 'false';
    expect(typeof makeOfferCheckWriter()?.insert).toBe('function');
  });
});

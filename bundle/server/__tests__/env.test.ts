import fs from 'fs';
import os from 'os';
import path from 'path';
import { trustProxyHops, loadEnv } from '../env';

describe('loadEnv', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-env-'));
    delete process.env.FOO;
    delete process.env.ALREADY_SET;
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.FOO;
    delete process.env.ALREADY_SET;
  });

  it('loads variables from a file into process.env', () => {
    const file = path.join(dir, 'a.env');
    fs.writeFileSync(file, 'FOO=bar\n');
    loadEnv([file]);
    expect(process.env.FOO).toBe('bar');
  });

  it('does not overwrite a variable that is already set', () => {
    const file = path.join(dir, 'a.env');
    fs.writeFileSync(file, 'ALREADY_SET=from-file\n');
    process.env.ALREADY_SET = 'from-shell';
    loadEnv([file]);
    expect(process.env.ALREADY_SET).toBe('from-shell');
  });

  it('treats a variable set to an empty string as set (never overwritten by files)', () => {
    const file = path.join(dir, 'a.env');
    fs.writeFileSync(file, 'ALREADY_SET=from-file\nFOO=from-file\n');
    process.env.ALREADY_SET = '';
    process.env.FOO = '';
    loadEnv([file]);
    expect(process.env.ALREADY_SET).toBe('');
    expect(process.env.FOO).toBe('');
  });

  it('skips files that do not exist', () => {
    expect(() => loadEnv([path.join(dir, 'missing.env')])).not.toThrow();
  });

  it('lets earlier files win over later ones', () => {
    const first = path.join(dir, 'first.env');
    const second = path.join(dir, 'second.env');
    fs.writeFileSync(first, 'FOO=first\n');
    fs.writeFileSync(second, 'FOO=second\n');
    loadEnv([first, second]);
    expect(process.env.FOO).toBe('first');
  });
});

describe('trustProxyHops (I9)', () => {
  it('trusts one proxy in production by default, none otherwise', () => {
    expect(trustProxyHops({ NODE_ENV: 'production' })).toBe(1);
    expect(trustProxyHops({ NODE_ENV: 'development' })).toBe(0);
    expect(trustProxyHops({})).toBe(0);
  });
  it('TRUST_PROXY overrides in either direction', () => {
    expect(trustProxyHops({ NODE_ENV: 'production', TRUST_PROXY: '0' })).toBe(0);
    expect(trustProxyHops({ NODE_ENV: 'development', TRUST_PROXY: '1' })).toBe(1);
  });
});

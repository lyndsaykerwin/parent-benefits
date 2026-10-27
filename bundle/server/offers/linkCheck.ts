/**
 * Link check: loads every offer and benefit link a parent can see and prints, per link, the HTTP status, the final
 * address after redirects, and the page title. Run: `npm run links:check` (add `--json` for machine output).
 *
 * A link FAILS when the page is missing (404/410/5xx), the title says "not found", or it redirects to a different
 * page (a different path, e.g. a registry page that lands on registry search). Sites that block automated page loads
 * (403/429 or a "Just a moment..." bot check) are marked BOT-WALL: open those by hand in a normal browser.
 * Made-up demo links (example.com, *.test) are skipped: they are never shown to parents as live links.
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

export interface LinkSource { url: string; where: string }
export interface LinkResult extends LinkSource { status: number | null; finalUrl: string; title: string; verdict: 'OK' | 'REDIRECT-OK' | 'FAIL' | 'BOT-WALL' | 'SKIPPED'; note: string }

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const DEMO = /^https?:\/\/(?:[^/]*\.)?(?:example\.(?:com|org|net)|[^/]*\.test)(?:[/:?#]|$)/i;

const norm = (u: string) => { try { const x = new URL(u); return `${x.hostname.replace(/^www\./, '')}${x.pathname.replace(/\/+$/, '').toLowerCase()}`; } catch { return u; } };
const decode = (t: string) => t.replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

/** Grade one fetched page. Pure, so it is tested without the network. */
export function judgeLink(url: string, status: number | null, finalUrl: string, title: string): Pick<LinkResult, 'verdict' | 'note'> {
  if (DEMO.test(url)) return { verdict: 'SKIPPED', note: 'made-up demo link, never shown as a live link' };
  if (status === null) return { verdict: 'FAIL', note: 'no response' };
  if (status === 403 || status === 429 || /just a moment|access denied|attention required/i.test(title)) return { verdict: 'BOT-WALL', note: 'site blocks automated loads: open by hand' };
  if (status === 404 || status === 410 || status >= 500) return { verdict: 'FAIL', note: `HTTP ${status}` };
  if (/not found|page not found|can't find|cannot find|error code: 404/i.test(title)) return { verdict: 'FAIL', note: 'page says not found' };
  if (norm(url) !== norm(finalUrl)) {
    const a = new URL(url), b = new URL(finalUrl);
    // A redirect to the same path on another host spelling (honest.com vs www) or with a trailing slash is fine.
    if (a.pathname.replace(/\/+$/, '') === b.pathname.replace(/\/+$/, '')) return { verdict: 'OK', note: '' };
    return { verdict: 'FAIL', note: `redirects to a different page: ${b.hostname}${b.pathname}` };
  }
  return { verdict: 'OK', note: '' };
}

async function load(url: string): Promise<{ status: number | null; finalUrl: string; title: string }> {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA, accept: 'text/html', 'accept-language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(25_000) });
    const html = (await res.text()).slice(0, 400_000);
    const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    return { status: res.status, finalUrl: res.url || url, title: m ? decode(m[1]).slice(0, 100) : '' };
  } catch {
    return { status: null, finalUrl: url, title: '' };
  }
}

/** Every link a parent can see: seed offers and benefit rules, the bundled stand-ins, state programs and tax parameters. */
export async function collectLinks(root = process.cwd()): Promise<LinkSource[]> {
  const out: LinkSource[] = [];
  const add = (url: unknown, where: string) => { if (typeof url === 'string' && /^https?:\/\//.test(url)) out.push({ url, where }); };
  const seed = await import(pathToFileURL(path.join(root, 'scripts/seed.ts')).href).catch(() => null);
  for (const o of seed?.OFFERS ?? []) add(o.sourceUrl, `offer: ${o.store} | ${o.title}`);
  for (const r of seed?.BENEFIT_RULES ?? []) add(r.sourceUrl, `benefit rule: ${r.code ?? r.title}`);
  const sample = path.join(root, 'data/sample');
  const walk = (v: unknown, where: string): void => {
    if (Array.isArray(v)) v.forEach((x) => walk(x, where));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (/url$/i.test(k)) add(x, `${where}${(v as any).code ? `: ${(v as any).code}` : (v as any).title ? `: ${(v as any).title}` : ''}`); else walk(x, where); }
  };
  for (const f of ['fallback-offers.json', 'fallback-rules.json', 'state-programs.json', 'tax-parameters.json']) {
    try { walk(JSON.parse(fs.readFileSync(path.join(sample, f), 'utf8')), f); } catch { /* file missing: nothing to check */ }
  }
  const seen = new Set<string>();
  return out.filter((l) => (seen.has(l.url) ? false : (seen.add(l.url), true)));
}

export async function checkLinks(links: LinkSource[], loader = load): Promise<LinkResult[]> {
  const results: LinkResult[] = [];
  for (let i = 0; i < links.length; i += 6) {
    const batch = await Promise.all(links.slice(i, i + 6).map(async (l) => {
      if (DEMO.test(l.url)) return { ...l, status: null, finalUrl: l.url, title: '', verdict: 'SKIPPED' as const, note: 'made-up demo link, never shown as a live link' };
      const page = await loader(l.url);
      return { ...l, ...page, ...judgeLink(l.url, page.status, page.finalUrl, page.title) };
    }));
    results.push(...batch);
  }
  return results;
}

async function main() {
  const results = await checkLinks(await collectLinks());
  if (process.argv.includes('--json')) { console.log(JSON.stringify(results, null, 2)); return; }
  for (const r of results) {
    console.log(`${r.verdict.padEnd(9)} ${String(r.status ?? '---').padEnd(4)} ${r.url}\n          final: ${r.finalUrl}\n          title: ${r.title || '(none)'}${r.note ? `\n          note:  ${r.note}` : ''}\n          used:  ${r.where}`);
  }
  const n = (v: LinkResult['verdict']) => results.filter((r) => r.verdict === v).length;
  console.log(`\n${results.length} links: ${n('OK')} OK, ${n('FAIL')} FAIL, ${n('BOT-WALL')} BOT-WALL (check by hand), ${n('SKIPPED')} skipped demo links`);
  if (n('FAIL')) process.exitCode = 1;
}

if (process.argv[1] && /linkCheck\.ts$/.test(process.argv[1])) void main();

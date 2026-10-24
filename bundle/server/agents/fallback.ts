import fs from 'fs';
import path from 'path';
import type { Family } from '../../shared/bundle';
import type { Candidate } from './types';
import { screenRule, ruleFallbackText, isCheckWithJob } from './benefits';
import { addDays, fmtUsd } from './sql';
import { offlineProblem } from './offerScreen';

export const NOT_VERIFIED = "Not yet verified: some sources didn't respond.";

interface FallbackRule { code: string; title: string; scope: string; amountCents: number | null; windowEndDaysFromBirth: number | null; condition: string; sourceUrl: string }
interface FallbackOffer { title: string; store: string; valueCents: number | null; minAgeDays: number; maxAgeDays: number; finePrint: string; sourceUrl: string }

function readJson<T>(file: string): T[] {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'data/sample', file), 'utf8')) as T[];
  } catch {
    return [];
  }
}

/**
 * Bundled stand-ins used ONLY when agents returned too few checked cards. They are never verified:
 * verdict 'info', a visible "not yet verified" line, and (being 'info') excluded from Receipt totals.
 * Benefits use the Benefits Planner's own date logic (screenRule); offers are general ones only (no purchase trigger).
 */
export function buildFallbackFillers(family: Family, today: string): { approvedGeneralOffers: Candidate[]; federalBenefits: Candidate[] } {
  const anchor = family.birthDate ?? family.dueDate ?? null;
  const unborn = !family.birthDate && !!family.dueDate;
  const federalBenefits: Candidate[] = [];
  for (const r of readJson<FallbackRule>('fallback-rules.json')) {
    if (r.scope !== 'federal') continue; // stand-ins are federal only; a state's own programs need the checked source
    const screened = screenRule({ code: r.code, scope: r.scope, windowEndDays: r.windowEndDaysFromBirth }, family, today);
    if ('skip' in screened) continue;
    const checkWithJob = isCheckWithJob(r.code);
    const text = ruleFallbackText(r.code, r.title, checkWithJob ? null : r.amountCents, screened.deadline, unborn);
    federalBenefits.push({
      id: `fallback-benefit-${r.code.toLowerCase()}`, kind: 'benefit', title: `${r.title}${unborn && !checkWithJob ? ' (after birth)' : ''}`,
      body: `${text} ${NOT_VERIFIED}`, amountCents: checkWithJob ? null : r.amountCents, deadline: screened.deadline, verdict: 'info',
      sources: [{ label: r.title, url: r.sourceUrl }], traceId: 'fallback', agent: 'fallback',
      claim: { type: 'rule', ref: r.code }, evidenceSql: '', retryCount: 0,
    });
  }
  const age = anchor ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${anchor}T00:00:00Z`)) / 86_400_000) : 0;
  const approvedGeneralOffers: Candidate[] = readJson<FallbackOffer>('fallback-offers.json')
    .filter((o) => o.minAgeDays <= age && o.maxAgeDays >= age)
    .filter((o) => offlineProblem(o.finePrint) === null) // never offer a stand-in whose fine print needs a membership or has a big fee
    .map((o, i) => ({
      id: `fallback-offer-${i + 1}`, kind: 'discount' as const, title: o.title,
      body: `${o.store} has an offer${o.valueCents !== null ? ` worth about ${fmtUsd(o.valueCents)}` : ''}. ${NOT_VERIFIED} Fine Print Court has not checked it.`,
      amountCents: o.valueCents, deadline: anchor ? addDays(anchor, o.maxAgeDays) : null, verdict: 'info' as const,
      sources: [{ label: `${o.store} offer page`, url: o.sourceUrl }], traceId: 'fallback', agent: 'fallback',
      claim: { type: 'offer', title: o.title }, evidenceSql: '', retryCount: 0,
    }));
  return { approvedGeneralOffers, federalBenefits };
}

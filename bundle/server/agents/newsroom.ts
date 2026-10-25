/**
 * The newsroom loop (plan section 1b): the court learns from its own earlier work.
 *
 *  Before grading: read the grades already saved (one Zetaris question per run, savedVerdicts.ts) plus the
 *    lessons earlier checks left in Meterless H-MEM. An unchanged wording with an agreed grade, or a rule that
 *    holds for every family, skips the AI. Other past grades and lessons go into the Judge's prompt as context.
 *  After an agreed verdict: write one offer_checks row and one H-MEM lesson that points at it.
 *
 * Every use is traced, so a second offer's trace shows which past grades and lessons it used.
 * The saved answers are whatever Zetaris returns; nothing here is written by hand.
 */
import { fmtUsd } from './sql';
import { canSkipAi, fetchSavedVerdicts, type SavedVerdict } from './savedVerdicts';
import { buildOfferCheckRow } from './offerChecks';
import type { AgentContext, FinePrintCheck } from './types';
import type { Lesson } from './workspace';

/** How much a brand-new lesson is trusted at first; parent confirmations and Fact-Checker feedback move it from here. */
export const LESSON_CONFIDENCE = 0.6;
/** The strict cap on rebuttal rounds for one offer in one run. */
export const MAX_REBUTTALS = 1;
const MAX_LESSONS = 3;
const MAX_PAST = 3;

export interface OfferRef { id: number; store: string; title: string; finePrint: string; sourceUrl: string }

/** A grade from earlier: saved in the database, or made earlier in this same run. */
export interface PastGrade {
  from: 'saved' | 'this_run';
  offerId: string;
  store: string;
  verdict: string;
  trueValueCents: number | null;
  effortMinutes: number | null;
  payoutWaitDaysMax: number | null;
}

export interface NewsroomContext {
  pastGrades: PastGrade[];
  lessons: Lesson[];
  /** Plain-English paragraphs for the Judge prompt (empty when there is nothing to add). */
  promptText: string;
}

type Log = (agent: string, action: string, input: string, output: string, status?: 'ok' | 'retry' | 'blocked' | 'error' | 'fallback') => string;

/** Free text (store, title, lesson) goes into the Judge prompt as one quoted, single-line value, so it can never read as an instruction. */
export function quoted(text: string): string {
  return JSON.stringify(String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 120));
}

function describe(g: PastGrade): string {
  const bits = [
    `offer ${g.offerId} (store ${quoted(g.store)}) graded ${g.verdict}`,
    g.trueValueCents !== null ? `true value ${fmtUsd(g.trueValueCents)}` : 'true value unknown',
    g.effortMinutes !== null ? `about ${g.effortMinutes} minutes of effort` : 'effort unknown',
    g.payoutWaitDaysMax !== null ? `money in up to ${g.payoutWaitDaysMax} days` : 'paid right away or no wait stated',
  ];
  return bits.join(', ');
}

export class Newsroom {
  private saved = new Map<string, SavedVerdict>();
  private runGrades: PastGrade[] = [];
  private rebuttals = new Map<number, number>();
  /** Saved lesson ids each offer's grading used, so the Fact-Checker can tell the memory whether those lessons helped. */
  private lessonsUsed = new Map<string, string[]>();
  /** 'unavailable' means Zetaris could not answer; the court then grades everything fresh. */
  savedStatus: 'found' | 'none' | 'unavailable' | 'not_asked' = 'not_asked';

  constructor(private ctx: AgentContext, private log: Log) {}

  /** Ask Zetaris once for the grades already saved for the offers in play. Never throws. */
  private loaded = false;
  async load(offers: OfferRef[]): Promise<void> {
    if (!offers.length || this.loaded) return; // a retried run must not ask the question twice
    this.loaded = true;
    const res = await fetchSavedVerdicts(this.ctx.z, offers.map((o) => o.id));
    this.savedStatus = res.status;
    for (const v of res.verdicts) this.saved.set(v.offerId, v);
    this.log('fine_print_court', 'saved_verdicts', `${offers.length} offer(s) in play`,
      res.status === 'found' ? `${res.verdicts.length} saved grade(s) found` : res.status === 'none' ? 'no saved grades yet'
        : `saved grades unavailable (${res.reason ?? 'no answer'}); every offer is graded fresh`,
      res.status === 'unavailable' ? 'fallback' : 'ok');
  }

  /** Can the AI be skipped for this offer? Only 'agreed' saved grades count (canSkipAi checks that). */
  reusable(offer: OfferRef, fingerprint: string): { reason: 'same_fingerprint' | 'universal_rule'; saved: SavedVerdict } | null {
    const saved = this.saved.get(String(offer.id));
    const reason = canSkipAi(saved, fingerprint);
    return reason && saved ? { reason, saved } : null;
  }

  /** Past grades for the same store and matching H-MEM lessons; traced when anything is used. */
  context(offer: OfferRef): NewsroomContext {
    const store = offer.store.trim().toLowerCase();
    const fromSaved: PastGrade[] = [...this.saved.values()]
      .filter((v) => v.status === 'agreed' && v.store.trim().toLowerCase() === store)
      .map((v) => ({
        from: 'saved' as const, offerId: v.offerId, store: v.store, verdict: v.verdict, trueValueCents: v.trueValueCents,
        effortMinutes: v.effortMinutesEstimate, payoutWaitDaysMax: v.payoutWaitDaysMax,
      }));
    const fromRun = this.runGrades.filter((g) => g.store.trim().toLowerCase() === store);
    // This run's grades are newer, so they come first; the same offer is never its own precedent unless its wording changed.
    const seen = new Set<string>();
    const pastGrades = [...fromRun, ...fromSaved]
      .filter((g) => { const k = `${g.from}:${g.offerId}`; if (seen.has(k) || (g.from === 'this_run' && g.offerId === String(offer.id))) return false; seen.add(k); return true; })
      .slice(0, MAX_PAST);

    let lessons: Lesson[] = [];
    if (this.ctx.workspace) {
      try { lessons = this.ctx.workspace.recallLessons(`${offer.store} ${offer.title} ${offer.finePrint}`.slice(0, 300), MAX_LESSONS); } catch { lessons = []; }
    }

    if (lessons.length) this.lessonsUsed.set(String(offer.id), lessons.map((l) => l.id));
    const parts: string[] = [];
    if (pastGrades.length) parts.push(`Past grades for this store (from earlier checks; context, not binding):\n${pastGrades.map((g) => `- ${describe(g)}`).join('\n')}`);
    if (lessons.length) parts.push(`Lessons from earlier checks (from Meterless H-MEM):\n${lessons.map((l) => `- [${l.id}] ${quoted(l.text)}`).join('\n')}`);
    if (pastGrades.length || lessons.length) {
      this.log('fine_print_court', 'newsroom_context', `offer ${offer.id}`,
        `used ${pastGrades.length} past grade(s) [${pastGrades.map(describe).join(' | ')}] and ${lessons.length} H-MEM lesson(s) [${lessons.map((l) => l.id).join(', ')}]`);
    }
    return { pastGrades, lessons, promptText: parts.length ? `\n\n${parts.join('\n\n')}` : '' };
  }

  /** The H-MEM lesson ids used when this offer was graded (empty when none). */
  lessonIdsFor(offerId: string | number): string[] { return [...(this.lessonsUsed.get(String(offerId)) ?? [])]; }

  canRebut(offerId: number): boolean { return (this.rebuttals.get(offerId) ?? 0) < MAX_REBUTTALS; }
  useRebuttal(offerId: number): void { this.rebuttals.set(offerId, (this.rebuttals.get(offerId) ?? 0) + 1); }

  /** Remember a grade made in this run, so the next offer from the same store can use it. */
  remember(offer: OfferRef, check: FinePrintCheck, verdict: string): void {
    this.runGrades.unshift({
      from: 'this_run', offerId: String(offer.id), store: offer.store, verdict, trueValueCents: check.trueValueCents,
      effortMinutes: check.effortMinutesEstimate.max, payoutWaitDaysMax: check.payoutWaitDaysMax,
    });
  }

  /** After an agreed verdict: save the grade and leave one lesson. A failure here never breaks the run. */
  async writeBack(offer: OfferRef, check: FinePrintCheck, verdict: 'approve' | 'approve_with_catch' | 'reject', ruleIds: string[]): Promise<void> {
    this.remember(offer, check, verdict);
    const writer = this.ctx.offerChecks;
    if (!writer) {
      this.log('fine_print_court', 'offer_check_skipped', `offer ${offer.id}`, 'no database writer in this run, so the grade was not saved');
      return;
    }
    let rowId: string;
    try {
      rowId = await writer.insert(buildOfferCheckRow(offer, check, verdict, ruleIds, 'agreed'));
    } catch (e: any) {
      this.log('fine_print_court', 'offer_check_skipped', `offer ${offer.id}`, `grade not saved: ${String(e?.message ?? e).slice(0, 120)}`, 'fallback');
      return;
    }
    this.log('fine_print_court', 'offer_check_saved', `offer ${offer.id}`, `saved offer_checks row ${rowId}: ${verdict}, status agreed`);
    if (!this.ctx.workspace) return;
    try {
      const money = check.trueValueCents !== null ? `true value ${fmtUsd(check.trueValueCents)}` : 'no dollar value stated';
      const wait = check.payoutWaitDaysMax !== null ? `, money in up to ${check.payoutWaitDaysMax} days` : '';
      const catches = check.catchTypes.length ? `; catches: ${check.catchTypes.join(', ')}` : '; no catches found';
      const text = `${offer.store} offer "${offer.title}" graded ${verdict}: ${money}, about ${check.effortMinutesEstimate.max} minutes of effort${wait}${catches}`;
      this.ctx.workspace.addLesson({ text, offerCheckId: rowId, confidence: LESSON_CONFIDENCE });
    } catch (e: any) {
      this.log('fine_print_court', 'offer_check_skipped', `offer ${offer.id}`, `lesson not saved: ${String(e?.message ?? e).slice(0, 120)}`, 'fallback');
    }
  }
}

const perRun = new WeakMap<AgentContext, Newsroom>();

/** The one newsroom for this run (created on first use, so a send-back sees the same grades and rebuttal count). */
export function newsroomFor(ctx: AgentContext, log: Log): Newsroom {
  let n = perRun.get(ctx);
  if (!n) { n = new Newsroom(ctx, log); perRun.set(ctx, n); }
  return n;
}

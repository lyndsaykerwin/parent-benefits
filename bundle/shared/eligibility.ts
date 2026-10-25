/**
 * Plain rules that turn a family's onboarding answers (Q4 work, Q5 insurance) into advice. No screens, no network.
 * Used by the checking screen, the Insurance tab and the "Questions to ask HR" list, and tested on its own.
 * Sources: plans/v2-feedback-response.md sections A (Q4, Q5) and 2 (Insurance tab booster).
 */
import type { Household, InsuranceType, WorkStatus } from './bundle';

// ---------- Q4: daycare ----------

/**
 * Which daycare money-saver applies:
 *  - dcfsa: a Dependent Care FSA (a work account that pays for childcare with pre-tax money). Every parent who raises the baby earns,
 *    and at least one is paid through a job.
 *  - childcare_credit: everyone who earns is self-employed, so there is no work account, but the childcare tax credit can help.
 *  - none: a parent is not working. Daycare tax savings usually need earned income (the FSA has an exception for a stay-home
 *    parent who is a full-time student or disabled, so the copy says "usually", never "you don't qualify").
 *  - general: the parent chose not to say (or older families that never answered): we show the general rules.
 */
export type DaycareRoute = 'dcfsa' | 'childcare_credit' | 'none' | 'general';

export interface WorkAnswers {
  household?: Household | null;
  parent1Work?: WorkStatus | null;
  parent2Work?: WorkStatus | null;
}

/** The work answers that count: one parent for "Just me", two for "Two of us". Null when any are missing. */
export function earners(a: WorkAnswers): WorkStatus[] | null {
  if (!a.household || !a.parent1Work) return null;
  if (a.household === 'one') return [a.parent1Work];
  return a.parent2Work ? [a.parent1Work, a.parent2Work] : null;
}

export function daycareRoute(a: WorkAnswers): DaycareRoute {
  const e = earners(a);
  if (!e) return 'general';
  if (e.includes('not_working')) return 'none';
  if (e.includes('paycheck')) return 'dcfsa';
  return 'childcare_credit';
}

// ---------- Q5: insurance ----------

export type InsuranceKind = 'countdown' | 'covered' | 'may_qualify' | 'unknown';

export interface InsuranceDeadline {
  kind: InsuranceKind;
  /** Days after the birth to add the baby. Null when there is no countdown. */
  days: number | null;
  /** The pill on the Insurance tab. */
  pill: string;
  /** One or two plain sentences under the pill. */
  detail: string;
  /** A to-do instead of a countdown (MassHealth: report the birth). */
  todo?: string;
  /** Show a "check if your baby qualifies" link (nothing on file). */
  apply?: boolean;
}

/** What each state calls its Medicaid program, so we can show the name a parent knows. */
export function medicaidName(state?: string): string {
  if (state === 'MA') return 'MassHealth';
  if (state === 'CA') return 'Medi-Cal';
  return 'Medicaid';
}

/** The labels of the five Q5 choices, with the state's own names first. */
export function insuranceChoices(state?: string): { id: InsuranceType; label: string }[] {
  const marketplace = state === 'MA' ? 'Health Connector / Healthcare.gov'
    : state === 'CA' ? 'Covered California / Healthcare.gov'
      : state === 'NY' ? 'NY State of Health / Healthcare.gov'
        : 'Healthcare.gov / your state marketplace';
  const medicaid = state === 'MA' ? 'MassHealth / Medicaid / CHIP'
    : state === 'CA' ? 'Medi-Cal / Medicaid / CHIP'
      : 'Medicaid / CHIP';
  return [
    { id: 'job', label: 'Through a job (mine or my partner’s)' },
    { id: 'marketplace', label: marketplace },
    { id: 'medicaid', label: medicaid },
    { id: 'tricare', label: 'TRICARE (military)' },
    { id: 'none_or_not_sure', label: 'No insurance right now / not sure' },
  ];
}

export const insuranceLabel = (insurance: InsuranceType | null | undefined, state?: string): string | null =>
  insuranceChoices(state).find((c) => c.id === insurance)?.label ?? null;

/**
 * Which add-your-baby deadline applies to this insurance answer.
 *  - job: the federal minimum is 30 days (some plans give 60).
 *  - marketplace: 60 days; coverage can start on the birth date.
 *  - medicaid: the baby is covered automatically for the first year; report the birth within 10 days.
 *  - tricare: register the baby in DEERS (the military's family-records system) within 90 days (120 overseas).
 *  - none_or_not_sure: the baby may qualify for the state's Medicaid program.
 *  - not answered: we cannot give an exact date.
 */
export function insuranceDeadline(insurance: InsuranceType | null | undefined, state?: string): InsuranceDeadline {
  switch (insurance) {
    case 'job':
      return { kind: 'countdown', days: 30, pill: '30 days from birth to add baby', detail: 'The federal minimum is 30 days; some plans give 60. Check your plan. Coverage goes back to the birth date.' };
    case 'marketplace':
      return { kind: 'countdown', days: 60, pill: '60 days from birth to add baby', detail: 'Coverage can start on the birth date.' };
    case 'medicaid':
      return { kind: 'covered', days: null, pill: 'Baby is covered automatically for 1 year', detail: 'Report the birth within 10 days.', todo: 'To-do: report the birth within 10 days. No countdown needed.' };
    case 'tricare':
      return { kind: 'countdown', days: 90, pill: '90 days to register baby in DEERS', detail: 'DEERS is the military’s family-records system. You get 120 days if you’re overseas.' };
    case 'none_or_not_sure':
      return { kind: 'may_qualify', days: null, pill: `Your baby may qualify for ${medicaidName(state)}`, detail: 'Newborns without coverage may qualify. Check if your baby qualifies.', apply: true };
    default:
      return { kind: 'unknown', days: null, pill: 'Add your baby to a plan soon', detail: 'Deadlines run from 30 to 90 days after the birth, depending on your plan. Add your insurance later for your exact deadline.' };
  }
}

/** The last day to add the baby (ISO), from the birth date (or the due date while expecting). Null when there is no countdown. */
export function insuranceDeadlineDate(insurance: InsuranceType | null | undefined, baseIso: string | null | undefined, state?: string): string | null {
  const d = insuranceDeadline(insurance, state);
  if (d.days === null || !baseIso || !/^\d{4}-\d{2}-\d{2}$/.test(baseIso)) return null;
  const t = new Date(`${baseIso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + d.days);
  return t.toISOString().slice(0, 10);
}

// ---------- Questions to ask HR ----------

export interface QuestionList { title: string; items: string[] }

/**
 * The "Questions to ask HR" list, built from Q4 and Q5 with no extra question. It is honest about what Bundle cannot see
 * (an employer's private handbook).
 *  - job insurance adds the 30-or-60-days question;
 *  - a parent not working drops the Dependent Care FSA questions;
 *  - everyone self-employed gets questions for a tax preparer instead.
 */
export function questionsToAsk(a: WorkAnswers & { insurance?: InsuranceType | null }, taxYear: number): QuestionList {
  const route = daycareRoute(a);
  if (route === 'childcare_credit') {
    return {
      title: 'Questions for your tax preparer',
      items: [
        'Can we claim the childcare tax credit for daycare costs?',
        'Should we change our estimated tax payments now that baby is here?',
        `Which baby tax credits go on our ${taxYear} return?`,
      ],
    };
  }
  const items: string[] = [];
  if (a.insurance === 'job') items.push('Do we have 30 or 60 days to add our baby?');
  items.push('Does our plan offer paid parental leave top-up (extra pay on top of state leave)?');
  if (route !== 'none') {
    items.push('Do we offer a Dependent Care FSA, and what’s the cap?');
    items.push('When does the FSA life-event window close?');
  }
  return { title: 'Questions to ask HR', items };
}

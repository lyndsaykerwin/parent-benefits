import { useState } from 'react';
import { daysUntil, fmtDate } from '@/lib/bundle';
import { isAddBabyCard } from '@/lib/insurance';
import { tabForCard, urgentDeadlines } from '@/lib/tabs';
import { insuranceDeadline, insuranceLabel, daycareRoute } from '@shared/eligibility';
import { CardStack, CategoryHeader, ClaimDrawers, type TabProps } from './shared';
import HrQuestions from './HrQuestions';

const CARRIERS = ['Aetna', 'BCBS', 'UnitedHealthcare', 'Kaiser', 'Other'] as const;
const carrierKey = (familyId: string) => `bundle:carrier:${familyId}`;
const loadCarrier = (familyId: string): string | null => { try { return localStorage.getItem(carrierKey(familyId)); } catch { return null; } };
const saveCarrier = (familyId: string, c: string | null) => { try { if (c) localStorage.setItem(carrierKey(familyId), c); else localStorage.removeItem(carrierKey(familyId)); } catch { /* the choice lasts until the page closes */ } };

const noteBox = 'bundle-card mt-3 p-4';

/** Insurance and leave: the add-your-baby deadline (it follows the insurance answer), what plans cover, questions for HR, paid family leave. */
export default function InsuranceTab(props: TabProps) {
  const family = props.run.family;
  const [hr, setHr] = useState(false);
  const [carrier, setCarrier] = useState<string | null>(() => loadCarrier(props.run.familyId));
  const pick = (c: string | null) => { setCarrier(c); saveCarrier(props.run.familyId, c); };

  const mine = props.cards.filter((c) => tabForCard(c) === 'insurance');
  const addBaby = mine.filter(isAddBabyCard);
  const rest = mine.filter((c) => !isAddBabyCard(c));
  const urgent = urgentDeadlines(props.cards, props.run.today ?? '', props.stage, family).filter((u) => u.tab === 'insurance');
  const labels = Object.fromEntries(urgent.map((u) => [u.card.id, u.label]));
  const expecting = props.stage === 'expecting';
  const farthest = Math.max(0, ...urgent.map((u) => daysUntil(u.card.deadline as string, props.run.today)));

  if (hr) return <HrQuestions run={props.run} onBack={() => setHr(false)} />;

  const answer = family?.insurance ?? null;
  const info = insuranceDeadline(answer, family?.state);
  const answerLabel = insuranceLabel(answer, family?.state);
  const pump = answer === 'job' || answer === 'marketplace';
  const selfOnly = daycareRoute({ household: family?.household, parent1Work: family?.parent1Work, parent2Work: family?.parent2Work }) === 'childcare_credit';

  const title = expecting
    ? 'Deadlines that start at birth'
    : urgent.length > 0 ? `${urgent.length} ${urgent.length === 1 ? 'deadline' : 'deadlines'} in ${farthest} ${farthest === 1 ? 'day' : 'days'}` : 'Insurance and leave';
  const sub = expecting
    ? 'These count from your baby’s birth date. We will show the countdown once baby arrives.'
    : 'These count from your baby’s birth date. Miss them and you may wait a year.';

  // The pill sits inside the add-your-baby card, so the deadline and the answer it came from read as one thing.
  const pill = (
    <div className="mt-3" data-testid="insurance-deadline">
      <span data-testid="countdown-pill" className="inline-flex rounded-full bg-coral-tint px-3.5 py-1.5 text-[15px] font-bold text-coral-deep">{info.pill}</span>
      {info.kind === 'countdown' && expecting && <p className="mt-2 text-[14px] font-bold text-ink-2">The clock starts on your due date{family?.dueDate ? ` (${fmtDate(family.dueDate, props.run.today)})` : ''}.</p>}
      {info.todo && <p className="mt-2 rounded-xl bg-cream px-3 py-2 text-[14px] text-ink-2">{info.todo}</p>}
      {info.apply && <p className="mt-2 text-[14px] font-bold text-ink-2">Ask your state’s Medicaid office whether your baby qualifies. It’s free to check.</p>}
      {answerLabel && <p className="mt-2 text-[13px] text-ink-2">Your answer: {answerLabel}</p>}
    </div>
  );

  return (
    <>
      <CategoryHeader eyebrow="Insurance & leave" dot="#E4572E" title={title} sub={sub} />
      <CardStack cards={addBaby} props={props} deadlineLabels={expecting ? labels : undefined} extras={Object.fromEntries(addBaby.map((c) => [c.id, pill]))} />

      {pump && (
        <aside aria-label="Breast pump coverage" data-testid="card-breast-pump" className={noteBox}>
          <p className="eyebrow text-ink-2">Covered at $0</p>
          <h3 className="mt-1.5 text-[17px] font-extrabold leading-snug tracking-[-0.01em]">Your plan covers a breast pump at $0.</h3>
          <p className="mt-1 text-[15px] leading-relaxed text-ink-2">
            <b>Why?</b> A federal law makes most plans cover this, whichever company runs your plan. Older “grandfathered” plans and short-term plans are the exceptions. Baby vaccines: check your plan.
          </p>
          <a href="https://www.healthcare.gov/coverage/breast-feeding-benefits/" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-[32px] items-center rounded-full border border-line bg-cream px-3 text-[13px] font-semibold text-ink-2 underline-offset-2 hover:underline">HealthCare.gov: breastfeeding benefits</a>
        </aside>
      )}

      <aside aria-label="Things we can’t see" data-testid="card-hr-entry" className={noteBox}>
        <p className="eyebrow text-ink-2">Things we can’t see</p>
        <h3 className="mt-1.5 text-[17px] font-extrabold leading-snug tracking-[-0.01em]">{selfOnly ? 'Questions for your tax preparer' : 'Questions to ask HR'}</h3>
        <p className="mt-1 text-[15px] leading-relaxed text-ink-2">Your employer’s handbook is private, so here’s what to ask.</p>
        <button type="button" onClick={() => setHr(true)} className="mt-3 inline-flex min-h-[44px] items-center rounded-2xl bg-ink px-4 text-[15px] font-bold text-cream">See the questions ›</button>
      </aside>

      {pump && (carrier ? (
        <aside aria-label="Your carrier" data-testid="booster-carrier-result" className={noteBox}>
          <p className="eyebrow text-coral-deep">{carrier}</p>
          <h3 className="mt-1.5 text-[17px] font-extrabold leading-snug tracking-[-0.01em]">Here’s how to order your free pump through {carrier === 'Other' ? 'your plan' : carrier}</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[15px] leading-relaxed text-ink-2">
            <li>Call the member number on the back of your insurance card, or sign in to your plan’s member site.</li>
            <li>Ask for the breast pump benefit and which suppliers your plan uses.</li>
            <li>Many plans want a prescription from your doctor, so ask for one at your next visit.</li>
          </ol>
          <button type="button" onClick={() => pick(null)} className="mt-2 min-h-[44px] text-[14px] font-bold text-ink-2 underline decoration-line decoration-2 underline-offset-4">Pick a different company</button>
        </aside>
      ) : (
        <aside aria-label="Optional: your insurance company" data-testid="booster-carrier" className={noteBox}>
          <p className="eyebrow text-coral-deep">Optional</p>
          <h3 className="mt-1.5 text-[17px] font-extrabold leading-snug tracking-[-0.01em]">Which company is on your insurance card?</h3>
          <p className="mt-1 text-[15px] leading-relaxed text-ink-2">One tap gets you the steps to order your free pump.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CARRIERS.map((c) => (
              <button key={c} type="button" onClick={() => pick(c)} className="min-h-[44px] rounded-full border border-line bg-paper px-4 text-[15px] font-bold text-ink transition active:scale-[.98]">{c}</button>
            ))}
          </div>
        </aside>
      ))}

      <CardStack cards={rest} props={props} deadlineLabels={expecting ? labels : undefined} />
      <ClaimDrawers cards={mine} props={props} />
    </>
  );
}

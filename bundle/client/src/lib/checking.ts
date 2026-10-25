/**
 * The parent's "We're checking for you" lines, built from what the family told us. A line shows only when the run really does
 * that check (design/v2 and plans/v2-feedback-response.md, "Checking screen"):
 *  - the recall line only when the family has items to check;
 *  - the daycare line follows the daycare rule (FSA, childcare credit, general rules, or no line at all).
 */
import { daycareRoute } from '@shared/eligibility';
import type { FamilyView } from './bundle';

export interface CheckLine {
  key: string;
  title: string;
  caption: string;
  /** The last line is "double-checked": it only shows once the run has really finished. */
  final?: boolean;
}

/** The first line shows this long after the family is known, then one more line every LINE_GAP_MS. */
export const FIRST_LINE_MS = 600;
export const LINE_GAP_MS = 1300;

export function checkLines(family?: FamilyView): CheckLine[] {
  const lines: CheckLine[] = [
    { key: 'benefits', title: 'State and federal family benefits', caption: 'Based on your ZIP and baby’s age' },
    { key: 'insurance', title: 'Insurance deadline to add your baby', caption: family?.insurance ? 'Based on your insurance' : 'Based on the usual deadlines' },
  ];
  const route = daycareRoute(family ?? {});
  if (route === 'dcfsa') {
    lines.push({ key: 'daycare', title: 'Daycare tax savings and Dependent Care FSA', caption: family?.household === 'one' ? 'Based on how you earn' : 'Based on how each of you earns' });
  } else if (route === 'childcare_credit') {
    lines.push({ key: 'daycare', title: 'Childcare tax credit', caption: 'Based on your self-employment' });
  } else if (route === 'general') {
    lines.push({ key: 'daycare', title: 'Daycare tax savings (general)', caption: 'We checked the general rules' });
  }
  lines.push({ key: 'gifts', title: 'Free registry gifts and welcome boxes', caption: 'Checked for your baby’s exact age' });
  if (family?.hasItems) lines.push({ key: 'recalls', title: 'Your items vs. official recall lists', caption: 'Shown because your family has items' });
  lines.push({ key: 'double_check', title: 'Every result double-checked against its official source', caption: 'A Fact-Checker re-reads each card', final: true });
  return lines;
}

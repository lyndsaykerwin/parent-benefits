/**
 * Which "today" a run is evaluated at.
 *
 * The three sample families (maya, leo, ava) are fixed fake data whose windows (a price-adjustment deadline,
 * the 30-day insurance window) only make sense around Oct 23, 2026. So they run at DEMO_TODAY unless the
 * TODAY setting overrides it, and the app labels them "Demo date". A family a visitor types in uses the real date.
 */
export const SEED_FAMILY_IDS = ['maya', 'leo', 'ava'] as const;
export const DEMO_TODAY = '2026-10-23';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const isSeedFamily = (familyId: string): boolean => (SEED_FAMILY_IDS as readonly string[]).includes(familyId);

export function resolveToday(
  familyId: string,
  env: Record<string, string | undefined> = process.env,
  now: Date = new Date(),
): { today: string; demoDate: boolean } {
  if (isSeedFamily(familyId)) {
    return { today: env.TODAY && ISO.test(env.TODAY) ? env.TODAY : DEMO_TODAY, demoDate: true };
  }
  return { today: now.toISOString().slice(0, 10), demoDate: false };
}

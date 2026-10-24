/**
 * Onboarding helpers (top row of the mocks): ZIP → state, the ZIP screen message and the baby-age hint.
 * The server still decides which programs apply; this only words the confirmation line.
 */

/** States whose own programs Bundle checks. Must match the states in data/sample/state-programs.json (a test enforces it). Everyone else sees federal programs plus "coming soon". */
export const COVERED_STATES = ['CA', 'MA', 'NY'] as const;

export const UNCOVERED_STATE_NOTE = 'Support for your state’s programs is coming soon';

const NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', DC: 'Washington, D.C.', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  PR: 'Puerto Rico', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas',
  UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

/** First-3-digit ZIP ranges by state (USPS prefix blocks, simplified). */
const RANGES: [number, number, string][] = [
  [6, 9, 'PR'], [10, 27, 'MA'], [28, 29, 'RI'], [30, 38, 'NH'], [39, 49, 'ME'], [50, 59, 'VT'], [60, 69, 'CT'],
  [70, 89, 'NJ'], [100, 149, 'NY'], [150, 196, 'PA'], [197, 199, 'DE'], [200, 205, 'DC'], [206, 219, 'MD'],
  [220, 246, 'VA'], [247, 268, 'WV'], [270, 289, 'NC'], [290, 299, 'SC'], [300, 319, 'GA'], [320, 349, 'FL'],
  [350, 369, 'AL'], [370, 385, 'TN'], [386, 397, 'MS'], [398, 399, 'GA'], [400, 427, 'KY'], [430, 459, 'OH'],
  [460, 479, 'IN'], [480, 499, 'MI'], [500, 528, 'IA'], [530, 549, 'WI'], [550, 567, 'MN'], [570, 577, 'SD'],
  [580, 588, 'ND'], [590, 599, 'MT'], [600, 629, 'IL'], [630, 658, 'MO'], [660, 679, 'KS'], [680, 693, 'NE'],
  [700, 714, 'LA'], [716, 729, 'AR'], [730, 749, 'OK'], [750, 799, 'TX'], [800, 816, 'CO'], [820, 831, 'WY'],
  [832, 838, 'ID'], [840, 847, 'UT'], [850, 865, 'AZ'], [870, 884, 'NM'], [889, 898, 'NV'], [900, 961, 'CA'],
  [967, 968, 'HI'], [970, 979, 'OR'], [980, 994, 'WA'], [995, 999, 'AK'],
];

export interface ZipState { code: string; name: string; covered: boolean }

export function stateForZip(zip: string): ZipState | null {
  if (!/^\d{5}$/.test(zip)) return null;
  const n = Number(zip.slice(0, 3));
  const hit = RANGES.find(([from, to]) => n >= from && n <= to);
  if (!hit) return null;
  const code = hit[2];
  return { code, name: NAMES[code], covered: (COVERED_STATES as readonly string[]).includes(code) };
}

/** Shown when the server turns down a ZIP this screen accepted (the server knows fewer states than the ZIP table). */
export function zipRejectedMessage(zip: string): string {
  const s = stateForZip(zip);
  return `We can’t check ${s ? s.name : 'your area'} yet. Try a sample family to see how it works.`;
}

/** The confirmation line under the ZIP box, or null until a full ZIP is typed. */
export function zipMessage(zip: string): string | null {
  if (!/^\d{5}$/.test(zip)) return null;
  const s = stateForZip(zip);
  if (s?.covered) return `Found it: showing ${s.name} programs plus federal ones`;
  const where = s ? `${s.name}: showing federal programs` : 'Showing federal programs';
  return `${where}. ${UNCOVERED_STATE_NOTE}.`;
}

/** "20 days old: some 30-day deadlines are still open", shown only while that is true. */
export function babyAgeLine(birthDate: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${birthDate}T00:00:00Z`)) / 86_400_000);
  if (days < 0 || days >= 30) return null;
  if (days === 0) return 'Born today: every 30-day deadline is still open';
  return `${days} day${days === 1 ? '' : 's'} old: some 30-day deadlines are still open`;
}

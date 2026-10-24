/** ZIP prefix (first 3 digits) to state. Seeded into Neon by scripts/seed.ts and used directly in SAMPLE_MODE. */
export function zipRows(): { zip3: string; state: string }[] {
  const rows: { zip3: string; state: string }[] = [];
  const range = (from: number, to: number, state: string) => {
    for (let n = from; n <= to; n++) rows.push({ zip3: String(n).padStart(3, '0'), state });
  };
  range(10, 27, 'MA');
  range(430, 459, 'OH');
  range(100, 119, 'NY');
  range(900, 935, 'CA');
  range(750, 799, 'TX');
  range(30, 38, 'NH');
  rows.push({ zip3: '000', state: 'US' }); // default: unknown prefix
  return rows;
}

export const zipStateMap = (): Record<string, string> => Object.fromEntries(zipRows().map((r) => [r.zip3, r.state]));

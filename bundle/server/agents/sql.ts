/**
 * Safe building blocks for the SQL our agents send to Zetaris.
 * Anything interpolated into SQL goes through one of these; everything else
 * (item text, merchant names, keywords) stays inside Zetaris and is joined there.
 */
export class InvalidId extends Error {}

const SAFE_ID = /^[A-Za-z0-9_.:-]+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Quote an id for SQL. Only plain id characters are allowed (no quotes, backslashes, spaces); anything else throws. */
export function quoteId(v: string | number | undefined | null): string {
  const s = v === undefined || v === null ? '' : String(v);
  if (!SAFE_ID.test(s)) throw new InvalidId('invalid id');
  return `'${s}'`;
}

/**
 * A family typed into the form (id `guest-…`): it is never saved, so no database row, purchase or card
 * transaction can exist for it. Agents skip the queries that look those up (they could never return anything).
 */
export const isInlineFamily = (f: { id: string; isGuest: boolean }): boolean => f.isGuest && f.id.startsWith('guest-');

/** Quote an ISO date (YYYY-MM-DD) for SQL, or throw. */
export function quoteDate(v: string): string {
  if (!ISO_DATE.test(String(v)) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw new InvalidId('invalid date');
  return `'${v}'`;
}

/** An integer for SQL, or throw. */
export function quoteInt(v: string | number | undefined | null): string {
  const n = Number(v);
  if (v === undefined || v === null || String(v).trim() === '' || !Number.isInteger(n)) throw new InvalidId('invalid number');
  return String(n);
}

const DAY_MS = 86_400_000;
export function addDays(iso: string, days: number): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Today as ISO. The TODAY env var wins (SAMPLE_MODE pins it so cached results stay valid). */
export function today(): string {
  const t = process.env.TODAY;
  return t && ISO_DATE.test(t) ? t : new Date().toISOString().slice(0, 10);
}

type Row = Record<string, string | number | null>;
/** Read a column ignoring case (Zetaris may return headers in a different case). */
export function col(row: Row, name: string): string | number | null | undefined {
  const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? undefined : row[k];
}

export const fmtUsd = (cents: number): string =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Dedupe key used everywhere: merchant + date + amount. */
export const dupKey = (merchant: string, date: string, amountCents: number): string =>
  `${merchant.toLowerCase()}|${date}|${amountCents}`;

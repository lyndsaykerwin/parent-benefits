// Small drawn icons for the scan screens. Decorative: each hides itself from screen readers.
const base = { 'aria-hidden': true as const, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function CameraIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...base} viewBox="0 0 24 24" width={size} height={size}>
      <path d="M4 8h3l1.6-2.4h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.6" />
    </svg>
  );
}

export function ShieldCheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...base} viewBox="0 0 24 24" width={size} height={size}>
      <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function CheckIcon({ size = 18 }: { size?: number }) {
  return <svg {...base} viewBox="0 0 24 24" width={size} height={size}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
}

/** A drawn car seat: the stand-in picture when an item has no thumbnail. */
export function GearIcon({ size = 30 }: { size?: number }) {
  return (
    <svg {...base} viewBox="0 0 24 24" width={size} height={size}>
      <path d="M5 18h14" />
      <path d="M6 18c0-5 2-9 6-9s6 4 6 9" />
      <path d="M10 6.5c.6-1.6 3.4-1.6 4 0" />
    </svg>
  );
}

export function ReceiptIcon({ size = 30 }: { size?: number }) {
  return (
    <svg {...base} viewBox="0 0 24 24" width={size} height={size}>
      <path d="M6 3h12v18l-3-1.8L12 21l-3-1.8L6 21z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

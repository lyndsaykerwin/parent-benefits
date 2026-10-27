import type { ReactNode } from 'react';
import type { LockerReceipt, RecallInfo, ScannedItem } from '@/lib/photoPrep';
import { CheckIcon, GearIcon, ReceiptIcon, ShieldCheckIcon } from './icons';

/** "Oct 25, 2026" from "2026-10-25" (no time zone shifts). */
export function prettyDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return '';
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

const nf = (n: number) => n.toLocaleString('en-US');
const listName = (r: RecallInfo) => (r.source === 'NHTSA' ? 'NHTSA car-seat recalls' : 'CPSC recalls');

/** The recall answer. Never "safe": "No recalls found" only when a real check ran; otherwise a possible match or a plain "not checked". */
export function RecallLine({ recall, compact = false }: { recall: RecallInfo; compact?: boolean }) {
  if (recall.found === true) {
    return (
      <div role="alert" className="rounded-xl border border-[#E7B3A9] bg-[#FBE3E0] px-3 py-2.5 text-[14.5px] text-[#7A1F17]" data-testid="recall-found">
        <p><b>Possible recall.</b> This looks like a product on the {recall.source} list. Check the notice, and stop using it if it is the same product.</p>
        <ul className="mt-1.5 space-y-1.5">
          {(recall.matches ?? []).map((m) => (
            <li key={m.id}>
              <span className="font-semibold">{m.title}</span>{m.recallDate ? ` (${prettyDate(m.recallDate)})` : ''}
              {m.url && <> <a href={m.url} target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-2">Read the notice →</a></>}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (recall.found === null) {
    return (
      <p className="rounded-xl bg-[#F1ECE4] px-3 py-2.5 text-[14px] leading-snug text-ink-2" data-testid="recall-unchecked">
        <b className="text-ink">Not checked for recalls.</b> {recall.note ?? 'The recall list could not be reached.'}
      </p>
    );
  }
  const checked = recall.recordsChecked != null ? `Checked against ${nf(recall.recordsChecked)} ${listName(recall)}.` : `Checked the ${recall.source} recall list.`;
  if (compact) {
    return (
      <p className="flex items-start gap-1.5 text-[13.5px] font-semibold leading-snug text-[#17643F]">
        <span className="mt-0.5 shrink-0"><ShieldCheckIcon size={15} /></span>
        <span><b>No recalls found</b> · {checked.charAt(0).toLowerCase() + checked.slice(1)}</span>
      </p>
    );
  }
  return (
    <p className="flex items-start gap-2 rounded-xl bg-[#E3F3EA] px-3 py-2.5 text-[15px] leading-snug text-[#17643F]">
      <span className="mt-0.5 shrink-0"><ShieldCheckIcon size={16} /></span>
      <span><b>No recalls found</b> as of {prettyDate(recall.checkedOn)}. {checked}</span>
    </p>
  );
}

export const SampleBadge = () => <span className="rounded-full bg-[#FBF0D3] px-2 py-0.5 text-[11.5px] font-extrabold text-[#8A5B00]">Sample</span>;

/** The little picture: the saved thumbnail, or a drawn stand-in. */
export function Thumb({ src, alt, kind }: { src?: string | null; alt: string; kind: 'gear' | 'receipt' }) {
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#FCE9E1] text-coral-deep">
      {src ? <img src={src} alt={alt} className="h-full w-full object-cover" /> : kind === 'gear' ? <GearIcon /> : <ReceiptIcon />}
    </span>
  );
}

export function SampleNote() {
  return (
    <p role="note" className="mb-3 rounded-xl border border-[#EBD9A6] bg-[#FBF0D3] px-3 py-2 text-[13.5px] leading-snug text-[#6B4A00]" data-testid="sample-note">
      <b>Practice mode.</b> There is no photo-reading key here, so this answer is a made-up sample, not read from your photo.
    </p>
  );
}

const joinDot = (parts: ReactNode[]) => parts.filter(Boolean).flatMap((p, i) => (i ? [<span key={`d${i}`} aria-hidden="true"> · </span>, p] : [p]));

/** Result of a gear photo. */
export function GearResult({ item, thumbnail, sample, already }: { item: ScannedItem; thumbnail?: string | null; sample?: boolean; already?: boolean }) {
  const reg = item.recall?.registerUrl;
  return (
    <article aria-label={item.productName} className="rounded-2xl border-2 border-[#1E8A5A] bg-paper p-4" data-testid="gear-result">
      <div className="flex items-start gap-3">
        <Thumb src={thumbnail} alt={`Photo of ${item.productName}`} kind="gear" />
        <div className="min-w-0">
          <h3 className="text-[17px] font-extrabold leading-snug">{item.productName}</h3>
          <p className="mt-0.5 text-[13.5px] text-ink-2">
            {joinDot([
              item.modelNumber ? <span key="m">Model {item.modelNumber}</span> : null,
              item.upc ? <span key="u">UPC {item.upc}</span> : null,
              typeof item.manufacturedOn === 'string' && item.manufacturedOn ? <span key="d">Made {item.manufacturedOn}</span> : null,
              item.lotCode ? <span key="l">Lot {item.lotCode}</span> : null,
            ])}
            {sample && <> <SampleBadge /></>}
          </p>
        </div>
      </div>
      {item.recall && <div className="mt-3"><RecallLine recall={item.recall} /></div>}
      {item.recall && item.recall.found !== null && item.recall.note && <p className="mt-2 text-[14px] leading-snug text-ink-2" data-testid="recall-note">{item.recall.note}</p>}
      {!item.manufacturedOn && item.recall?.found !== true && (
        <p className="mt-2 text-[13.5px] leading-snug text-ink-2" data-testid="no-date-tip">We couldn’t read the date made. Recalls often cover only some dates, so check the sticker for it.</p>
      )}
      {reg && (
        <p className="mt-3 text-[15px]">
          <a href={reg} target="_blank" rel="noopener noreferrer" className="font-bold text-coral-deep underline underline-offset-2">Register it with {item.brand || 'the maker'} →</a>
          <span className="mt-0.5 block text-[13.5px] text-ink-2">This is how you’d hear about a future recall.</span>
        </p>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-[15px] font-bold text-[#17643F]"><CheckIcon size={18} /> {already ? 'Already in your gear locker.' : 'Saved to your gear locker.'}</p>
    </article>
  );
}

/** Result of a receipt photo: one card with every line, its money-back check and its recall check. */
export function ReceiptResult({ items, store, purchasedOn, thumbnail, sample, already }: { items: ScannedItem[]; store?: string | null; purchasedOn?: string | null; thumbnail?: string | null; sample?: boolean; already?: boolean }) {
  const title = `Receipt · ${items.length} ${items.length === 1 ? 'item' : 'items'}`;
  return (
    <article aria-label={title} className="rounded-2xl border-2 border-[#1E8A5A] bg-paper p-4" data-testid="receipt-result">
      <div className="flex items-center gap-3">
        <Thumb src={thumbnail} alt="Photo of your receipt" kind="receipt" />
        <div className="min-w-0">
          <h3 className="text-[17px] font-extrabold leading-snug">{title}</h3>
          <p className="text-[13.5px] text-ink-2">
            {joinDot([store ? <span key="s">{store}</span> : null, purchasedOn ? <span key="d">{prettyDate(purchasedOn)}</span> : null])}
            {sample && <> <SampleBadge /></>}
          </p>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-line border-t border-line">
        {items.map((it, i) => (
          <li key={`${it.productName}-${i}`} className="py-3">
            <p className="text-[16px] font-bold leading-snug">{it.productName}</p>
            {it.fsaEligible !== undefined && (
              <p className={`mt-1.5 inline-block rounded-full px-2.5 py-1 text-[13px] font-bold ${it.fsaEligible ? 'bg-[#E3F3EA] text-[#17643F]' : 'bg-[#FBF0D3] text-[#8A5B00]'}`}>
                {it.fsaEligible ? `${it.fsaAccount === 'HSA' ? 'HSA' : 'FSA'}-eligible: claim it back from your ${it.fsaAccount === 'HSA' ? 'HSA' : 'FSA'}` : 'No money back found'}
              </p>
            )}
            {it.recall && <div className="mt-1.5"><RecallLine recall={it.recall} compact /></div>}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[13.5px] text-ink-2">Only items on the official FSA/HSA list are flagged. Price drops are checked when you run your check again.</p>
      <p className="mt-3 flex items-center gap-1.5 text-[15px] font-bold text-[#17643F]"><CheckIcon size={18} /> {already ? 'Already in your gear locker.' : 'Saved to your gear locker.'}</p>
    </article>
  );
}

/** One receipt row in the locker. */
export function LockerReceiptRow({ r }: { r: LockerReceipt }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <Thumb src={r.thumbnail} alt="Photo of your receipt" kind="receipt" />
      <div className="min-w-0">
        <p className="text-[16px] font-extrabold leading-snug">Receipt · {r.itemCount} {r.itemCount === 1 ? 'item' : 'items'}</p>
        <p className="text-[13.5px] text-ink-2">{joinDot([r.store ? <span key="s">{r.store}</span> : null, r.purchasedOn ? <span key="d">{prettyDate(r.purchasedOn)}</span> : null])}</p>
      </div>
    </li>
  );
}

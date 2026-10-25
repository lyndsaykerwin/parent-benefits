import { useState } from 'react';
import { fmtUsd, safeSources } from '@/lib/bundle';
import type { HomeTotals } from '@/lib/tabs';
import { shareMessage } from '@/lib/tabs';
import { Link } from 'wouter';
import { forgetMyItems } from '@/lib/photoPrep';

/** Small "Share this with a friend" bar. It appears after the first money tick and shares only a link to Bundle. */
export function ShareBar({ claimedCents }: { claimedCents: number }) {
  const [note, setNote] = useState<string | null>(null);
  async function share() {
    // Only the site's own address: no run id, no names, dates, ZIP or amounts.
    const link = window.location.origin;
    const text = shareMessage(link);
    try {
      if (typeof navigator.share === 'function') { await navigator.share({ title: 'Bundle', text, url: link }); return; }
      await navigator.clipboard.writeText(text);
      setNote('Copied. Paste it into a message.');
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setNote('Could not share from here. Copy this link instead: ' + link);
    }
  }
  return (
    <section aria-label="Share" data-testid="share-bar" className="mt-6 rounded-2xl border border-line bg-paper p-4">
      <p className="text-[15px] font-bold leading-snug">Nice, {fmtUsd(claimedCents)} claimed! Know someone who would want this?</p>
      <p className="mt-1 text-[13.5px] text-ink-2">We only share a link, never your list or details.</p>
      <button type="button" onClick={share} className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-ink px-4 text-[15px] font-bold text-cream">Share this with a friend</button>
      {note && <p role="status" className="mt-2 text-[13.5px] font-semibold text-ink-2">{note}</p>}
    </section>
  );
}

/** "Save your list": a labelled demo. Sign-in is not built yet (see the report for the estimate). */
export function SaveListCard() {
  return (
    <section aria-label="Save your list" data-testid="save-card" className="mt-6 rounded-2xl border border-line bg-paper p-4">
      <p className="inline-block rounded-full bg-[#F1ECE4] px-2.5 py-0.5 text-[12px] font-bold text-ink-2">Demo: not built yet</p>
      <h3 className="mt-2 text-[17px] font-extrabold leading-snug">Save your list so you do not lose it</h3>
      <p className="mt-1 text-[15px] leading-relaxed text-ink-2">One tap, no password. Your ticks are kept in this browser for now.</p>
      <button type="button" disabled aria-disabled="true" className="mt-3 flex min-h-[48px] w-full cursor-not-allowed items-center justify-center rounded-xl border-2 border-line px-4 text-[15px] font-bold text-ink-2 opacity-60">Continue with Google (coming later)</button>
      <p className="mt-2 text-[13.5px] text-ink-2">Sign-in is not built yet, so this button does nothing for now.</p>
    </section>
  );
}

/** "Forget my items": deletes the products saved from photos for this family, after a plain-English confirm step. */
export function ForgetItemsCard({ familyId, forget = forgetMyItems }: { familyId: string; forget?: (familyId: string) => Promise<number> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: true; message: string } | { ok: false; message: string } | null>(null);
  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const n = await forget(familyId);
      setResult({ ok: true, message: n === 0 ? 'We did not have any saved items for you, so there was nothing to remove.' : `Done. We removed ${n === 1 ? '1 item' : `${n} items`} from our records.` });
    } catch (e) {
      setResult({ ok: false, message: (e as Error)?.message || 'Could not remove your items. Please try again.' });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }
  return (
    <section aria-label="Forget my items" data-testid="forget-card" className="mt-6 rounded-2xl border border-line bg-paper p-4">
      <h3 className="text-[17px] font-extrabold leading-snug">Your items, your choice</h3>
      <p className="mt-1 text-[15px] leading-relaxed text-ink-2">Photos are never kept, only the product details we read from them. You can delete those any time.</p>
      {!confirming && (
        <button type="button" onClick={() => { setResult(null); setConfirming(true); }} className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 border-ink px-4 text-[15px] font-bold text-ink">Forget my items</button>
      )}
      {confirming && (
        <div role="alertdialog" aria-label="Delete your saved items?" className="mt-3 rounded-xl bg-cream p-3">
          <p className="text-[15px] font-semibold leading-snug">Delete every item we saved from your photos? We will stop checking them for recalls and money back. This cannot be undone.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="min-h-[48px] rounded-xl border-2 border-line bg-paper px-3 text-[15px] font-bold text-ink">Keep my items</button>
            <button type="button" onClick={run} disabled={busy} className="min-h-[48px] rounded-xl bg-ink px-3 text-[15px] font-bold text-cream disabled:opacity-60">{busy ? 'Deleting…' : 'Yes, delete them'}</button>
          </div>
        </div>
      )}
      {result?.ok === true && <p role="status" className="mt-2 text-[13.5px] font-semibold text-ink-2">{result.message}</p>}
      {result?.ok === false && <p role="alert" className="mt-2 rounded-xl bg-[#FBE3E0] px-3 py-2 text-[14px] font-semibold text-[#9E2A21]">{result.message}</p>}
    </section>
  );
}

/** "How we got this number": the cards that add up to the big number, and what is left out of it. Every line comes from the run. */
export function HowWeGotThisNumber({ totals, href }: { totals: HomeTotals; href: (id: string) => string }) {
  const hasTaxCredit = totals.parts.some((c) => /tax_credit/.test(c.id));
  const hasAccount = totals.parts.some((c) => /trump_account/.test(c.id));
  return (
    <details className="mt-3 text-[14px]" data-testid="how-number">
      <summary className="inline-flex min-h-[44px] cursor-pointer items-center font-bold text-coral-deep underline decoration-2 underline-offset-4">How we got this number</summary>
      <div className="mt-1 rounded-2xl border border-line bg-cream p-3">
        {totals.parts.length > 0 ? (
          <ul className="space-y-2">
            {totals.parts.map((c) => {
              const src = safeSources(c.sources)[0];
              return (
                <li key={c.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0">
                    <Link href={href(c.id)} className="font-semibold text-ink underline-offset-2 hover:underline">{c.title}</Link>
                    {src && src.label !== c.title && <> <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-[12.5px] font-semibold text-ink-2 underline-offset-2 hover:underline">{src.label}</a></>}
                  </span>
                  <span className="tabular shrink-0 font-extrabold">{fmtUsd(c.amountCents ?? 0)}</span>
                </li>
              );
            })}
          </ul>
        ) : <p className="text-ink-2">Nothing checked yet.</p>}
        <div className="my-2 border-t border-dashed border-line" />
        <p className="font-semibold text-ink">Total: {fmtUsd(totals.totalCents)}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
          {hasTaxCredit && <li>Tax credits lower your tax bill. You get them when you file your taxes.</li>}
          {hasAccount && <li>The baby’s starter account is a deposit into an account for your baby, not money paid to you.</li>}
          <li>Amounts marked “likely” depend on your own situation, so confirm each one with the program.</li>
          {totals.notCounted.length > 0 && <li>Left out of the total: {totals.notCounted.map((c) => c.title).join('; ')}.</li>}
          <li>Blocked offers and free gifts are never part of this number.</li>
        </ul>
      </div>
    </details>
  );
}

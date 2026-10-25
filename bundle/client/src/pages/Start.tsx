import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import Onboarding from '@/pages/Onboarding';
import { api, FAMILY_ID_KEY, runFromStatus, savedFamilyId, saveRun } from '@/lib/bundle';
import { clearStartOver, peekStartOver } from '@/lib/account';

type Mode = 'opening' | 'questions' | 'trouble';

/**
 * The front door. If this browser already has a saved family (localStorage `bundle_family_id`), open that family's last results
 * straight away. If not, or after "Start over", start the five questions.
 */
export default function Start() {
  const [, navigate] = useLocation();
  const [id] = useState(() => (peekStartOver() ? null : savedFamilyId()));
  useEffect(() => { clearStartOver(); }, []); // "Start over" counts once
  const [mode, setMode] = useState<Mode>(id ? 'opening' : 'questions');
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!id) return;
    let live = true;
    const open = (r: NonNullable<ReturnType<typeof runFromStatus>>) => {
      saveRun(r);
      navigate(`/feed/${encodeURIComponent(r.runId)}`, { replace: true });
    };
    const forgetId = () => { try { localStorage.removeItem(FAMILY_ID_KEY); } catch { /* ignore */ } setMode('questions'); };
    // Every step first checks `live`: this effect can be cancelled while a request is out (and run again), and a cancelled
    // run must never change anything, least of all forget the saved profile.
    (async () => {
      try {
        const r = runFromStatus(await api.latestRun(id));
        if (!live) return;
        if (r) open(r); else setMode('trouble'); // a saved result is always a finished one; anything else is a hiccup, not "no profile"
      } catch (e) {
        if (!live) return;
        if ((e as { status?: number }).status !== 404) return setMode('trouble');
        // The family is saved but has no finished run on the server right now: check them again.
        try {
          const { runId } = await api.startRun({ familyId: id });
          if (live) navigate(`/feed/${encodeURIComponent(runId)}`, { replace: true });
        } catch (e2) {
          if (!live) return;
          if ((e2 as { status?: number }).status === 404) forgetId(); else setMode('trouble');
        }
      }
    })();
    return () => { live = false; };
  }, [id, tries, navigate]);

  if (mode === 'questions') return <Onboarding />;
  return (
    <div className="min-h-[100dvh] bg-cream text-ink">
      <div className="mx-auto w-full max-w-[480px] px-5 pt-5">
        <span className="text-[26px] font-extrabold tracking-[-0.03em]">bundle<span className="text-coral">.</span></span>
        {mode === 'opening' ? (
          <p role="status" className="mt-10 text-[18px] font-bold text-ink-2">Opening your saved plan…</p>
        ) : (
          <>
            <h1 className="mt-10 text-[28px] font-extrabold leading-tight tracking-[-0.02em]">We couldn’t reach Bundle.</h1>
            <p role="alert" className="mt-2 text-[16px] text-ink-2">Your plan is still saved on this device. Check your connection and try again.</p>
            <button type="button" onClick={() => { setMode('opening'); setTries((n) => n + 1); }} className="mt-6 flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-ink text-[17px] font-bold text-cream">Try again</button>
            <button type="button" onClick={() => setMode('questions')} className="mt-2 flex min-h-[48px] w-full items-center justify-center text-[15px] font-bold text-ink-2 underline decoration-line decoration-2 underline-offset-4">Answer the questions again</button>
          </>
        )}
      </div>
    </div>
  );
}

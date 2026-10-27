import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

export const MADE_UP_DETAILS_NOTICE = 'Please use made-up details only — this is a test app.';

type GateState = 'checking' | 'open' | 'locked';

function gateHinted(): boolean {
  try { return /(?:^|;\s*)bundle_gate=on(?:;|$)/.test(document.cookie); } catch { return false; }
}

/**
 * Tester entry screen. Asks the server once whether a tester code is needed (only on the web host, where
 * TESTER_ACCESS_CODE is set). If it is and this phone hasn't typed it yet, shows one field; the server then remembers
 * this phone with a cookie, so every later request just works. On the laptop no code is set and the app opens directly.
 */
export default function TesterGate({ children }: { children: ReactNode }) {
  // The server leaves a "bundle_gate=on" cookie on the page when a code is set. Without it (laptop) the app opens at once.
  const [state, setState] = useState<GateState>(() => (gateHinted() ? 'checking' : 'open'));
  // Tester mode = the site has a code (web host). Then a slim "made-up details" line stays above every screen.
  const [testerMode, setTesterMode] = useState<boolean>(() => gateHinted());

  useEffect(() => {
    let live = true;
    if (typeof fetch !== 'function') { setState('open'); return; }
    fetch('/api/tester-access', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { required?: boolean; ok?: boolean } | null) => {
        if (!live) return;
        setTesterMode(Boolean(s?.required));
        setState(s && s.required && !s.ok ? 'locked' : 'open');
      })
      // Can't reach the server: let the app show its own "couldn't reach Bundle" screens rather than a gate.
      .catch(() => { if (live) setState('open'); });
    return () => { live = false; };
  }, []);

  if (state === 'open') return testerMode ? <><TestNoticeLine />{children}</> : <>{children}</>;
  if (state === 'checking') return <div className="min-h-[100dvh] bg-cream" aria-busy="true" />;
  return <GateScreen onUnlocked={() => setState('open')} />;
}

/**
 * The persistent reminder while testing: one slim line in the normal page flow at the very top (not floating), so it
 * never covers a button and scrolls away with the page.
 */
export function TestNoticeLine() {
  return (
    <p
      role="note"
      data-testid="made-up-line"
      className="w-full bg-coral-tint px-4 py-1.5 text-center text-[12px] font-semibold leading-snug text-ink-2"
    >
      {MADE_UP_DETAILS_NOTICE}
    </p>
  );
}

export function GateScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/tester-access', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (r.ok) return onUnlocked();
      const body = (await r.json().catch(() => ({}))) as { error?: string };
      setError(body.error || 'That code didn’t work. Please try again.');
    } catch {
      setError('We couldn’t reach Bundle. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-cream text-ink">
      <form onSubmit={submit} className="mx-auto w-full max-w-[480px] px-5 pt-5 pb-10" aria-labelledby="gate-title">
        <span className="text-[26px] font-extrabold tracking-[-0.03em]">bundle<span className="text-coral">.</span></span>
        <h1 id="gate-title" className="mt-10 text-[28px] font-extrabold leading-tight tracking-[-0.02em]">Welcome, tester</h1>
        <p className="mt-2 text-[16px] text-ink-2">Bundle is in testing. Enter the tester code you were sent to start.</p>

        <p
          role="note"
          data-testid="made-up-notice"
          className="mt-5 rounded-2xl border-2 border-coral bg-coral-tint px-4 py-3 text-[15px] font-bold leading-snug text-ink"
        >
          {MADE_UP_DETAILS_NOTICE}
        </p>

        <label htmlFor="tester-code" className="mt-6 block text-[15px] font-bold">Enter the tester code you were sent</label>
        <input
          id="tester-code"
          name="tester-code"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="mt-2 block min-h-[56px] w-full rounded-2xl border-2 border-line bg-paper px-4 text-[18px] text-ink outline-none focus:border-ink"
        />
        {error && <p role="alert" className="mt-2 text-[15px] font-bold text-kind-recall">{error}</p>}

        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="mt-5 flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-ink text-[17px] font-bold text-cream disabled:opacity-50"
        >
          {busy ? 'Checking…' : 'Start testing'}
        </button>
        <p className="mt-4 text-[14px] text-ink-3">No code? Ask the person who sent you the link.</p>
      </form>
    </div>
  );
}

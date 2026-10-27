// "Email to myself": the phone's Share sheet on a phone, the computer's email program (a mailto: link) everywhere else.
// Bundle never sends anything itself. It never fails silently: every path ends with a message the screen can show.

export interface SendResult { ok: boolean; message: string | null }

interface Deps {
  nav?: Navigator;
  /** Opens a URL (default: the browser goes to it, which hands a mailto: link to the email program). */
  open?: (url: string) => void;
}

/** "tap" on a touch screen, "click" with a mouse. */
const verb = (nav?: Navigator) => (nav && nav.maxTouchPoints > 0 ? 'tap' : 'click');
export const openingEmail = (nav?: Navigator) => `Opening your email… If nothing opens, ${verb(nav)} Copy and paste it into an email.`;
export const emailFailed = (nav?: Navigator) => `We couldn’t open your email app. ${verb(nav) === 'tap' ? 'Tap' : 'Click'} Copy and paste it into an email instead.`;
export const CHOOSE_WHERE = 'Choose where to send it…';
/** What to say the moment the button is pressed: phones get the Share sheet, computers get their email program. */
export const startNote = (data: { title: string; text: string }, nav: Navigator | undefined = typeof navigator !== 'undefined' ? navigator : undefined) =>
  (isPhoneShare(nav, data) ? CHOOSE_WHERE : 'Opening your email…');

/** A phone: a touch screen with the Share sheet. A Mac's Safari or Chrome also has navigator.share, so touch is what tells them apart. */
export function isPhoneShare(nav: Navigator | undefined, data: { title: string; text: string }): boolean {
  if (!nav || typeof nav.share !== 'function' || !(nav.maxTouchPoints > 0)) return false;
  try { return typeof nav.canShare === 'function' ? nav.canShare(data) : true; } catch { return false; }
}

export const mailtoUrl = (title: string, text: string) => `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`;

export async function sendToSelf(
  data: { title: string; text: string },
  { nav = typeof navigator !== 'undefined' ? navigator : undefined, open = (url) => { window.location.href = url; } }: Deps = {},
): Promise<SendResult> {
  if (isPhoneShare(nav, data)) {
    try {
      await nav!.share(data);
      return { ok: true, message: null };
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return { ok: true, message: null }; // the parent closed the Share sheet
      // Sharing is blocked here (for example inside an embedded browser): fall through to email.
    }
  }
  try {
    open(mailtoUrl(data.title, data.text));
    return { ok: true, message: openingEmail(nav) };
  } catch {
    return { ok: false, message: emailFailed(nav) };
  }
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { doneNotice, pollPhoto, type PhotoStatusView } from './photoJob';

/** A "your photo is read" note shown once a background read finishes. */
export interface PhotoNotice { photoId: number; text: string; ok: boolean }

/** What the scan entry points (Home card, header Scan button, Savings card, empty locker, Home's "Add a receipt") share. */
export interface ScanApi {
  /** Opens the "What are you scanning?" sheet. */
  openScan: () => void;
  closeScan: () => void;
  sheetOpen: boolean;
  /** Opens the Gear Locker page. */
  openLocker: () => void;
  closeLocker: () => void;
  lockerOpen: boolean;
  /** Goes up by one every time something is saved or forgotten, so the locker reloads. */
  version: number;
  bump: () => void;
  /** Background reading: keep checking this photo until it is read, then show a notice and reload the locker. */
  track: (familyId: string, photoId: number) => void;
  /** The latest known state of a tracked photo. */
  photos: Record<number, PhotoStatusView>;
  /** Finished reads the parent has not looked at yet (badge + note). */
  notices: PhotoNotice[];
  clearNotices: () => void;
}

const NONE: ScanApi = {
  openScan: () => {}, closeScan: () => {}, sheetOpen: false, openLocker: () => {}, closeLocker: () => {}, lockerOpen: false, version: 0, bump: () => {},
  track: () => {}, photos: {}, notices: [], clearNotices: () => {},
};
const Ctx = createContext<ScanApi>(NONE);

export const useScan = (): ScanApi => useContext(Ctx);

/** Owns the open/closed state of the scan sheet and the locker page. VersionB mounts the sheet and the locker page itself. */
export function ScanProvider({ children, pollMs = 3000 }: { children: ReactNode; pollMs?: number }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lockerOpen, setLockerOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const [photos, setPhotos] = useState<Record<number, PhotoStatusView>>({});
  const [notices, setNotices] = useState<PhotoNotice[]>([]);
  const stops = useRef(new Map<number, () => void>());
  useEffect(() => () => { stops.current.forEach((s) => s()); stops.current.clear(); }, []);

  const openScan = useCallback(() => setSheetOpen(true), []);
  const closeScan = useCallback(() => setSheetOpen(false), []);
  const openLocker = useCallback(() => { setSheetOpen(false); setLockerOpen(true); setNotices([]); window.scrollTo?.({ top: 0 }); }, []);
  const closeLocker = useCallback(() => setLockerOpen(false), []);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const clearNotices = useCallback(() => setNotices([]), []);
  const track = useCallback((familyId: string, photoId: number) => {
    if (stops.current.has(photoId)) return;
    const stop = pollPhoto(familyId, photoId, {
      onUpdate: (v) => setPhotos((p) => ({ ...p, [photoId]: v })),
      onDone: (v) => {
        stops.current.delete(photoId);
        setNotices((n) => [...n.filter((x) => x.photoId !== photoId), { photoId, text: doneNotice(v), ok: v.status === 'done' }]);
        setVersion((x) => x + 1);
      },
      onGone: () => { stops.current.delete(photoId); },
    }, pollMs);
    stops.current.set(photoId, stop);
  }, [pollMs]);

  const value = useMemo(
    () => ({ openScan, closeScan, sheetOpen, openLocker, closeLocker, lockerOpen, version, bump, track, photos, notices, clearNotices }),
    [openScan, closeScan, sheetOpen, openLocker, closeLocker, lockerOpen, version, bump, track, photos, notices, clearNotices],
  );
  const latest = notices[notices.length - 1];
  return (
    <Ctx.Provider value={value}>
      {children}
      {latest && !sheetOpen && !lockerOpen && (
        <div role="status" aria-live="polite" data-testid="photo-notice"
          className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[calc(100%-32px)] max-w-[448px] items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-cream shadow-2xl">
          <p className="grow text-[15px] font-semibold leading-snug">{latest.text}</p>
          <button type="button" onClick={openLocker} className="min-h-[44px] shrink-0 rounded-xl bg-coral px-3 text-[14px] font-bold text-cream">Open</button>
          <button type="button" onClick={clearNotices} aria-label="Dismiss" className="min-h-[44px] shrink-0 px-1 text-[20px] leading-none">×</button>
        </div>
      )}
    </Ctx.Provider>
  );
}

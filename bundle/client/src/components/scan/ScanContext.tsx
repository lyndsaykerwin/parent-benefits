import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

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
}

const NONE: ScanApi = { openScan: () => {}, closeScan: () => {}, sheetOpen: false, openLocker: () => {}, closeLocker: () => {}, lockerOpen: false, version: 0, bump: () => {} };
const Ctx = createContext<ScanApi>(NONE);

export const useScan = (): ScanApi => useContext(Ctx);

/** Owns the open/closed state of the scan sheet and the locker page. VersionB mounts the sheet and the locker page itself. */
export function ScanProvider({ children }: { children: ReactNode }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lockerOpen, setLockerOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const openScan = useCallback(() => setSheetOpen(true), []);
  const closeScan = useCallback(() => setSheetOpen(false), []);
  const openLocker = useCallback(() => { setSheetOpen(false); setLockerOpen(true); window.scrollTo?.({ top: 0 }); }, []);
  const closeLocker = useCallback(() => setLockerOpen(false), []);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const value = useMemo(
    () => ({ openScan, closeScan, sheetOpen, openLocker, closeLocker, lockerOpen, version, bump }),
    [openScan, closeScan, sheetOpen, openLocker, closeLocker, lockerOpen, version, bump],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

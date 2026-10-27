// Shared set-up for the V2 acceptance tests. Not a test file itself (no ".test" in the name).
// Everything here uses the fictional sample family Maya (born 2026-10-03, ZIP 02139, demo date 2026-10-23 = 20 days old).
import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { Router, Route } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import VersionB from '@/pages/tabs/VersionB';
import Feed from '@/pages/Feed';
import { sampleRun } from '@/test-support/sampleRuns';
import type { SavedRun } from '@/lib/bundle';

/** The onboarding answer codes the tests expect the app to send and keep.
 *  Q4 part 1 ("Who's raising this baby?") -> household; part 2 (one row per parent) -> parent1Work / parent2Work. Q5 -> insurance. */
export const HOUSEHOLD = { one: 'one', two: 'two' } as const;
export const WORK = { paycheck: 'paycheck', selfEmployed: 'self_employed', notWorking: 'not_working' } as const;
export const INSURANCE = { job: 'job', marketplace: 'marketplace', medicaid: 'medicaid', tricare: 'tricare', skip: 'none_or_not_sure' } as const;

/** Maya's finished sample run, with the new answers on the family (Q4 = two of us, both paid by a job; Q5 = through a job). */
export function mayaRun(over: { familyId?: string; family?: Record<string, unknown> } = {}): SavedRun {
  const run = sampleRun('maya');
  return {
    ...run,
    familyId: over.familyId ?? run.familyId,
    family: { ...run.family!, zip: '02139', household: HOUSEHOLD.two, parent1Work: WORK.paycheck, parent2Work: WORK.paycheck, insurance: INSURANCE.job, ...(over.family ?? {}) } as SavedRun['family'],
  };
}

export function leoRun(family: Record<string, unknown> = {}): SavedRun {
  const run = sampleRun('leo');
  return { ...run, family: { ...run.family!, zip: '02446', household: HOUSEHOLD.two, parent1Work: WORK.paycheck, parent2Work: WORK.paycheck, insurance: INSURANCE.job, ...family } as SavedRun['family'] };
}

export function showVersionB(run: SavedRun) {
  window.scrollTo = jest.fn() as unknown as typeof window.scrollTo;
  const loc = memoryLocation({ path: `/feed/${run.runId}`, record: true });
  render(<Router hook={loc.hook}><VersionB run={run} owner={false} /></Router>);
  return loc;
}

/** A tab in the bottom bar, by its visible name. */
export const tab = (name: string) =>
  within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: new RegExp(`^${name}`) });

export const goTab = (name: string) => fireEvent.click(tab(name));

/** The account button in the header, left of Scan (Oct 26: one tap opens Account, no dropdown). */
export const chipButton = () => screen.getByRole('button', { name: /^Your account/ });

/** Opens the Account screen the way a parent does: one tap on the account button. */
export function openAccount() {
  fireEvent.click(chipButton());
}

export type FakeRoute = [RegExp, (init: RequestInit | undefined, url: string) => unknown];

/** Fake server: answers each request whose URL matches a pattern; anything else gets a 404. Returns the jest mock. */
export function fakeServer(routes: FakeRoute[]) {
  const mock = jest.fn(async (url: string, init?: RequestInit) => {
    const hit = routes.find(([re]) => re.test(String(url)));
    if (!hit) return { ok: false, status: 404, json: async () => ({ error: 'not found' }) };
    const body = hit[1](init, String(url));
    return { ok: true, status: 200, json: async () => body };
  });
  (global as any).fetch = mock;
  return mock;
}

/** Calls the fake server received for a URL pattern, with parsed JSON bodies. */
export const callsTo = (mock: jest.Mock, re: RegExp) =>
  mock.mock.calls
    .filter(([u]) => re.test(String(u)))
    .map(([u, init]) => ({ url: String(u), method: (init as RequestInit | undefined)?.method ?? 'GET', body: (init as RequestInit | undefined)?.body ? JSON.parse(String((init as RequestInit).body)) : undefined }));

/** Dollars shown in an element, e.g. "$3,688.99 still to claim" -> 3688.99. */
export const dollars = (el: HTMLElement) => Number((el.textContent!.match(/\$([\d,]+(?:\.\d\d)?)/) ?? ['', 'NaN'])[1].replace(/,/g, ''));

/** A card's one-tap control by name, whether the app draws it as a button or a checkbox. */
export function control(card: HTMLElement, name: RegExp): HTMLElement {
  const c = within(card).queryByRole('button', { name }) ?? within(card).queryByRole('checkbox', { name });
  if (!c) throw new Error(`No "${name}" button inside the card "${card.getAttribute('aria-label')}"`);
  return c;
}

/** A stand-in for the browser's live-update connection (EventSource), so a test can send the run's progress messages. */
export class FakeES {
  static last: FakeES | null = null;
  listeners: Record<string, ((e: { data: string }) => void)[]> = {};
  onerror: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  closed = false;
  constructor(public url: string) { FakeES.last = this; }
  addEventListener(t: string, fn: (e: { data: string }) => void) { (this.listeners[t] ||= []).push(fn); }
  close() { this.closed = true; }
  emit(type: string, payload: unknown) { for (const fn of this.listeners[type] ?? []) fn({ data: JSON.stringify(payload) }); }
}

/** Opens the "We're checking for you" screen for a run; the fake server answers the run's status with `status`. */
export function mountFeed(runId: string, status: Record<string, unknown>, extra: FakeRoute[] = []) {
  (global as any).EventSource = FakeES;
  FakeES.last = null;
  window.scrollTo = jest.fn() as unknown as typeof window.scrollTo;
  const server = fakeServer([
    [/\/agent-log|\/trace/, () => []],
    [new RegExp(`/api/runs/${runId}$`), () => status],
    ...extra,
  ]);
  const { hook } = memoryLocation({ path: `/feed/${runId}` });
  render(<Router hook={hook}><Route path="/feed/:runId" component={Feed} /></Router>);
  return server;
}

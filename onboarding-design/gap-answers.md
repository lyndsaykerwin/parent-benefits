# Answers to the 4 onboarding gaps (Oct 24, 2026)

## Lyndsay's decisions (Oct 24): these override the recommendations below
1. **States:** federal benefits and deals for everyone, plus "Support for your state's programs is coming soon." Every real US ZIP is accepted (full ZIP table). Massachusetts programs, already built and sourced, still show for MA families.
2. **Work question: dropped.** Onboarding is now 3 questions: stage, exact date, ZIP. The Dependent Care FSA becomes a gentle "Check with your job" card for every family (no dollar amount, not in the total, never "your employer offers"). The employer-name box is removed. Massachusetts paid leave stays, since it's a state program.
3. **Accounts:** Better Auth on our Neon database, Google only. Save progress in the browser first, then "Save your list" moves it into the account. Apple is skipped.
4. **Navigation:** bottom tabs, keeping the 5 in the mock (Home, Taxes, Savings, Insurance, Deals) unchanged for now. Lyndsay will revisit them later.

Research only, no code changed. Each answer is judged against the principles in `onboarding-design/README.md`: trust, never a dead end, value before any ask, careful tone, never fake. Code claims were spot-checked by the coordinator.

**Total effort if all four are built: about 12–16 hours.** The order to build in is at the bottom.

---

## 1. Parents outside the states we cover

**Today:**
- Only six states are recognized: MA, OH, NY, CA, TX and NH (`bundle/server/sampleZips.ts:7-12`). Even those are incomplete. Buffalo (142xx), San Francisco (941xx), MA 055 and TX 885 are all rejected.
- Any other ZIP gets "Enter a valid US ZIP code" (`server/routes/bundleRoutes.ts:82-83`). That's a dead end for a real parent.
- Families in a recognized state other than Massachusetts quietly lose the Massachusetts programs (`server/agents/benefits.ts:84`). Nothing tells them.

**Recommendation:**
- **Accept every real US ZIP.** Replace the six hand-typed ranges with the full US Postal Service table of 3-digit ZIP starts (about 60 ranges covering all states, DC and territories). Source: USPS "3-digit ZIP Code Prefix Matrix", DMM Appendix L002 (https://pe.usps.com, archived copy at https://pe.usps.com/archive/html/dmmarchive20110102/L002.htm). Check it against the current manual. An unused prefix gets a gentle "Double-check your ZIP," never a rejection.
- **Show full federal results and deals for every state, plus an honest note:** "We check federal programs and deals for every state. We don't cover Florida's own programs yet, so your total may be missing some state money." It links to that state's official benefits page.
- **Totals say "federal"** when state programs aren't covered, so we never imply the list is complete.
- **"Tell me when you cover [State]"** stays a demo button for the hackathon, because collecting real emails would break the fake-data rule.
- **Next state to add: New York.**
  - The Empire State Child Credit is up to $1,000 per child under 4, and middle-class families qualify. It starts shrinking above $110k income for married couples. https://www.tax.ny.gov/pit/credits/empire_state_child_credit.htm
  - New York also has paid family leave.
  - California's paid family leave is the next best. Its child tax credit is for low-income families only.

**Effort:** about 3–4 hours (ZIP table 1–1.5 h, note and labels about 2 h), plus about 1–2 hours per new state.

---

## 2. The work-benefits answer isn't connected

**Today:**
- Every typed-in family is set to "employer offers a Dependent Care FSA" (`server/routes/bundleRoutes.ts:97`, `dcfsaOffered: true`).
- So every guest sees a card that says "**Your employer offers** a Dependent Care FSA…" (`server/agents/benefits.ts:63`). That's a claim we don't know is true, which hurts trust.
- The card has no dollar amount and isn't counted in the big total (`orchestrator.ts:122-125`). So the problem is the wording, not an inflated number.
- The employer-name box is stored but never used.

**Recommendation:** change the field from yes/no to **yes / no / unknown**.

| Parent's answer | What they see |
|---|---|
| **Yes** | Dependent Care FSA card, reworded to "Likely available through work" ("Many employers offer…", not "Your employer offers…") |
| **Not sure / Skip** | The same card, labeled "Check with your job". No dollar amount, not in the total |
| **No** | Card hidden |
| **Any answer** | Paid Family and Medical Leave is still shown, because it's a **state program, not a job perk**. Most people with wages in Massachusetts are covered, including part-time workers, and they pay in through their paychecks (https://www.mass.gov/doc/pfml-information-for-employees-overview/download). Keep the wording "if you've worked in Massachusetts." |

- **Drop the employer-name box.** Nothing uses it, and it's personal data we don't need.
- **Files to change:** the `Family` type (`shared/schema.ts`), `resolveFamily` (`bundleRoutes.ts`), `benefits.ts`, `factChecker.ts:168` (fail only on "no"), `clawback.ts:129,147`, `fallback.ts:33`, `Onboarding.tsx`, `client/src/lib/bundle.ts`, plus three test files. No database change is needed, because typed-in families aren't saved.
- **To verify before quoting:**
  - the $7,500 yearly Dependent Care FSA limit in `factChecker.ts:26`, against IRS guidance for 2026
  - the earnings needed to qualify for Massachusetts paid leave (sources disagree: $6,300 vs $6,000; check mass.gov)

**Effort:** about 3–5 hours including tests.

---

## 3. Checklist progress disappears on refresh → accounts

**Your instinct was right that accounts can be simple.** Of the GenAI.works list (`genai-works-5-github-repos.pdf`), Appwrite, Supabase and PocketBase all include sign-in. But each would add a **second backend** (a separate server and database) three days before the deadline. Supabase also contradicts the "Neon, not Supabase" decision, and its free projects pause after 7 days without use, which is risky while judges are reviewing. The simplest fit is one of these two:

| | Setup | New service? | Google | Apple | Cost |
|---|---|---|---|---|---|
| **Better Auth** (free, open-source sign-in library) **on our existing Neon database** | 4–6 h | **None.** Runs inside our server, stores users in our Neon database | Yes (our own Google sign-in setup, about 30 min) | Yes, later | Free |
| **Neon Auth** (Neon's built-in sign-in, which is built on Better Auth) | 4–6 h | A small Neon-run service | Yes | **No Apple** | Free up to 60,000 users a month |

**Recommendation, in two steps:**
1. **Save progress in the browser first (must-do, 1–2 h).** Ticks and "$ claimed" are kept in the browser, tied to that run. Refreshing no longer wipes anything, and the list still works with no account.
2. **"Save your list" with real Google sign-in (4–6 h), using Better Auth on Neon.** When the parent signs in, the progress already saved in their browser moves into their account, so nothing is lost. This fits the principles: the account comes after the payoff, takes one tap, needs no password, and is optional.

**Things to know:**
- **This changes an earlier decision.** The spec says sign-in stays a labeled demo because of the fake-data rule. Real Google sign-in means real names and emails. For the demo, use a made-up Google account you create just for Bundle. (Agents aren't allowed to create accounts, so you'd make it.)
- **Skip Apple for the hackathon.** It needs the paid Apple Developer Program ($99 a year, https://developer.apple.com/programs/whats-included/) and a real web address. It doesn't work while testing on your own computer.
- **Letting judges sign in with their own Google accounts:** Google's "Testing" mode only allows accounts you add to a list (https://support.google.com/cloud/answer/15549945). Switching to "In production" lets anyone sign in. Asking only for name and email needs no Google review.
- **Two technical catches:**
  - The sign-in handler must be connected before the server's request-reading and input-cleaning steps (`server/index.ts:49-50`), or sign-in breaks.
  - The `FRONTEND_URL` setting must match the live site address.
- **If time runs short,** ship step 1 alone and keep sign-in as a labeled demo.
- **Long term:** stay on Better Auth and add Apple once there's a paid membership and a custom web address.

Sources: Better Auth with Express https://better-auth.com/docs/integrations/express · Better Auth Google https://better-auth.com/docs/authentication/google · Neon Auth https://neon.com/docs/auth/overview

---

## 4. Single list or tabs after onboarding

**Recommendation: the hybrid, built as one app.**
- **Right after onboarding,** the long list opens as the **first view of the Home tab**. The bottom bar is already showing, with Home highlighted and a "2" badge on Insurance.
- **On return visits,** Home shows a summary (big total, "Do these first", category tiles), with a "See full list" link.
- **Why:** in a 3-minute demo video, one unbroken scroll from the questions to "$3,640" to "Do these first" is the clearest wow. The visible bar quietly says "this is a real app." Usability research shows menus left visible on screen get used about twice as often as hidden ones (Nielsen Norman Group, https://www.nngroup.com/articles/hamburger-menus/). Money apps use the same pattern of a big number on Home with details in tabs (NerdWallet's 2025 redesign: https://www.nerdwallet.com/p/native-app-redesign).
- **Go from 5 tabs to 4: Home · Money · Insurance · Offers.**
  - Savings is mostly locked until purchases are uploaded, which makes it an "empty tab." Merge it: the $1,000 baby account moves into **Money** (Taxes renamed), and money back on purchases moves into **Offers**.
  - Rename Deals to **Offers**, since free gifts aren't really deals.
  - If you'd rather keep 5 tabs, Savings must never look empty: show the $1,000 account, one example, and a single "Upload Amazon orders" button.

**Effort:** comes with the onboarding build. Updating the mocks is about 1 hour.

---

## Suggested build order
1. **Browser-saved progress** (1–2 h). Cheapest, and the only gap that loses parents' work.
2. **Work-benefits wiring and the honest card wording** (3–5 h). Fixes a statement that isn't true today.
3. **Full ZIP table plus the "not covered yet" note** (3–4 h). Removes the dead end.
4. **Google sign-in with Better Auth** (4–6 h), if you approve real sign-in.
5. **New York rules** (1–2 h), if time allows.

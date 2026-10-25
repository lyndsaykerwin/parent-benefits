# Bundle v2: real saved accounts — research and plan

Written Oct 25, 2026. Deadline Oct 27, 23:45 UTC. All web sources checked today (see the end).

**One-paragraph answer.** Turning sign-in back on is a medium-sized job (about 9–13 hours of agent build time plus about 30 minutes of clicking for Lyndsay). The Firebase project `parent-benefits` already exists and its keys are already in `.secrets/`. The server half of the old template (the "check the visitor's sign-in pass" code) can be copied almost word for word. The screens need rewriting, because the old ones were desktop password forms. Two gotchas decide the design. First, **Firebase's free plan sends only 5 "email me a link" emails a day**, so the Google button must be the main path, or Lyndsay adds a card to the project (it still costs $0 at our size). Second, **Firebase photo storage needs the paid plan**, so photos go into the existing Neon database instead. Judges keep working with no keys through a clearly labelled "Demo sign-in".

Words used below:
- **Firebase Auth**: Google's ready-made sign-in service.
- **ID token**: a short-lived signed pass the browser gets after sign-in and shows the server with each request.
- **Middleware**: a checkpoint the server runs before a request reaches its handler.
- **Migration**: a script that adds tables or columns to the database.
- **Base64**: a way of writing a photo out as plain text so it fits in a database column.

---

## 1. What the template's Firebase-era commit (a9542c2) had

I cloned it to `/private/tmp/claude-501/-Users-lyndsay-Documents-hackathon/8b2a6f9f-e0a0-4370-8f2a-d2a10de182af/scratchpad/template` and checked out `a9542c2`. It is dated Jan 4, 2026, with the message "Transitioned from Plan to Build mode".

**Browser side (client)**
| File | Lines | What it does | Reuse for Bundle? |
|---|---|---|---|
| `client/src/lib/firebase.ts` | 137 | Starts Firebase from the 5 `VITE_FIREBASE_*` settings. Has Google popup sign-in, GitHub sign-in, email+**password** sign-up/sign-in, password reset and password change. | **Keep** the setup lines (1–35) and `signInWithGoogle` with its friendly "popup was blocked/cancelled" messages. **Drop** all password and GitHub code. **Add** the email-link functions (they are new). |
| `client/src/lib/auth.ts` | 141 | A React "AuthProvider" that remembers who is signed in, calls `POST /api/login` to make sure the person has a row in the database, and offers `getToken()`. It also sends the person's email to PostHog (an analytics service). | **Keep** the pattern. **Remove PostHog**, because it would send parents' emails to a third party. |
| `client/src/hooks/useAuth.ts`, `useUser.ts` | 20 + | Small helpers for screens. | Copy. |
| `client/src/pages/login.tsx` | 249 | A desktop login card: email + password boxes, Google and GitHub buttons, a "forgot password" box. | **Rewrite.** It is the wrong design (passwords, a separate page, desktop layout). |
| `client/src/components/UserProfileForm.tsx` | — | Name and address form. | Not needed. |

**Server side**
| File | Lines | What it does | Reuse? |
|---|---|---|---|
| `server/middleware/auth.ts` | 167 | Starts Firebase Admin (Google's server toolkit) from the env setting `FIREBASE_SERVICE_ACCOUNT_KEY` (the key file pasted as text). `verifyFirebaseToken` reads `Authorization: Bearer <ID token>`, checks it with `getAuth().verifyIdToken()`, and puts `{uid, email}` on the request. Also has `requireAuth` and `optionalAuth`. | **Copy almost as-is.** Changes: point it at the existing key file `.secrets/firebase-admin-key.json` (which is what `GOOGLE_APPLICATION_CREDENTIALS` already holds), drop the `logSecurity` import or replace it with a console line, and add the demo-sign-in branch (§3). `optionalAuth` is exactly what guest + signed-in needs. |
| `server/middleware/authHelpers.ts` | 197 | "Is this your own data?" checks. | Borrow the idea and write 2–3 small Bundle-specific checks. |
| `server/routes/userRoutes.ts` | 319 | `/api/login` (create or update the user row), profile, and deleting the account (also cleans up Stripe). | Copy `/api/login` and the delete pattern. Leave out Stripe. |
| `server/storage/UserStorage.ts` | 45 | Database read/write for users. | Copy and adapt. |
| `server/lib/firebaseStorage.ts` | 155 | Uploads files to Firebase Storage. | **Don't use** (needs the paid plan; see §2e). |
| `server/lib/sendgrid.ts` | 56 | SendGrid email (an email-sending service). | **Not needed.** Firebase sends the sign-in emails itself. |
| `server/__tests__/auth-*.test.ts` | 4 files | Tests for the middleware. | Adapt `auth-middleware.test.ts`. |

**Users table in the template** (`shared/schema.ts:14`): `firebase_id` is the main key (the record's unique ID), plus `email`, name/address fields, `is_premium`, `subscription_type`, `email_notifications` and `stripe_customer_id`. Other tables point at it through `user_id → users.firebase_id`.

**Libraries:** the template used `firebase` ^11.3.1 and `firebase-admin` ^13.4.0. Today's versions on npm (the public library store) are **firebase 13.1.0** and **firebase-admin 14.5.0**, so use those. Bundle has neither installed today.

**How much can be copied back:** about **60% of the server code** (middleware and login/delete routes) and **about 25% of the browser code** (Firebase setup, the Google popup, the auth-provider pattern). The sign-in screens, the email-link flow and guest-to-account merging are new work.

**Already set up (key NAMES only, values not read or printed):**
- `.secrets/bundle.env.local` has `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `FIREBASE_STORAGE_BUCKET`, `GOOGLE_APPLICATION_CREDENTIALS` and `DATABASE_URL`.
- `.secrets/firebase-admin-key.json` is the server key file. It has the normal fields: `type`, `project_id`, `private_key_id`, `private_key`, `client_email` and so on.
- **There is no SendGrid key**, and none is needed.
- `setup/accounts-and-keys.md:9` names the Firebase project `parent-benefits` and lists a still-open check: "Check Email/Password and Google sign-in are switched on". It also notes Storage was deliberately left **off** because it needs the paid plan.

**Where Bundle stands today:**
- `bundle/shared/schema.ts:10` has a bare `users` table (`id`, `display_name`, `created_at`).
- `families` already has `user_id` and `is_guest` columns, but nothing fills them.
- Guest families live only in the server's memory (`server/routes/bundleRoutes.ts:190-196`).
- Ticked tasks ("claims") are saved only in the browser (`client/src/lib/tabs.ts:128-135`).
- Photos are read and then thrown away (`server/routes/photoRoutes.ts:1`).
- `purchase_items` is already saved per `family_id`.
- The placeholder "Continue with Google (coming later)" card is `SaveListCard` in `client/src/pages/tabs/Extras.tsx`.

---

## 2. Simplest plan: "account after payoff, one tap"

The rule: never ask for sign-in up front. Show the parent their money first, then offer "Save this".

### 2a. Screens (3 small additions, no new page)
1. **Save card** (replace the `SaveListCard` placeholder, and show it on the results page after the first real money total):
   - Heading: "Save your $X list".
   - Big button **"Continue with Google"**.
   - Under it, a link-style button **"Email me a sign-in link"**. Tapping it opens one email box plus a "Send link" button.
   - Small print: "No password. Your family's details stay private to your account."
2. **"Check your email" state** on that same card: "We sent a link to ___. Open it on this phone." Below it sits the Demo sign-in button (§3), only when real keys are missing.
3. **Return-from-link screen** (`/signin-finish`, a tiny route):
   - It calls `isSignInWithEmailLink` and then `signInWithEmailLink`.
   - If the link was opened on a different device, it asks for the email once more. Firebase requires this.
   - Then it shows "Saving your list…" and sends the person back to their feed.
4. **Account line on Home** (no new tab needed): "Signed in as a…@gmail.com · Sign out · **Forget everything**".

### 2b. Database changes (one migration)
- `users`: add `firebase_uid` (unique), `email`, `auth_provider` (google / email_link / demo) and `deleted_at`. Keep `id` as Bundle's own ID.
- `families`: **already has** `user_id` and `is_guest`. Start actually writing guest families to this table (with `is_guest=true`), so there is something to move over.
- `purchase_items`: already tied to `family_id`, so it reaches the user through the family. No change.
- **New `claims` table**: `id`, `family_id`, `card_id`, `status` (claimed/done), `created_at`, plus a "unique per family + card" rule. This replaces the browser-only ticks.
- **New `item_photos` table**: `id`, `family_id`, `purchase_item_id` (optional), `mime`, `data` (the photo as base64 text), `bytes`, `created_at`.
- `run_results`: add `family_id` (or `user_id`), so a signed-in parent's last list can be found again.

### 2c. What moves from guest to account at sign-in
The browser sends `POST /api/account/claim-guest` with its sign-in pass and the guest family ID. Then, in one go, the server:
- sets that guest family's `user_id` to the new user and `is_guest=false`;
- copies the browser's saved ticks into `claims`;
- links the latest `run_results` to the family.

`purchase_items` and `item_photos` follow automatically, because they hang off `family_id`. If the user already has a family (a second sign-in), keep the existing family, fold in any new purchase items and ticks, and drop the duplicate guest copy. **Not moved:** sample families (`maya` etc.) are read-only and are never attached to a real account.

### 2d. Who can see what
- Every route that reads a family uses `optionalAuth`.
- If the family has a `user_id`, the request must come from that same user, or the server answers 404 ("not found").
- Guest families stay readable only by the browser that made them (it knows the random `guest-<hex>` ID), same as today.

### 2e. Photos: Neon (base64) wins
- **Firebase Storage would need the Blaze plan.** Since Oct 30, 2024, a new storage bucket needs Blaze, and since Oct 1, 2025, Spark-plan (free plan) projects lost access to Storage altogether. **Blaze** is Firebase's pay-as-you-go plan: it needs a card on file, though small use is still free. Using Storage would also mean writing security rules (who may read each file) and a second upload path.
- **Postgres is already there.** Photos already arrive as base64 in a JSON body (`photoRoutes.ts`). Shrink each one in the browser to about 1000px wide, roughly 150 KB, then save that same text in `item_photos`. That is one insert and one table.
- **Space is fine for a demo.** Neon's free plan gives about 0.5 GB, which is roughly 3,000 shrunk photos. Fine through judging.
- **Privacy:** only save a photo for **signed-in** parents. Keep "read in memory and never saved" for guests, and say so on screen.

### 2f. "Forget everything"
`DELETE /api/account` (signed-in only), after a plain-English confirmation ("This deletes your family, items, photos and ticks. It can't be undone."). In one go, the server:
- deletes `item_photos`, `purchase_items`, `claims`, `feedback` and `run_results` for the user's families;
- deletes the families and then the user row;
- calls Firebase Admin `deleteUser(uid)`, so the sign-in record disappears too;
- signs the browser out.

Agent memory (Meterless) is **not** per-user today (`v2-code-map.md` §7), so there is nothing personal to delete there. Say that in the write-up. The existing `ForgetItemsCard` becomes the lighter "forget just my items" option.

---

## 3. What Lyndsay must do herself (about 30 minutes)

All of this happens at console.firebase.google.com → project **parent-benefits**. "Console" means Firebase's website control panel.

1. **Switch on Google sign-in.** Go to Authentication → Sign-in method → Google → turn it on, choose a support email, then Save. (This was still unchecked in `setup/accounts-and-keys.md`.)
2. **Switch on email links.** On the same page: Email/Password → turn it on → also turn on "Email link (passwordless sign-in)" → Save. Firebase needs both switches for email links. No passwords will ever be shown to parents.
3. **Tell Firebase which websites are allowed.** Go to Authentication → Settings → Authorized domains → add `localhost` (Firebase projects made after Apr 28, 2025 don't include it automatically) and the live web address, for example `bundle-xxxx.onrender.com` (Render is where the app is hosted).
4. **Decide about the 5-a-day email limit.** On the free plan Firebase sends only **5 sign-in link emails a day** for the whole app. Two choices:
   - (a) Leave it. Google sign-in has no such cap, and the 5 links are enough for her own testing.
   - (b) Upgrade to Blaze: Settings → Usage and billing → add a card, and **set a $5 budget alert**. The cap then rises to 25,000 a day and our usage stays free.

   Recommendation: (a) for safety, and (b) only if she wants judges to try email links live.
5. **Check the keys are where the app reads them.** All 5 `VITE_FIREBASE_*` lines are already in `.secrets/bundle.env.local`, and the server key file is there too. No pasting is needed unless a value was regenerated. If it was: Project settings → General → Your apps → Web app → copy the config values into those same 5 lines. Never paste them into chat.
6. **Add the same settings to the live site.** In Render's dashboard → bundle → Environment, add the 5 `VITE_FIREBASE_*` values and the server key (as `FIREBASE_SERVICE_ACCOUNT_KEY`, the file's contents pasted as one value). The agent can't do this for her, because Render needs her login.

**What still works with no keys (`SAMPLE_MODE=true`, which is how judges run it)**
- With no Firebase settings present, the save card swaps its buttons for one clearly labelled **"Demo sign-in (no real account — sample mode)"** button. It has a grey "Demo" badge and the line "This pretends you signed in so you can see saving work. Nothing leaves this computer."
- How it works: the server creates a `users` row with `auth_provider='demo'` and a fixed fake email `demo-parent@example.test`. The browser gets a demo pass, which the server accepts **only when** `SAMPLE_MODE=true` or no Firebase key is set. The server must refuse it in production when keys exist (and a test should prove that).
- Saving, ticks, photos and "Forget everything" all work the same way on the demo account. Where there's no database, they use the existing in-memory store (`server/bundleStore.ts` already has a memory version and a database version).
- This keeps the hackathon rule "runs with no manual steps" and never pretends to be Google.

---

## 4. Effort and risks

**Estimate: 9–13 hours of build time** (agent-built, with tests), plus about 30 minutes for Lyndsay.
| Piece | Hours |
|---|---|
| Install firebase 13 / firebase-admin 14; copy and adapt the middleware; `/api/login`; demo-pass branch | 1.5–2 |
| Migration (users columns, `claims`, `item_photos`, `run_results.family_id`) and storage code (database + in-memory versions) | 1.5–2 |
| Save guest families to the database; claim-guest merge; owner checks on family routes | 2–3 |
| Browser: AuthProvider, save card (Google + email link), `/signin-finish`, account line | 2–3 |
| Ticks to server (`tabs.ts`); photo save for signed-in parents (shrink in browser) | 1–1.5 |
| Forget everything (database + Firebase delete) | 0.5–1 |
| Tests, a run-through on the live site, README and pre-existing-components note | 1–1.5 |

**Risks for the Oct 27 deadline**
1. **5 emails a day on the free plan.** If judges try email links, they may silently fail after 5. Mitigation: Google first, show a friendly "Email links are paused today, use Google or Demo" message, or upgrade to Blaze.
2. **Client keys may never reach the browser.** Vite (the tool that builds the website) only reads `VITE_*` settings from `bundle/` at build time. Today `server/env.ts:10` reads `../.secrets/bundle.env.local` **for the server only**. Fix: set `envDir` in `vite.config.ts`, and make sure Render has the variables **before** it builds. Otherwise Firebase starts with blank settings.
3. **Google popup on phones.** Popups can be blocked, and redirect sign-in breaks on browsers that block third-party storage (Safari, and Chrome as it phases out cross-site cookies) unless the app proxies `/__/auth/`. Use the popup, with the template's friendly "popup blocked" message. Don't attempt redirect before the deadline.
4. **Email link opened in a different app.** Phone mail apps often open links in their own built-in browser, which then asks for the email again. That is expected, so it needs clear copy.
5. **Saving guest families changes SAMPLE_MODE replay.** If the Zetaris profile SQL changes, the saved replay answers (keyed by the exact SQL text) break (`v2-code-map.md` §1). Keep the SQL text unchanged, or re-record.
6. **Privacy and judging.** Real emails now get saved, so: no analytics/PostHog, never log emails, only fake data in demos, and a one-line privacy note. Declare the template's auth code as a pre-existing component.
7. **Scope creep.** If time runs short, cut in this order: email link (keep Google + Demo) → photo saving → merge into an existing account. The minimum version is Google + Demo + saved family + server-side ticks + Forget everything, about 6–7 hours.

---

## Sources (checked Oct 25, 2026)
- Firebase, "Authenticate with Firebase Using Email Link in JavaScript" — enabling it (Email/Password must be on too), `actionCodeSettings` (`url`, `handleCodeInApp: true`, `linkDomain`; `dynamicLinkDomain` is deprecated), `localhost` not authorized by default for projects made after Apr 28, 2025, and the different-device email re-entry. https://firebase.google.com/docs/auth/web/email-link-auth
- Firebase, "Firebase Authentication Limits" (updated 2026-10-20) — **email link sign-in emails: 5 a day on Spark, 25,000 a day on Blaze**; 100 new accounts per hour per IP address. https://firebase.google.com/docs/auth/limits
- Firebase pricing — Authentication free up to 50,000 monthly active users; Cloud Storage listed only under Blaze. https://firebase.google.com/pricing
- Firebase, "Cloud Storage changes announced Sept 2024" FAQ — Blaze needed for new buckets from Oct 30, 2024, and for all Storage access from Oct 1, 2025. https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
- Firebase, "Best practices for using signInWithRedirect on browsers that block third-party storage" (updated 2026-10-21). https://firebase.google.com/docs/auth/web/redirect-best-practices
- Firebase Admin, "Verify ID Tokens" (updated 2026-10-20) — `getAuth().verifyIdToken(idToken)` gives `uid`; needs a service account and project ID; does not check revocation by itself. https://firebase.google.com/docs/auth/admin/verify-id-tokens
- npm registry today: `firebase` 13.1.0, `firebase-admin` 14.5.0 (`npm view`).
- Template: https://github.com/colinmatthews/VibeCodeYourNextSideProject-Template at commit a9542c2 (files cited above).
- Neon free plan storage (about 0.5 GB) is from memory and not re-checked today. Confirm in the Neon dashboard before relying on it.

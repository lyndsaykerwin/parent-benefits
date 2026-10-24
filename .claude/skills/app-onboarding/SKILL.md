---
name: app-onboarding
description: Lyndsay's consumer-app onboarding playbook (Nikita Bier / Mark Pincus style) with best practices applied automatically. Use whenever designing, building, reviewing, or changing an app's first-run experience, sign-up, welcome screens, intake questions, setup forms, permission prompts (notifications, contacts, location), invite/share flows, empty states, or anything a new user sees in their first minute — even if the user doesn't say "onboarding." Also use when building any multi-field form or questionnaire, since progressive disclosure applies there too. Works for any stack (web, iOS, Android, React Native, prototypes).
---

# App Onboarding Playbook

Onboarding is not sign-up paperwork. It is the engine of growth, word-of-mouth, and people coming back. Every tap is a miracle; attention is goldfish-short. Design like it.

**Apply the Auto-Defaults below without being asked.** The user wants best practices on autopilot. Only ask questions when a Law genuinely can't be applied without an answer (usually just: "what's the payoff moment?" and "who is the user?"). Explain every recommendation in plain English with no jargon.

---

## Step 0: Two answers before designing

1. **The payoff ("aha") moment** — the single thing that makes a new user think "oh, this is for me." Write it as a sentence a user would say: *"Whoa, I could get $2,400 I didn't know about."* If you can't name it, stop and find it first; everything else funnels toward it.
2. **Audience and stakes** — teens vs. adults, playful vs. sensitive (money, health, kids, identity). This sets the Tone Dial (below).

If the product/plan files already answer these, read them and don't ask.

---

## The 5 Laws

### 1. The 3-Second Rule
- Value proposition understood in ~3 seconds; first feel-good moment in under ~30 seconds.
- No splash screens, feature carousels, or "Welcome to X!" slides. Open straight into the action or a live preview.
- Users should *feel* what the app does, not read about it.

### 2. Sunk Cost Beats Frictionless
- The best flow is not the shortest; it builds investment and momentum.
- Ask 3–5 quick, engaging tap questions *before* any account, phone number, or permission. Fewer is fine if that's all the product truly needs — never add filler questions just to hit a count.
- Each answer visibly shapes the result ("Got it — showing Boston programs").
- By the time you ask for anything, the user has invested ~45 seconds and wants to finish.

### 3. Give Value to Get Access
- Never fire a raw system permission prompt cold. Always show a custom pre-prompt screen first.
- Frame every ask around the user's desire, not the app's need:
  - Bad: "Allow notifications." Good: "Get a heads-up 2 weeks before a deadline so you don't lose the money."
  - Bad: "Allow contacts." Good: "See which friends are already here."
- Pre-prompt has a real "Not now" — declining there means the system prompt can be shown later (a declined system prompt usually can't).
- Ask for each permission at the moment its benefit is obvious, after the payoff.

### 4. Bring Someone Else In
- Onboarding isn't done until the user has a natural reason to involve another person.
- Place the invite/share ask at the **peak** — right after the payoff, when excitement is highest.
- Tactics (pick what fits the Tone Dial):
  - Network priming: show real activity ("128 families in your area checked their list this week"). Never fake numbers.
  - Utility invites: inviting unlocks something genuinely useful (shared list, partner sees same plan).
  - Scarcity/geofencing: unlock a region or feature once enough people join.
- One-tap share (native share sheet / prefilled text). Never require it to continue.

### 5. Gamified Progress
- Visible, fast progress bar. Start it partly filled (people finish more when they feel they've begun).
- Micro-feedback on every tap: a snappy animation, color change, or haptic buzz on mobile; nothing should feel dead.
- Satisfying transitions between steps (slide/fade, ~200–300ms).
- Real social proof where it exists. If there's no real data yet, leave it out.

---

## Auto-Defaults (apply automatically to every onboarding/form screen)

**Progressive disclosure** — show only what's needed right now; reveal the rest when it becomes relevant.
- One question per screen. Only group fields (max 3) when they're one idea, like first/last name.
- Advanced or optional fields hidden behind "More options" or asked later, in context.
- Explanations behind a small "Why we ask" link, not paragraphs on screen.
- Long forms split into steps with a progress bar.

**Input friction**
- Taps over typing: buttons, chips, sliders, ranges instead of text fields.
- Sensitive numbers (income, age, weight) as tappable ranges, not exact entry.
- Smart defaults and pre-fills (detect location → suggest ZIP; pre-select the most common answer).
- Correct mobile keyboards (number pad for ZIP, date picker for dates).
- Auto-advance after a single-choice tap.

**Flow hygiene**
- One clear primary button per screen; secondary actions visually quieter.
- Always a back button; answers are kept when going back.
- "Skip" on anything not essential to the payoff.
- Save progress so a user who leaves can resume.
- No dead ends: every screen leads somewhere. Empty states show an example and one action to fill them.
- Account creation comes *after* the payoff, and is one tap (Apple/Google/phone). Never email + password on screen 1.

**Feel**
- Buttons at least 44×44px, thumb-reachable on mobile.
- Instant visual response to every tap (under 100ms); loading states for anything slower.
- Respect "reduce motion" settings.
- Copy is short, warm, second-person ("you"), and specific. No feature jargon.

**Trust (on by default whenever personal data is asked)**
- Say why you're asking and what you won't do ("We never share this").
- Ask the least sensitive questions first, most sensitive last (after momentum builds).
- Sensitive questions get a "Prefer not to say" option, even if they power the result. Skipping still gets a payoff — a broader result plus a gentle "Add this later to see your exact amount."

**Waiting for the payoff**
- If the result takes more than ~1 second, show a "working on it" screen that narrates real steps ("Checking recalls…", "Matching your ZIP…"). It builds anticipation and trust. Never show fake steps.

**Web vs. mobile**
- Haptics and native share sheets are mobile. On web, use: button press animations for feedback, the Web Share API (fall back to copy-link), and the same pre-prompt screen before the browser's notification prompt.

**Prototypes, demos, and hackathons**
- Keep the full flow shape, but steps not actually built (accounts, notifications, sharing) appear as clickable mock screens clearly labeled "Coming soon" or "Demo." Never pretend they work.
- Offer a "Try a sample" shortcut (fictional data) so judges and testers reach the payoff in one tap.
- Unknown numbers (totals, counts) stay as clearly marked placeholders like "$X" until real data fills them. Never guess.

---

## Tone Dial (adapt the Laws to the audience)

The Bier/Pincus playbook comes from teen social apps. Keep the psychology; adjust the tactics.

| Setting | When | Adjustments |
|---|---|---|
| **Playful** | Social, games, teens, entertainment | Full viral tactics: contacts sync, ghost profiles, waitlist unlocks, bold animation. |
| **Warm** | Most adult consumer apps | Invites framed as helping a friend or partner. Social proof yes; scarcity light. |
| **Careful** | Money, health, kids, pregnancy, identity, legal | No contacts sync, no pressure or fake urgency, no public activity tied to people. Invite = "share with your partner" or "send to a friend who'd want this." Trust defaults are front and center. |

---

## The Default Flow

| # | Step | Goal | How |
|---|---|---|---|
| 1 | Hook | Relevance in 3 seconds | Headline names the payoff + one tap question ("When's your baby due?"). |
| 2 | Personalize | Build investment | 2–4 more tap questions, each visibly shaping the result, progress bar moving. |
| 3 | Payoff | Deliver the aha before any ask | Show the personalized result (number, list, preview). Make this the visual high point. |
| 4 | Save it | Convert high intent | "Save your list" → one-tap account. |
| 5 | Permissions | Opt-ins that stick | Pre-prompt screens, each tied to a concrete benefit. |
| 6 | Bring someone in | Word of mouth | Share/invite at peak excitement; always skippable. |

End on a positive note (people remember the high point and the ending most).

## The 3 Pitfalls (flag these in any review)
1. Credentials or account creation before value.
2. Text-heavy tutorial or feature slides.
3. Empty screens for a product that needs other people; social connection delayed until later.

---

## Output

When **designing** a flow, produce:
1. The payoff sentence and Tone Dial setting.
2. A screen-by-screen table: screen #, what the user sees, the one action, the copy (headline + button), which Law it serves.
3. Permission pre-prompt copy and share/invite copy.
4. A list of what was deliberately cut or deferred, and why.

When **reviewing** an existing flow: for each screen, give Problem → Which Law/Default it breaks → Fix → Priority (High/Med/Low). Start with the 3 Pitfalls.

When **building**: implement the Auto-Defaults in code without being asked. For visual polish (colors, fonts, accessibility, spacing), use the `ui-ux-pro-max` skill if installed, or `frontend-design`.

## Hard rules
- Never invent social proof, user counts, or testimonials. Use real data or leave it out.
- Never use real personal data in demos or test fixtures.
- Never trap the user: every ask (share, permission, account) has a way past it unless it's truly required for the payoff.

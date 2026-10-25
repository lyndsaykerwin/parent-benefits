# Bundle V2 mockups (Oct 25, 2026)

**What this is:** one clickable web page, `index.html`, showing every change agreed in `plans/v2-feedback-response.md` (the spec). It's a mockup: a clickable picture of the screens, not the real app. Open it by double-clicking `index.html`.

**How to use it:** the menu on the left (on top, on a phone) jumps straight to each story. Inside the phone, the buttons really work: answer the questions, tick off tasks, take a pretend photo and so on. Two switches change the demo: "Family has items" and "Receipt added."

**Sample family only:** Maya (fictional), baby born Oct 3, 2026, ZIP 02139, demo date Oct 23, 2026 (baby is 20 days old). Money amounts are the sample run's numbers from the spec. Anything else (minute estimates, offer grades, lesson counts, memory ids) is labeled "example" or "sample numbers."

| Screen | What it shows | Spec point |
|---|---|---|
| S1 Questions 1–5 | Stage, date, ZIP, work setup, health insurance. "1 of 5" with a progress bar that starts partly filled. Back keeps your answers. Plain-English work options with "Something else / prefer not to say" and "Why we ask." Five insurance answers including MassHealth and TRICARE, plus "No insurance right now / not sure." After the work answer, a small line: "Got it — checking daycare tax savings for you." "Try a sample family" fills all 5. | Section A, Q1–Q5; Story 1 |
| S1 Checking screen | The 4 new lines plus "Every result double-checked against its official source." The recall line only appears when "Family has items" is on. Ends with "We found $3,640 for your family. View my results →" | "Checking" screen section |
| S1 Insurance tab | The countdown pill changes with the insurance answer: 30 days (job), 60 days (Health Connector), covered for 1 year (MassHealth), 90 days in DEERS (TRICARE), may qualify for MassHealth (none). "Change" lets you try each one. | Q5 deadline table |
| S2 Gear Locker | "Add gear" opens a photo sheet with camera tips (phone vs computer), a "Reading the sticker…" step, then the result card worded exactly as the spec ("No recalls found… 69 NHTSA car-seat recalls", "Register it with Graco →", "Saved to your gear locker", model and UPC marked "example"). The locker shows on Savings and Account with drawn thumbnails. | Section B; Story 2 |
| S3 Home | Three money buckets: "Money back now" (empty and filled versions), "At tax time — when you file your 2026 taxes (spring 2027)" with the Trump Account marked "Goes into your baby's account," and "Paid family leave — up to $1,230 a week for 12 weeks." Free gifts kept separate. No "Start over" banner. | Money buckets table; Story 3 |
| S4 Tasks | "I got this" and "Not relevant" on each card. The card slides into a "Done / not for us" drawer with Undo, and "Still to claim" / "Claimed so far" count up or down. "Quick wins (under 5 min)" filter with minute estimates. | Story 4 |
| S5 Deals | Honest status line ("Checking 16 saved offers… (Day 20)"), the exact-age line on each offer, the "Offer report card" strip (sample numbers), "Report issue" with the "You're helping other parents" thank-you. "Audit a deal" sub-screen: paste an offer, see Deal Hunter vs Fine-Print Lawyer and the practice-mode note. | Story 5; graded-offers visual |
| S6 Account | Progress ring "Your plan is 70% exact" (rises as boosters are answered), editable profile (editing re-runs the check), gear locker, "What Bundle remembers about your family" with example mem-XX ids, "What Bundle has learned from parents," "Start over," and "Forget everything" (with a confirm step). | Story 6; navigation row |
| Taxes booster | "$2,200–$3,100. One tap makes it exact →" with filing-status chips; the number flips to the exact sample total with a count-up. "Not now" shrinks it to a small chip. MA 529 $1,000 / $2,000. "Update your paycheck tax form (W-4)." | Section 2, Taxes booster |
| Insurance boosters | "Questions to ask HR" sub-screen built from the work and insurance answers, with Copy and Email to myself. Optional carrier chips (Aetna, BCBS, UnitedHealthcare, Kaiser, Other) and the $0 breast pump card. | Section 2, Insurance booster; carrier push-back |

`screens/` holds screenshots from the click-through check (one or more per story).

**Checked on Oct 25, 2026:** every story was clicked through end to end in a test browser with no page errors, and the page doesn't scroll sideways on a 375px-wide phone screen.

## Oct 25 update (v2.1) — targeted edits

The earlier version is saved as `old-versions/index-2026-10-25-v1.html`. Look and feel unchanged; only these changed:

| Change | What you'll see | Screenshots |
|---|---|---|
| Q4 work question | "Who's raising this baby?" (Just me / Two of us), then a "How do you earn money?" row per parent slides in (paycheck / self-employed / not working, each with a grey hint). The green line updates as you tap. "Continue" unlocks when every row is answered. | `s1-q4-household-*.png`, `mobile-375-onboarding.png` |
| Checking screen | Daycare line follows Q4: FSA line (paycheck), "Childcare tax credit" (self-employed only), no line (a parent not working), "general" (prefer not to say). Lines tick every ~1.3 seconds and stay; the "We found…" card comes only at the end; nothing moves on by itself. Sidebar chips show each version. | `s1-checking-variant-*.png` |
| Ways into the gear locker | Home and Savings card "Snap your baby gear…", a labelled "Scan" button in the header, and an empty locker with a scan button. The photo sheet asks "What are you scanning?" (gear sticker or receipt). Both results end with "See your gear locker →". | `s2-home-scan-entry.png`, `s2-photo-sheet.png`, `s2-receipt-result.png`, `s2-gear-locker-receipt.png` |
| Receipts are saved | Receipt shows in the locker with a drawn thumbnail and "Receipt · 3 items". Trust line (v2.2 wording): "Photos are saved with your family’s profile only. We strip location data. Delete anytime." | `s2-savings-gear-locker.png` |
| Memory panel | Friendly chips ("Remembered from your setup · Oct 23", "Learned from your gear scan · Oct 25") plus a grey "Saved in Meterless memory" tag. Raw ids hide behind "Technical details". | `s6-memory-friendly.png` |
| Audit a deal | Short form: who's offering it, what you get, link (optional), fine print as pasted text or a screenshot. The verdict names the store and offer you typed. | `s5-audit-form.png`, `s5-audit-result.png` |
| Save your plan (S7) | *Replaced in v2.2 (no sign-in). See below.* | `save-account.png` |
| Deals live mode | Sidebar switch. Live mode: "Searching 12 trusted baby-offer sites…", then cards tagged "New · found today" and "Graded by Bundle". Off = practice mode, "Checking 16 saved offers". | `s5-live-search.png`, `s5-live-found.png` |

**Checked on Oct 25, 2026 (v2.1):** every changed flow clicked through in a test browser, no page errors, no sideways scroll at 375px wide.

## v2.2 (Oct 25, 2026): outside-review round 3 (plans/v2-build-plan.md, R1–R8)

Copy of the page before these edits: `old-versions/index-2026-10-25-v2.html`. Style unchanged; all fictional data.

| # | Change | Screenshots |
|---|---|---|
| R1 | All sign-in removed (no Google, email or "Signed in as"). Account tab opens with **Switch family**: Maya, Leo (expecting, due Dec 7, 2026, ZIP 02446), Ava (born Aug 24, 2026, ZIP 43215, Ohio), each tagged "Sample", plus "My saved profile". Switching changes the family name on Home, the profile answers and the Home numbers (Leo and Ava are marked "example numbers"). Trust line: "Saved on this device. No account needed." Home card: "Your plan is saved on this device. Add a name for it (optional)" + "Not now". | `s6-account.png`, `s6-switch-family.png`, `mobile-375-switch-family.png`, `save-account.png`, `save-plan-named.png`, `s6-forget-modal.png` |
| R2 | Audit result: "✓ Added to the shared list…" when the court agrees; a "Court agreed: on/off" demo switch shows "Shown to you only; not added to the shared list." Report card has a "from a parent" row (plus your own saved audit). | `s5-audit-saved.png`, `s5-audit-result.png`, `s5-report-parent.png`, `s5-audit-form.png` |
| R3 | Live mode: saved offers show at once, the "Searching 14 trusted baby-offer sites…" line runs, then new cards slide in with "New · found today". Sidebar "Live: search fails" switch shows "No new offers right now. Showing your checked offers." with no spinner. | `s5-live-search.png`, `s5-live-found.png`, `s5-live-fallback.png` |
| R5 | Every offer card shows 🛡️ Fine Print Court (Approved / Approved with a catch / Blocked), ⏱️ minutes, 💵 true value (all marked "example"), then the age line. | `s5-offer-verdict.png`, `s5-deals.png` |
| R6 | Two drawers: **Claimed** and **Dismissed**. "Not relevant" lowers "Still to claim" and the new "Found for your family" headline, leaves "Claimed so far" alone, and shows a 5-second Undo toast; Undo also works in the drawer. | `s4-dismissed-toast.png`, `s4-dismissed.png`, `s4-drawer.png` |
| R7 | Gear camera view: dashed frame + the white-label tip. Sidebar "Gear photo unreadable" switch shows "We couldn't find a model number. Try the white label." | `s2-camera-frame.png`, `s2-photo-unreadable.png` |
| R8 | Back from a sub-view, a task's new "See details" page or an answer edit returns to the tab you came from at the same scroll spot. | `s4-task-detail.png` |

**Checked on Oct 25, 2026 (v2.2):** every changed flow clicked through with agent-browser, no console errors, no sideways scroll at 375px. Removed: `save-account-confirm.png`.

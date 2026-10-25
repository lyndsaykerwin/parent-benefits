# Project plan: New-parent benefits finder (as of Oct 21, 2026)

Pulled together from the Oct 20 brainstorm session ("Greg Eisenberg parents discount app idea"). Not final; the track and scope are still open.

## The idea
Inspired by the Military Benefits app: it collects benefits and discounts that are already public and free, and puts them in one findable place. Do the same for new parents. A baby costs a lot, and parents are exhausted.

Research behind it: [research/research-boston-baby-benefits.html](../research/research-boston-baby-benefits.html) (a Boston family could get ~$9,210 in year one, plus ~$17,350 in paid leave).

## Current direction
AI agents find, check and curate the offers. A new-parent reviewer judges whether each offer is actually worth it, and gets smarter from real parent feedback.

**Two runs, both must work with any input a judge types in:**
1. **Curation run:** agents find offers, check them, and decide what gets into the catalog.
2. **Family run:** a parent enters a due date and zip code, and gets a matched, checked list.

**Agents (3, a 4th is optional):**
- **Scout:** finds offers across sources (government sites, brand and store pages).
- **Checker:** checks eligibility facts and the fine print. Re-checks every number before it's stated.
- **Reviewer:** plays 3 specific parents (e.g. a single mom in Ohio on WIC, a two-income couple in California, a family with a baby in the NICU). Uses real checks, not vibes:
  - true cost (e.g. "free" but $14.99 shipping)
  - hidden strings (subscriptions, selling your email)
  - time to claim (a 40-minute form for a $5 coupon)
  - timing (is it relevant at the baby's age)
  It can block an offer and send it back to the Checker.

**Learning from feedback:** Meterless's memory (H-MEM) stores lessons with a source and a confidence score. Demo: in run 1 the Reviewer approves a "free" sample; a parent says "this charged me shipping"; in run 2 it rejects a similar offer and the log says why.

**Sponsor tech roles:**
- **Zetaris:** the single "data door" every agent uses to look up offers, rules and family data. (Still to confirm: which of our data sources it can actually connect to. See the Zetaris walkthrough.)
- **Meterless:** H-MEM memory for the feedback loop; Scout Intent to block risky actions until the parent approves.
- **Cursor:** build in it, and keep notes on how it was used.
- **NVIDIA:** Nemotron models, routed through the Meterless Runtime.

## Scope (solo, ~6 days)
- 3 agents, 3 parent personas, 2 offer types (free samples + government benefits), 1 learning loop.
- Use a saved copy of offer pages so judging never depends on live websites.
- Optional on day 5: fill in one application (the Trump Account form) with Scout Intent requiring the parent's OK. Fake data only, and stop at a pretend "submit" screen.

## Estimated score
About 80 to 88 out of 100 if built well. Track 1 (Solving Fragmented Intelligence) fits best. Track 3 fits if form-filling becomes the star.

## Alternative considered: Birth Bill Checker (est. 90 to 95, harder to build)
Agents line up the hospital bill, doctor bills, the insurer's statement of what it paid, and the plan rules, then flag errors (surprise out-of-network bills, the 30-day deadline to add the baby to insurance, duplicate charges) and draft a dispute letter. Higher-scoring but harder solo. "A finished 82 beats an unfinished 95."

## Key dates
- Build window opens Oct 22, 2026.
- Submission deadline Oct 27, 2026, 23:45 UTC.

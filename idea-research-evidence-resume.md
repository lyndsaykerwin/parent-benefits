# Idea research: "Evidence résumé" for overlooked workers (Oct 20, 2026)

## Bottom line
- **The worker-side need is real and well documented**: older people are working more, want flexible hours, and report widespread age and résumé-gap bias. Automated screening is being sued for age bias (Mobley v. Workday).
- **The employer side is the weak spot**: employers *say* they'll hire on skills, but a 2024 Harvard/Burning Glass study found dropping degree requirements affected fewer than 1 in 700 hires.
- **On Upwork, nobody is posting jobs for "build a profile of an overlooked candidate."** The paid demand is for (1) merging and checking messy files, (2) matching invoices to payments, and (3) finding and shortlisting candidates.
- **Legal landmine**: compiling information about people for hiring can make you a "consumer reporting agency" under US background-check law (FCRA). Safest design: the candidate gathers and approves their own evidence; the tool never ranks people for employers.
- **The closest existing project**: US Chamber Foundation's "Experience You" (June 2026), which uses AI to turn real-world experience into verified skills records. https://www.uschamberfoundation.org/solutions/workforce-development-and-training/experience-you

## Key evidence (worker need)
- 19.1% of Americans 65+ were in the labor force in 2025 (vs 12.9% in 2000). https://www.bls.gov/opub/ted/2026/nearly-one-in-five-older-americans-in-the-labor-force-in-2025.htm (page blocks scripts; not re-checked)
- 30% of retirees work or are open to temporary or flexible work; most want under 20 hrs/week (Indeed Flex, Feb 2026). https://www.staffingindustry.com/news/global-daily-news/30-of-retirees-are-open-to-working-temporary-or-flexible-jobs
- 64% of workers 50+ have seen or experienced age bias (AARP, Mar 2026). https://www.aarp.org/work/age-discrimination/age-bias-survey-2026/
- 30% of employers named an age they consider "too old to hire" (Transamerica, fall 2025). https://www.aol.com/articles/workers-want-past-65-survey-120000000.html
- Mobley v. Workday age-bias case allowed to proceed as a group lawsuit (May 2025). https://www.hklaw.com/en/insights/publications/2025/05/federal-court-allows-collective-action-lawsuit-over-alleged
- Skills-based hiring barely changed actual hires. https://www.hrdive.com/news/employers-failing-at-skills-based-hiring/707897/
- HoneyBook working-moms program: **could not be confirmed** publicly.

## Upwork / freelance demand (what clients actually pay for)
1. **Merge, de-duplicate and flag disagreements across files**: most common and best fit; clients ask for a change log and a problem list. Low pay ($9–15/hr, $100–425 per job).
   - e.g. https://www.freelancer.com/projects/database-management/mixed-data-database-maintenance
2. **Match invoices to bank, card or PayPal payments**: recurring monthly work; small budgets.
   - e.g. https://www.upwork.com/freelance-jobs/apply/Xero-catch-bookkeeping-and-reconciliation-for-limited-company_~022106803120414389501/
3. **Find and shortlist candidates from many sources**: the best-paid ($15–25/hr; €750–1,500 per job).
   - e.g. https://www.freelancer.com/projects/recruitment/source-top-sales-contractors
   - e.g. https://www.upwork.com/freelance-jobs/apply/Manufacturing-Engineering-Talent-Sourcer-Recruiter-Freelance_~022099514237403114317/
4. Lead lists: common but crowded (tools like Apollo and Clay already do it).
5. Product catalog agreement across Shopify, Amazon and inventory software: rarer, but a clean fit.

Upwork itself blocked automated access, so its posts were seen only through search results. Freelancer.com and PeoplePerHour posts were read in full.

## Candidate directions for the hackathon (Track 1 or 2)
- **A. Comeback evidence profile**: helps a retiree or career returner apply for a part-time remote role. Agents turn their volunteer, caregiving, club and side-business records into a profile where every claim is sourced and endorsed by a real person. Strongest story, but no proven paid demand.
- **B. Evidence-backed shortlist**: helps a small staffing agency fill a part-time role this week. Agents match each candidate across their application, portfolio, references and the job description, flag disagreements, and explain why someone is underrated. Ties your idea to paid demand; watch the age-bias and FCRA risks.
- **C. Month-end payment matcher**: helps a bookkeeper match invoices to bank and PayPal payments, remember last month's decisions, and send leftovers to a person to approve. Most proven demand; least connected to your idea.

---
name: tiflis-web-research
description: Use Firecrawl deliberately for live web search, developer research, scraping, extraction, and limited crawling relevant to Tiflis.
---

# Tiflis web research

Use `firecrawl` only when the answer depends on current external information or a page that is not already available through GitHub or project files.

## Choose the smallest tool

- Exact known page: `scrape`.
- Unknown page or general current information: `search`.
- Library/API/error investigation: developer search.
- Discover URLs within one site: `map`, then scrape selected URLs.
- Structured fields from pages: `extract` or scrape with a JSON schema.
- Complex multi-source investigation: research/agent.
- Whole section of a site: `crawl` with an explicit low limit.
- Page interaction: use Firecrawl interact only when Playwright is not the better fit.

## Research workflow

1. State the exact question and freshness requirement.
2. Prefer official documentation, primary repositories, standards, and direct service pages.
3. Request JSON-shaped extraction when only specific fields are needed.
4. Keep crawl scope and result size bounded.
5. Record source URLs, dates, and uncertainty in the working notes.
6. Verify critical claims through at least one independent authoritative source when possible.

## Tiflis rules

- GitHub connector remains primary for repository code and commits.
- Supabase and framework behavior should be grounded in official documentation.
- Do not scrape authenticated employee pages or expose portal data to external services.
- Do not send credentials, private URLs, user records, cash values, or session cookies to Firecrawl.
- Use Playwright for visual or interactive verification of Tiflis itself.

---
summary: The site counts visits with Cloudflare Web Analytics (cookieless JS snippet in `Base.astro`, as the domain is DNS-only) and search with Google Search Console (Domain property by DNS); it publishes `robots.txt`, `sitemap.xml`, a canonical on the app's domain, `og:image` and Organization/WebSite structured data; no Google Analytics, no cookies (amends 0071).
---

# The site counts visits with Cloudflare Web Analytics and Search Console

Status: accepted (owner, 15.11). Amends ADR 0071.

## Context

The owner wants to see how many people visit the landing and where they come from, and the redesign makes search a second channel after App Store downloads. The app's domain is already a proxied Cloudflare zone (ADR 0125). Google Analytics sets cookies and would need a consent banner, which hurts the first screen on a phone and contradicts the FAQ's «анонімна статистика без стеження».

## Decision

- **Visits:** Cloudflare Web Analytics through its JS snippet in `Base.astro`, on every page: a cookieless beacon whose token is public. The domain's records are DNS-only (GitHub Pages answers directly), so Cloudflare's automatic setup, which injects the beacon at the edge of a proxied zone, never reaches the pages. Visits through the github.io address count too.
- **Search:** Google Search Console, a Domain property verified by a DNS record in the Cloudflare zone. The site publishes `robots.txt` and `sitemap.xml` (the landing and every Edition's legal pages) for it.
- **Every page** names the app's domain as its canonical address and carries `og:image` (`public/og.png`, 1200×630 from the design) with Open Graph and Twitter card tags; the landing carries Organization and WebSite structured data. `astro.config.mjs` sets `site` to the app's domain.
- No Google Analytics, no cookies, no consent banner.

## Consequences

Search Console is a dashboard step recorded in `docs/deploy.md`; the beacon is one tag in `Base.astro`. A second Edition with its own domain needs its own `site` and sitemap.

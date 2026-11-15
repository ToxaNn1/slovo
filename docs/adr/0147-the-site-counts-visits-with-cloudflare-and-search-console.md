# The site counts visits with Cloudflare Web Analytics and Search Console

Status: accepted (owner, 15.11). Amends ADR 0071.

## Context

The owner wants to see how many people visit the landing and where they come from, and the redesign makes search a second channel after App Store downloads. The app's domain is already a proxied Cloudflare zone (ADR 0125). Google Analytics sets cookies and would need a consent banner, which hurts the first screen on a phone and contradicts the FAQ's «анонімна статистика без стеження».

## Decision

- **Visits:** Cloudflare Web Analytics with its automatic setup on the proxied zone. Cloudflare injects its cookieless beacon at the edge; the site carries no analytics code, token or variable. Only visits through the app's domain count, not the github.io address.
- **Search:** Google Search Console, a Domain property verified by a DNS record in the Cloudflare zone. The site publishes `robots.txt` and `sitemap.xml` (the landing and every Edition's legal pages) for it.
- **Every page** names the app's domain as its canonical address and carries `og:image` (`public/og.png`, 1200×630 from the design) with Open Graph and Twitter card tags; the landing carries Organization and WebSite structured data. `astro.config.mjs` sets `site` to the app's domain.
- No Google Analytics, no cookies, no consent banner.

## Consequences

Turning either tool on or off is a dashboard step recorded in `docs/deploy.md`, not a code change. A second Edition with its own domain needs its own `site` and sitemap.

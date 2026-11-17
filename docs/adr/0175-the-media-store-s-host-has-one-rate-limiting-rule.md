# The Media Store's host has one rate limiting rule

Owner decision of 2026-11-17 (a deferred idea of 2026-11-09). This ADR adds to ADR 0099 (the Media Store).

**Why.** The Media Store is public (ADR 0099): anyone can pull files from `media.slovoapp.org` in a loop and spend R2 operations and the CDN. The zone `slovoapp.org` is on Cloudflare's free plan, which allows one rate limiting rule, counting by IP and data centre over 10 s, with a 10 s block.

**The rule.** That one rule covers the media host alone: `(http.host eq "media.slovoapp.org")`, 120 requests per 10 s per IP and data centre, action Block for 10 s. The heaviest legit burst is the Feed prefetch of 20 cards, about 40 files; the Starter Media is bundled. A challenge is never used, because the app cannot answer one. The API, staging and the site keep no rate limit. The rule lives in the zone (Security → WAF → Rate limiting rules, «media rate limit»), not in the repo; this ADR is its record, and changing the rule changes this ADR.

**Consequences.** It costs $0. A reader who hits the limit loses images and Recordings for 10 s and the app falls back as offline. The free plan's only rule is spent; a second need means a paid plan or a superseding ADR. A «300 per 10 min» form needs the Business plan. To undo, turn the rule off in the zone and supersede this ADR.

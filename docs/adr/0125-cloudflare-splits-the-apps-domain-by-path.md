# Cloudflare splits the app's domain by path

Two sets of ADRs gave the app's domain (the AppConfig `domain`, `slovoapp.org` today) to two hosts. ADR 0049 and 0071 publish the landing and each Edition's legal pages there from GitHub Pages, and `apps/site/public/CNAME` names the domain. ADR 0058 and 0063 have the Deployment answer at the same domain: a Collection Link's page at `/<edition>/c/<id>` and `/.well-known/apple-app-site-association` for universal links. No ADR said who divides the paths, so a Collection Link had nowhere to live outside a simulator (the ADR audit of 2026-11-14).

**The app's domain is one Cloudflare zone, proxied, and Cloudflare sends each request by its path:**

- `/<edition>/c/*` goes to the Deployment: the Collection Link pages (ADR 0058).
- `/.well-known/*` goes to the Deployment: `apple-app-site-association` (ADR 0058) and whatever a platform asks for there later.
- Everything else goes to GitHub Pages: the landing at the root (ADR 0071) and the legal pages under `/<edition>/` (ADR 0049).

**The API and the Owner admin are not part of the split.** They stay at the Deployment's own address, the one the app takes from the EAS build environment (ADR 0063) and the Cloudflare zone already proxies for the Patch cache (ADR 0090). `/v1/*` and `/admin` at the app's domain reach GitHub Pages and answer its `404`.

**The rule lives in the Cloudflare zone, not in the repository.** `docs/deploy.md` records it beside the zone's other settings, so the zone can be set up again from the page. Nothing in the app, the site or the backend knows about the split: the site builds no `/c/` or `/.well-known/` path, the backend answers the two families at whatever host the request names, and both keep reading the one `domain`.

**The Deployment sees two proxy hops on these paths**, Cloudflare and Railway's proxy, as it does on the API once the zone proxies it; `TRUSTED_PROXY_HOPS` is `2` (this amends the «exactly one hop» of ADR 0063, which stays the rule while only Railway's proxy stands in front).

This amends ADR 0049, 0058, 0063 and 0071: each keeps its decision and now names the split for the paths it does not own.

## Considered Options

- **Collection Links on a subdomain of the Deployment, the app's domain for the site alone**: rejected by the owner (2026-11-14). The shared address would be longer and not the product's, and the associated domains entitlement would name a second domain.
- **The whole domain on the Deployment, which serves the site's files too**: rejected. ADR 0049 keeps the legal pages reachable while the Deployment is down or being replaced, and the site deploys on merge with no backend release.
- **The whole domain on GitHub Pages, with a static `apple-app-site-association` and a static page per link**: rejected. A Collection Link is made at any moment and its page is rendered from the database; Pages can serve neither.
- **`/v1/*` in the split as well**: left out. The app already has the API address from its build environment, and one more path family through the rule buys nothing.

## Consequences

The rule has to be configured in Cloudflare before a Collection Link opens on a real phone, and it is the owner's check: `https://<domain>/.well-known/apple-app-site-association` answers the backend's JSON with no redirect, `https://<domain>/<edition>/c/<id>` answers the backend's page, and the landing and the legal pages still answer from Pages. If GitHub Pages ever needs `/.well-known/acme-challenge/` on the domain to issue its own certificate, that path is carved out of the rule and this ADR is amended. A second Deployment or a move off Cloudflare reopens the split.

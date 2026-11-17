# #1957 report

Branch feat/1957-services-usage-more, commits 4215e2a4 (feature) and 85a05d8d (merge of feat/1949-services).

## Cost estimates (cost-first rule)
Every read passes the 1-hour cachedRead: at most 24 reads a day per provider (only while the section is open), plus «Оновити».
- Neon: 1 x GET console.neon.tech/api/v2/projects/{id}, ~3 KB, <=24/day = ~72 KB/day. API limit ~700 req/min. Management API only: no connection to Postgres, so no compute wake-up and no egress counted (egress is what this bar shows).
- GitHub Actions: 1 x GET api.github.com/users/{owner}/settings/billing/usage?year&month, ~20-100 KB (an item per day x SKU x repo), <=24/day = <=2.4 MB/day. Limit 5,000 req/h for the token, shared with Розробка (which uses a few per page) - far below.
- Cloudflare: 1 x POST api.cloudflare.com/client/v4/graphql (R2 storage + R2 ops by action type + Worker invocations in one query), ~2-5 KB, <=24/day. GraphQL limit 300 queries / 5 min. Costs nothing on the free plan.

## Decisions
- Env: NEON_API_KEY, NEON_PROJECT_ID, CLOUDFLARE_API_TOKEN (new); GitHub reuses GITHUB_TOKEN + GITHUB_REPOSITORY owner; Cloudflare reuses R2_ACCOUNT_ID and R2_BUCKET.
- Limits are the free plans', hard-coded like Sentry/PostHog: Neon 100 CU-h, 0.5 GB storage, 5 GB egress; GitHub Free 2,000 Actions minutes; R2 10 GB, 1M Class A, 10M Class B; Workers 100k requests/day.
- No Cloudflare Pages bar: the site is on GitHub Pages (ADR 0125). No zone bar: the free zone meters no requests; the path-routing Worker's daily requests stand in.

## Owner questions (safe default in place)
1. GITHUB_TOKEN needs the account permission "Plan: read" for the billing report; without it the GitHub bar says it cannot be read (Розробка keeps working).
2. The billing report counts minutes of public repositories too, which GitHub does not charge; the bar may overstate against 2,000. Default: plain sum. Alternative: count only private repositories.
3. Neon API keys are not read-only; a project-scoped key is the narrowest. Paid Neon plans no longer fill these project fields: the bar then says it cannot be read.
4. If the owner is on paid plans, the limits must move from constants to the Service's plan.

## Handbook page «Сервіси»
Блоки Neon, GitHub і Cloudflare тепер показують смужки використання: Neon — обчислення, сховище і вихідний трафік; GitHub — хвилини Actions за місяць; Cloudflare — сховище й операції R2 та запити Worker за сьогодні.

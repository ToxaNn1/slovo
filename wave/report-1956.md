# #1956 usage ports: Sentry and PostHog

Branch feat/1956-services-usage (worktree /tmp/wt/1956), merged with feat/1949-services (#1951 included).

## Cost estimate (cost-first)
Each Service is read at most once per hour per backend process (in-memory cachedRead, 1 h), plus each «Оновити» press, plus one read after a restart.
- Sentry: 1 GET organizations/{org}/stats_v2 (category=error, interval=1d, start of month UTC). The answer is about 1-3 KB (one group, up to 31 daily points). Worst case 24 reads a day plus presses, so about 750 a month and about 2 MB. The org rate limit is about 40 requests a second, and stats calls are not billed: no quota counts these reads. It uses the same token as Якість (5-minute cache, about 6 reads each).
- PostHog: 1 POST /api/projects/{id}/query/ HogQL `count()` of this month's events. The answer is under 1 KB. About 750 a month. The query API allows 120 requests an hour per team: this uses at most 1 an hour, plus presses. Query calls are free and do not count as ingested events. It scans only the count of one month, so the query cost is tiny.
- While a provider is down, each page load reads it again (a failure is never kept): at most a few calls a minute while the owner looks at the page.
Total: about 1,500 requests and about 3 MB a month, far below both free limits.

## Design
- Port: server-core `services/service-usage.ts`: `UsagePort.read(): SourceRead<ServiceReading>`. ServiceReading is a union by kind: metered {usage: LimitUsage[]}, railway {state online|offline, usage}, cron {lastRun {at, succeeded}|null, nextRunAt}. LimitUsage = {name, unit, used, limit}. #1955 and #1957 only add adapters to `usage` in main.ts, keyed by the Service name.
- `createServiceUsage({ports, clock})`: one `cachedRead` (sources/cached-source.ts) per Service. It now takes `{refresh}` and marks `stale` on the kept value. Quality and Development behave as before.
- API: `admin.services.usage` (GET /admin/services/usage) and `admin.services.refreshUsage` (POST, a Власник write, NOT_FOUND for a Service without a port). Both are Власник only.
- Adapters: apps/backend/src/services/usage-sources.ts. Sentry reuses SENTRY_AUTH_TOKEN and SENTRY_ORG. PostHog reuses config.posthog (POSTHOG_PERSONAL_API_KEY, PROJECT_ID, HOST). An unset key answers unavailable. No migration, no new dependency.
- Admin: the block shows a bar per limit with %, a «застаріло» mark, or «не вдалося прочитати». The panel shows «1 200 з 5 000 подій», «Прочитано <time>» and «Оновити».

## Questions for the owner (safe default taken)
1. The limits are the free plans' defaults in code (Sentry 5,000 errors, PostHog 1,000,000 events), not the table's `limits`. Should a hand-entered limit override them? Default: no.
2. The period is the calendar month in UTC, not the billing day.
3. PostHog counts only the SLOVO project's events, not the whole organization's.

## New UI strings
«Помилки», «Події», «подій», «застаріло», «не вдалося прочитати», «Використання: не вдалося прочитати.», «Прочитано …», « · застаріло: останнє читання не вдалося», «Оновити», section label «Використання».

## Handbook «Сервіси»
Блоки Sentry і PostHog показують смужку використання від ліміту плану; у панелі видно числа, час останнього читання та кнопку «Оновити», дані оновлюються раз на годину, а при збої лишаються останні з позначкою «застаріло».

## Owner checks
The look of the bars on the dark canvas and on the light phone cards (no screenshot was taken in this session). A real read with the production keys: Sentry's token needs org:read for stats_v2.

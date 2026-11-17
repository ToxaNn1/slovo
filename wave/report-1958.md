# #1958 report: an Alert when a Service reaches 90% of a limit

Branch feat/1958-services-limit-alert: b9ce357 (feature), 50a0998 (merge of feat/1949-services tip 36ca819). No migration, no new dependency, no new ADR (paragraph «A Service at 90 % of a limit» in ADR 0164 + its README line; spec says one wave ADR records the 90% Alert).

## Design
- contracts: NEAR_LIMIT_SHARE = 0.9 and nearLimit() (api/services.ts, exported from admin-api), used by the Cron and the admin.
- server-core: Alert kind `service-limit` {service, period YYYY-MM (UTC month), usage: LimitUsage}; createMonitor takes `usage: Pick<ServiceUsage,'all'>`; check `service-limit` runs only in the first run of a UTC hour (minutes < 15; Cron is */15), key `service-limit:<Service>:<limit>:<YYYY-MM>`.
- Dedupe: the existing unique `alerts.key` (AlertStore.keep onConflictDoNothing) - no migration.
- backend: services/usage-ports.ts usagePortsOf() shared by main.ts and cron-command.ts (createServiceUsage over the same ports); CronConfigSchema gains RAILWAY_READ_TOKEN/PROJECT_ID/ENVIRONMENT_ID, NEON_API_KEY, NEON_PROJECT_ID, GITHUB_TOKEN, GITHUB_REPOSITORY, CLOUDFLARE_API_TOKEN, R2_ACCOUNT_ID, R2_BUCKET; .railway/railway.ts alerts env references the backend's; docs/deploy.md updated. Telegram text: «🟡 Sentry: ліміт «errors» використано на 90 % — 4 500 з 5 000 errors за 2027-01.»; also in Огляд via alertText.
- admin: usage.tsx NearLimitMark «Ліміт майже вичерпано» (text-warn) on block and panel, bar fill bg-warn at >=90%; canvas block/card border-warn.

## Tests
- Seam 2 apps/backend/src/alerts/cron.test.ts: once per Service/limit/month, none at 89.8%, again next month, Telegram text; usage read once per hour (4 runs -> 1 read per port).
- Seam 3 apps/admin/src/services-limit.test.tsx: yellow mark at 90% on block and panel, none at 89.9999% (bar shows 90%).
- lint + typecheck green for contracts, server-core, backend, admin; tests green (admin switches.test and one backend file failed only under the parallel turbo run, pass alone - load flake).

## Cost (calls per run)
- Runs at :15/:30/:45: 0 provider calls. First run of each hour: 6 provider requests (Sentry 1, PostHog 1, Railway 1 shared by 4 ports, Neon 1, GitHub 1, Cloudflare 1), ~110 KB at most (GitHub billing report dominates). 24 runs/day -> 144 req/day, ~2.6 MB/day worst case. Adds to the backend's own <=24/day per provider while «Сервіси» is open: PostHog <=2/h vs 120/h, GitHub <=2/h vs 5000/h, Cloudflare vs 300/5 min, Railway vs 1000/h, Sentry/Neon far below. $0.

## Owner questions (safe default in place)
1. Period = calendar UTC month for every limit, also the daily Worker-requests limit (alerts at most once a month). Alternative: a period per limit from the port.
2. The alerts Cron now holds the usage keys (RAILWAY_READ_TOKEN workspace token, NEON_API_KEY, GITHUB_TOKEN, CLOUDFLARE_API_TOKEN) as Railway references; ADR 0164 text changed from «backend alone» to «backend and the alerts Cron». Alternative: the Cron asks the backend, needing an internal auth.
3. Limits come from the hardcoded free-plan constants of the ports (as #1956/#1957), not the table's `limits`.

## Handbook «Сервіси»
Коли сервіс використав 90 % будь-якого ліміту, його блок і панель позначаються жовтим «Ліміт майже вичерпано», а Cron alerts раз на годину перевіряє ліміти й надсилає в Telegram одне повідомлення на сервіс, ліміт і місяць.

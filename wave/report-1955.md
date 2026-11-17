# #1955 report

Branch feat/1955-services-railway, commits ce074710 (backend), c7e075a2 (admin), b5083c7f (merge of feat/1949-services).

## What
- apps/backend/src/services/railway-usage.ts: createRailwayUsage -> ports `Railway`, `alerts`, `quote-check`, `recordings` (UsagePort, via cachedRead 1 h in createServiceUsage). One GraphQL query (project services + instances + latestDeployment + nextCronRunAt, and `usage` of this UTC month); concurrent reads share one in-flight request.
  - Railway: online iff backend's latest deployment in RAILWAY_ENVIRONMENT_ID is SUCCESS; usage `spend` USD = CPU/RAM/egress/volume x Railway prices vs Hobby $5.
  - Cron: lastRun from latestDeployment SUCCESS (ok) / CRASHED|FAILED (failed) at updatedAt; else null; nextRunAt = nextCronRunAt.
- fake-railway.ts (fake GraphQL fetch); tests railway-usage.test.ts (adapter) and services-railway.test.ts (seam 1: states, 1 h cache, one request, «Оновити», stale).
- config.ts: RAILWAY_READ_TOKEN, RAILWAY_PROJECT_ID, RAILWAY_ENVIRONMENT_ID -> config.railway (railwayOf). main.ts spreads the ports. .env.example, docs/deploy.md rows, .railway/railway.ts preserve(RAILWAY_READ_TOKEN). ADR 0164 paragraph «Railway answers the backend and the Crons».
- apps/admin usage.tsx: StateLines on block and panel: «Online»/«Offline», «Останній запуск успішний»/«невдалий»/«Ще не запускався», «Наступний через N хв»; `spend` -> «Витрати». Test services-railway.test.tsx (seam 3).

## Cost (Railway public API)
- Requests: 1 POST per hour per backend process (cache 1 h, all 4 ports share one request) + 1 per «Оновити». Restart: +1. Worst case ~24-50/day.
- Bytes: request ~0.7 KB, answer ~2-4 KB (4 services x instances per environment + 4 usage rows). <= ~0.2 MB/day.
- Limits: Railway API rate limit Hobby 1,000 req/h (10 RPS), Pro 10,000 req/h. Use is <0.1% of it. No Railway billing for API calls.

## Owner questions (safe default in place)
1. No Cron blocks in the seed (ADR 0164 rejected Crons as Services; migrations are out of this ticket). Default: the Власник adds `cron` Services named exactly `alerts`, `quote-check`, `recordings` via «Додати сервіс». Or a later ticket seeds them by migration and amends ADR 0164.
2. Railway has no read-only token. Default: a workspace token (Bearer) on the backend only; a project token (Project-Access-Token header) is narrower but may not read `usage`.
3. The limit is the Hobby plan's included $5 (constant RAILWAY_INCLUDED_USD); Pro is $20.
4. The GraphQL field names (nextCronRunAt, latestDeployment.updatedAt, usage measurements) follow Railway's public schema but were checked only against the fake; an unknown shape answers «не вдалося прочитати», never wrong numbers.

## Handbook
Page «Сервіси»: add that the Railway block shows Online/Offline and the month's spend against $5, each Cron block its last run and «Наступний через N хв», read from Railway once an hour with RAILWAY_READ_TOKEN.

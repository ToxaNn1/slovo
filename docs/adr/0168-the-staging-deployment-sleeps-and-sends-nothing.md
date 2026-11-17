# The Staging Deployment is a sleeping Railway environment that sends nothing

The backend is one Deployment (ADR 0063): a backend change or a migration can only be tried where the readers are. The owner needs a second running copy for his tests that costs next to nothing and cannot touch what readers see.

**The Staging Deployment is the `staging` environment of the Railway project in `.railway/railway.ts` (ADR 0103), with its Postgres on a branch of the Deployment's Neon project. The Deployment alone keeps meaning production.**

- **The backend alone.** The `staging` environment declares the `backend` service only, from the same Dockerfile, with the same release step (`pnpm db:migrate`, as in ADR 0063). No Cron service runs there: no Recordings, no alerts, no quote check.
- **It sleeps.** Railway's sleep is on (`sleepApplication`), so the service stops while no request comes. Nothing scheduled calls it: no Cron service, no scheduled workflow, no uptime check. Railway's own `/health` check runs only while a deploy rolls out, right after the migrations woke the database anyway, so it keeps nothing awake.
- **Its own variables and domain.** Every secret is `preserve()`, set in the `staging` environment and never copied from production; the file sets `DEPLOYMENT=staging`. It has a domain of its own on the app's domain, `staging.slovoapp.org`, proxied by Cloudflare.
- **Its Postgres** is a branch of the Neon project (Launch plan), made from `main`: fixed 0.25 CU, scale-to-zero after 5 minutes. A reset from its parent brings production's data back on demand.
- **`DEPLOYMENT=staging` makes it harmless.** The backend parses it once, at start (`apps/backend/src/config.ts`): it then refuses the PostHog and `R2_*` variables, never asks PostHog (no Analytics query leaves), refuses every Media Store write and reads the Media Store's public URLs under `MEDIA_BASE` only, and Sentry files its reports under the environment `staging` (the Deployment's are `production`).
- **Deployed by hand** from any git ref, linked to the `staging` environment: `railway config apply`, then `railway up --service backend`. CI never deploys it.

## Cost

- **Neon**: 0.25 CU × about 2 h a day ≈ 15 CU-hours ≈ $1.6 a month. Awake all month it would be ≈ 180 CU-hours ≈ $19, which is why nothing scheduled runs there. Storage: only the branch's changes from `main`.
- **Railway** with sleep: about $1–5 a month.
- **Network transfer**: tens of MB a month against Neon's 500 GB.

## Considered Options

- **A second Railway project.** Twice the tokens and settings for one service; an environment of the same project shares the file.
- **A local backend against a copy of the data.** It never runs the real image, Railway or the Cloudflare path in front.
- **Staging with the Cron services.** The alerts Cron every 15 minutes and the hourly ones would keep Neon awake all month (≈ $19) for nothing the owner tests there.

## Consequences

- An app build or update made against the Staging Deployment's address carries no PostHog key, so the app sends no Analytics from staging either (the OTA workflow's concern).
- An Illustration upload in the admin of the Staging Deployment fails: it writes nothing to the Media Store.
- The `staging` environment is created empty, not as a copy of `production`, whose Cron services an apply would have to delete.

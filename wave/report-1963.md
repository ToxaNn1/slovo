# #1963 report
- Railway: `.railway/railway.ts` returns `stagingProject()` when `ctx.isEnvironment('staging')`: backend only, sleepApplication true, custom domain staging.slovoapp.org:8080, PORT=8080, DEPLOYMENT=staging literal, no POSTHOG/R2/Telegram/GitHub/EAS/CI keys. Production definition unchanged.
- Backend: `DEPLOYMENT` (production|staging, default production) in config.ts; staging refuses POSTHOG_* and R2_* (message "must not be set on the Staging Deployment") and waives the production R2 requirement. `deployment-ports.ts` picks PostHog port, Media Store and Sentry environment; staging -> unavailablePostHog, `publicMediaStore` (put/delete reject, head = HEAD on MEDIA_BASE URL). Sentry.init gets `environment`.
- Tests: apps/backend/src/railway-definition.test.ts, apps/backend/src/staging-deployment.test.ts (fake fetch records every request; production counterpart proves requests are seen).
- Kept Railway's deploy-time /health check on staging: runs only during rollout, after preDeploy migrations already woke Neon. Safe alternative if owner disagrees: drop `healthcheck` in stagingProject().
- Illustration upload in the staging admin fails with a 500 (write refused) - by design, noted in ADR consequences.
- For #1966: an update built against staging must carry no EXPO_PUBLIC_POSTHOG_KEY (ADR 0168 consequence).
- Cost: added traffic = 0 scheduled requests. Staging: ~2 h/day x 0.25 CU = ~15 CU-h ≈ $1.6/month Neon, Railway $1-5, transfer tens of MB/month. One HEAD per Media Store head() call (server never calls it today).
- Owner: create the Railway `staging` environment EMPTY (not a copy of production), set its preserve() variables, Cloudflare proxied CNAME staging.slovoapp.org.

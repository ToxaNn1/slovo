# Owner checks

The steps only the owner can take or check, by version: accounts, consoles and devices no agent reaches.

## 0.9 build

### Railway (ADR 0063, `docs/deploy.md`)

1. Create a Railway project and, in it, a service from this GitHub repository (branch `main`); Railway finds `railway.json` and builds the `Dockerfile`.
2. Add a Postgres service to the project.
3. Set the backend service's variables as the table of `docs/deploy.md` gives them: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `AUTH_SECRET`, the SMTP settings and `MAIL_FROM`, `GOOGLE_CLIENT_IDS`, `SENTRY_DSN`, `APPLE_TEAM_ID` and `TRUSTED_PROXY_HOPS=1`.
4. Deploy, and check in the deploy log that the pre-deploy step printed `migrated` and the health check passed; `https://<railway address>/health` answers `{"status":"ok","migration":"…"}`.
5. Add the Edition's API domain to the service (Settings, Networking, Custom Domain), set the CNAME record Railway names at the domain's DNS, and wait for Railway's certificate; `https://<api domain>/health` answers `200`, and `http://` is never served.
6. Publish the Language Pack to the Deployment as `docs/deploy.md` describes, and check that `content.latest` announces it.
7. Request a Sign-in code from a release build of the app and check that it arrives in a real inbox.

### OTA updates (ADR 0062, `.github/workflows/ota-update.yml`)

1. Create the repository secret `EXPO_TOKEN` (an Expo access token of the account that owns the EAS project), and in the EAS environment `production` the file variable `UPDATES_PRIVATE_KEY` with visibility «sensitive», holding the private key of `apps/mobile/certs/certificate.pem`, beside the bundle's `EXPO_PUBLIC_*` variables.
2. Publish a first staged update: Actions → OTA update → Run workflow with the Edition `uk`, a rollout of `10` and a message. Check that the run prints the update group and the update id, and that the EAS dashboard shows the update on the channel `uk` at 10%.
3. On a TestFlight build of the channel `uk` that receives the update, check that «Про застосунок» shows its update id after the next launch.
4. Run the workflow again with that update group and a rollout of `100`, and check that the EAS dashboard shows the update at 100%.

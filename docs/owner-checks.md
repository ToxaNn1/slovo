# Owner checks

The steps only the owner can take or check, by version: accounts, consoles and devices no agent reaches.

## 0.9 build

### Railway (ADR 0063, `docs/deploy.md`)

1. Create a Railway project and, in it, a service from this GitHub repository (branch `main`); Railway finds `railway.json` and builds the `Dockerfile`.
2. Add a Postgres service to the project.
3. Set the backend service's variables as the table of `docs/deploy.md` gives them: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `AUTH_SECRET`, the SMTP settings and `MAIL_FROM`, `GOOGLE_CLIENT_IDS`, `SENTRY_DSN` and `TRUSTED_PROXY_HOPS=1`.
4. Deploy, and check in the deploy log that the pre-deploy step printed `migrated` and the health check passed; `https://<railway address>/health` answers `{"status":"ok","migration":"…"}`.
5. Add the Edition's API domain to the service (Settings, Networking, Custom Domain), set the CNAME record Railway names at the domain's DNS, and wait for Railway's certificate; `https://<api domain>/health` answers `200`, and `http://` is never served.
6. Publish the Language Pack to the Deployment as `docs/deploy.md` describes, and check that `content.latest` announces it.
7. Request a Sign-in code from a release build of the app and check that it arrives in a real inbox.

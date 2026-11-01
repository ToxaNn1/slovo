# The Deployment

The backend runs as one container image on Railway, one Deployment for every Edition, behind the Edition's domain (ADR 0030, 0063).

- **The image**: `Dockerfile` at the repository root installs the backend and the workspace packages it needs with pnpm; tsx runs their TypeScript sources. It leaves every Language Pack out, sets `NODE_ENV=production` and starts the server. CI builds it on every pull request (the job "Container image"), runs the migrations from it against a fresh Postgres and waits for `/health` to answer `200`; it pushes nothing.
- **The Railway config**: `railway.json` builds that Dockerfile, runs `pnpm db:migrate` as the release (pre-deploy) command, so the new server serves only once every migration ran, and watches `GET /health`, which answers `200` when the database answers.
- **Postgres** is Railway's; its `DATABASE_URL` reaches the service through a reference variable.

## Variables

Every variable the server reads at start, with the value it takes in the Deployment. `apps/backend/.env.example` names the same variables for a local backend; the backend's tests hold both lists to the configuration module (`apps/backend/src/config.ts`). The repository holds no secret: each secret below lives only in the Railway variables of the service.

| Variable             | In the Deployment                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`           | `production`, set by the image. The server then refuses to start without the SMTP settings and the sender.    |
| `DATABASE_URL`       | `${{Postgres.DATABASE_URL}}`, the reference to Railway's Postgres service.                                    |
| `AUTH_SECRET`        | Secret. Signs the Sessions; make it once with `openssl rand -base64 32`. Changing it signs every reader out.  |
| `SMTP_HOST`          | The SMTP server of the owner's email account.                                                                 |
| `SMTP_PORT`          | Its port: 465 with `SMTP_TLS=true`, 587 otherwise.                                                            |
| `SMTP_USER`          | Secret. The login at the SMTP server.                                                                         |
| `SMTP_PASSWORD`      | Secret. Its password.                                                                                         |
| `SMTP_TLS`           | `true` for port 465 (TLS from the first byte); unset requires STARTTLS, so the login never goes in the clear. |
| `MAIL_FROM`          | The address the Sign-in codes come from, on the Edition's domain.                                             |
| `GOOGLE_CLIENT_IDS`  | The OAuth client ids of the apps at Google, comma-separated (ADR 0047). Empty turns Google sign-in off.       |
| `OWNER_EMAIL`        | The one Account the owner admin at `/admin` signs in (ADR 0069). Empty leaves the admin out.                  |
| `SENTRY_DSN`         | Secret. The `https://` DSN of the backend's Sentry project (ADR 0048). Empty reports nothing.                 |
| `TRUSTED_PROXY_HOPS` | `1`: Railway's proxy is the one hop whose forwarded-for address the limits per IP trust.                      |
| `PORT`               | Unset: Railway sets it, and its proxy sends the traffic there.                                                |
| `EDITIONS_DIR`       | Unset: the image's `editions/`.                                                                               |

## Publishing a Language Pack

A Language Pack reaches the Deployment through the publish command (ADR 0032), run on the owner's machine, never through the image. The operator credential is the public address of Railway's Postgres (`DATABASE_PUBLIC_URL` in the Postgres service's variables), given in the command's environment and never written to a file in the repository:

```sh
pnpm build:pack uk
DATABASE_URL='<DATABASE_PUBLIC_URL of the Railway Postgres>' pnpm publish:pack uk
```

A variable in the environment wins over the same one in `apps/backend/.env`, so the local `.env` stays pointed at the local Postgres. The other operator commands (`pnpm switch:off`, `pnpm reports`, `pnpm collection-links`) reach the Deployment the same way.

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

## Importing an Edition's content

An Edition's content lives in the Deployment's Postgres (ADR 0090). The Edition folder reaches it once, through the import command, run on the owner's machine with the same operator credential:

```sh
DATABASE_URL='<DATABASE_PUBLIC_URL of the Railway Postgres>' pnpm content import --edition uk
```

The command checks every content rule first and writes nothing when one refuses a record; it prints the count of each kind of record and the content version it wrote. A second import writes nothing and says so, because the database is the live content from then on; `--override` imports the folder again over the database and raises the content version.

## The quote check

The quote check (ADR 0084) runs on the Deployment as a second Railway service, a Cron service on the same image: `railway.quote-check.json` holds its settings.

| Setting  | Value                                                                  |
| -------- | ---------------------------------------------------------------------- |
| Command  | `pnpm quote-check`                                                     |
| Schedule | `0 * * * *`: hourly, UTC                                               |
| Restart  | Never: the command exits when done, and the next run comes on schedule |

Its one variable is `DATABASE_URL`, a reference to the same Postgres. A save never waits for it: every create or edit of a Word, Correction, Idiom, Synonym Row or Tip leaves the record unverified, and the job checks the quoted text of each unverified record against its first source's page, through the sourcing cache in Postgres (a fetched page stands for 30 days). A quote it does not find is flagged for the Content queue with the finding, and the record stays live. A page it cannot fetch leaves the record unverified for the next run. Imported records count as checked, since CI ran `pnpm content verify` on them, and a record with no source page is not checked. The admin content report gives the counts of unverified and failed records.

## Building the Language Pack from the snapshot

Every app build bundles a Language Pack built from the live content: the Edition folder gives the config, Categories and assets, and the records come from the content snapshot the backend serves (`GET /v1/editions/<id>/content/snapshot`). `pnpm build:pack` fetches it from the backend at `EXPO_PUBLIC_SLOVO_API_URL`; `--snapshot <file>` reads a snapshot saved to a file instead. When the backend gives no snapshot, the build fails with the reason and writes no pack.

The EAS build runs it in the `eas-build-post-install` hook of `apps/mobile/package.json`, before bundling, with the address the EAS environment `production` holds; the OTA update workflow runs it through `eas env:exec production`. `pnpm dev`, the smoke flow and CI build it from a local backend over the imported Edition folder.

Owner check for the first real build from the database pack: after the first TestFlight build, the build log of the `eas-build-post-install` hook shows `Built the Language Pack for "uk"` with the content version the Deployment's snapshot holds, and the installed app opens the Feed.

## Publishing a Language Pack

A Language Pack reaches the Deployment through the publish command (ADR 0032), run on the owner's machine, never through the image. The operator credential is the public address of Railway's Postgres (`DATABASE_PUBLIC_URL` in the Postgres service's variables), given in the command's environment and never written to a file in the repository:

```sh
EXPO_PUBLIC_SLOVO_API_URL='<the Deployment backend address>' pnpm build:pack uk
DATABASE_URL='<DATABASE_PUBLIC_URL of the Railway Postgres>' pnpm publish:pack uk
```

A variable in the environment wins over the same one in `apps/backend/.env`, so the local `.env` stays pointed at the local Postgres. The other operator commands (`pnpm switch:off`, `pnpm reports`, `pnpm collection-links`, `pnpm admin`) reach the Deployment the same way.

## The owner admin's people and Агент tokens

The admin and its API (`/v1/admin`) answer 404 until a Власник exists (ADR 0088). The server commands add the first one and issue or revoke the token of a coding agent; each logs itself in the Action log:

```sh
DATABASE_URL='<DATABASE_PUBLIC_URL of the Railway Postgres>' pnpm admin owner add <email>
DATABASE_URL='<DATABASE_PUBLIC_URL of the Railway Postgres>' pnpm admin agent add <name>
DATABASE_URL='<DATABASE_PUBLIC_URL of the Railway Postgres>' pnpm admin agent revoke <name>
```

`agent add` prints the token once; the database keeps its SHA-256 only. The Агент sends it as `Authorization: Bearer <token>`, and only the content-writing procedures of the admin API take it. Until the admin's sign-in replaces it, `OWNER_EMAIL` still names who signs in to the old pages at `/admin`.

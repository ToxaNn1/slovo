# The Deployment

The backend runs as one container image on Railway, one Deployment for every Edition, behind the Edition's domain (ADR 0030, 0063).

- **The image**: `Dockerfile` at the repository root installs the backend and the workspace packages it needs with pnpm; tsx runs their TypeScript sources. It leaves every Language Pack out, sets `NODE_ENV=production` and starts the server. CI builds it on every pull request (the job "Container image"), runs the migrations from it against a fresh Postgres and waits for `/health` to answer `200`; it pushes nothing.
- **The Railway project**: `.railway/railway.ts` declares it as Infrastructure as Code (ADR 0103): project `slovo` with the backend and its three Cron services, each built from a Dockerfile, in EU West (Amsterdam, `europe-west4-drams3a`), one replica. The backend runs `pnpm db:migrate` as the release (pre-deploy) command, so the new server serves only once every migration ran; Railway watches `GET /health`, which answers `200` when the database answers, for up to 120 seconds, and restarts a failed backend up to 5 times. See «The Railway project file» below.
- **Postgres** is Neon's, in Frankfurt (`aws-eu-central-1`), beside the backend in Railway's EU West, Amsterdam (ADR 0099): Railway has no Frankfurt region. Its connection string is the service's `DATABASE_URL`; see [Neon and the CDN](#neon-and-the-cdn).

## Variables

Every variable the server reads at start, with the value it takes in the Deployment. `apps/backend/.env.example` names the same variables for a local backend; the backend's tests hold both lists to the configuration module (`apps/backend/src/config.ts`). The repository holds no secret: each secret below lives only in the Railway variables of the service.

| Variable                   | In the Deployment                                                                                                                                                                                                                                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                 | `production`, set by the image. The server then refuses to start without `ZEPTOMAIL_TOKEN` and `MAIL_FROM`.                                                                                                                                                                                                                            |
| `DATABASE_URL`             | Secret. The pooled connection string of the Neon project's `main` branch (`postgresql://…-pooler.eu-central-1.aws.neon.tech/…?sslmode=require`).                                                                                                                                                                                       |
| `AUTH_SECRET`              | Secret. Signs the Sessions; make it once with `openssl rand -base64 32`. Changing it signs every reader out.                                                                                                                                                                                                                           |
| `ZEPTOMAIL_API_URL`        | The email endpoint of ZeptoMail's API in the EU data centre, `https://api.zeptomail.eu/v1.1/email` (ADR 0105); unset, the same. `https://` only.                                                                                                                                                                                       |
| `ZEPTOMAIL_TOKEN`          | Secret. The Send Mail token of the ZeptoMail Agent of the sending domain (ZeptoMail, Mail Agents, SMTP/API), without its `Zoho-enczapikey` prefix. Required in production.                                                                                                                                                             |
| `MAILPIT_URL`              | Unset: a local backend only sends to Mailpit's send API (default `http://localhost:8025`) while `ZEPTOMAIL_TOKEN` is unset, and production refuses that.                                                                                                                                                                               |
| `MAIL_FROM`                | The address the Sign-in codes come from, on the Edition's domain.                                                                                                                                                                                                                                                                      |
| `GOOGLE_CLIENT_IDS`        | The OAuth client ids of the apps at Google, comma-separated (ADR 0047). Empty turns Google sign-in off.                                                                                                                                                                                                                                |
| `SENTRY_DSN`               | Secret. The `https://` DSN of the backend's Sentry project (ADR 0048). Empty reports nothing.                                                                                                                                                                                                                                          |
| `SENTRY_AUTH_TOKEN`        | Secret. A Sentry auth token with `org:read`, `project:read`, `event:read`, which Якість reads Sentry with. Empty shows Sentry unavailable.                                                                                                                                                                                             |
| `SENTRY_ORG`               | The slug of the Sentry organization.                                                                                                                                                                                                                                                                                                   |
| `SENTRY_APP_PROJECT`       | The numeric id of the app's Sentry project.                                                                                                                                                                                                                                                                                            |
| `SENTRY_BACKEND_PROJECT`   | The numeric id of the backend's Sentry project.                                                                                                                                                                                                                                                                                        |
| `CI_HISTORY_TOKEN`         | Secret. The Bearer token of `POST /v1/admin/ci-runs`, which CI pushes its history with after each run on `main` (ADR 0096); make it with `openssl rand -base64 32` and give the same value to the GitHub Actions secret `CI_HISTORY_TOKEN`, with the backend's public URL as the secret `SLOVO_BACKEND_URL`. Empty refuses every push. |
| `MEDIA_BASE`               | The URL root of the Media Store (ADR 0099) the snapshot and the Patch name, with no trailing slash: the R2 bucket's public CDN domain. Required in production; unset in development, `http://localhost:8787/media`.                                                                                                                    |
| `TELEGRAM_BOT_TOKEN`       | Secret. The token @BotFather gives the owner's alert bot. Empty keeps alerts for Огляд and only logs them.                                                                                                                                                                                                                             |
| `TELEGRAM_CHAT_ID`         | The owner's Telegram chat id, the only chat the bot writes to; a message to any other chat never leaves.                                                                                                                                                                                                                               |
| `BACKEND_HEALTH_URL`       | The Cron service only: the backend's public health URL it checks each run; empty skips the check.                                                                                                                                                                                                                                      |
| `R2_ACCOUNT_ID`            | The backend and the Recordings service: the Cloudflare account id of the Media Store's R2 bucket (ADR 0099). The four `R2_*` go together and are required in production.                                                                                                                                                               |
| `R2_BUCKET`                | The backend and the Recordings service: the name of the R2 bucket.                                                                                                                                                                                                                                                                     |
| `R2_ACCESS_KEY_ID`         | Secret. The backend and the Recordings service: the S3 access key id of an R2 API token with Object Read & Write on the bucket.                                                                                                                                                                                                        |
| `R2_SECRET_ACCESS_KEY`     | Secret. The backend and the Recordings service: that token's S3 secret access key.                                                                                                                                                                                                                                                     |
| `RECORDINGS_PYTHON`        | The Recordings service only. Unset: the Python `recordings.Dockerfile` puts at `/opt/recordings/venv/bin/python`.                                                                                                                                                                                                                      |
| `RECORDINGS_MODEL_DIR`     | The Recordings service only. Unset: the voice model `recordings.Dockerfile` puts at `/opt/recordings/model`.                                                                                                                                                                                                                           |
| `GITHUB_TOKEN`             | Secret. A fine-grained token on `ToxaNn1/slovo`, read-only: Pull requests, Actions, Contents, Issues, Metadata. Розробка reads GitHub with it; empty shows «GitHub недоступний».                                                                                                                                                       |
| `GITHUB_REPOSITORY`        | Unset: `ToxaNn1/slovo`, the repository Розробка reads.                                                                                                                                                                                                                                                                                 |
| `EXPO_TOKEN`               | Secret. An EAS robot token with read access to the app's project. Розробка reads the latest builds with it and never starts one (ADR 0004); empty shows «EAS недоступний».                                                                                                                                                             |
| `EAS_PROJECT_ID`           | Unset: the app's EAS project id from `apps/mobile/app.config.ts`.                                                                                                                                                                                                                                                                      |
| `POSTHOG_PERSONAL_API_KEY` | Secret. A PostHog personal API key with the read-only `query` scope, for the admin's Аналітика. Unset, it answers «PostHog недоступний».                                                                                                                                                                                               |
| `POSTHOG_PROJECT_ID`       | The number of the PostHog project the app sends its Analytics events to.                                                                                                                                                                                                                                                               |
| `POSTHOG_HOST`             | The PostHog host; unset, `https://eu.posthog.com`.                                                                                                                                                                                                                                                                                     |
| `TRUSTED_PROXY_HOPS`       | `2` once the Cloudflare zone proxies the backend's domain: Cloudflare and Railway's proxy are the two hops whose forwarded-for addresses the limits per IP trust. `1` while only Railway's proxy stands in front.                                                                                                                      |
| `PORT`                     | Unset: Railway sets it, and its proxy sends the traffic there.                                                                                                                                                                                                                                                                         |
| `EDITIONS_DIR`             | Unset: the image's `editions/`.                                                                                                                                                                                                                                                                                                        |

## Neon and the CDN

**Neon.** One Neon project in Frankfurt (`aws-eu-central-1`) holds the Deployment's Postgres; its default branch `main` is the live database. Neon restores `main` to any point inside its history window, and it scales to zero while idle (about half a second on the first query after sleep).

| Setting                           | Value                                                                                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Railway variable `DATABASE_URL`   | The pooled connection string of `main`, on the backend and on the Cron services. The pre-deploy command `pnpm db:migrate` runs the migrations against it. |
| Neon API key                      | Secret. Lives only in Neon's GitHub integration (the GitHub secret `NEON_API_KEY`), never in the repository.                                              |
| GitHub variable `NEON_PROJECT_ID` | The GitHub Actions variable naming the project, for the branch per pull request.                                                                          |

**The move from Railway's Postgres.** Once, before `DATABASE_URL` changes: stop writes (no admin saves, the Cron services paused), copy the database with `pg_dump --format=custom --no-owner '<DATABASE_PUBLIC_URL of the Railway Postgres>' > slovo.dump` and `pg_restore --no-owner --dbname='<the Neon connection string, unpooled>' slovo.dump`, point `DATABASE_URL` at Neon, deploy, check `/health`, then remove the Railway Postgres service.

**A branch per pull request.** Neon's GitHub integration makes a branch `preview/pr-<number>` from `main` when a pull request opens and deletes it when it closes: a copy of the live content to run the pull request's migrations and backend against before they reach `main`. CI's backend tests keep their own Postgres service, a database per test file, so a pull request never writes to a Neon branch it shares.

**The Cloudflare zone.** The backend's domain is a Cloudflare zone whose DNS record for the API is proxied (the orange cloud) to the Railway service's domain. One Cache Rule makes the Patch route eligible for the cache:

| Setting   | Value                                                                   |
| --------- | ----------------------------------------------------------------------- |
| When      | URI path matches `/v1/editions/*/content/patch` and the method is `GET` |
| Cache     | Eligible for cache                                                      |
| Edge TTL  | Use the cache-control header of the origin                              |
| Cache key | The whole query string                                                  |

The Patch route answers `cache-control: public, max-age=0, s-maxage=60` with its ETag (ADR 0099): the CDN keeps each Patch for a minute under its URL (the Edition, `since` and `patchFormat`), so most devices never reach the database, and the device revalidates it by its ETag and gets 304. An edit reaches every device within that minute; nothing needs a purge. Every other route stays uncached. The Media Store's R2 variables are listed with the Recording generation service.

## The Railway project file

`.railway/railway.ts` replaces the Config as Code files (`railway.json` and one per Cron service), which Railway no longer takes for new services and stops reading on 2026-12-01 (ADR 0103). It uses the `railway` package's `railway/iac`, pinned in the root `package.json`; `pnpm typecheck` checks it. It declares:

| Service       | Dockerfile              | Command            | Schedule (UTC) | Restart             |
| ------------- | ----------------------- | ------------------ | -------------- | ------------------- |
| `backend`     | `Dockerfile`            | the image's `CMD`  | none           | on failure, 5 times |
| `alerts`      | `Dockerfile`            | `pnpm cron`        | `*/15 * * * *` | never               |
| `quote-check` | `Dockerfile`            | `pnpm quote-check` | `0 * * * *`    | never               |
| `recordings`  | `recordings.Dockerfile` | `pnpm recordings`  | `0 * * * *`    | never               |

No service has a source: nothing links the project to a GitHub account, and a deploy is `railway up` with a project token, which CI runs (see «Deploying»). The file holds no secret. Every variable of the backend in «Variables» is `preserve()`, so Railway keeps the value set in its variables, where the owner sets it once; even `TRUSTED_PROXY_HOPS`, which is `1` behind Railway's proxy alone and `2` once Cloudflare is in front (ADR 0099). The Cron services take the backend's variables by reference, so each secret is set once, on the backend.

`railway config plan` shows what the file changes against the project and `railway config apply` applies it; an apply can delete a resource the file leaves out. Run them signed in to SLOVO's Railway account (accounts@slovoapp.org), never a personal one. The `recordings` service builds `recordings.Dockerfile`, which comes with the Media Store (ADR 0099); deploy it only once that file is on `main`.

## Deploying

CI deploys (ADR 0104): on every push to `main`, once the check "Lint, typecheck, test and Language Pack" passed, the job "Deploy to Railway" of `.github/workflows/ci.yml`

1. installs the Railway CLI at the version the job pins (`@railway/cli`; the root `railway` package is only the SDK the file imports);
2. runs `railway config apply --yes`, which brings the project to `.railway/railway.ts`; an apply that would delete a resource fails the job instead, since it has no `--confirm-destructive`;
3. runs `railway up --ci --service <name>` for `backend`, `alerts` and `quote-check`, and for `recordings` once `recordings.Dockerfile` exists.

It signs in with the GitHub Actions secret `RAILWAY_TOKEN`, a Railway project token of the `production` environment (project `slovo` → Settings → Tokens); to rotate it, make a new token there and set the secret to it. A pull request never deploys, and the concurrency group `railway-deploy` keeps deploys from overlapping: a newer push waits for the running deploy. To deploy by hand, set `RAILWAY_TOKEN` in the shell to that token and run the same commands from the repository root.

## Importing an Edition's content

An Edition's content lives in the Deployment's Postgres (ADR 0090). The Edition folder reaches it once, through the import command, run on the owner's machine with the same operator credential:

```sh
DATABASE_URL='<the Neon connection string>' pnpm content import --edition uk
```

The command checks every content rule first and writes nothing when one refuses a record; it prints the count of each kind of record and the content version it wrote. A second import writes nothing and says so, because the database is the live content from then on; `--override` imports the folder again over the database and raises the content version.

## Importing an Edition's media

The Recordings and Illustrations in an Edition folder reach the Media Store once (#1770), after its content import and before the Recordings Cron service runs its first backlog. Run it on the owner's laptop with the four `R2_*` of the Media Store's bucket and the Deployment's `DATABASE_URL`; the command refuses to start without any of them, so the files never land in memory. The repo no longer holds those files (ADR 0099), so run the command from a checkout of commit `3c4770c8f`, the last one before they were removed:

```sh
git worktree add ../slovo-media 3c4770c8f
cd ../slovo-media && pnpm install
DATABASE_URL='<the Neon connection string>' R2_ACCOUNT_ID='…' R2_BUCKET='…' \
R2_ACCESS_KEY_ID='…' R2_SECRET_ACCESS_KEY='…' \
pnpm --filter @slovo/backend import-media --edition uk
```

It checks every file first and uploads nothing when one names no Narrator Voice or Word of the Edition, is no mp3, or is an Illustration no Word names. A Recording whose text in `texts.json` no longer matches its Word is left out as stale, for the Recordings job to make again. It puts each file in R2 under its key, writes the media rows at one content version and prints the counts of Recordings, Illustrations and stale ones, and the content version. Compare the counts with the folder's mp3 and PNG files (Recordings + stale = mp3 files). A second run writes nothing and says so; `--force` imports the folder again.

## The quote check

The quote check (ADR 0095) runs on the Deployment as a second Railway service, a Cron service on the same image: its service in `.railway/railway.ts` holds its settings.

| Setting  | Value                                                                  |
| -------- | ---------------------------------------------------------------------- |
| Command  | `pnpm quote-check`                                                     |
| Schedule | `0 * * * *`: hourly, UTC                                               |
| Restart  | Never: the command exits when done, and the next run comes on schedule |

Its one variable is `DATABASE_URL`, a reference to the backend's. A save never waits for it: every create or edit of a Word, Correction, Idiom, Synonym Row or Tip leaves the record unverified, and the job checks the quoted text of each unverified record against its first source's page, through the sourcing cache in Postgres (a fetched page stands for 30 days). A quote it does not find is flagged for the Content queue with the finding, and the record stays live. A page it cannot fetch leaves the record unverified for the next run. Imported records count as checked, since CI ran `pnpm content verify` on them, and a record with no source page is not checked. The admin content report gives the counts of unverified and failed records.

## The Recordings Cron service

The Recordings job (ADR 0083, 0099) runs as a fourth Railway service, a Cron service on an image of its own, declared in `.railway/railway.ts`. `recordings.Dockerfile` is the backend's image plus ffmpeg, the Python of `apps/backend/recordings/` and the voice model, kept apart from the API's image so the web backend doesn't carry the model's gigabytes.

| Setting    | Value                                                                  |
| ---------- | ---------------------------------------------------------------------- |
| Dockerfile | `recordings.Dockerfile`                                                |
| Command    | `pnpm recordings`                                                      |
| Schedule   | `0 * * * *`: hourly, UTC                                               |
| Restart    | Never: the command exits when done, and the next run comes on schedule |

Its variables are `DATABASE_URL`, a reference to the same Postgres, and the four `R2_*` of the Media Store's bucket. Each run takes, per Edition and under a lock of its own, the next 50 live Words in id order that miss a live Recording in one of the Edition's Narrator Voices and Recording Kinds, or whose Lemma or Stress changed. It makes their Recordings with `apps/backend/recordings/generate.py`, puts each file in R2 at `recordings/<voice>/<kind>/<Word id>.<hash>.mp3`, and saves the rows at one content version, so the next Patch carries them. A Word the generator fails for keeps what it has and comes back on the next run. An edit of a Word's Lemma or Stress retires its Recordings at once, in the same Patch as the Word. Last, the run deletes from R2 the file of every Recording or Illustration row retired more than 30 days ago and marks the row, which stays. Turn the Cron service on only after `pnpm import-media` has put the Recordings of commit `3c4770c8f` in the Media Store (Importing an Edition's media), or its first runs record every Word again.

## The alerts Cron service

The owner's alerts and daily digest (spec #1709) run as a third Railway service, a Cron service on the same image: its service in `.railway/railway.ts` holds its settings.

| Setting  | Value                                                                  |
| -------- | ---------------------------------------------------------------------- |
| Command  | `pnpm cron`                                                            |
| Schedule | `*/15 * * * *`: every 15 minutes, UTC                                  |
| Restart  | Never: the command exits when done, and the next run comes on schedule |

Its variables are references to the backend's: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, the `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_APP_PROJECT` and `SENTRY_BACKEND_PROJECT` of Якість, the `POSTHOG_*` of Аналітика, and `BACKEND_HEALTH_URL`, the backend's public `/health` URL. Each run checks the thresholds the owner sets in the admin (crash-free sessions, new Sentry issues, red CI on `main`, API 5xx, the activity drop, the backend's health, the size of open content batches), keeps each alert once for Огляд, and sends the unsent ones to the owner's chat. The first run after 09:00 Kyiv sends the digest of yesterday. A message that does not leave stays unsent for the next run, for 24 hours. A Kill switch alert does not wait for the Cron service: the backend sends it at once.

## Building the Language Pack from the snapshot

Every app build bundles a Language Pack built from the live content: the Edition folder gives the config, Categories and assets, and the records come from the content snapshot the backend serves (`GET /v1/editions/<id>/content/snapshot`). `pnpm build:pack` fetches it from the backend at `EXPO_PUBLIC_SLOVO_API_URL`; `--snapshot <file>` reads a snapshot saved to a file instead. When the backend gives no snapshot, the build fails with the reason and writes no pack.

The EAS build runs it in the `eas-build-post-install` hook of `apps/mobile/package.json`, before bundling, with the address the EAS environment `production` holds; the OTA update workflow runs it through `eas env:exec production`. `pnpm dev`, the smoke flow and CI build it from a local backend over the imported Edition folder.

Owner check for the first real build from the database pack: after the first TestFlight build, the build log of the `eas-build-post-install` hook shows `Built the Language Pack for "uk"` with the content version the Deployment's snapshot holds, and the installed app opens the Feed.

## Content and the operator commands

Content lives in the Deployment's Postgres and reaches the app as Patches (ADR 0090); no pack is published. An app build builds its bundled Language Pack from the Deployment's content snapshot:

```sh
EXPO_PUBLIC_SLOVO_API_URL='<the Deployment backend address>' pnpm build:pack uk
```

The operator credential of the commands below is the Neon connection string of the `main` branch (the Neon console › the project › Connect), given in the command's environment and never written to a file in the repository. A variable in the environment wins over the same one in `apps/backend/.env`, so the local `.env` stays pointed at the local Postgres. The operator commands (`pnpm switches off`, `pnpm reports`, `pnpm collection-links`, `pnpm admin`) reach the Deployment the same way.

## The owner admin's people and Агент tokens

The admin and its API (`/v1/admin`) answer 404 until a Власник exists (ADR 0088). The server commands add the first one and issue or revoke the token of a coding agent; each logs itself in the Action log:

```sh
DATABASE_URL='<the Neon connection string>' pnpm admin owner add <email>
DATABASE_URL='<the Neon connection string>' pnpm admin agent add <name>
DATABASE_URL='<the Neon connection string>' pnpm admin agent revoke <name>
```

The Owner checks of a version live in the same database; the owner ticks them in Розробка. One command adds a check, and a one-time import reads a Markdown file of checks (a line takes the version of the nearest heading that names one, else `--version`; it refuses once the table holds checks):

```sh
DATABASE_URL='<the Neon connection string>' pnpm admin check add <version> <text>
DATABASE_URL='<the Neon connection string>' pnpm admin check import <file> [--version <version>]
```

`agent add` prints the token once; the database keeps its SHA-256 only. The Агент sends it as `Authorization: Bearer <token>`, and only the content-writing procedures of the admin API take it. A person signs in to `/admin` with a code emailed by the mailer above and a TOTP; the TOTP secrets are sealed with a key derived from `AUTH_SECRET`, so rotating it makes every Admin user set up the TOTP again.

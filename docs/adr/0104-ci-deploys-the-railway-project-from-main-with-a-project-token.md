# CI deploys the Railway project from main with a project token

Owner decision of 2026-11-11 (ticket #1796). The Railway project has no source (ADR 0103), so Railway builds nothing on its own when `main` changes; someone has to run `railway up`. A deploy from a laptop depends on whoever is signed in there and on what their checkout holds.

**Decision.** The job "Deploy to Railway" of `.github/workflows/ci.yml` deploys on every push to `main`, once the check "Lint, typecheck, test and Language Pack" passed; a pull request never deploys.

- **A project token.** It signs in with `RAILWAY_TOKEN`, a GitHub Actions secret holding a Railway project token of the `production` environment. The token reaches that one project and environment, not the account, and the CLI reads it from the environment, so no step prints it.
- **Apply, then upload.** It runs `railway config apply --yes`, which brings the project to `.railway/railway.ts`, then `railway up --ci --service <name>` for `backend`, `alerts` and `quote-check`, and for `recordings` only when `recordings.Dockerfile` exists (it comes with the Media Store, ADR 0099). Without `--confirm-destructive`, an apply that would delete a resource fails the job instead.
- **The pinned CLI.** The job installs `@railway/cli` at the exact version the workflow names. The root `railway` package is the SDK that `.railway/railway.ts` imports, not the CLI, and needs CLI 5.42.1 or newer.
- **One at a time.** The concurrency group `railway-deploy` never cancels a running deploy; a newer push waits and replaces any deploy still waiting.

## Considered Options

- **Railway's GitHub integration.** It links the project to a person's GitHub account, which ADR 0103 rules out.
- **Deploy by hand.** Nothing ties what runs to a commit on `main`, and it needs the owner at a laptop.
- **The CLI as a root dependency.** Its postinstall downloads a binary, which the workspace's `allowBuilds` would have to allow on every install, for one CI job.
- **An account token.** It reaches every project of the account; a project token is enough.

## Consequences

- A red `main` deploys nothing; a green one deploys the whole project, services that did not change included.
- A change to `.railway/railway.ts` reaches Railway on merge; `railway config plan` before the merge shows what it changes.
- Rotating the project token means a new token in Railway and the same value in the `RAILWAY_TOKEN` secret.

# The Railway project is Infrastructure as Code in `.railway/railway.ts`

Railway no longer takes Config as Code (`railway.json` and the per-service JSON files) for new services, and stops reading those files on 2026-12-01. The Deployment moves to SLOVO's own Railway account (#1796), so its services are new and need the replacement: Infrastructure as Code.

**`.railway/railway.ts` declares the whole Railway project; the repository holds no secret and no link to a GitHub account.**

- **One TypeScript file.** It uses `railway/iac` from the npm package `railway`, pinned to an exact version in the root `package.json`, and `pnpm typecheck` checks it (`.railway/tsconfig.json`). It declares project `slovo` with four services: `backend`, `alerts`, `quote-check` and `recordings`, with the Dockerfile, command, release (pre-deploy) command, health check, Cron schedule and restart policy the JSON files held. The DSL's `build` and `deploy` take Railway's raw build and deploy settings (`dockerfilePath`, `cronSchedule`, `restartPolicyType`), which it has no shorthand for.
- **EU West, one replica.** Every service runs in `europe-west4-drams3a` (Amsterdam), one replica, near Neon in Frankfurt (ADR 0099).
- **No source.** No service names a repository: a deploy is `railway up` with a project token, so nothing ties the project to a person's GitHub account.
- **Secrets stay in Railway.** Every secret, and every value that belongs to SLOVO's accounts, is `preserve()`: Railway keeps what is set in its variables. The Cron services reference the backend's variables, so each secret is set once. Even `TRUSTED_PROXY_HOPS` is preserved, since it changes from `1` to `2` once Cloudflare is in front (ADR 0099).

## Considered Options

- **Keep the JSON files.** They work for the existing services until 2026-12-01 only, and Railway refuses them for the new project now.
- **Settings by hand in the dashboard.** Nothing reviewable, and the project drifts from the docs.
- **Python or Go authoring file.** Both are in beta; the repo is TypeScript.

## Consequences

- `docs/deploy.md` describes the project from this file; a change to a service's settings is a change to `.railway/railway.ts`.
- A whole-project `railway config apply` can delete a resource the file leaves out, so every service lives in the file.
- The `recordings` service builds `recordings.Dockerfile`, which comes with the Media Store (ADR 0099); it deploys only once that file is on `main`.

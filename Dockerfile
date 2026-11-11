# The backend's one container image (ADR 0063), built from the repository root:
# docker build --tag slovo-backend .
# The workspace packages ship their TypeScript sources, which tsx runs, so the
# build is the install of the backend and the workspace packages it needs. The
# Language Pack is not built here: content lives in the Deployment's Postgres
# and reaches the app as Patches (ADR 0090). `.railway/railway.ts` names the release
# command and the health route.
FROM node:22.23.4-bookworm-slim AS base

# `production` makes the server refuse Mailpit's defaults and leaves the
# development dependencies out of the install. Corepack keeps the pnpm of
# `packageManager` where the unprivileged user can run it.
ENV NODE_ENV=production \
    COREPACK_HOME=/usr/local/share/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CI=true
RUN corepack enable
WORKDIR /app

# The install stage sees the whole workspace, as the lockfile needs, and
# installs the backend's production dependencies alone. @slovo/config is the
# lint and TypeScript setup of the workspace packages, never run here.
FROM base AS install
COPY . .
RUN pnpm install --frozen-lockfile --prod \
      --filter @slovo/backend... --filter '!@slovo/config'
# Content lives in Postgres (ADR 0090): of an Edition's content folder the
# image keeps only the content targets the backend reads at start.
RUN find editions -path '*/content/*' -type f ! -name targets.json -delete

# The owner admin (ADR 0088), built by Vite with the development dependencies
# it needs; the image keeps its dist alone, which the backend serves at /admin.
FROM base AS admin
COPY . .
RUN NODE_ENV=development pnpm install --frozen-lockfile --filter @slovo/admin... \
    && pnpm --filter @slovo/admin build

# The image keeps the backend, the workspace packages it imports, the Editions
# it serves, the built admin and their installs: no other app, no tools, no package store. The
# release command runs through pnpm, which would otherwise try to reinstall
# this partial workspace before the script, and which writes its own version
# into a missing lockfile (the user cannot write /app).
FROM base
ENV pnpm_config_verify_deps_before_run=false
COPY --from=install /usr/local/share/corepack /usr/local/share/corepack
COPY --from=install /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=install /app/node_modules node_modules
COPY --from=install /app/packages/content-rules packages/content-rules
COPY --from=install /app/packages/contracts packages/contracts
COPY --from=install /app/packages/core packages/core
COPY --from=install /app/packages/language-pack packages/language-pack
COPY --from=install /app/packages/server-core packages/server-core
COPY --from=install /app/app app
COPY --from=install /app/editions editions
COPY --from=install /app/apps/backend apps/backend
COPY --from=admin /app/apps/admin/dist apps/admin/dist

WORKDIR /app/apps/backend
USER node
EXPOSE 8787
# The server itself, not pnpm, takes the host's SIGTERM and stops cleanly.
CMD ["node", "--import", "tsx", "src/main.ts"]

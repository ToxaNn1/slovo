# The backend's one container image (ADR 0063), built from the repository root:
# docker build --tag slovo-backend .
# The workspace packages ship their TypeScript sources, which tsx runs, so the
# build is the install of the backend and the workspace packages it needs. The
# Language Pack is not built here: packs reach the Deployment through
# `pnpm publish:pack` (ADR 0032). `railway.json` names the release command
# and the health route.
FROM node:22.23.3-bookworm-slim AS base

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

# The image keeps the backend, the workspace packages it imports, the Editions
# it serves and their installs: no app, no tools, no package store. The
# release command runs through pnpm, which would otherwise try to reinstall
# this partial workspace before the script.
FROM base
ENV pnpm_config_verify_deps_before_run=false
COPY --from=install /usr/local/share/corepack /usr/local/share/corepack
COPY --from=install /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=install /app/node_modules node_modules
COPY --from=install /app/packages/contracts packages/contracts
COPY --from=install /app/packages/core packages/core
COPY --from=install /app/packages/language-pack packages/language-pack
COPY --from=install /app/packages/server-core packages/server-core
COPY --from=install /app/editions editions
COPY --from=install /app/apps/backend apps/backend

WORKDIR /app/apps/backend
USER node
EXPOSE 8787
# The server itself, not pnpm, takes the host's SIGTERM and stops cleanly.
CMD ["node", "--import", "tsx", "src/main.ts"]

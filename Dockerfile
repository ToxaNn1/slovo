# The backend's one container image (ADR 0063), built from the repository root:
# docker build --tag slovo-backend .
# The workspace packages ship their TypeScript sources, which tsx runs, so the
# build is the install of the backend and the workspace packages it needs. The
# Language Pack is not built here: packs reach the Deployment through
# `pnpm publish:pack` (ADR 0032). `railway.json` names the release command
# and the health route.
FROM node:22.23.3-bookworm-slim

# `production` makes the server refuse Mailpit's defaults and leaves the
# development dependencies out of the install. Corepack keeps the pnpm of
# `packageManager` where the unprivileged user can run it.
ENV NODE_ENV=production \
    COREPACK_HOME=/usr/local/share/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CI=true

WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --prod --filter @slovo/backend... \
    && pnpm store prune

WORKDIR /app/apps/backend
USER node
EXPOSE 8787
# The server itself, not pnpm, takes the host's SIGTERM and stops cleanly.
CMD ["node", "--import", "tsx", "src/main.ts"]

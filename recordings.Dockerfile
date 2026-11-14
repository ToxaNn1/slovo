# The image of the Recordings service (ADR 0099), built from the repository
# root: docker build --file recordings.Dockerfile --tag slovo-recordings .
# It is the backend's image (`Dockerfile`) plus the Recordings generator: the
# locked Python 3.10 environment, ffmpeg and the checked model files (ADR
# 0083). They stay out of the backend's own image, which they would grow by
# gigabytes. `.railway/railway.ts` names its hourly command.
FROM node:22.23.4-bookworm-slim AS base
ENV NODE_ENV=production \
    COREPACK_HOME=/usr/local/share/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CI=true
RUN corepack enable
WORKDIR /app

# The backend's production install, as in `Dockerfile`.
FROM base AS install
COPY . .
RUN pnpm install --frozen-lockfile --prod \
      --filter @slovo/backend... --filter '!@slovo/config'
RUN find editions -path '*/content/*' -type f -delete

# The generator's build: uv, the environment of requirements.lock and the
# model files of the upstream v6.0.0 release, each checked by SHA256. Three
# locked packages come from git and some compile C, so this stage has git and
# a compiler; the image keeps only /opt/recordings.
FROM base AS generator
RUN apt-get update -q \
    && apt-get install -yq --no-install-recommends build-essential git curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /usr/local/bin/uv
ENV UV_PYTHON_INSTALL_DIR=/opt/recordings/python
COPY apps/backend/recordings /opt/recordings/scripts
RUN /opt/recordings/scripts/setup.sh /opt/recordings/venv \
    && /opt/recordings/scripts/fetch-model.sh /opt/recordings/model \
    && rm -rf /root/.cache

# The generator at run time: ffmpeg and the built /opt/recordings.
FROM base AS engine
RUN apt-get update -q \
    && apt-get install -yq --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=generator /opt/recordings /opt/recordings

FROM engine
ENV pnpm_config_verify_deps_before_run=false \
    RECORDINGS_PYTHON=/opt/recordings/venv/bin/python \
    RECORDINGS_MODEL_DIR=/opt/recordings/model
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

WORKDIR /app/apps/backend
USER node
CMD ["pnpm", "recordings"]

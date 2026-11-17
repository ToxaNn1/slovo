#!/bin/bash
# Commit as the owner with the noreply address (env identity overrides -c otherwise).
exec env -u GIT_AUTHOR_EMAIL -u GIT_COMMITTER_EMAIL -u GIT_AUTHOR_NAME -u GIT_COMMITTER_NAME \
  git -c user.name=anton -c user.email="$(cat "$(git rev-parse --show-toplevel)/.github/owner-email")" commit "$@"

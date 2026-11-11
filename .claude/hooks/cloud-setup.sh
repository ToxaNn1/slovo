#!/usr/bin/env bash
# SLOVO cloud sessions need Postgres 18 and the workspace dependencies before the first step.
# This SessionStart hook sets both up in a cloud session (Claude Code on the web) and prints one line,
# so the setup output stays out of the model's context. The full log goes to /tmp/cloud-setup.log.
# Locally it does nothing. It always exits 0: a failed setup is reported, never blocks the session.

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

LOG=/tmp/cloud-setup.log
START=$(date +%s)
STEP=start
: >"$LOG"

fail() {
  echo "cloud setup FAILED at $STEP, see $LOG"
  exit 0
}

run() {
  echo "+ $*" >>"$LOG"
  "$@" >>"$LOG" 2>&1 || fail
}

postgres_18_ready() {
  pg_isready -q -p 5432 >>"$LOG" 2>&1 &&
    pg_lsclusters --no-header 2>>"$LOG" | awk '$1 == 18 && $3 == 5432 && $4 == "online"' | grep -q .
}

if ! postgres_18_ready; then
  STEP="PGDG repo key"
  CURL=(curl -fsSL)
  [ -f /root/.ccr/ca-bundle.crt ] && CURL+=(--cacert /root/.ccr/ca-bundle.crt)
  echo "+ ${CURL[*]} https://www.postgresql.org/media/keys/ACCC4CF8.asc" >>"$LOG"
  "${CURL[@]}" https://www.postgresql.org/media/keys/ACCC4CF8.asc 2>>"$LOG" |
    gpg --batch --yes --dearmor -o /usr/share/keyrings/pgdg.gpg >>"$LOG" 2>&1 || fail

  STEP="PGDG repo"
  CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME")
  echo "deb [signed-by=/usr/share/keyrings/pgdg.gpg] https://apt.postgresql.org/pub/repos/apt $CODENAME-pgdg main" \
    >/etc/apt/sources.list.d/pgdg.list 2>>"$LOG" || fail

  STEP="apt-get install postgresql-18"
  run apt-get update -q
  run env DEBIAN_FRONTEND=noninteractive apt-get install -y -q postgresql-18

  STEP="move cluster 16 to port 5434"
  if pg_lsclusters --no-header 2>>"$LOG" | awk '$1 == 16' | grep -q .; then
    pg_ctlcluster 16 main stop >>"$LOG" 2>&1 || true
    run pg_conftool 16 main set port 5434
    pg_ctlcluster 16 main start >>"$LOG" 2>&1 || true
  fi

  STEP="start cluster 18 on 5432"
  run pg_conftool 18 main set port 5432
  pg_lsclusters --no-header 2>>"$LOG" | awk '$1 == 18 && $4 == "online"' | grep -q . ||
    run pg_ctlcluster 18 main start
  postgres_18_ready || fail
fi

STEP="role and database slovo"
psql_postgres() { su postgres -c "psql -p 5432 -tAc \"$1\""; }
if [ "$(psql_postgres "SELECT 1 FROM pg_roles WHERE rolname = 'slovo'" 2>>"$LOG")" != "1" ]; then
  run su postgres -c "psql -p 5432 -c \"CREATE ROLE slovo LOGIN PASSWORD 'slovo' CREATEDB\""
fi
if [ "$(psql_postgres "SELECT 1 FROM pg_database WHERE datname = 'slovo'" 2>>"$LOG")" != "1" ]; then
  run su postgres -c "psql -p 5432 -c \"CREATE DATABASE slovo OWNER slovo\""
fi

STEP="pnpm install"
cd "${CLAUDE_PROJECT_DIR:-.}" || fail
run pnpm install --frozen-lockfile

STEP="CLAUDE_ENV_FILE"
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export DATABASE_URL=postgres://slovo:slovo@localhost:5432/slovo" >>"$CLAUDE_ENV_FILE" || fail
fi

echo "cloud setup: Postgres 18 on 5432, deps installed, $(($(date +%s) - START)) s"
exit 0

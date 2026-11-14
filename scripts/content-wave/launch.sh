#!/usr/bin/env bash
# Starts a content wave from a plan: one cloud implementer per plan line, each
# with its brief filled in, and one waiter per implementer. See
# docs/agents/content-wave.md.
#
#   scripts/content-wave/launch.sh [--dry-run] <plan file>
#
# Plan file, `#` comments, blank lines ignored:
#   wave <wave branch> <minutes per implementer>
#   <branch> <kind> <list file> <count>      one line per implementer
# Kinds: words, idioms, corrections, synonyms. List files are paths from the
# repository root and must be on the wave branch on origin.
#
# --dry-run prints every brief and command and starts nothing. Otherwise the
# launcher starts the sessions, then waits for every waiter and prints one line
# per implementer as it ends; it exits 1 unless every implementer is DONE.
set -euo pipefail

dry_run=false
if [ "${1:-}" = "--dry-run" ]; then
  dry_run=true
  shift
fi
if [ "$#" -ne 1 ]; then
  echo "usage: launch.sh [--dry-run] <plan file>" >&2
  exit 2
fi
plan=$1

fail() {
  echo "launch.sh: $plan: $1" >&2
  exit 2
}

# Kind -> sourcing command, review folder, Content CLI kind.
kind_of() {
  case $1 in
    words) echo 'source:words words word' ;;
    idioms) echo 'source:idioms idioms idiom' ;;
    corrections) echo 'source:corrections corrections correction' ;;
    synonyms) echo 'source:synonyms synonyms synonymRow' ;;
    *) return 1 ;;
  esac
}

wave='' minutes='' n=0
branches=() kinds=() lists=() counts=()
while IFS= read -r raw || [ -n "$raw" ]; do
  n=$((n + 1))
  line=${raw%%#*}
  read -r -a f <<<"$line" || true
  [ "${#f[@]}" -eq 0 ] && continue
  if [ -z "$wave" ]; then
    if [ "${#f[@]}" -ne 3 ] || [ "${f[0]}" != wave ] || ! [[ ${f[2]} =~ ^[1-9][0-9]*$ ]]; then
      fail "line $n: expected «wave <branch> <minutes>» first"
    fi
    wave=${f[1]} minutes=${f[2]}
    continue
  fi
  if [ "${#f[@]}" -ne 4 ] || ! [[ ${f[3]} =~ ^[1-9][0-9]*$ ]]; then
    fail "line $n: expected «<branch> <kind> <list file> <count>»"
  fi
  kind_of "${f[1]}" >/dev/null || fail "line $n: unknown kind «${f[1]}»"
  branches+=("${f[0]}") kinds+=("${f[1]}") lists+=("${f[2]}") counts+=("${f[3]}")
done <"$plan"
[ -n "$wave" ] || fail "line 1: expected «wave <branch> <minutes>» first"
[ "${#branches[@]}" -gt 0 ] || fail "no implementer line"

# Through symlinks: on macOS the temp folder /var is /private/var.
logs="$(cd "${TMPDIR:-/tmp}" && pwd -P)/slovo-wave-${wave//\//-}"

brief() { # <branch> <kind> <list> <count>
  local b=$1 list=$3 count=$4 cmd dir ikind
  read -r cmd dir ikind <<<"$(kind_of "$2")"
  local review="tools/sourcing/review/$dir"
  cat <<EOF
SLOVO cloud content implementer, wave ${wave}, branch ${b}: ${count} ${2} from ${list}. Follow docs/agents/content-wave.md («Implementer»).
First: git fetch origin; git checkout -b ${b} origin/${wave} (if on origin: check it out, go on from its last commit body).
Grant: push ONLY ${b}, with the report commit alone; no commit of content, no PR, no merge, no EAS.
Steps: pnpm install --frozen-lockfile; pnpm ${cmd} ${list} --edition uk (snapshot: SLOVO_API_URL or --snapshot <file>); tail ${review}/review-report.md; keep at most ${count} files in ${review}/drafts, never take incomplete/; pnpm content verify ${review}/drafts --edition uk; pnpm content check ${ikind} ${review}/drafts --edition uk; pnpm content add ${ikind} ${review}/drafts --edition uk (SLOVO_AGENT_TOKEN, SLOVO_API_URL).
Rules: every text quoted word for word (ADR 0012, 0080); no article goroh marks «Велика мовна модель»; never write the Edition folder; pages only through the sourcing tool and its cache, no curl loops.
Context: <=10 lookups (grep -n, sed -n), output through tail -20, never print a content folder; STUCK at ~140k.
Finish: one empty commit «chore: DONE ${b}» (or FAILED/STUCK), body: report in Ukrainian, <=25 lines: added (add's lines), refused, dropped and why, problems. Owner's identity; no Co-Authored-By, no AI attribution.
EOF
}

slug() { echo "${1//\//-}"; }

start_command() { # <branch>
  local s
  s=$(slug "$1")
  echo "script -q '$logs/$s.log' claude --cloud \"\$(cat '$logs/$s.brief')\" </dev/null >/dev/null"
}

# Own ref per branch and no FETCH_HEAD, so parallel waiters never race; ${b}
# braced so `:refs` stays out of the name.
waiter() { # <branch>
  cat <<EOF
b='$1'; end=\$((SECONDS + $minutes * 60)); until git ls-remote --exit-code origin "refs/heads/\${b}" >/dev/null && git fetch -q --no-write-fetch-head origin "+refs/heads/\${b}:refs/wave/\${b}" && s=\$(git log -1 --format=%s "refs/wave/\${b}") && printf '%s\n' "\$s" | grep -qE '^chore: (DONE|FAILED|STUCK)'; do if [ "\$SECONDS" -ge "\$end" ]; then echo "STALE \${b}"; exit 1; fi; sleep 60; done; echo "\${b}: \$s"
EOF
}

if $dry_run; then
  for i in "${!branches[@]}"; do
    b=${branches[$i]}
    echo "== $b: ${counts[$i]} ${kinds[$i]} from ${lists[$i]}"
    echo "--- brief"
    brief "$b" "${kinds[$i]}" "${lists[$i]}" "${counts[$i]}"
    echo "--- start"
    start_command "$b"
    echo "--- waiter"
    waiter "$b"
  done
  exit 0
fi

command -v claude >/dev/null || fail "claude is not on PATH"
cd "$(dirname "$0")/../.."
git fetch -q --no-write-fetch-head origin "+refs/heads/${wave}:refs/wave/${wave}"
for i in "${!lists[@]}"; do
  git cat-file -e "refs/wave/${wave}:${lists[$i]}" 2>/dev/null ||
    fail "${lists[$i]} is not on origin/$wave; commit and push it first"
done
mkdir -p "$logs"
for i in "${!branches[@]}"; do
  b=${branches[$i]}
  brief "$b" "${kinds[$i]}" "${lists[$i]}" "${counts[$i]}" >"$logs/$(slug "$b").brief"
  bash -c "$(start_command "$b")"
  echo "started $b; session URL in $logs/$(slug "$b").log"
done
pids=()
for b in "${branches[@]}"; do
  (
    line=$(bash -c "$(waiter "$b")") || true
    echo "$line"
    [[ $line == *": chore: DONE"* ]]
  ) &
  pids+=("$!")
done
status=0
for pid in "${pids[@]}"; do
  wait "$pid" || status=1
done
exit "$status"

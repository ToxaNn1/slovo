# Merger brief (release channels wave)

In /home/user/slovo (integration branch feat/1961-release-channels checked out; first `git status` must be clean and on that branch), merge the local ticket branch named in your prompt:
1. `git merge --no-ff --no-commit <branch>`. Resolve conflicts keeping both sides' intent. Generated files (migrations `meta/` + .sql, v1.openapi.json, pnpm-lock.yaml, routeTree.gen.ts): take the integration side, then regenerate with the script; never hand-edit or print them. Commit with `/tmp/claude-0/gc.sh -m 'chore: merge #<n>: <ticket title>'` (never plain git commit, never type an email).
2. `export DATABASE_URL=postgres://slovo:slovo@localhost:5432/slovo`; `pnpm install --frozen-lockfile --offline | tail -2`; `pnpm turbo run lint typecheck test <filters for the packages the merge changed> --output-logs=errors-only 2>&1 | tail -30`. Fix merge-caused failures minimally (commit `fix(<scope>): ...` via gc.sh). «permission denied to terminate process» only = flake, rerun once.
3. Green: `git push origin feat/1961-release-channels 2>&1 | tail -2` (retry ≤4 on network error). Never force-push.
Reply ≤5 lines: merge sha, conflicts and how resolved, checks, push. Red: do not push; give failing tests and errors.

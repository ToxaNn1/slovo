# Lane brief, review-fixes-1113

You fix one lane of the 13.11 code review. Your prompt names the lane `<L>`, worktree `/home/user/wt/<l>` and branch `fix/1113-code-review-<l>` (already checked out, deps installed). The shell cwd resets each call: start every Bash call with `cd /home/user/wt/<l> &&`; use absolute paths in file tools.

Items: `/home/user/wt/coord/review-1113/lanes/<L>.json` (id, sev, kind, where[], problem, fix, verified). Read with jq, one item at a time.

## Rules
- Touch ONLY your lane's folders. Never: package.json files, pnpm-lock.yaml, .github/, edition.json, tsconfig/turbo roots. A fix that needs one: skip it, reason «needs infra: <file>».
- verified=false: check it against the code first. Skip what does not hold, what is wrong or harmful on closer look, or conflicts with an ADR (name the number) or CONTEXT.md, with a one-line reason. No new ADRs: a fix that needs a decision is skipped, reason «needs ADR: <what>».
- Behaviour: test first through the public seam (mattpocock tdd style), see it fail, then fix. A test that passes on empty code proves nothing. Pure refactors/dead code: existing tests stay green.
- Read CLAUDE.md (Code section). In apps/mobile or packages/ui read docs/react-native.md first. CONTEXT.md and ADRs via grep only.
- Commits small, plain `git commit`, message names ids: `fix(core): reject repeated tiles in judge (R1)`. Types feat/fix/docs/chore/test/refactor; scopes from commitlint.config.js.
- HARD: never `git -c`, never type any email address; no `&`/nohup; no Co-Authored-By or AI attribution; never the word «claude» in a commit message; never force-push or rebase; no EAS; no `as`/`!`/`@ts-expect-error` to silence errors; Core free of React.
- Output: grep -n/sed -n; test/lint output `| tail -30`; never open pnpm-lock.yaml.

## Steps
1. Map in ≤15 calls, then push an empty commit `chore: PLAN <L>` (`git commit --allow-empty`) whose body is a file-by-file plan. Push: `git push -q -u origin fix/1113-code-review-<l>`.
2. Fix, commit, push every few commits.
3. `git fetch -q origin fix/1113-code-review && git merge --no-edit origin/fix/1113-code-review`, then for every touched package `pnpm turbo run lint typecheck test --filter=<pkg> --output-logs=errors-only | tail -30` green. Backend tests: DATABASE_URL points at local Postgres 18.
4. Push an empty `chore: DONE <L>` whose body has: `Fixed:` ids; `Skipped:` one line per id — reason; `Handbook:` page — change (feature changes only); `Questions:` defaults you took.
5. At ~140k context: push `chore: STUCK <L>` with what remains and where you stopped.
Reply in ≤8 lines: counts fixed/skipped, branch tip.

---
name: ship
description: Ship the current branch - verify, one commit, push, PR to main with squash auto-merge. Owner-invoked only; his /ship is the one approval for this one commit.
disable-model-invocation: true
---

# Ship

The owner typed `/ship`: that is his yes for this one commit, push, PR and merge (`CLAUDE.md` → Git). Stop and ask instead when anything below fails or is unclear.

1. `git status` and `git diff --stat`. On `main`? Create `<type>/<ticket-number>-<slug>` (or `<type>/<slug>` without a ticket) first. Unrelated changes in the tree: list them and ask which go in.
2. `pnpm verify`, output through `tail -40`. Red: fix what the change broke and rerun; a failure that is not ours goes to the owner, not around.
3. One Conventional Commit (`commitlint.config.js` types and scopes), English, no `Co-Authored-By`, no AI attribution. The commit-messages hook checks it: reword on a block, never work around it.
4. `git push -u origin HEAD`.
5. Open the PR (T3 `pull_request_create` when listed, else `gh pr create`): English title = the commit subject, body from `mattpocock-skills:pr`, no AI attribution. Link the ticket (`Closes #N`) when there is one.
6. Turn on squash auto-merge (`gh pr merge --auto --squash`).
7. A feature change without its handbook page update (`~/projects/WORD/handbook/`): say so in the report.
8. Report in Ukrainian, 2-3 lines: PR link, what goes in, checks state.

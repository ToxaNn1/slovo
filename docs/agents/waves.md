# Spec waves

How the coordinator builds a spec. The owner's scheme since 2026-11-03: `/mattpocock-skills:implement-spec`, with the SLOVO rules below. Implementers follow [ticket-brief.md](ticket-brief.md). A content wave (new Entries from the sourcing tool) runs by [content-wave.md](content-wave.md).

## Shape

- One **integration branch** per spec, `<type>/<spec-number>-<slug>`, cut from `origin/main` and checked out in the main repo folder. Each ticket gets a ticket branch `<type>/<n>-<slug>`: pushed by a cloud implementer, or local in its own worktree for a laptop implementer.
- The spec reaches `main` as ONE PR: CI runs on it, the review runs once, auto-merge squashes it on green.
- No wave runner, heartbeat commits, Monitor or watchers. Every implementer's end reaches the coordinator as a notification: a background subagent's report, or the exit of the one waiter of a cloud session.

## Steps

1. Work only on the tickets the owner's grant names.
2. Create the integration branch and push it.
3. **Implementers**, one per ticket on the frontier (blockers merged into the integration branch), model per `CLAUDE.md`, at most 5 at once, never two at once on the same hot file (Edition strings, `edition.json`, `CONTEXT.md`, the ADR index, barrels). Brief ≤ 1.5 KB of pointers: ticket number, ticket branch, integration branch, the Testing Decisions, verification, grant, «follow `docs/agents/ticket-brief.md`».
   - A ticket with both a Core part and an app part goes to two implementers one after the other on the same branch: the Core part, then the UI part from its handoff.
   - **Cloud first.** Launch with a pseudo-terminal, since `--cloud` refuses to run without one: `script -q /tmp/cloud-<n>.log claude --cloud "<brief>" </dev/null >/dev/null`. The log holds the session URL. Then start ONE background Bash per ticket that exits when the ticket branch on `origin` ends in a status commit, or on a timeout of 1.5× the budget: `until git ls-remote --exit-code origin refs/heads/<branch> >/dev/null && git fetch -q origin <branch> && git log -1 --format=%s FETCH_HEAD | grep -qE 'DONE|FAILED|STUCK'; do sleep 60; done`, with a deadline. The report is that commit's body. A cloud session asks nothing: `.claude/hooks/cloud-approve.mjs` approves its tool calls and turns a question into its own decision, written in the report, or a `STUCK` commit. A SessionStart hook, `.claude/hooks/cloud-setup.sh`, installs Postgres 17 on port 5432 with role and database `slovo`, runs `pnpm install` and sets `DATABASE_URL` before the first step, so a brief needs no setup steps. `Agent` with `isolation: "remote"` is no cloud path here: it runs as a local worktree, and its `git push` fails.
   - **Laptop** only for simulator, Docker or screenshot work, at most 2 at once: a background subagent with `isolation: "worktree"`. It commits locally and does not push. Its report arrives as the subagent notification.
4. **On each report**, act in the same turn:
   - `DONE #n`: merge the ticket branch (cloud: `origin/<branch>` after a fetch) into the integration branch (`git merge --no-ff -m 'chore: merge #n: <ticket title>'`: commitlint checks every commit of the PR, merges too), run the changed packages' checks, push. After the first merge open a draft PR against `main` (`Closes` the spec and its tickets).
   - `FAILED`, `STUCK`, or a report without that first line: relaunch from its handoff on the same branch, split the ticket, or ask the owner (serious matters only). Never leave it for later.
   - Start every ticket the merge put on the frontier.
5. **End:** `code-review` on the integration branch; one implementer fixes the findings. PR body: Checks, «Questions for the owner», «Owner checks», new reader-visible texts. Mark it ready and `gh pr merge --auto --squash`, unless prominent copy waits for «текст ок». Red CI: one implementer fixes it.
6. Remove the implementer worktrees and the pushed ticket branches.

## Unchanged

Grants, the token budget, Feature Switches, «текст ок», one visual pass per version, the machine-load limit, no EAS build without the owner's word, the owner's authorship and no AI attribution.

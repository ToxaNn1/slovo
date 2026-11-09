# Spec waves

How the coordinator builds a spec. The owner's scheme since 2026-11-03: `/mattpocock-skills:implement-spec`, with the SLOVO rules below. Implementers follow [ticket-brief.md](ticket-brief.md). A content wave (new Entries from the sourcing tool) runs by [content-wave.md](content-wave.md).

## Shape

- One **integration branch** per spec, `<type>/<spec-number>-<slug>`, cut from `origin/main` and checked out in the main repo folder. Each ticket gets a ticket branch `<type>/<n>-<slug>`: pushed by a cloud implementer, or local in its own worktree for a laptop implementer.
- The spec reaches `main` in **short PRs**, one every 3–5 merged tickets: the integration branch's PR goes ready with auto-merge on green, squashes into `main`, and the coordinator merges the new `origin/main` into the integration branch for the next batch (a merge, never a force-push). The last PR `Closes` the spec. Every time anything lands on `main`, the coordinator merges `origin/main` into the integration branch the same turn.
- Unattended cloud work always has a safety net that does not need the laptop: a cloud routine every 30 minutes that relaunches a session from its `HANDOFF.md` when its branches got no commit for 30 minutes.
- No wave runner, heartbeat commits, Monitor or watchers. Every implementer's end reaches the coordinator as a notification: a background subagent's report, or the exit of the one waiter of a cloud session.

## Parallel waves

Several specs may build at once, at most 3, when they cannot conflict:

- **Lanes.** At the start the coordinator writes each wave's lane: the folders it may change (`apps/admin/`, `packages/core/src/feed/` …). Every implementer brief says «touch only these folders». Two waves whose lanes share a folder run one after another. A ticket that needs a folder outside its lane stops with `STUCK` and names it.
- **Infra queue.** Hot shared files change only in the infra queue, never inside a wave: `package.json` files and `pnpm-lock.yaml`, `.github/workflows/`, the switches in `edition.json`. A wave that needs one asks the coordinator; the change goes to `main` as its own small PR, one at a time, and the waves merge `main` after it. Dependency bumps, CI changes and new tools go there too.
- **Reserved numbers.** At the start the coordinator reserves a range of ADR numbers and of migration numbers per wave (next free in `docs/adr/README.md` and `apps/backend/migrations/`) and writes it in every brief. A wave uses only its range; unused numbers are given back when it ends.
- **Generated files are regenerated, never hand-merged.** On a conflict in one, take `main`'s side, then rerun its generator and commit the result: `pnpm install` for `pnpm-lock.yaml`; `pnpm --filter backend db:generate` for a migration and its `meta/` snapshot (drop the wave's own migration first, regenerate on top of `main`'s); `pnpm --filter contracts describe-api` for `v1.openapi.json`; the router's generator for `routeTree.gen.ts`.
- **Owner decisions up front.** Questions are gathered before the wave starts; what is still open gets the coordinator's default, written in the PR body.

## Steps

1. Work only on the tickets the owner's grant names.
2. Create the integration branch and push it.
3. **Implementers**, one per ticket on the frontier (blockers merged into the integration branch), model per `CLAUDE.md`, at most 5 at once, never two at once on the same hot file (Edition strings, `edition.json`, `CONTEXT.md`, the ADR index, barrels). Brief ≤ 1.5 KB of pointers: ticket number, ticket branch, integration branch, the Testing Decisions, verification, grant, «follow `docs/agents/ticket-brief.md`».
   - A ticket with both a Core part and an app part goes to two implementers one after the other on the same branch: the Core part, then the UI part from its handoff.
   - Every cloud brief also says: commit with plain `git commit`; never a command that holds the owner's email (a permission prompt freezes an unattended session); no `&` or `nohup`; no AI attribution; batch pushes.
   - **Cloud first.** Launch with a pseudo-terminal, since `--cloud` refuses to run without one: `script -q /tmp/cloud-<n>.log claude --cloud "<brief>" </dev/null >/dev/null`. The log holds the session URL. Then start ONE background Bash per ticket that exits when the ticket branch on `origin` ends in a status commit, or on a timeout of 1.5× the budget: `until git ls-remote --exit-code origin refs/heads/<branch> >/dev/null && git fetch -q origin <branch> && git log -1 --format=%s FETCH_HEAD | grep -qE 'DONE|FAILED|STUCK'; do sleep 60; done`, with a deadline. The report is that commit's body. A cloud session asks nothing: `.claude/hooks/cloud-approve.mjs` approves its tool calls and turns a question into its own decision, written in the report, or a `STUCK` commit. A SessionStart hook, `.claude/hooks/cloud-setup.sh`, installs Postgres 17 on port 5432 with role and database `slovo`, runs `pnpm install` and sets `DATABASE_URL` before the first step, so a brief needs no setup steps. `Agent` with `isolation: "remote"` is no cloud path here: it runs as a local worktree, and its `git push` fails.
   - **Laptop** only for simulator, Docker or screenshot work, at most 2 at once: a background subagent with `isolation: "worktree"`. It commits locally and does not push. Its report arrives as the subagent notification.
4. **On each report**, act in the same turn:
   - `DONE #n`: merge the ticket branch (cloud: `origin/<branch>` after a fetch) into the integration branch (`git merge --no-ff -m 'chore: merge #n: <ticket title>'`: commitlint checks every commit of the PR, merges too), run the changed packages' checks, push. Update the ticket's handbook pages (`CLAUDE.md`, «Source of truth») from the merged diff and the report. After the first merge of a batch open a draft PR against `main` (`Closes` the batch's tickets). After 3–5 merged tickets run `code-review` on the batch, mark the PR ready and `gh pr merge --auto --squash`.
   - `FAILED`, `STUCK`, or a report without that first line: relaunch from its handoff on the same branch, split the ticket, or ask the owner (serious matters only). Never leave it for later.
   - Start every ticket the merge put on the frontier.
5. **Each batch PR and the end:** `code-review` on the batch; one implementer fixes the findings. PR body: Checks, «Questions for the owner», «Owner checks», new reader-visible texts. The coordinator adds each Owner check to the database with `pnpm admin check add <version> "<text>"` (`docs/deploy.md`). Mark it ready and `gh pr merge --auto --squash`, unless prominent copy waits for «текст ок». Red CI: one implementer fixes it. The last batch PR `Closes` the spec.
6. Remove the implementer worktrees and the pushed ticket branches.

## Unchanged

Grants, the token budget, Feature Switches, «текст ок», one visual pass per version, the machine-load limit, no EAS build without the owner's word, the owner's authorship and no AI attribution.

# HANDOFF review-fixes-1113

STATUS: ACTIVE

## Task
Owner 13.11: fix all 176 items of review-1113/items.json in the cloud; commits, pushes, one PR fix/1113-code-review -> main, CI green, no auto-merge, no merge, no tickets. verified=false items (27) checked against code first; items that don't hold, are wrong/harmful or conflict with an ADR are skipped with a one-line reason. ADR numbers 0121-0124 reserved. Never wait for the owner: defaults go under «Questions for the owner» in the PR.

## Setup notes
- Session env carried the wrong commit email; GitHub refuses it. The owner identity is .github/owner-email: export GIT_AUTHOR_EMAIL/GIT_COMMITTER_EMAIL from that file in the shell snapshot (never type it).
- Postgres 18 cluster had to be created: `pg_createcluster 18 main -p 5432`, then rerun .claude/hooks/cloud-setup.sh.
- mattpocock-skills plugin is not installed in the cloud container: implement-spec followed from docs/agents/waves.md.

## Lanes
Items per lane: review-1113/lanes/<lane>.json. Lane branch fix/1113-code-review-<lane> from fix/1113-code-review. Status commit on lane branch: `chore: DONE|STUCK <lane>` with report body (fixed ids, skipped id+reason).

| lane | folders | items | status |
| ---- | ------- | ----- | ------ |
| L1 | packages/core | 15 | DONE 10/15, R52 R54 R55 to do (relaunch) |
| L2 | packages/content-rules, packages/language-pack | 17 | running |
| L3a | packages/ui/src/{game,entries,primitives} | 27 | running |
| L3b | rest of packages/ui | 25 | todo |
| L4 | apps/mobile | 24 | todo |
| L5 | apps/backend, packages/server-core, packages/contracts | 32 | running |
| L6 | apps/admin, apps/video, tools, scripts | 23 | DONE 20, R134 R135 relaunched (coord 2) |
| LX | cross-folder items, after all lanes | 14 (+R79 from L6) | todo |

## Log
- 2026-11-13T18:31:04Z step 0: HANDOFF, lane files, WAVES.md on coord/safety-net
- 2026-11-13T18:32:14Z launched L1 (Fable), L3a, L5, L6 (Opus) as background subagents in /home/user/wt/<l>; L2 L3b L4 queued
- WAITING until 20:02Z for L1 L3a L5 L6
- L6 STUCK after 10 fixed (R44 R45 R132 R130 R65 R81 R82 R46 R47 R131); R79 moved to LX (needs SwitchRefusalSchema/AccessRefusalSchema exported from @slovo/contracts/admin-api). L6 relaunched on its branch; L2 launched.
- Coordinator how-to: lane subagents are background Agents in worktrees /home/user/wt/<l> (deps installed). Wait with /tmp/claude-0/wait.sh <min> <lanes> (polls origin lane tips for DONE/STUCK). On DONE: merger subagent merges origin/fix/1113-code-review-<l> into fix/1113-code-review (--no-ff, `chore: merge lane <L>`), runs checks of the lane's packages, pushes. Queue: L3b, L4 (worktrees ready), then LX, then code review, merge origin/main, PR.
- A fresh coordinator in a new container must redo the Setup notes (identity from .github/owner-email via shell snapshot; Postgres cluster) and recreate worktrees from the pushed lane branches.
- 18:42Z L3a STUCK at 5/27 (R6 R10 R68 R69 R12 fixed, R11 skipped: Pressable sets accessibilityState.disabled); relaunched. Note: lane subagents hit ~120k after 5-10 items; expect relaunches.
- 18:44Z L1 DONE 10/15 (R52 R54 R55 still to do: relaunch L1 when a slot frees; R153 R170 skipped ok). L5 STUCK 6/32 (R3 R34 R4 R117 R30 R119), relaunched incl. R79 contracts export. Running: L2 L3a L5 L6.
- 2026-11-13 L2 STUCK 8/17 (R36 R40 R41 R122 R123 R144 R145 R146; R166 part), relaunched.
## HANDOFF to the next coordinator (previous one near its context limit)
Live implementers of the previous coordinator (in the old container) on: L2, L3a, L5, L6. Do NOT relaunch those lanes until their origin tip is a NEW `chore: DONE|STUCK <L>` commit dated after this line; a STUCK tip older than this line is already being continued.
Your next steps:
1. Setup notes above (identity via .github/owner-email exported in the shell snapshot, Postgres). Clone lane branches into worktrees /home/user/wt/<l>, `pnpm install --frozen-lockfile --offline`. Copy the lane brief and lane files: they are in this branch at review-1113/ (brief paths /home/user/wt/coord/... expect this branch checked out at /home/user/wt/coord).
2. Relaunch L1 now on its branch for R52 R54 R55 (R54/R55 were skipped only for context, must be done; R52 needs a new Entries seam: build it). L1 tip is `chore: DONE L1`; new work goes on top, end with a new DONE L1.
3. Launch L3b and L4 (branches not yet pushed: create fix/1113-code-review-l3b/l4 from origin/fix/1113-code-review). Max ~4 lanes at once.
4. Merge every DONE lane (merger subagent, one at a time). Then LX (review-1113/lanes/LX.json, 14 items incl. R79 admin side using L5's export, plus R127 if contracts allow). Then code review of the integration diff, fixes, `git merge origin/main`, PR (body per the task), REPORT.md, STATUS: FINISHED, WAVES.md finished.
Notes: lane subagents reach ~130k after 5-10 items; always relaunch from the STUCK body. Commit author is the noreply owner address: correct. L1 used one `perf(core)` commit (hook accepted it).
- 18:45Z coordinator (2) started as cloud session session_01VefVQUAKPt8Ak4bxrvvsRC; old container keeps its 4 live lane implementers (L2 L3a L5 L6) until they push a status commit.
- 18:47Z coordinator (2): setup redone (Postgres, identity in snapshot); main repo on fix/1113-code-review, coord branch at /home/user/wt/coord; worktrees l1 l3b l4; launched L1 (R52 R54 R55, Fable), L3b, L4 (Opus). Old container still runs L2 L3a L5 L6. Wait script /tmp/claude-0/wait.sh <min> <since> <lanes>.
- 18:51Z L6 DONE 20 fixed (old container); R134 R135 not attempted -> L6 relaunched here; merger merging L6 into integration.

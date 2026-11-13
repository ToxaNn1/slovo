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
| L1 | packages/core | 15 | running |
| L2 | packages/content-rules, packages/language-pack | 17 | todo |
| L3a | packages/ui/src/{game,entries,primitives} | 27 | running |
| L3b | rest of packages/ui | 25 | todo |
| L4 | apps/mobile | 24 | todo |
| L5 | apps/backend, packages/server-core, packages/contracts | 32 | running |
| L6 | apps/admin, apps/video, tools, scripts | 23 | running |
| LX | cross-folder items, after all lanes | 13 | todo |

## Log
- 2026-11-13T18:31:04Z step 0: HANDOFF, lane files, WAVES.md on coord/safety-net
- 2026-11-13T18:32:14Z launched L1 (Fable), L3a, L5, L6 (Opus) as background subagents in /home/user/wt/<l>; L2 L3b L4 queued
- WAITING until 20:02Z for L1 L3a L5 L6

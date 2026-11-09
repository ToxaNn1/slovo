# Cloud safety net: active waves (coordination branch, never merged)

The safety routine reads this file every 30 minutes. One `## wave` block per wave.
Coordinators: add your wave when it starts; set `status: finished` when its PR is green with auto-merge on (or its draft PR is complete).
Before a blocking wait over 20 min, push a line `WAITING until <UTC ISO time>: <what>` at the end of your HANDOFF.md.

## wave admin-1709
status: finished
coord: coord/admin-wave
branches: ^origin/(feat/1709-admin|coord/admin-wave|(feat|chore|fix)/17[0-3][0-9]-)
brief:
You are the admin wave coordinator (specs #1708/#1709, PR #1746), in the cloud; the previous coordinator stopped. Read HANDOFF.md on origin/coord/admin-wave (its log tail says where the work is) and continue; read docs/agents/map.md and the skill mattpocock-skills:implement-spec (implementers = Opus subagents with tdd in own worktrees; merger subagents). Goal: #1746 merges origin/main, #1728's ADR moves to the next free number, migrations renumbered after main's (`pnpm --filter @slovo/backend db:generate` reports no changes), content-rules fixture fixed, code-review (medium) fixes, green CI, ready + `gh pr merge 1746 --auto --squash`. #1735 stays open. Owner questions: safe default under «Питання власнику» in the PR body, never block. Grants: commits, pushes, PRs.

## wave review-tails
status: finished
coord: coord/global-review-tails
branches: ^origin/(coord/global-review-tails|(feat|chore|fix|docs|test|refactor)/.*1109-)
brief:
You are the coordinator of the «global review tails» wave, in the cloud; the previous coordinator stopped. Read HANDOFF.md on origin/coord/global-review-tails (input review/REPORT.md, review/OWNER-DECISIONS-1106.md, progress log) and continue. Scope: Medium/Low findings fixable and provable by tests/typecheck/lint; SKIP visual, owner decisions, and every file under apps/admin, apps/backend, packages/server-core, packages/content-rules. Integration branch fix/1109-global-review-tails; implementers = Opus subagents with tdd in own worktrees; one DRAFT PR to main «fix: global review tails (Medium/Low)» listing fixed / skipped + why; leave it draft, NO merge to main. Grants: commits, pushes, one draft PR. When every finding in scope is done or skipped: `STATUS: FINISHED` first line of HANDOFF.md.

## wave infra-1109
status: finished
coord: coord/infra-1109
branches: ^origin/(coord/infra-1109|docs/1109-conflict-free-waves|(chore|docs|test)/1109-)
brief:
You are the infra wave coordinator, in the cloud; the previous coordinator stopped. Read HANDOFF.md on origin/coord/infra-1109 (tasks, grants, log) and continue from the log tail. Grants: commits, pushes, PRs; no main merge except #1752's existing auto-merge. Never touch feat/1108-video or apps/video.

## wave ci-affected-1109
status: finished
coord: coord/ci-affected-1109
branches: ^origin/(coord/ci-affected-1109|chore/1109-ci-affected-tests)
brief:
You are the CI affected tests coordinator, in the cloud; the previous coordinator stopped. Read HANDOFF.md on origin/coord/ci-affected-1109 and continue from the log tail. Grants: commits, pushes, one PR; no main merge, no auto-merge. Never touch feat/1108-video, apps/video or #1756.
